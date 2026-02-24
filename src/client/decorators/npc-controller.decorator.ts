import { NPC_INTELLIGENCE_CLIENT_METADATA } from './metadata-keys'

/** Declares a class as a client-side NPC intelligence controller. */
export function NpcIntelligentController(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(NPC_INTELLIGENCE_CLIENT_METADATA.CONTROLLER, true, target)
  }
}
