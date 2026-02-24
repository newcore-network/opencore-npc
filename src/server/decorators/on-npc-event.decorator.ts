import { NPC_INTELLIGENCE_METADATA } from './metadata-keys'

export function OnNpcEvent(eventName: string): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    Reflect.defineMetadata(NPC_INTELLIGENCE_METADATA.EVENT, eventName, descriptor.value as object)
  }
}
