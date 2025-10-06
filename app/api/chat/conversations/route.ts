import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/authOptions'
import { connectToMongoDB } from '../../../../lib/mongo'
import Conversation from '../../../../models/Conversation'
import Profile from '../../../../models/Profile'

export async function GET() {
  await connectToMongoDB()
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = session.user.email
  const conversations = await Conversation.find({ participants: email })
    .sort({ lastMessageAt: -1 })
    .lean()

  const others = Array.from(
    new Set(
      conversations
        .map((c: any) => (c.participants || []).find((p: string) => p !== email))
        .filter(Boolean)
    )
  ) as string[]

  const profiles = others.length ? await Profile.find({ email: { $in: others } }).lean() : []
  const nameMap = new Map(profiles.map((p: any) => [p.email, p.name]))
  const avatarMap = new Map(profiles.map((p: any) => [p.email, p.avatarUrl]))

  const shaped = conversations.map((c: any) => {
    const otherEmail = (c.participants || []).find((p: string) => p !== email)
    return {
      id: String(c._id),
      otherEmail,
      otherName: nameMap.get(otherEmail) || otherEmail?.split('@')[0] || 'Unknown',
      otherAvatarUrl: avatarMap.get(otherEmail) || null,
      lastMessageText: c.lastMessageText || '',
      lastMessageAt: c.lastMessageAt,
    }
  })

  return NextResponse.json(shaped)
}

