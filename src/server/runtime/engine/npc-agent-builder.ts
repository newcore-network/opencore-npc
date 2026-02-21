import type { NpcGoal, NpcIdentity } from '../../../shared/contracts/npc-types'
import { NpcConstraints } from '../constraints/npc-constraints'
import type { NpcPlanner } from '../planner/npc-planner.interface'
import type { NpcAgent } from './npc-agent'

export class NpcAgentBuilder {
  private constraints = new NpcConstraints()
  private observations: Record<string, unknown> = {}
  private memory: unknown[] = []

  /** Creates a builder for one NPC agent. */
  constructor(
    private readonly npc: NpcIdentity,
    private readonly controllerId: string,
    private readonly goal: NpcGoal,
    private readonly planner: NpcPlanner,
  ) {}

  /** Configures constraints for the future agent instance. */
  withConstraints(configure: (constraints: NpcConstraints) => NpcConstraints): this {
    this.constraints = configure(this.constraints)
    return this
  }

  /** Merges one observation patch. */
  withObservation(patch: Record<string, unknown>): this {
    this.observations = { ...this.observations, ...patch }
    return this
  }

  /** Replaces current memory snapshot. */
  withMemory(memory: unknown[]): this {
    this.memory = [...memory]
    return this
  }

  /** Builds a mutable agent runtime object. */
  build(): NpcAgent {
    return {
      npc: this.npc,
      controllerId: this.controllerId,
      goal: this.goal,
      planner: this.planner,
      constraints: this.constraints,
      observations: this.observations,
      memory: this.memory,
      state: new Map(),
      turnCalls: 0,
    }
  }
}
