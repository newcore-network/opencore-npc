import type { NpcContext } from '../context/npc-context.types'
import type { NpcPlanner, PlannerSpec, PlanDecision } from './npc-planner.interface'
import { AiDecisionSchema } from './ai/ai-json-schema'
import type { AiProvider } from './ai/openrouter-provider'

type BudgetConfig = {
  maxRequestsPerMin?: number
  minDecisionIntervalMs?: number
  disableAfterFirstFailure?: boolean
}

/**
 * AI planner with deterministic fallback and request budget controls.
 */
export class NpcAiPlanner implements NpcPlanner {
  readonly name = 'ai'
  private readonly requestBucket: number[] = []
  private readonly lastDecisionAt = new Map<string, number>()
  private readonly disabledByNpc = new Set<string>()

  constructor(
    private readonly provider: AiProvider,
    private readonly fallback: NpcPlanner,
    private readonly budget?: BudgetConfig,
  ) {}

  /** Attempts AI decision first, then falls back to deterministic planner. */
  async decide(ctx: NpcContext, spec: PlannerSpec): Promise<PlanDecision> {
    this.debug(ctx.npc.id, 'decide_start', {
      allowSkills: spec.allowSkills,
      hasMemory: ctx.memory.length > 0,
      observationKeys: Object.keys(ctx.observations),
    })

    if (this.disabledByNpc.has(ctx.npc.id)) {
      this.debug(ctx.npc.id, 'disabled_by_npc', {})
      return this.fallback.decide(ctx, spec)
    }

    const minInterval = this.budget?.minDecisionIntervalMs ?? 2000
    const lastAt = this.lastDecisionAt.get(ctx.npc.id) ?? 0
    if (Date.now() - lastAt < minInterval) {
      this.debug(ctx.npc.id, 'min_interval_blocked', { minInterval, lastAt })
      return this.fallback.decide(ctx, spec)
    }

    if (!this.consumeBudget()) {
      this.debug(ctx.npc.id, 'budget_blocked', {
        maxRequestsPerMin: this.budget?.maxRequestsPerMin,
      })
      return this.fallback.decide(ctx, spec)
    }

    this.lastDecisionAt.set(ctx.npc.id, Date.now())

    try {
      const raw = await this.provider.complete({
        context: {
          goal: ctx.goal,
          snapshot: ctx.snapshot,
          memory: ctx.memory,
          observations: ctx.observations,
        },
        allowSkills: spec.allowSkills,
      })

      const parsed = AiDecisionSchema.safeParse(raw)
      if (!parsed.success) {
        this.debug(ctx.npc.id, 'invalid_schema_fallback', {
          issues: parsed.error.issues,
          raw,
        })
        return this.fallback.decide(ctx, spec)
      }

      if (!spec.allowSkills.includes(parsed.data.skill)) {
        this.debug(ctx.npc.id, 'disallowed_skill_fallback', {
          skill: parsed.data.skill,
          allowSkills: spec.allowSkills,
        })
        return this.fallback.decide(ctx, spec)
      }

      this.debug(ctx.npc.id, 'decision_ok', {
        skill: parsed.data.skill,
        confidence: parsed.data.confidence,
        args: parsed.data.args,
      })

      return {
        type: 'skill',
        skill: parsed.data.skill,
        args: parsed.data.args,
        confidence: parsed.data.confidence,
      }
    } catch {
      this.debug(ctx.npc.id, 'provider_exception_fallback', {})
      if (this.budget?.disableAfterFirstFailure) {
        this.disabledByNpc.add(ctx.npc.id)
        this.debug(ctx.npc.id, 'disabled_after_failure', {})
      }
      return this.fallback.decide(ctx, spec)
    }
  }

  /** Consumes one request slot from the rolling per-minute budget. */
  private consumeBudget(): boolean {
    const maxRequests = this.budget?.maxRequestsPerMin
    if (!maxRequests || maxRequests <= 0) {
      return true
    }

    const now = Date.now()
    while (this.requestBucket.length > 0) {
      const first = this.requestBucket[0]
      if (first === undefined || now - first <= 60_000) {
        break
      }
      this.requestBucket.shift()
    }

    if (this.requestBucket.length >= maxRequests) {
      return false
    }

    this.requestBucket.push(now)
    return true
  }

  private debug(npcId: string, stage: string, payload: unknown): void {
    if (process.env.OPENCORE_NPC_AI_DEBUG !== '1') {
      return
    }

    try {
      console.log(`[npc:ai:planner] npc=${npcId} stage=${stage}`, payload)
    } catch {
      console.log(`[npc:ai:planner] npc=${npcId} stage=${stage}`)
    }
  }
}

/** Creates a deterministic planner instance. */
export function rulePlanner(): NpcPlanner {
  const { NpcRulePlanner } = require('./npc-rule-planner') as typeof import('./npc-rule-planner')
  return new NpcRulePlanner()
}

/** Creates an AI planner with explicit provider and fallback. */
export function aiPlanner(provider: AiProvider, fallback: NpcPlanner, budget?: BudgetConfig): NpcPlanner {
  return new NpcAiPlanner(provider, fallback, budget)
}
