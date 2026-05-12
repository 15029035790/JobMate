import test from "node:test"
import assert from "node:assert/strict"
import { LlmTool } from "../src/tools/llm.tool.ts"

test("llm tool requires api key for real calls", async () => {
  const tool = new LlmTool({ apiKey: "" })
  await assert.rejects(() => tool.complete("hello world"), /Missing LLM API key/)
})

test("llm tool calls DeepSeek-compatible chat completions endpoint", async () => {
  const originalFetch = globalThis.fetch
  let captured: { url: string; body: any } | undefined
  globalThis.fetch = (async (url, init) => {
    captured = { url: String(url), body: JSON.parse(String(init?.body)) }
    return new Response(JSON.stringify({ choices: [{ message: { content: "真实响应" } }] }), { status: 200 })
  }) as typeof fetch

  try {
    const tool = new LlmTool({ apiKey: "test-key", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash" })
    const out = await tool.complete("hello world", { system: "system prompt" })
    assert.equal(out, "真实响应")
    assert.equal(captured?.url, "https://api.deepseek.com/chat/completions")
    assert.equal(captured?.body.model, "deepseek-v4-flash")
    assert.deepEqual(captured?.body.messages.map((message: any) => message.role), ["system", "user"])
  } finally {
    globalThis.fetch = originalFetch
  }
})
