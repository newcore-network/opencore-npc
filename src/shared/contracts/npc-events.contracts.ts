/** Target audience scope for gameplay NPC events. */
export type NpcEventScope = 'server' | 'nearby' | 'owner' | 'all'

/**
 * Canonical event envelope transported across server and client runtimes.
 *
 * @typeParam T - Event payload type.
 */
export type NpcEventEnvelope<T = any> = {
  name: string
  npcId: string
  payload: T
  scope: NpcEventScope
  radius?: number
  ts: number
}
