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
import { Npc } from '@open-core/npc-intelligence/server'

const npc = await Npc.spawn({
  model: 's_m_m_security_01',
  position: { x: 0, y: 0, z: 72 },
})

Npc.attach(npc, { allowSkills: ['idle', 'moveTo'] })
Npc.setObservation(npc, { nextSkill: 'moveTo', x: 20, y: -10, z: 72 })
```

## Core Concepts

- `Npc.spawn/destroy` delegates to framework `Npcs` API.
- `Npc.attach/detach` binds or unbinds intelligence runtime.
- `Npc.observe/setObservation` updates planner input.
- `Npc.run` forces one tick.

## Breaking Changes

- Package renamed from `@open-core/npc` to `@open-core/npc-intelligence`.
- Entity lifecycle service in this package was removed.
- Spawn input changed from `pos` to `position`.
- Runtime internals were simplified and no longer exported as public API.
