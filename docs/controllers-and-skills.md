# Controllers and Skills

## Controller Model

Each NPC group is managed by one controller class using `@NPC({ group })`.

- `planWith(...)`: set planner strategy.
- `allowSkills(...)`: explicit allowed skills.
- `withConstraints(...)`: runtime validation and limits.

```ts
import { Server } from '@open-core/framework/server'
import {
  NPC,
  BuiltInNpcSkills,
  NpcControllerBase,
  NpcRulePlanner,
} from '@open-core/npc/server'

@Server.Controller()
@NPC({ group: 'patrol' })
export class PatrolController extends NpcControllerBase {
  override configure(agent) {
    agent
      .planWith(new NpcRulePlanner())
      .allowSkills(BuiltInNpcSkills.wanderArea, BuiltInNpcSkills.moveTo)
      .withConstraints((c) =>
        c
          .allow(BuiltInNpcSkills.wanderArea, BuiltInNpcSkills.moveTo)
          .limitCallsPerTurn(1)
          .mutexGroup('movement', [BuiltInNpcSkills.wanderArea, BuiltInNpcSkills.moveTo]),
      )
  }
}
```

## Typed Skill References

Use typed refs to avoid typo-prone strings.

```ts
import { skillRef } from '@open-core/npc/server'

const escortTarget = skillRef('escortTarget')

agent.allowSkills(escortTarget)
```

## Built-in Skill Refs

`BuiltInNpcSkills` includes:

- `moveTo`
- `goToEntity`
- `wanderArea`
- `enterVehicle`
- `leaveVehicle`
- `driveTo`
- `parkVehicle`
- `goToCarDrivePark`

## Hooks and Events (Server)

Use decorators inside any `@NPC` controller class.

```ts
import { OnNpcHook, OnNpcEvent } from '@open-core/npc/server'

@OnNpcHook('skillError')
onSkillError(_ctx: unknown, info: { skill?: string; error?: string }) {
  console.warn('skillError', info.skill, info.error)
}

@OnNpcEvent('npc:state')
onNpcState(event: { npcId: string; payload: { state?: string } }) {
  console.log('state', event.npcId, event.payload.state)
}
```
