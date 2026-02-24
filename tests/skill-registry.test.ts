import { describe, expect, it } from 'vitest'
import { NpcSkill, skillKeyOf } from '../src/server/decorators/npc-skill.decorator'
import { builtInSkillClasses } from '../src/server/skills/builtins'
import { NpcSkillRegistry } from '../src/server/skills/skill-registry'
import { GLOBAL_CONTAINER } from '@open-core/framework'
import type { NpcContext, SkillResult } from '../src/server/types'

describe('NpcSkillRegistry', () => {
  it('registers built-in skills', () => {
    const registry = new NpcSkillRegistry()
    for (const cls of builtInSkillClasses()) {
      GLOBAL_CONTAINER.registerSingleton(cls as never)
      const instance = GLOBAL_CONTAINER.resolve(cls as never) as {
        execute: (ctx: NpcContext, args: unknown) => Promise<SkillResult> | SkillResult
      }
      registry.register({
        key: skillKeyOf(cls),
        execute: (ctx, args) => instance.execute(ctx, args),
      })
    }

    expect(registry.get('moveTo')).toBeDefined()
    expect(registry.get('idle')).toBeDefined()
  })

  it('creates keys from class decorators', () => {
    @NpcSkill()
    class ThirdPartySkill {
      async execute(_ctx: NpcContext, _args: unknown) {
        return { ok: true }
      }
    }

    const registry = new NpcSkillRegistry()
    const instance = new ThirdPartySkill()
    registry.register({ key: skillKeyOf(ThirdPartySkill), execute: (ctx, args) => instance.execute(ctx, args) })

    expect(registry.get('thirdParty')).toBeDefined()
  })

  it('rejects duplicate keys', () => {
    const registry = new NpcSkillRegistry()
    registry.register({ key: 'dup', async execute() { return { ok: true, memory: 1 } } })
    expect(() =>
      registry.register({ key: 'dup', async execute() { return { ok: true, memory: 2 } } }),
    ).toThrow("NpcSkill 'dup' already registered")
  })
})
