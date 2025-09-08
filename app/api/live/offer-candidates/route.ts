import { NextResponse } from 'next/server';
import { drainOfferCandidates, pushOfferCandidate } from '@/lib/liveStore';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get('id') || '').trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const list = drainOfferCandidates(id);
  return NextResponse.json({ candidates: list });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id || '').trim();
    const candidate = body?.candidate;
    if (!id || !candidate) return NextResponse.json({ error: 'id and candidate required' }, { status: 400 });
    pushOfferCandidate(id, candidate);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
}

