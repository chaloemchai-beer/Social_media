import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Post from '../../../../../../../models/Post';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../../../lib/authOptions';
import Profile from '../../../../../../../models/Profile';

async function connect() {
  if (mongoose.connections[0]?.readyState) return;
  await mongoose.connect(process.env.MONGODB_URI as string);
}

export async function POST(req: Request, { params }: { params: { id: string; commentId: string } }) {
  await connect();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const text = (body?.text || '').toString().trim();
    if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 });

    const post = await Post.findById(params.id);
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const comment: any = post.comments.id(params.commentId);
    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

    let displayName: string | undefined = undefined;
    let avatarUrl: string | null = null;
    try {
      const prof = await Profile.findOne({ email: session.user.email }).lean();
      if (prof?.name) displayName = prof.name as string;
      if (prof?.avatarUrl) avatarUrl = prof.avatarUrl as string;
    } catch {}

    const reply: any = {
      email: session.user.email as string,
      name: displayName || (session.user.name as string) || (session.user.email?.split('@')[0]) || 'Anonymous',
      avatarUrl,
      text,
      createdAt: new Date(),
    };
    comment.replies = comment.replies || [];
    comment.replies.push(reply);
    await post.save();

    const added = comment.replies[comment.replies.length - 1];
    return NextResponse.json({ reply: added });
  } catch (e) {
    console.error('Reply POST error', e);
    return NextResponse.json({ error: 'Failed to add reply' }, { status: 500 });
  }
}
