import type { NpcSpawnOptions, Npcs } from '@open-core/framework/server'
import type { NpcGoal, NpcIdentity, NpcSpawnInput } from '../../shared'
import type { AttachOptions, NpcControllerDefinition } from '../types'
import { IntelligenceEngine } from '../engine/intelligence-engine'

export class NpcApi {
  constructor(
    private readonly npcs: Npcs,
    private readonly engine: IntelligenceEngine,
  ) {}

  async spawn(input: NpcSpawnInput): Promise<NpcIdentity> {
    const options: NpcSpawnOptions = {
      model: input.model,
      position: input.position,
      heading: input.heading,
      networked: input.networked,
      routingBucket: input.routingBucket,
      persistent: input.persistent,
      metadata: input.metadata,
    }

    const { result, npc } = await this.npcs.create(options)
    if (!result.success || !npc) {
      throw new Error(result.error ?? 'Failed to spawn NPC')
    }
    return {
      id: npc.npcId,
      netId: npc.netId,
    }
  }

  destroy(npc: NpcIdentity): void {
    this.engine.detach(npc.id)
    this.npcs.deleteById(npc.id)
  }

  attach(npc: NpcIdentity, options: AttachOptions = {}): void {
    this.engine.attach(npc.id, options, this.controllers)
  }

  detach(npc: NpcIdentity): void {
    this.engine.detach(npc.id)
  }

  setObservation(npc: NpcIdentity, patch: Record<string, unknown>): void {
    this.engine.setObservation(npc.id, patch)
  }

  observe<TObservation extends Record<string, unknown>>(npc: NpcIdentity): NpcObservationHandle<TObservation> {
    return new NpcObservationHandle<TObservation>(this, npc)
  }

  async run(npc: NpcIdentity): Promise<void> {
    await this.engine.runOnce(npc.id)
  }

  memory(npc: NpcIdentity): unknown[] {
    return this.engine.memory(npc.id)
  }

  setControllers(controllers: Map<string, NpcControllerDefinition>): void {
    this.controllers = controllers
  }

  private controllers = new Map<string, NpcControllerDefinition>()
}

export class NpcObservationHandle<TObservation extends Record<string, unknown>> {
  constructor(
    private readonly api: NpcApi,
    private readonly npc: NpcIdentity,
  ) {}

  set(patch: Partial<TObservation> & Record<string, unknown>): this {
    this.api.setObservation(this.npc, patch)
    return this
  }
}

export class NpcAgentHandle {
  constructor(
    private readonly api: NpcApi,
    private readonly npc: NpcIdentity,
  ) {}

  run(): Promise<void> {
    return this.api.run(this.npc)
  }

  memory(): unknown[] {
    return this.api.memory(this.npc)
  }
}

let singleton: NpcApi | undefined

export function setNpcApiSingleton(api: NpcApi): void {
  singleton = api
}

export const Npc = {
  spawn(input: NpcSpawnInput) {
    return requireSingleton().spawn(input)
  },
  destroy(npc: NpcIdentity) {
    return requireSingleton().destroy(npc)
  },
  attach(npc: NpcIdentity, options?: AttachOptions) {
    return requireSingleton().attach(npc, options)
  },
  detach(npc: NpcIdentity) {
    return requireSingleton().detach(npc)
  },
  observe<TObservation extends Record<string, unknown>>(npc: NpcIdentity) {
    return requireSingleton().observe<TObservation>(npc)
  },
  setObservation(npc: NpcIdentity, patch: Record<string, unknown>) {
    return requireSingleton().setObservation(npc, patch)
  },
  run(npc: NpcIdentity) {
    return requireSingleton().run(npc)
  },
  memory(npc: NpcIdentity) {
    return requireSingleton().memory(npc)
  },
  agent(npc: NpcIdentity) {
    return new NpcAgentHandle(requireSingleton(), npc)
  },
}

function requireSingleton(): NpcApi {
  if (!singleton) {
    throw new Error('NpcApi not initialized. Did you install npcIntelligencePlugin()?')
  }
  return singleton
}

export type { NpcGoal }
