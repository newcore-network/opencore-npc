import { EventsAPI, GLOBAL_CONTAINER } from '@open-core/framework'
import type { NpcEventEnvelope, NpcEventScope } from '../../../shared/contracts/npc-events.contracts'

type Handler<T = any> = (event: NpcEventEnvelope<T>) => void | Promise<void>

type AudienceResolver = (evt: NpcEventEnvelope) => number[]

/**
 * Server gameplay event bus.
 *
 * @remarks
 * Delivers local listeners and optionally forwards envelopes to clients.
 */
export class NpcEventBusServer {
  private readonly handlers = new Map<string, Set<Handler>>()
  private eventsResolved?: EventsAPI<'server'>

  constructor(
    private readonly eventsApi?: EventsAPI<'server'>,
    private readonly resolveAudience?: AudienceResolver,
  ) {}

  /** Subscribes to one gameplay event name. */
  on<T = any>(eventName: string, handler: Handler<T>): () => void {
    const set = this.handlers.get(eventName) ?? new Set<Handler>()
    set.add(handler)
    this.handlers.set(eventName, set)
    return () => {
      const current = this.handlers.get(eventName)
      if (!current) return
      current.delete(handler)
    }
  }

  /** Emits one gameplay event envelope and returns the emitted payload. */
  emit<T>(
    name: string,
    npcId: string,
    payload: T,
    opts?: { scope?: NpcEventScope; radius?: number },
  ): NpcEventEnvelope<T> {
    const envelope: NpcEventEnvelope<T> = {
      name,
      npcId,
      payload,
      scope: opts?.scope ?? 'server',
      radius: opts?.radius,
      ts: Date.now(),
    }

    const set = this.handlers.get(name)
    if (set) {
      for (const handler of [...set]) {
        Promise.resolve(handler(envelope)).catch(() => undefined)
      }
    }

    const eventsApi = this.resolveEventsApi()
    if (eventsApi && envelope.scope !== 'server') {
      const audience = this.resolveAudience?.(envelope) ?? []
      if (audience.length > 0) {
        eventsApi.emit('opencore:npc:event', audience, envelope)
        eventsApi.emit(`opencore:npc:event:${name}`, audience, envelope)
      }
    }

    return envelope
  }

  private resolveEventsApi(): EventsAPI<'server'> | undefined {
    if (this.eventsResolved) return this.eventsResolved
    if (this.eventsApi) {
      this.eventsResolved = this.eventsApi
      return this.eventsResolved
    }

    if (GLOBAL_CONTAINER.isRegistered(EventsAPI as unknown as never)) {
      this.eventsResolved = GLOBAL_CONTAINER.resolve(EventsAPI as unknown as never) as EventsAPI<'server'>
      return this.eventsResolved
    }

    return undefined
  }
}
