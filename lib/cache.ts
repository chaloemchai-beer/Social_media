/**
 * Thin Redis cache helpers (Upstash REST).
 * All methods fail silently — a cache miss or Redis outage never breaks a request.
 */
import redis from './redisClient'

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get<T>(key)
    return data ?? null
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch {}
}

export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length) await redis.del(...keys)
  } catch {}
}

/** Delete all keys matching a glob pattern (e.g. "posts:*") */
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    let cursor: string | number = 0
    const toDelete: string[] = []
    do {
      const [nextCursor, keys] = await redis.scan(cursor as number, { match: pattern, count: 100 })
      cursor = nextCursor
      toDelete.push(...(keys as string[]))
    } while (cursor !== 0 && cursor !== '0')
    if (toDelete.length) await redis.del(...toDelete)
  } catch {}
}

// ── TTLs ─────────────────────────────────────────────────────────────
export const TTL = {
  PROFILE:       5 * 60,   // 5 min  — changes rarely
  FRIENDS:       2 * 60,   // 2 min  — changes on add/remove
  CONVERSATIONS: 30,       // 30 s   — updated on every message
  POSTS:         30,       // 30 s   — new posts invalidate anyway
  USERS:         60,       // 1 min  — discovery list
} as const

// ── Key builders ─────────────────────────────────────────────────────
export const CK = {
  profile:       (email: string) => `profile:${email}`,
  friends:       (email: string) => `friends:${email}`,
  conversations: (email: string) => `conversations:${email}`,
  posts:         (email?: string) => email ? `posts:${email}` : 'posts:feed',
  users:         (email: string) => `users:${email}`,
}
