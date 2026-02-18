import { Client, type OpenCoreClientPlugin } from '@open-core/framework/client'
import { NpcController } from './decorators/npc-controller.decorator'
import { OnNpcEvent } from './decorators/on-npc-event.decorator'
import { NpcEventBusClient } from './runtime/events/npc-event-bus.client'
import { NpcWireClient } from './runtime/wire/npc-wire.client'
import { FiveMNpcExecutorClient } from './runtime/transport/fivem/fivem-npc-executor.client'
import type { NpcExecuteSkillMsg } from '../shared/contracts/npc-wire.contracts'
import type { NpcEventEnvelope } from '../shared/contracts/npc-events.contracts'

@Client.Controller()
class NpcInternalClientController {
  constructor(
    private readonly bus: NpcEventBusClient,
    private readonly wire: NpcWireClient,
  ) {}

  @Client.OnNet('opencore:npc:event')
  onAnyNpcEvent(envelope: NpcEventEnvelope<unknown>) {
    this.bus.emit(envelope)
  }

  @Client.OnRPC('opencore:npc:execute-skill')
  async onExecuteSkill(msg: NpcExecuteSkillMsg) {
    return this.wire.onExecute(msg)
  }

  @Client.OnNet('opencore:npc:execute-skill:net')
  async onExecuteSkillNet(msg: NpcExecuteSkillMsg) {
    const result = await this.wire.onExecute(msg)
    const emitNetFn = (globalThis as Record<string, unknown>).emitNet
    if (typeof emitNetFn === 'function') {
      ;(emitNetFn as (eventName: string, payload: unknown) => void)(
        'opencore:npc:execute-skill:net:result',
        result,
      )
    }
  }
}

/** Creates the optional NPC client plugin. */
export function npcClient(): OpenCoreClientPlugin {
  return {
    name: 'npc-client',
    install(ctx) {
      ctx.client.registerApiExtension('NPCController', NpcController)
      ctx.client.registerApiExtension('OnNpcEvent', OnNpcEvent)

      const bus = new NpcEventBusClient()
      const executor = new FiveMNpcExecutorClient()
      const wire = new NpcWireClient(executor)
      ctx.di.register(NpcEventBusClient, bus)
      ctx.di.register(FiveMNpcExecutorClient, executor)
      ctx.di.register(NpcWireClient, wire)
      ctx.di.register(NpcInternalClientController, new NpcInternalClientController(bus, wire))

      const g = globalThis as Record<string, unknown>
      const onNetFn = g.onNet
      const emitNetFn = g.emitNet

      if (typeof onNetFn === 'function' && typeof emitNetFn === 'function') {
        ;(onNetFn as (eventName: string, handler: (msg: NpcExecuteSkillMsg) => void) => void)(
          'opencore:npc:execute-skill:net',
          (msg: NpcExecuteSkillMsg) => {
            void (async () => {
              const result = await wire.onExecute(msg)
              ;(emitNetFn as (eventName: string, payload: unknown) => void)(
                'opencore:npc:execute-skill:net:result',
                result,
              )
            })()
          },
        )
      }

      if (typeof emitNetFn === 'function') {
        const emitReady = () => {
          ;(emitNetFn as (eventName: string) => void)('opencore:npc:executor:ready')
        }

        emitReady()
        setInterval(emitReady, 5000)
      }
    },
  }
}

declare module '@open-core/framework/client' {
  interface ClientPluginApi {
    NPCController: typeof NpcController
    OnNpcEvent: typeof OnNpcEvent
  }
}
