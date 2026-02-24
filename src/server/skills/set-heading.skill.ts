import type { NpcContext } from '../types'
import { NpcSkill } from '../decorators/npc-skill.decorator'
import type { NpcSkill as NpcSkillContract } from '../decorators/npc-skill.decorator'

type SetHeadingArgs = { heading: number }

@NpcSkill()
export class SetHeadingSkill implements NpcSkillContract<SetHeadingArgs> {
  execute(ctx: NpcContext, args: SetHeadingArgs) {
    if (typeof args?.heading !== 'number') {
      return { ok: false, error: 'setHeading requires { heading }' }
    }

    ctx.npc.setHeading(args.heading)
    return { ok: true }
  }
}
