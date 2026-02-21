import type { NpcGoal, NpcIdentity } from '../../../shared/contracts/npc-types'
import type { NpcTransport } from '../transport/npc-transport.interface'

/**
 * Runtime context provided to planners and skills.
 *
 * @remarks
 * This object is server-authoritative and rebuilt on each tick.
 */
export type NpcContext = {
  npc: NpcIdentity
  controllerId: string
  goal: NpcGoal
  setGoal(goal: string | NpcGoal): void
  snapshot: unknown
  memory: unknown[]
  observations: Record<string, unknown>
  events: {
    emit<T>(
      name: string,
      payload: T,
      opts?: { scope?: 'server' | 'nearby' | 'owner' | 'all'; radius?: number },
    ): void
  }
  transport: NpcTransport
  state: {
    get<T>(k: string): T | undefined
    set(k: string, v: unknown): void
  }
  logger?: {
    info(...a: unknown[]): void
    warn(...a: unknown[]): void
    error(...a: unknown[]): void
  }
}
