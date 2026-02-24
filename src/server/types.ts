import type { NPC, Npcs } from '@open-core/framework/server'
import type { NpcGoal, NpcIdentity } from '../shared'

export type SkillResult = {
  ok: boolean
  waitMs?: number
  memory?: unknown
  error?: string
}

export type SkillDecision = {
  skill: string
  args?: unknown
  waitMs?: number
}

export type NpcSkillContract = {
  key: string
  execute(ctx: NpcContext, args?: unknown): Promise<SkillResult> | SkillResult
}

export type NpcPlanner = {
  decide(ctx: NpcContext): Promise<SkillDecision | undefined> | SkillDecision | undefined
}

export type NpcContext = {
  npc: NpcIdentity
  npcEntity: NPC
  npcs: Npcs
  goal: NpcGoal
  setGoal(goal: string | NpcGoal): void
  observations: Record<string, unknown>
  memory: unknown[]
  state: {
    get<T>(key: string): T | undefined
    set(key: string, value: unknown): void
  }
  allowSkills: string[]
  emit(eventName: string, payload?: unknown): void
}

export type NpcControllerDefinition = {
  id: string
  planner?: 'rule' | 'ai' | NpcPlanner
  skills?: string[]
  tickMs?: number
}

export type AttachOptions = {
  controllerId?: string
  planner?: NpcPlanner
  goal?: NpcGoal
  tickMs?: number
  allowSkills?: string[]
}
