import { describe, expect, it, vi } from 'vitest'
import { inject, injectable } from 'tsyringe'
import { GLOBAL_CONTAINER } from '@open-core/framework'
import { createServerRuntime, Npcs } from '@open-core/framework/server'
import { npcIntelligencePlugin } from '../src/server/npc.plugin'
import { NpcSkill } from '../src/server/decorators/npc-skill.decorator'
import {
  getNpcIntelligentControllers,
  NpcIntelligentController,
} from '../src/server/decorators/npc.decorator'
import { IntelligentNpcAPI } from '../src/server/api/npc-api'

describe('NpcSkill DI integration', () => {
  it('resolves class-based skills through DI and typed refs', async () => {
    const weaponService = { kind: 'rifle' }
    GLOBAL_CONTAINER.registerInstance('weapon-service', weaponService)

    @injectable()
    @NpcSkill()
    class PatrolSkill {
      constructor(@inject('weapon-service') private readonly service: { kind: string }) {}

      async execute() {
        return { ok: true as const, memory: this.service.kind }
      }
    }

    @NpcIntelligentController({ id: 'di-controller', skills: [PatrolSkill] })
    class DiController {}

    const server = createServerRuntime()
    let api: IntelligentNpcAPI | undefined
    const register = vi.fn((token: unknown, value: unknown) => {
      if (token === IntelligentNpcAPI) {
        api = value as IntelligentNpcAPI
      }
    })

    const npcEntity = {
      npcId: 'npc-1',
      netId: 11,
      exists: true,
      setSyncedState: vi.fn(),
    }

    GLOBAL_CONTAINER.registerInstance(Npcs, {
      create: vi.fn().mockResolvedValue({ result: { success: true }, npc: npcEntity }),
      getById: vi.fn().mockReturnValue(npcEntity),
      deleteById: vi.fn(),
    } as never)

    await npcIntelligencePlugin().install({
      server,
      di: { register },
      config: { get: vi.fn() },
    })

    expect(getNpcIntelligentControllers().get('di-controller')).toBeDefined()
    expect(api).toBeDefined()

    const npc = await api!.spawn({ model: 's_m_y_cop_01', position: { x: 0, y: 0, z: 0 } })
    api!.attach(npc, { controllerId: 'di-controller' })
    api!.setObservation(npc, { nextSkill: 'patrol' })
    await api!.run(npc)

    expect(api!.memory(npc)).toContain('rifle')
  })
})
