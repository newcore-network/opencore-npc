import type { OpenCorePlugin } from '@open-core/framework/server'
import {
  RpcAPI,
} from '@open-core/framework'
import type { NpcExecuteSkillMsg, NpcSkillResultMsg } from '../shared/contracts/npc-wire.contracts'
import type { NpcIdentity } from '../shared/contracts/npc-types'
import { NPC } from './decorators/npc.decorator'
import { NpcSkill } from './decorators/npc-skill.decorator'
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
      ctx.server.registerApiExtension('NPC', NPC)
      ctx.server.registerApiExtension('NpcSkill', NpcSkill)
      ctx.server.registerApiExtension('OnNpcHook', OnNpcHook)
      ctx.server.registerApiExtension('OnNpcEvent', OnNpcEvent)

      const registry = new NpcSkillRegistry()
      const hooks = new NpcHookBusServer()
      const events = new NpcEventBusServer()

      const fallbackWireResults = options?.connected
        ? createRawWireFallbackServer()
        : undefined

      const wireBridgeWithFallback = options?.connected
        ? new NpcWireBridgeServer({
          async call(name: string, ...args: unknown[]) {
            if (!fallbackWireResults) {
              const rpcOnly = resolveRpcCaller(ctx.di)
              if (!rpcOnly) {
                throw new Error('npc connected wire unavailable (no fallback and no RPC)')
              }
              return rpcOnly.call(name, ...args)
            }

            const rpc = resolveRpcCaller(ctx.di)
            return callWireWithFallback(name, args, fallbackWireResults, rpc)
          },
        })
        : undefined

      const readyExecutors = new Set<number>()
      if (options?.connected) {
        const g = globalThis as Record<string, unknown>

        const onNetFn = g.onNet
        if (typeof onNetFn === 'function') {
          ; (onNetFn as (eventName: string, handler: () => void) => void)(
            'opencore:npc:executor:ready',
            () => {
              const srcRaw = (globalThis as Record<string, unknown>).source
              const src = Number(srcRaw)
              if (Number.isFinite(src) && src > 0) {
                readyExecutors.add(src)
              }
            },
          )
        }

        const onFn = g.on
        if (typeof onFn === 'function') {
          ; (onFn as (eventName: string, handler: () => void) => void)('playerDropped', () => {
            const srcRaw = (globalThis as Record<string, unknown>).source
            const src = Number(srcRaw)
            if (Number.isFinite(src) && src > 0) {
              readyExecutors.delete(src)
            }
          })
        }
      }

      const chooseExecutorClient = (_npc: NpcIdentity): number | undefined => {
        if (readyExecutors.size > 0) {
          const fromReady = readyExecutors.values().next().value
          if (typeof fromReady === 'number' && Number.isFinite(fromReady)) {
            return fromReady
          }
        }

        const fn = (globalThis as Record<string, unknown>).GetPlayers
        if (typeof fn !== 'function') return undefined
        const players = (fn as () => string[])()
        if (!Array.isArray(players) || players.length === 0) return undefined
        const id = Number(players[0])
        return Number.isFinite(id) ? id : undefined
      }

      const preferredAdapter = resolveAdapterPreference(options?.adapter)
      const transport =
        preferredAdapter === 'redm'
          ? new RedMNpcTransportServer({ wireBridge: wireBridgeWithFallback, chooseExecutorClient })
          : new FiveMNpcTransportServer({ wireBridge: wireBridgeWithFallback, chooseExecutorClient })

      const engine = new NpcEngine(registry, hooks, events, transport)
      const scheduler = new NpcScheduler({
        tickMsNear: options?.defaults?.tickMsNear ?? 350,
        tickMsFar: options?.defaults?.tickMsFar ?? 1500,
        nearRadius: options?.defaults?.nearRadius ?? 120,
      })
      const entities = new NpcEntityService()
      const controllers = new NpcControllerRuntime(hooks, events)
      const runtime = new NpcRuntimeService(scheduler, engine)
      const api = new NpcApi(engine, entities, runtime, controllers)

      registerBuiltInNpcSkills(registry)

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

type RpcCaller = {
  call(name: string, ...args: unknown[]): Promise<unknown>
}

type DiWithResolve = {
  resolve?: (token: unknown) => unknown
}

function resolveRpcCaller(di: unknown): RpcCaller | undefined {
  const container = di as DiWithResolve
  if (typeof container.resolve !== 'function') {
    return undefined
  }

  let resolved: unknown
  try {
    resolved = container.resolve(RpcAPI as unknown as never) as RpcAPI<'server'>
  } catch {
    return undefined
  }

  if (!resolved || typeof resolved !== 'object') {
    return undefined
  }

  const call = (resolved as Record<string, unknown>).call
  if (typeof call !== 'function') {
    return undefined
  }

  return {
    call: (name: string, ...args: unknown[]) =>
      (call as (this: unknown, name: string, ...args: unknown[]) => Promise<unknown>).call(
        resolved,
        name,
        ...args,
      ),
  }
}

