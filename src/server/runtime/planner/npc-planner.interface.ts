import type { NpcContext } from '../context/npc-context.types'

/** Planner input containing runtime allowlist boundaries. */
export type PlannerSpec = {
  allowSkills: string[]
}

/** Planner output describing the next action proposal. */
export type PlanDecision =
  | { type: 'skill'; skill: string; args: unknown; confidence?: number }
  | { type: 'idle'; reason?: string }

/** Contract implemented by deterministic and AI planners. */
export interface NpcPlanner {
  name: string
  decide(ctx: NpcContext, spec: PlannerSpec): Promise<PlanDecision>
}
