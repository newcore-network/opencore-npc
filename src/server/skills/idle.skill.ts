import { NpcSkill } from '../decorators/npc-skill.decorator'
import type { NpcSkill as NpcSkillContract } from '../decorators/npc-skill.decorator'

@NpcSkill()
export class IdleSkill implements NpcSkillContract<undefined> {
  execute() {
    return { ok: true, waitMs: 400 }
  }
}
