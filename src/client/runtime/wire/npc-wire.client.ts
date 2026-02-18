import type { NpcExecuteSkillMsg, NpcSkillResultMsg } from '../../../shared/contracts/npc-wire.contracts'

export type NpcClientExecutor = {
  execute(msg: NpcExecuteSkillMsg): Promise<unknown>
}

/** Handles server wire execution requests on the client side. */
export class NpcWireClient {
  constructor(private readonly executor: NpcClientExecutor) {}

  /** Executes one request and maps it to wire response format. */
  async onExecute(msg: NpcExecuteSkillMsg): Promise<NpcSkillResultMsg> {
    try {
      const data = await this.executor.execute(msg)
      return {
        callId: msg.callId,
        ok: true,
        data,
      }
    } catch (error) {
      return {
        callId: msg.callId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
