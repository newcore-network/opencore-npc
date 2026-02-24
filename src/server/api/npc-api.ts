import type { NPC, NpcSpawnOptions, Npcs } from '@open-core/framework/server'
import type { NpcGoal, NpcSpawnInput } from '../../shared'
import type {
  AttachOptions,
  NpcContext,
  NpcSkillClass,
  ResolvedNpcControllerDefinition,
  RunResult,
  SkillArgs,
} from '../types'
import { skillKeyOf } from '../decorators/npc-skill.decorator'
import { IntelligenceEngine } from '../engine/intelligence-engine'

/** Public server API for NPC intelligence orchestration. */
export class IntelligentNpcAPI {
  constructor(
    private readonly npcs: Npcs,
    private readonly engine: IntelligenceEngine,
  ) { }

  /** Spawns an NPC through framework core and returns the NPC entity. */
  async spawn(input: NpcSpawnInput): Promise<NPC> {
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
    return npc
  }

  /** Destroys an NPC and detaches its intelligence runtime. */
  destroy(npc: NPC): void {
    this.engine.detach(npc.npcId)
    this.npcs.deleteById(npc.npcId)
  }

  /** Attaches intelligence runtime to an existing NPC. */
  attach(npc: NPC, options: AttachOptions = {}): void {
    this.engine.attach(npc.npcId, options, this.controllers)
  }

  /** Detaches intelligence runtime from an NPC. */
  detach(npc: NPC): void {
    this.engine.detach(npc.npcId)
  }

  /** Merges an observation patch for planner input. */
  setObservation(npc: NPC, patch: Record<string, unknown>): void {
    this.engine.setObservation(npc.npcId, patch)
  }

  /** Creates a fluent observation handle for one NPC. */
  observe<TObservation extends Record<string, unknown>>(npc: NPC): NpcObservationHandle<TObservation> {
    return new NpcObservationHandle<TObservation>(this, npc)
  }

  /** Runs a single intelligence tick for one NPC. */
  async run(npc: NPC): Promise<RunResult> {
    return this.engine.runOnce(npc.npcId)
  }

  /** Returns whether an NPC currently has an attached intelligence agent. */
  hasAttached(npc: NPC): boolean {
    return this.engine.hasAgent(npc.npcId)
  }

  /** Updates goal for an already attached agent. */
  setGoal(npc: NPC, goal: NpcGoal): void {
    this.engine.setGoal(npc.npcId, goal)
  }

  /** Updates runtime profile labels for an already attached agent. */
  setProfile(npc: NPC, profile: { name?: string; npcType?: string }): void {
    this.engine.setProfile(npc.npcId, profile)
  }

  /** Runs one forced skill decision, bypassing planner selection. */
  async runForced(
    npc: NPC,
    forcedDecision: { skill: string; args?: unknown },
    denySkillKeys: string[] = [],
  ): Promise<RunResult> {
    return this.engine.runOnce(npc.npcId, {
      forcedDecision,
      denySkillKeys,
    })
  }

  /** Runs one planner-driven tick with temporary denied skills. */
  async runWithDeny(npc: NPC, denySkillKeys: string[] = []): Promise<RunResult> {
    return this.engine.runOnce(npc.npcId, { denySkillKeys })
  }

  /** Returns runtime memory entries for one NPC. */
  memory(npc: NPC): unknown[] {
    return this.engine.memory(npc.npcId)
  }

  /** Creates a fluent runtime handle for one NPC agent. */
  agent(npc: NPC): NpcAgentHandle {
    return new NpcAgentHandle(this, npc)
  }

  /** Creates a typed rule runner for one controller. */
  rule(controllerId: string): RuleControllerBuilder {
    return new RuleControllerBuilder(this, controllerId)
  }

  /** Creates an AI context builder for one controller. */
  ai(controllerId: string): AiControllerBuilder {
    return new AiControllerBuilder(this, controllerId)
  }

