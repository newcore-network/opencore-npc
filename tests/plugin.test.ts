import { describe, expect, it, vi } from 'vitest'
import { createServerRuntime } from '@open-core/framework/server'
import { npcPlugin } from '../src/server/npc.plugin'

describe('npcPlugin', () => {
  it('registers server API extensions', async () => {
    const server = createServerRuntime()
    const register = vi.fn()
    const plugin = npcPlugin()

    await plugin.install({
      server,
      di: { register },
      config: { get: vi.fn() },
    })

    expect(typeof (server as any).NPC).toBe('function')
    expect(typeof (server as any).NpcSkill).toBe('function')
    expect(typeof (server as any).OnNpcHook).toBe('function')
    expect(typeof (server as any).OnNpcEvent).toBe('function')
    expect(register).toHaveBeenCalled()
  })

  it('exposes a stable plugin name', () => {
    expect(npcPlugin().name).toBe('npc')
  })
})
