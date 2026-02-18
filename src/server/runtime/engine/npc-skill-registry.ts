import { NPC_METADATA_KEYS } from '../../decorators/metadata-keys'
import type { NpcSkill } from '../contracts/npc-skill.interface'

export type SkillMeta = {
  key: string
  tags?: string[]
  mutex?: string
}

/** Registry for NPC skill instances and metadata. */
export class NpcSkillRegistry {
  private readonly byKey = new Map<string, NpcSkill>()
  private readonly metaByKey = new Map<string, SkillMeta>()

  /** Registers one skill instance. */
  register(skill: NpcSkill, meta?: SkillMeta): void {
    if (this.byKey.has(skill.key)) {
      throw new Error(`NpcSkill '${skill.key}' already registered`)
    }

    this.byKey.set(skill.key, skill)
    this.metaByKey.set(skill.key, meta ?? { key: skill.key, tags: skill.tags, mutex: skill.mutex })
  }

  /** Creates and registers a skill from a decorated class. */
  registerClass(ctor: new () => NpcSkill): void {
    const metadata = Reflect.getMetadata(NPC_METADATA_KEYS.SKILL, ctor) as SkillMeta | undefined
    if (!metadata?.key) {
      throw new Error(`NpcSkill class '${ctor.name}' missing @Server.NpcSkill metadata`)
    }

    const skill = new ctor()
    const writable = skill as NpcSkill & {
      key: string
      tags?: string[]
      mutex?: string
    }
    writable.key = metadata.key
    writable.tags = metadata.tags
    writable.mutex = metadata.mutex
    this.register(skill, metadata)
  }

  /** Retrieves a skill by key. */
  get(key: string): NpcSkill | undefined {
    return this.byKey.get(key)
  }

  /** Returns all registered skill instances. */
  all(): NpcSkill[] {
    return [...this.byKey.values()]
  }

  /** Returns skill keys matching a tag. */
  allowByTag(tag: string): string[] {
    return [...this.metaByKey.values()].filter((m) => m.tags?.includes(tag)).map((m) => m.key)
  }
}
