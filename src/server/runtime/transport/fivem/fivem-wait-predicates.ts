/** In-memory predicate store used by `wait:until` checks. */
export class FiveMWaitPredicates {
  private readonly values = new Map<string, boolean>()

  /** Sets one wait predicate value. */
  set(key: string, value: boolean): void {
    this.values.set(key, value)
  }

  /** Gets one wait predicate value. */
  get(key: string): boolean {
    return this.values.get(key) ?? false
  }
}
