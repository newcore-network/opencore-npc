import type { NpcPlanner, SkillDecision } from '../types'

export class NpcRulePlanner implements NpcPlanner {
  decide(ctx: Parameters<NpcPlanner['decide']>[0]): SkillDecision | undefined {
    const explicit = ctx.state.get<SkillDecision>('decision')
    if (explicit) return explicit

    const fromObs = ctx.observations.nextSkill
    if (typeof fromObs === 'string' && ctx.allowSkills.includes(fromObs)) {
      return { skill: fromObs }
    }

    const fromGoalHint = typeof ctx.goal.hint === 'string' ? ctx.goal.hint.trim() : ''
    if (fromGoalHint.length > 0 && ctx.allowSkills.includes(fromGoalHint)) {
      return { skill: fromGoalHint }
    }

    return ctx.allowSkills[0] ? { skill: ctx.allowSkills[0] } : undefined
  }
}
