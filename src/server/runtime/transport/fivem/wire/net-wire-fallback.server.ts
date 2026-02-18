import type {
  NpcExecuteSkillMsg,
  NpcSkillResultMsg,
} from '../../../../../shared/contracts/npc-wire.contracts'
import { debugTransport } from '../transport-debug'
import type { RpcCaller } from './rpc-caller.port'

type Pending = {
  resolve: (value: NpcSkillResultMsg) => void
  timeout: ReturnType<typeof setTimeout>
}

export class NetWireFallbackServer implements RpcCaller {
  private readonly pending = new Map<string, Pending>()
  private readonly reqEvent = 'opencore:npc:execute-skill:net'
  private readonly resEvent = 'opencore:npc:execute-skill:net:result'

  constructor() {
    const onNetFn = (globalThis as Record<string, unknown>).onNet
    if (typeof onNetFn === 'function') {
      ;(onNetFn as (eventName: string, handler: (msg: NpcSkillResultMsg) => void) => void)(
        this.resEvent,
        (msg: NpcSkillResultMsg) => {
          if (!msg || typeof msg !== 'object' || typeof msg.callId !== 'string') {
            return
          }

          const entry = this.pending.get(msg.callId)
          if (!entry) {
            debugTransport('WIRE_ORPHAN_RESULT', { callId: msg.callId })
            return
          }

          clearTimeout(entry.timeout)
          this.pending.delete(msg.callId)
          debugTransport('WIRE_RESULT', { callId: msg.callId, ok: msg.ok })
          entry.resolve(msg)
        },
      )
    }
  }

  call(name: string, ...args: unknown[]): Promise<unknown> {
    if (name !== 'opencore:npc:execute-skill') {
      throw new Error(`npc net wire fallback does not support RPC '${name}'`)
    }

    const [target, msg] = args
    if (typeof target !== 'number') {
      throw new Error('npc net wire fallback requires numeric target')
    }
    if (!isExecuteSkillMsg(msg)) {
      throw new Error('npc net wire fallback requires a valid execute-skill payload')
    }

    const emitNetFn = (globalThis as Record<string, unknown>).emitNet
    if (typeof emitNetFn !== 'function') {
      throw new Error('npc net wire fallback requires emitNet')
    }

    return new Promise<NpcSkillResultMsg>((resolve, reject) => {
      debugTransport('WIRE_SEND', { callId: msg.callId, target, skill: msg.skill })

      const timeout = setTimeout(() => {
        this.pending.delete(msg.callId)
        debugTransport('WIRE_TIMEOUT', { callId: msg.callId, target, skill: msg.skill })
        reject(new Error('npc net wire fallback timeout'))
      }, 7_000)

      this.pending.set(msg.callId, {
        resolve,
        timeout,
      })

      try {
        ;(emitNetFn as (eventName: string, target: number, payload: NpcExecuteSkillMsg) => void)(
          this.reqEvent,
          target,
          msg,
        )
      } catch (error) {
        clearTimeout(timeout)
        this.pending.delete(msg.callId)
        reject(error)
      }
    })
  }
}

function isExecuteSkillMsg(value: unknown): value is NpcExecuteSkillMsg {
  if (!value || typeof value !== 'object') {
    return false
  }

  const msg = value as Record<string, unknown>
  return (
    typeof msg.callId === 'string' &&
    typeof msg.npcNetId === 'number' &&
    typeof msg.skill === 'string'
  )
}
