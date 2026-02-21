import { buildNpcPlannerPrompt } from '../ai/ai-prompts'
import type { LLMProvider, LlmPlanInput } from '../llm-provider'

export type OpenRouterAdapterOptions = {
  apiKey: string
  defaultModel: string
  timeoutMs?: number
  retries?: number
  endpoint?: string
  debug?: boolean
  maxResponseChars?: number
}

export class OpenRouterAdapter implements LLMProvider {
  readonly name = 'openrouter'

  constructor(private readonly options: OpenRouterAdapterOptions) {}

  async complete(input: LlmPlanInput): Promise<unknown> {
    const endpoint = this.options.endpoint ?? 'https://openrouter.ai/api/v1/chat/completions'
    const timeoutMs = this.options.timeoutMs ?? 3500
    const retries = this.options.retries ?? 0
    const maxResponseChars = this.options.maxResponseChars ?? 200_000

    const payload = {
      model: this.options.defaultModel,
      temperature: 0.2,
      messages: [
        { role: 'system', content: buildNpcPlannerPrompt() },
        {
          role: 'user',
          content: JSON.stringify({
            allowSkills: input.allowSkills,
            context: {
              goal: input.goal,
              snapshot: input.snapshot,
              memory: input.memory,
              observations: input.observations,
            },
          }),
        },
      ],
      response_format: { type: 'json_object' },
    }

    if (this.isDebugEnabled()) {
      this.debug('[SEND]', {
        endpoint,
        model: payload.model,
        allowSkills: input.allowSkills,
      })
    }

    let lastError: Error | undefined
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.options.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`OpenRouter returned ${response.status}`)
        }

        const body = await response.json()
        const content = body?.choices?.[0]?.message?.content
        if (typeof content !== 'string') {
          throw new Error('OpenRouter response missing message content')
        }
        if (content.length > maxResponseChars) {
          throw new Error(`OpenRouter response too large (${content.length} chars)`) 
        }
        return JSON.parse(content)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (this.isDebugEnabled()) {
          this.debug('[RECEIVED][EXCEPTION]', { attempt, error: lastError.message })
        }
      } finally {
        clearTimeout(timeout)
      }
    }

    throw lastError ?? new Error('OpenRouter request failed')
  }

  private isDebugEnabled(): boolean {
    if (this.options.debug) return true
    return process.env.OPENCORE_NPC_AI_DEBUG === '1'
  }

  private debug(stage: string, payload: unknown): void {
    try {
      console.log(`[npc:ai:openrouter] ${stage}`, payload)
    } catch {
      console.log(`[npc:ai:openrouter] ${stage}`)
    }
  }
}
