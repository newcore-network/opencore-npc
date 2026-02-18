import type { ConstraintReport } from './npc-constraint-report'

type Decision = { skill: string }
type ValidatorContext = { state: Map<string, any>; turnCalls: number; tagsBySkill?: Record<string, string[]> }

type RequirePredicate = (ctx: ValidatorContext) => boolean

export class NpcConstraints {
  private allowSkillsSet = new Set<string>()
  private forbidden = new Set<string>()
  private mutexGroups = new Map<string, Set<string>>()
  private required = new Map<string, RequirePredicate[]>()
  private maxCallsPerTurn = Number.POSITIVE_INFINITY

  /** Adds skills to the explicit allowlist. */
  allow(...skills: string[]): this {
    for (const skill of skills) this.allowSkillsSet.add(skill)
    return this
  }

  /** Adds skills to the explicit denylist. */
  forbidSkills(...skills: string[]): this {
    for (const skill of skills) this.forbidden.add(skill)
    return this
  }

  /** Declares a named mutual exclusion group. */
  mutexGroup(key: string, skills: string[]): this {
    this.mutexGroups.set(key, new Set(skills))
    return this
  }

  /** Sets the maximum number of skill calls allowed per tick. */
  limitCallsPerTurn(n: number): this {
    this.maxCallsPerTurn = Math.max(1, Math.floor(n))
    return this
  }

  /** Adds a precondition predicate for a specific skill. */
  require(skill: string, predicate: RequirePredicate): this {
    const list = this.required.get(skill) ?? []
    list.push(predicate)
    this.required.set(skill, list)
    return this
  }

  /** Returns the configured explicit allowlist. */
  getAllowlist(): string[] {
    return [...this.allowSkillsSet]
  }

  /** Validates one planner decision against all configured constraints. */
  validate(decision: Decision, ctx: ValidatorContext): ConstraintReport {
    const reasons: string[] = []

    if (this.allowSkillsSet.size > 0 && !this.allowSkillsSet.has(decision.skill)) {
      reasons.push(`skill '${decision.skill}' not in allowlist`)
    }

    if (this.forbidden.has(decision.skill)) {
      reasons.push(`skill '${decision.skill}' is forbidden`)
    }

    if (ctx.turnCalls >= this.maxCallsPerTurn) {
      reasons.push(`limitCallsPerTurn(${this.maxCallsPerTurn}) reached`)
    }

    for (const [key, group] of this.mutexGroups) {
      if (!group.has(decision.skill)) continue
      const heldBy = ctx.state.get(`mutex:${key}`)
      if (typeof heldBy === 'string' && heldBy !== decision.skill) {
        return {
          allowed: false,
          reasons: [...reasons, `mutex '${key}' locked by '${heldBy}'`],
          mutex: { key, heldBy },
        }
      }
    }

    const predicates = this.required.get(decision.skill) ?? []
    for (const predicate of predicates) {
      if (!predicate(ctx)) {
        reasons.push(`require predicate failed for '${decision.skill}'`)
      }
    }

    return {
      allowed: reasons.length === 0,
      reasons,
    }
  }

  /** Acquires matching mutex groups for a running skill. */
  holdMutex(skill: string, state: Map<string, any>): void {
    for (const [key, group] of this.mutexGroups) {
      if (group.has(skill)) {
        state.set(`mutex:${key}`, skill)
      }
    }
  }

  /** Releases matching mutex groups for a finished skill. */
  releaseMutex(skill: string, state: Map<string, any>): void {
    for (const [key, group] of this.mutexGroups) {
      if (group.has(skill) && state.get(`mutex:${key}`) === skill) {
        state.delete(`mutex:${key}`)
      }
    }
  }
}
