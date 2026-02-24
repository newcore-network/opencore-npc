# @open-core/npc-intelligence

AI layer for OpenCore NPCs.

`@open-core/framework` now owns physical NPC entities (`NPC`, `Npcs`).
This package only adds intelligence: planners, skills, decorators, and runtime orchestration.

## Install

```bash
pnpm add @open-core/npc-intelligence
```

## Server Quick Start

```ts
import { Server } from '@open-core/framework/server'
import { npcIntelligencePlugin } from '@open-core/npc-intelligence/server'

await Server.init({
  mode: 'CORE',
  plugins: [npcIntelligencePlugin()],
})
```

```ts
import {
  IntelligentNpcAPI,
  NpcSkill,
  npcSkill,
  NpcIntelligentController,
} from '@open-core/npc-intelligence/server'

@NpcIntelligentController({
  id: 'driver',
  planner: 'rule',
  skills: [npcSkill(GoToCarDriveParkSkill)],
})
class DriverIntelligence {
  // OpenCore DI resolves this automatically by type.
  // IntelligentNpcAPI is a API service what use Npcs API and intelligent engine
  constructor(private readonly npcInt: IntelligentNpcAPI) {}

  async spawnAndAttachDriver() {
    const npc = await this.npcInt.spawn({
      model: 's_m_m_security_01',
      position: { x: 0, y: 0, z: 72 },
    })

    this.npcInt.attach(npc, { controllerId: 'driver' })
    this.npcInt.setObservation(npc, {
      nextSkill: 'goToCarDrivePark',
      destination: { x: 120, y: -760, z: 26 },
    })
  }
}
```

## Skills and typing

- `@NpcSkill('key')` marks a class as a reusable skill implementation.
- `npcSkill(MySkillClass)` converts that class into a typed reference used by controllers.
- This avoids string mistakes in controller definitions while still letting planners decide by skill key.

```ts
@NpcSkill('goToCarDrivePark')
class GoToCarDriveParkSkill implements NpcSkill<yourReturnType> {
  readonly key = 'goToCarDrivePark'
  readonly tags = ['vehicle', 'movement', 'utility']
  readonly mutex = 'movement'
  
  async execute(ctx: NpcContext, args?: yourReturnType): Promise<SkillResult> {
    return { ok: true }
  }
}

@NpcIntelligentController({
  id: 'driver',
  skills: [npcSkill(GoToCarDriveParkSkill)],
})
class DriverIntelligence {}
```

## Core Concepts

- `IntelligentNpcAPI.spawn/destroy` delegates to framework `Npcs` API.
- `IntelligentNpcAPI.attach/detach` binds or unbinds intelligence runtime.
- `IntelligentNpcAPI.observe/setObservation` updates planner input.
- `IntelligentNpcAPI.run` forces one tick.

## Breaking Changes

- Package renamed from `@open-core/npc` to `@open-core/npc-intelligence`.
- Entity lifecycle service in this package was removed.
- Spawn input changed from `pos` to `position`.
- Global `Npc` singleton facade was removed in favor of DI (`IntelligentNpcAPI`).
- Runtime internals were simplified and no longer exported as public API.
