import { createServer, Server as HTTPServer, IncomingMessage, ServerResponse } from 'http'
import { Server } from 'socket.io'

let ioGlobal: Server | null = null

/**
 * Attach Socket.IO to an existing HTTP server, or create a standalone one.
 *  - Production (custom server): pass in the HTTP server so Socket.IO shares the same port.
 *  - Local dev (no custom server): omit the argument and a standalone server is created on SOCKET_IO_PORT.
 */
export function getIO(existingServer?: HTTPServer): Server {
  if (ioGlobal) return ioGlobal
  const g = global as any
  if (g.__socket_io) return (ioGlobal = g.__socket_io as Server)

  const allowOrigin = process.env.SOCKET_IO_ORIGIN || '*'

  let httpServer: HTTPServer
  if (existingServer) {
    httpServer = existingServer
  } else {
    // Standalone mode — create our own HTTP server (local dev / separate service)
    httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok' }))
        return
      }
      res.writeHead(404)
      res.end()
    })
    const port = Number(process.env.SOCKET_IO_PORT || 4001)
    httpServer.listen(port, () => {
      console.log(`[socket.io] standalone listening at :${port}`)
    })
  }

  const io = new Server(httpServer, {
    cors: {
      origin: allowOrigin === '*' ? true : allowOrigin,
      credentials: true,
    },
    path: '/socket.io',
  })

  // Live stream host tracking: streamId -> { socketId, hostName }
  const liveHosts = new Map<string, { socketId: string; hostName: string }>()

  io.on('connection', (socket) => {
    // ── Chat events ──
    socket.on('identify', (data: any) => {
      const email = (data && data.email) || null
      if (email) {
        ;(socket as any).email = email
        socket.join(`inbox:${email}`)
      }
    })
    socket.on('join-conversation', (data: any) => {
      const id = (data && data.id) || (data && data.conversationId)
      if (id) socket.join(`conversation:${id}`)
    })
    socket.on('leave-conversation', (data: any) => {
      const id = (data && data.id) || (data && data.conversationId)
      if (id) socket.leave(`conversation:${id}`)
    })

    // ── Live WebRTC signaling ──

    // Broadcaster goes live
    socket.on('live:start', ({ id, hostName }: { id: string; hostName?: string }) => {
      if (!id) return
      socket.join(`live:${id}`)
      const name = hostName || 'Host'
      liveHosts.set(id, { socketId: socket.id, hostName: name })
      ;(socket as any).hostingStreamId = id
      socket.to(`live:${id}`).emit('live:host-ready', { hostName: name })
    })

    // Viewer joins stream room
    socket.on('live:viewer-join', ({ id }: { id: string }) => {
      if (!id) return
      socket.join(`live:${id}`)
      const host = liveHosts.get(id)
      if (host) {
        io.to(host.socketId).emit('live:viewer-joined', { viewerId: socket.id })
        socket.emit('live:host-info', { hostName: host.hostName })
      }
    })

    // Host sends offer to a specific viewer
    socket.on('live:offer', ({ to, sdp }: { to: string; sdp: string }) => {
      io.to(to).emit('live:offer', { sdp, hostId: socket.id })
    })

    // Viewer sends answer back to host
    socket.on('live:answer', ({ to, sdp }: { to: string; sdp: string }) => {
      io.to(to).emit('live:answer', { viewerId: socket.id, sdp })
    })

    // ICE candidate relay (works both directions)
    socket.on('live:ice', ({ to, candidate }: { to: string; candidate: any }) => {
      io.to(to).emit('live:ice', { from: socket.id, candidate })
    })

    // Live chat message — broadcast to everyone in the stream room
    socket.on('live:chat', ({ id, name, text }: { id: string; name: string; text: string }) => {
      if (!id || !text || !name) return
      const sanitized = text.slice(0, 500)
      socket.to(`live:${id}`).emit('live:chat', {
        from: socket.id,
        name,
        text: sanitized,
        ts: Date.now(),
      })
    })

    // Host ends stream
    socket.on('live:end', ({ id }: { id: string }) => {
      socket.to(`live:${id}`).emit('live:ended')
      liveHosts.delete(id)
    })

    // Host replaced a track (e.g. screen share) — notify viewers to renegotiate
    socket.on('live:track-replaced', ({ id }: { id: string }) => {
      if (!id) return
      const room = io.sockets.adapter.rooms.get(`live:${id}`)
      if (!room) return
      for (const viewerId of room) {
        if (viewerId === socket.id) continue
        io.to(socket.id).emit('live:viewer-joined', { viewerId })
      }
    })

    // Clean up if host disconnects unexpectedly
    socket.on('disconnect', () => {
      const hostingStreamId = (socket as any).hostingStreamId
      if (hostingStreamId) {
        liveHosts.delete(hostingStreamId)
        socket.to(`live:${hostingStreamId}`).emit('live:ended')
      }
    })
  })

  // Lazily start message watcher (safe if already started)
  try {
    require('./watch').ensureMessageWatcher?.()
  } catch {}

  g.__socket_io = io
  ioGlobal = io
  return io
}
