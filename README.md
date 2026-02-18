# @open-core/npc

NPC + AI plugin for OpenCore, focused on server-authoritative behavior with optional connected execution on clients.

## What You Get

- Physical NPC spawn/despawn and runtime attach/detach.
- Controller-based behavior (`@NPC`) with planner + constraints.
- Built-in skills (movement, vehicle, composed drive/park flow).
- Strongly typed skill references (no magic strings in controller rules).
- Connected mode (server delegates task execution to client when needed).
- Hook and event decorators for observability.

## Install

```bash
pnpm add @open-core/npc
```

## Quick Start

### 1) Server bootstrap

```ts
import { Server } from '@open-core/framework/server'
import { npcPlugin } from '@open-core/npc/server'

Server.init({
  mode: 'RESOURCE',
  plugins: [
    npcPlugin({
      adapter: 'fivem',
      connected: true,
    }),
  ],
})
```

### 2) Client bootstrap

```ts
import { Client } from '@open-core/framework/client'
import { npcClient } from '@open-core/npc/client'

Client.init({
  mode: 'RESOURCE',
  plugins: [npcClient()],
})
```

### 3) Basic NPC controller

```ts
import { Server } from '@open-core/framework/server'
import {
  NPC,
  BuiltInNpcSkills,
  NpcControllerBase,
  NpcRulePlanner,
  type NpcAgentConfigurator,
} from '@open-core/npc/server'

@Server.Controller()
@NPC({ group: 'drivers', tickMs: 500 })
export class DriverController extends NpcControllerBase {
  override configure(agent: NpcAgentConfigurator) {
    const planner = new NpcRulePlanner()

    agent
      .planWith(planner)
      .allowSkills(BuiltInNpcSkills.goToCarDrivePark)
      .withConstraints((c) =>
        c
          .allow(BuiltInNpcSkills.goToCarDrivePark)
          .require(BuiltInNpcSkills.goToCarDrivePark, (ctx) => {
            const veh = ctx.state.get('obs.assignedVeh') as { netId?: unknown } | undefined
            const dest = ctx.state.get('obs.dest') as
              | { x?: unknown; y?: unknown; z?: unknown }
              | undefined

            return (
              typeof veh?.netId === 'number' &&
              typeof dest?.x === 'number' &&
              typeof dest?.y === 'number' &&
              typeof dest?.z === 'number'
            )
          }),
      )
  }
}
```

### 4) Spawn, attach, and update observations

```ts
import { Npc } from '@open-core/npc/server'

type DriverObs = {
  assignedVeh?: { netId: number }
  dest?: { x: number; y: number; z: number }
  goalHint?: string
}

const npc = await Npc.spawn({
  model: 's_m_y_cop_01',
  pos: { x: 0, y: 0, z: 72 },
  heading: 0,
  networked: true,
})

Npc.attach(npc, { group: 'drivers' })

Npc.observe<DriverObs>(npc).set({
  assignedVeh: { netId: 1234 },
  dest: { x: 125, y: -730, z: 260 },
  goalHint: 'Drive safely and park at destination',
})
```

## Typed Skills (Important)

Controller APIs now use typed skill refs instead of raw strings.

Use built-ins:

```ts
import { BuiltInNpcSkills } from '@open-core/npc/server'

constraints.allow(BuiltInNpcSkills.driveTo)
```

Or create your own typed ref:

```ts
import { skillRef } from '@open-core/npc/server'

const escortSkill = skillRef('escortTarget')
constraints.allow(escortSkill)
```

## Docs

- `docs/getting-started.md`
- `docs/controllers-and-skills.md`
- `docs/connected-mode.md`
- `docs/api-reference.md`
