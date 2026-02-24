import type { NpcSkillContract } from '../types'

export class NpcSkillRegistry {
  private readonly map = new Map<string, NpcSkillContract>()

  register(skill: NpcSkillContract): void {
    this.map.set(skill.key, skill)
  }

  registerMany(skills: NpcSkillContract[]): void {
    for (const skill of skills) this.register(skill)
  }

  get(key: string): NpcSkillContract | undefined {
    return this.map.get(key)
  }

  has(key: string): boolean {
    return this.map.has(key)
  }

  keys(): string[] {
    return Array.from(this.map.keys())
  }
}
