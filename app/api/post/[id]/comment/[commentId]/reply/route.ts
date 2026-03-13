import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../../../lib/authOptions';
import { prisma } from '../../../../../../../lib/prisma';
import { uploadToSupabase, supabaseObjectPath } from '../../../../../../../lib/supabase';

export async function POST(req: Request, { params }: { params: { id: string; commentId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const text = (formData.get('text') as string || '').trim();
    const files = formData.getAll('files') as File[];

    if (!text && files.length === 0) {
      return NextResponse.json({ error: 'Text or media required' }, { status: 400 });
    }

    const comment = await prisma.comment.findUnique({ where: { id: params.commentId } });
    if (!comment || comment.postId !== params.id) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Upload media to Supabase
    const mediaUrls: string[] = [];
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const key = supabaseObjectPath(`replies/${session.user.email}`, file.name);
        const url = await uploadToSupabase(key, buffer, file.type || 'application/octet-stream');
        mediaUrls.push(url);
      } catch (uploadErr) {
        console.warn('Reply media upload failed, skipping:', file.name, uploadErr);
      }
    }

    const prof = await prisma.profile.findUnique({ where: { email: session.user.email } });
    const displayName = prof?.name || session.user.name || session.user.email?.split('@')[0] || 'Anonymous';
    const avatarUrl = prof?.avatarUrl ?? null;

    const reply = await prisma.reply.create({
      data: {
        commentId: params.commentId,
        email: session.user.email,
        name: displayName,
        avatarUrl,
        text: text || '',
        mediaUrls,
      },
    });

    return NextResponse.json({ reply: { ...reply, _id: reply.id } });
  } catch (e) {
    console.error('Reply POST error', e);
    return NextResponse.json({ error: 'Failed to add reply' }, { status: 500 });
  }
}
