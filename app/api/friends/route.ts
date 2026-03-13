import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/authOptions'
import { prisma } from '../../../lib/prisma'
import { cacheGet, cacheSet, cacheDel, CK, TTL } from '../../../lib/cache'

// GET  — list accepted friends with their profile info
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = session.user.email

  const cached = await cacheGet(CK.friends(me))
  if (cached) return NextResponse.json(cached)

  const rows = await prisma.friendship.findMany({
    where: { status: 'accepted', OR: [{ fromEmail: me }, { toEmail: me }] },
  })

  const friendEmails = rows.map((r) => (r.fromEmail === me ? r.toEmail : r.fromEmail))
  const profiles = friendEmails.length
    ? await prisma.profile.findMany({ where: { email: { in: friendEmails } } })
    : []

  const profileMap = new Map(profiles.map((p) => [p.email, p]))

  const data = friendEmails.map((email) => {
    const p = profileMap.get(email)
    return { email, name: p?.name || email.split('@')[0], avatarUrl: p?.avatarUrl || null, bio: p?.bio || null, location: p?.location || null }
  })
  await cacheSet(CK.friends(me), data, TTL.FRIENDS)
  return NextResponse.json(data)
}

// POST { toEmail } — send friend request
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = session.user.email

  const { toEmail } = await req.json().catch(() => ({}))
  if (!toEmail || toEmail === me) return NextResponse.json({ error: 'Invalid target' }, { status: 400 })

  // If they already sent us a request, auto-accept it
  const reverse = await prisma.friendship.findUnique({ where: { fromEmail_toEmail: { fromEmail: toEmail, toEmail: me } } })
  if (reverse) {
    const accepted = await prisma.friendship.update({
      where: { id: reverse.id },
      data: { status: 'accepted', updatedAt: new Date() },
    })
    return NextResponse.json(accepted)
  }

  const row = await prisma.friendship.upsert({
    where: { fromEmail_toEmail: { fromEmail: me, toEmail } },
    update: {},
    create: { fromEmail: me, toEmail, status: 'pending' },
  })
  await cacheDel(CK.friends(me), CK.friends(toEmail))
  return NextResponse.json(row)
}

// PUT { fromEmail } — accept incoming request
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = session.user.email

  const { fromEmail } = await req.json().catch(() => ({}))
  if (!fromEmail) return NextResponse.json({ error: 'fromEmail required' }, { status: 400 })

  const row = await prisma.friendship.updateMany({
    where: { fromEmail, toEmail: me, status: 'pending' },
    data: { status: 'accepted', updatedAt: new Date() },
  })
  await cacheDel(CK.friends(me), CK.friends(fromEmail))
  return NextResponse.json({ updated: row.count })
}

// DELETE ?email=xxx — remove friend or decline request
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = session.user.email

  const { searchParams } = new URL(req.url)
  const other = searchParams.get('email')
  if (!other) return NextResponse.json({ error: 'email required' }, { status: 400 })

  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { fromEmail: me, toEmail: other },
        { fromEmail: other, toEmail: me },
      ],
    },
  })
  await cacheDel(CK.friends(me), CK.friends(other))
  return NextResponse.json({ ok: true })
}
