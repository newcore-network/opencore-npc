import { Vector3 } from "@open-core/framework"

/** Public identity information used by the NPC runtime. */
export type NpcIdentity = {
  id: string
  netId?: number
  ped?: number
}

/** Goal descriptor consumed by planners. */
export type NpcGoal = {
  id: string
  hint?: string
}

/** Input contract for creating an NPC instance. */
export type NpcSpawnInput = {
  model: string
  pos: Vector3
  heading?: number
  networked?: boolean
}
