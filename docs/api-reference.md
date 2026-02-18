# API Reference

## Server Exports

Import from `@open-core/npc/server`.

### Plugin

- `npcPlugin(options?)`

### Controller/Decorators

- `NPC({ group, tickMs? })`
- `OnNpcHook(hook)`
- `OnNpcEvent(eventName)`
- `NpcControllerBase`

### Planning

- `NpcRulePlanner`
- `NpcAiPlanner`
- `OpenRouterProvider`

### Skills (typed refs)

- `BuiltInNpcSkills`
- `skillRef(key)`

### Runtime API (`Npc`)

- `spawn(input)`
- `destroy(npc)`
- `attach(npc, options?)`
- `detach(npc)`
- `setObservation(npc, patch)`
- `observe<T>(npc).set(patch)`
- `run(npc)`
- `memory(npc)`
- `agent(npc).run()`
- `agent(npc).memory()`
- `agent(npc).raw()`
- `getAgent(npcId)`

Example:

```ts
const npc = await Npc.spawn({
  model: 's_m_y_cop_01',
  pos: { x: 0, y: 0, z: 72 },
  heading: 0,
  networked: true,
})

Npc.attach(npc, { group: 'drivers' })
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
