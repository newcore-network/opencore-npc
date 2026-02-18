import type { NpcGoal, NpcIdentity } from '../../../shared/contracts/npc-types'
import type { NpcConstraints } from '../constraints/npc-constraints'
import type { NpcPlanner } from '../planner/npc-planner.interface'
import type { SkillNext, SkillWait } from '../contracts/skill-result'

/** Runtime state for a currently active skill execution. */
export type ActiveSkillState = {
  skill: string
  args: unknown
  wait?: SkillWait & { untilTs?: number }
  next?: SkillNext
}

/** Mutable state object representing one NPC runtime agent. */
export type NpcAgent = {
  npc: NpcIdentity
  goal: NpcGoal
  planner: NpcPlanner
  constraints: NpcConstraints
  observations: Record<string, unknown>
  memory: unknown[]
  state: Map<string, unknown>
  active?: ActiveSkillState
  turnCalls: number
}
