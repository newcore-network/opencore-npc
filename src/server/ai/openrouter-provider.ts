import type { LLMProvider, LlmCompleteInput, LlmGenerationConfig } from './llm-provider'

export type OpenRouterProviderConfig = {
  apiKey?: string
  baseUrl?: string
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  timeoutMs?: number
  extraHeaders?: Record<string, string>
}

export type OpenRouterDebugConfig = {
  enabled?: boolean
  llm?: boolean
}

/**
 * Creates a simple OpenRouter-backed LLM provider.
 *
 * @remarks
 * API key is read from `OPENROUTER_API_KEY` when not provided explicitly.
 */
export function createOpenRouterProvider(
  config: OpenRouterProviderConfig = {},
  debug: OpenRouterDebugConfig = {},
): LLMProvider | undefined {
  const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return undefined
  }

  const baseUrl = config.baseUrl ?? 'https://openrouter.ai/api/v1/chat/completions'
  const defaults: LlmGenerationConfig = {
    model: config.model ?? process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
    temperature: config.temperature ?? 0.2,
    maxTokens: config.maxTokens ?? 200,
    topP: config.topP,
    timeoutMs: config.timeoutMs ?? 15000,
  }

  return {
    async complete(input: LlmCompleteInput): Promise<string> {
      const effective = {
        ...defaults,
        ...(input.config ?? {}),
      }

      const controllerTag = input.meta?.controllerId ?? 'unknown-controller'
      const skillScope = input.meta?.skillScope ?? 'default'

      if (debug.enabled && debug.llm) {
        console.log(
          `[npc-intelligence][llm][request] controller=${controllerTag} scope=${skillScope} model=${effective.model}`,
        )
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), Math.max(500, effective.timeoutMs ?? 15000))

      try {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            ...(config.extraHeaders ?? {}),
          },
          body: JSON.stringify({
            model: effective.model,
            temperature: effective.temperature,
            max_tokens: effective.maxTokens,
            top_p: effective.topP,
            messages: [
              ...(input.systemPrompt ? [{ role: 'system', content: input.systemPrompt }] : []),
              { role: 'user', content: input.prompt },
            ],
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`OpenRouter returned ${response.status}`)
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }

        const text = data.choices?.[0]?.message?.content ?? ''
        if (debug.enabled && debug.llm) {
          console.log(`[npc-intelligence][llm][response] controller=${controllerTag} scope=${skillScope}`)
          console.log(text)
        }

        return text
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}
