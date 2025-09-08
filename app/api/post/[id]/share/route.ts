import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Post from '../../../../../models/Post';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/authOptions';

async function connect() {
  if (mongoose.connections[0]?.readyState) return;
  await mongoose.connect(process.env.MONGODB_URI as string);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await connect();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { text = '' } = await req.json().catch(() => ({ text: '' }));

    const original = await Post.findById(params.id);
    if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Create a new post referencing the original
    const shared = new Post({
      text: String(text || ''),
      email: session.user.email,
      name: session.user.name || 'Anonymous',
      sharedFrom: original._id,
      createdAt: new Date(),
    } as any);
    await shared.save();

    // Increment original share count
    original.shareCount = (original.shareCount || 0) + 1;
    await original.save();

    return NextResponse.json({ message: 'Shared', shareId: shared._id, shareCount: original.shareCount });
  } catch (e) {
    console.error('Share error', e);
    return NextResponse.json({ error: 'Failed to share' }, { status: 500 });
  }
}

