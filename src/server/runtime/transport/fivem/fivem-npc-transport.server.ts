import type { NpcTransport } from '../npc-transport.interface'
import type { NpcIdentity } from '../../../../shared/contracts/npc-types'
import { debugTransport } from './transport-debug'

/** Connected-mode bridge used to delegate execution to a client. */
export interface NpcWireBridgePort {
  executeSkill(
    executorClientId: number,
    msg: { npcNetId: number; skill: string; args: unknown },
    timeoutMs?: number,
  ): Promise<unknown>
}

/**
 * FiveM transport implementation for NPC skill execution.
 *
 * @remarks
 * Uses server natives where available and connected delegation for client-only tasks.
 */
export class FiveMNpcTransportServer implements NpcTransport {
  private readonly delegatedDrivePlanByNpc = new Map<string, { x: number; y: number; z: number; satisfyAt: number }>()

  constructor(
    private readonly options?: {
      wireBridge?: NpcWireBridgePort
      chooseExecutorClient?: (npc: NpcIdentity) => number | undefined
    },
  ) {}

  async moveTo(npc: NpcIdentity, req: { x: number; y: number; z: number; speed: number }): Promise<void> {
    const delegated = await this.tryDelegate(npc, 'moveTo', req)
    if (delegated) return

    const ped = this.requirePed(npc)
    if (typeof (globalThis as Record<string, unknown>).TaskGoStraightToCoord === 'function') {
      TaskGoStraightToCoord(ped, req.x, req.y, req.z, req.speed, -1, 0.0, 0.0)
    }
  }

  async goToEntity(
    npc: NpcIdentity,
    req: { entity: number; stopDistance: number; speed: number },
  ): Promise<void> {
    const ped = this.requirePed(npc)
    const entity = req.entity
    if (!this.doesEntityExist(entity)) {
      throw new Error(`Target entity '${entity}' does not exist`)
    }
    const pos = this.getCoords(entity)
    if (typeof (globalThis as Record<string, unknown>).TaskGoStraightToCoord === 'function') {
      TaskGoStraightToCoord(ped, pos.x, pos.y, pos.z, req.speed, -1, 0.0, req.stopDistance)
    }
  }

  async wanderArea(npc: NpcIdentity, req: { x: number; y: number; z: number; radius: number }): Promise<void> {
    const delegated = await this.tryDelegate(npc, 'wanderArea', req)
    if (delegated) return

    const ped = this.requirePed(npc)
    const angle = Math.random() * Math.PI * 2
    const tx = req.x + Math.cos(angle) * req.radius
    const ty = req.y + Math.sin(angle) * req.radius
    TaskGoStraightToCoord(ped, tx, ty, req.z, 1.2, -1, 0.0, 0.5)
  }

  async enterVehicle(
    npc: NpcIdentity,
    req: { vehicleNetId: number; seat: number; timeoutMs?: number },
  ): Promise<void> {
    const ped = this.requirePed(npc)
    const vehicle = this.getEntityFromNetworkId(req.vehicleNetId)
    if (!vehicle || !this.doesEntityExist(vehicle)) {
      throw new Error(`Vehicle netId '${req.vehicleNetId}' not found`)
    }
    if (typeof (globalThis as Record<string, unknown>).TaskEnterVehicle === 'function') {
      TaskEnterVehicle(ped, vehicle, req.timeoutMs ?? 8000, req.seat, 2.0, 1, 0)
    }
  }

  async leaveVehicle(npc: NpcIdentity, _req: { timeoutMs?: number }): Promise<void> {
    const ped = this.requirePed(npc)
    const vehicle = GetVehiclePedIsIn(ped, false)
    if (!vehicle || vehicle === 0) return
    if (typeof (globalThis as Record<string, unknown>).TaskLeaveVehicle === 'function') {
      TaskLeaveVehicle(ped, vehicle, 0)
    }
  }

  async driveTo(
    npc: NpcIdentity,
    req: {
      x: number
      y: number
      z: number
      speed: number
      drivingStyle: number
      stoppingRange: number
    },
  ): Promise<void> {
    const delegated = await this.tryDelegate(npc, 'driveTo', req)
    if (delegated.ok) {
      this.planOptimisticNearDestination(npc, req)
      return
    }
    throw new Error(`driveTo requires connected mode executor in current server transport (${delegated.reason})`)
  }

  async parkVehicle(
    npc: NpcIdentity,
    req: { heading?: number; stopEngine: boolean; handbrake: boolean },
  ): Promise<void> {
    const delegated = await this.tryDelegate(npc, 'parkVehicle', req)
    if (delegated.ok) {
      this.delegatedDrivePlanByNpc.delete(npc.id)
      return
    }
    throw new Error(`parkVehicle requires connected mode executor in current server transport (${delegated.reason})`)
  }

