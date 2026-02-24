import type { OpenCoreClientPlugin } from '@open-core/framework/client'
import { NpcController } from './decorators/npc-controller.decorator'
import { OnNpcEvent } from './decorators/on-npc-event.decorator'

export function npcIntelligenceClient(): OpenCoreClientPlugin {
  return {
    name: 'npc-intelligence-client',
    install(ctx) {
      ctx.client.registerApiExtension('NpcController', NpcController)
      ctx.client.registerApiExtension('OnNpcEvent', OnNpcEvent)
    },
  }
}

export const npcClient = npcIntelligenceClient

declare module '@open-core/framework/client' {
  interface ClientPluginApi {
    NpcController: typeof NpcController
    OnNpcEvent: typeof OnNpcEvent
  }
}
