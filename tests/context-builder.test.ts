import { describe, expect, it } from 'vitest'
import { NpcContextBuilder } from '../src/server/runtime/context/npc-context-builder'

describe('NpcContextBuilder', () => {
  it('builds compact and deterministic snapshot', () => {
    const builder = new NpcContextBuilder()
    const input = {
      zeta: 10.12345,
      alpha: { b: 2.4567, a: 1.2345 },
      extra: [3.3333],
    }

    const a = builder.buildSnapshot(input, { maxItems: 2, roundTo: 2 })
    const b = builder.buildSnapshot(input, { maxItems: 2, roundTo: 2 })
    const alpha = a.alpha as { a: number; b: number }

    expect(a).toEqual(b)
    expect(Object.keys(a)).toEqual(['alpha', 'extra'])
    expect(alpha.a).toBe(1.23)
    expect(alpha.b).toBe(2.46)
  })
})
