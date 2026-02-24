import type { Vector3 } from '@open-core/framework'

export type NpcIdentity = {
  id: string
  netId?: number
}

export type NpcGoal = {
  id: string
  hint?: string
}

export type NpcSpawnInput = {
  model: string | number
  position: Vector3
  heading?: number
  networked?: boolean
  routingBucket?: number
  persistent?: boolean
  metadata?: Record<string, unknown>
}
