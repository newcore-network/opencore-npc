export type TransportDebugStage =
  | 'WIRE_SEND'
  | 'WIRE_RESULT'
  | 'WIRE_TIMEOUT'
  | 'WIRE_ORPHAN_RESULT'
  | 'WIRE_FAILOVER'
  | 'DELEGATE_SEND'
  | 'DELEGATE_OK'
  | 'DELEGATE_FAIL'

export function isTransportDebugEnabled(): boolean {
  if (process.env.OPENCORE_NPC_TRANSPORT_DEBUG === '1') {
    return true
  }

  const getConvar = (globalThis as Record<string, unknown>).GetConvar
  if (typeof getConvar === 'function') {
    return String(
      (getConvar as (name: string, fallback: string) => string)(
        'OPENCORE_NPC_TRANSPORT_DEBUG',
        '0',
      ),
    ) === '1'
  }

  return false
}

export function debugTransport(stage: TransportDebugStage, payload: unknown): void {
  if (!isTransportDebugEnabled()) {
    return
  }

  try {
    console.log(`[npc:transport][${stage}]`, payload)
  } catch {
    console.log(`[npc:transport][${stage}]`)
  }
}
