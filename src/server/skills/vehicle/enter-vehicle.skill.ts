import { z } from 'zod'
import type { NpcSkill } from '../../runtime/contracts/npc-skill.interface'
import type { NpcContext } from '../../runtime/context/npc-context.types'

const ArgsSchema = z.object({
  vehicleNetId: z.number(),
  seat: z.number().default(-1),
  timeoutMs: z.number().optional(),
})

/** Built-in skill that enters a target vehicle seat. */
export class EnterVehicleSkill implements NpcSkill<z.infer<typeof ArgsSchema>> {
  readonly key = 'enterVehicle'
  readonly tags = ['vehicle', 'movement']
  readonly mutex = 'movement'

  /** Validates and normalizes enter-vehicle arguments. */
  validate(input: unknown): z.infer<typeof ArgsSchema> {
    return ArgsSchema.parse(input)
  }

  /** Executes enter-vehicle through transport and schedules wait-until. */
  async execute(ctx: NpcContext, args: z.infer<typeof ArgsSchema>) {
    ctx.events.emit('npc:state', { state: 'entering_vehicle', vehicle: args.vehicleNetId }, { scope: 'nearby', radius: 120 })
    await ctx.transport.enterVehicle(ctx.npc, args)
    return { ok: true as const, wait: { type: 'until' as const, key: 'inVehicle', timeoutMs: args.timeoutMs ?? 8000 }, next: { type: 'replan' as const } }
  }
}
