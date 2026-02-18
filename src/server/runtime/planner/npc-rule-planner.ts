import type { NpcContext } from '../context/npc-context.types'
import type { NpcPlanner, PlannerSpec, PlanDecision } from './npc-planner.interface'

/**
 * Deterministic fallback planner used when AI is unavailable or disabled.
 */
export class NpcRulePlanner implements NpcPlanner {
  readonly name = 'rule'

  /** Selects the next skill based on simple observation-driven rules. */
  async decide(ctx: NpcContext, spec: PlannerSpec): Promise<PlanDecision> {
    const allow = new Set(spec.allowSkills)
    const assignedVeh = ctx.observations.assignedVeh as { netId?: number } | undefined
    const dest = ctx.observations.dest as { x: number; y: number; z: number } | undefined

    if (assignedVeh?.netId && dest && allow.has('goToCarDrivePark')) {
      return {
        type: 'skill',
        skill: 'goToCarDrivePark',
        args: {
          vehicleNetId: assignedVeh.netId,
          dest,
        },
        confidence: 0.82,
      }
    }

    if (allow.has('wanderArea')) {
      const pos = ctx.observations.anchor ?? { x: 0, y: 0, z: 0 }
      return {
        type: 'skill',
        skill: 'wanderArea',
        args: { ...pos, radius: 25 },
        confidence: 0.55,
      }
    }

    return { type: 'idle', reason: 'no deterministic decision available' }
  }
}
