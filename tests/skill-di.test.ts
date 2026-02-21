import { describe, expect, it, vi } from 'vitest'
import { inject, injectable } from 'tsyringe'
import { GLOBAL_CONTAINER } from '@open-core/framework'
import { createServerRuntime } from '@open-core/framework/server'
import { npcPlugin } from '../src/server/npc.plugin'
import { NpcSkill } from '../src/server/decorators/npc-skill.decorator'
import { NpcSkillRegistry } from '../src/server/runtime/engine/npc-skill-registry'

describe('NpcSkill DI integration', () => {
  it('resolves decorated skills through DI', async () => {
    const weaponService = { kind: 'rifle' }
    GLOBAL_CONTAINER.registerInstance('weapon-service', weaponService)

    @NpcSkill('diPatrol')
    class PatrolSkill {
      constructor(@inject('weapon-service') public readonly weaponService: { kind: string }) {}

      readonly key = 'diPatrol'
      async execute() {
        return { ok: true as const }
      }
    }

    const server = createServerRuntime()
    let registry: NpcSkillRegistry | undefined
    const register = vi.fn((token: unknown, value: unknown) => {
      if (token === NpcSkillRegistry) {
        registry = value as NpcSkillRegistry
      }
    })

    await npcPlugin().install({
      server,
      di: { register },
      config: { get: vi.fn() },
    })

    expect(registry).toBeDefined()
    const resolved = registry?.get('diPatrol') as PatrolSkill | undefined
    expect(resolved).toBeDefined()
    expect(resolved?.weaponService).toBe(weaponService)
  })
})
