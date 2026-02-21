/**
 * Server entrypoint for the NPC plugin.
 *
 * @remarks
 * Import this module from server resources only.
 */
export * from '../shared'
export * from './npc.plugin'
export * from './api/npc-api'
export * from './decorators'
export * from './planners'
export * from './contracts'
export * from './skills'
export type { NpcContext } from './runtime/context/npc-context.types'
