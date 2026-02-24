import type { LLMProvider } from './llm-provider'
import type { NpcPlanner, SkillDecision } from '../types'
import { NpcRulePlanner } from './rule-planner'

export class NpcAiPlanner implements NpcPlanner {
  constructor(
    private readonly llm: LLMProvider,
    private readonly fallback: NpcPlanner = new NpcRulePlanner(),
  ) {}

  async decide(ctx: Parameters<NpcPlanner['decide']>[0]): Promise<SkillDecision | undefined> {
    if (ctx.allowSkills.length === 0) return undefined

    const prompt = [
      'You are deciding one NPC skill.',
      `Goal: ${ctx.goal.id}${ctx.goal.hint ? ` (${ctx.goal.hint})` : ''}`,
      `Allowed skills: ${ctx.allowSkills.join(', ')}`,
      `Observations: ${JSON.stringify(ctx.observations)}`,
      'Return strict JSON: {"skill":"<allowed>","args":{},"waitMs":0}',
    ].join('\n')

    try {
      const raw = await this.llm.complete({ prompt, temperature: 0.2, maxTokens: 200 })
      const decision = parseDecision(raw)
      if (!decision) return this.fallback.decide(ctx)
      if (!ctx.allowSkills.includes(decision.skill)) return this.fallback.decide(ctx)
      return decision
    } catch {
      return this.fallback.decide(ctx)
    }
  }
}

function parseDecision(raw: string): SkillDecision | undefined {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return undefined

  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as SkillDecision
    if (!parsed || typeof parsed.skill !== 'string') return undefined
    return {
      skill: parsed.skill,
      args: parsed.args,
      waitMs: typeof parsed.waitMs === 'number' ? parsed.waitMs : undefined,
    }
  } catch {
    return undefined
  }
}
