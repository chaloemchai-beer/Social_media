import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/authOptions'
import { prisma } from '../../../lib/prisma'
import { cacheGet, cacheSet, CK, TTL } from '../../../lib/cache'

// GET /api/users?q=search — all users except self, with friendship status
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = session.user.email

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''

  const profiles = await prisma.profile.findMany({
    where: {
      email: { not: me },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
  })

  // Fetch all my friendships in one query
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ fromEmail: me }, { toEmail: me }] },
  })

  const statusMap = new Map<string, string>()
  for (const f of friendships) {
    const other = f.fromEmail === me ? f.toEmail : f.fromEmail
    // 'sent' = I sent request, 'received' = they sent to me, 'accepted' = friends
    if (f.status === 'accepted') statusMap.set(other, 'accepted')
    else if (f.fromEmail === me) statusMap.set(other, 'sent')
    else statusMap.set(other, 'received')
  }

  return NextResponse.json(
    profiles.map((p) => ({
      email: p.email,
      name: p.name || p.email.split('@')[0],
      avatarUrl: p.avatarUrl || null,
      bio: p.bio || null,
      location: p.location || null,
      friendStatus: statusMap.get(p.email) || null,
    })),
  )
}
