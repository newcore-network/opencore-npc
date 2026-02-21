import type { NpcGoal } from '../../../shared/contracts/npc-types'

export type LlmPlanInput = {
  goal: NpcGoal
  snapshot: unknown
  memory: unknown[]
  observations: Record<string, unknown>
  allowSkills: string[]
}

export interface LLMProvider {
  readonly name: string
  complete(input: LlmPlanInput): Promise<unknown>
}
