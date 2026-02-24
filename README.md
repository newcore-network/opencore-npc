# @open-core/npc-intelligence

NPC intelligence layer for OpenCore.

`@open-core/framework` owns NPC entities (`NPC`, `Npcs`).
This package adds intelligence only: controllers, skills, planners, and runtime orchestration.

## Install

```bash
pnpm add @open-core/npc-intelligence
```

## Quick Start

```ts
import { Server } from '@open-core/framework/server'
import {
  npcIntelligencePlugin,
  IntelligentNpcAPI,
  NpcIntelligentController,
  GoToCarDriveParkSkill,
} from '@open-core/npc-intelligence/server'

await Server.init({
  mode: 'CORE',
  plugins: [npcIntelligencePlugin()],
})

@NpcIntelligentController({
  id: 'driver',
  planner: 'rule',
  skills: [GoToCarDriveParkSkill],
})
class DriverController {
  constructor(private readonly npcInt: IntelligentNpcAPI) {}

  async createDriver() {
    const npc = await this.npcInt.spawn({
      model: 's_m_m_security_01',
      position: { x: 0, y: 0, z: 72 },
    })

    this.npcInt.attach(npc, { controllerId: 'driver' })
    this.npcInt.setObservation(npc, {
      nextSkill: 'goToCarDrivePark',
      vehicleNetId: 123,
      dest: { x: 120, y: -760, z: 26 },
    })
  }
}
```

## Skills

- Skills are class-based and must use `@NpcSkill()`.
- Skill key is automatic from class name.
  - `MoveToSkill` -> `moveTo`
  - `GoToCarDriveParkSkill` -> `goToCarDrivePark`
- Controllers use classes directly: `skills: [MoveToSkill, GoToCarDriveParkSkill]`.

```ts
import { NpcSkill } from '@open-core/npc-intelligence/server'
import type { NpcContext, SkillResult, NpcSkill as NpcSkillContract } from '@open-core/npc-intelligence/server'

type Args = { x: number; y: number; z: number }

@NpcSkill()
class MoveToSkill implements NpcSkillContract<Args> {
  execute(ctx: NpcContext, args: Args): SkillResult {
    ctx.npc.setPosition(args)
    return { ok: true }
  }
}
```

## Breaking Changes

- Package is `@open-core/npc-intelligence`.
- `server/runtime/**` architecture is removed.
- Controller skills are class-only; no string skill lists.
- Skill keys are automatic from class names.
- `IntelligentNpcAPI` is the public injectable service.
