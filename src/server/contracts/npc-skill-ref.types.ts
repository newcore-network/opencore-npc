/**
 * Typed skill reference used by controller configuration APIs.
 */
export type NpcSkillRef<K extends string = string> = {
  readonly key: K
}

/**
 * Any value that can reference a skill by key.
 */
export type NpcSkillLike<K extends string = string> = {
  readonly key: K
}

/** Creates a strongly typed skill reference. */
export function skillRef<const K extends string>(key: K): NpcSkillRef<K> {
  return { key }
}

/** Resolves one skill reference to its key. */
export function skillKeyOf(skill: NpcSkillLike): string {
  return skill.key
}
