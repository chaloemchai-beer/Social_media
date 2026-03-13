import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/authOptions'
import { prisma } from '../../../../lib/prisma'
import { cacheGet, cacheSet, CK, TTL } from '../../../../lib/cache'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = session.user.email

  const cached = await cacheGet(CK.conversations(me))
  if (cached) return NextResponse.json(cached)

  const convs = await prisma.conversation.findMany({
    where: { OR: [{ participantA: me }, { participantB: me }] },
    orderBy: { lastMessageAt: 'desc' },
  })

  const otherEmails = convs.map((c) => (c.participantA === me ? c.participantB : c.participantA))
  const profiles = otherEmails.length
    ? await prisma.profile.findMany({ where: { email: { in: otherEmails } } })
    : []
  const profileMap = new Map(profiles.map((p) => [p.email, p]))

  const data = convs.map((c) => {
    const otherEmail = c.participantA === me ? c.participantB : c.participantA
    const p = profileMap.get(otherEmail)
    return {
      id: c.id,
      otherEmail,
      otherName: p?.name || otherEmail.split('@')[0],
      otherAvatarUrl: p?.avatarUrl || null,
      lastMessageText: c.lastMessageText,
      lastMessageAt: c.lastMessageAt,
    }
  })

  await cacheSet(CK.conversations(me), data, TTL.CONVERSATIONS)
  return NextResponse.json(data)
}
