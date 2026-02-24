import type { NpcSkillClass } from '../types'
import { GoToCarDriveParkSkill } from './go-to-car-drive-park.skill'
import { IdleSkill } from './idle.skill'
import { LookAtEntitySkill } from './look-at-entity.skill'
import { MoveToSkill } from './move-to.skill'
import { MoveRelativeSkill } from './move-relative.skill'
import { SetHeadingSkill } from './set-heading.skill'
import { WaitSkill } from './wait.skill'

export function builtInSkillClasses(): NpcSkillClass[] {
  return [
    IdleSkill,
    MoveToSkill,
    MoveRelativeSkill,
    SetHeadingSkill,
    LookAtEntitySkill,
    WaitSkill,
    GoToCarDriveParkSkill,
  ]
}
