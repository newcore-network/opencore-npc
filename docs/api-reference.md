# API Reference

## Server Exports

Import from `@open-core/npc/server`.

### Plugin

- `npcPlugin(options?)`
  - options: `adapter`, `connected`, `defaults`, `llmProvider`, `aiBudget`

### Controller/Decorators

- `NpcController({ id, planner?, skills, constraints?, tickMs? })`
- `NpcSkill(key, options?)`
- `OnNpcHook(hook)`
- `OnNpcEvent(eventName)`

`OnNpcHook` and `OnNpcEvent` handlers receive `NpcContext` as first argument.

### Planning

- `NpcRulePlanner`
- `NpcAiPlanner`
- `LLMProvider`
- `OpenRouterAdapter`

### Skills (typed refs)

- `BuiltInNpcSkills`
- `skillRef(key)`

### Context

- `NpcContext`

### Runtime API (`Npc`)

- `spawn(input)`
- `destroy(npc)`
- `attach(npc, options?)`
  - options: `controllerId`, `planner`, `goal`, `tickMs`, `configureConstraints`
- `detach(npc)`
- `setObservation(npc, patch)`
- `observe<T>(npc).set(patch)`
- `run(npc)`
- `memory(npc)`
- `agent(npc).run()`
- `agent(npc).memory()`
- `agent(npc).raw()`
- `getAgent(npcId)`

#### Lifecycle and behavior flow

- `spawn`: creates physical entity only.
- `attach`: creates runtime agent and wires controller/planner/skills.
- `observe` / `setObservation`: updates per-NPC context input.
- `run`: executes one engine tick (plan -> validate -> execute skill).
- `detach` / `destroy`: stop runtime / remove entity.

#### Where AI is called

AI is called during `run`/scheduler ticks when the controller planner is AI-backed.

`NpcEngine.tick` -> planner `decide(ctx, allowSkills)` -> `LLMProvider.complete(...)` -> decision -> skill execution.

#### How context is built

Per tick, the engine builds `NpcContext` from:

- npc identity
- controller id
- goal
- observations
- memory
- runtime state map
- transport/events helpers

`snapshot` is generated from observations as a compact deterministic view for planning.

Example:

```ts
import { Npc } from '@open-core/npc/server'

const npc = await Npc.spawn({
  model: 's_m_y_cop_01',
  pos: { x: 0, y: 0, z: 72 },
  heading: 0,
  networked: true,
})

Npc.attach(npc, { controllerId: 'drivers' })
Npc.setObservation(npc, { goalHint: 'Patrol the area' })
await Npc.agent(npc).run()
```

## Client Exports

Import from `@open-core/npc/client`.

- `npcClient()`
- `NpcController()`
- `OnNpcEvent(eventName)`

Example:

```ts
import { NpcController, OnNpcEvent } from '@open-core/npc/client'

@NpcController()
export class NpcDebugController {
  @OnNpcEvent('npc:state')
  onNpcState(payload: unknown) {
    console.log('npc state', payload)
  }
}
```
