export interface LlmOptions {
  model?: string
  apiKey?: string
  endpoint?: string
  provider?: "openai_responses" | "openai_chat"
}

export class LlmTool {
  private readonly model: string
  private readonly apiKey?: string
  private readonly endpoint: string
  private readonly provider: "openai_responses" | "openai_chat"

  constructor(options: LlmOptions = {}) {
    const baseUrl = (process.env.OPENAI_BASE_URL ?? process.env.LLM_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "")
    this.model = options.model ?? process.env.OPENAI_MODEL ?? process.env.LLM_MODEL ?? "deepseek-v4-flash"
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY

    const inferredProvider = baseUrl.includes("deepseek") ? "openai_chat" : "openai_responses"
    this.provider = options.provider ?? (process.env.LLM_PROVIDER as any) ?? inferredProvider
    this.endpoint = options.endpoint
      ?? (this.provider === "openai_chat" ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/responses`)
  }

  async complete(prompt: string): Promise<string> {
    if (!this.apiKey) {
      return `Deterministic fallback (no LLM API key): ${prompt.slice(0, 120)}`
    }

    const payload = this.provider === "openai_chat"
      ? { model: this.model, messages: [{ role: "user", content: prompt }], temperature: 0.3 }
      : { model: this.model, input: prompt, temperature: 0.3 }

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`LLM request failed: ${res.status} ${err}`)
    }

    const data = await res.json() as any
    if (this.provider === "openai_chat") {
      return data.choices?.[0]?.message?.content ?? "(empty model response)"
    }

    const text = data.output_text
      ?? data.output?.flatMap((o: any) => o.content ?? []).map((c: any) => c.text).filter(Boolean).join("\n")
      ?? ""
    return text || "(empty model response)"
  }
}
