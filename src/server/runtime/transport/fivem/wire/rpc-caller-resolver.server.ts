import { RpcAPI } from '@open-core/framework'
import type { RpcCaller } from './rpc-caller.port'

type DiWithResolve = {
  resolve?: (token: unknown) => unknown
}

export class RpcCallerResolverServer {
  constructor(private readonly di: unknown) {}

  resolve(): RpcCaller | undefined {
    const container = this.di as DiWithResolve
    if (typeof container.resolve !== 'function') {
      return undefined
    }

    let resolved: unknown
    try {
      resolved = container.resolve(RpcAPI as unknown as never)
    } catch {
      return undefined
    }

    if (!resolved || typeof resolved !== 'object') {
      return undefined
    }

    const call = (resolved as Record<string, unknown>).call
    if (typeof call !== 'function') {
      return undefined
    }

    return {
      call: (name: string, ...args: unknown[]) =>
        (call as (this: unknown, name: string, ...args: unknown[]) => Promise<unknown>).call(
          resolved,
          name,
          ...args,
        ),
    }
  }
}
