import { z } from 'zod'
import type { NpcSkill } from '../../runtime/contracts/npc-skill.interface'
import type { NpcContext } from '../../runtime/context/npc-context.types'

const ArgsSchema = z.object({
  vehicleNetId: z.number(),
  dest: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  parkHeading: z.number().optional(),
  seat: z.number().optional(),
  driveSpeed: z.number().optional(),
  drivingStyle: z.number().optional(),
})

/**
 * Built-in composed skill: go to car, enter, drive, and park.
 *
 * @remarks
 * Uses an internal step state-machine in `ctx.state`.
 */
export class GoToCarDriveParkSkill implements NpcSkill<z.infer<typeof ArgsSchema>> {
  readonly key = 'goToCarDrivePark'
  readonly tags = ['vehicle', 'movement', 'utility']
  readonly mutex = 'movement'

  /** Validates and normalizes composed-skill arguments. */
  validate(input: unknown): z.infer<typeof ArgsSchema> {
    return ArgsSchema.parse(input)
  }

  /** Runs one step of the composed flow and returns continuation instructions. */
  async execute(ctx: NpcContext, args: z.infer<typeof ArgsSchema>) {
    ctx.state.set('targetVeh', args.vehicleNetId)
    ctx.state.set('targetDest', args.dest)

    const step = ctx.state.get<number>('goToCarDrivePark.step') ?? 0

    if (step === 0) {
      ctx.state.set('goToCarDrivePark.step', 1)
      ctx.events.emit('npc:state', { state: 'going_to_vehicle', vehicle: args.vehicleNetId }, { scope: 'nearby', radius: 120 })
      await ctx.transport.goToEntity(ctx.npc, { entity: args.vehicleNetId, stopDistance: 2.2, speed: 1.8 })
      return { ok: true as const, wait: { type: 'until' as const, key: 'nearVehicle', timeoutMs: 8000 }, next: { type: 'continue' as const } }
    }

    if (step === 1) {
      ctx.state.set('goToCarDrivePark.step', 2)
      ctx.events.emit('npc:state', { state: 'entering_vehicle', vehicle: args.vehicleNetId }, { scope: 'nearby', radius: 120 })
      await ctx.transport.enterVehicle(ctx.npc, { vehicleNetId: args.vehicleNetId, seat: args.seat ?? -1 })
      return { ok: true as const, wait: { type: 'until' as const, key: 'inVehicle', timeoutMs: 7000 }, next: { type: 'continue' as const } }
    }

    if (step === 2) {
      ctx.state.set('goToCarDrivePark.step', 3)
      ctx.events.emit('npc:state', { state: 'driving' }, { scope: 'nearby', radius: 140 })
      await ctx.transport.driveTo(ctx.npc, {
        ...args.dest,
        speed: args.driveSpeed ?? 18,
        drivingStyle: args.drivingStyle ?? 786603,
        stoppingRange: 5,
      })
      return { ok: true as const, wait: { type: 'until' as const, key: 'nearDestination', timeoutMs: 20000 }, next: { type: 'continue' as const } }
    }

    if (step === 3) {
      ctx.state.set('goToCarDrivePark.step', 4)
      ctx.events.emit('npc:state', { state: 'parking' }, { scope: 'nearby', radius: 90 })
      await ctx.transport.parkVehicle(ctx.npc, {
        heading: args.parkHeading,
        stopEngine: true,
        handbrake: true,
      })
      return { ok: true as const, wait: { type: 'ms' as const, value: 350 }, next: { type: 'continue' as const } }
    }

    ctx.state.set('goToCarDrivePark.step', 0)
    ctx.events.emit('npc:state', { state: 'parked_idle' }, { scope: 'nearby', radius: 90 })
    return { ok: true as const, next: { type: 'replan' as const } }
  }
}
