import { describe, expect, it } from 'vitest'
import { NpcSkillRegistry } from '../src/server/runtime/engine/npc-skill-registry'
import { registerBuiltInNpcSkills } from '../src/server/skills/register-builtins'
import { NpcSkill } from '../src/server/decorators/npc-skill.decorator'

describe('NpcSkillRegistry', () => {
  it('registers built-in skills', () => {
    const registry = new NpcSkillRegistry()
    registerBuiltInNpcSkills(registry)

    expect(registry.get('moveTo')).toBeDefined()
    expect(registry.get('goToCarDrivePark')).toBeDefined()
  })

  it('registers third-party skill from class decorator', () => {
    @NpcSkill({ key: 'thirdPartySkill', tags: ['utility'] })
    class ThirdPartySkill {
      readonly key = 'thirdPartySkill'
      async execute() {
        return { ok: true }
      }
    }

    const registry = new NpcSkillRegistry()
    registry.registerClass(ThirdPartySkill as any)

    expect(registry.get('thirdPartySkill')).toBeDefined()
  })

  it('rejects duplicate keys', () => {
    const registry = new NpcSkillRegistry()
    registry.register({ key: 'dup', async execute() { return { ok: true } } })
    expect(() =>
      registry.register({ key: 'dup', async execute() { return { ok: true } } }),
    ).toThrow("NpcSkill 'dup' already registered")
  })
})
