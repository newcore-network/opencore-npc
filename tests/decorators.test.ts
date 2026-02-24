import { describe, expect, it } from 'vitest'
import {
  getNpcIntelligentControllers,
  NpcIntelligentController,
} from '../src/server/decorators/npc.decorator'
import { NpcSkill, npcSkill } from '../src/server/decorators/npc-skill.decorator'
import { OnNpcHook } from '../src/server/decorators/npc-hook.decorator'
import { OnNpcEvent } from '../src/server/decorators/on-npc-event.decorator'
import { NPC_INTELLIGENCE_METADATA } from '../src/server/decorators/metadata-keys'

describe('npc intelligence decorators', () => {
  it('@NpcIntelligentController stores controller metadata', () => {
    @NpcSkill('moveTo')
    class MoveToSkill {
      async execute() {
        return { ok: true }
      }
    }

    @NpcIntelligentController({ id: 'drivers', tickMs: 500, skills: [npcSkill(MoveToSkill)] })
    class DriverController {}

    const controllers = getNpcIntelligentControllers()
    const meta = Reflect.getMetadata(NPC_INTELLIGENCE_METADATA.CONTROLLER, DriverController)

    expect(controllers.get('drivers')?.id).toBe('drivers')
    expect(controllers.get('drivers')?.skills?.[0]?.key).toBe('moveTo')
    expect(meta.id).toBe('drivers')
  })

  it('@NpcSkill + npcSkill produce typed skill refs', () => {
    @NpcSkill('driveTo')
    class DriveToSkill {
      async execute() {
        return { ok: true }
      }
    }

    const ref = npcSkill(DriveToSkill)
    expect(ref.key).toBe('driveTo')
    expect(ref.token).toBe(DriveToSkill)
  })

  it('hook and event decorators attach metadata on methods', () => {
    class TestController {
      @OnNpcHook('beforeSkill')
      onHook() {}

      @OnNpcEvent('npc:state')
      onEvent() {}
    }

    const hookMeta = Reflect.getMetadata(NPC_INTELLIGENCE_METADATA.HOOK, TestController.prototype.onHook)
    const eventMeta = Reflect.getMetadata(NPC_INTELLIGENCE_METADATA.EVENT, TestController.prototype.onEvent)

    expect(hookMeta).toBe('beforeSkill')
    expect(eventMeta).toBe('npc:state')
  })
})
