import type { NpcEventBusServer } from '../events/npc-event-bus.server'
import type { NpcHookBusServer } from '../events/npc-hook-bus.server'
import { NpcContextBuilder } from '../context/npc-context-builder'
import type { NpcTransport } from '../transport/npc-transport.interface'
import type { NpcAgent } from './npc-agent'
import type { NpcSkillRegistry } from './npc-skill-registry'

/**
 * Authoritative NPC runtime engine.
 *
 * @remarks
 * Handles planning, constraints, skill execution, waits, and hook/event emission.
 */
export class NpcEngine {
  private readonly contextBuilder = new NpcContextBuilder()

  constructor(
    private readonly skills: NpcSkillRegistry,
    private readonly hooks: NpcHookBusServer,
    private readonly events: NpcEventBusServer,
    private readonly transport: NpcTransport,
  ) {}

  /** Processes one tick for a single NPC agent. */
  async tick(agent: NpcAgent): Promise<void> {
    agent.turnCalls = 0

    const ctx = this.buildCtx(agent)
    if (agent.active) {
      if (this.isWaiting(agent)) {
        return
      }
      if (!agent.active) {
        return
      }
      const { skill, args } = agent.active
      await this.runSkill(agent, skill, args)
      return
    }

    this.hooks.emit('beforePlan', ctx)
    const decision = await agent.planner.decide(ctx, {
      allowSkills: agent.constraints.getAllowlist(),
    })
    this.hooks.emit('afterPlan', ctx, { decision })

    if (decision.type === 'idle') {
      return
    }

    const report = agent.constraints.validate(
      { skill: decision.skill },
      {
        state: agent.state,
        turnCalls: agent.turnCalls,
      },
    )
    if (!report.allowed) {
      this.hooks.emit('decisionRejected', ctx, { decision, report })
      this.events.emit('npc:error', agent.npc.id, { reason: report.reasons.join('; ') }, { scope: 'server' })
      return
    }

    if (this.isSkillCoolingDown(agent, decision.skill)) {
      if (this.shouldReportCooldown(agent, decision.skill)) {
        this.hooks.emit('decisionRejected', ctx, {
          decision,
          report: { allowed: false, reasons: [`skill '${decision.skill}' in cooldown`] },
        })
      }
      return
    }

    const selectedSkill = this.skills.get(decision.skill)
    if (!selectedSkill) {
      this.events.emit('npc:error', agent.npc.id, { error: `skill '${decision.skill}' not found` }, { scope: 'server' })
      return
    }

    if (selectedSkill.validate) {
      const parsed = tryValidate(selectedSkill.validate, decision.args)
      if (!parsed.ok) {
        const validationError = `invalidSkillArgs: ${parsed.error}`
        this.hooks.emit('decisionRejected', ctx, {
          decision,
          report: { allowed: false, reasons: [validationError] },
        })
        this.events.emit('npc:error', agent.npc.id, { skill: decision.skill, error: validationError }, { scope: 'server' })
        this.markSkillCooldown(agent, decision.skill, this.resolveCooldownMs(validationError))
        return
      }
    }

    await this.runSkill(agent, decision.skill, decision.args)
  }

  private isWaiting(agent: NpcAgent): boolean {
    const active = agent.active
    if (!active?.wait) return false

    if (active.wait.type === 'ms') {
      const untilTs = active.wait.untilTs ?? (Date.now() + active.wait.value)
      active.wait.untilTs = untilTs
      return Date.now() < untilTs
    }

    if (active.wait.type === 'until') {
      const untilTs = active.wait.untilTs ?? (Date.now() + active.wait.timeoutMs)
      active.wait.untilTs = untilTs

      if (Date.now() >= untilTs) {
        const ctx = this.buildCtx(agent)
        this.hooks.emit('skillError', ctx, { error: `wait '${active.wait.key}' timeout` })
        this.events.emit('npc:error', agent.npc.id, { error: `wait '${active.wait.key}' timeout` }, { scope: 'server' })
        agent.active = undefined
        return false
      }

      return !this.transport.isWaitSatisfied(agent.npc, active.wait.key, {
        get: <T>(k: string) => agent.state.get(k) as T | undefined,
      })
    }

    return false
  }

