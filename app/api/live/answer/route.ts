import { NextResponse } from 'next/server';
import { getStream, setAnswer } from '@/lib/liveStore';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get('id') || '').trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const s = getStream(id);
  return NextResponse.json({ answer: s?.answer || null });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id || '').trim();
    const sdp = String(body?.sdp || '').trim();
    if (!id || !sdp) return NextResponse.json({ error: 'id and sdp required' }, { status: 400 });
    const s = getStream(id);
    if (!s) return NextResponse.json({ error: 'not found' }, { status: 404 });
    setAnswer(id, sdp);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
}

