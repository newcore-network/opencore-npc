# Controllers and Skills

## Controller Model

Each NPC behavior is managed by one controller class using `@NpcController({ id })`.

- `id`: controller scope key used at attach time.
- `planner`: `'rule' | 'ai' | NpcPlanner instance`.
- `skills`: allowed skill keys.
- `constraints`: optional runtime limits.

```ts
import {
  NpcController,
  OnNpcEvent,
  type NpcContext,
} from '@open-core/npc/server'

@NpcController({
  id: 'patrol',
  planner: 'rule',
  skills: ['wanderArea', 'moveTo'],
  constraints: { limitCallsPerTurn: 1 },
})
export class PatrolController {
  @OnNpcEvent('spawn')
  onSpawn(ctx: NpcContext) {
    ctx.setGoal('Patrol this area')
  }
}
```

## Skills with DI

Skills are auto-discovered from `@NpcSkill(...)` and resolved from DI.

```ts
import { inject, injectable } from 'tsyringe'
import { NpcSkill, type NpcContext } from '@open-core/npc/server'

@injectable()
class WeaponService {
  getDefault() {
    return 'pistol'
  }
}

@NpcSkill('attack')
export class AttackSkill {
  constructor(@inject(WeaponService) private readonly weapons: WeaponService) {}

  async execute(ctx: NpcContext) {
    ctx.events.emit('npc:state', { state: 'attacking', weapon: this.weapons.getDefault() })
    return { ok: true }
  }
}
```

## Error handling contract for skills

Skills should not throw in normal flow. Return typed results instead:

```ts
return { ok: false, error: 'target_not_visible', cooldownPenaltyMs: 5000 }
```

The engine applies cooldown from `cooldownPenaltyMs` directly (no string matching).

## Typed skill references (optional)

Use typed refs to avoid typo-prone strings.

```ts
import { skillRef } from '@open-core/npc/server'

const escortTarget = skillRef('escortTarget')

@NpcController({
  id: 'escort',
  skills: [escortTarget],
})
export class EscortController {}
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

## Hooks and events (server)

Use decorators inside any `@NpcController` class.

Important: handlers are isolated by `id`. A controller only receives its own NPC scope.

```ts
import { OnNpcHook, OnNpcEvent, type NpcContext } from '@open-core/npc/server'

@OnNpcHook('skillError')
onSkillError(ctx: NpcContext, info: { skill?: string; error?: string }) {
  console.warn('controller', ctx.controllerId)
  console.warn('skillError', info.skill, info.error)
}

@OnNpcEvent('npc:state')
onNpcState(ctx: NpcContext, event: { npcId: string; payload: { state?: string } }) {
  console.log('controller', ctx.controllerId)
  console.log('state', event.npcId, event.payload.state)
}
```