  isWaitSatisfied(
    npc: NpcIdentity,
    key: string,
    state?: { get<T>(k: string): T | undefined },
  ): boolean {
    const ped = npc?.ped
    if (!ped || !this.doesEntityExist(ped)) return false

    if (key === 'inVehicle') {
      return IsPedInAnyVehicle(ped)
    }

    if (key === 'notInVehicle') {
      return !IsPedInAnyVehicle(ped)
    }

    if (key === 'nearVehicle') {
      const targetVehNetId = state?.get<number>('targetVeh')
      if (!targetVehNetId) return false
      const vehicle = this.getEntityFromNetworkId(targetVehNetId)
      if (!vehicle || !this.doesEntityExist(vehicle)) return false

      const a = this.getCoords(ped)
      const b = this.getCoords(vehicle)
      return distance(a, b) <= 3
    }

    if (key === 'nearDestination') {
      const target = state?.get<{ x: number; y: number; z: number }>('targetDest')
      if (!target) return false
      const current = this.getCoords(ped)
      if (distance(current, target) <= 8) {
        return true
      }

      const optimistic = this.delegatedDrivePlanByNpc.get(npc.id)
      if (!optimistic) {
        return false
      }

      const targetMismatch = distance(target, optimistic) > 12
      if (targetMismatch) {
        return false
      }

      return Date.now() >= optimistic.satisfyAt
    }

    return false
  }

  private requirePed(npc: NpcIdentity): number {
    const ped = npc?.ped
    if (!ped || !this.doesEntityExist(ped)) {
      throw new Error(`NPC ped '${ped ?? 'unknown'}' does not exist`)
    }
    return ped
  }

  private doesEntityExist(entity: number): boolean {
    if (typeof (globalThis as Record<string, unknown>).DoesEntityExist === 'function') {
      return DoesEntityExist(entity)
    }
    return entity > 0
  }

  private getCoords(entity: number): { x: number; y: number; z: number } {
    if (typeof (globalThis as Record<string, unknown>).GetEntityCoords === 'function') {
      const coords = GetEntityCoords(entity)
      return {
        x: Number(coords[0] ?? 0),
        y: Number(coords[1] ?? 0),
        z: Number(coords[2] ?? 0),
      }
    }
    return { x: 0, y: 0, z: 0 }
  }

  private getEntityFromNetworkId(netId: number): number {
    if (typeof (globalThis as Record<string, unknown>).NetworkGetEntityFromNetworkId === 'function') {
      return NetworkGetEntityFromNetworkId(netId)
    }
    return netId
  }

  private async tryDelegate(
    npc: NpcIdentity,
    skill: string,
    args: unknown,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (!this.options?.wireBridge || !this.options?.chooseExecutorClient) {
      this.debugDelegation('FAIL', { skill, npcId: npc.id, reason: 'connected_disabled' })
      return { ok: false, reason: 'connected_disabled' }
    }

    const executor = this.options.chooseExecutorClient(npc)
    let netId = npc.netId
    if ((!netId || netId <= 0) && npc.ped && typeof (globalThis as Record<string, unknown>).NetworkGetNetworkIdFromEntity === 'function') {
      const resolvedNetId = NetworkGetNetworkIdFromEntity(npc.ped)
      if (resolvedNetId > 0) {
        netId = resolvedNetId
        npc.netId = resolvedNetId
      }
    }

    if (!executor || !netId) {
      const reason = !executor ? 'no_executor' : 'missing_npc_netid'
      this.debugDelegation('FAIL', { skill, npcId: npc.id, reason, executor, netId })
      return { ok: false, reason }
    }

    this.debugDelegation('SEND', { skill, npcId: npc.id, npcNetId: netId, executor })

    try {
      await this.options.wireBridge.executeSkill(
        executor,
        {
          npcNetId: netId,
          skill,
          args,
        },
        4_500,
      )
    } catch (error) {
      this.debugDelegation('FAIL', {
        skill,
        npcId: npc.id,
        npcNetId: netId,
        executor,
        reason: error instanceof Error ? error.message : String(error),
      })
      throw error
    }

    this.debugDelegation('OK', { skill, npcId: npc.id, npcNetId: netId, executor })

    return { ok: true }
  }

  private debugDelegation(stage: 'SEND' | 'OK' | 'FAIL', payload: unknown): void {
    debugTransport(
      stage === 'SEND' ? 'DELEGATE_SEND' : stage === 'OK' ? 'DELEGATE_OK' : 'DELEGATE_FAIL',
      payload,
    )
  }

  private planOptimisticNearDestination(
    npc: NpcIdentity,
    req: { x: number; y: number; z: number; speed: number },
  ): void {
    const ped = npc?.ped
    const current = ped && this.doesEntityExist(ped) ? this.getCoords(ped) : { x: req.x, y: req.y, z: req.z }
    const meters = distance(current, req)
    const speed = Math.max(5, req.speed)
    const travelMs = Math.min(60_000, Math.max(4_000, (meters / speed) * 1000))
    const settleMs = 3_000

    this.delegatedDrivePlanByNpc.set(npc.id, {
      x: req.x,
      y: req.y,
      z: req.z,
      satisfyAt: Date.now() + travelMs + settleMs,
    })
  }
}

function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
}
