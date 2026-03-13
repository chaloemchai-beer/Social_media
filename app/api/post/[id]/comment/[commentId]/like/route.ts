import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../../../lib/authOptions';
import { prisma } from '../../../../../../../lib/prisma';

export async function POST(_req: Request, { params }: { params: { id: string; commentId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const email = session.user.email;

    const comment = await prisma.comment.findUnique({
      where: { id: params.commentId },
      select: { id: true, postId: true },
    });
    if (!comment || comment.postId !== params.id) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Use the unique constraint instead of loading all likes and filtering in JS
    const existing = await prisma.commentLike.findUnique({
      where: { commentId_email: { commentId: params.commentId, email } },
    });
    let liked: boolean;

    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } });
      await prisma.comment.update({
        where: { id: params.commentId },
        data: { likes: { decrement: 1 } },
      });
      liked = false;
    } else {
      await prisma.commentLike.create({ data: { commentId: params.commentId, email } });
      await prisma.comment.update({
        where: { id: params.commentId },
        data: { likes: { increment: 1 } },
      });
      liked = true;
    }

    const updated = await prisma.comment.findUnique({ where: { id: params.commentId } });
    return NextResponse.json({ likes: updated?.likes ?? 0, liked });
  } catch (e) {
    console.error('Comment like error', e);
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
  }
}
