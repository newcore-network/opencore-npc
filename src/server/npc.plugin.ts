import type { OpenCorePlugin } from '@open-core/framework/server'
import { GLOBAL_CONTAINER } from '@open-core/framework'
import type { NpcIdentity } from '../shared/contracts/npc-types'
import { NpcController } from './decorators/npc.decorator'
import { NpcSkill, getNpcSkillRegistry as getDecoratedNpcSkillClasses } from './decorators/npc-skill.decorator'
import { OnNpcHook } from './decorators/npc-hook.decorator'
import { OnNpcEvent } from './decorators/on-npc-event.decorator'
import { NpcSkillRegistry } from './runtime/engine/npc-skill-registry'
import { NpcHookBusServer } from './runtime/events/npc-hook-bus.server'
import { NpcEventBusServer } from './runtime/events/npc-event-bus.server'
import { FiveMNpcTransportServer } from './runtime/transport/fivem/fivem-npc-transport.server'
import { RedMNpcTransportServer } from './runtime/transport/redm/redm-npc-transport.server'
import { NpcWireBridgeServer } from './runtime/transport/fivem/npc-wire-bridge.server'
import { NpcEngine } from './runtime/engine/npc-engine'
import { NpcScheduler } from './runtime/engine/npc-scheduler'
import { NpcApi, setNpcApiSingleton } from './api/npc-api'
import { registerBuiltInNpcSkills } from './skills/register-builtins'
import { NpcEntityService } from './runtime/entities/npc-entity.service'
import {
  NpcControllerRuntime,
} from './runtime/controllers/npc-controller.runtime'
import { NpcRuntimeService } from './runtime/runtime/npc-runtime.service'
import { ExecutorRegistryServer } from './runtime/transport/fivem/wire/executor-registry.server'
import { NetWireFallbackServer } from './runtime/transport/fivem/wire/net-wire-fallback.server'
import { RpcCallerResolverServer } from './runtime/transport/fivem/wire/rpc-caller-resolver.server'
import { CompositeWireCallerServer } from './runtime/transport/fivem/wire/composite-wire-caller.server'
import { NpcRulePlanner } from './runtime/planner/npc-rule-planner'
import { NpcAiPlanner } from './runtime/planner/npc-ai-planner'
import type { ControllerPlannerInput } from './runtime/controllers/npc-controller.runtime'
import type { LLMProvider } from './runtime/planner/llm-provider'
import type { NpcSkill as NpcSkillContract } from './runtime/contracts/npc-skill.interface'

export type NpcPluginOptions = {
  /** Runtime adapter used for transport operations. */
  adapter?: 'fivem' | 'redm'
  /** Enables connected mode transport delegation. */
  connected?: boolean
  /** Default scheduler timing configuration. */
  defaults?: {
    tickMsNear?: number
    tickMsFar?: number
    nearRadius?: number
  }
  llmProvider?: LLMProvider
  aiBudget?: {
    maxRequestsPerMin?: number
    minDecisionIntervalMs?: number
    disableAfterFirstFailure?: boolean
  }
}

/**
 * Creates the NPC server plugin instance.
 *
 * @param options - Optional runtime configuration.
 */
