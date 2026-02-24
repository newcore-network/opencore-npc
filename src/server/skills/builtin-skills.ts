import type { NpcSkillContract } from '../types'

export function createBuiltInSkills(): NpcSkillContract[] {
  return [
    {
      key: 'idle',
      execute: async () => ({ ok: true, waitMs: 400 }),
    },
    {
      key: 'moveTo',
      execute: async (ctx, args) => {
        const input = args as { x?: number; y?: number; z?: number } | undefined
        if (
          typeof input?.x !== 'number' ||
          typeof input?.y !== 'number' ||
          typeof input?.z !== 'number'
        ) {
          return { ok: false, error: 'moveTo requires { x, y, z }' }
        }
        ctx.npcEntity.setPosition({ x: input.x, y: input.y, z: input.z })
        return { ok: true, waitMs: 250 }
      },
    },
    {
      key: 'setHeading',
      execute: async (ctx, args) => {
        const input = args as { heading?: number } | undefined
        if (typeof input?.heading !== 'number') {
          return { ok: false, error: 'setHeading requires { heading }' }
        }
        ctx.npcEntity.setHeading(input.heading)
        return { ok: true }
      },
    },
  ]
}
