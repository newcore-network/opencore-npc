import { describe, expect, it, vi } from 'vitest'
import { IntelligenceEngine } from '../src/server/engine/intelligence-engine'
import { NpcSkillRegistry } from '../src/server/skills/skill-registry'

describe('IntelligenceEngine', () => {
  it('runs selected skill and stores memory', async () => {
    const registry = new NpcSkillRegistry()
    registry.register({
      key: 'okSkill',
      execute: async () => ({ ok: true, memory: { step: 'ok' } }),
    })

    const npc = {
      npcId: 'npc-1',
      exists: true,
      setPosition: vi.fn(),
      setHeading: vi.fn(),
    }

    const npcs = {
      getById: vi.fn().mockReturnValue(npc),
    }

    const engine = new IntelligenceEngine(npcs as never, registry)
    const controllers = new Map([['test', { id: 'test', skills: ['okSkill'] }]])

    engine.attach('npc-1', { controllerId: 'test' }, controllers)
    engine.setObservation('npc-1', { nextSkill: 'okSkill' })
    await engine.runOnce('npc-1')

    expect(engine.memory('npc-1')).toEqual([{ step: 'ok' }])
  })

  it('records error when decision skill is not allowed', async () => {
    const registry = new NpcSkillRegistry()
    registry.register({ key: 'okSkill', execute: async () => ({ ok: true }) })

    const npc = {
      npcId: 'npc-1',
      exists: true,
      setPosition: vi.fn(),
      setHeading: vi.fn(),
    }

    const npcs = {
      getById: vi.fn().mockReturnValue(npc),
    }

    const engine = new IntelligenceEngine(npcs as never, registry)
    const controllers = new Map([['test', { id: 'test', skills: ['okSkill'] }]])

    engine.attach(
      'npc-1',
      {
        controllerId: 'test',
        planner: { decide: async () => ({ skill: 'notAllowed' }) },
      },
      controllers,
    )
    await engine.runOnce('npc-1')

    expect(engine.memory('npc-1').length).toBe(1)
  })
})
