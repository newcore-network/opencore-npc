import { describe, expect, it } from 'vitest'
import { NpcSkill, npcSkill } from '../src/server/decorators/npc-skill.decorator'
import { createBuiltInSkills } from '../src/server/skills/builtin-skills'
import { NpcSkillRegistry } from '../src/server/skills/skill-registry'

describe('NpcSkillRegistry', () => {
  it('registers built-in skills', () => {
    const registry = new NpcSkillRegistry()
    registry.registerMany(createBuiltInSkills())

    expect(registry.get('moveTo')).toBeDefined()
    expect(registry.get('idle')).toBeDefined()
  })

  it('creates typed references from class decorators', () => {
    @NpcSkill('thirdPartySkill')
    class ThirdPartySkill {
      async execute() {
        return { ok: true }
      }
    }

    const ref = npcSkill(ThirdPartySkill)
    const registry = new NpcSkillRegistry()
    const instance = new ref.token()
    registry.register({ key: ref.key, execute: (ctx, args) => instance.execute(ctx, args) })

    expect(registry.get('thirdPartySkill')).toBeDefined()
  })

  it('overrides duplicate keys with latest registration', () => {
    const registry = new NpcSkillRegistry()
    registry.register({ key: 'dup', async execute() { return { ok: true, memory: 1 } } })
    registry.register({ key: 'dup', async execute() { return { ok: true, memory: 2 } } })

    expect(registry.has('dup')).toBe(true)
  })
})
