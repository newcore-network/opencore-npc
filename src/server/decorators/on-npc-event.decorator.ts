import { NPC_INTELLIGENCE_METADATA } from './metadata-keys'

/** Marks a method as an NPC event handler. */
export function OnNpcEvent(eventName: string): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    Reflect.defineMetadata(NPC_INTELLIGENCE_METADATA.EVENT, eventName, descriptor.value as object)
  }
}
