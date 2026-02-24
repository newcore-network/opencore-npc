import { NpcSkill } from '../decorators/npc-skill.decorator'
import type { NpcSkill as NpcSkillContract } from '../decorators/npc-skill.decorator'
import type { NpcContext, SkillResult } from '../types'

export type GoToCarDriveParkArgs = {
  vehicleNetId: number
  dest: { x: number; y: number; z: number }
  parkHeading?: number
  seat?: number
  driveSpeed?: number
  drivingStyle?: number
}

/**
 * Built-in high-level mobility skill.
 *
 * @remarks
 * This implementation is intentionally lightweight and server-safe.
 * It stores intent in memory/state so game-specific executors can react.
 */
@NpcSkill()
export class GoToCarDriveParkSkill implements NpcSkillContract<GoToCarDriveParkArgs> {
  execute(ctx: NpcContext, args: GoToCarDriveParkArgs): SkillResult {
    if (!args || typeof args.vehicleNetId !== 'number') {
      return { ok: false, error: 'goToCarDrivePark requires vehicleNetId' }
    }

    if (
      !args.dest ||
      typeof args.dest.x !== 'number' ||
      typeof args.dest.y !== 'number' ||
      typeof args.dest.z !== 'number'
    ) {
      return { ok: false, error: 'goToCarDrivePark requires dest { x, y, z }' }
    }

    ctx.state.set('drive.vehicleNetId', args.vehicleNetId)
    ctx.state.set('drive.destination', args.dest)
    if (typeof args.parkHeading === 'number') ctx.state.set('drive.parkHeading', args.parkHeading)
    if (typeof args.seat === 'number') ctx.state.set('drive.seat', args.seat)
    if (typeof args.driveSpeed === 'number') ctx.state.set('drive.speed', args.driveSpeed)
    if (typeof args.drivingStyle === 'number') ctx.state.set('drive.style', args.drivingStyle)

    return {
      ok: true,
      waitMs: 300,
      memory: {
        type: 'goToCarDrivePark',
        vehicleNetId: args.vehicleNetId,
        dest: args.dest,
      },
    }
  }
}
