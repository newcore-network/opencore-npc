import { NPC_METADATA_KEYS } from './metadata-keys'

export type NpcHookName =
  | 'beforePlan'
  | 'afterPlan'
  | 'beforeSkill'
  | 'afterSkill'
  | 'decisionRejected'
  | 'skillError'
  | 'fallbackActivated'

/**
 * Registers an engine lifecycle hook handler on a method.
 *
 * @param hook - Hook key to subscribe.
 */
export function OnNpcHook(hook: NpcHookName) {
  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(NPC_METADATA_KEYS.HOOK, { hook }, target, propertyKey)
  }
}
