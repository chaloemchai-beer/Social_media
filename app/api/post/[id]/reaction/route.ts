import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/authOptions';
import { prisma } from '../../../../../lib/prisma';
import { cacheDelPattern } from '../../../../../lib/cache';

const VALID = ['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'] as const;
type ReactionType = (typeof VALID)[number];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  const postExists = await prisma.post.count({ where: { id } });
  if (!postExists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Use groupBy to aggregate in the DB instead of loading all reaction rows
  const [groups, userReaction] = await Promise.all([
    prisma.userReaction.groupBy({
      by: ['type'],
      where: { postId: id },
      _count: true,
    }),
    email
      ? prisma.userReaction.findFirst({
          where: { postId: id, email },
          select: { type: true },
        })
      : null,
  ]);

  const reactionCounts = Object.fromEntries(groups.map((g) => [g.type, g._count]));
  const currentUserReaction = userReaction?.type || null;

  return NextResponse.json({ reactionCounts, currentUserReaction });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => ({}));
  const type = body?.type as ReactionType | null;
  if (type && !VALID.includes(type)) {
    return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
  }

  const postExists = await prisma.post.count({ where: { id } });
  if (!postExists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const existing = await prisma.userReaction.findFirst({
    where: { postId: id, email },
  });

  if (!type) {
    if (existing) await prisma.userReaction.delete({ where: { id: existing.id } });
  } else if (existing) {
    if (existing.type === type) {
      await prisma.userReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.userReaction.update({ where: { id: existing.id }, data: { type } });
    }
  } else {
    await prisma.userReaction.create({ data: { postId: id, email, type } });
  }

  // Invalidate cached posts so updated reaction counts are reflected
  await cacheDelPattern('posts:*');

  // Aggregate counts in DB instead of loading all rows
  const groups = await prisma.userReaction.groupBy({
    by: ['type'],
    where: { postId: id },
    _count: true,
  });
  const reactionCounts = Object.fromEntries(groups.map((g) => [g.type, g._count]));
  const afterReaction = await prisma.userReaction.findFirst({
    where: { postId: id, email },
    select: { type: true },
  });
  const currentUserReaction = afterReaction?.type || null;

  return NextResponse.json({ reactionCounts, currentUserReaction });
}
