import { z } from 'zod'
import type { NpcSkill } from '../../runtime/contracts/npc-skill.interface'
import type { NpcContext } from '../../runtime/context/npc-context.types'

const ArgsSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  speed: z.number().default(1.5),
})

/** Built-in skill that moves an NPC to a world position. */
export class MoveToSkill implements NpcSkill<z.infer<typeof ArgsSchema>> {
  readonly key = 'moveTo'
  readonly tags = ['movement']
  readonly mutex = 'movement'

  /** Validates and normalizes move arguments. */
  validate(input: unknown): z.infer<typeof ArgsSchema> {
    return ArgsSchema.parse(input)
  }

  /** Executes the movement request through transport only. */
  async execute(ctx: NpcContext, args: z.infer<typeof ArgsSchema>) {
    ctx.events.emit('npc:state', { state: 'moving_to' }, { scope: 'nearby', radius: 120 })
    await ctx.transport.moveTo(ctx.npc, args)
    return { ok: true as const, next: { type: 'replan' as const } }
  }
}
