export interface LLMProvider {
  complete(input: { prompt: string; maxTokens?: number; temperature?: number }): Promise<string>
}
