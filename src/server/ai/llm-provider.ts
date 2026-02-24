/** Per-call AI generation settings. */
export type LlmGenerationConfig = {
  model?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  timeoutMs?: number
}

/** Input payload used by LLM providers. */
export type LlmCompleteInput = {
  prompt: string
  systemPrompt?: string
  config?: LlmGenerationConfig
  meta?: {
    controllerId?: string
    skillScope?: string
  }
}

export interface LLMProvider {
  complete(input: LlmCompleteInput): Promise<string>
}
