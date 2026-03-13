import { NextResponse } from 'next/server';

// In-memory cache for OG previews (1 hour TTL)
const ogCache = new Map<string, { data: Record<string, unknown>; ts: number }>();
const OG_CACHE_TTL = 60 * 60 * 1000;

function getMeta(html: string, prop: string): string | null {
  // Matches both property="..." and name="..." variants, content before or after
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
  return (a?.[1] ?? b?.[1] ?? null);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url || !/^https?:\/\/.+/.test(url)) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  const cached = ogCache.get(url);
  if (cached && Date.now() - cached.ts < OG_CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SocialPreviewBot/1.0)' },
      signal: AbortSignal.timeout(4000),
    });
    const html = await res.text();

    const title =
      getMeta(html, 'og:title') ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ??
      null;
    const description = getMeta(html, 'og:description') ?? getMeta(html, 'description');
    const image = getMeta(html, 'og:image');
    const siteName = getMeta(html, 'og:site_name') ?? new URL(url).hostname.replace('www.', '');

    const data = { url, title, description, image, siteName };
    ogCache.set(url, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch preview' }, { status: 500 });
  }
}
