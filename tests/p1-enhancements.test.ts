import test from "node:test"
import assert from "node:assert/strict"
import { VersionDiffTool } from "../src/tools/version-diff.tool.ts"
import { VectorMemoryStore } from "../src/memory/vector-memory.store.ts"

test("version diff provides detailed changes", () => {
  const tool = new VersionDiffTool()
  const before = { basics: {}, skills: [{ category: "g", items: ["node"] }], experiences: [], projects: [{ name: "p", description: "d", techStack: [], bullets: ["a"] }], summary: "old" }
  const after = { basics: {}, skills: [{ category: "g", items: ["node", "sql"] }], experiences: [], projects: [{ name: "p", description: "d", techStack: [], bullets: ["a", "b"] }], summary: "new" }
  const diffs = tool.detailedDiff(before as any, after as any)
  assert.ok(diffs.length >= 2)
})

test("vector memory searchWithScores supports minScore", () => {
  const store = new VectorMemoryStore()
  store.add({ userId: "u1", entityType: "review", entityId: "r1", text: "distributed systems and latency" })
  store.add({ userId: "u1", entityType: "review", entityId: "r2", text: "frontend css ui" })
  const results = store.searchWithScores("u1", "distributed latency", 5, 0.1)
  assert.ok(results.length >= 1)
  assert.ok(results[0].score >= 0.1)
})
