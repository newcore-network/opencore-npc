import type { NpcHookName } from '../../decorators/npc-hook.decorator'

type HookHandler = (ctx: unknown, info?: unknown) => void | Promise<void>

/** In-process pub/sub bus for engine lifecycle hooks. */
export class NpcHookBusServer {
  private readonly handlers = new Map<NpcHookName, Set<HookHandler>>()

  /** Subscribes to a hook and returns an unsubscribe function. */
  on(hook: NpcHookName, handler: HookHandler): () => void {
    const set = this.handlers.get(hook) ?? new Set<HookHandler>()
    set.add(handler)
    this.handlers.set(hook, set)
    return () => {
      const current = this.handlers.get(hook)
      if (!current) return
      current.delete(handler)
    }
  }

  /** Emits a hook notification to all registered listeners. */
  emit(hook: NpcHookName, ctx: unknown, info?: unknown): void {
    const set = this.handlers.get(hook)
    if (!set) return
    for (const handler of [...set]) {
      Promise.resolve(handler(ctx, info)).catch(() => undefined)
    }
  }
}
