import test from "node:test"
import assert from "node:assert/strict"
import { evaluateGeneralAnswer, evaluateProjectAnswer, nextFollowUpStrategy } from "../src/agents/project-deep-dive.ts"

test("general answer evaluator works for non-project questions", () => {
  const result = evaluateGeneralAnswer("Binary search runs in O(log n) and handles sorted arrays.")
  assert.equal(typeof result.correctness, "number")
})

test("project answer generates unverifiable claims for internal metrics", () => {
  const result = evaluateProjectAnswer("介绍项目", "我们内部平台把延迟降低了40%，我负责缓存层改造")
  assert.ok(result.unverifiableClaims.length > 0)
  assert.equal(result.requiresUserConfirmationBeforeLongTermMemory, true)
})

test("low ownership should choose probe_ownership", () => {
  const result = evaluateProjectAnswer("介绍项目", "我们团队做了很多优化，效果很好")
  assert.equal(nextFollowUpStrategy(result), "probe_ownership")
})

test("heavy internal jargon reduces interviewer comprehension", () => {
  const result = evaluateProjectAnswer("介绍项目", "我们在内部中台SLA链路和基建P0中做了RPC优化")
  assert.ok(result.interviewerComprehensionScore < 5)
  assert.ok(result.suggestedFollowUps.some((x) => x.includes("外部工程师")))
})
