import { randomUUID } from 'node:crypto'
import type { NpcExecuteSkillMsg, NpcSkillResultMsg } from '../../../../shared/contracts/npc-wire.contracts'
 
export interface RpcLike {
  call(name: string, ...args: unknown[]): Promise<unknown>
}

/**
 * RPC bridge for server -> client skill execution calls.
 */
export class NpcWireBridgeServer {
  constructor(private readonly rpc: RpcLike) {}

  /** Executes one delegated skill request and validates response integrity. */
  async executeSkill(
    executorClientId: number,
    req: { npcNetId: number; skill: string; args: unknown },
    timeoutMs = 5000,
  ): Promise<unknown> {
    const callId = randomUUID()
    const msg: NpcExecuteSkillMsg = {
      callId,
      npcNetId: req.npcNetId,
      skill: req.skill,
      args: req.args,
    }

    const promise = this.rpc.call(
      'opencore:npc:execute-skill',
      executorClientId,
      msg,
    ) as Promise<NpcSkillResultMsg>
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('npc wire timeout')), timeoutMs)
    })
    const result = await Promise.race([promise, timeout])

    if (result.callId !== callId) {
      throw new Error('npc wire callId mismatch')
    }

    if (!result.ok) {
      throw new Error(result.error ?? 'npc wire execution failed')
    }

    return result.data
  }
}
