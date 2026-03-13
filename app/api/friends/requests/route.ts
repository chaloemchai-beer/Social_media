import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/authOptions'
import { prisma } from '../../../../lib/prisma'

// GET — incoming pending friend requests
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = session.user.email

  const rows = await prisma.friendship.findMany({
    where: { toEmail: me, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  })

  const senderEmails = rows.map((r) => r.fromEmail)
  const profiles = senderEmails.length
    ? await prisma.profile.findMany({ where: { email: { in: senderEmails } } })
    : []

  const profileMap = new Map(profiles.map((p) => [p.email, p]))

  return NextResponse.json(
    rows.map((r) => {
      const p = profileMap.get(r.fromEmail)
      return {
        email: r.fromEmail,
        name: p?.name || r.fromEmail.split('@')[0],
        avatarUrl: p?.avatarUrl || null,
        bio: p?.bio || null,
        createdAt: r.createdAt,
      }
    }),
  )
}
