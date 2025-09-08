import { NextResponse } from 'next/server';
import { getOrCreateStream, setOffer } from '@/lib/liveStore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id || '').trim();
    const sdp = String(body?.sdp || '').trim();
    if (!id || !sdp) return NextResponse.json({ error: 'id and sdp required' }, { status: 400 });
    getOrCreateStream(id);
    setOffer(id, sdp);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
}

