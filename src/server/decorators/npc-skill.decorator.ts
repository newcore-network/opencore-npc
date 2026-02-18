import { injectable } from 'tsyringe'
import { NPC_METADATA_KEYS } from './metadata-keys'

export type NpcSkillOptions = {
  key: string
  tags?: string[]
  mutex?: string
}

/**
 * Marks a class as an NPC skill provider.
 *
 * @param options - Static metadata used during skill registration.
 */
export function NpcSkill(options: NpcSkillOptions) {
  return (target: Function) => {
    injectable()(target as never)
    Reflect.defineMetadata(NPC_METADATA_KEYS.SKILL, options, target)
  }
}
