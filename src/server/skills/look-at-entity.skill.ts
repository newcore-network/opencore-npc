import type { BaseEntity, NativeHandle, Spatial, Vector3 } from '@open-core/framework'
import { Player } from '@open-core/framework/server'
import { NpcSkill } from '../decorators/npc-skill.decorator'
import type { NpcSkill as NpcSkillContract } from '../decorators/npc-skill.decorator'
import type { NpcContext, SkillResult } from '../types'

type SpatialBaseEntity = BaseEntity & Spatial
type HandleLikeEntity = SpatialBaseEntity & Partial<NativeHandle> & { handle?: number }

export type LookAtEntityArgs = {
  entity: HandleLikeEntity
  durationMs?: number
  track?: boolean
  tickIntervalMs?: number
}

/**
 * Turns an NPC to face another entity.
 *
 * @remarks
 * Uses task natives when both source and target handles are available.
 * Falls back to heading math otherwise.
 */
@NpcSkill()
export class LookAtEntitySkill implements NpcSkillContract<LookAtEntityArgs> {
  execute(ctx: NpcContext, args: LookAtEntityArgs): SkillResult {
    const target = args?.entity
    if (!target || typeof target.getPosition !== 'function') {
      return { ok: false, error: 'lookAtEntity requires { entity: BaseEntity & Spatial }' }
    }

    const durationMs = clamp(args.durationMs ?? 1500, 0, 60_000)
    const track = args.track ?? true
    const tickIntervalMs = clamp(args.tickIntervalMs ?? 200, 16, 2000)

    const pedHandle = getNpcPedHandleSafe(ctx)
    if (pedHandle == null) {
      const heading = computeHeading(ctx.npc.getPosition(), target.getPosition())
      ctx.npc.setHeading(heading)
      return okMemory(target.id, heading, 'math-fallback-no-ped-handle')
    }

    const targetHandle = getEntityHandle(target)
    if (!track) {
      runLookOnce(pedHandle, target, targetHandle, durationMs)
      return okMemory(target.id, undefined, targetHandle ? 'native:entity-once' : 'native:coord-once')
    }

    const startedAt = Date.now()
    const loop = () => {
      const elapsed = Date.now() - startedAt
      if (elapsed >= durationMs) return
      runLookOnce(pedHandle, target, targetHandle, tickIntervalMs + 50)
      setTimeout(loop, tickIntervalMs)
    }

    loop()
    return okMemory(target.id, undefined, targetHandle ? 'native:entity-tracked' : 'native:coord-tracked')
  }
}

function runLookOnce(
  pedHandle: number,
  target: HandleLikeEntity,
  targetHandle: number | undefined,
  durationMs: number,
): void {
  if (targetHandle !== undefined) {
    TaskTurnPedToFaceEntity(pedHandle, targetHandle, durationMs)
    TaskLookAtEntity(pedHandle, targetHandle, durationMs, 2048, 3)
    return
  }

  const pos = target.getPosition()
  TaskTurnPedToFaceCoord(pedHandle, pos.x, pos.y, pos.z, durationMs)
  TaskLookAtCoord(pedHandle, pos.x, pos.y, pos.z, durationMs, 2048, 3)
}

function getNpcPedHandleSafe(ctx: NpcContext): number | null {
  const npc = ctx.npc as unknown as { getHandle?: () => unknown; handle?: unknown }
  if (typeof npc.getHandle === 'function') {
    const handle = npc.getHandle()
    return typeof handle === 'number' ? handle : null
  }

  return typeof npc.handle === 'number' ? npc.handle : null
}

function getEntityHandle(entity: HandleLikeEntity): number | undefined {
  if (entity instanceof Player) {
    const playerPed = GetPlayerPed(String(entity.clientID))
    if (typeof playerPed === 'number' && playerPed > 0 && DoesEntityExist(playerPed)) {
      return playerPed
    }
  }

  const withHandle = entity as { getHandle?: () => unknown; handle?: unknown }
  if (typeof withHandle.getHandle === 'function') {
    const resolved = withHandle.getHandle()
    if (typeof resolved === 'number' && resolved > 0 && DoesEntityExist(resolved)) {
      return resolved
    }
  }

  if (typeof withHandle.handle === 'number' && withHandle.handle > 0) {
    return DoesEntityExist(withHandle.handle) ? withHandle.handle : undefined
  }

  return undefined
}

function okMemory(targetId: string, heading?: number, mode?: string): SkillResult {
  return {
    ok: true,
    memory: {
      type: 'lookAtEntity',
      targetId,
      heading,
      mode,
      at: Date.now(),
    },
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function computeHeading(from: Vector3, to: Vector3): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const radians = Math.atan2(dx, dy)
  const degrees = (radians * 180) / Math.PI
  const normalized = degrees % 360
  return normalized < 0 ? normalized + 360 : normalized
}
