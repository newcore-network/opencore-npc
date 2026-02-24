export type { NpcGoal, NpcSpawnInput } from '../shared'

export { NpcIntelligentController } from './decorators/npc.decorator'
export { NpcSkill } from './decorators/npc-skill.decorator'
export { OnNpcHook } from './decorators/npc-hook.decorator'
export { OnNpcEvent } from './decorators/on-npc-event.decorator'

export { npcIntelligencePlugin } from './npc.plugin'
export type { NpcIntelligencePluginOptions } from './npc.plugin'

export { IntelligentNpcAPI, NpcIntelligence } from './api/npc-api'

export type {
  NpcContext,
  SkillResult,
  SkillDecision,
  NpcIntelligentControllerDefinition,
  AttachOptions,
  NpcIntelligenceDebugConfig,
} from './types'

export { builtInSkillClasses } from './skills/builtins'
export { IdleSkill } from './skills/idle.skill'
export { MoveToSkill } from './skills/move-to.skill'
export { MoveRelativeSkill } from './skills/move-relative.skill'
export { SetHeadingSkill } from './skills/set-heading.skill'
export { WaitSkill } from './skills/wait.skill'
export { LookAtEntitySkill } from './skills/look-at-entity.skill'
export { GoToCarDriveParkSkill } from './skills/go-to-car-drive-park.skill'
