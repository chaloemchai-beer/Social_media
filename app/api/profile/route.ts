import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Profile from '../../../models/Profile';
import { sbGetProfile, sbUpsertProfile } from '../../../lib/supabase-db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/authOptions';

async function connect() {
  if (mongoose.connections[0]?.readyState) return;
  await mongoose.connect(process.env.MONGODB_URI as string);
}

const USE_SB = process.env.USE_SUPABASE_DB === 'true'

export async function GET() {
  await connect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const email = session.user.email as string;
  if (USE_SB) {
    let profile = await sbGetProfile(email);
    if (!profile) {
      profile = await sbUpsertProfile({ email, name: session.user.name || '' });
    }
    // normalize keys to existing frontend expectations
    return NextResponse.json({
      email,
      name: profile.name || '',
      bio: profile.bio || '',
      location: profile.location || '',
      website: profile.website || '',
      avatarUrl: (profile as any).avatar_url || null,
      coverUrl: (profile as any).cover_url || null,
      friendsCount: (profile as any).friends_count || 0,
    });
  } else {
    let profile = await Profile.findOne({ email }).lean();
    if (!profile) {
      const doc = new Profile({ email, name: session.user.name || '' });
      profile = (await doc.save()).toObject();
    }
    return NextResponse.json(profile);
  }
}

export async function PUT(req: Request) {
  await connect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const email = session.user.email as string;
  const body = await req.json().catch(() => ({}));
  const allowed = ['name', 'bio', 'location', 'website'];
  const update: any = {};
  for (const k of allowed) if (typeof body[k] === 'string') update[k] = body[k];
  update.updatedAt = new Date();
  if (USE_SB) {
    const sbRes = await sbUpsertProfile({
      email,
      name: update.name,
      bio: update.bio,
      location: update.location,
      website: update.website,
    } as any)
    return NextResponse.json({
      email,
      name: sbRes.name || '',
      bio: sbRes.bio || '',
      location: sbRes.location || '',
      website: sbRes.website || '',
      avatarUrl: (sbRes as any).avatar_url || null,
      coverUrl: (sbRes as any).cover_url || null,
      friendsCount: (sbRes as any).friends_count || 0,
    })
  } else {
    const res = await Profile.findOneAndUpdate({ email }, { $set: update }, { new: true, upsert: true }).lean();
    return NextResponse.json(res);
  }
}
