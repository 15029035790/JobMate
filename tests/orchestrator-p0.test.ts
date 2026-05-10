import test from "node:test"
import assert from "node:assert/strict"
import { InMemoryDatabase } from "../src/db/in-memory-database.ts"
import { AgentRuntime } from "../src/harness/agent-runtime.ts"
import { TaskRouter } from "../src/harness/task-router.ts"
import { InterviewReviewNegotiationAgent } from "../src/agents/interview-review-negotiation.agent.ts"
import { MemoryCommitController } from "../src/reflection/memory-commit-controller.ts"
import { LongTermMemoryStore } from "../src/memory/long-term-memory.store.ts"
import { CentralOrchestrator } from "../src/orchestrator/central-orchestrator.ts"

test("router + runtime can execute review draft flow", async () => {
  const db = new InMemoryDatabase()
  const runtime = new AgentRuntime()
  runtime.register(new InterviewReviewNegotiationAgent(db))
  const router = new TaskRouter()
  const agentName = router.route("create_review_draft")
  assert.equal(agentName, "interview_review_negotiation")
  assert.ok(agentName)
  const out = await runtime.run({ taskId: "t1", userId: "u1", sessionId: "s1", agentName: agentName as any, taskType: "create_review_draft", payload: { mode: "create", interviewSessionId: "i1" }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(out.status, "success")
})

test("memory controller blocks unverifiable project long-term writes", () => {
  const m = new MemoryCommitController(new LongTermMemoryStore())
  assert.throws(() => m.handle([{ memoryType: "long_term", entityType: "project_answer_evaluation", entityId: "p1", payload: { unverifiableClaims: ["x"] }, requiresUserConfirmation: false }], "u1"))
})

test("orchestrator enforces confirmation before long-term commit", async () => {
  const db = new InMemoryDatabase()
  db.jobDescriptions.set("jd1", { id: "jd1", userId: "u1", title: "Backend", rawText: "", parsedContent: { responsibilities: [], requiredSkills: [], preferredSkills: [], keywords: ["node"] }, tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  db.baseResumes.set("base1", { id: "base1", userId: "u1", title: "base", rawText: "", parsedContent: { basics: {}, skills: [{ category: "general", items: ["node"] }], experiences: [], projects: [] }, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })

  const orchestrator = new CentralOrchestrator(db)
  const first = await orchestrator.dispatch({ taskId: "t1", userId: "u1", sessionId: "s1", taskType: "optimize_resume_version", payload: { mode: "optimize", sourceResumeId: "base1", sourceType: "base_resume", jdId: "jd1" }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(first.status, "needs_user_input")

  const confirmationId = first.memoryWriteRequests?.[0]?.confirmationId
  assert.ok(confirmationId)
  orchestrator.confirm(confirmationId as string)

  const versionId = (first.result as any).newResumeVersionId
  const second = await orchestrator.dispatch({ taskId: "t2", userId: "u1", sessionId: "s1", taskType: "save_resume_version", payload: { mode: "save", resumeVersionId: versionId }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(second.status, "success")
  assert.ok(orchestrator.listLongTermMemory("u1").length >= 1)
})
