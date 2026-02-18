import type { NpcIdentity } from '../../../shared/contracts/npc-types'

/**
 * Platform transport boundary used by all built-in and third-party skills.
 */
export interface NpcTransport {
  moveTo(npc: NpcIdentity, req: { x: number; y: number; z: number; speed: number }): Promise<void>
  goToEntity(
    npc: NpcIdentity,
    req: { entity: number; stopDistance: number; speed: number },
  ): Promise<void>
  wanderArea(npc: NpcIdentity, req: { x: number; y: number; z: number; radius: number }): Promise<void>
  enterVehicle(
    npc: NpcIdentity,
    req: { vehicleNetId: number; seat: number; timeoutMs?: number },
  ): Promise<void>
  leaveVehicle(npc: NpcIdentity, req: { timeoutMs?: number }): Promise<void>
  driveTo(
    npc: NpcIdentity,
    req: {
      x: number
      y: number
      z: number
      speed: number
      drivingStyle: number
      stoppingRange: number
    },
  ): Promise<void>
  parkVehicle(
    npc: NpcIdentity,
    req: { heading?: number; stopEngine: boolean; handbrake: boolean },
  ): Promise<void>
  isWaitSatisfied(
    npc: NpcIdentity,
    key: string,
    state?: { get<T>(k: string): T | undefined },
  ): boolean
}
