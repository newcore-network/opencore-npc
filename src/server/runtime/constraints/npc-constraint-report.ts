/** Detailed validation report produced by NPC constraint checks. */
export type ConstraintReport = {
  allowed: boolean
  reasons: string[]
  mutex?: { key: string; heldBy?: string }
  budget?: { aiAllowed: boolean; remainingRequests?: number }
}
