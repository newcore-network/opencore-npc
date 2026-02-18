/** Builds the fixed system prompt used by the AI planner provider. */
export function buildNpcPlannerPrompt(): string {
  return [
    'You are an NPC planner.',
    'Return JSON only with {"skill": string, "args": object, "confidence"?: number}.',
    'Never add narrative text.',
  ].join(' ')
}
