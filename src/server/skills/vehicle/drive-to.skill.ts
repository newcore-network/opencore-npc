import { z } from 'zod'
import type { NpcSkill } from '../../runtime/contracts/npc-skill.interface'
import type { NpcContext } from '../../runtime/context/npc-context.types'

const ArgsSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  speed: z.number().default(18),
  drivingStyle: z.number().default(786603),
  stoppingRange: z.number().default(5),
})

/** Built-in skill that drives toward a destination point. */
export class DriveToSkill implements NpcSkill<z.infer<typeof ArgsSchema>> {
  readonly key = 'driveTo'
  readonly tags = ['vehicle', 'movement']
  readonly mutex = 'movement'

  /** Validates and normalizes drive arguments. */
  validate(input: unknown): z.infer<typeof ArgsSchema> {
    return ArgsSchema.parse(input)
  }

  /** Executes drive task through transport and schedules wait-until. */
  async execute(ctx: NpcContext, args: z.infer<typeof ArgsSchema>) {
    ctx.events.emit('npc:state', { state: 'driving' }, { scope: 'nearby', radius: 140 })
    await ctx.transport.driveTo(ctx.npc, args)
    return { ok: true as const, wait: { type: 'until' as const, key: 'nearDestination', timeoutMs: 15000 }, next: { type: 'replan' as const } }
  }
}
