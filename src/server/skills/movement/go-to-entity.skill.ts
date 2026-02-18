import { z } from 'zod'
import type { NpcSkill } from '../../runtime/contracts/npc-skill.interface'
import type { NpcContext } from '../../runtime/context/npc-context.types'

const ArgsSchema = z.object({
  entity: z.number(),
  stopDistance: z.number().default(2),
  speed: z.number().default(1.8),
})

/** Built-in skill that approaches an entity handle. */
export class GoToEntitySkill implements NpcSkill<z.infer<typeof ArgsSchema>> {
  readonly key = 'goToEntity'
  readonly tags = ['movement']
  readonly mutex = 'movement'

  /** Validates and normalizes go-to-entity arguments. */
  validate(input: unknown): z.infer<typeof ArgsSchema> {
    return ArgsSchema.parse(input)
  }

  /** Executes the go-to-entity request through transport only. */
  async execute(ctx: NpcContext, args: z.infer<typeof ArgsSchema>) {
    ctx.events.emit('npc:state', { state: 'going_to_entity' }, { scope: 'nearby', radius: 120 })
    await ctx.transport.goToEntity(ctx.npc, args)
    return { ok: true as const, next: { type: 'replan' as const } }
  }
}
