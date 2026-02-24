# @open-core/npc-intelligence

Decorator-first AI layer for OpenCore NPCs.

- `@open-core/framework` owns entity lifecycle (`NPC`, `Npcs`).
- `@open-core/npc-intelligence` adds controller-driven behavior, skills, planners, and optional LLM decisions.

## Install

```bash
pnpm add @open-core/npc-intelligence
```

## Public API

Default server entrypoint exports only the core surface:

- `npcIntelligencePlugin`
- `IntelligentNpcAPI`
- `NpcIntelligentController`, `NpcSkill`, `OnNpcHook`, `OnNpcEvent`
- `skillKey(SkillClass)` helper
- core types: `NpcContext`, `SkillResult`, `NpcIntelligentControllerDefinition`
- built-in skills: `IdleSkill`, `MoveToSkill`, `MoveRelativeSkill`, `SetHeadingSkill`, `WaitSkill`, `LookAtEntitySkill`, `GoToCarDriveParkSkill`

Advanced APIs are in `@open-core/npc-intelligence/server/advanced`.

## Quick Start (Rule)

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
  id: 'rule-driver',
  planner: 'rule',
  skills: [GoToCarDriveParkSkill],
})
class RuleDriverController {
  constructor(private readonly npcInt: IntelligentNpcAPI) {}

  async assignDriveTask(vehicleNetId: number) {
    const npc = await this.npcInt.spawn({
      model: 'mp_m_freemode_01',
      position: { x: 0, y: 0, z: 72 },
      networked: true,
    })

    await this.npcInt
      .rule('rule-driver')
      .for(npc)
      .name('Valentine Driver')
      .npcType('driver')
      .do(GoToCarDriveParkSkill, {
        vehicleNetId,
        dest: { x: 120, y: -760, z: 26 },
      })
      .run()
  }
}
```

## Quick Start (AI + OpenRouter)

Set API key via environment variable:

```bash
export OPENROUTER_API_KEY=...
```

```ts
import { Server } from '@open-core/framework/server'
import {
  npcIntelligencePlugin,
  NpcIntelligentController,
  GoToCarDriveParkSkill,
  MoveToSkill,
} from '@open-core/npc-intelligence/server'

await Server.init({
  mode: 'CORE',
  plugins: [
    npcIntelligencePlugin({
      openRouter: {
        model: 'openai/gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 220,
      },
      debug: {
        enabled: process.env.NPC_AI_DEBUG === '1',
        runtime: true,
        llm: process.env.NPC_AI_DEBUG_LLM === '1',
      },
    }),
  ],
})

@NpcIntelligentController({
  id: 'ai-driver',
  planner: 'ai',
  skills: [GoToCarDriveParkSkill, MoveToSkill],
  ai: {
    model: 'openai/gpt-4o-mini',
    temperature: 0.25,
    perSkill: {
      goToCarDrivePark: {
        model: 'openai/gpt-4o',
        temperature: 0.1,
      },
    },
  },
})
class AiDriverController {}
```

Use AI builder context (instead of raw `setObservation`) for readability:

```ts
await npcInt
  .ai('ai-driver')
  .for(npc)
  .name('Courier #4')
  .npcType('courier')
  .goal('deliver-order', 'arrive quickly but safely')
  .instruction('Take vehicle 120 and park near the player')
  .playerPos(player)
  .deny(WaitSkill)
  .run()
```

## Skills

- Skills are class-based and must use `@NpcSkill()`.
- Key is automatic from class name:
  - `MoveToSkill` -> `moveTo`
  - `GoToCarDriveParkSkill` -> `goToCarDrivePark`
- Controllers use class references directly: `skills: [MoveToSkill, WaitSkill]`.
- Rule runner infers args from skill class: `do(MoveToSkill, { x, y, z })`.

### Custom Skill

```ts
import { NpcSkill } from '@open-core/npc-intelligence/server'
import type {
  NpcContext,
  SkillResult,
  NpcSkill as NpcSkillContract,
} from '@open-core/npc-intelligence/server'

type Args = { x: number; y: number; z: number }

@NpcSkill()
class MoveToPointSkill implements NpcSkillContract<Args> {
  execute(ctx: NpcContext, args: Args): SkillResult {
    ctx.npc.setPosition(args)
    return { ok: true }
  }
}
```

### LookAtEntitySkill contract

`LookAtEntitySkill` requires:

- `entity: BaseEntity & Spatial`

This means the target must be a `BaseEntity` that also implements `Spatial` (`getPosition`).

## Debugging

Enable runtime/LLM logs:

- `NPC_AI_DEBUG=1` enables runtime logs (attach, observe, decisions, skill execution).
- `NPC_AI_DEBUG_LLM=1` prints LLM request/response traces.

## Advanced API

Use when you need custom planner/provider wiring:

```ts
import {
  NpcAiPlanner,
  NpcRulePlanner,
  createOpenRouterProvider,
} from '@open-core/npc-intelligence/server/advanced'
```

## Rule vs AI

- `rule(...)`: deterministic. Programmer chooses exact skill(s), sequence, and arguments.
- `ai(...)`: planner chooses the next skill from the controller skill list using current context.
- Both return explicit `RunResult` (`ok`, `done`, `skill`, `waitMs`, `error`).

## Notes

- `OPENROUTER_API_KEY` is env-only. No Convar fallback.
- If AI planner is configured but no provider/API key is available, controller falls back to rule planner.
