import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/authOptions';
import { prisma } from '../../../../../lib/prisma';
import { uploadToSupabase, supabaseObjectPath } from '../../../../../lib/supabase';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const comments = await prisma.comment.findMany({
      where: { postId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        userLikes: true,
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { userLikes: true },
        },
      },
    });

    // Enrich with profile avatars/names from Prisma
    const emails = new Set<string>();
    for (const c of comments) {
      emails.add(c.email);
      for (const r of c.replies) emails.add(r.email);
    }
    const emailArr = Array.from(emails);
    const profiles = emailArr.length
      ? await prisma.profile.findMany({ where: { email: { in: emailArr } } })
      : [];
    const nameMap = new Map(profiles.map((p) => [p.email, p.name]));
    const avatarMap = new Map(profiles.map((p) => [p.email, p.avatarUrl]));

    const enriched = comments.map((c) => ({
      ...c,
      _id: c.id,
      name: c.name || nameMap.get(c.email) || c.email?.split('@')[0],
      avatarUrl: c.avatarUrl || avatarMap.get(c.email) || null,
      replies: c.replies.map((r) => ({
        ...r,
        _id: r.id,
        name: r.name || nameMap.get(r.email) || r.email?.split('@')[0],
        avatarUrl: r.avatarUrl || avatarMap.get(r.email) || null,
      })),
    }));

    return NextResponse.json({ comments: enriched });
  } catch (e) {
    console.error('Comments GET error', e);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const text = (formData.get('text') as string || '').trim();
    const files = formData.getAll('files') as File[];

    if (!text && files.length === 0) {
      return NextResponse.json({ error: 'Text or media required' }, { status: 400 });
    }

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Upload media to Supabase
    const mediaUrls: string[] = [];
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const key = supabaseObjectPath(`comments/${session.user.email}`, file.name);
        const url = await uploadToSupabase(key, buffer, file.type || 'application/octet-stream');
        mediaUrls.push(url);
      } catch (uploadErr) {
        console.warn('Comment media upload failed, skipping:', file.name, uploadErr);
      }
    }

    const prof = await prisma.profile.findUnique({ where: { email: session.user.email } });
    const displayName = prof?.name || session.user.name || session.user.email?.split('@')[0] || 'Anonymous';
    const avatarUrl = prof?.avatarUrl ?? null;

    // Extract first URL from text for link preview
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    const linkUrl = urlMatch?.[0] ?? null;

    const comment = await prisma.comment.create({
      data: {
        postId: id,
        email: session.user.email,
        name: displayName,
        avatarUrl,
        text: text || '',
        mediaUrls,
        linkUrl,
      },
    });

    return NextResponse.json({ comment: { ...comment, _id: comment.id } });
  } catch (e) {
    console.error('Comments POST error', e);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
