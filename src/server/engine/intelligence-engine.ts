import type { NPC, Npcs } from '@open-core/framework/server'
import type { NpcGoal } from '../../shared'
import type {
  AttachOptions,
  NpcContext,
  NpcIntelligenceDebugConfig,
  NpcPlanner,
  ResolvedNpcControllerDefinition,
  RunResult,
  SkillDecision,
} from '../types'
import { NpcRulePlanner } from '../ai/rule-planner'
import { skillKeyOf } from '../decorators/npc-skill.decorator'
import { NpcSkillRegistry } from '../skills/skill-registry'

type Agent = {
  npcId: string
  planner: NpcPlanner
  goal: NpcGoal
  name?: string
  npcType?: string
  skillKeys: string[]
  denySkillKeys: string[]
  observations: Record<string, unknown>
  memory: unknown[]
  state: Map<string, unknown>
  tickMs: number
  nextTickAt: number
}

export class IntelligenceEngine {
  private readonly agents = new Map<string, Agent>()
  private timer: ReturnType<typeof setInterval> | undefined
  private debug: NpcIntelligenceDebugConfig = {}

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

  setDebug(debug: NpcIntelligenceDebugConfig | undefined): void {
    this.debug = debug ?? {}
  }

  attach(
    npcId: string,
    options: AttachOptions,
    controllers: Map<string, ResolvedNpcControllerDefinition>,
  ): void {
    const controller = options.controllerId ? controllers.get(options.controllerId) : undefined
    const planner = options.planner ?? toPlanner(controller?.planner)
    const goal = options.goal ?? { id: controller?.id ?? 'default' }
    const skillKeys = options.skills?.map((item) => skillKeyOf(item)) ?? controller?.skills ?? this.skills.keys()
    const denySkillKeys = options.denySkills?.map((item) => skillKeyOf(item)) ?? []
    const name = options.name ?? controller?.name ?? controller?.id
    const npcType = options.npcType ?? controller?.npcType

    this.agents.set(npcId, {
      npcId,
      planner,
      goal,
      name,
      npcType,
      skillKeys,
      denySkillKeys,
      observations: {},
      memory: [],
      state: new Map<string, unknown>(),
      tickMs: options.tickMs ?? controller?.tickMs ?? 500,
      nextTickAt: Date.now(),
    })

    this.logRuntime(
      `attach npc=${npcId} goal=${goal.id} skills=${skillKeys.join(',')} deny=${denySkillKeys.join(',')}`,
    )
  }

  hasAgent(npcId: string): boolean {
    return this.agents.has(npcId)
  }

  detach(npcId: string): void {
    this.agents.delete(npcId)
    this.logRuntime(`detach npc=${npcId}`)
  }

  setGoal(npcId: string, goal: NpcGoal): void {
    const agent = this.requireAgent(npcId)
    agent.goal = goal
    this.logRuntime(`goal npc=${npcId} goal=${goal.id}`)
  }

  setProfile(npcId: string, profile: { name?: string; npcType?: string }): void {
    const agent = this.requireAgent(npcId)
    if (profile.name) {
      agent.name = profile.name
    }
    if (profile.npcType) {
      agent.npcType = profile.npcType
    }
    this.logRuntime(`profile npc=${npcId} name=${agent.name ?? '-'} type=${agent.npcType ?? '-'}`)
  }

  setObservation(npcId: string, patch: Record<string, unknown>): void {
    const agent = this.requireAgent(npcId)
    agent.observations = { ...agent.observations, ...patch }
    this.logRuntime(`observe npc=${npcId} patch=${JSON.stringify(patch)}`)
  }

  memory(npcId: string): unknown[] {
    return this.requireAgent(npcId).memory
  }

  getAgentIds(): string[] {
    return Array.from(this.agents.keys())
  }

  async runOnce(
    npcId: string,
    override?: {
      forcedDecision?: SkillDecision
      denySkillKeys?: string[]
    },
  ): Promise<RunResult> {
    const agent = this.requireAgent(npcId)
    return this.tickAgent(agent, override)
  }

