import { injectable } from 'tsyringe'
import { Server } from '@open-core/framework/server'
import { NPC_METADATA_KEYS } from './metadata-keys'
import type { NpcPlanner } from '../runtime/planner/npc-planner.interface'
import { skillKeyOf, type NpcSkillLike } from '../contracts/npc-skill-ref.types'

type ClassConstructor<T = unknown> = new (...args: never[]) => T

export type NpcControllerOptions = {
  id: string
  planner?: 'rule' | 'ai' | NpcPlanner
  skills: Array<NpcSkillLike | string>
  constraints?: {
    limitCallsPerTurn?: number
  }
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
