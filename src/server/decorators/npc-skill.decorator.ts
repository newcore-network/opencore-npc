import type { NpcSkillClass, NpcSkillContract, NpcSkillRef } from '../types'
import { NPC_INTELLIGENCE_METADATA } from './metadata-keys'

type SkillCtor = new (...args: any[]) => NpcSkillContract

const skillCtors: SkillCtor[] = []

/** Declares a class as a reusable NPC skill. */
export function NpcSkill(key: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(NPC_INTELLIGENCE_METADATA.SKILL, key, target)
    skillCtors.push(target as unknown as SkillCtor)
  }
}

export function getDecoratedNpcSkillClasses(): SkillCtor[] {
  return [...skillCtors]
}

export function getDecoratedNpcSkillKey(target: object): string | undefined {
  return Reflect.getMetadata(NPC_INTELLIGENCE_METADATA.SKILL, target) as string | undefined
}

/**
 * Creates a strongly-typed skill reference from a decorated skill class.
 *
 * @example
 * ```ts
 * @NpcSkill('driveTo')
 * class DriveToSkill { ... }
 *
 * @NpcIntelligentController({
 *   id: 'driver',
 *   skills: [npcSkill(DriveToSkill)],
 * })
 * class DriverController {}
 * ```
 */
export function npcSkill<TArgs>(token: NpcSkillClass<TArgs>): NpcSkillRef<TArgs> {
  const key = getDecoratedNpcSkillKey(token)
  if (!key) {
    throw new Error(`Skill class '${token.name}' is missing @NpcSkill('key') decorator`)
  }
  return {
    key,
    token,
  }
}
