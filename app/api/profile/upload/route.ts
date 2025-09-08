import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/authOptions';
import mongoose from 'mongoose';
import Profile from '../../../../models/Profile';
import fs from 'fs/promises';
import path from 'path';

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
  const safeName = file.name.replace(/\s/g, '_');
  const filename = `${Date.now()}-${safeName}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, buffer);
  const fileUrl = `/uploads/${filename}`;

  const set: any = {};
  if (type === 'avatar') set.avatarUrl = fileUrl;
  else if (type === 'cover') set.coverUrl = fileUrl;
  set.updatedAt = new Date();
  const doc = await Profile.findOneAndUpdate({ email }, { $set: set }, { new: true, upsert: true }).lean();
  return NextResponse.json({ url: fileUrl, profile: doc });
}

