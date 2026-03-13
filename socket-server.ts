/**
 * Standalone Socket.IO server entry point.
 * Deploy this as a separate Railway service.
 *
 * Railway sets the PORT env var automatically — this server binds to it.
 * Set SOCKET_IO_ORIGIN to your Next.js app URL (e.g. https://your-app.up.railway.app)
 */
import { getIO } from './lib/socketServer'

// Railway provides PORT; fall back to 4001 for local dev
process.env.SOCKET_IO_PORT = process.env.PORT || process.env.SOCKET_IO_PORT || '4001'

getIO()
