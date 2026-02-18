export interface RpcCaller {
  call(name: string, ...args: unknown[]): Promise<unknown>
}
