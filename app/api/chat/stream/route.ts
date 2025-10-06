import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/authOptions'
import { chatBus } from '../../../../lib/realtime'
import { ensureMessageWatcher } from '../../../../lib/watch'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  // Ensure DB change stream watcher is running so cross-process inserts are emitted
  await ensureMessageWatcher()
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get('conversationId')
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  let keepAlive: any = null
  let closed = false
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null
  const signal: AbortSignal | undefined = (req as any).signal

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller
      const encoder = new TextEncoder()

      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return
        try {
          controller.enqueue(chunk)
        } catch {
          cleanup()
        }
      }

      const send = (event: any) => {
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      const onEvent = (evt: any) => send(evt)
      chatBus.on(conversationId, onEvent)

      let abortHandler: any = null
      const cleanup = () => {
        if (closed) return
        closed = true
        if (keepAlive) clearInterval(keepAlive)
        chatBus.off(conversationId, onEvent)
        try { controller.close() } catch {}
        if (signal && abortHandler) signal.removeEventListener('abort', abortHandler)
      }

      // expose cleanup to outer scope usages
      ;(globalThis as any).__chat_stream_cleanup = cleanup

      // initial event
      send({ type: 'connected' })
      keepAlive = setInterval(() => safeEnqueue(encoder.encode(': keep-alive\n\n')), 25000)

      abortHandler = () => cleanup()
      if (signal) signal.addEventListener('abort', abortHandler)

      // Assign also to cancel path
      ;(this as any)._cleanup = cleanup
    },
    cancel() {
      // @ts-ignore
      if ((this as any)._cleanup) (this as any)._cleanup()
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, no-transform',
      Pragma: 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
