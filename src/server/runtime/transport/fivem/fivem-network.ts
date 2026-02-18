/** Safely resolves a vehicle entity handle from a network id. */
export function safeNetToVeh(netId: number): number {
  const fn = (globalThis as Record<string, unknown>).NetworkGetEntityFromNetworkId
  if (typeof fn === 'function') {
    return (fn as (id: number) => number)(netId)
  }
  return netId
}
