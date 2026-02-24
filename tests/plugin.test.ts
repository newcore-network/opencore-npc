import { describe, expect, it, vi } from 'vitest'
import { GLOBAL_CONTAINER } from '@open-core/framework'
import { createServerRuntime, Npcs } from '@open-core/framework/server'
import { npcIntelligencePlugin } from '../src/server/npc.plugin'

describe('npcIntelligencePlugin', () => {
  it('registers server API extensions', async () => {
    const server = createServerRuntime()
    const register = vi.fn()
    const plugin = npcIntelligencePlugin()

    GLOBAL_CONTAINER.registerInstance(Npcs, {
      getById: vi.fn(),
      create: vi.fn(),
      deleteById: vi.fn(),
    } as never)

    await plugin.install({
      server,
      di: { register },
      config: { get: vi.fn() },
    })

    expect(typeof (server as any).NpcIntelligentController).toBe('function')
    expect(typeof (server as any).NpcSkill).toBe('function')
    expect(typeof (server as any).OnNpcHook).toBe('function')
    expect(typeof (server as any).OnNpcEvent).toBe('function')
    expect(register).toHaveBeenCalled()
  })

  it('exposes a stable plugin name', () => {
    expect(npcIntelligencePlugin().name).toBe('npc-intelligence')
  })
})
