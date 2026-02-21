import type { NpcExecuteSkillMsg } from '../../../../shared/contracts/npc-wire.contracts'

/**
 * Minimal client executor used by connected mode.
 *
 * @remarks
 * Executes task natives for streamed NPCs.
 */
export class FiveMNpcExecutorClient {
  /** Executes one delegated skill call. */
  async execute(msg: NpcExecuteSkillMsg): Promise<{ executed: true }> {
    const ped = NetworkGetEntityFromNetworkId(msg.npcNetId)
    if (!ped || !DoesEntityExist(ped)) {
      throw new Error(`NPC netId '${msg.npcNetId}' is not streamed on this client`)
    }

    switch (msg.skill) {
      case 'moveTo': {
        const { x, y, z, speed } = msg.args as { x: number; y: number; z: number; speed: number }
        TaskGoStraightToCoord(ped, x, y, z, speed, -1, 0.0, 0.0)
        break
      }
      case 'goToEntity': {
        const { entity, stopDistance, speed } = msg.args as {
          entity: number
          stopDistance: number
          speed: number
        }
        let targetEntity = entity
        if (!targetEntity || !DoesEntityExist(targetEntity)) {
          targetEntity = resolveNetworkEntity(entity)
        }
        if (!targetEntity || !DoesEntityExist(targetEntity)) {
          throw new Error('goToEntity target not available on executor client')
        }
        const coords = GetEntityCoords(targetEntity, true)
        TaskGoStraightToCoord(
          ped,
          Number(coords[0] ?? 0),
          Number(coords[1] ?? 0),
          Number(coords[2] ?? 0),
          speed,
          -1,
          0.0,
          stopDistance,
        )
        break
      }
      case 'wanderArea': {
        const { x, y, z, radius } = msg.args as { x: number; y: number; z: number; radius: number }
        TaskWanderInArea(ped, x, y, z, radius, 2.0, 6.0)
        break
      }
      case 'enterVehicle': {
        const { vehicleNetId, seat, timeoutMs } = msg.args as {
          vehicleNetId: number
          seat: number
          timeoutMs?: number
        }
        const vehicle = resolveNetworkEntity(vehicleNetId)
        if (!vehicle || !DoesEntityExist(vehicle)) {
          throw new Error(`Vehicle netId '${vehicleNetId}' is not streamed on executor client`)
        }
        TaskEnterVehicle(ped, vehicle, timeoutMs ?? 8000, seat, 2.0, 1, 0)
        const entered = await waitUntilInVehicle(ped, vehicle, timeoutMs ?? 8000)
        if (!entered) {
          throw new Error('NPC could not enter vehicle in time')
        }
        break
      }
      case 'leaveVehicle': {
        const vehicle = GetVehiclePedIsIn(ped, false)
        if (vehicle && vehicle !== 0) {
          TaskLeaveVehicle(ped, vehicle, 0)
        }
        break
      }
      case 'driveTo': {
        const { x, y, z, speed, drivingStyle, stoppingRange } = msg.args as {
          x: number
          y: number
          z: number
          speed: number
          drivingStyle: number
          stoppingRange: number
        }
        const vehicle = GetVehiclePedIsIn(ped, false)
        if (!vehicle || vehicle === 0) {
          throw new Error('NPC is not in a vehicle for driveTo')
        }
        TaskVehicleDriveToCoordLongrange(ped, vehicle, x, y, z, speed, drivingStyle, stoppingRange)
        break
      }
      case 'parkVehicle': {
        const { heading, stopEngine } = msg.args as { heading?: number; stopEngine: boolean }
        const vehicle = GetVehiclePedIsIn(ped, false)
        if (!vehicle || vehicle === 0) {
          throw new Error('NPC is not in a vehicle for parkVehicle')
        }
        const coords = GetEntityCoords(vehicle, true)
        TaskVehiclePark(
          ped,
          vehicle,
          Number(coords[0] ?? 0),
          Number(coords[1] ?? 0),
          Number(coords[2] ?? 0),
          heading ?? GetEntityHeading(vehicle),
          0,
          3,
          !stopEngine,
        )
        break
      }
      default:
        throw new Error(`Unsupported delegated skill '${msg.skill}'`)
    }

    return { executed: true }
  }
}

function resolveNetworkEntity(netId: number): number {
  const g = globalThis as Record<string, unknown>
  const hasNetEntity = typeof g.NetworkDoesEntityExistWithNetworkId === 'function'
    ? (g.NetworkDoesEntityExistWithNetworkId as (id: number) => boolean)
    : undefined

  if (hasNetEntity && !hasNetEntity(netId)) {
    return 0
  }

  if (typeof g.NetworkGetEntityFromNetworkId !== 'function') {
    return 0
  }

  return (g.NetworkGetEntityFromNetworkId as (id: number) => number)(netId)
}

async function waitUntilInVehicle(ped: number, vehicle: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + Math.max(1500, timeoutMs)
  while (Date.now() < deadline) {
    const current = GetVehiclePedIsIn(ped, false)
    if (current && current === vehicle) {
      return true
    }
    await delay(120)
  }
  return false
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
