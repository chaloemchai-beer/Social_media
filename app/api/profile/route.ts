import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Profile from '../../../models/Profile';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/authOptions';

async function connect() {
  if (mongoose.connections[0]?.readyState) return;
  await mongoose.connect(process.env.MONGODB_URI as string);
}

export async function GET() {
  await connect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const email = session.user.email as string;
  let profile = await Profile.findOne({ email }).lean();
  if (!profile) {
    // Create a minimal default profile
    const doc = new Profile({ email, name: session.user.name || '' });
    profile = (await doc.save()).toObject();
  }
  return NextResponse.json(profile);
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
  const res = await Profile.findOneAndUpdate({ email }, { $set: update }, { new: true, upsert: true }).lean();
  return NextResponse.json(res);
}

