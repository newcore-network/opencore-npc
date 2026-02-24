import type { NpcSpawnOptions, Npcs } from '@open-core/framework/server'
import type { NpcGoal, NpcIdentity, NpcSpawnInput } from '../../shared'
import type { AttachOptions, ResolvedNpcControllerDefinition } from '../types'
import { IntelligenceEngine } from '../engine/intelligence-engine'

/** Public server API for NPC intelligence orchestration. */
export class IntelligentNpcAPI {
  constructor(
    private readonly npcs: Npcs,
    private readonly engine: IntelligenceEngine,
  ) { }

  /** Spawns an NPC through framework core and returns its identity. */
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

  /** Destroys an NPC and detaches its intelligence runtime. */
  destroy(npc: NpcIdentity): void {
    this.engine.detach(npc.id)
    this.npcs.deleteById(npc.id)
  }

  /** Attaches intelligence runtime to an existing NPC. */
  attach(npc: NpcIdentity, options: AttachOptions = {}): void {
    this.engine.attach(npc.id, options, this.controllers)
  }

  /** Detaches intelligence runtime from an NPC. */
  detach(npc: NpcIdentity): void {
    this.engine.detach(npc.id)
  }

  /** Merges an observation patch for planner input. */
  setObservation(npc: NpcIdentity, patch: Record<string, unknown>): void {
    this.engine.setObservation(npc.id, patch)
  }

  /** Creates a fluent observation handle for one NPC. */
  observe<TObservation extends Record<string, unknown>>(npc: NpcIdentity): NpcObservationHandle<TObservation> {
    return new NpcObservationHandle<TObservation>(this, npc)
  }

  /** Runs a single intelligence tick for one NPC. */
  async run(npc: NpcIdentity): Promise<void> {
    await this.engine.runOnce(npc.id)
  }

  /** Returns runtime memory entries for one NPC. */
  memory(npc: NpcIdentity): unknown[] {
    return this.engine.memory(npc.id)
  }

  /** Creates a fluent runtime handle for one NPC agent. */
  agent(npc: NpcIdentity): NpcAgentHandle {
    return new NpcAgentHandle(this, npc)
  }

  /** Internal setter used by plugin bootstrap to provide controller registry. */
  setControllers(controllers: Map<string, ResolvedNpcControllerDefinition>): void {
    this.controllers = controllers
  }

  private controllers = new Map<string, ResolvedNpcControllerDefinition>()
}

export class NpcObservationHandle<TObservation extends Record<string, unknown>> {
  constructor(
    private readonly api: IntelligentNpcAPI,
    private readonly npc: NpcIdentity,
  ) { }

  set(patch: Partial<TObservation> & Record<string, unknown>): this {
    this.api.setObservation(this.npc, patch)
    return this
  }
}

export class NpcAgentHandle {
  constructor(
    private readonly api: IntelligentNpcAPI,
    private readonly npc: NpcIdentity,
  ) { }

  run(): Promise<void> {
    return this.api.run(this.npc)
  }

  memory(): unknown[] {
    return this.api.memory(this.npc)
  }
}

export type { NpcGoal }

/** Injectable alias name for the intelligence service. */
export { IntelligentNpcAPI as NpcIntelligence }
