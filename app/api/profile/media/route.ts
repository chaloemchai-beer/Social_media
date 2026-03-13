import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/authOptions';
import { prisma } from '../../../../lib/prisma';
import { uploadToSupabase, supabaseObjectPath } from '../../../../lib/supabase';

// GET /api/profile/media?type=photo|video|live  (omit type = all)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || undefined;

  const items = await prisma.profileMedia.findMany({
    where: { email: session.user.email, ...(type ? { type } : {}) },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(items);
}

// POST /api/profile/media  multipart: file, type (photo|video|live), title?, duration?
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const email = session.user.email;

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const type = String(form.get('type') || '').trim();
  const title = String(form.get('title') || '').trim() || null;
  const duration = form.get('duration') ? Number(form.get('duration')) : null;

  if (!file || !['photo', 'video', 'live'].includes(type)) {
    return NextResponse.json({ error: 'file and valid type required' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const key = supabaseObjectPath(`profile-media/${email}/${type}`, file.name);
  const url = await uploadToSupabase(key, buffer, file.type || 'application/octet-stream');

  const item = await prisma.profileMedia.create({
    data: { email, type, url, title, duration },
  });

  return NextResponse.json(item);
}

// DELETE /api/profile/media?id=xxx
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await prisma.profileMedia.deleteMany({
    where: { id, email: session.user.email },
  });

  return NextResponse.json({ ok: true });
}
