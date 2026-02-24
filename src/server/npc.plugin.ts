import { GLOBAL_CONTAINER } from '@open-core/framework'
import { Npcs, type OpenCorePlugin } from '@open-core/framework/server'
import { NpcAiPlanner } from './ai/ai-planner'
import type { LLMProvider } from './ai/llm-provider'
import { NpcRulePlanner } from './ai/rule-planner'
import { NpcApi, setNpcApiSingleton } from './api/npc-api'
import { getNpcControllers, NpcController } from './decorators/npc.decorator'
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
import type { NpcPlanner } from './types'

export type NpcIntelligencePluginOptions = {
  defaultTickMs?: number
  llmProvider?: LLMProvider
}

export function npcIntelligencePlugin(options: NpcIntelligencePluginOptions = {}): OpenCorePlugin {
  return {
    name: 'npc-intelligence',
    install(ctx) {
      ctx.server.registerApiExtension('NpcController', NpcController)
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

      const engine = new IntelligenceEngine(npcs, skills)
      const api = new NpcApi(npcs, engine)

      const controllers = getNpcControllers()
      const resolvedControllers = new Map<string, { id: string; planner?: NpcPlanner; skills?: string[]; tickMs?: number }>()
      for (const [id, def] of controllers.entries()) {
        resolvedControllers.set(id, {
          id,
          planner:
            def.planner === 'ai' && options.llmProvider
              ? new NpcAiPlanner(options.llmProvider)
              : def.planner === 'rule' || !def.planner
                ? new NpcRulePlanner()
                : (def.planner as NpcPlanner),
          skills: def.skills,
          tickMs: def.tickMs ?? options.defaultTickMs,
        })
      }

      api.setControllers(resolvedControllers)
      engine.start()

      ctx.di.register(NpcSkillRegistry, skills)
      ctx.di.register(IntelligenceEngine, engine)
      ctx.di.register(NpcApi, api)

      setNpcApiSingleton(api)
    },
  }
}

export const npcPlugin = npcIntelligencePlugin

declare module '@open-core/framework/server' {
  interface ServerPluginApi {
    NpcController: typeof NpcController
    NpcSkill: typeof NpcSkillDecorator
    OnNpcHook: typeof OnNpcHook
    OnNpcEvent: typeof OnNpcEvent
  }
}
