import { z } from 'zod'
import type { NpcSkill } from '../../runtime/contracts/npc-skill.interface'
import type { NpcContext } from '../../runtime/context/npc-context.types'

const ArgsSchema = z.object({
  timeoutMs: z.number().optional(),
})

/** Built-in skill that exits the current vehicle. */
export class LeaveVehicleSkill implements NpcSkill<z.infer<typeof ArgsSchema>> {
  readonly key = 'leaveVehicle'
  readonly tags = ['vehicle']
  readonly mutex = 'movement'

  /** Validates and normalizes leave-vehicle arguments. */
  validate(input: unknown): z.infer<typeof ArgsSchema> {
    return ArgsSchema.parse(input)
  }

  /** Executes leave-vehicle through transport and schedules wait-until. */
  async execute(ctx: NpcContext, args: z.infer<typeof ArgsSchema>) {
    ctx.events.emit('npc:state', { state: 'leaving_vehicle' }, { scope: 'nearby', radius: 120 })
    await ctx.transport.leaveVehicle(ctx.npc, args)
    return { ok: true as const, wait: { type: 'until' as const, key: 'notInVehicle', timeoutMs: args.timeoutMs ?? 6000 }, next: { type: 'replan' as const } }
  }
}
