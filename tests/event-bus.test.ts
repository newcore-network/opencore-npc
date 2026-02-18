import { describe, expect, it, vi } from 'vitest'
import { NpcEventBusServer } from '../src/server/runtime/events/npc-event-bus.server'
import { NpcEventBusClient } from '../src/client/runtime/events/npc-event-bus.client'

describe('Npc event bus', () => {
  it('delivers local server events', async () => {
    const bus = new NpcEventBusServer()
    const spy = vi.fn()
    bus.on('npc:state', spy)

    bus.emit('npc:state', 'npc-1', { state: 'driving' }, { scope: 'server' })
    await Promise.resolve()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('forwards to clients respecting scope', () => {
    const eventsApi = { emit: vi.fn() } as any
    const bus = new NpcEventBusServer(eventsApi, () => [11, 12])

    bus.emit('npc:state', 'npc-1', { state: 'parking' }, { scope: 'nearby', radius: 120 })
    expect(eventsApi.emit).toHaveBeenCalledTimes(2)
  })

  it('client bus receives envelope and dispatches listeners', async () => {
    const clientBus = new NpcEventBusClient()
    const spy = vi.fn()
    clientBus.on('npc:state', spy)

    clientBus.emit({
      name: 'npc:state',
      npcId: 'npc-1',
      payload: { state: 'parked_idle' },
      scope: 'all',
      ts: Date.now(),
    })

    await Promise.resolve()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
