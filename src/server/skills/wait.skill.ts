import { NpcSkill } from '../decorators/npc-skill.decorator'
import type { NpcSkill as NpcSkillContract } from '../decorators/npc-skill.decorator'
import type { NpcContext } from '../types'

type WaitArgs = { ms: number }

@NpcSkill()
export class WaitSkill implements NpcSkillContract<WaitArgs> {
  execute(_ctx: NpcContext, args: WaitArgs) {
    const ms = Math.max(0, Math.floor(args?.ms ?? 0))
    return {
      ok: true,
      waitMs: ms,
      memory: {
        type: 'wait',
        ms,
      },
    }
  }
}
