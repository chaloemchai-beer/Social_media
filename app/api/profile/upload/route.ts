import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/authOptions';
import mongoose from 'mongoose';
import Profile from '../../../../models/Profile';
import { uploadToSupabase, supabaseObjectPath } from '../../../../lib/supabase';
import { sbUpsertProfile } from '../../../../lib/supabase-db';

async function connect() {
  if (mongoose.connections[0]?.readyState) return;
  await mongoose.connect(process.env.MONGODB_URI as string);
}

export async function POST(req: Request) {
  await connect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const email = session.user.email as string;

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

  const set: any = {};
  if (type === 'avatar') set.avatarUrl = fileUrl;
  else if (type === 'cover') set.coverUrl = fileUrl;
  set.updatedAt = new Date();
  const USE_SB = process.env.USE_SUPABASE_DB === 'true'
  let profile: any = null
  if (USE_SB) {
    const patch: any = { email }
    if (type === 'avatar') patch.avatar_url = fileUrl
    if (type === 'cover') patch.cover_url = fileUrl
    const sb = await sbUpsertProfile(patch)
    profile = {
      email,
      name: sb.name || '',
      bio: sb.bio || '',
      location: sb.location || '',
      website: sb.website || '',
      avatarUrl: (sb as any).avatar_url || null,
      coverUrl: (sb as any).cover_url || null,
      friendsCount: (sb as any).friends_count || 0,
    }
  } else {
    profile = await Profile.findOneAndUpdate({ email }, { $set: set }, { new: true, upsert: true }).lean();
  }
  return NextResponse.json({ url: fileUrl, profile });
}
