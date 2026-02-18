import { injectable } from 'tsyringe'
import { Server } from '@open-core/framework/server'
import { NPC_METADATA_KEYS } from './metadata-keys'

type ClassConstructor<T = unknown> = new (...args: never[]) => T

export type NpcControllerOptions = {
  group: string
  tickMs?: number
}

const registry = new Set<ClassConstructor>()

/** Returns all classes registered with `@Server.NPC(...)`. */
export function getNpcControllerRegistry(): ClassConstructor[] {
  return [...registry]
}

/**
 * Marks a class as an NPC controller.
 *
 * @param options - Controller configuration metadata.
 */
export function NPC(options: NpcControllerOptions) {
  return (target: ClassConstructor) => {
    Server.Controller()(target as never)
    injectable()(target)
    Reflect.defineMetadata(NPC_METADATA_KEYS.CONTROLLER, options, target)
    registry.add(target)
  }
}
