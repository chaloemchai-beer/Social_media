import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/authOptions';
import { prisma } from '../../../../../lib/prisma';
import { cacheDelPattern } from '../../../../../lib/cache';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { text = '' } = await req.json().catch(() => ({ text: '' }));

    const original = await prisma.post.findUnique({ where: { id } });
    if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [shared, updated] = await prisma.$transaction([
      prisma.post.create({
        data: {
          text: String(text || ''),
          email: session.user.email,
          name: session.user.name || 'Anonymous',
          sharedFromId: id,
        },
      }),
      prisma.post.update({
        where: { id: id },
        data: { shareCount: { increment: 1 } },
      }),
    ]);

    await cacheDelPattern('posts:*');
    return NextResponse.json({ message: 'Shared', shareId: shared.id, shareCount: updated.shareCount });
  } catch (e) {
    console.error('Share error', e);
    return NextResponse.json({ error: 'Failed to share' }, { status: 500 });
  }
}
