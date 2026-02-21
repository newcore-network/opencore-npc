import { injectable } from 'tsyringe'
import { NPC_METADATA_KEYS } from './metadata-keys'

export type NpcSkillOptions = {
  key: string
  tags?: string[]
  mutex?: string
}

type SkillConstructor<T = unknown> = new (...args: never[]) => T

const registry = new Set<SkillConstructor>()

export function getNpcSkillRegistry(): SkillConstructor[] {
  return [...registry]
}

/**
 * Marks a class as an NPC skill provider.
 *
 * @param options - Static metadata used during skill registration.
 */
export function NpcSkill(key: string, options?: Omit<NpcSkillOptions, 'key'>) {
  return (target: SkillConstructor) => {
    injectable()(target as never)
    Reflect.defineMetadata(
      NPC_METADATA_KEYS.SKILL,
      {
        key,
        tags: options?.tags,
        mutex: options?.mutex,
      } satisfies NpcSkillOptions,
      target,
    )
    registry.add(target)
  }
}
