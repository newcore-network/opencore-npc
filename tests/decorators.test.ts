import { describe, expect, it } from 'vitest'
import { NPC } from '../src/server/decorators/npc.decorator'
import { NpcSkill } from '../src/server/decorators/npc-skill.decorator'
import { OnNpcHook } from '../src/server/decorators/npc-hook.decorator'
import { OnNpcEvent } from '../src/server/decorators/on-npc-event.decorator'
import { NPC_METADATA_KEYS } from '../src/server/decorators/metadata-keys'

describe('npc decorators', () => {
  it('@Server.NPC writes controller metadata', () => {
    @NPC({ group: 'drivers', tickMs: 500 })
    class DriverController {}

    const meta = Reflect.getMetadata(NPC_METADATA_KEYS.CONTROLLER, DriverController)
    expect(meta).toEqual({ group: 'drivers', tickMs: 500 })
  })

  it('@Server.NpcSkill writes skill metadata', () => {
    @NpcSkill({ key: 'driveTo', tags: ['vehicle'], mutex: 'movement' })
    class DriveToSkill {}

    const meta = Reflect.getMetadata(NPC_METADATA_KEYS.SKILL, DriveToSkill)
    expect(meta).toEqual({ key: 'driveTo', tags: ['vehicle'], mutex: 'movement' })
  })

  it('hook and event decorators attach method metadata', () => {
    class TestController {
      @OnNpcHook('beforeSkill')
      onHook() {}

      @OnNpcEvent('npc:state')
      onEvent() {}
    }

    const hookMeta = Reflect.getMetadata(
      NPC_METADATA_KEYS.HOOK,
      TestController.prototype,
      'onHook',
    )
    const eventMeta = Reflect.getMetadata(
      NPC_METADATA_KEYS.EVENT,
      TestController.prototype,
      'onEvent',
    )

    expect(hookMeta).toEqual({ hook: 'beforeSkill' })
    expect(eventMeta).toEqual({ eventName: 'npc:state' })
  })
})
