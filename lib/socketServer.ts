import { createServer, Server as HTTPServer } from 'http'
import { Server } from 'socket.io'

let ioGlobal: Server | null = null
let httpServer: HTTPServer | null = null

export function getIO(): Server {
  if (ioGlobal) return ioGlobal
  const g = global as any
  if (g.__socket_io) return (ioGlobal = g.__socket_io as Server)

  const port = Number(process.env.SOCKET_IO_PORT || 4001)
  const allowOrigin = process.env.SOCKET_IO_ORIGIN || '*'
  httpServer = createServer()
  const io = new Server(httpServer, {
    cors: {
      origin: allowOrigin === '*' ? true : allowOrigin,
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
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
  })

  httpServer.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[socket.io] listening at :${port}`)
  })

  // Lazily start message watcher (safe if already started)
  try {
    // dynamic import to avoid eager cycle
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('./watch').ensureMessageWatcher?.()
  } catch {}

  g.__socket_io = io
  ioGlobal = io
  return io
}
