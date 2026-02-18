import type { NpcAgent } from '../engine/npc-agent'
import { NpcScheduler } from '../engine/npc-scheduler'
import { NpcEngine } from '../engine/npc-engine'

type RuntimeEntry = {
  agent: NpcAgent
  nextTickAt: number
  baseTickMs?: number
}

export class NpcRuntimeService {
  private readonly entries = new Map<string, RuntimeEntry>()
  private readonly runningByNpcId = new Set<string>()
  private running = false

  constructor(
    private readonly scheduler: NpcScheduler,
    private readonly engine: NpcEngine,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true

    setInterval(async () => {
      const now = Date.now()
      for (const entry of this.entries.values()) {
        if (now < entry.nextTickAt) continue

        const npcId = entry.agent.npc.id
        if (this.runningByNpcId.has(npcId)) {
          continue
        }

        this.runningByNpcId.add(npcId)
        try {
          await this.engine.tick(entry.agent)
        } finally {
          this.runningByNpcId.delete(npcId)
        }

        const tickMs = entry.baseTickMs ?? this.scheduler.getTickMs(undefined)
        entry.nextTickAt = Date.now() + tickMs
      }
    }, 100)
  }

  register(agent: NpcAgent, baseTickMs?: number): void {
    this.entries.set(agent.npc.id, {
      agent,
      nextTickAt: Date.now(),
      baseTickMs,
    })
  }

  unregister(npcId: string): void {
    this.entries.delete(npcId)
  }
}
