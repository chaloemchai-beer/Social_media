import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Post from '../../../../../../../models/Post';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../../../lib/authOptions';

async function connect() {
  if (mongoose.connections[0]?.readyState) return;
  await mongoose.connect(process.env.MONGODB_URI as string);
}

export async function POST(_req: Request, { params }: { params: { id: string; commentId: string } }) {
  await connect();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const email = session.user.email as string;

    const post = await Post.findById(params.id);
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const comment: any = post.comments.id(params.commentId);
    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

    comment.userLikes = comment.userLikes || [];
    const idx = comment.userLikes.findIndex((u: any) => u.email === email);
    let liked: boolean;
    if (idx >= 0) {
      // remove like
      comment.userLikes.splice(idx, 1);
      if (comment.likes > 0) comment.likes -= 1;
      liked = false;
    } else {
      comment.userLikes.push({ email, updatedAt: new Date() });
      comment.likes = (comment.likes || 0) + 1;
      liked = true;
    }

    await post.save();
    return NextResponse.json({ likes: comment.likes || 0, liked });
  } catch (e) {
    console.error('Comment like error', e);
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
  }
}
