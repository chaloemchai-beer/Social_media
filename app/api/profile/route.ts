import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/authOptions';
import { prisma } from '../../../lib/prisma';
import { cacheGet, cacheSet, cacheDel, CK, TTL } from '../../../lib/cache';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const email = session.user.email;

  const cached = await cacheGet(CK.profile(email));
  if (cached) return NextResponse.json(cached);

  const profile = await prisma.profile.upsert({
    where: { email },
    update: {},
    create: { email, name: session.user.name || '' },
  });

  const data = {
    email: profile.email,
    name: profile.name || '',
    bio: profile.bio || '',
    location: profile.location || '',
    website: profile.website || '',
    avatarUrl: profile.avatarUrl || null,
    coverUrl: profile.coverUrl || null,
    friendsCount: profile.friendsCount,
  };
  await cacheSet(CK.profile(email), data, TTL.PROFILE);
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => ({}));
  const update: any = {};
  for (const k of ['name', 'bio', 'location', 'website']) {
    if (typeof body[k] === 'string') update[k] = body[k];
  }

  const profile = await prisma.profile.upsert({
    where: { email },
    update,
    create: { email, ...update },
  });

  const data = {
    email: profile.email,
    name: profile.name || '',
    bio: profile.bio || '',
    location: profile.location || '',
    website: profile.website || '',
    avatarUrl: profile.avatarUrl || null,
    coverUrl: profile.coverUrl || null,
    friendsCount: profile.friendsCount,
  };
  await cacheSet(CK.profile(email), data, TTL.PROFILE);
  return NextResponse.json(data);
}
