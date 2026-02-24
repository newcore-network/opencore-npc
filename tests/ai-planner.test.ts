import { describe, expect, it, vi } from 'vitest'
import { NpcAiPlanner } from '../src/server/ai/ai-planner'
import { NpcRulePlanner } from '../src/server/ai/rule-planner'
import type { NpcContext } from '../src/server/types'

const ctx: NpcContext = {
  npc: { setPosition: vi.fn(), setHeading: vi.fn() },
  goal: { id: 'deliver' },
  setGoal: vi.fn(),
  observations: {},
  memory: [],
  state: { get: vi.fn(), set: vi.fn() },
} as unknown as NpcContext

describe('NpcAiPlanner', () => {
  it('accepts valid output', async () => {
    const provider = { complete: vi.fn(async () => '{"skill":"moveTo","args":{"x":1,"y":2,"z":3}}') }
    const planner = new NpcAiPlanner(provider, new NpcRulePlanner())
    const decision = await planner.decide(ctx, ['moveTo'])

    expect(decision?.skill).toBe('moveTo')
  })

  it('falls back when provider returns invalid output', async () => {
    const provider = { complete: vi.fn(async () => 'not-json') }
    const planner = new NpcAiPlanner(provider, new NpcRulePlanner())
    const decision = await planner.decide(ctx, ['moveTo'])

    expect(decision?.skill).toBe('moveTo')
  })
})
