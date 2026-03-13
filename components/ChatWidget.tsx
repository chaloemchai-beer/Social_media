'use client'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
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
  _local?: boolean
}

type Friend = { email: string; name: string; avatarUrl: string | null }

function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  if (src) return (
    <div className="rounded-full overflow-hidden flex-shrink-0" style={{ width: size, height: size }}>
      <Image src={src} alt={name} width={size} height={size} unoptimized className="w-full h-full object-cover" />
    </div>
  )
  return (
    <div className="rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white font-semibold flex-shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function formatTime(iso?: string) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

function formatRelative(iso?: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h`
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch { return '' }
}

function formatDay(iso?: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return 'Today'
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
  } catch { return '' }
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
  const [showFriendPicker, setShowFriendPicker] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendSearch, setFriendSearch] = useState('')
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const myEmail = session?.user?.email || ''

  // External open events
  useEffect(() => {
    const handler = () => setOpen(true)
    const handlerWithEmail = async (e: Event) => {
      const email = (e as CustomEvent<{ email: string }>).detail?.email
      if (!email) return
      setOpen(true)
      const res = await fetch('/api/friends').catch(() => null)
      const list: Friend[] = res?.ok ? await res.json() : []
      setFriends(list)
      const friend = list.find((f) => f.email === email)
      if (friend) openChatWithFriend(friend)
    }
    window.addEventListener('open-chat-widget', handler)
    window.addEventListener('open-chat-with', handlerWithEmail as EventListener)
    return () => {
      window.removeEventListener('open-chat-widget', handler)
      window.removeEventListener('open-chat-with', handlerWithEmail as EventListener)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Socket.IO
  useEffect(() => {
    if (socketRef.current) return
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || ''
    const s = io(url || undefined, { transports: ['websocket'], withCredentials: true })
    socketRef.current = s
    return () => { s.close() }
  }, [])

  useEffect(() => {
    const s = socketRef.current
    if (!s || !myEmail) return
    s.emit('identify', { email: myEmail })
    const onConvUpdated = (payload: Conversation) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.id)
        if (idx !== -1) {
          const copy = [...prev]
          copy[idx] = { ...copy[idx], ...payload }
          const [item] = copy.splice(idx, 1)
          return [item, ...copy]
        }
        return [payload, ...prev]
      })
    }
    s.on('conv-updated', onConvUpdated)
    return () => { s.off('conv-updated', onConvUpdated) }
  }, [myEmail])

  // Load on open
  useEffect(() => {
    if (!open) return
    fetch('/api/chat/conversations').then(r => r.ok ? r.json() : []).then(setConversations).catch(() => {})
    fetch('/api/friends').then(r => r.ok ? r.json() : []).then(setFriends).catch(() => {})
  }, [open])

  // Load messages + join room
  useEffect(() => {
    if (!selected || !open) return
    setView('thread')
    setHasMore(true)
    fetch(`/api/chat/messages?conversationId=${selected.id}&limit=50`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setMessages(data)
        if (data.length < 50) setHasMore(false)
        setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 30)
      }).catch(() => {})

    const s = socketRef.current
    if (s) s.emit('join-conversation', { id: selected.id })

    const onMsg = (m: Message) => {
      setMessages(prev => {
        const localIdx = m.clientId ? prev.findIndex(x => (x as any)._local && x._id === m.clientId) : -1
        if (localIdx !== -1) { const c = [...prev]; c[localIdx] = m; return c }
        return prev.find(x => x._id === m._id) ? prev : [...prev, m]
      })
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current!.scrollHeight, behavior: 'smooth' }), 50)
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === selected.id)
        if (idx === -1) return prev
        const copy = [...prev]
        copy[idx] = { ...copy[idx], lastMessageText: m.text || 'Attachment', lastMessageAt: new Date().toISOString() }
        const [item] = copy.splice(idx, 1)
        return [item, ...copy]
      })
    }
    if (s) s.on('message', onMsg)
    return () => { if (s) { s.off('message', onMsg); s.emit('leave-conversation', { id: selected.id }) } }
  }, [selected, open])

  const loadOlder = async () => {
    if (!selected || loadingOlder || !hasMore || messages.length === 0) return
    setLoadingOlder(true)
    const first = messages[0]
    const container = listRef.current
    const prevH = container?.scrollHeight || 0
    try {
      const url = new URL('/api/chat/messages', window.location.origin)
      url.searchParams.set('conversationId', selected.id)
      url.searchParams.set('limit', '50')
      url.searchParams.set('before', first.createdAt)
      const res = await fetch(url.toString())
      if (res.ok) {
        const older = await res.json() as Message[]
        if (older.length > 0) {
          setMessages(prev => [...older, ...prev])
          setTimeout(() => { if (container) container.scrollTop = (container.scrollHeight - prevH) + container.scrollTop }, 10)
        }
        if (older.length < 50) setHasMore(false)
      }
    } finally { setLoadingOlder(false) }
  }

  const openChatWithFriend = async (friend: Friend) => {
    setShowFriendPicker(false)
    setFriendSearch('')
    const existing = conversations.find(c => c.otherEmail === friend.email)
    if (existing) { setSelected(existing); setView('thread'); return }
    const res = await fetch('/api/chat/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: friend.email, text: '' }),
    }).catch(() => null)
    if (res?.ok) {
      const data = await res.json()
      const conv: Conversation = { id: data.conversationId, otherEmail: friend.email, otherName: friend.name, otherAvatarUrl: friend.avatarUrl, lastMessageText: '', lastMessageAt: new Date().toISOString() }
      setConversations(prev => prev.find(c => c.id === conv.id) ? prev : [conv, ...prev])
      setSelected(conv)
      setView('thread')
    }
  }

  const send = async () => {
    if (!selected || sending) return
    const text = input.trim()
    if (!text && pendingFiles.length === 0) return
    setSending(true)
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const tempUrls = pendingFiles.map(f => URL.createObjectURL(f))
    const optimistic: Message = { _id: localId, conversationId: selected.id, sender: myEmail, text, attachments: tempUrls, createdAt: new Date().toISOString(), _local: true }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current!.scrollHeight, behavior: 'smooth' }), 10)
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === selected.id)
      if (idx === -1) return prev
      const copy = [...prev]; copy[idx] = { ...copy[idx], lastMessageText: text || 'Attachment', lastMessageAt: new Date().toISOString() }
      const [item] = copy.splice(idx, 1); return [item, ...copy]
    })
    setInput('')
    const files = [...pendingFiles]; setPendingFiles([])
    let res: Response
    try {
      if (files.length > 0) {
        const fd = new FormData()
        fd.set('conversationId', selected.id); if (text) fd.set('text', text); fd.set('clientId', localId)
        files.forEach(f => fd.append('file', f))
        res = await fetch('/api/chat/messages', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/chat/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: selected.id, text, clientId: localId }) })
      }
    } catch { res = new Response(null, { status: 500 }) as any }

    if (res.ok) {
      try {
        const data = await res.json()
        const serverMsg = data?.message as Message | undefined
        if (serverMsg) {
          setMessages(prev => {
            if (prev.find(m => m._id === serverMsg._id)) return prev.filter(m => m._id !== localId)
            const idx = prev.findIndex(m => m._id === localId)
            if (idx !== -1) { const c = [...prev]; c[idx] = serverMsg; return c }
            return [...prev, serverMsg]
          })
        }
      } catch { setMessages(prev => prev.filter(m => m._id !== localId)) }
    } else {
      setMessages(prev => prev.filter(m => m._id !== localId))
      setInput(text)
    }
    tempUrls.forEach(u => URL.revokeObjectURL(u))
    setSending(false)
    inputRef.current?.focus()
  }

  const filteredFriends = friends.filter(f =>
    !friendSearch || f.name.toLowerCase().includes(friendSearch.toLowerCase()) || f.email.toLowerCase().includes(friendSearch.toLowerCase())
  )

  if (!session) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* ── Widget panel ── */}
      {open && (
        <div className="w-[360px] max-w-[calc(100vw-2rem)] h-[580px] bg-gray-900 border border-gray-800/60 rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden">

          {/* List view */}
          {view === 'list' && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
                <h2 className="text-white font-semibold text-base">Messages</h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setShowFriendPicker(v => !v); setFriendSearch('') }}
                    title="New message"
                    className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
              </div>

              {/* Friend picker */}
              {showFriendPicker && (
                <div className="border-b border-gray-800/60 bg-gray-900/80">
                  <div className="px-3 pt-3 pb-2">
                    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700/60 rounded-xl px-3 py-2 focus-within:ring-1 focus-within:ring-violet-500/40">
                      <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input autoFocus className="bg-transparent outline-none text-white placeholder-gray-500 text-sm w-full" placeholder="Search friends…"
                        value={friendSearch} onChange={e => setFriendSearch(e.target.value)} />
                    </div>
                  </div>
                  <div className="max-h-44 overflow-y-auto pb-1">
                    {filteredFriends.map(f => (
                      <button key={f.email} onClick={() => openChatWithFriend(f)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/60 transition-colors text-left">
                        <Avatar name={f.name} src={f.avatarUrl} size={32} />
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{f.name}</p>
                          <p className="text-gray-500 text-xs truncate">{f.email}</p>
                        </div>
                      </button>
                    ))}
                    {filteredFriends.length === 0 && (
                      <p className="px-4 py-3 text-sm text-gray-500">{friends.length === 0 ? 'Add friends to start chatting.' : 'No friends match.'}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Conversation list */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                    <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center">
                      <svg className="w-7 h-7 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
                    </div>
                    <p className="text-white font-medium text-sm">No conversations yet</p>
                    <p className="text-gray-500 text-xs">Click the edit icon above to message a friend.</p>
                  </div>
                ) : (
                  conversations.map(c => (
                    <button key={c.id} onClick={() => { setSelected(c); setView('thread') }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/60 transition-colors text-left group ${selected?.id === c.id ? 'bg-gray-800/40' : ''}`}>
                      <Avatar name={c.otherName} src={c.otherAvatarUrl} size={44} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-white text-sm font-medium truncate">{c.otherName}</span>
                          <span className="text-gray-500 text-[10px] flex-shrink-0">{formatRelative(c.lastMessageAt)}</span>
                        </div>
                        <p className="text-gray-400 text-xs truncate mt-0.5">{c.lastMessageText || 'Start the conversation…'}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {/* Thread view */}
          {view === 'thread' && selected && (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 px-3 py-3 border-b border-gray-800/60">
                <button onClick={() => setView('list')} className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-all flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <Avatar name={selected.otherName} src={selected.otherAvatarUrl} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{selected.otherName}</p>
                </div>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-all flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>

              {/* Messages */}
              <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-1"
                onScroll={e => { if (e.currentTarget.scrollTop <= 40) loadOlder() }}>
                {loadingOlder && (
                  <div className="flex justify-center py-2">
                    <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {messages.map((m, idx) => {
                  const mine = m.sender === myEmail
                  const prev = idx > 0 ? messages[idx - 1] : undefined
                  const next = idx < messages.length - 1 ? messages[idx + 1] : undefined
                  const showDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString()
                  const isFirst = !prev || prev.sender !== m.sender || showDay
                  const isLast = !next || next.sender !== m.sender || new Date(next.createdAt).toDateString() !== new Date(m.createdAt).toDateString()

                  return (
                    <div key={m._id}>
                      {showDay && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-gray-800" />
                          <span className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">{formatDay(m.createdAt)}</span>
                          <div className="flex-1 h-px bg-gray-800" />
                        </div>
                      )}
                      <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'} ${isFirst ? 'mt-3' : 'mt-0.5'}`}>
                        {/* Avatar — only show for last in a group from other */}
                        {!mine && (
                          <div className="w-6 flex-shrink-0">
                            {isLast && <Avatar name={selected.otherName} src={selected.otherAvatarUrl} size={24} />}
                          </div>
                        )}
                        <div className={`flex flex-col gap-0.5 max-w-[72%] ${mine ? 'items-end' : 'items-start'}`}>
                          <div className={`px-3 py-2 text-sm leading-relaxed break-words
                            ${mine
                              ? `bg-violet-600 text-white ${isFirst ? 'rounded-t-2xl' : 'rounded-t-lg'} rounded-bl-2xl ${isLast ? 'rounded-br-lg' : 'rounded-br-2xl'}`
                              : `bg-gray-800 text-gray-100 ${isFirst ? 'rounded-t-2xl' : 'rounded-t-lg'} rounded-br-2xl ${isLast ? 'rounded-bl-lg' : 'rounded-bl-2xl'}`
                            }
                            ${(m as any)._local ? 'opacity-70' : ''}
                          `}>
                            {m.text && <p>{m.text}</p>}
                            {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                              <div className={`mt-1.5 grid gap-1 ${m.attachments.length > 1 ? 'grid-cols-2' : ''}`}>
                                {m.attachments.map((url, i) => {
                                  const lower = url.toLowerCase()
                                  const isImg = /(\.png|\.jpg|\.jpeg|\.webp|\.gif|blob:)/.test(lower)
                                  const isVid = /(\.mp4|\.webm|\.mov|\.m4v)/.test(lower)
                                  return (
                                    <div key={i} className="rounded-lg overflow-hidden">
                                      {isImg ? (
                                        <Image src={url} alt="attachment" width={240} height={240} unoptimized className="w-full h-auto max-h-48 object-cover" />
                                      ) : isVid ? (
                                        <video src={url} controls className="w-full max-h-48 rounded-lg" />
                                      ) : (
                                        <a href={url} target="_blank" rel="noreferrer" className="text-violet-300 underline text-xs break-all">{url}</a>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          {isLast && (
                            <span className="text-gray-600 text-[10px] px-1">{formatTime(m.createdAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Input area */}
              <div className="border-t border-gray-800/60 bg-gray-900 px-3 py-3 flex flex-col gap-2">
                {/* File previews */}
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingFiles.map((f, idx) => {
                      const url = URL.createObjectURL(f)
                      const isImg = f.type.startsWith('image/')
                      return (
                        <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-800 border border-gray-700/60">
                          <button onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute top-0.5 right-0.5 z-10 w-5 h-5 bg-gray-900/80 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                          {isImg
                            ? <Image src={url} alt={f.name} width={64} height={64} unoptimized className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-gray-400"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg></div>
                          }
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button onClick={() => fileRef.current?.click()}
                    className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-all flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
                    onChange={e => { const files = Array.from(e.target.files || []); if (files.length) setPendingFiles(p => [...p, ...files]); if (fileRef.current) fileRef.current.value = '' }} />
                  <input
                    ref={inputRef}
                    className="flex-1 bg-gray-800 border border-gray-700/60 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 outline-none transition-all"
                    placeholder="Message…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  />
                  <button onClick={send} disabled={sending || (!input.trim() && pendingFiles.length === 0)}
                    className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-violet-600/20">
                    {sending
                      ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                    }
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Floating button ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-14 h-14 rounded-full bg-violet-600 hover:bg-violet-500 active:scale-95 text-white shadow-2xl shadow-violet-600/30 flex items-center justify-center transition-all"
        aria-label="Open chat"
      >
        {open
          ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
        }
      </button>
    </div>
  )
}
