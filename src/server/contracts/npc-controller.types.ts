import type { NpcPlanner } from '../runtime/planner/npc-planner.interface'
import type { NpcSkillLike } from './npc-skill-ref.types'

export type NpcControllerPlanner = 'rule' | 'ai' | NpcPlanner

export type NpcControllerConstraints = {
  limitCallsPerTurn?: number
}

export type NpcControllerOptions = {
  id: string
  planner?: NpcControllerPlanner
  skills: Array<NpcSkillLike | string>
  constraints?: NpcControllerConstraints
  tickMs?: number
}
