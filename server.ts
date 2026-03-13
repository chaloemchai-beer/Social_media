/**
 * Custom Next.js server that also hosts Socket.IO on the same port.
 * Railway sets PORT automatically — both Next.js and Socket.IO share it.
 *
 * Usage:
 *   npx tsx server.ts          (dev with ts)
 *   node dist-server/server.js (production)
 */
import { createServer } from 'http'
import next from 'next'
import { getIO } from './lib/socketServer'

const dev = process.env.NODE_ENV !== 'production'
const port = Number(process.env.PORT || 3000)

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res)
  })

  // Attach Socket.IO to the same HTTP server
  getIO(httpServer)

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (Next.js + Socket.IO)`)
  })
})
