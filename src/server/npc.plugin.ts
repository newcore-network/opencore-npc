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
} from './decorators/npc-skill.decorator'
import { IntelligenceEngine } from './engine/intelligence-engine'
import { createBuiltInSkills } from './skills/builtin-skills'
import { NpcSkillRegistry } from './skills/skill-registry'
import type { NpcPlanner, NpcSkillClass, ResolvedNpcControllerDefinition } from './types'

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
      skills.registerMany(createBuiltInSkills())

      for (const SkillClass of getDecoratedNpcSkillClasses()) {
        const key = getDecoratedNpcSkillKey(SkillClass)
        if (!key) {
          continue
        }
        const resolved = GLOBAL_CONTAINER.resolve(SkillClass as never) as unknown as {
          execute: (ctx: any, args?: unknown) => Promise<any> | any
        }
        skills.register({
          key,
          execute: (ctx, args) => resolved.execute.call(resolved, ctx, args),
        })
      }

      const controllers = getNpcIntelligentControllers()
      for (const def of controllers.values()) {
        for (const ref of def.skills ?? []) {
          registerSkillClass(skills, ref.token)
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
          skills: def.skills?.map((item) => item.key),
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

  const resolved = GLOBAL_CONTAINER.resolve(skillClass as never) as unknown as {
    execute: (ctx: any, args?: unknown) => Promise<any> | any
  }

  skills.register({
    key,
    execute: (ctx, args) => resolved.execute.call(resolved, ctx, args),
  })
}