  private async runSkill(agent: NpcAgent, skillKey: string, args: unknown): Promise<void> {
    const skill = this.skills.get(skillKey)
    if (!skill) {
      this.events.emit('npc:error', agent.npc.id, { error: `skill '${skillKey}' not found` }, { scope: 'server' })
      return
    }

    const ctx = this.buildCtx(agent)
    this.hooks.emit('beforeSkill', ctx, { skill: skillKey, args })
    agent.constraints.holdMutex(skillKey, agent.state)

    try {
      const validated = skill.validate ? skill.validate(args) : args
      const result = await skill.execute(ctx, validated)
      agent.turnCalls += 1
      this.hooks.emit('afterSkill', ctx, { skill: skillKey, result })

      if (!result.ok && !result.wait && !result.retryInMs) {
        this.hooks.emit('skillError', ctx, { skill: skillKey, error: result.error })
        this.events.emit('npc:error', agent.npc.id, { skill: skillKey, error: result.error }, { scope: 'server' })
        this.markSkillCooldown(agent, skillKey, this.resolveCooldownMs(result.error))
        agent.constraints.releaseMutex(skillKey, agent.state)
        agent.active = undefined
        return
      }

      const wait = result.wait ?? (result.ok ? undefined : result.retryInMs ? { type: 'ms' as const, value: result.retryInMs } : undefined)
      if (wait) {
        agent.active = { skill: skillKey, args, wait, next: result.next }
        return
      }

      if (result.next?.type === 'run') {
        agent.active = { skill: result.next.skill, args: result.next.args }
        return
      }

      if (result.next?.type === 'continue') {
        agent.active = { skill: skillKey, args }
        return
      }

      agent.active = undefined
      agent.constraints.releaseMutex(skillKey, agent.state)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.hooks.emit('skillError', ctx, { skill: skillKey, error: message })
      this.events.emit('npc:error', agent.npc.id, { skill: skillKey, error: message }, { scope: 'server' })
      this.markSkillCooldown(agent, skillKey, this.resolveCooldownMs(message))
      agent.constraints.releaseMutex(skillKey, agent.state)
      agent.active = undefined
    }
  }

  private isSkillCoolingDown(agent: NpcAgent, skillKey: string): boolean {
    const until = agent.state.get(`cooldown:${skillKey}`)
    if (typeof until !== 'number') return false
    return Date.now() < until
  }

  private markSkillCooldown(agent: NpcAgent, skillKey: string, ms: number): void {
    agent.state.set(`cooldown:${skillKey}`, Date.now() + ms)
    agent.state.delete(`cooldown:reported:${skillKey}`)
  }

  private shouldReportCooldown(agent: NpcAgent, skillKey: string): boolean {
    const now = Date.now()
    const reportKey = `cooldown:reported:${skillKey}`
    const reportUntil = agent.state.get(reportKey)
    if (typeof reportUntil === 'number' && now < reportUntil) {
      return false
    }

    agent.state.set(reportKey, now + 5_000)
    return true
  }

  private resolveCooldownMs(errorMessage: string): number {
    if (errorMessage.includes('requires connected mode executor')) {
      return 60_000
    }
    if (errorMessage.includes('invalidSkillArgs')) {
      return 10_000
    }
    return 3_000
  }

  private buildCtx(agent: NpcAgent) {
    const snapshot = this.contextBuilder.buildSnapshot(agent.observations)
    return {
      npc: agent.npc,
      goal: agent.goal,
      snapshot,
      memory: agent.memory,
      observations: agent.observations,
      events: {
        emit: (
          name: string,
          payload: unknown,
          opts?: { scope?: 'server' | 'nearby' | 'owner' | 'all'; radius?: number },
        ) => {
          this.events.emit(name, agent.npc.id, payload, opts)
        },
      },
      transport: this.transport,
      state: {
        get: <T>(k: string) => agent.state.get(k) as T | undefined,
        set: (k: string, v: unknown) => {
          agent.state.set(k, v)
        },
      },
    }
  }
}

function tryValidate(
  validate: (input: unknown) => unknown,
  input: unknown,
): { ok: true } | { ok: false; error: string } {
  try {
    validate(input)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
