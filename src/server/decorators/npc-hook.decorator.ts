import { NPC_INTELLIGENCE_METADATA } from './metadata-keys'

export function OnNpcHook(hook: string): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    Reflect.defineMetadata(NPC_INTELLIGENCE_METADATA.HOOK, hook, descriptor.value as object)
  }
}
