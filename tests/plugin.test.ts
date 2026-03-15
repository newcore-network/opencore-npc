import { describe, expect, it, vi } from 'vitest'
import { GLOBAL_CONTAINER } from '@open-core/framework'
import { createServerRuntime, Npcs } from '@open-core/framework/server'
import { NPCAgentsPlugin } from '../src/server/npc.plugin'

describe('npcIntelligencePlugin', () => {
  it('registers server API extensions and runtime services', async () => {
    const server = createServerRuntime()
    const register = vi.fn()
    const plugin = NPCAgentsPlugin()

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

    await (plugin as any).start?.({
      server,
      di: { register },
      config: { get: vi.fn() },
    })

    const pluginApi = server as unknown as {
      NpcIntelligentController?: unknown
      NpcSkill?: unknown
      OnNpcHook?: unknown
      OnNpcEvent?: unknown
    }

    expect(typeof pluginApi.NpcIntelligentController).toBe('function')
    expect(typeof pluginApi.NpcSkill).toBe('function')
    expect(typeof pluginApi.OnNpcHook).toBe('function')
    expect(typeof pluginApi.OnNpcEvent).toBe('function')
    expect(register).toHaveBeenCalled()
  })

  it('exposes a stable plugin name', () => {
    expect(NPCAgentsPlugin().name).toBe('npc-intelligence')
  })
})
