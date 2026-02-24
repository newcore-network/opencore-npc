import type { NPC, Npcs } from '@open-core/framework/server'
import type { NpcGoal } from '../../shared'
import type { AttachOptions, NpcContext, NpcControllerDefinition, NpcPlanner } from '../types'
import { NpcRulePlanner } from '../ai/rule-planner'
import { NpcSkillRegistry } from '../skills/skill-registry'

type Agent = {
  npcId: string
  planner: NpcPlanner
  goal: NpcGoal
  allowSkills: string[]
  observations: Record<string, unknown>
  memory: unknown[]
  state: Map<string, unknown>
  tickMs: number
  nextTickAt: number
}

export class IntelligenceEngine {
  private readonly agents = new Map<string, Agent>()
  private timer: ReturnType<typeof setInterval> | undefined

  constructor(
    private readonly npcs: Npcs,
    private readonly skills: NpcSkillRegistry,
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.tickDue()
    }, 100)
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = undefined
  }

  attach(
    npcId: string,
    options: AttachOptions,
    controllers: Map<string, NpcControllerDefinition>,
  ): void {
    const controller = options.controllerId ? controllers.get(options.controllerId) : undefined
    const planner = options.planner ?? toPlanner(controller?.planner)
    const goal = options.goal ?? { id: controller?.id ?? 'default' }
    const allowSkills = options.allowSkills ?? controller?.skills ?? this.skills.keys()

    this.agents.set(npcId, {
      npcId,
      planner,
      goal,
      allowSkills,
      observations: {},
      memory: [],
      state: new Map<string, unknown>(),
      tickMs: options.tickMs ?? controller?.tickMs ?? 500,
      nextTickAt: Date.now(),
    })
  }

  detach(npcId: string): void {
    this.agents.delete(npcId)
  }

  setObservation(npcId: string, patch: Record<string, unknown>): void {
    const agent = this.requireAgent(npcId)
    agent.observations = { ...agent.observations, ...patch }
  }

  memory(npcId: string): unknown[] {
    return this.requireAgent(npcId).memory
  }

  getAgentIds(): string[] {
    return Array.from(this.agents.keys())
  }

  async runOnce(npcId: string): Promise<void> {
    const agent = this.requireAgent(npcId)
    await this.tickAgent(agent)
  }

  private async tickDue(): Promise<void> {
    const now = Date.now()
    for (const agent of this.agents.values()) {
      if (agent.nextTickAt > now) continue
      await this.tickAgent(agent)
    }
  }

  private async tickAgent(agent: Agent): Promise<void> {
    const npc = this.npcs.getById(agent.npcId)
    if (!npc || !npc.exists) {
      this.agents.delete(agent.npcId)
      return
    }

    const ctx = buildContext(this.npcs, npc, agent)
    const decision = await agent.planner.decide(ctx)

    if (!decision) {
      agent.nextTickAt = Date.now() + agent.tickMs
      return
    }

    if (!agent.allowSkills.includes(decision.skill)) {
      agent.memory.push({ at: Date.now(), error: `Skill '${decision.skill}' is not allowed` })
      agent.nextTickAt = Date.now() + agent.tickMs
      return
    }

    const skill = this.skills.get(decision.skill)
    if (!skill) {
      agent.memory.push({ at: Date.now(), error: `Skill '${decision.skill}' not found` })
      agent.nextTickAt = Date.now() + agent.tickMs
      return
    }

    const result = await skill.execute(ctx, decision.args)
    if (result.memory !== undefined) {
      agent.memory.push(result.memory)
    } else if (result.error) {
      agent.memory.push({ at: Date.now(), error: result.error })
    }

    const waitMs = result.waitMs ?? decision.waitMs ?? agent.tickMs
    agent.nextTickAt = Date.now() + Math.max(0, waitMs)
  }

  private requireAgent(npcId: string): Agent {
    const agent = this.agents.get(npcId)
    if (!agent) {
      throw new Error(`NPC '${npcId}' is not attached`)
    }
    return agent
  }
}

function toPlanner(
  planner: NpcControllerDefinition['planner'] | undefined,
): NpcPlanner {
  if (!planner || planner === 'rule' || planner === 'ai') {
    return new NpcRulePlanner()
  }
  return planner
}

function buildContext(npcs: Npcs, npcEntity: NPC, agent: Agent): NpcContext {
  const ctx: NpcContext = {
    npc: { id: agent.npcId, netId: npcEntity.netId },
    npcEntity,
    npcs,
    goal: agent.goal,
    setGoal(goal) {
      agent.goal = typeof goal === 'string' ? { id: goal } : goal
      ctx.goal = agent.goal
    },
    observations: agent.observations,
    memory: agent.memory,
    state: {
      get<T>(key: string): T | undefined {
        return agent.state.get(key) as T | undefined
      },
      set(key: string, value: unknown): void {
        agent.state.set(key, value)
      },
    },
    allowSkills: agent.allowSkills,
    emit(eventName: string, payload?: unknown): void {
      npcEntity.setSyncedState(`npc:event:${eventName}`, payload)
    },
  }
  return ctx
}
