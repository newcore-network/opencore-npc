import { NpcSkill } from '../decorators/npc-skill.decorator'
import type { NpcSkill as NpcSkillContract } from '../decorators/npc-skill.decorator'
import type { NpcContext } from '../types'

type MoveToArgs = { x: number; y: number; z: number }

@NpcSkill()
export class MoveToSkill implements NpcSkillContract<MoveToArgs> {
  execute(ctx: NpcContext, args: MoveToArgs) {
    if (
      typeof args?.x !== 'number' ||
      typeof args?.y !== 'number' ||
      typeof args?.z !== 'number'
    ) {
      return { ok: false, error: 'moveTo requires { x, y, z }' }
    }

    ctx.npc.setPosition({ x: args.x, y: args.y, z: args.z })
    return { ok: true, waitMs: 250 }
  }
}
