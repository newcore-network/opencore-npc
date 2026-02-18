export type ContextBuildOptions = {
  maxItems?: number
  roundTo?: number
}

function normalizeValue(value: unknown, roundTo: number): unknown {
  if (typeof value === 'number') {
    const factor = 10 ** roundTo
    return Math.round(value * factor) / factor
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry, roundTo))
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    const obj = value as Record<string, unknown>
    for (const key of Object.keys(obj).sort()) {
      out[key] = normalizeValue(obj[key], roundTo)
    }
    return out
  }

  return value
}

/**
 * Builds compact and deterministic context snapshots.
 */
export class NpcContextBuilder {
  /**
   * Converts observations into a token-friendly snapshot.
   *
   * @param observations - Current raw observations.
   * @param options - Output constraints and rounding options.
   */
  buildSnapshot(
    observations: Record<string, unknown>,
    options?: ContextBuildOptions,
  ): Record<string, unknown> {
    const maxItems = options?.maxItems ?? 16
    const roundTo = options?.roundTo ?? 2

    const keys = Object.keys(observations).sort().slice(0, maxItems)
    const snapshot: Record<string, unknown> = {}
    for (const key of keys) {
      snapshot[key] = normalizeValue(observations[key], roundTo)
    }

    return snapshot
  }
}
