/** Server -> client request to execute a skill in connected mode. */
export type NpcExecuteSkillMsg = {
  callId: string
  npcNetId: number
  skill: string
  args: unknown
}

/** Client -> server response for a connected-mode skill execution request. */
export type NpcSkillResultMsg = {
  callId: string
  ok: boolean
  data?: unknown
  error?: string
}
