import { describe, expect, it, vi } from 'vitest'
import { NpcAiPlanner } from '../src/server/runtime/planner/npc-ai-planner'
import { NpcRulePlanner } from '../src/server/runtime/planner/npc-rule-planner'

const baseCtx: any = {
  npc: { id: 'npc-1' },
  goal: { id: 'deliver' },
  snapshot: {},
  memory: [],
  observations: {},
}

describe('NpcAiPlanner', () => {
  it('accepts valid output', async () => {
    const provider = { name: 'mock', complete: vi.fn(async () => ({ skill: 'moveTo', args: { x: 1, y: 2, z: 3 } })) }
    const planner = new NpcAiPlanner(provider, new NpcRulePlanner())
    const decision = await planner.decide(baseCtx, { allowSkills: ['moveTo'] })

    expect(decision.type).toBe('skill')
    if (decision.type === 'skill') expect(decision.skill).toBe('moveTo')
  })

  it('falls back on invalid schema or disallowed skill', async () => {
    const providerInvalid = { name: 'mock', complete: vi.fn(async () => ({ bad: true })) }
    const plannerInvalid = new NpcAiPlanner(providerInvalid, new NpcRulePlanner())
    const d1 = await plannerInvalid.decide(baseCtx, { allowSkills: ['moveTo'] })
    expect(d1.type).toBe('idle')

    const providerDisallowed = { name: 'mock', complete: vi.fn(async () => ({ skill: 'driveTo', args: {} })) }
    const plannerDisallowed = new NpcAiPlanner(providerDisallowed, new NpcRulePlanner())
    const d2 = await plannerDisallowed.decide(baseCtx, { allowSkills: ['moveTo'] })
    expect(d2.type).toBe('idle')
  })

  it('enforces requests-per-minute budget', async () => {
    const provider = { name: 'mock', complete: vi.fn(async () => ({ skill: 'moveTo', args: {} })) }
    const planner = new NpcAiPlanner(provider, new NpcRulePlanner(), { maxRequestsPerMin: 1 })

    await planner.decide(baseCtx, { allowSkills: ['moveTo'] })
    await planner.decide(baseCtx, { allowSkills: ['moveTo'] })
    expect(provider.complete).toHaveBeenCalledTimes(1)
  })

  it('logs provider errors and falls back', async () => {
    const provider = { name: 'mock', complete: vi.fn(async () => { throw new Error('upstream 500') }) }
    const logger = { error: vi.fn() }
    const planner = new NpcAiPlanner(provider, new NpcRulePlanner(), undefined, logger)

    const decision = await planner.decide(baseCtx, { allowSkills: ['moveTo'] })
    expect(decision.type).toBe('idle')
    expect(logger.error).toHaveBeenCalledTimes(1)
  })

  it('enforces budget under concurrent load', async () => {
    const provider = { name: 'mock', complete: vi.fn(async () => ({ skill: 'moveTo', args: {} })) }
    const planner = new NpcAiPlanner(provider, new NpcRulePlanner(), {
      maxRequestsPerMin: 5,
      minDecisionIntervalMs: 0,
    })

    await Promise.all(
      Array.from({ length: 100 }, () => planner.decide(baseCtx, { allowSkills: ['moveTo'] })),
    )

    expect(provider.complete.mock.calls.length).toBeLessThanOrEqual(5)
  })
})
