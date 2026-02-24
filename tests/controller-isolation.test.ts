import { describe, expect, it, vi } from 'vitest'
import { IntelligenceEngine } from '../src/server/engine/intelligence-engine'
import { NpcSkillRegistry } from '../src/server/skills/skill-registry'

describe('Npc controller isolation', () => {
  it('uses skill sets from each attached controller definition', async () => {
    const guardSkill = vi.fn(async () => ({ ok: true, memory: 'guard' }))
    const civilianSkill = vi.fn(async () => ({ ok: true, memory: 'civilian' }))

    const registry = new NpcSkillRegistry()
    registry.register({ key: 'guardSkill', execute: guardSkill })
    registry.register({ key: 'civilianSkill', execute: civilianSkill })

    const byId = new Map<string, any>([
      [
        'npc-guard',
        {
          npcId: 'npc-guard',
          netId: 1,
          exists: true,
          setSyncedState: vi.fn(),
        },
      ],
      [
        'npc-civilian',
        {
          npcId: 'npc-civilian',
          netId: 2,
          exists: true,
          setSyncedState: vi.fn(),
        },
      ],
    ])

    const npcs = {
      getById(id: string) {
        return byId.get(id)
      },
    } as any

    const engine = new IntelligenceEngine(npcs, registry)
    const controllers = new Map<string, any>([
      ['guard', { id: 'guard', skills: ['guardSkill'] }],
      ['civilian', { id: 'civilian', skills: ['civilianSkill'] }],
    ])

    engine.attach('npc-guard', { controllerId: 'guard' }, controllers)
    engine.attach('npc-civilian', { controllerId: 'civilian' }, controllers)

    engine.setObservation('npc-guard', { nextSkill: 'guardSkill' })
    engine.setObservation('npc-civilian', { nextSkill: 'civilianSkill' })

    await engine.runOnce('npc-guard')
    await engine.runOnce('npc-civilian')

    expect(guardSkill).toHaveBeenCalledTimes(1)
    expect(civilianSkill).toHaveBeenCalledTimes(1)
  })
})
