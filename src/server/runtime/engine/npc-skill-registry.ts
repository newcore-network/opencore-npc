import { NPC_METADATA_KEYS } from '../../decorators/metadata-keys'
import type { NpcSkill } from '../contracts/npc-skill.interface'

export type SkillMeta = {
  key: string
  tags?: string[]
  mutex?: string
}

/** Registry for NPC skill instances and metadata. */
export class NpcSkillRegistry {
  private readonly byKey = new Map<string, () => NpcSkill>()
  private readonly cacheByKey = new Map<string, NpcSkill>()
  private readonly metaByKey = new Map<string, SkillMeta>()

  constructor(
    private readonly resolveFromDi?: <T>(ctor: new () => T) => T,
  ) {}

  /** Registers one skill instance. */
  register(skill: NpcSkill, meta?: SkillMeta): void {
    if (this.byKey.has(skill.key)) {
      throw new Error(`NpcSkill '${skill.key}' already registered`)
    }

    this.byKey.set(skill.key, () => skill)
    this.cacheByKey.set(skill.key, skill)
    this.metaByKey.set(skill.key, meta ?? { key: skill.key, tags: skill.tags, mutex: skill.mutex })
  }

  /** Registers a skill class that will be resolved from DI on-demand. */
  registerClass(ctor: new () => NpcSkill, explicitMeta?: SkillMeta): void {
    const metadata = explicitMeta ?? (Reflect.getMetadata(NPC_METADATA_KEYS.SKILL, ctor) as SkillMeta | undefined)
    if (!metadata?.key) {
      throw new Error(`NpcSkill class '${ctor.name}' missing @Server.NpcSkill metadata`)
    }

    if (this.byKey.has(metadata.key)) {
      throw new Error(`NpcSkill '${metadata.key}' already registered`)
    }

    this.byKey.set(metadata.key, () => {
      const instance = this.resolveFromDi ? this.resolveFromDi(ctor) : new ctor()
      const writable = instance as NpcSkill & {
        key: string
        tags?: string[]
        mutex?: string
      }
      writable.key = metadata.key
      writable.tags = metadata.tags
      writable.mutex = metadata.mutex
      return instance
    })
    this.metaByKey.set(metadata.key, metadata)
  }

  /** Retrieves a skill by key. */
  get(key: string): NpcSkill | undefined {
    const cached = this.cacheByKey.get(key)
    if (cached) {
      return cached
    }

    const resolver = this.byKey.get(key)
    if (!resolver) {
      return undefined
    }

    const resolved = resolver()
    this.cacheByKey.set(key, resolved)
    return resolved
  }

  /** Returns all registered skill instances. */
  all(): NpcSkill[] {
    const out: NpcSkill[] = []
    for (const key of this.byKey.keys()) {
      const resolved = this.get(key)
      if (resolved) {
        out.push(resolved)
      }
    }
    return out
  }

  /** Returns skill keys matching a tag. */
  allowByTag(tag: string): string[] {
    return [...this.metaByKey.values()].filter((m) => m.tags?.includes(tag)).map((m) => m.key)
  }
}
