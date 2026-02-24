import { NPC_INTELLIGENCE_CLIENT_METADATA } from './metadata-keys'

export function NpcController(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(NPC_INTELLIGENCE_CLIENT_METADATA.CONTROLLER, true, target)
  }
}
