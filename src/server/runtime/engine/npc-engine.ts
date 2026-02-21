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
  private readonly cooldownByNpc = new Map<string, Map<string, number>>()
  private readonly cooldownReportByNpc = new Map<string, Map<string, number>>()

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

    const allowSkills = agent.constraints.getAllowlist()
    if (this.areAllAllowedSkillsInCooldown(agent, allowSkills)) {
      if (this.shouldReportCooldown(agent, '__all__')) {
        this.hooks.emit('decisionRejected', ctx, {
          decision: { type: 'skill', skill: allowSkills.join(','), args: {} },
          report: { allowed: false, reasons: ['all allowed skills are in cooldown'] },
        })
      }
      return
    }

    this.hooks.emit('beforePlan', ctx)
    const decision = await agent.planner.decide(ctx, {
      allowSkills,
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
      this.events.emit('npc:error', agent.npc.id, { reason: report.reasons.join('; ') }, { scope: 'server', controllerId: agent.controllerId }, ctx)
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
      this.events.emit('npc:error', agent.npc.id, { error: `skill '${decision.skill}' not found` }, { scope: 'server', controllerId: agent.controllerId }, ctx)
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
        this.events.emit('npc:error', agent.npc.id, { skill: decision.skill, error: validationError }, { scope: 'server', controllerId: agent.controllerId }, ctx)
        this.markSkillCooldown(agent, decision.skill, 10_000)
        agent.state.set('ai:disable', true)
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
        this.events.emit('npc:error', agent.npc.id, { error: `wait '${active.wait.key}' timeout` }, { scope: 'server', controllerId: agent.controllerId }, ctx)
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
      this.events.emit('npc:error', agent.npc.id, { error: `skill '${skillKey}' not found` }, { scope: 'server', controllerId: agent.controllerId }, this.buildCtx(agent))
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
        this.events.emit('npc:error', agent.npc.id, { skill: skillKey, error: result.error }, { scope: 'server', controllerId: agent.controllerId }, ctx)
        this.markSkillCooldown(agent, skillKey, result.cooldownPenaltyMs ?? 3_000)
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
      this.events.emit('npc:error', agent.npc.id, { skill: skillKey, error: message }, { scope: 'server', controllerId: agent.controllerId }, ctx)
      this.markSkillCooldown(agent, skillKey, 3_000)
      agent.constraints.releaseMutex(skillKey, agent.state)
      agent.active = undefined
    }
  }

  private isSkillCoolingDown(agent: NpcAgent, skillKey: string): boolean {
    const until = this.cooldownByNpc.get(agent.npc.id)?.get(skillKey)
    if (typeof until !== 'number') return false
    return Date.now() < until
  }

  private markSkillCooldown(agent: NpcAgent, skillKey: string, ms: number): void {
    const now = Date.now()
    const bySkill = this.cooldownByNpc.get(agent.npc.id) ?? new Map<string, number>()
    bySkill.set(skillKey, now + ms)
    this.cooldownByNpc.set(agent.npc.id, bySkill)

    const reported = this.cooldownReportByNpc.get(agent.npc.id)
    if (reported) {
      reported.delete(skillKey)
    }
  }

  private shouldReportCooldown(agent: NpcAgent, skillKey: string): boolean {
    const now = Date.now()
    const bySkill = this.cooldownReportByNpc.get(agent.npc.id) ?? new Map<string, number>()
    const reportUntil = bySkill.get(skillKey)
    if (typeof reportUntil === 'number' && now < reportUntil) {
      return false
    }

    const windowMs = skillKey === '__all__' ? 180_000 : 5_000
    bySkill.set(skillKey, now + windowMs)
    this.cooldownReportByNpc.set(agent.npc.id, bySkill)
    return true
  }

  private areAllAllowedSkillsInCooldown(agent: NpcAgent, skills: string[]): boolean {
    if (skills.length === 0) return false
    return skills.every((skill) => this.isSkillCoolingDown(agent, skill))
  }

  private buildCtx(agent: NpcAgent) {
    const snapshot = this.contextBuilder.buildSnapshot(agent.observations)
    return {
      npc: agent.npc,
      controllerId: agent.controllerId,
      goal: agent.goal,
      setGoal: (goal: string | { id: string; hint?: string }) => {
        if (typeof goal === 'string') {
          agent.goal = { ...agent.goal, hint: goal }
          return
        }
        agent.goal = goal
      },
      snapshot,
      memory: agent.memory,
      observations: agent.observations,
      events: {
        emit: (
          name: string,
          payload: unknown,
          opts?: { scope?: 'server' | 'nearby' | 'owner' | 'all'; radius?: number },
        ) => {
          this.events.emit(name, agent.npc.id, payload, { ...opts, controllerId: agent.controllerId }, {
            npc: agent.npc,
            controllerId: agent.controllerId,
            goal: agent.goal,
            setGoal: (goal: string | { id: string; hint?: string }) => {
              if (typeof goal === 'string') {
                agent.goal = { ...agent.goal, hint: goal }
                return
              }
              agent.goal = goal
            },
            snapshot,
            memory: agent.memory,
            observations: agent.observations,
            events: {
              emit: (eventName: string, eventPayload: unknown, eventOpts?: { scope?: 'server' | 'nearby' | 'owner' | 'all'; radius?: number }) => {
                this.events.emit(eventName, agent.npc.id, eventPayload, { ...eventOpts, controllerId: agent.controllerId })
              },
            },
            transport: this.transport,
            state: {
              get: <T>(k: string) => agent.state.get(k) as T | undefined,
              set: (k: string, v: unknown) => {
                agent.state.set(k, v)
              },
            },
          })
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
