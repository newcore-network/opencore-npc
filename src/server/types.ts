import type { NPC } from '@open-core/framework/server'
import type { NpcGoal } from '../shared'
import type { NpcSkill } from './decorators/npc-skill.decorator'
import type { LlmGenerationConfig } from './ai/llm-provider'

/** Result returned by one skill execution. */
export type SkillResult = {
  ok: boolean
  waitMs?: number
  memory?: unknown
  error?: string
}

/** Result returned by one engine run invocation. */
export type RunResult = {
  ok: boolean
  done: boolean
  skill?: string
  waitMs?: number
  memory?: unknown
  error?: string
}

/** Planner decision selecting the next skill to execute. */
export type SkillDecision = {
  skill: string
  args?: unknown
  waitMs?: number
}

/** Runtime context passed to planners and skills. */
export type NpcContext = {
  npc: NPC
  name?: string
  npcType?: string
  goal: NpcGoal
  setGoal(goal: string | NpcGoal): void
  observations: Record<string, unknown>
  memory: unknown[]
  state: {
    get<T>(key: string): T | undefined
    set(key: string, value: unknown): void
  }
}

/** Constructor type for class-based skills. */
export type NpcSkillClass<TArgs = unknown> = new (...args: never[]) => NpcSkill<TArgs>

/** Inferred argument type for a class-based skill. */
export type SkillArgs<TSkill extends NpcSkillClass> =
  TSkill extends NpcSkillClass<infer TArgs> ? TArgs : never

/** Planner contract used by the intelligence engine. */
export type NpcPlanner = {
  decide(
    ctx: NpcContext,
    skillKeys: string[],
  ): Promise<SkillDecision | undefined> | SkillDecision | undefined
}

/** Controller definition used by decorators and plugin bootstrap. */
export type NpcIntelligentControllerDefinition = {
  id: string
  planner?: 'rule' | 'ai' | NpcPlanner
  skills?: NpcSkillClass[]
  tickMs?: number
  name?: string
  npcType?: string
  ai?: {
    model?: string
    temperature?: number
    maxTokens?: number
    topP?: number
    timeoutMs?: number
    systemPrompt?: string
    perSkill?: Record<string, LlmGenerationConfig>
  }
}

/** Options used when attaching intelligence to one NPC. */
export type AttachOptions = {
  controllerId?: string
  planner?: NpcPlanner
  goal?: NpcGoal
  tickMs?: number
  skills?: NpcSkillClass[]
  denySkills?: NpcSkillClass[]
  name?: string
  npcType?: string
}

/** Internal resolved controller shape used by the runtime engine. */
export type ResolvedNpcControllerDefinition = {
  id: string
  name?: string
  npcType?: string
  planner?: NpcPlanner
  skills?: string[]
  tickMs?: number
}

/** Debug options for runtime and AI decisions. */
export type NpcIntelligenceDebugConfig = {
  enabled?: boolean
  runtime?: boolean
  llm?: boolean
}

/** Internal runtime skill used by the registry and engine. */
export type RegisteredNpcSkill = {
  key: string
  execute(ctx: NpcContext, args?: unknown): Promise<SkillResult> | SkillResult
}
