import type { RegisteredNpcSkill } from '../types'

export class NpcSkillRegistry {
  private readonly map = new Map<string, RegisteredNpcSkill>()

  register(skill: RegisteredNpcSkill): void {
    if (this.map.has(skill.key)) {
      throw new Error(`NpcSkill '${skill.key}' already registered`)
    }
    this.map.set(skill.key, skill)
  }

  registerMany(skills: RegisteredNpcSkill[]): void {
    for (const skill of skills) this.register(skill)
  }

  get(key: string): RegisteredNpcSkill | undefined {
    return this.map.get(key)
  }

  has(key: string): boolean {
    return this.map.has(key)
  }

  keys(): string[] {
    return Array.from(this.map.keys())
  }
}
