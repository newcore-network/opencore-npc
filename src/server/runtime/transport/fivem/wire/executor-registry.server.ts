export class ExecutorRegistryServer {
  private readonly readyExecutors = new Set<number>()

  constructor() {
    const g = globalThis as Record<string, unknown>

    const onNetFn = g.onNet
    if (typeof onNetFn === 'function') {
      ;(onNetFn as (eventName: string, handler: () => void) => void)(
        'opencore:npc:executor:ready',
        () => {
          const srcRaw = (globalThis as Record<string, unknown>).source
          const src = Number(srcRaw)
          if (Number.isFinite(src) && src > 0) {
            this.readyExecutors.add(src)
          }
        },
      )
    }

    const onFn = g.on
    if (typeof onFn === 'function') {
      ;(onFn as (eventName: string, handler: () => void) => void)('playerDropped', () => {
        const srcRaw = (globalThis as Record<string, unknown>).source
        const src = Number(srcRaw)
        if (Number.isFinite(src) && src > 0) {
          this.readyExecutors.delete(src)
        }
      })
    }
  }

  chooseAnyReadyOrFirstPlayer(): number | undefined {
    if (this.readyExecutors.size > 0) {
      const fromReady = this.readyExecutors.values().next().value
      if (typeof fromReady === 'number' && Number.isFinite(fromReady)) {
        return fromReady
      }
    }

    const fn = (globalThis as Record<string, unknown>).GetPlayers
    if (typeof fn !== 'function') {
      return undefined
    }

    const players = (fn as () => string[])()
    if (!Array.isArray(players) || players.length === 0) {
      return undefined
    }

    const id = Number(players[0])
    return Number.isFinite(id) ? id : undefined
  }
}
