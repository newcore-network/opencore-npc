import { buildNpcPlannerPrompt } from './ai-prompts'

export type OpenRouterProviderOptions = {
  apiKey: string
  defaultModel: string
  timeoutMs?: number
  retries?: number
  endpoint?: string
  debug?: boolean
}

/** Provider contract used by the AI planner. */
export interface AiProvider {
  complete(input: { model?: string; context: unknown; allowSkills: string[] }): Promise<unknown>
}

/**
 * OpenRouter-backed provider implementation.
 *
 * @remarks
 * Returns parsed JSON only.
 */
export class OpenRouterProvider implements AiProvider {
  constructor(private readonly options: OpenRouterProviderOptions) {}

  /** Sends a bounded request to OpenRouter and parses JSON output. */
  async complete(input: { model?: string; context: unknown; allowSkills: string[] }): Promise<unknown> {
    const endpoint = this.options.endpoint ?? 'https://openrouter.ai/api/v1/chat/completions'
    const timeoutMs = this.options.timeoutMs ?? 3500
    const retries = this.options.retries ?? 0

    const payload = {
      model: input.model ?? this.options.defaultModel,
      temperature: 0.2,
      messages: [
        { role: 'system', content: buildNpcPlannerPrompt() },
        {
          role: 'user',
          content: JSON.stringify({
            allowSkills: input.allowSkills,
            context: input.context,
          }),
        },
      ],
      response_format: { type: 'json_object' },
    }

    if (this.isDebugEnabled()) {
      this.debug('[SEND]', {
        endpoint,
        model: payload.model,
        temperature: payload.temperature,
        allowSkills: input.allowSkills,
        context: input.context,
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
          if (this.isDebugEnabled()) {
            this.debug('[RECEIVED][ERROR]', { status: response.status })
          }
          throw new Error(`OpenRouter returned ${response.status}`)
        }

        const body = await response.json()
        const content = body?.choices?.[0]?.message?.content
        if (this.isDebugEnabled()) {
          this.debug('[RECEIVED][RAW]', {
            id: body?.id,
            model: body?.model,
            finish_reason: body?.choices?.[0]?.finish_reason,
            content: typeof content === 'string' ? truncate(content, 2000) : content,
          })
        }
        if (typeof content !== 'string') {
          throw new Error('OpenRouter response missing message content')
        }

        const parsed = JSON.parse(content)
        if (this.isDebugEnabled()) {
          this.debug('[RECEIVED][PARSED]', parsed)
        }
        return parsed
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

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}
