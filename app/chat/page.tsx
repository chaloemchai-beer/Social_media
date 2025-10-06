'use client'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { io, Socket } from 'socket.io-client'

type Conversation = {
  id: string
  otherEmail: string
  otherName: string
  otherAvatarUrl: string | null
  lastMessageText: string
  lastMessageAt: string
}

type Message = {
  _id: string
  conversationId: string
  sender: string
  text: string
  attachments?: string[]
  createdAt: string
  clientId?: string
}

export default function ChatPage() {
  const { data: session } = useSession()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [startEmail, setStartEmail] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const myEmail = session?.user?.email || ''
  const formatTime = (iso?: string) => {
    if (!iso) return ''
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
  }
  const formatDay = (iso?: string) => {
    if (!iso) return ''
    try { return new Date(iso).toLocaleDateString('th-TH', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) } catch { return '' }
  }

  useEffect(() => {
    fetch('/api/chat/conversations')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setConversations(data))
      .catch(() => {})
  }, [])

  // Connect socket once
  useEffect(() => {
    if (socketRef.current) return
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || ''
    const s = io(url || undefined, { transports: ['websocket'], withCredentials: true })
    socketRef.current = s
    return () => { s.close() }
  }, [])

  useEffect(() => {
    if (!selected) return
    setHasMore(true)
    fetch(`/api/chat/messages?conversationId=${selected.id}&limit=50`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setMessages(data)
        if (Array.isArray(data) && data.length < 50) setHasMore(false)
      })
      .catch(() => {})

    const s = socketRef.current
    if (s) s.emit('join-conversation', { id: selected.id })
    const onMsg = (m: any) => {
      const msg = m as Message
      setMessages((prev) => {
        const localIdx = msg.clientId ? prev.findIndex((x: any) => (x as any)._local && x._id === msg.clientId) : -1
        if (localIdx !== -1) {
          const copy = [...prev]
          copy[localIdx] = msg
          return copy
        }
        return prev.find((x) => x._id === msg._id) ? prev : [...prev, msg]
      })
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current!.scrollHeight, behavior: 'smooth' }), 50)
    }
    if (s) s.on('message', onMsg)
    return () => { if (s) { s.off('message', onMsg); s.emit('leave-conversation', { id: selected.id }) } }
  }, [selected])

  useEffect(() => {
    // scroll to bottom on load
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 50)
  }, [messages.length])

  const loadOlder = async () => {
    if (!selected || loadingOlder || !hasMore || messages.length === 0) return
    setLoadingOlder(true)
    const first = messages[0]
    const container = listRef.current
    const prevScrollHeight = container?.scrollHeight || 0
    try {
      const url = new URL('/api/chat/messages', window.location.origin)
      url.searchParams.set('conversationId', selected.id)
      url.searchParams.set('limit', '50')
      url.searchParams.set('before', first.createdAt)
      const res = await fetch(url.toString())
      if (res.ok) {
        const older = (await res.json()) as Message[]
        if (older.length > 0) {
          setMessages((prev) => [...older, ...prev])
          setTimeout(() => {
            const newH = container?.scrollHeight || 0
            const delta = newH - prevScrollHeight
            if (container) container.scrollTop = delta + (container.scrollTop || 0)
          }, 10)
        }
        if (older.length < 50) setHasMore(false)
      }
    } finally {
      setLoadingOlder(false)
    }
  }

  const startNewChat = async () => {
    const to = startEmail.trim()
    if (!to || !to.includes('@')) return
    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, text: 'สวัสดี' }),
    })
    if (res.ok) {
      const data = await res.json()
      const conv: Conversation = {
        id: data.conversationId,
        otherEmail: data.other?.email || to,
        otherName: data.other?.name || to.split('@')[0],
        otherAvatarUrl: data.other?.avatarUrl || null,
        lastMessageText: 'สวัสดี',
        lastMessageAt: new Date().toISOString(),
      }
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === conv.id)
        return exists ? prev : [conv, ...prev]
      })
      setSelected(conv)
      setStartEmail('')
    }
  }

  const send = async () => {
    if (!selected) return
    const text = input.trim()
    if (!text && pendingFiles.length === 0) return

    // Optimistic add
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const tempUrls = pendingFiles.map((f) => URL.createObjectURL(f))
    const optimistic: any = {
      _id: localId,
      conversationId: selected.id,
      sender: myEmail,
      text,
      attachments: tempUrls,
      createdAt: new Date().toISOString(),
      _local: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current!.scrollHeight, behavior: 'smooth' }), 10)

    // Clear input
    setInput('')

    let res: Response
    try {
      if (pendingFiles.length) {
        const fd = new FormData()
        fd.set('conversationId', selected.id)
        if (text) fd.set('text', text)
        fd.set('clientId', localId)
        for (const f of pendingFiles) fd.append('file', f)
        setPendingFiles([])
        res = await fetch('/api/chat/messages', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: selected.id, text, clientId: localId }),
        })
      }
    } catch {
      res = new Response(null, { status: 500 }) as any
    }
    if (res.ok) {
      try {
        const data = await res.json()
        const serverMsg = data?.message as Message | undefined
        if (serverMsg) {
          setMessages((prev) => {
            const idxServer = prev.findIndex((m) => m._id === serverMsg._id)
            const idxLocal = prev.findIndex((m) => m._id === localId)
            if (idxServer !== -1) {
              return prev.filter((m) => m._id !== localId)
            } else if (idxLocal !== -1) {
              const copy = [...prev]
              copy[idxLocal] = serverMsg
              return copy
            } else {
              return [...prev, serverMsg]
            }
          })
        }
      } catch {
        setMessages((prev) => prev.filter((m) => m._id !== localId))
      }
    } else {
      setMessages((prev) => prev.filter((m) => m._id !== localId))
      setInput(text)
      alert('ส่งข้อความไม่สำเร็จ')
    }
    tempUrls.forEach((u) => URL.revokeObjectURL(u))
  }

  const Header = useMemo(() => (
    <div className="flex items-center gap-3 p-4 border-b bg-white">
      <div className="text-xl font-semibold">แชท</div>
    </div>
  ), [])

  if (!session) {
    return (
      <div className="p-6 text-center">
        <div className="text-lg">กรุณาเข้าสู่ระบบเพื่อใช้งานแชท</div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-0px)] flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-80 border-r bg-white flex flex-col min-h-0 overflow-hidden">
        {Header}
        <div className="p-3">
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="เริ่มคุยกับอีเมล (เช่น user@example.com)"
            value={startEmail}
            onChange={(e) => setStartEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startNewChat()}
          />
          <button className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white rounded py-2 text-sm" onClick={startNewChat}>
            เริ่มแชท
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={`w-full text-left flex items-center gap-3 p-3 hover:bg-gray-50 ${
                selected?.id === c.id ? 'bg-gray-100' : ''
              }`}
            >
              <Image
                src={c.otherAvatarUrl || '/default-avatar.svg'}
                alt={c.otherName}
                width={40}
                height={40}
                unoptimized
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="min-w-0">
                <div className="font-medium truncate">{c.otherName}</div>
                <div className="text-xs text-gray-500 truncate">{c.lastMessageText}</div>
              </div>
            </button>
          ))}
          {!conversations.length && (
            <div className="p-4 text-sm text-gray-500">ยังไม่มีการสนทนา</div>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 border-b bg-white flex items-center gap-3">
          {selected ? (
            <>
              <Image
                src={selected.otherAvatarUrl || '/default-avatar.svg'}
                alt={selected.otherName}
                width={32}
                height={32}
                unoptimized
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="font-medium">{selected.otherName}</div>
            </>
          ) : (
            <div className="text-gray-500">เลือกการสนทนาจากด้านซ้าย</div>
          )}
        </div>
        <div
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-2 bg-gray-50"
          onScroll={(e) => {
            const el = e.currentTarget
            if (el.scrollTop <= 24) loadOlder()
          }}
        >
          {selected ? (
            messages.map((m, idx) => {
              const mine = m.sender === myEmail
              const prev = idx > 0 ? messages[idx - 1] : undefined
              const showDay = !prev || (new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString())
              return (
                <div key={m._id}>
                  {showDay && (
                    <div className="text-xs text-gray-500 text-center my-2 select-none">{formatDay(m.createdAt)}</div>
                  )}
                  <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div title={formatDay(m.createdAt) + ' ' + formatTime(m.createdAt)} className={`max-w-[70%] rounded px-3 py-2 text-sm ${mine ? 'bg-blue-600 text-white' : 'bg-white border'}`}>
                      {m.text}
                      {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                        <div className={`mt-2 grid gap-2 ${m.attachments.length > 1 ? 'grid-cols-2' : ''}`}>
                          {m.attachments.map((url, i) => {
                            const lower = url.toLowerCase()
                            const isImage = /(\.png|\.jpg|\.jpeg|\.webp|\.gif)$/.test(lower)
                            const isVideo = /(\.mp4|\.webm|\.mov|\.m4v)$/.test(lower)
                            return (
                              <div key={i} className="overflow-hidden rounded border bg-black/5">
                                {isImage ? (
                                  <Image src={url} alt="attachment" width={320} height={320} unoptimized className="w-full h-auto max-h-60 object-cover" />
                                ) : isVideo ? (
                                  <video src={url} controls className="w-full max-h-60" />
                                ) : (
                                  <a href={url} target="_blank" rel="noreferrer" className="underline break-words text-xs">{url}</a>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <div className={`mt-1 text-[10px] ${mine ? 'text-white/80' : 'text-gray-500'}`}>{formatTime(m.createdAt)}</div>
                    </div>
                  </div>
                </div>
              )
            })
          ) : null}
        </div>
        
        <div className="p-3 border-t bg-white flex items-center gap-2">
          <input
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder={selected ? 'พิมพ์ข้อความ...' : 'เลือกการสนทนาก่อน'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            disabled={!selected}
          />
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => {
            const files = Array.from(e.target.files || [])
            if (files.length) setPendingFiles((prev) => [...prev, ...files])
            if (fileRef.current) fileRef.current.value = ''
          }} />
          <button onClick={() => fileRef.current?.click()} className="border rounded px-3 py-2 text-sm" disabled={!selected}>แนบ</button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 text-sm" onClick={send} disabled={!selected}>
            ส่ง
          </button>
        </div>
      </div>
    </div>
  )
  }
