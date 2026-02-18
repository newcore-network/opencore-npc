import type { NpcPlanner } from '../runtime/planner/npc-planner.interface'

/** Fluent API to define allowed skills in a controller. */
export type SkillAllowApi = {
  allow(...skills: string[]): SkillAllowApi
}

/** Fluent API to define runtime constraints in a controller. */
export type ConstraintApi = {
  allow(...skills: string[]): ConstraintApi
  limitCallsPerTurn(limit: number): ConstraintApi
  mutexGroup(key: string, skills: string[]): ConstraintApi
  require(skill: string, predicate: (ctx: { state: Map<string, unknown>; turnCalls: number }) => boolean): ConstraintApi
}

/**
 * Fluent configurator passed to `@Server.NPC(...).configure(...)`.
 *
 * @remarks
 * This type is intended for consumers implementing NPC controllers.
 */
export type NpcAgentConfigurator = {
  usePlanner(primary: NpcPlanner, fallback?: NpcPlanner): NpcAgentConfigurator
  skills(configure: (skills: SkillAllowApi) => unknown): NpcAgentConfigurator
  constraints(configure: (constraints: ConstraintApi) => unknown): NpcAgentConfigurator
  context(configure: (_api: unknown) => unknown): NpcAgentConfigurator
}

/**
 * Contract for all NPC controllers.
 *
 * @remarks
 * Controllers must define explicit planner, skill allowlist, and constraints.
 */
export interface NpcControllerContract {
  configure(agent: NpcAgentConfigurator): void
}

/**
 * Base class for strict NPC controllers.
 *
 * @remarks
 * Extend this class to make controller intent explicit and fully typed.
 */
export abstract class NpcControllerBase implements NpcControllerContract {
  abstract configure(agent: NpcAgentConfigurator): void
}
