import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/authOptions'
import { prisma } from '../../../../lib/prisma'
import { chatBus } from '../../../../lib/realtime'
import { getIO } from '../../../../lib/socketServer'
import { uploadToSupabase, supabaseObjectPath } from '../../../../lib/supabase'
import { cacheDel, CK } from '../../../../lib/cache'

// GET /api/chat/messages?conversationId=&limit=50&before=<iso>
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = session.user.email

  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversationId') || ''
  const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || '50')))
  const before = searchParams.get('before')

  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conv || (conv.participantA !== me && conv.participantB !== me)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const msgs = await prisma.chatMessage.findMany({
    where: {
      conversationId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // Return oldest-first
  return NextResponse.json(
    msgs.reverse().map((m) => ({
      _id: m.id,
      conversationId: m.conversationId,
      sender: m.sender,
      text: m.text,
      attachments: m.attachments,
      createdAt: m.createdAt.toISOString(),
    })),
  )
}

// POST — send a message or create/find a conversation
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = session.user.email

  const contentType = request.headers.get('content-type') || ''
  let to: string | undefined
  let text = ''
  let conversationId: string | undefined
  let incomingFiles: File[] = []
  let clientId: string | undefined

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}))
    to = body.to
    text = body.text || ''
    conversationId = body.conversationId
    clientId = body.clientId
  } else {
    const form = await request.formData()
    to = String(form.get('to') || '') || undefined
    text = String(form.get('text') || '')
    conversationId = String(form.get('conversationId') || '') || undefined
    clientId = String(form.get('clientId') || '') || undefined
    for (const v of [...form.getAll('file'), ...form.getAll('files')]) {
      if (v instanceof File) incomingFiles.push(v)
    }
  }

  // Resolve conversation
  let conv
  if (conversationId) {
    conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
    if (!conv || (conv.participantA !== me && conv.participantB !== me)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    if (!to) return NextResponse.json({ error: 'Recipient required' }, { status: 400 })
    if (to === me) return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })

    // Friends-only check
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { fromEmail: me, toEmail: to },
          { fromEmail: to, toEmail: me },
        ],
      },
    })
    if (!friendship) return NextResponse.json({ error: 'You can only message friends' }, { status: 403 })

    // Deterministic participant order for unique constraint
    const [pA, pB] = [me, to].sort()
    conv = await prisma.conversation.upsert({
      where: { participantA_participantB: { participantA: pA, participantB: pB } },
      update: {},
      create: { participantA: pA, participantB: pB },
    })
  }

  // If no content, just return the conversation (used to open/create a chat)
  if (!text && !incomingFiles.length) {
    const otherEmail = conv.participantA === me ? conv.participantB : conv.participantA
    const p = await prisma.profile.findUnique({ where: { email: otherEmail } })
    return NextResponse.json({
      conversationId: conv.id,
      message: null,
      other: { email: otherEmail, name: p?.name || otherEmail.split('@')[0], avatarUrl: p?.avatarUrl || null },
    })
  }

  // Upload attachments
  const uploadedUrls: string[] = []
  for (const f of incomingFiles) {
    try {
      const buf = Buffer.from(await f.arrayBuffer())
      const key = supabaseObjectPath(`chat/${conv.id}`, f.name)
      uploadedUrls.push(await uploadToSupabase(key, buf, f.type || 'application/octet-stream'))
    } catch {}
  }

  const msg = await prisma.chatMessage.create({
    data: { conversationId: conv.id, sender: me, text, attachments: uploadedUrls },
  })

  await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      lastMessageText: text || (uploadedUrls.length ? 'Attachment' : ''),
      lastMessageAt: new Date(),
    },
  })

  const payload = {
    _id: msg.id,
    conversationId: conv.id,
    sender: me,
    text: msg.text,
    attachments: msg.attachments,
    createdAt: msg.createdAt.toISOString(),
    clientId,
  }

  // Real-time: Socket.IO + SSE chatBus
  chatBus.emit(conv.id, { type: 'message', payload })
  try { getIO().to(`conversation:${conv.id}`).emit('message', payload) } catch {}

  // Inbox updates for both participants
  const otherEmail = conv.participantA === me ? conv.participantB : conv.participantA
  const profiles = await prisma.profile.findMany({ where: { email: { in: [me, otherEmail] } } })
  const profileMap = new Map(profiles.map((p) => [p.email, p]))

  for (const participant of [me, otherEmail]) {
    const other = participant === me ? otherEmail : me
    const p = profileMap.get(other)
    const convUpdate = {
      id: conv.id,
      otherEmail: other,
      otherName: p?.name || other.split('@')[0],
      otherAvatarUrl: p?.avatarUrl || null,
      lastMessageText: payload.text || (uploadedUrls.length ? 'Attachment' : ''),
      lastMessageAt: new Date().toISOString(),
    }
    chatBus.emit(`inbox:${participant}`, { type: 'conv-updated', payload: convUpdate })
    try { getIO().to(`inbox:${participant}`).emit('conv-updated', convUpdate) } catch {}
  }

  // Invalidate conversation list cache for both participants
  await cacheDel(CK.conversations(me), CK.conversations(otherEmail))

  const otherProfile = profileMap.get(otherEmail)
  return NextResponse.json({
    conversationId: conv.id,
    message: payload,
    other: { email: otherEmail, name: otherProfile?.name || otherEmail.split('@')[0], avatarUrl: otherProfile?.avatarUrl || null },
  })
}
