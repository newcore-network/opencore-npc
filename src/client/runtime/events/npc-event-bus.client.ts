import type { NpcEventEnvelope } from '../../../shared/contracts/npc-events.contracts'

type Handler = (envelope: NpcEventEnvelope) => void | Promise<void>

/** In-process client gameplay event bus. */
export class NpcEventBusClient {
  private readonly handlers = new Map<string, Set<Handler>>()

  /** Subscribes to one event name. */
  on(eventName: string, handler: Handler): () => void {
    const set = this.handlers.get(eventName) ?? new Set<Handler>()
    set.add(handler)
    this.handlers.set(eventName, set)
    return () => {
      const current = this.handlers.get(eventName)
      if (!current) return
      current.delete(handler)
    }
  }

  /** Emits an envelope to all listeners of its event name. */
  emit(envelope: NpcEventEnvelope): void {
    const set = this.handlers.get(envelope.name)
    if (!set) return
    for (const handler of [...set]) {
      Promise.resolve(handler(envelope)).catch(() => undefined)
    }
  }
}
