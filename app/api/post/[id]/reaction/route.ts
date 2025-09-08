import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Post from '../../../../../models/Post';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/authOptions';

const VALID = ['like','love','care','haha','wow','sad','angry'] as const;
type ReactionType = typeof VALID[number];

async function connect() {
  if (mongoose.connections[0]?.readyState) return;
  await mongoose.connect(process.env.MONGODB_URI as string);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await connect();
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  const post = await Post.findById(params.id).lean();
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const currentUserReaction = email
    ? (post.userReactions || []).find((r: any) => r.email === email)?.type || null
    : null;

  return NextResponse.json({
    reactionCounts: post.reactionCounts || {},
    currentUserReaction,
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await connect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const email = session.user.email as string;

  const body = await req.json().catch(() => ({}));
  const type = body?.type as ReactionType | null; // null/undefined removes reaction
  if (type && !VALID.includes(type)) {
    return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
  }

  const post = await Post.findById(params.id);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const current = (post.userReactions || []).find((r: any) => r.email === email);

  // Remove reaction
  if (!type) {
    if (current) {
      // decrement current count and remove from array
      // @ts-ignore
      if (post.reactionCounts?.[current.type] > 0) post.reactionCounts[current.type] -= 1;
      post.userReactions = post.userReactions.filter((r: any) => r.email !== email);
      await post.save();
    }
    return NextResponse.json({ reactionCounts: post.reactionCounts, currentUserReaction: null });
  }

  // If user has existing reaction
  if (current) {
    if (current.type === type) {
      // toggle off
      // @ts-ignore
      if (post.reactionCounts?.[current.type] > 0) post.reactionCounts[current.type] -= 1;
      post.userReactions = post.userReactions.filter((r: any) => r.email !== email);
      await post.save();
      return NextResponse.json({ reactionCounts: post.reactionCounts, currentUserReaction: null });
    } else {
      // switch type
      // @ts-ignore
      if (post.reactionCounts?.[current.type] > 0) post.reactionCounts[current.type] -= 1;
      // @ts-ignore
      post.reactionCounts[type] = (post.reactionCounts?.[type] || 0) + 1;
      current.type = type;
      current.updatedAt = new Date();
      await post.save();
      return NextResponse.json({ reactionCounts: post.reactionCounts, currentUserReaction: type });
    }
  } else {
    // New reaction
    // @ts-ignore
    post.reactionCounts[type] = (post.reactionCounts?.[type] || 0) + 1;
    post.userReactions.push({ email, type, updatedAt: new Date() } as any);
    await post.save();
    return NextResponse.json({ reactionCounts: post.reactionCounts, currentUserReaction: type });
  }
}
