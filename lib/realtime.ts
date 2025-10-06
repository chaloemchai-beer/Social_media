import { EventEmitter } from 'events'

type MessageEvent = {
  conversationId: string
  payload: any
}

class ChatBus {
  private emitter = new EventEmitter()

  emit(conversationId: string, payload: any) {
    this.emitter.emit(this.key(conversationId), { conversationId, payload } as MessageEvent)
  }

  on(conversationId: string, listener: (evt: MessageEvent) => void) {
    this.emitter.on(this.key(conversationId), listener)
  }

  off(conversationId: string, listener: (evt: MessageEvent) => void) {
    this.emitter.off(this.key(conversationId), listener)
  }

  private key(id: string) {
    return `chat:${id}`
  }
}

// Singleton across hot reloads in dev
const g = global as any
export const chatBus: ChatBus = g.__chatBus || (g.__chatBus = new ChatBus())

