import { z } from 'zod'

/** Strict AI planner response schema accepted by the engine. */
export const AiDecisionSchema = z.object({
  skill: z.string().min(1),
  args: z.unknown(),
  confidence: z.number().min(0).max(1).optional(),
})

/** Parsed AI decision payload type. */
export type AiDecision = z.infer<typeof AiDecisionSchema>
