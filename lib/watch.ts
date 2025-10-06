import { connectToMongoDB } from './mongo'
import Message from '../models/Message'
import Conversation from '../models/Conversation'
import Profile from '../models/Profile'
import mongoose from 'mongoose'
import { chatBus } from './realtime'
import { getIO } from './socketServer'

type AnyDoc = Record<string, any>

async function emitConvUpdated(convId: string, text: string, attachments: string[]) {
  try {
    const conv: AnyDoc | null = await Conversation.findById(convId).lean()
    if (!conv) return
    const participants: string[] = (conv.participants || []) as string[]
    const profiles = participants.length ? await Profile.find({ email: { $in: participants } }).lean() : []
    const nameMap = new Map(profiles.map((p: AnyDoc) => [p.email, p.name]))
    const avatarMap = new Map(profiles.map((p: AnyDoc) => [p.email, p.avatarUrl]))
    for (const p of participants) {
      const otherEmail = participants.find((e) => e !== p) || ''
      const evt = {
        type: 'conv-updated',
        payload: {
          id: String(convId),
          otherEmail,
          otherName: nameMap.get(otherEmail) || otherEmail.split('@')[0] || 'Unknown',
          otherAvatarUrl: avatarMap.get(otherEmail) || null,
          lastMessageText: text || (attachments.length ? 'Attachment' : ''),
          lastMessageAt: new Date().toISOString(),
        },
      }
      chatBus.emit(`inbox:${p}`, evt)
    }
  } catch {}
}

async function startWatcherInternal() {
  await connectToMongoDB()
  if (!mongoose.connection.db) return
  try {
    const changeStream = Message.watch([], { fullDocument: 'updateLookup' as any })
    changeStream.on('change', async (change: any) => {
      try {
        if (change.operationType !== 'insert') return
        const doc: AnyDoc = change.fullDocument || {}
        const convId = String(doc.conversationId)
        const payload = {
          _id: String(doc._id),
          conversationId: convId,
          sender: doc.sender,
          text: doc.text || '',
          attachments: Array.isArray(doc.attachments) ? doc.attachments : [],
          createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
        }
        // SSE/EventEmitter
        chatBus.emit(String(convId), { type: 'message', payload })
        // Socket.io
        try { getIO().to(`conversation:${convId}`).emit('message', payload) } catch {}
        await emitConvUpdated(convId, payload.text, payload.attachments)
      } catch {}
    })
  } catch {}
}

export async function ensureMessageWatcher() {
  const g = global as any
  if (g.__messageWatcherStarted) return
  g.__messageWatcherStarted = true
  startWatcherInternal().catch(() => {})
}