export function npcPlugin(options?: NpcPluginOptions): OpenCorePlugin {
  return {
    name: 'npc',
    install(ctx) {
      ctx.server.registerApiExtension('NpcController', NpcController)
      ctx.server.registerApiExtension('NpcSkill', NpcSkill)
      ctx.server.registerApiExtension('OnNpcHook', OnNpcHook)
      ctx.server.registerApiExtension('OnNpcEvent', OnNpcEvent)

      const registry = new NpcSkillRegistry((ctor) => GLOBAL_CONTAINER.resolve(ctor as never))
      const hooks = new NpcHookBusServer()
      const events = new NpcEventBusServer()

      const wireBridgeWithFallback = buildConnectedWireBridge(ctx.di, options?.connected)
      const executorRegistry = options?.connected ? new ExecutorRegistryServer() : undefined

      const chooseExecutorClient = (_npc: NpcIdentity): number | undefined =>
        executorRegistry?.chooseAnyReadyOrFirstPlayer()
      const chooseExecutorCandidates = (_npc: NpcIdentity): number[] =>
        executorRegistry?.chooseCandidates() ?? []

      const preferredAdapter = resolveAdapterPreference(options?.adapter)
      const transport =
        preferredAdapter === 'redm'
          ? new RedMNpcTransportServer({ wireBridge: wireBridgeWithFallback, chooseExecutorClient })
          : new FiveMNpcTransportServer({
            wireBridge: wireBridgeWithFallback,
            chooseExecutorClient,
            chooseExecutorCandidates,
          })

      const engine = new NpcEngine(registry, hooks, events, transport)
      const scheduler = new NpcScheduler({
        tickMsNear: options?.defaults?.tickMsNear ?? 350,
        tickMsFar: options?.defaults?.tickMsFar ?? 1500,
        nearRadius: options?.defaults?.nearRadius ?? 120,
      })
      const entities = new NpcEntityService()
      const controllers = new NpcControllerRuntime(hooks, events, (planner: ControllerPlannerInput) => {
        if (!planner || planner === 'rule') {
          return new NpcRulePlanner()
        }
        if (planner === 'ai') {
          if (!options?.llmProvider) {
            throw new Error('NpcController planner "ai" requires npcPlugin({ llmProvider })')
          }
          return new NpcAiPlanner(options.llmProvider, new NpcRulePlanner(), options.aiBudget)
        }
        return planner
      })
      const runtime = new NpcRuntimeService(scheduler, engine)
      const api = new NpcApi(engine, entities, runtime, controllers)

      registerBuiltInNpcSkills(registry)
      for (const skillClass of getDecoratedNpcSkillClasses()) {
        registry.registerClass(skillClass as new () => NpcSkillContract)
      }

      runtime.start()

      ctx.di.register(NpcSkillRegistry, registry)
      ctx.di.register(NpcHookBusServer, hooks)
      ctx.di.register(NpcEventBusServer, events)
      ctx.di.register(FiveMNpcTransportServer, transport)
      ctx.di.register(RedMNpcTransportServer, transport)
      ctx.di.register(NpcEngine, engine)
      ctx.di.register(NpcScheduler, scheduler)
      ctx.di.register(NpcEntityService, entities)
      ctx.di.register(NpcControllerRuntime, controllers)
      ctx.di.register(NpcRuntimeService, runtime)
      ctx.di.register(NpcApi, api)

      setNpcApiSingleton(api)
    },
  }
}

function buildConnectedWireBridge(
  di: unknown,
  connected: boolean | undefined,
): NpcWireBridgeServer | undefined {
  if (!connected) {
    return undefined
  }

  const resolver = new RpcCallerResolverServer(di)
  const rpcCaller = resolver.resolve()
  const fallbackCaller = new NetWireFallbackServer()
  const caller = new CompositeWireCallerServer(fallbackCaller, rpcCaller)
  return new NpcWireBridgeServer(caller)
}

function resolveAdapterPreference(explicit?: 'fivem' | 'redm'): 'fivem' | 'redm' {
  if (explicit) return explicit
  const getConvar = (globalThis as Record<string, unknown>).GetConvar
  if (typeof getConvar === 'function') {
    const profile = String((getConvar as (name: string, fallback: string) => string)('opencore:gameProfile', '')).toLowerCase()
    if (profile.includes('rdr') || profile.includes('redm')) {
      return 'redm'
    }
  }
  return 'fivem'
}

declare module '@open-core/framework/server' {
  interface ServerPluginApi {
    NpcController: typeof NpcController
    NpcSkill: typeof NpcSkill
    OnNpcHook: typeof OnNpcHook
    OnNpcEvent: typeof OnNpcEvent
  }
}
