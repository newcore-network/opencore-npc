import { Server } from '@open-core/framework/server'
import type { NpcIntelligentControllerDefinition } from '../types'
import { NPC_INTELLIGENCE_METADATA } from './metadata-keys'

const controllers = new Map<string, NpcIntelligentControllerDefinition>()

/**
 * Declares a class as an NPC intelligence controller.
 *
 * @remarks
 * This decorator also applies `Server.Controller()` so the class can
 * participate in OpenCore server lifecycle and DI wiring.
 */
export function NpcIntelligentController(definition: NpcIntelligentControllerDefinition): ClassDecorator {
  return (target) => {
    if (!definition?.id) {
      throw new Error('NpcIntelligentController requires a non-empty id')
    }

    Server.Controller()(target as never)
    controllers.set(definition.id, definition)
    Reflect.defineMetadata(NPC_INTELLIGENCE_METADATA.CONTROLLER, definition, target)
  }
}

export function getNpcIntelligentControllers(): Map<string, NpcIntelligentControllerDefinition> {
  return new Map(controllers)
}
