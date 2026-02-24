import type { NpcControllerDefinition } from '../types'
import { NPC_INTELLIGENCE_METADATA } from './metadata-keys'

const controllers = new Map<string, NpcControllerDefinition>()

export function NpcController(definition: NpcControllerDefinition): ClassDecorator {
  return (target) => {
    if (!definition?.id) {
      throw new Error('NpcController requires a non-empty id')
    }
    controllers.set(definition.id, definition)
    Reflect.defineMetadata(NPC_INTELLIGENCE_METADATA.CONTROLLER, definition, target)
  }
}

export function getNpcControllers(): Map<string, NpcControllerDefinition> {
  return new Map(controllers)
}
