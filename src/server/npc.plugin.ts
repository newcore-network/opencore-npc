import { GLOBAL_CONTAINER } from '@open-core/framework'
import { Npcs, type OpenCorePlugin, type PluginInstallContext } from '@open-core/framework/server'
import { NpcAiPlanner } from './ai/ai-planner'
import type { LLMProvider } from './ai/llm-provider'
import { createOpenRouterProvider, type OpenRouterProviderConfig } from './ai/openrouter-provider'
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
  NpcIntelligenceDebugConfig,
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
  /** Optional OpenRouter config. API key always from env when omitted. */
  openRouter?: OpenRouterProviderConfig
  /** Optional debug configuration. */
  debug?: NpcIntelligenceDebugConfig
}

/** Installs the NPC intelligence runtime and decorator bindings. */
export function npcIntelligencePlugin(options: NpcIntelligencePluginOptions = {}): OpenCorePlugin {
  const plugin: OpenCorePlugin & { start(ctx: PluginInstallContext): void } = {
    name: 'npc-intelligence',
    install(ctx) {
      ctx.server.registerApiExtension('NpcIntelligentController', NpcIntelligentController)
      ctx.server.registerApiExtension('NpcSkill', NpcSkillDecorator)
      ctx.server.registerApiExtension('OnNpcHook', OnNpcHook)
      ctx.server.registerApiExtension('OnNpcEvent', OnNpcEvent)
    },

    start(ctx) {
      const skills = new NpcSkillRegistry()
      const llmProvider =
        options.llmProvider ??
        createOpenRouterProvider(options.openRouter, {
          enabled: options.debug?.enabled,
          llm: options.debug?.llm,
        })

      if (!llmProvider && options.debug?.enabled) {
        console.warn(
          '[npc-intelligence] OPENROUTER_API_KEY is missing. AI controllers will use rule planner fallback.',
        )
      }

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

      const npcs = GLOBAL_CONTAINER.resolve(Npcs)
      const engine = new IntelligenceEngine(npcs, skills)
      engine.setDebug(options.debug)
      const api = new IntelligentNpcAPI(npcs, engine)

      const resolvedControllers = new Map<string, ResolvedNpcControllerDefinition>()
      for (const [id, def] of controllers.entries()) {
        resolvedControllers.set(id, {
          id,
          name: def.name,
          npcType: def.npcType,
          planner:
            def.planner === 'ai' && llmProvider
              ? new NpcAiPlanner(llmProvider, new NpcRulePlanner(), def.ai ?? {}, options.debug, id)
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

  return plugin
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
