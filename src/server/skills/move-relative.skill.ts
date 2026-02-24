import { NpcSkill } from '../decorators/npc-skill.decorator'
import type { NpcSkill as NpcSkillContract } from '../decorators/npc-skill.decorator'
import type { NpcContext } from '../types'

type MoveRelativeArgs = {
  dx: number
  dy: number
  dz?: number
}

@NpcSkill()
export class MoveRelativeSkill implements NpcSkillContract<MoveRelativeArgs> {
  execute(ctx: NpcContext, args: MoveRelativeArgs) {
    if (typeof args?.dx !== 'number' || typeof args?.dy !== 'number') {
      return { ok: false, error: 'moveRelative requires { dx, dy, dz? }' }
    }

    const current = ctx.npc.getPosition()
    ctx.npc.setPosition({
      x: current.x + args.dx,
      y: current.y + args.dy,
      z: current.z + (typeof args.dz === 'number' ? args.dz : 0),
    })

    return {
      ok: true,
      memory: {
        type: 'moveRelative',
        dx: args.dx,
        dy: args.dy,
        dz: args.dz ?? 0,
      },
    }
  }
}
