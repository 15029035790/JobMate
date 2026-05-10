import test from "node:test"
import assert from "node:assert/strict"
import { LlmTool } from "../src/tools/llm.tool.ts"

test("llm tool uses deterministic fallback when no api key", async () => {
  const tool = new LlmTool({ apiKey: undefined })
  const out = await tool.complete("hello world")
  assert.ok(out.includes("Deterministic fallback"))
})
