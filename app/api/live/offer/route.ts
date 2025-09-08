import { NextResponse } from 'next/server';
import { getStream } from '@/lib/liveStore';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get('id') || '').trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const s = getStream(id);
  if (!s || !s.offer) return NextResponse.json({ offer: null });
  return NextResponse.json({ offer: s.offer });
}

