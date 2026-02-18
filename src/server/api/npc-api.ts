import type { NpcGoal, NpcIdentity, NpcSpawnInput } from '../../shared/contracts/npc-types'
import type { NpcPlanner } from '../runtime/planner/npc-planner.interface'
import { NpcRulePlanner } from '../runtime/planner/npc-rule-planner'
import { NpcAgentBuilder } from '../runtime/engine/npc-agent-builder'
import type { NpcAgent } from '../runtime/engine/npc-agent'
import { NpcEngine } from '../runtime/engine/npc-engine'
import type { NpcConstraints } from '../runtime/constraints/npc-constraints'
import { NpcEntityService } from '../runtime/entities/npc-entity.service'
import { NpcRuntimeService } from '../runtime/runtime/npc-runtime.service'
import { NpcControllerRuntime } from '../runtime/controllers/npc-controller.runtime'
import { skillRef } from '../contracts/npc-skill-ref.types'

export class NpcApi {
  private readonly agents = new Map<string, NpcAgent>()

  constructor(
    private readonly engine: NpcEngine,
    private readonly entities: NpcEntityService,
    private readonly runtime: NpcRuntimeService,
    private readonly controllers: NpcControllerRuntime,
  ) { }

  /** Creates a physical NPC entity and returns its identity. */
  async spawn(input: NpcSpawnInput): Promise<NpcIdentity> {
    return this.entities.spawn(input)
  }

  /** Destroys a physical NPC entity and unregisters runtime state. */
  destroy(npc: NpcIdentity): void {
    this.runtime.unregister(npc.id)
    this.agents.delete(npc.id)
    this.entities.despawn(npc.id)
  }

  /** Attaches an NPC to the engine by creating an agent instance. */
  attach(
    npc: NpcIdentity,
    options: {
      group?: string
      planner?: NpcPlanner
      goal?: NpcGoal
      tickMs?: number
      configureConstraints?: (constraints: NpcConstraints) => NpcConstraints
    } = {},
  ): NpcAgent {
    if (!this.entities.exists(npc.id)) {
      throw new Error(`NPC '${npc.id}' does not exist. Spawn it before attach.`)
    }

    this.controllers.initialize()
    const group = options.group
    const controllerDef = group ? this.controllers.getByGroup(group) : undefined

    const planner = options.planner ?? controllerDef?.planner ?? new NpcRulePlanner()
    const goal = options.goal ?? { id: group ?? 'default' }
    const configureConstraints =
      options.configureConstraints ??
      controllerDef?.configureConstraints ??
      ((constraints: NpcConstraints) => constraints)

    const agent = new NpcAgentBuilder(npc, goal, planner).withConstraints(configureConstraints).build()

    if (controllerDef?.allowSkills?.length) {
      agent.constraints.allow(...controllerDef.allowSkills.map((skill) => skillRef(skill)))
    }

    this.agents.set(npc.id, agent)
    this.runtime.register(agent, options.tickMs ?? controllerDef?.tickMs)
    return agent
  }

  /** Detaches an NPC from runtime scheduling and orchestration. */
  detach(npc: NpcIdentity): void {
    this.runtime.unregister(npc.id)
    this.agents.delete(npc.id)
  }

  /** Merges observation data into an attached NPC agent. */
  setObservation<TObservation extends Record<string, unknown>>(
    npc: NpcIdentity,
    patch: Partial<TObservation> & Record<string, unknown>,
  ): void {
    const agent = this.requireAgent(npc.id)
    agent.observations = { ...agent.observations, ...patch }

    for (const [key, value] of Object.entries(patch)) {
      agent.state.set(`obs.${key}`, value)
    }
  }

  /** Creates a fluent observation handle for one NPC. */
  observe<TObservation extends Record<string, unknown>>(npc: NpcIdentity): NpcObservationHandle<TObservation> {
    return new NpcObservationHandle<TObservation>(this, npc)
  }

  /** Creates a fluent runtime handle for one NPC agent. */
  agent(npc: NpcIdentity): NpcAgentHandle {
    return new NpcAgentHandle(this, npc)
  }

  /** Returns a previously attached agent, if available. */
  getAgent(npcId: string): NpcAgent | undefined {
    return this.agents.get(npcId)
  }

  /** Executes one engine tick for the provided NPC. */
  async run(npc: NpcIdentity): Promise<void> {
    const agent = this.requireAgent(npc.id)
    await this.engine.tick(agent)
  }

  /** Returns the in-memory memory array for an NPC. */
  memory(npc: NpcIdentity): unknown[] {
    return this.requireAgent(npc.id).memory
  }

  private requireAgent(npcId: string): NpcAgent {
    const agent = this.agents.get(npcId)
    if (!agent) {
      throw new Error(`NPC '${npcId}' is not attached`)
    }
    return agent
  }
}

export class NpcObservationHandle<TObservation extends Record<string, unknown>> {
  constructor(
    private readonly api: NpcApi,
    private readonly npc: NpcIdentity,
  ) { }

  set(patch: Partial<TObservation> & Record<string, unknown>): this {
    this.api.setObservation<TObservation>(this.npc, patch)
    return this
  }
}

export class NpcAgentHandle {
  constructor(
    private readonly api: NpcApi,
    private readonly npc: NpcIdentity,
  ) { }

  run(): Promise<void> {
    return this.api.run(this.npc)
  }

  memory(): unknown[] {
    return this.api.memory(this.npc)
  }

  raw(): NpcAgent | undefined {
    return this.api.getAgent(this.npc.id)
  }
}

let singleton: NpcApi | undefined

export function setNpcApiSingleton(api: NpcApi): void {
  singleton = api
}

export const Npc = {
  /** Spawns an NPC using the installed singleton API. */
  spawn(input: NpcSpawnInput) {
    return requireSingleton().spawn(input)
  },
  /** Destroys an NPC and clears runtime state. */
  destroy(npc: NpcIdentity) {
    return requireSingleton().destroy(npc)
  },
  /** Attaches an NPC to a planner/controller pipeline. */
  attach(npc: NpcIdentity, options?: Parameters<NpcApi['attach']>[1]) {
    return requireSingleton().attach(npc, options)
  },
  /** Detaches an NPC from runtime scheduling. */
  detach(npc: NpcIdentity) {
    return requireSingleton().detach(npc)
  },
  /** Fluent observation API. */
  observe<TObservation extends Record<string, unknown>>(npc: NpcIdentity) {
    return requireSingleton().observe<TObservation>(npc)
  },
  /** Applies an observation patch to one NPC. */
  setObservation(npc: NpcIdentity, patch: Record<string, unknown>) {
    return requireSingleton().setObservation(npc, patch)
  },
  /** Fluent agent API. */
  agent(npc: NpcIdentity) {
    return requireSingleton().agent(npc)
  },
  /** Runs one tick for one NPC. */
  run(npc: NpcIdentity) {
    return requireSingleton().run(npc)
  },
  /** Reads current memory entries for one NPC. */
  memory(npc: NpcIdentity) {
    return requireSingleton().memory(npc)
  },
  /** Returns the attached agent for debugging and tests. */
  getAgent(npcId: string) {
    return requireSingleton().getAgent(npcId)
  },
}

function requireSingleton(): NpcApi {
  if (!singleton) {
    throw new Error('NpcApi not initialized. Did you install npcPlugin()?')
  }
  return singleton
}
