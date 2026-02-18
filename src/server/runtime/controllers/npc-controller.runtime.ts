import { GLOBAL_CONTAINER } from '@open-core/framework'
import { NPC_METADATA_KEYS } from '../../decorators/metadata-keys'
import { getNpcControllerRegistry } from '../../decorators/npc.decorator'
import type {
  ConstraintApi,
  NpcAgentConfigurator,
  NpcControllerContract,
  SkillAllowApi,
} from '../../contracts/npc-controller.types'
import type { NpcHookName } from '../../decorators/npc-hook.decorator'
import type { NpcPlanner } from '../planner/npc-planner.interface'
import type { NpcConstraints } from '../constraints/npc-constraints'
import { NpcHookBusServer } from '../events/npc-hook-bus.server'
import { NpcEventBusServer } from '../events/npc-event-bus.server'

export type NpcControllerDefinition = {
  group: string
  tickMs?: number
  planner?: NpcPlanner
  allowSkills: string[]
  configureConstraints?: (constraints: NpcConstraints) => NpcConstraints
}

class NpcControllerConfigBuilder implements NpcAgentConfigurator {
  readonly definition: NpcControllerDefinition

  constructor(group: string, tickMs?: number) {
    this.definition = {
      group,
      tickMs,
      allowSkills: [],
    }
  }

  planWith(primary: NpcPlanner, fallback?: NpcPlanner) {
    return this.usePlanner(primary, fallback)
  }

  usePlanner(primary: NpcPlanner, _fallback?: NpcPlanner) {
    this.definition.planner = primary
    return this
  }

  allowSkills(...skills: string[]) {
    this.definition.allowSkills.push(...skills)
    return this
  }

  skills(configure: (api: SkillAllowApi) => unknown) {
    const api: SkillAllowApi = {
      allow: (...skills: string[]) => {
        this.definition.allowSkills.push(...skills)
        return api
      },
    }
    configure(api)
    return this
  }

  withConstraints(configure: (constraints: ConstraintApi) => unknown) {
    return this.constraints(configure)
  }

  constraints(configure: (constraints: ConstraintApi) => unknown) {
    this.definition.configureConstraints = (constraints: NpcConstraints) => {
      configure(constraints)
      return constraints
    }
    return this
  }

  context(_configure: (_api: unknown) => unknown) {
    return this
  }
}

type NpcControllerInstance = NpcControllerContract & {
  [key: string]: unknown
}

export class NpcControllerRuntime {
  private readonly byGroup = new Map<string, NpcControllerDefinition>()
  private initialized = false

  constructor(
    private readonly hooks: NpcHookBusServer,
    private readonly events: NpcEventBusServer,
  ) {}

  initialize(): void {
    if (this.initialized) return
    this.initialized = true

    for (const ControllerClass of getNpcControllerRegistry()) {
      const meta = Reflect.getMetadata(NPC_METADATA_KEYS.CONTROLLER, ControllerClass) as
        | { group: string; tickMs?: number }
        | undefined
      if (!meta?.group) continue

      const instance = GLOBAL_CONTAINER.resolve(ControllerClass as never) as NpcControllerInstance
      this.bindDecoratedMethods(instance)

      const builder = new NpcControllerConfigBuilder(meta.group, meta.tickMs)
      if (typeof instance.configure !== 'function') {
        throw new Error(
          `@Server.NPC controller '${ControllerClass.name}' must implement configure(agent)`,
        )
      }

      instance.configure(builder)
      this.assertControllerRules(ControllerClass.name, builder.definition)

      this.byGroup.set(meta.group, builder.definition)
    }
  }

  getByGroup(group: string): NpcControllerDefinition | undefined {
    return this.byGroup.get(group)
  }

  private bindDecoratedMethods(instance: NpcControllerInstance): void {
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
          void method(ctx, info)
        })
      }

      const eventMeta = Reflect.getMetadata(NPC_METADATA_KEYS.EVENT, prototype, methodName) as
        | { eventName: string }
        | undefined
      if (eventMeta?.eventName) {
        const method = (instance[methodName] as (...args: unknown[]) => unknown).bind(instance)
        this.events.on(eventMeta.eventName, (event) => {
          void method(event)
        })
      }
    }
  }

  private assertControllerRules(controllerName: string, definition: NpcControllerDefinition): void {
    if (!definition.planner) {
      throw new Error(
        `NPC controller '${controllerName}' must configure a planner via agent.usePlanner(...)`,
      )
    }

    if (definition.allowSkills.length === 0) {
      throw new Error(
        `NPC controller '${controllerName}' must define an explicit allowlist via agent.skills(...).allow(...)`,
      )
    }

    if (!definition.configureConstraints) {
      throw new Error(
        `NPC controller '${controllerName}' must define constraints via agent.constraints(...)`,
      )
    }
  }
}
