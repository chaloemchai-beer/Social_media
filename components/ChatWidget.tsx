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

export default function ChatWidget() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'list' | 'thread'>('list')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [startEmail, setStartEmail] = useState('')
  const [showStartBox, setShowStartBox] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const myEmail = session?.user?.email || ''
  const formatTime = (iso?: string) => {
    if (!iso) return ''
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
  }
  const formatDay = (iso?: string) => {
    if (!iso) return ''
    try { return new Date(iso).toLocaleDateString('th-TH', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) } catch { return '' }
  }

  // Allow other components to open the widget
  useEffect(() => {
    const handler = () => setOpen(true)
    if (typeof window !== 'undefined') {
      window.addEventListener('open-chat-widget', handler as EventListener)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('open-chat-widget', handler as EventListener)
      }
    }
  }, [])

  // Connect Socket.IO once and identify user for inbox channel
  useEffect(() => {
    if (socketRef.current) return
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || ''
    const s = io(url || undefined, { transports: ['websocket'], withCredentials: true })
    socketRef.current = s
    return () => { s.close() }
  }, [])

  // Identify socket after session ready and subscribe inbox updates
  useEffect(() => {
    const s = socketRef.current
    if (!s || !myEmail) return
    s.emit('identify', { email: myEmail })
    const onConvUpdated = (payload: Conversation) => {
      const upd = payload
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === upd.id)
        if (idx !== -1) {
          const copy = [...prev]
          copy[idx] = { ...copy[idx], ...upd }
          const [item] = copy.splice(idx, 1)
          return [item, ...copy]
        }
        return [upd, ...prev]
      })
    }
    s.on('conv-updated', onConvUpdated)
    return () => { s.off('conv-updated', onConvUpdated) }
  }, [myEmail])

  // Load conversations when opening widget (sync to latest state kept via inbox SSE)
  useEffect(() => {
    if (!open) return
    fetch('/api/chat/conversations')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setConversations(data))
      .catch(() => {})
  }, [open])

  // Load messages when selecting a conversation and subscribe to socket room
  useEffect(() => {
    if (!selected || !open) return
    setView('thread')
    setHasMore(true)
    fetch(`/api/chat/messages?conversationId=${selected.id}&limit=50`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setMessages(data)
        if (Array.isArray(data) && data.length < 50) setHasMore(false)
      })
      .catch(() => {})

    // Join socket.io room for conversation
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
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === selected.id)
        if (idx === -1) return prev
        const copy = [...prev]
        copy[idx] = { ...copy[idx], lastMessageText: msg.text || 'Attachment', lastMessageAt: new Date().toISOString() }
        const [item] = copy.splice(idx, 1)
        return [item, ...copy]
      })
    }
    if (s) s.on('message', onMsg)
    return () => { if (s) { s.off('message', onMsg); s.emit('leave-conversation', { id: selected.id }) } }
  }, [selected, open])

  // Scroll down when messages change (only when adding at bottom)
  useEffect(() => {
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 30)
  }, [messages.length])

  // Infinite scroll older messages
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(true)
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
      setView('thread')
    } else {
      try {
        const j = await res.json()
        alert(j?.error || 'ไม่สามารถเริ่มการสนทนาได้')
      } catch {
        alert('ไม่สามารถเริ่มการสนทนาได้')
      }
    }
  }

  const send = async () => {
    if (!selected) return
    const text = input.trim()
    if (!text && pendingFiles.length === 0) return

    // Optimistic message add
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

    // Also bump conversation preview immediately
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === selected.id)
      if (idx === -1) return prev
      const copy = [...prev]
      copy[idx] = { ...copy[idx], lastMessageText: text || (pendingFiles.length ? 'Attachment' : copy[idx].lastMessageText), lastMessageAt: new Date().toISOString() }
      const [item] = copy.splice(idx, 1)
      return [item, ...copy]
    })

    // Clear inputs
    setInput('')

    const hasFiles = pendingFiles.length > 0
    let res: Response
    try {
      if (hasFiles) {
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
              // SSE already added; remove local
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
        // Remove local; rely on SSE
        setMessages((prev) => prev.filter((m) => m._id !== localId))
      }
    } else {
      // Failure: remove optimistic and restore input
      setMessages((prev) => prev.filter((m) => m._id !== localId))
      setInput(text)
      alert('ส่งข้อความไม่สำเร็จ')
    }
    // Revoke temp object URLs
    tempUrls.forEach((u) => URL.revokeObjectURL(u))
  }

  const Header = useMemo(() => (
    <div className="flex items-center justify-between p-3 border-b bg-white rounded-t-lg">
      <div className="flex items-center gap-2">
        {view === 'thread' && (
          <button onClick={() => setView('list')} className="px-2 py-1 text-sm text-blue-600">ย้อนกลับ</button>
        )}
        <div className="text-sm font-semibold">Messenger</div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setOpen(false)} className="w-7 h-7 rounded hover:bg-gray-100 grid place-items-center" aria-label="Close">✕</button>
      </div>
    </div>
  ), [view])

  if (!session) {
    // Show only the floating button if not logged in
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setOpen((x) => !x)}
          className="w-14 h-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white grid place-items-center"
          aria-label="Open chat"
        >
          💬
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-14 h-14 rounded-full shadow-xl bg-blue-600 hover:bg-blue-700 text-white grid place-items-center"
          aria-label="Open chat"
        >
          💬
        </button>
      )}
      {open && (
        <div className="w-[360px] max-w-[95vw] h-[520px] bg-white border rounded-lg shadow-2xl flex flex-col overflow-hidden">
          {Header}
          {view === 'list' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="p-3 border-b flex items-center justify-between gap-2">
                <div className="text-sm text-gray-600">การสนทนาของคุณ</div>
                <button onClick={() => setShowStartBox((v) => !v)} className="text-blue-600 text-sm">
                  {showStartBox ? 'ซ่อน' : 'เริ่มแชทใหม่'}
                </button>
              </div>
              {showStartBox && (
                <div className="p-3 border-b">
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
              )}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelected(c); setView('thread') }}
                    className="w-full text-left flex items-center gap-3 p-3 hover:bg-gray-50"
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
                      <div className="font-medium truncate text-sm">{c.otherName}</div>
                      <div className="text-xs text-gray-500 truncate">{c.lastMessageText}</div>
                    </div>
                  </button>
                ))}
                {!conversations.length && (
                  <div className="p-4 text-sm text-gray-500">ยังไม่มีการสนทนา</div>
                )}
              </div>
            </div>
          )}
          {view === 'thread' && selected && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="p-3 border-b bg-white flex items-center gap-3">
                <Image
                  src={selected.otherAvatarUrl || '/default-avatar.svg'}
                  alt={selected.otherName}
                  width={32}
                  height={32}
                  unoptimized
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div className="font-medium text-sm">{selected.otherName}</div>
              </div>
              <div
                ref={listRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-2 bg-gray-50"
                onScroll={(e) => {
                  const el = e.currentTarget
                  if (el.scrollTop <= 24) loadOlder()
                }}
              >
                {messages.map((m, idx) => {
                  const mine = m.sender === myEmail
                  const prev = idx > 0 ? messages[idx - 1] : undefined
                  const showDay = !prev || (new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString())
                  return (
                    <div key={m._id}>
                      {showDay && (
                        <div className="text-xs text-gray-500 text-center my-2 select-none">{formatDay(m.createdAt)}</div>
                      )}
                      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div title={formatDay(m.createdAt) + ' ' + formatTime(m.createdAt)} className={`max-w-[80%] rounded px-3 py-2 text-sm ${mine ? 'bg-blue-600 text-white' : 'bg-white border'}`}>
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
                })}
              </div>
              <div className="p-2 border-t bg-white flex flex-col gap-2">
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingFiles.map((f, idx) => {
                      const isImage = f.type.startsWith('image/')
                      const isVideo = f.type.startsWith('video/')
                      const url = URL.createObjectURL(f)
                      return (
                        <div key={idx} className="relative w-20 h-20 border rounded overflow-hidden">
                          <button
                            onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-2 -right-2 bg-white border rounded-full w-6 h-6 text-xs"
                            aria-label="remove"
                          >✕</button>
                          {isImage ? (
                            <Image src={url} alt={f.name} width={80} height={80} unoptimized className="w-full h-full object-cover" />
                          ) : isVideo ? (
                            <video src={url} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full grid place-items-center text-[10px] p-1 text-center break-all">{f.name}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 border rounded px-3 py-2 text-sm"
                    placeholder={'พิมพ์ข้อความ...'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                  />
                  <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    if (files.length) setPendingFiles((prev) => [...prev, ...files])
                    if (fileRef.current) fileRef.current.value = ''
                  }} />
                  <button onClick={() => fileRef.current?.click()} className="border rounded px-2 py-2 text-sm">แนบ</button>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 text-sm" onClick={send}>
                    ส่ง
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
