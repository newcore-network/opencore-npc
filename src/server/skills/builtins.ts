import type { NpcSkillClass } from '../types'
import { GoToCarDriveParkSkill } from './go-to-car-drive-park.skill'
import { IdleSkill } from './idle.skill'
import { MoveToSkill } from './move-to.skill'
import { SetHeadingSkill } from './set-heading.skill'

export function builtInSkillClasses(): NpcSkillClass[] {
  return [IdleSkill, MoveToSkill, SetHeadingSkill, GoToCarDriveParkSkill]
}
