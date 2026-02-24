import { NPC_INTELLIGENCE_CLIENT_METADATA } from './metadata-keys'

/** Marks a client method as an NPC event handler. */
export function OnNpcEvent(name: string): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    Reflect.defineMetadata(NPC_INTELLIGENCE_CLIENT_METADATA.EVENT, name, descriptor.value as object)
  }
}
