import { randomUUID } from 'node:crypto'
import type { NpcIdentity, NpcSpawnInput } from '../../../shared/contracts/npc-types'

export class NpcEntityService {
  private readonly byNpcId = new Map<string, number>()
  private readonly mockNetIdByPed = new Map<number, number>()
  private nextMockPed = 10_000
  private nextMockNetId = 50_000

  async spawn(input: NpcSpawnInput): Promise<NpcIdentity> {
    const g = globalThis as Record<string, unknown>
    const modelHash = typeof g.GetHashKey === 'function' ? GetHashKey(input.model) : 0

    let handle = 0
    if (typeof g.CreatePed === 'function') {
      handle = CreatePed(
        4,
        modelHash,
        input.pos.x,
        input.pos.y,
        input.pos.z,
        input.heading ?? 0,
        input.networked ?? true,
        true,
      )
    } else {
      handle = this.nextMockPed++
    }

    if (!handle || handle === 0) {
      throw new Error(`Failed to spawn NPC ped for model '${input.model}'`)
    }

    const npcId = randomUUID()
    this.byNpcId.set(npcId, handle)

    if (typeof input.heading === 'number' && typeof g.SetEntityHeading === 'function') {
      SetEntityHeading(handle, input.heading)
    }

    let netId = 0
    if (typeof g.NetworkGetNetworkIdFromEntity === 'function') {
      netId = await this.waitForNetworkId(handle, input.networked ?? true)
    } else if (input.networked) {
      netId = this.nextMockNetId++
      this.mockNetIdByPed.set(handle, netId)
    }

    return {
      id: npcId,
      ped: handle,
      netId: netId > 0 ? netId : undefined,
    }
  }

  despawn(npcId: string): void {
    const handle = this.byNpcId.get(npcId)
    if (!handle) return
    const g = globalThis as Record<string, unknown>
    if (this.doesEntityExist(handle) && typeof g.DeleteEntity === 'function') {
      DeleteEntity(handle)
    }
    this.mockNetIdByPed.delete(handle)
    this.byNpcId.delete(npcId)
  }

  getHandle(npcId: string): number | undefined {
    return this.byNpcId.get(npcId)
  }

  exists(npcId: string): boolean {
    const handle = this.byNpcId.get(npcId)
    return typeof handle === 'number' && this.doesEntityExist(handle)
  }

  private doesEntityExist(handle: number): boolean {
    const g = globalThis as Record<string, unknown>
    if (typeof g.DoesEntityExist === 'function') {
      return DoesEntityExist(handle)
    }
    return this.byNpcId.size === 0 ? false : [...this.byNpcId.values()].includes(handle)
  }

  private async waitForNetworkId(handle: number, networked: boolean): Promise<number> {
    if (!networked) {
      return 0
    }

    const g = globalThis as Record<string, unknown>
    const getNetId = typeof g.NetworkGetNetworkIdFromEntity === 'function'
      ? (NetworkGetNetworkIdFromEntity as (entity: number) => number)
      : undefined
    if (!getNetId) {
      return 0
    }

    const hasNetEntity =
      typeof g.NetworkDoesEntityExistWithNetworkId === 'function'
        ? (NetworkDoesEntityExistWithNetworkId as (netId: number) => boolean)
        : undefined

    const deadline = Date.now() + 1000
    while (Date.now() < deadline) {
      const netId = getNetId(handle)
      if (netId > 0) {
        if (!hasNetEntity || hasNetEntity(netId)) {
          return netId
        }
      }
      await sleep(20)
    }

    return getNetId(handle)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
