import { GLOBAL_CONTAINER } from '@open-core/framework'
import { Npcs, type OpenCorePlugin } from '@open-core/framework/server'
import { NpcAiPlanner } from './ai/ai-planner'
import type { LLMProvider } from './ai/llm-provider'
import { NpcRulePlanner } from './ai/rule-planner'
import { IntelligentNpcAPI } from './api/npc-api'
import {
  getNpcIntelligentControllers,
  NpcIntelligentController,
} from './decorators/npc.decorator'
import { OnNpcHook } from './decorators/npc-hook.decorator'
import { OnNpcEvent } from './decorators/on-npc-event.decorator'
import {
  getDecoratedNpcSkillKey,
  getDecoratedNpcSkillClasses,
  NpcSkill as NpcSkillDecorator,
  skillKeyOf,
} from './decorators/npc-skill.decorator'
import { IntelligenceEngine } from './engine/intelligence-engine'
import { builtInSkillClasses } from './skills/builtins'
import { NpcSkillRegistry } from './skills/skill-registry'
import type {
  NpcContext,
  NpcPlanner,
  NpcSkillClass,
  ResolvedNpcControllerDefinition,
  SkillResult,
} from './types'
import type { NpcSkill as NpcSkillContract } from './decorators/npc-skill.decorator'

type SkillInstance = {
  validate?: (input: unknown) => unknown
  execute: (ctx: NpcContext, args: unknown) => Promise<SkillResult> | SkillResult
}

export type NpcIntelligencePluginOptions = {
  /** Default tick interval for attached agents when not defined by controller. */
  defaultTickMs?: number
  /** Optional LLM provider used by controllers that select `planner: 'ai'`. */
  llmProvider?: LLMProvider
}

/** Installs the NPC intelligence runtime and decorator bindings. */
export function npcIntelligencePlugin(options: NpcIntelligencePluginOptions = {}): OpenCorePlugin {
  return {
    name: 'npc-intelligence',
    install(ctx) {
      ctx.server.registerApiExtension('NpcIntelligentController', NpcIntelligentController)
      ctx.server.registerApiExtension('NpcSkill', NpcSkillDecorator)
      ctx.server.registerApiExtension('OnNpcHook', OnNpcHook)
      ctx.server.registerApiExtension('OnNpcEvent', OnNpcEvent)

      const npcs = GLOBAL_CONTAINER.resolve(Npcs)
      const skills = new NpcSkillRegistry()
      for (const skillClass of builtInSkillClasses()) {
        registerSkillClass(skills, skillClass)
      }

      for (const SkillClass of getDecoratedNpcSkillClasses()) {
        registerSkillClass(skills, SkillClass)
      }

      const controllers = getNpcIntelligentControllers()
      for (const def of controllers.values()) {
        for (const skillClass of def.skills ?? []) {
          registerSkillClass(skills, skillClass)
        }
      }

      const engine = new IntelligenceEngine(npcs, skills)
      const api = new IntelligentNpcAPI(npcs, engine)

      const resolvedControllers = new Map<string, ResolvedNpcControllerDefinition>()
      for (const [id, def] of controllers.entries()) {
        resolvedControllers.set(id, {
          id,
          planner:
            def.planner === 'ai' && options.llmProvider
              ? new NpcAiPlanner(options.llmProvider)
              : def.planner === 'rule' || !def.planner
                ? new NpcRulePlanner()
                : (def.planner as NpcPlanner),
          skills: def.skills?.map((item) => skillKeyOf(item)),
          tickMs: def.tickMs ?? options.defaultTickMs,
        })
      }

      api.setControllers(resolvedControllers)
      engine.start()

      ctx.di.register(NpcSkillRegistry, skills)
      ctx.di.register(IntelligenceEngine, engine)
      ctx.di.register(IntelligentNpcAPI, api)
    },
  }
}

declare module '@open-core/framework/server' {
  interface ServerPluginApi {
    NpcIntelligentController: typeof NpcIntelligentController
    NpcSkill: typeof NpcSkillDecorator
    OnNpcHook: typeof OnNpcHook
    OnNpcEvent: typeof OnNpcEvent
  }
}

function registerSkillClass(skills: NpcSkillRegistry, skillClass: NpcSkillClass): void {
  const key = getDecoratedNpcSkillKey(skillClass)
  if (!key || skills.has(key)) {
    return
  }

  const resolved = GLOBAL_CONTAINER.resolve(skillClass as never) as unknown as NpcSkillContract<unknown>

  const skill: SkillInstance = {
    validate: resolved.validate,
    execute: resolved.execute as (ctx: NpcContext, args: unknown) => Promise<SkillResult> | SkillResult,
  }

  skills.register({
    key,
    execute: (ctx, args) => {
      const validated = typeof skill.validate === 'function' ? skill.validate(args) : args
      return skill.execute.call(resolved, ctx, validated)
    },
  })
}