  /** Returns the derived key for a skill class. */
  skillKey<TSkill extends NpcSkillClass>(skillClass: TSkill): string {
    return skillKeyOf(skillClass)
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
    private readonly npc: NPC,
  ) { }

  set(patch: Partial<TObservation> & Record<string, unknown>): this {
    this.api.setObservation(this.npc, patch)
    return this
  }
}

export class NpcAgentHandle {
  constructor(
    private readonly api: IntelligentNpcAPI,
    private readonly npc: NPC,
  ) { }

  run(): Promise<RunResult> {
    return this.api.run(this.npc)
  }

  memory(): unknown[] {
    return this.api.memory(this.npc)
  }
}

/**
 * Builder used to run deterministic, typed skills for one controller.
 *
 * @remarks
 * This mode is ideal for rule-driven gameplay where the programmer chooses
 * the exact skill and arguments to execute.
 */
export class RuleControllerBuilder {
  constructor(
    private readonly api: IntelligentNpcAPI,
    private readonly controllerId: string,
  ) {}

  /** Binds the builder to one NPC and returns a mutable run pipeline. */
  for(npc: NPC): RuleRunBuilder {
    return new RuleRunBuilder(this.api, this.controllerId, npc)
  }
}

/**
 * Mutable pipeline for deterministic skill execution.
 *
 * @remarks
 * Use `do(...)` to queue skills, and `run()` or `runAll()` to execute.
 */
export class RuleRunBuilder {
  private readonly queue: Array<{ skill: string; args: unknown }> = []
  private readonly deniedSkillKeys = new Set<string>()
  private profileName: string | undefined
  private profileType: string | undefined

  constructor(
    private readonly api: IntelligentNpcAPI,
    private readonly controllerId: string,
    private readonly npc: NPC,
  ) {}

  /** Sets a friendly runtime name for this NPC profile. */
  name(value: string): this {
    this.profileName = value
    return this
  }

  /** Sets a logical NPC type for this profile (e.g. guard, driver). */
  npcType(value: string): this {
    this.profileType = value
    return this
  }

  /** Denies one skill class for this run sequence. */
  denySkill<TSkill extends NpcSkillClass>(skillClass: TSkill): this {
    this.deniedSkillKeys.add(this.api.skillKey(skillClass))
    return this
  }

  /** Alias of {@link denySkill}. */
  deny<TSkill extends NpcSkillClass>(skillClass: TSkill): this {
    return this.denySkill(skillClass)
  }

  /** Queues one typed skill call. */
  doSkill<TSkill extends NpcSkillClass>(skillClass: TSkill, args: SkillArgs<TSkill>): this {
    this.queue.push({
      skill: this.api.skillKey(skillClass),
      args,
    })
    return this
  }

  /** Alias of {@link doSkill}. */
  do<TSkill extends NpcSkillClass>(skillClass: TSkill, args: SkillArgs<TSkill>): this {
    return this.doSkill(skillClass, args)
  }

  /** Queues one raw skill key call for advanced scenarios. */
  skillKey(skill: string, args?: unknown): this {
    this.queue.push({ skill, args })
    return this
  }

  /** Executes the first queued skill and returns its run result. */
  async run(): Promise<RunResult> {
    const next = this.queue.shift()
    if (!next) {
      return {
        ok: false,
        done: true,
        error: 'No queued skill to run',
      }
    }

    this.ensureAttached()
    return this.api.runForced(
      this.npc,
      {
        skill: next.skill,
        args: next.args,
      },
      Array.from(this.deniedSkillKeys),
    )
  }

  /** Executes all queued skills sequentially and returns each result. */
  async runAll(): Promise<RunResult[]> {
    const results: RunResult[] = []
    while (this.queue.length > 0) {
      const result = await this.run()
      results.push(result)
      if (!result.ok) {
        break
      }
    }
    return results
  }

