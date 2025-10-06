import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/authOptions'
import { connectToMongoDB } from '../../../../lib/mongo'
import Conversation from '../../../../models/Conversation'
import Message from '../../../../models/Message'
import Profile from '../../../../models/Profile'
import mongoose from 'mongoose'
import { chatBus } from '../../../../lib/realtime'
import { PrismaClient } from '@prisma/client'
import { getIO } from '../../../../lib/socketServer'
import { ensureMessageWatcher } from '../../../../lib/watch'

const io = getIO()
ensureMessageWatcher().catch(() => {})
import { uploadToSupabase, supabaseObjectPath } from '../../../../lib/supabase'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  await connectToMongoDB()
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversationId') || ''
  const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || '50')))
  const before = searchParams.get('before')

  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
  }

  const conv: any = await Conversation.findById(conversationId).lean()
  if (!conv || !(conv.participants || []).includes(session.user.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const cond: any = { conversationId }
  if (before) {
    const dt = new Date(before)
    if (!isNaN(dt.getTime())) {
      cond.createdAt = { $lt: dt }
    }
  }
  const msgs = await Message.find(cond).sort({ createdAt: -1 }).limit(limit).lean()

  return NextResponse.json(msgs.reverse())
}

export async function POST(request: Request) {
  await connectToMongoDB()
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const contentType = request.headers.get('content-type') || ''

  // Normalized input holders
  let to: string | undefined
  let text: string | undefined
  let conversationId: string | undefined
  let incomingFiles: File[] = []
  let attachmentsFromClient: string[] | undefined
  let clientId: string | undefined

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}))
    to = body.to
    text = body.text
    attachmentsFromClient = Array.isArray(body.attachments) ? body.attachments : undefined
    conversationId = body.conversationId
    clientId = typeof body.clientId === 'string' ? body.clientId : undefined
  } else if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    to = String(form.get('to') || '') || undefined
    text = String(form.get('text') || '') || undefined
    conversationId = String(form.get('conversationId') || '') || undefined
    const cid = form.get('clientId')
    clientId = typeof cid === 'string' ? cid : undefined
    // collect files from field name 'file' or 'files'
    const collected: File[] = []
    const filesA = form.getAll('file')
    const filesB = form.getAll('files')
    for (const v of [...filesA, ...filesB]) {
      if (v instanceof File) collected.push(v)
    }
    incomingFiles = collected
  }

  if (!text && !incomingFiles.length && !(attachmentsFromClient && attachmentsFromClient.length)) {
    return NextResponse.json({ error: 'Message content is empty' }, { status: 400 })
  }

  let convId: string | null = null

  if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
    const conv: any = await Conversation.findById(conversationId)
    if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    if (!conv.participants.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    convId = conv._id.toString()
  } else {
    if (!to) return NextResponse.json({ error: 'Recipient required' }, { status: 400 })
    if (to === session.user.email) return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
    // Ensure recipient exists in system (Prisma User), otherwise reject
    const user = await prisma.user.findUnique({ where: { email: to } }).catch(() => null)
    if (!user) {
      // As a fallback, allow if a Profile exists
      const prof = await Profile.findOne({ email: to }).lean()
      if (!prof) {
        return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
      }
    }
    // Find existing conversation between two participants (order-insensitive)
    const participants = [session.user.email, to].sort()
    let conv = await Conversation.findOne({ participants }).exec()
    if (!conv) {
      conv = new Conversation({ participants })
      await conv.save()
    }
    convId = conv._id.toString()
  }

  // Handle attachments: upload incoming files to Supabase under chat/{convId}
  const uploadedUrls: string[] = []
  for (const f of incomingFiles) {
    try {
      const arrayBuffer = await f.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const key = supabaseObjectPath(`chat/${convId}`, f.name)
      const url = await uploadToSupabase(key, buffer, f.type || 'application/octet-stream')
      uploadedUrls.push(url)
    } catch {}
  }
  const allAttachments = [...(attachmentsFromClient || []), ...uploadedUrls]

  const msg = new Message({
    conversationId: convId,
    sender: session.user.email,
    text: text || '',
    attachments: allAttachments,
    readBy: [session.user.email],
  })
  await msg.save()

  await Conversation.updateOne(
    { _id: convId },
    { $set: { lastMessageText: text || (allAttachments.length ? 'Attachment' : ''), lastMessageAt: new Date() } }
  )

  // Emit realtime to subscribers
  const payload = { ...msg.toObject(), _id: msg._id.toString(), clientId }
  chatBus.emit(String(convId), { type: 'message', payload })
  try { getIO().to(`conversation:${convId}`).emit('message', payload) } catch {}

  // Emit to user inbox channels for both participants so receivers update in realtime
  try {
    const convDoc: any = await Conversation.findById(convId).lean()
    const participants: string[] = (convDoc?.participants || [])
    // Preload profiles for nicer preview
    const profiles = await Profile.find({ email: { $in: participants } }).lean()
    const nameMap = new Map(profiles.map((p: any) => [p.email, p.name]))
    const avatarMap = new Map(profiles.map((p: any) => [p.email, p.avatarUrl]))
    for (const p of participants) {
      const otherEmail = participants.find((e) => e !== p) || ''
      const evt = {
        type: 'conv-updated',
        payload: {
          id: String(convId),
          otherEmail,
          otherName: nameMap.get(otherEmail) || otherEmail.split('@')[0] || 'Unknown',
          otherAvatarUrl: avatarMap.get(otherEmail) || null,
          lastMessageText: text || (allAttachments.length ? 'Attachment' : ''),
          lastMessageAt: new Date().toISOString(),
        },
      }
      chatBus.emit(`inbox:${p}`, evt)
      try { getIO().to(`inbox:${p}`).emit('conv-updated', evt.payload) } catch {}
    }
  } catch {}

  // Shape minimal conversation info for the client
  let other: any = null
  try {
    const conv: any = await Conversation.findById(convId).lean()
    const otherEmail = (conv?.participants || []).find((e: string) => e !== session.user.email)
    if (otherEmail) {
      const prof: any = await Profile.findOne({ email: otherEmail }).lean()
      other = {
        email: otherEmail,
        name: prof?.name || otherEmail.split('@')[0],
        avatarUrl: prof?.avatarUrl || null,
      }
    }
  } catch {}

  return NextResponse.json({
    conversationId: convId,
    message: payload,
    other,
  })
}
