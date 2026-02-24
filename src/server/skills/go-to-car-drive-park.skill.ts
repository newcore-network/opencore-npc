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
    if (!ctx.npc.exists) {
      return { ok: false, error: 'goToCarDrivePark requires an existing NPC entity' }
    }

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

    const pedHandle = ctx.npc.handle
    const vehicleHandle = getVehicleHandle(args.vehicleNetId)
    if (!vehicleHandle) {
      return {
        ok: false,
        error: `Vehicle netId ${args.vehicleNetId} not found or invalid`,
      }
    }

    const seat = typeof args.seat === 'number' ? args.seat : -1
    const driveSpeed = typeof args.driveSpeed === 'number' ? args.driveSpeed : 18
    const drivingStyle = typeof args.drivingStyle === 'number' ? args.drivingStyle : 786603
    const parkHeading = typeof args.parkHeading === 'number' ? args.parkHeading : ctx.npc.getHeading()

    const step = ctx.state.get<number>('goToCarDrivePark.step') ?? 0

    if (step === 0) {
      taskEnterVehicle(pedHandle, vehicleHandle, seat)
      ctx.state.set('goToCarDrivePark.step', 1)
      return {
        ok: true,
        waitMs: 900,
        memory: {
          type: 'goToCarDrivePark',
          state: 'entering_vehicle',
          vehicleNetId: args.vehicleNetId,
        },
      }
    }

    if (step === 1) {
      if (!isPedInVehicle(pedHandle, vehicleHandle)) {
        taskEnterVehicle(pedHandle, vehicleHandle, seat)
        return {
          ok: true,
          waitMs: 900,
          memory: {
            type: 'goToCarDrivePark',
            state: 'waiting_enter_vehicle',
          },
        }
      }

      taskDriveTo(pedHandle, vehicleHandle, args.dest, driveSpeed, drivingStyle)
      ctx.state.set('goToCarDrivePark.step', 2)
      return {
        ok: true,
        waitMs: 1200,
        memory: {
          type: 'goToCarDrivePark',
          state: 'driving_to_destination',
          dest: args.dest,
        },
      }
    }

    if (step === 2) {
      if (!isNear(ctx.npc.getPosition(), args.dest, 8)) {
        taskDriveTo(pedHandle, vehicleHandle, args.dest, driveSpeed, drivingStyle)
        return {
          ok: true,
          waitMs: 1200,
          memory: {
            type: 'goToCarDrivePark',
            state: 'en_route',
          },
        }
      }

      taskPark(pedHandle, vehicleHandle, args.dest, parkHeading)
      ctx.state.set('goToCarDrivePark.step', 3)
      return {
        ok: true,
        waitMs: 900,
        memory: {
          type: 'goToCarDrivePark',
          state: 'parking',
        },
      }
    }

    if (typeof args.parkHeading === 'number') {
      ctx.npc.setHeading(args.parkHeading)
    }

    ctx.state.set('goToCarDrivePark.step', 0)

    return {
      ok: true,
      memory: {
        type: 'goToCarDrivePark',
        state: 'done',
        vehicleNetId: args.vehicleNetId,
        dest: args.dest,
      },
    }
  }
}

function getVehicleHandle(vehicleNetId: number): number | undefined {
  if (!NetworkDoesEntityExistWithNetworkId(vehicleNetId)) {
    return undefined
  }

  const handle = NetworkGetEntityFromNetworkId(vehicleNetId)
  if (!handle || handle <= 0) {
    return undefined
  }

  return DoesEntityExist(handle) ? handle : undefined
}

function isPedInVehicle(pedHandle: number, vehicleHandle: number): boolean {
  return IsPedInVehicle(pedHandle, vehicleHandle, false)
}

function taskEnterVehicle(pedHandle: number, vehicleHandle: number, seat: number): void {
  TaskEnterVehicle(pedHandle, vehicleHandle, -1, seat, 2.0, 1, 0)
}

function taskDriveTo(
  pedHandle: number,
  vehicleHandle: number,
  dest: { x: number; y: number; z: number },
  speed: number,
  drivingStyle: number,
): void {
  TaskVehicleDriveToCoordLongrange(pedHandle, vehicleHandle, dest.x, dest.y, dest.z, speed, drivingStyle, 5)
}

function taskPark(
  pedHandle: number,
  vehicleHandle: number,
  dest: { x: number; y: number; z: number },
  heading: number,
): void {
  TaskVehiclePark(pedHandle, vehicleHandle, dest.x, dest.y, dest.z, heading, 1, 2.5, true)
}

function isNear(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  radius: number,
): boolean {
  const dx = from.x - to.x
  const dy = from.y - to.y
  const dz = from.z - to.z
  return dx * dx + dy * dy + dz * dz <= radius * radius
}
