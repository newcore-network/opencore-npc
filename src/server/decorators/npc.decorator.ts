import { injectable } from 'tsyringe'
import { Server } from '@open-core/framework/server'
import { NPC_METADATA_KEYS } from './metadata-keys'
import { skillKeyOf } from '../contracts/npc-skill-ref.types'
import type { NpcControllerOptions } from '../contracts/npc-controller.types'

type ClassConstructor<T = unknown> = new (...args: never[]) => T

const registry = new Set<ClassConstructor>()

/** Returns all classes registered with `@NpcController(...)`. */
export function getNpcControllerRegistry(): ClassConstructor[] {
  return [...registry]
}

/**
 * Marks a class as an NPC controller.
 *
 * @param options - Controller configuration metadata.
 */
export function NpcController(options: NpcControllerOptions) {
  return (target: ClassConstructor) => {
    Server.Controller()(target as never)
    injectable()(target)
    const metadata = {
      ...options,
      skills: options.skills.map((skill) => (typeof skill === 'string' ? skill : skillKeyOf(skill))),
    }
    Reflect.defineMetadata(NPC_METADATA_KEYS.CONTROLLER, metadata, target)
    registry.add(target)
  }
}
