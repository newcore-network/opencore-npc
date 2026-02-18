import { injectable } from 'tsyringe'
import { Client } from '@open-core/framework/client'
import { NPC_CLIENT_METADATA_KEYS } from './metadata-keys'

type ClassConstructor<T = unknown> = new (...args: never[]) => T

const registry = new Set<ClassConstructor>()

export function getNpcClientControllerRegistry(): ClassConstructor[] {
  return [...registry]
}

/** Marks a class as an NPC client controller. */
export function NpcController() {
  return (target: ClassConstructor) => {
    Client.Controller()(target as never)
    injectable()(target)
    Reflect.defineMetadata(NPC_CLIENT_METADATA_KEYS.CONTROLLER, { kind: 'npc' }, target)
    registry.add(target)
  }
}
