import { z } from 'zod'
import type { NpcSkill } from '../../runtime/contracts/npc-skill.interface'
import type { NpcContext } from '../../runtime/context/npc-context.types'

const ArgsSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  radius: z.number().default(25),
})

/** Built-in skill that makes an NPC wander around an anchor area. */
export class WanderAreaSkill implements NpcSkill<z.infer<typeof ArgsSchema>> {
  readonly key = 'wanderArea'
  readonly tags = ['movement']
  readonly mutex = 'movement'

  /** Validates and normalizes wander arguments. */
  validate(input: unknown): z.infer<typeof ArgsSchema> {
    return ArgsSchema.parse(input)
  }

  /** Executes area wandering through transport only. */
  async execute(ctx: NpcContext, args: z.infer<typeof ArgsSchema>) {
    ctx.events.emit('npc:state', { state: 'wandering' }, { scope: 'nearby', radius: 80 })
    await ctx.transport.wanderArea(ctx.npc, args)
    return { ok: true as const, wait: { type: 'ms' as const, value: 750 }, next: { type: 'replan' as const } }
  }
}
