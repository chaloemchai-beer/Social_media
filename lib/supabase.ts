import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
// Use anon JWT for REST API (valid JWT format). Service key is kept for JS client if needed.
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string
const SUPABASE_BUCKET = (process.env.SUPABASE_BUCKET || 'media') as string

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  // Intentionally do not throw at import time; API routes can handle missing config gracefully
  // console.warn('Supabase env is not fully configured')
}

export function supabaseServer() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

export async function uploadToSupabase(path: string, data: ArrayBuffer | Buffer, contentType: string): Promise<string> {
  const supabase = supabaseServer()
  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(path, data, { contentType: contentType || 'application/octet-stream', upsert: true })
  if (error) throw error
  const { data: pub } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path)
  return pub.publicUrl
}

function sanitizeSegment(seg: string) {
  // Remove percent-encodes and any characters not allowed in object keys
  // Keep alphanumerics, dot, dash, underscore; replace others with underscore
  return seg
    .replace(/%[0-9A-Fa-f]{2}/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function supabaseObjectPath(prefix: string | string[], filename: string) {
  const parts = Array.isArray(prefix) ? prefix : prefix.split('/')
  const safeParts = parts.map((p) => sanitizeSegment(p)).filter(Boolean)
  const base = sanitizeSegment(filename.replace(/\s+/g, '_'))
  const stamp = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const dir = safeParts.join('/')
  return `${dir}/${stamp}-${rand}-${base}`
}

let bucketReady: Promise<void> | null = null
async function ensureBucketExists() {
  if (bucketReady) return bucketReady
  bucketReady = (async () => {
    const sb = supabaseServer()
    try {
      const { data: buckets, error } = await sb.storage.listBuckets()
      if (error) {
        // If list is forbidden (anon key), skip creating and rely on existing bucket
        return
      }
      const exists = (buckets || []).some((b: any) => b.name === SUPABASE_BUCKET)
      if (!exists) {
        // Requires service role key
        await sb.storage.createBucket(SUPABASE_BUCKET, { public: true })
      }
    } catch {
      // Ignore; upload will surface actionable error if bucket is truly missing
    }
  })()
  return bucketReady
}
