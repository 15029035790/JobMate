import test from "node:test"
import assert from "node:assert/strict"
import { InMemoryDatabase } from "../src/db/in-memory-database.ts"
import { AgentRuntime } from "../src/harness/agent-runtime.ts"
import { TaskRouter } from "../src/harness/task-router.ts"
import { InterviewReviewNegotiationAgent } from "../src/agents/interview-review-negotiation.agent.ts"
import { MemoryCommitController } from "../src/reflection/memory-commit-controller.ts"
import { LongTermMemoryStore } from "../src/memory/long-term-memory.store.ts"

test("router + runtime can execute review draft flow", async () => {
  const db = new InMemoryDatabase()
  const runtime = new AgentRuntime()
  runtime.register(new InterviewReviewNegotiationAgent(db))
  const router = new TaskRouter()
  const agentName = router.route("create_review_draft")
  assert.equal(agentName, "interview_review_negotiation")
  const out = await runtime.run({ taskId: "t1", userId: "u1", sessionId: "s1", agentName, taskType: "create_review_draft", payload: { mode: "create", interviewSessionId: "i1" }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(out.status, "success")
})

test("memory controller blocks unverifiable project long-term writes", () => {
  const m = new MemoryCommitController(new LongTermMemoryStore())
  assert.throws(() => m.handle([{ memoryType: "long_term", entityType: "project_answer_evaluation", entityId: "p1", payload: { unverifiableClaims: ["x"] }, requiresUserConfirmation: false }], "u1"))
})
