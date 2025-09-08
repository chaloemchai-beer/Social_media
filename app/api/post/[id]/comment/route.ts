import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Post from '../../../../../models/Post';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/authOptions';
import Profile from '../../../../../models/Profile';

async function connect() {
  if (mongoose.connections[0]?.readyState) return;
  await mongoose.connect(process.env.MONGODB_URI as string);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await connect();
  try {
    const post = await Post.findById(params.id).lean();
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const comments = (post.comments || [])
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    // Enrich names and avatars from profiles for comments and replies
    const emails = new Set<string>();
    for (const c of comments) {
      if (c?.email) emails.add(c.email);
      const replies = Array.isArray(c?.replies) ? c.replies : [];
      for (const r of replies) if (r?.email) emails.add(r.email);
    }
    const emailArr = Array.from(emails);
    const profiles = emailArr.length ? await Profile.find({ email: { $in: emailArr } }).lean() : [];
    const nameMap = new Map(profiles.map((p: any) => [p.email, p.name]));
    const avatarMap = new Map(profiles.map((p: any) => [p.email, p.avatarUrl]));

    const enriched = comments.map((c: any) => {
      const base: any = {
        ...c,
        name: c.name || nameMap.get(c.email) || (c.email?.split('@')[0]),
        avatarUrl: c.avatarUrl || avatarMap.get(c.email) || null,
      };
      const replies = Array.isArray(c?.replies) ? c.replies : [];
      base.replies = replies.map((r: any) => ({
        ...r,
        name: r.name || nameMap.get(r.email) || (r.email?.split('@')[0]),
        avatarUrl: r.avatarUrl || avatarMap.get(r.email) || null,
      }));
      return base;
    });

    return NextResponse.json({ comments: enriched });
  } catch (e) {
    console.error('Comments GET error', e);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await connect();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const text = (body?.text || '').toString().trim();
    if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 });

    const post = await Post.findById(params.id);
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // resolve display name & avatar
    let displayName: string | undefined = undefined;
    let avatarUrl: string | null = null;
    try {
      const prof = await Profile.findOne({ email: session.user.email }).lean();
      if (prof?.name) displayName = prof.name as string;
      if (prof?.avatarUrl) avatarUrl = prof.avatarUrl as string;
    } catch {}

    const comment = {
      email: session.user.email as string,
      name: displayName || (session.user.name as string) || (session.user.email?.split('@')[0]) || 'Anonymous',
      avatarUrl,
      text,
      createdAt: new Date(),
    } as any;
    post.comments = post.comments || [];
    post.comments.push(comment);
    await post.save();
    return NextResponse.json({ comment });
  } catch (e) {
    console.error('Comments POST error', e);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
