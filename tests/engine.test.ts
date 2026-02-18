import { describe, expect, it, vi } from 'vitest'
import { NpcEngine } from '../src/server/runtime/engine/npc-engine'
import { NpcSkillRegistry } from '../src/server/runtime/engine/npc-skill-registry'
import { NpcHookBusServer } from '../src/server/runtime/events/npc-hook-bus.server'
import { NpcEventBusServer } from '../src/server/runtime/events/npc-event-bus.server'
import { NpcConstraints } from '../src/server/runtime/constraints/npc-constraints'
import { skillRef } from '../src/server/contracts/npc-skill-ref.types'
import type { NpcAgent } from '../src/server/runtime/engine/npc-agent'
import type { NpcPlanner } from '../src/server/runtime/planner/npc-planner.interface'

function createAgent(planner: NpcPlanner): NpcAgent {
  return {
    npc: { id: 'npc-1' },
    goal: { id: 'test' },
    planner,
    constraints: new NpcConstraints().allow(
      skillRef('okSkill'),
      skillRef('waitSkill'),
      skillRef('replanSkill'),
      skillRef('errorSkill'),
    ),
    observations: {},
    memory: [],
    state: new Map(),
    turnCalls: 0,
  }
}

describe('NpcEngine', () => {
  it('runs selected skill and emits hooks', async () => {
    const registry = new NpcSkillRegistry()
    registry.register({
      key: 'okSkill',
      async execute() {
        return { ok: true, next: { type: 'replan' as const } }
      },
    })

    const hooks = new NpcHookBusServer()
    const events = new NpcEventBusServer()
    const hookSpy = vi.fn()
    hooks.on('beforeSkill', hookSpy)

    const engine = new NpcEngine(registry, hooks, events, {
      async moveTo() {}, async goToEntity() {}, async wanderArea() {}, async enterVehicle() {}, async leaveVehicle() {}, async driveTo() {}, async parkVehicle() {},
      isWaitSatisfied() { return true },
    })

    const planner: NpcPlanner = { name: 'mock', async decide() { return { type: 'skill', skill: 'okSkill', args: {} } } }
    const agent = createAgent(planner)

    await engine.tick(agent)
    expect(hookSpy).toHaveBeenCalledTimes(1)
    expect(agent.active).toBeUndefined()
  })

  it('handles wait:ms and wait:until timeout', async () => {
    const registry = new NpcSkillRegistry()
    registry.register({
      key: 'waitSkill',
      async execute() {
        return { ok: true, wait: { type: 'until' as const, key: 'ready', timeoutMs: 5 }, next: { type: 'continue' as const } }
      },
    })

    const hooks = new NpcHookBusServer()
    const events = new NpcEventBusServer()
    const errorSpy = vi.fn()
    hooks.on('skillError', errorSpy)

    const engine = new NpcEngine(registry, hooks, events, {
      async moveTo() {}, async goToEntity() {}, async wanderArea() {}, async enterVehicle() {}, async leaveVehicle() {}, async driveTo() {}, async parkVehicle() {},
      isWaitSatisfied() { return false },
    })

    const planner: NpcPlanner = { name: 'mock', async decide() { return { type: 'skill', skill: 'waitSkill', args: {} } } }
    const agent = createAgent(planner)

    await engine.tick(agent)
    expect(agent.active).toBeDefined()

    await new Promise((r) => setTimeout(r, 12))
    await engine.tick(agent)
    await new Promise((r) => setTimeout(r, 12))
    await engine.tick(agent)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('handles next:replan and skill errors', async () => {
    const registry = new NpcSkillRegistry()
    registry.register({ key: 'replanSkill', async execute() { return { ok: true, next: { type: 'replan' as const } } } })
    registry.register({ key: 'errorSkill', async execute() { throw new Error('boom') } })

    const hooks = new NpcHookBusServer()
    const events = new NpcEventBusServer()
    const errorSpy = vi.fn()
    hooks.on('skillError', errorSpy)

    const engine = new NpcEngine(registry, hooks, events, {
      async moveTo() {}, async goToEntity() {}, async wanderArea() {}, async enterVehicle() {}, async leaveVehicle() {}, async driveTo() {}, async parkVehicle() {},
      isWaitSatisfied() { return true },
    })

    const plannerA: NpcPlanner = { name: 'mock', async decide() { return { type: 'skill', skill: 'replanSkill', args: {} } } }
    const agentA = createAgent(plannerA)
    await engine.tick(agentA)
    expect(agentA.active).toBeUndefined()

    const plannerB: NpcPlanner = { name: 'mock', async decide() { return { type: 'skill', skill: 'errorSkill', args: {} } } }
    const agentB = createAgent(plannerB)
    await engine.tick(agentB)
    expect(errorSpy).toHaveBeenCalled()
  })
})
