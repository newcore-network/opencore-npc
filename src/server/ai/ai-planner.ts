import type { LLMProvider, LlmGenerationConfig } from './llm-provider'
import type { NpcPlanner, SkillDecision } from '../types'
import { NpcRulePlanner } from './rule-planner'

export type NpcAiPlannerConfig = {
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  timeoutMs?: number
  systemPrompt?: string
  perSkill?: Record<string, LlmGenerationConfig>
}

export type NpcAiPlannerDebug = {
  enabled?: boolean
  llm?: boolean
  runtime?: boolean
}

export class NpcAiPlanner implements NpcPlanner {
  constructor(
    private readonly llm: LLMProvider,
    private readonly fallback: NpcPlanner = new NpcRulePlanner(),
    private readonly config: NpcAiPlannerConfig = {},
    private readonly debug: NpcAiPlannerDebug = {},
    private readonly controllerId: string = 'unknown-controller',
  ) {}

  async decide(
    ctx: Parameters<NpcPlanner['decide']>[0],
    skillKeys: Parameters<NpcPlanner['decide']>[1],
  ): Promise<SkillDecision | undefined> {
    if (skillKeys.length === 0) return undefined

    const preferredSkill =
      typeof ctx.observations.nextSkill === 'string' && skillKeys.includes(ctx.observations.nextSkill)
        ? ctx.observations.nextSkill
        : undefined

    const skillScope = preferredSkill ?? 'default'
    const config = mergeGenerationConfig(this.config, preferredSkill)

    const prompt = [
      'You are deciding one NPC skill.',
      `Goal: ${ctx.goal.id}${ctx.goal.hint ? ` (${ctx.goal.hint})` : ''}`,
      `Allowed skills: ${skillKeys.join(', ')}`,
      ...(preferredSkill ? [`Preferred skill: ${preferredSkill}`] : []),
      `Observations: ${JSON.stringify(ctx.observations)}`,
      'Return strict JSON: {"skill":"<allowed>","args":{},"waitMs":0}',
    ].join('\n')

    try {
      const raw = await this.llm.complete({
        prompt,
        systemPrompt: this.config.systemPrompt,
        config,
        meta: {
          controllerId: this.controllerId,
          skillScope,
        },
      })

      if (this.debug.enabled && this.debug.runtime) {
        console.log(
          `[npc-intelligence][ai][decision-raw] controller=${this.controllerId} scope=${skillScope} raw=${raw}`,
        )
      }

      const decision = parseDecision(raw)
      if (!decision) return this.fallback.decide(ctx, skillKeys)
      if (!skillKeys.includes(decision.skill)) return this.fallback.decide(ctx, skillKeys)

      if (this.debug.enabled && this.debug.runtime) {
        console.log(
          `[npc-intelligence][ai][decision] controller=${this.controllerId} skill=${decision.skill}`,
        )
      }

      return decision
    } catch {
      return this.fallback.decide(ctx, skillKeys)
    }
  }
}

function mergeGenerationConfig(
  config: NpcAiPlannerConfig,
  preferredSkill: string | undefined,
): LlmGenerationConfig {
  const base: LlmGenerationConfig = {
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    topP: config.topP,
    timeoutMs: config.timeoutMs,
  }

  if (!preferredSkill) {
    return base
  }

  return {
    ...base,
    ...(config.perSkill?.[preferredSkill] ?? {}),
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
