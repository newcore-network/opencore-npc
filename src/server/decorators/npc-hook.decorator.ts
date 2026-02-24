import { NPC_INTELLIGENCE_METADATA } from './metadata-keys'

/** Marks a method as a hook handler for intelligence lifecycle events. */
export function OnNpcHook(hook: string): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    Reflect.defineMetadata(NPC_INTELLIGENCE_METADATA.HOOK, hook, descriptor.value as object)
  }
}
