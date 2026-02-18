import { debugTransport } from '../transport-debug'
import type { RpcCaller } from './rpc-caller.port'

export class CompositeWireCallerServer implements RpcCaller {
  constructor(
    private readonly primary: RpcCaller,
    private readonly secondary?: RpcCaller,
  ) {}

  async call(name: string, ...args: unknown[]): Promise<unknown> {
    try {
      return await this.primary.call(name, ...args)
    } catch (primaryError) {
      if (!this.secondary) {
        throw primaryError
      }

      debugTransport('WIRE_FAILOVER', {
        name,
        error: primaryError instanceof Error ? primaryError.message : String(primaryError),
      })
      return this.secondary.call(name, ...args)
    }
  }
}
