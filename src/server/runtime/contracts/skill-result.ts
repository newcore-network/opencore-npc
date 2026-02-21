/** Follow-up action requested by a skill result. */
export type SkillNext =
  | { type: 'continue' }
  | { type: 'replan'; reason?: string }
  | { type: 'run'; skill: string; args: unknown }

/** Wait instruction consumed by the engine scheduler. */
export type SkillWait =
  | { type: 'ms'; value: number }
  | { type: 'until'; key: string; timeoutMs: number }

/** Canonical execution result returned by skills. */
export type SkillResult =
  | { ok: true; data?: unknown; next?: SkillNext; wait?: SkillWait }
  | {
    ok: false
    error: string
    retryInMs?: number
    cooldownPenaltyMs?: number
    next?: SkillNext
    wait?: SkillWait
  }

/**
 * Helper base class for building structured skill results.
 *
 * @typeParam TArgs - Validated input argument shape.
 */
export abstract class AbstractNpcSkill<TArgs = unknown> {
  protected ok(data?: unknown) {
    return {
      result: { ok: true as const, data } as SkillResult,
      waitMs(value: number) {
        this.result.wait = { type: 'ms', value }
        return this
      },
      waitUntil(key: string, timeoutMs: number) {
        this.result.wait = { type: 'until', key, timeoutMs }
        return this
      },
      next(next: SkillNext) {
        this.result.next = next
        return this.result
      },
      done() {
        return this.result
      },
    }
  }

  protected fail(error: string) {
    return {
      result: { ok: false as const, error } as SkillResult,
      retryIn(ms: number) {
        ;(this.result as { retryInMs?: number }).retryInMs = ms
        return this
      },
      next(next: SkillNext) {
        this.result.next = next
        return this.result
      },
      done() {
        return this.result
      },
    }
  }

  abstract execute(ctx: unknown, args: TArgs): Promise<SkillResult>
}