type RawWirePending = {
  resolve: (value: NpcSkillResultMsg) => void
  timeout: ReturnType<typeof setTimeout>
}

function createRawWireFallbackServer(): RpcCaller {
  const reqEvent = 'opencore:npc:execute-skill:net'
  const resEvent = 'opencore:npc:execute-skill:net:result'
  const pending = new Map<string, RawWirePending>()

  const onNetFn = (globalThis as Record<string, unknown>).onNet
  if (typeof onNetFn === 'function') {
    ; (onNetFn as (eventName: string, handler: (msg: NpcSkillResultMsg) => void) => void)(
      resEvent,
      (msg: NpcSkillResultMsg) => {
        if (!msg || typeof msg !== 'object' || typeof msg.callId !== 'string') {
          return
        }

        const entry = pending.get(msg.callId)
        if (!entry) {
          debugWire('ORPHAN_RESULT', { callId: msg.callId })
          return
        }

        clearTimeout(entry.timeout)
        pending.delete(msg.callId)
        debugWire('RESULT', { callId: msg.callId, ok: msg.ok })
        entry.resolve(msg)
      },
    )
  }

  return {
    call(name: string, ...args: unknown[]): Promise<unknown> {
      if (name !== 'opencore:npc:execute-skill') {
        throw new Error(`npc raw wire fallback does not support RPC '${name}'`)
      }

      const [target, msg] = args
      if (typeof target !== 'number') {
        throw new Error('npc raw wire fallback requires numeric target')
      }
      if (!isExecuteSkillMsg(msg)) {
        throw new Error('npc raw wire fallback requires a valid execute-skill payload')
      }

      const emitNetFn = (globalThis as Record<string, unknown>).emitNet
      if (typeof emitNetFn !== 'function') {
        throw new Error('npc raw wire fallback requires emitNet')
      }

      return new Promise<NpcSkillResultMsg>((resolve, reject) => {
        debugWire('SEND', { callId: msg.callId, target, skill: msg.skill })

        const timeout = setTimeout(() => {
          pending.delete(msg.callId)
          debugWire('TIMEOUT', { callId: msg.callId, target, skill: msg.skill })
          reject(new Error('npc raw wire fallback timeout'))
        }, 7_000)

        pending.set(msg.callId, {
          resolve,
          timeout,
        })

        try {
          ; (emitNetFn as (eventName: string, target: number, payload: NpcExecuteSkillMsg) => void)(
            reqEvent,
            target,
            msg,
          )
        } catch (error) {
          clearTimeout(timeout)
          pending.delete(msg.callId)
          reject(error)
        }
      })
    },
  }
}

async function callWireWithFallback(
  name: string,
  args: unknown[],
  fallback: RpcCaller,
  rpc: RpcCaller | undefined,
): Promise<unknown> {
  try {
    return await fallback.call(name, ...args)
  } catch (fallbackError) {
    debugWire('FALLBACK_FAIL', {
      name,
      error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
    })

    if (!rpc) {
      throw fallbackError
    }

    return rpc.call(name, ...args)
  }
}

function debugWire(
  stage: 'SEND' | 'RESULT' | 'TIMEOUT' | 'ORPHAN_RESULT' | 'FALLBACK_FAIL',
  payload: unknown,
): void {
  if (!isTransportDebugEnabled()) {
    return
  }

  try {
    console.log(`[npc:transport][WIRE][${stage}]`, payload)
  } catch {
    console.log(`[npc:transport][WIRE][${stage}]`)
  }
}

function isTransportDebugEnabled(): boolean {
  if (process.env.OPENCORE_NPC_TRANSPORT_DEBUG === '1') {
    return true
  }

  const getConvar = (globalThis as Record<string, unknown>).GetConvar
  if (typeof getConvar === 'function') {
    return String((getConvar as (name: string, fallback: string) => string)('OPENCORE_NPC_TRANSPORT_DEBUG', '0')) === '1'
  }

  return false
}

function isExecuteSkillMsg(value: unknown): value is NpcExecuteSkillMsg {
  if (!value || typeof value !== 'object') {
    return false
  }

  const msg = value as Record<string, unknown>
  return (
    typeof msg.callId === 'string' &&
    typeof msg.npcNetId === 'number' &&
    typeof msg.skill === 'string'
  )
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
    NPC: typeof NPC
    NpcSkill: typeof NpcSkill
    OnNpcHook: typeof OnNpcHook
    OnNpcEvent: typeof OnNpcEvent
  }
}
