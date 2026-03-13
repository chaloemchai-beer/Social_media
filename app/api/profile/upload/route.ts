import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/authOptions';
import { prisma } from '../../../../lib/prisma';
import { uploadToSupabase, supabaseObjectPath } from '../../../../lib/supabase';
import { cacheSet, CK, TTL } from '../../../../lib/cache';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const email = session.user.email;

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const type = String(form.get('type') || '').trim(); // 'avatar' | 'cover'
  if (!file || !type || !['avatar', 'cover'].includes(type)) {
    return NextResponse.json({ error: 'file and valid type required' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const key = supabaseObjectPath(`profile/${email}`, file.name);
  const fileUrl = await uploadToSupabase(key, buffer, file.type || 'application/octet-stream');

  const update: any = {};
  if (type === 'avatar') update.avatarUrl = fileUrl;
  else update.coverUrl = fileUrl;

  const profile = await prisma.profile.upsert({
    where: { email },
    update,
    create: { email, ...update },
  });

  const profileData = {
    email: profile.email,
    name: profile.name || '',
    bio: profile.bio || '',
    location: profile.location || '',
    website: profile.website || '',
    avatarUrl: profile.avatarUrl || null,
    coverUrl: profile.coverUrl || null,
    friendsCount: profile.friendsCount,
  };
  await cacheSet(CK.profile(email), profileData, TTL.PROFILE);
  return NextResponse.json({ url: fileUrl, profile: profileData });
}
