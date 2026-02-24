import type { BaseEntity } from '@open-core/framework'
import type { Spatial } from '@open-core/framework'
import { NpcSkill } from '../decorators/npc-skill.decorator'
import type { NpcSkill as NpcSkillContract } from '../decorators/npc-skill.decorator'
import type { NpcContext } from '../types'

type SpatialBaseEntity = BaseEntity & Spatial

type LookAtEntityArgs = { entity: SpatialBaseEntity }

@NpcSkill()
export class LookAtEntitySkill implements NpcSkillContract<LookAtEntityArgs> {
  execute(ctx: NpcContext, args: LookAtEntityArgs) {
    const target = args?.entity
    if (!target || typeof target.getPosition !== 'function') {
      return { ok: false, error: 'lookAtEntity requires { entity: BaseEntity & Spatial }' }
    }

    const from = ctx.npc.getPosition()
    const to = target.getPosition()
    const heading = radiansToHeading(Math.atan2(to.y - from.y, to.x - from.x))

    ctx.npc.setHeading(heading)
    return {
      ok: true,
      memory: {
        type: 'lookAtEntity',
        targetId: target.id,
        heading,
      },
    }
  }
}

function radiansToHeading(radians: number): number {
  const degrees = (radians * 180) / Math.PI
  return (degrees + 360) % 360
}