  private ensureAttached(): void {
    if (!this.api.hasAttached(this.npc)) {
      this.api.attach(this.npc, {
        controllerId: this.controllerId,
        name: this.profileName,
        npcType: this.profileType,
      })
      return
    }

    if (this.profileName || this.profileType) {
      this.api.setProfile(this.npc, {
        name: this.profileName,
        npcType: this.profileType,
      })
    }
  }
}

/** Builder used to compose context-rich AI runs for one controller. */
export class AiControllerBuilder {
  constructor(
    private readonly api: IntelligentNpcAPI,
    private readonly controllerId: string,
  ) {}

  /** Binds this AI builder to one NPC. */
  for(npc: NPC): AiRunBuilder {
    return new AiRunBuilder(this.api, this.controllerId, npc)
  }
}

/** Mutable builder for AI context enrichment before `run()`. */
export class AiRunBuilder {
  private readonly patch: Record<string, unknown> = {}
  private readonly deniedSkillKeys = new Set<string>()
  private profileName: string | undefined
  private profileType: string | undefined
  private goalValue: NpcGoal | undefined

  constructor(
    private readonly api: IntelligentNpcAPI,
    private readonly controllerId: string,
    private readonly npc: NPC,
  ) {}

  /** Sets a friendly runtime name for this AI profile. */
  name(value: string): this {
    this.profileName = value
    this.patch.npcName = value
    return this
  }

  /** Sets a logical NPC type for this AI profile. */
  npcType(value: string): this {
    this.profileType = value
    this.patch.npcType = value
    return this
  }

  /** Sets the high-level instruction text for the AI planner. */
  instruction(text: string): this {
    this.patch.instruction = text
    return this
  }

  /** Sets the planner goal id/hint. */
  goal(id: string, hint?: string): this {
    this.goalValue = hint ? { id, hint } : { id }
    return this
  }

  /** Adds the current player position into AI observations. */
  playerPos(player: { getPosition(): { x: number; y: number; z: number } }): this {
    const pos = player.getPosition()
    this.patch.playerPos = { x: pos.x, y: pos.y, z: pos.z }
    return this
  }

  /** Sets the allowed skill keys hint for AI prompts. */
  skillsPossible(skillKeys: string[]): this {
    this.patch.skillsPossible = skillKeys
    return this
  }

  /** Merges arbitrary extra observations for AI reasoning. */
  facts(values: Record<string, unknown>): this {
    for (const [key, value] of Object.entries(values)) {
      this.patch[key] = value
    }
    return this
  }

  /** Denies one skill class for this AI run. */
  denySkill<TSkill extends NpcSkillClass>(skillClass: TSkill): this {
    this.deniedSkillKeys.add(this.api.skillKey(skillClass))
    return this
  }

  /** Alias of {@link denySkill}. */
  deny<TSkill extends NpcSkillClass>(skillClass: TSkill): this {
    return this.denySkill(skillClass)
  }

  /** Denies one raw skill key for this AI run. */
  denySkillKey(skillKey: string): this {
    this.deniedSkillKeys.add(skillKey)
    return this
  }

  /** Executes one AI run using the built context. */
  async run(): Promise<RunResult> {
    this.ensureAttached()
    if (Object.keys(this.patch).length > 0) {
      this.api.setObservation(this.npc, this.patch)
    }

    return this.api.runWithDeny(this.npc, Array.from(this.deniedSkillKeys))
  }

  private ensureAttached(): void {
    if (!this.api.hasAttached(this.npc)) {
      this.api.attach(this.npc, {
        controllerId: this.controllerId,
        goal: this.goalValue,
        name: this.profileName,
        npcType: this.profileType,
      })
      return
    }

    if (this.goalValue) {
      this.api.setGoal(this.npc, this.goalValue)
    }

    if (this.profileName || this.profileType) {
      this.api.setProfile(this.npc, {
        name: this.profileName,
        npcType: this.profileType,
      })
    }
  }
}

export type { NpcGoal }

/** Injectable alias name for the intelligence service. */
export { IntelligentNpcAPI as NpcIntelligence }
