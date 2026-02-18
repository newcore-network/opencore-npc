import { describe, expect, it, vi } from 'vitest'
import { FiveMNpcTransportServer } from '../src/server/runtime/transport/fivem/fivem-npc-transport.server'
import { NpcWireBridgeServer } from '../src/server/runtime/transport/fivem/npc-wire-bridge.server'

describe('Connected transport delegation', () => {
  it('delegates execution to wire bridge when executor exists', async () => {
    const bridge = {
      executeSkill: vi.fn(async () => ({ ok: true })),
    }
    const transport = new FiveMNpcTransportServer({
      wireBridge: bridge,
      chooseExecutorClient: () => 10,
    })

    await transport.moveTo({ id: 'npc-1', ped: 1, netId: 33 }, { x: 1, y: 2, z: 3, speed: 1.5 })
    expect(bridge.executeSkill).toHaveBeenCalledTimes(1)
  })

  it('NpcWireBridge handles timeout and callId mismatch', async () => {
    const mismatchRpc = {
      call: vi.fn(async (_name: string, _target: number, msg: any) => ({ callId: `${msg.callId}-x`, ok: true })),
    }
    const mismatch = new NpcWireBridgeServer(mismatchRpc)
    await expect(mismatch.executeSkill(10, { npcNetId: 1, skill: 'moveTo', args: {} })).rejects.toThrow(
      'npc wire callId mismatch',
    )

    const timeoutRpc = {
      call: vi.fn(
        async () =>
          await new Promise((resolve) => {
            setTimeout(() => resolve({ callId: 'x', ok: true }), 25)
          }),
      ),
    }
    const timeout = new NpcWireBridgeServer(timeoutRpc)
    await expect(
      timeout.executeSkill(10, { npcNetId: 1, skill: 'moveTo', args: {} }, 1),
    ).rejects.toThrow('npc wire timeout')
  })
})
