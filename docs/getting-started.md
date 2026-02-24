# Getting Started

This guide shows the minimum setup for `@open-core/npc`.

## 1) Install plugin on server

```ts
import { Server } from '@open-core/framework/server'
import { OpenRouterAdapter, npcPlugin } from '@open-core/npc/server'

const llmProvider = new OpenRouterAdapter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultModel: 'openai/gpt-4o-mini',
})

Server.init({
  mode: 'RESOURCE',
  plugins: [
    npcPlugin({
      adapter: 'fivem',
      connected: true,
      llmProvider,
      defaults: {
        tickMsNear: 350,
        tickMsFar: 1500,
        nearRadius: 120,
      },
    }),
  ],
})
```

## 2) Install plugin on client

```ts
import { Client } from '@open-core/framework/client'
import { npcClient } from '@open-core/npc/client'

Client.init({
  mode: 'RESOURCE',
  plugins: [npcClient()],
})
```

## 3) Create a controller

```ts
import {
  NpcController,
  OnNpcEvent,
  type NpcContext,
} from '@open-core/npc/server'

@NpcController({
  id: 'drivers',
  planner: 'ai',
  skills: ['goToCarDrivePark'],
  constraints: { limitCallsPerTurn: 1 },
  tickMs: 500,
})
export class DriverController {
  @OnNpcEvent('spawn')
  onSpawn(ctx: NpcContext) {
    ctx.setGoal('Get in the car, drive, and park safely')
  }
}
```

## 4) Create a skill with DI

```ts
import { inject, injectable } from 'tsyringe'
import { NpcSkill, type NpcContext } from '@open-core/npc/server'

@injectable()
class WeaponService {
  getDefault() {
    return 'pistol'
  }
}

@NpcSkill('patrol')
export class PatrolSkill {
  constructor(@inject(WeaponService) private readonly weapons: WeaponService) {}

  async execute(ctx: NpcContext) {
    ctx.events.emit('npc:state', { state: 'patrolling', weapon: this.weapons.getDefault() })
    return { ok: true }
  }
}
```

## 5) Spawn and attach NPC

```ts
import { Npc } from '@open-core/npc/server'

const npc = await Npc.spawn({
  model: 's_m_y_cop_01',
  pos: { x: 0, y: 0, z: 72 },
  heading: 0,
  networked: true,
})

Npc.attach(npc, { controllerId: 'drivers' })
```

## 6) Send observations

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

## 7) Force manual tick (optional)

```ts
await Npc.run(npc)
```
