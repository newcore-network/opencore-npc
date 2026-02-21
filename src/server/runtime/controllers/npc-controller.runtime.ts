import { GLOBAL_CONTAINER } from '@open-core/framework'
import { NPC_METADATA_KEYS } from '../../decorators/metadata-keys'
import { getNpcControllerRegistry } from '../../decorators/npc.decorator'
import { skillKeyOf, type NpcSkillLike } from '../../contracts/npc-skill-ref.types'
import type { NpcHookName } from '../../decorators/npc-hook.decorator'
import type { NpcPlanner } from '../planner/npc-planner.interface'
import type { NpcConstraints } from '../constraints/npc-constraints'
import { NpcHookBusServer } from '../events/npc-hook-bus.server'
import { NpcEventBusServer } from '../events/npc-event-bus.server'

export type ControllerPlannerInput = 'rule' | 'ai' | NpcPlanner | undefined

export type NpcControllerDefinition = {
  id: string
  tickMs?: number
  planner: NpcPlanner
  allowSkills: string[]
  configureConstraints: (constraints: NpcConstraints) => NpcConstraints
}

type NpcControllerMetadata = {
  id: string
  tickMs?: number
  planner?: ControllerPlannerInput
  skills: string[]
  constraints?: {
    limitCallsPerTurn?: number
  }
}

type NpcControllerInstance = {
  [key: string]: unknown
}

export class NpcControllerRuntime {
  private readonly byId = new Map<string, NpcControllerDefinition>()
  private initialized = false

  constructor(
    private readonly hooks: NpcHookBusServer,
    private readonly events: NpcEventBusServer,
    private readonly resolvePlanner: (planner: ControllerPlannerInput) => NpcPlanner,
  ) {}

  initialize(): void {
    if (this.initialized) return
    this.initialized = true

    for (const ControllerClass of getNpcControllerRegistry()) {
      const meta = Reflect.getMetadata(NPC_METADATA_KEYS.CONTROLLER, ControllerClass) as
        | NpcControllerMetadata
        | undefined
      if (!meta?.id) continue

      const instance = GLOBAL_CONTAINER.resolve(ControllerClass as never) as NpcControllerInstance
      this.bindDecoratedMethods(instance, meta.id)

      const planner = this.resolvePlanner(meta.planner)
      const allowSkills = meta.skills.map((skill) => this.resolveSkillKey(skill))

      if (allowSkills.length === 0) {
        throw new Error(`NpcController '${ControllerClass.name}' must declare at least one skill`)
      }

      this.byId.set(meta.id, {
        id: meta.id,
        tickMs: meta.tickMs,
        planner,
        allowSkills,
        configureConstraints: (constraints: NpcConstraints) => {
          constraints.allow(...allowSkills.map((skill) => ({ key: skill } as NpcSkillLike)))
          if (typeof meta.constraints?.limitCallsPerTurn === 'number') {
            constraints.limitCallsPerTurn(meta.constraints.limitCallsPerTurn)
          }
          return constraints
        },
      })
    }
  }

  getById(id: string): NpcControllerDefinition | undefined {
    return this.byId.get(id)
  }

  private resolveSkillKey(skill: string | NpcSkillLike): string {
    if (typeof skill === 'string') {
      return skill
    }
    return skillKeyOf(skill)
  }

  private bindDecoratedMethods(instance: NpcControllerInstance, controllerId: string): void {
    const prototype = Object.getPrototypeOf(instance)
    const methods = Object.getOwnPropertyNames(prototype).filter(
      (m) => m !== 'constructor' && typeof instance[m] === 'function',
    )

    for (const methodName of methods) {
      const hookMeta = Reflect.getMetadata(NPC_METADATA_KEYS.HOOK, prototype, methodName) as
        | { hook: NpcHookName }
        | undefined
      if (hookMeta?.hook) {
        const method = (instance[methodName] as (...args: unknown[]) => unknown).bind(instance)
        this.hooks.on(hookMeta.hook, (ctx, info) => {
          if (!ctx || typeof ctx !== 'object') return
          const scope = (ctx as { controllerId?: unknown }).controllerId
          if (scope !== controllerId) return
          void method(ctx, info)
        })
      }

      const eventMeta = Reflect.getMetadata(NPC_METADATA_KEYS.EVENT, prototype, methodName) as
        | { eventName: string }
        | undefined
      if (eventMeta?.eventName) {
        const method = (instance[methodName] as (...args: unknown[]) => unknown).bind(instance)
        this.events.on(eventMeta.eventName, (event, ctx) => {
          if (!event || event.controllerId !== controllerId || !ctx) return
          void method(ctx, event)
        })
      }
    }
  }
}
