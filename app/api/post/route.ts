import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/authOptions';
import { prisma } from '../../../lib/prisma';
import { uploadToSupabase, supabaseObjectPath } from '../../../lib/supabase';
import { cacheGet, cacheSet, cacheDelPattern, TTL, CK } from '../../../lib/cache';

export const POST = async (req: Request) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const text = formData.get('text') as string;
    const feelingType = (formData.get('feelingType') as string) || undefined;
    const feelingValue = (formData.get('feelingValue') as string) || undefined;
    const feelingEmoji = (formData.get('feelingEmoji') as string) || undefined;
    const files = formData.getAll('files') as File[];

    let imageUrl: string | null = null;
    const imageUrls: string[] = [];
    let videoUrl: string | null = null;

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const key = supabaseObjectPath(`posts/${session.user.email || 'anon'}`, file.name);
        const publicUrl = await uploadToSupabase(key, buffer, file.type || 'application/octet-stream');
        if (file.type.startsWith('image')) {
          imageUrls.push(publicUrl);
          imageUrl = imageUrl || publicUrl;
        } else if (file.type.startsWith('video')) {
          videoUrl = publicUrl;
        }
      } catch (uploadErr) {
        console.warn('Media upload failed, skipping file:', file.name, uploadErr);
      }
    }

    // Resolve display name from Prisma Profile
    const prof = await prisma.profile.findUnique({ where: { email: session.user.email } });
    const resolvedName = prof?.name || session.user.name || session.user.email?.split('@')[0] || 'Anonymous';

    const post = await prisma.post.create({
      data: {
        text,
        imageUrl,
        imageUrls,
        videoUrl,
        feelingType,
        feelingValue,
        feelingEmoji,
        email: session.user.email,
        name: resolvedName,
      },
    });

    // Invalidate feed caches so new post appears immediately
    await cacheDelPattern('posts:*');

    return NextResponse.json({ message: 'Post created successfully!', id: post.id });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
};

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    const { searchParams } = new URL(request.url);
    const filterEmail = searchParams.get('email') || undefined;

    const take = Math.min(parseInt(searchParams.get('take') || '20'), 50);
    const skip = parseInt(searchParams.get('skip') || '0');
    const where = filterEmail ? { email: filterEmail } : {};

    // Cache key includes pagination + filter so each page is cached independently
    const cacheKey = `posts:${filterEmail || 'feed'}:${skip}:${take}`;
    const cached = await cacheGet<any[]>(cacheKey);

    let posts: any[];
    let profiles: any[];

    if (cached) {
      // Cached data doesn't include per-user reaction — we'll resolve that below
      posts = cached;
      profiles = [];
    } else {
      const dbPosts = await prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          userReactions: {
            select: { email: true, type: true },
          },
          _count: { select: { comments: true } },
          sharedFrom: {
            include: { _count: { select: { comments: true } } },
          },
        },
      });

      // Enrich with profile data from Prisma
      const authorEmails = Array.from(new Set(dbPosts.map((p) => p.email).filter(Boolean)));
      profiles = authorEmails.length
        ? await prisma.profile.findMany({ where: { email: { in: authorEmails } } })
        : [];
      const nameMap = new Map(profiles.map((p: any) => [p.email, p.name]));
      const avatarMap = new Map(profiles.map((p: any) => [p.email, p.avatarUrl]));

      posts = dbPosts.map((p) => {
        const reactionCounts = p.userReactions.reduce((acc, r) => {
          acc[r.type] = (acc[r.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        let sharedFrom: any = undefined;
        if (p.sharedFrom) {
          const o = p.sharedFrom;
          sharedFrom = {
            _id: o.id,
            email: o.email,
            name: o.name || (o.email?.split('@')[0]) || 'Anonymous',
            text: o.text,
            imageUrl: o.imageUrl,
            imageUrls: o.imageUrls,
            videoUrl: o.videoUrl,
            createdAt: o.createdAt,
          };
        }

        return {
          _id: p.id,
          text: p.text,
          imageUrl: p.imageUrl,
          imageUrls: p.imageUrls,
          videoUrl: p.videoUrl,
          email: p.email,
          name: p.name,
          displayName: nameMap.get(p.email) || p.name || p.email?.split('@')[0] || 'Anonymous',
          authorAvatarUrl: avatarMap.get(p.email) ?? null,
          feelingType: p.feelingType,
          feelingValue: p.feelingValue,
          feelingEmoji: p.feelingEmoji,
          shareCount: p.shareCount,
          reactionCounts,
          // Store all reactions so we can resolve per-user from cache
          _reactions: p.userReactions,
          commentCount: p._count.comments,
          sharedFrom,
          createdAt: p.createdAt,
        };
      });

      await cacheSet(cacheKey, posts, TTL.POSTS);
    }

    // Resolve per-user reaction (never cached — always accurate)
    const shaped = posts.map(({ _reactions, ...rest }) => ({
      ...rest,
      currentUserReaction: email
        ? (_reactions || []).find((r: any) => r.email === email)?.type || null
        : null,
    }));

    return NextResponse.json(shaped);
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
