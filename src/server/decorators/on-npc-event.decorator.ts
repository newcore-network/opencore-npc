import { NPC_METADATA_KEYS } from './metadata-keys'

/**
 * Registers a gameplay event listener on a method.
 *
 * @param eventName - Gameplay event key (example: `npc:state`).
 */
export function OnNpcEvent(eventName: string) {
  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(NPC_METADATA_KEYS.EVENT, { eventName }, target, propertyKey)
  }
}
