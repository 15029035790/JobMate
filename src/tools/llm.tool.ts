export interface LlmOptions {
  model?: string
  apiKey?: string
  baseUrl?: string
  endpoint?: string
  timeoutMs?: number
}

export interface LlmCompleteOptions {
  system?: string
  temperature?: number
  responseFormat?: "json_object"
}

export interface LlmClient {
  complete(prompt: string, options?: LlmCompleteOptions): Promise<string>
}

export class LlmTool implements LlmClient {
  private readonly model: string
  private readonly apiKey?: string
  private readonly endpoint: string
  private readonly timeoutMs: number

  constructor(options: LlmOptions = {}) {
    const baseUrl = (options.baseUrl
      ?? process.env.DEEPSEEK_BASE_URL
      ?? process.env.LLM_BASE_URL
      ?? process.env.OPENAI_BASE_URL
      ?? "https://api.deepseek.com").replace(/\/$/, "")

    this.model = options.model
      ?? process.env.DEEPSEEK_MODEL
      ?? process.env.LLM_MODEL
      ?? process.env.OPENAI_MODEL
      ?? "deepseek-v4-flash"
    this.apiKey = options.apiKey
      ?? process.env.DEEPSEEK_API_KEY
      ?? process.env.LLM_API_KEY
      ?? process.env.OPENAI_API_KEY
    this.endpoint = options.endpoint ?? `${baseUrl}/chat/completions`
    this.timeoutMs = options.timeoutMs ?? Number(process.env.LLM_TIMEOUT_MS ?? 30_000)
  }

  async complete(prompt: string, options: LlmCompleteOptions = {}): Promise<string> {
    if (!this.apiKey) {
      throw new Error("Missing LLM API key. Set DEEPSEEK_API_KEY or LLM_API_KEY before using real LLM calls.")
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    const messages = [
      ...(options.system ? [{ role: "system", content: options.system }] : []),
      { role: "user", content: prompt }
    ]

    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options.temperature ?? 0.3,
          ...(options.responseFormat ? { response_format: { type: options.responseFormat } } : {})
        })
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`LLM request failed: ${res.status} ${err}`)
      }

      const data = await res.json() as any
      const text = data.choices?.[0]?.message?.content
      if (typeof text !== "string" || !text.trim()) throw new Error("LLM request returned an empty response.")
      return text
    } finally {
      clearTimeout(timeout)
    }
  }
}
