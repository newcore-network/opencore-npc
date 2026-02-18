import { z } from 'zod'
import type { NpcSkill } from '../../runtime/contracts/npc-skill.interface'
import type { NpcContext } from '../../runtime/context/npc-context.types'

const ArgsSchema = z.object({
  heading: z.number().optional(),
  stopEngine: z.boolean().default(true),
  handbrake: z.boolean().default(true),
})

/** Built-in skill that parks the active vehicle. */
export class ParkVehicleSkill implements NpcSkill<z.infer<typeof ArgsSchema>> {
  readonly key = 'parkVehicle'
  readonly tags = ['vehicle']
  readonly mutex = 'movement'

  /** Validates and normalizes park arguments. */
  validate(input: unknown): z.infer<typeof ArgsSchema> {
    return ArgsSchema.parse(input)
  }

  /** Executes park task through transport. */
  async execute(ctx: NpcContext, args: z.infer<typeof ArgsSchema>) {
    ctx.events.emit('npc:state', { state: 'parking' }, { scope: 'nearby', radius: 90 })
    await ctx.transport.parkVehicle(ctx.npc, args)
    return { ok: true as const, wait: { type: 'ms' as const, value: 300 }, next: { type: 'replan' as const } }
  }
}