  private async tickDue(): Promise<void> {
    const now = Date.now()
    for (const agent of this.agents.values()) {
      if (agent.nextTickAt > now) continue
      await this.tickAgent(agent)
    }
  }

  private async tickAgent(
    agent: Agent,
    override?: {
      forcedDecision?: SkillDecision
      denySkillKeys?: string[]
    },
  ): Promise<RunResult> {
    const npc = this.npcs.getById(agent.npcId)
    if (!npc || !npc.exists) {
      this.agents.delete(agent.npcId)
      return {
        ok: false,
        done: true,
        error: `NPC '${agent.npcId}' does not exist`,
      }
    }

    const ctx = buildContext(this.npcs, npc, agent)
    const deny = new Set<string>([...agent.denySkillKeys, ...(override?.denySkillKeys ?? [])])
    const effectiveSkills = agent.skillKeys.filter((skill) => !deny.has(skill))
    const decision = override?.forcedDecision ?? (await agent.planner.decide(ctx, effectiveSkills))
    this.logRuntime(
      `decide npc=${agent.npcId} decision=${decision ? decision.skill : 'none'} allowed=${effectiveSkills.join(',')}`,
    )

    if (!decision) {
      agent.nextTickAt = Date.now() + agent.tickMs
      return {
        ok: true,
        done: false,
        waitMs: agent.tickMs,
      }
    }

    if (!effectiveSkills.includes(decision.skill)) {
      agent.memory.push({ at: Date.now(), error: `Skill '${decision.skill}' is not allowed` })
      this.logRuntime(`reject npc=${agent.npcId} skill=${decision.skill} reason=not-allowed`)
      agent.nextTickAt = Date.now() + agent.tickMs
      return {
        ok: false,
        done: true,
        skill: decision.skill,
        error: `Skill '${decision.skill}' is not allowed`,
      }
    }

    const skill = this.skills.get(decision.skill)
    if (!skill) {
      agent.memory.push({ at: Date.now(), error: `Skill '${decision.skill}' not found` })
      this.logRuntime(`reject npc=${agent.npcId} skill=${decision.skill} reason=missing-skill`)
      agent.nextTickAt = Date.now() + agent.tickMs
      return {
        ok: false,
        done: true,
        skill: decision.skill,
        error: `Skill '${decision.skill}' not found`,
      }
    }

    const result = await skill.execute(ctx, decision.args)
    this.logRuntime(
      `execute npc=${agent.npcId} skill=${decision.skill} ok=${result.ok} waitMs=${result.waitMs ?? decision.waitMs ?? agent.tickMs}`,
    )
    if (result.memory !== undefined) {
      agent.memory.push(result.memory)
    } else if (result.error) {
      agent.memory.push({ at: Date.now(), error: result.error })
    }

    const waitMs = result.waitMs ?? decision.waitMs ?? agent.tickMs
    agent.nextTickAt = Date.now() + Math.max(0, waitMs)

    return {
      ok: result.ok,
      done: !result.waitMs,
      skill: decision.skill,
      waitMs,
      memory: result.memory,
      error: result.error,
    }
  }

  private requireAgent(npcId: string): Agent {
    const agent = this.agents.get(npcId)
    if (!agent) {
      throw new Error(`NPC '${npcId}' is not attached`)
    }
    return agent
  }

  private logRuntime(message: string): void {
    if (!(this.debug.enabled && this.debug.runtime)) return
    console.log(`[npc-intelligence][runtime] ${message}`)
  }
}

function toPlanner(planner: NpcPlanner | undefined): NpcPlanner {
  return planner ?? new NpcRulePlanner()
}

function buildContext(_npcs: Npcs, npcEntity: NPC, agent: Agent): NpcContext {
  const ctx: NpcContext = {
    npc: npcEntity,
    name: agent.name,
    npcType: agent.npcType,
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
  }
  return ctx
}
