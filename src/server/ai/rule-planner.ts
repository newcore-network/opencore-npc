import type { NpcPlanner, SkillDecision } from '../types'

export class NpcRulePlanner implements NpcPlanner {
  decide(
    ctx: Parameters<NpcPlanner['decide']>[0],
    skillKeys: Parameters<NpcPlanner['decide']>[1],
  ): SkillDecision | undefined {
    const explicit = ctx.state.get<SkillDecision>('decision')
    if (explicit) return explicit

    const fromObs = ctx.observations.nextSkill
    if (typeof fromObs === 'string' && skillKeys.includes(fromObs)) {
      return { skill: fromObs }
    }

    const fromGoalHint = typeof ctx.goal.hint === 'string' ? ctx.goal.hint.trim() : ''
    if (fromGoalHint.length > 0 && skillKeys.includes(fromGoalHint)) {
      return { skill: fromGoalHint }
    }

    return skillKeys[0] ? { skill: skillKeys[0] } : undefined
  }
}
