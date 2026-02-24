import type { NpcSkillContract } from '../types'
import { NPC_INTELLIGENCE_METADATA } from './metadata-keys'

type SkillCtor = new (...args: any[]) => NpcSkillContract

const skillCtors: SkillCtor[] = []

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
