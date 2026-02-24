import type { NPC, Npcs } from '@open-core/framework/server'
import type { NpcGoal, NpcIdentity } from '../shared'

/** Result returned by a skill execution. */
export type SkillResult = {
  ok: boolean
  waitMs?: number
  memory?: unknown
  error?: string
}

/** Planner decision for the next skill execution. */
export type SkillDecision = {
  skill: string
  args?: unknown
  waitMs?: number
}

/** Constructor type for class-based NPC skills. */
export type NpcSkillClass<TArgs = unknown> = new (...args: any[]) => {
  execute(ctx: NpcContext, args?: TArgs): Promise<SkillResult> | SkillResult
}

/** Typed reference to a registered class-based NPC skill. */
export type NpcSkillRef<TArgs = unknown> = {
  key: string
  token: NpcSkillClass<TArgs>
}

/** Runtime skill contract consumed by the engine. */
export type NpcSkillContract = {
  key: string
  execute(ctx: NpcContext, args?: unknown): Promise<SkillResult> | SkillResult
}

/** Planner contract used to select the next skill. */
export type NpcPlanner = {
  decide(ctx: NpcContext): Promise<SkillDecision | undefined> | SkillDecision | undefined
}

/** Context provided to planners and skill executions. */
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

/** Controller definition used by the decorator registry. */
export type NpcIntelligentControllerDefinition = {
  id: string
  planner?: 'rule' | 'ai' | NpcPlanner
  skills?: NpcSkillRef[]
  tickMs?: number
}

/** Runtime options for attaching intelligence to one NPC. */
export type AttachOptions = {
  controllerId?: string
  planner?: NpcPlanner
  goal?: NpcGoal
  tickMs?: number
  skills?: NpcSkillRef[]
}

/** Internal resolved controller contract used by runtime engine. */
export type ResolvedNpcControllerDefinition = {
  id: string
  planner?: NpcPlanner
  skills?: string[]
  tickMs?: number
}
