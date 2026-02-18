# NPC Refactor Tasks

This file tracks runtime refactor items observed in real gameplay testing.

## Completed

- Added per-agent runtime lock to prevent overlapping ticks (`NpcRuntimeService`).
- Added planner decision arg pre-validation before skill execution (`NpcEngine`).
- Added skill cooldowns after failures to avoid tight retry loops (`NpcEngine`).
- Added long cooldown for missing connected executor errors (`NpcEngine`).
- Added AI request throttling controls (`NpcAiPlanner`):
  - `minDecisionIntervalMs`
  - `disableAfterFirstFailure`
- Set OpenRouter provider default retries to `0` (`OpenRouterProvider`).
- Updated `npctest` demo controller to use safer AI config:
  - retries `0`
  - lower request budget
  - decision interval + disable-on-failure

## Remaining

- Replace NPC controller secondary resolve path with framework processor-only wiring to keep constructor DI stable.
- Improve connected executor selection (nearest/owner with availability checks).
- Add strict skill argument schema map by skill key at planner boundary.
- Expose per-agent diagnostics (`lastAiAt`, `lastError`, `cooldowns`, `executor`) for live debugging.
- Add integration test that simulates missing executor and verifies no error spam loop.
