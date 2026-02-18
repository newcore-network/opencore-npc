# Getting Started

This guide shows the minimum setup for `@open-core/npc`.

## 1) Install Plugin on Server

```ts
import { Server } from '@open-core/framework/server'
import { npcPlugin } from '@open-core/npc/server'

Server.init({
  mode: 'RESOURCE',
  plugins: [
    npcPlugin({
      adapter: 'fivem',
      connected: true,
      defaults: {
        tickMsNear: 350,
        tickMsFar: 1500,
        nearRadius: 120,
      },
    }),
  ],
})
```

## 2) Install Plugin on Client

```ts
import { Client } from '@open-core/framework/client'
import { npcClient } from '@open-core/npc/client'

Client.init({
  mode: 'RESOURCE',
  plugins: [npcClient()],
})
```

## 3) Create a Controller

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
    agent
      .planWith(new NpcRulePlanner())
      .allowSkills(BuiltInNpcSkills.goToCarDrivePark)
      .withConstraints((constraints) =>
        constraints.allow(BuiltInNpcSkills.goToCarDrivePark),
      )
  }
}
```

## 4) Spawn and Attach NPC

```ts
import { Npc } from '@open-core/npc/server'

const npc = await Npc.spawn({
  model: 's_m_y_cop_01',
  pos: { x: 0, y: 0, z: 72 },
  heading: 0,
  networked: true,
})

Npc.attach(npc, { group: 'drivers' })
```

## 5) Send Observations

```ts
type DriverObs = {
  assignedVeh?: { netId: number }
  dest?: { x: number; y: number; z: number }
  goalHint?: string
}

Npc.observe<DriverObs>(npc).set({
  assignedVeh: { netId: 65533 },
  dest: { x: 125, y: -730, z: 260 },
  goalHint: 'Get in the car, drive, and park safely',
})
```

## 6) Force Manual Tick (Optional)

```ts
await Npc.run(npc)
```
