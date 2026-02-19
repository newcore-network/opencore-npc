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
    const candidates = this.chooseCandidates()
    return candidates[0]
  }

  chooseCandidates(): number[] {
    const result: number[] = []
    const seen = new Set<number>()

    for (const ready of this.readyExecutors.values()) {
      if (!Number.isFinite(ready) || ready <= 0 || seen.has(ready)) continue
      seen.add(ready)
      result.push(ready)
    }

    const fn = (globalThis as Record<string, unknown>).GetPlayers
    if (typeof fn === 'function') {
      const players = (fn as () => string[])()
      if (Array.isArray(players)) {
        for (const raw of players) {
          const id = Number(raw)
          if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue
          seen.add(id)
          result.push(id)
        }
      }
    }

    return result
  }
}
