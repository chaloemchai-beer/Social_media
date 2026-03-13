import { NextResponse } from 'next/server';

// In production (Railway), the socket server runs as a separate service,
// so this endpoint is just a health-check passthrough.
// In local dev, it starts the embedded socket server.
export async function GET() {
  if (process.env.NODE_ENV !== 'production') {
    // Lazy-start the embedded socket server for local development
    const { getIO } = await import('@/lib/socketServer');
    getIO();
  }
  return NextResponse.json({ ok: true });
}
