import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenRouterAdapter } from '../src/server/runtime/planner/adapters/openrouter.adapter'

describe('OpenRouterAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws on oversized model payload', async () => {
    const content = 'x'.repeat(210_000)
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
    })))

    const adapter = new OpenRouterAdapter({
      apiKey: 'secret',
      defaultModel: 'test',
      maxResponseChars: 200_000,
    })

    await expect(
      adapter.complete({
        goal: { id: 'g' },
        snapshot: {},
        memory: [],
        observations: {},
        allowSkills: ['moveTo'],
      }),
    ).rejects.toThrow('response too large')
  })

  it('throws on upstream HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))

    const adapter = new OpenRouterAdapter({ apiKey: 'secret', defaultModel: 'test' })
    await expect(
      adapter.complete({
        goal: { id: 'g' },
        snapshot: {},
        memory: [],
        observations: {},
        allowSkills: ['moveTo'],
      }),
    ).rejects.toThrow('OpenRouter returned 500')
  })
})
