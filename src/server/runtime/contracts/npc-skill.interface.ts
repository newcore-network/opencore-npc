import type { NpcContext } from '../context/npc-context.types'
import type { SkillResult } from './skill-result'

/**
 * Contract implemented by all server-side NPC skills.
 *
 * @typeParam TArgs - Validated input argument shape.
 */
export interface NpcSkill<TArgs = unknown> {
  readonly key: string
  readonly description?: string
  readonly tags?: string[]
  readonly mutex?: string
  validate?(input: unknown): TArgs
  execute(ctx: NpcContext, args: TArgs): Promise<SkillResult>
}
