export type NpcSchedulerDefaults = {
  tickMsNear: number
  tickMsFar: number
  nearRadius: number
}

/**
 * Computes per-agent tick intervals based on distance heuristics.
 */
export class NpcScheduler {
  constructor(private readonly defaults: NpcSchedulerDefaults = { tickMsNear: 350, tickMsFar: 1500, nearRadius: 120 }) {}

  /** Returns recommended tick interval in milliseconds. */
  getTickMs(distanceToNearestPlayer?: number): number {
    if (distanceToNearestPlayer === undefined) return this.defaults.tickMsFar
    if (distanceToNearestPlayer <= this.defaults.nearRadius) return this.defaults.tickMsNear
    return this.defaults.tickMsFar
  }
}
