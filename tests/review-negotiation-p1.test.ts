import test from "node:test"
import assert from "node:assert/strict"
import { InMemoryDatabase } from "../src/db/in-memory-database.ts"
import { InterviewReviewNegotiationAgent } from "../src/agents/interview-review-negotiation.agent.ts"

test("review negotiation tracks correction rounds and categories", async () => {
  const db = new InMemoryDatabase()
  const agent = new InterviewReviewNegotiationAgent(db)

  const created = await agent.run({ taskId: "t1", userId: "u1", sessionId: "s1", agentName: "interview_review_negotiation", taskType: "create_review_draft", payload: { mode: "create", interviewSessionId: "i1" }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  const reviewId = (created.result as any).id

  const suggested = await agent.run({ taskId: "t1b", userId: "u1", sessionId: "s1", agentName: "interview_review_negotiation", taskType: "correct_review", payload: { mode: "suggest_next", reviewId }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal((suggested.result as any).strategy, "probe_metrics")

  const corrected = await agent.run({ taskId: "t2", userId: "u1", sessionId: "s1", agentName: "interview_review_negotiation", taskType: "correct_review", payload: { mode: "correct", reviewId, correction: "这个指标口径不准确", correctionCategory: "metrics" }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })

  assert.equal(corrected.status, "success")
  assert.ok((corrected.result as any).userCorrections[0].includes("[round:1][metrics]"))
  assert.ok(!(corrected.result as any).pendingTopics.includes("metrics"))
})
