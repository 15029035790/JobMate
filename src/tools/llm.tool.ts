export class LlmTool {
  async complete(prompt: string): Promise<string> {
    return `Deterministic MVP response for: ${prompt.slice(0, 120)}`
  }
}
