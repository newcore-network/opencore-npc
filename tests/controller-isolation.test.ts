import { describe, expect, it, vi } from 'vitest'
import { NpcController } from '../src/server/decorators/npc.decorator'
import { OnNpcEvent } from '../src/server/decorators/on-npc-event.decorator'
import { OnNpcHook } from '../src/server/decorators/npc-hook.decorator'
import { NpcControllerRuntime } from '../src/server/runtime/controllers/npc-controller.runtime'
import { NpcHookBusServer } from '../src/server/runtime/events/npc-hook-bus.server'
import { NpcEventBusServer } from '../src/server/runtime/events/npc-event-bus.server'
import { NpcRulePlanner } from '../src/server/runtime/planner/npc-rule-planner'

describe('Npc controller isolation', () => {
  it('executes handlers only for matching controller id', async () => {
    const guardHook = vi.fn()
    const civilianHook = vi.fn()
    const guardEvent = vi.fn()
    const civilianEvent = vi.fn()

    @NpcController({ id: 'guard', skills: ['moveTo'] })
    class GuardController {
      @OnNpcHook('beforePlan')
      onBeforePlan(ctx: unknown) {
        guardHook(ctx)
      }

      @OnNpcEvent('spawn')
      onSpawn(ctx: unknown) {
        guardEvent(ctx)
      }
    }

    @NpcController({ id: 'civilian', skills: ['moveTo'] })
    class CivilianController {
      @OnNpcHook('beforePlan')
      onBeforePlan(ctx: unknown) {
        civilianHook(ctx)
      }

      @OnNpcEvent('spawn')
      onSpawn(ctx: unknown) {
        civilianEvent(ctx)
      }
    }

    const hooks = new NpcHookBusServer()
    const events = new NpcEventBusServer()
    const runtime = new NpcControllerRuntime(hooks, events, () => new NpcRulePlanner())
    runtime.initialize()

    const guardCtx = {
      controllerId: 'guard',
      npc: { id: 'npc-1' },
      goal: { id: 'guard' },
      setGoal: vi.fn(),
      snapshot: {},
      memory: [],
      observations: {},
      events: { emit: vi.fn() },
      transport: {},
      state: { get: vi.fn(), set: vi.fn() },
    }

    hooks.emit('beforePlan', guardCtx)
    events.emit('spawn', 'npc-1', { state: 'spawned' }, { scope: 'server', controllerId: 'guard' }, guardCtx as any)
    await Promise.resolve()

    expect(guardHook).toHaveBeenCalledTimes(1)
    expect(civilianHook).toHaveBeenCalledTimes(0)
    expect(guardEvent).toHaveBeenCalledTimes(1)
    expect(civilianEvent).toHaveBeenCalledTimes(0)
  })
})
