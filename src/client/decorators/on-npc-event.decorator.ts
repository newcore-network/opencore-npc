import { NPC_CLIENT_METADATA_KEYS } from './metadata-keys'
import { Client } from '@open-core/framework/client'

/** Registers a gameplay NPC event listener on a client method. */
export function OnNpcEvent(eventName: string) {
  return (target: object, propertyKey: string | symbol): void => {
    Client.OnNet(`opencore:npc:event:${eventName}`)(target as Record<string, unknown>, propertyKey as string)
    Reflect.defineMetadata(NPC_CLIENT_METADATA_KEYS.EVENT, { eventName }, target, propertyKey)
  }
}
