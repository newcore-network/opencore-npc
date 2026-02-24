import type { NpcContext, NpcSkillClass, SkillResult } from '../types'
import { NPC_INTELLIGENCE_METADATA } from './metadata-keys'

/** Contract implemented by all class-based NPC skills. */
export interface NpcSkill<TArgs = unknown> {
  validate?(input: unknown): TArgs
  execute(ctx: NpcContext, args: TArgs): Promise<SkillResult> | SkillResult
}

type SkillCtor = new (...args: never[]) => NpcSkill<unknown>

const skillCtors = new Set<SkillCtor>()

/**
 * Marks a class as an NPC skill.
 *
 * @remarks
 * The skill key is derived automatically from the class name.
 * Example: `GoToCarDriveParkSkill` -> `goToCarDrivePark`.
 */
export function NpcSkill(): ClassDecorator {
  return (target) => {
    const ctor = target as unknown as SkillCtor
    const key = deriveSkillKey(ctor.name)
    Reflect.defineMetadata(NPC_INTELLIGENCE_METADATA.SKILL, key, ctor)
    skillCtors.add(ctor)
  }
}

/** Returns all decorated skill classes discovered at load-time. */
export function getDecoratedNpcSkillClasses(): SkillCtor[] {
  return Array.from(skillCtors)
}

/** Resolves the derived skill key from one class constructor. */
export function getDecoratedNpcSkillKey(target: object): string | undefined {
  return Reflect.getMetadata(NPC_INTELLIGENCE_METADATA.SKILL, target) as string | undefined
}

/** Resolves the skill key from a skill class, failing if undecorated. */
export function skillKeyOf(skillClass: NpcSkillClass): string {
  const key = getDecoratedNpcSkillKey(skillClass)
  if (!key) {
    throw new Error(`Skill class '${skillClass.name}' is missing @NpcSkill() decorator`)
  }
  return key
}

function deriveSkillKey(className: string): string {
  const trimmed = className.endsWith('Skill') ? className.slice(0, -'Skill'.length) : className
  if (!trimmed) {
    throw new Error('NpcSkill class name cannot be empty')
  }
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
}
