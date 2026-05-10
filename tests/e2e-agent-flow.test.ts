import test from "node:test"
import assert from "node:assert/strict"
import { InMemoryDatabase } from "../src/db/in-memory-database.ts"
import { CentralOrchestrator } from "../src/orchestrator/central-orchestrator.ts"

function seed(db: InMemoryDatabase) {
  db.jobDescriptions.set("jd1", { id: "jd1", userId: "u1", title: "Backend", rawText: "", parsedContent: { responsibilities: [], requiredSkills: [], preferredSkills: [], keywords: ["node", "metrics"] }, tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  db.baseResumes.set("base1", { id: "base1", userId: "u1", title: "base", rawText: "", parsedContent: { basics: {}, skills: [{ category: "general", items: ["node"] }], experiences: [], projects: [{ name: "project", description: "d", techStack: ["node"], bullets: ["built system"] }] }, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
}

test("e2e flow from optimize -> interview -> review -> weakness -> learning", async () => {
  const db = new InMemoryDatabase(); seed(db)
  const o = new CentralOrchestrator(db)

  const optimize = await o.dispatch({ taskId: "t1", userId: "u1", sessionId: "s1", taskType: "optimize_resume_version", payload: { mode: "optimize", sourceResumeId: "base1", sourceType: "base_resume", jdId: "jd1" }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(optimize.status, "needs_user_input")
  o.confirm(optimize.memoryWriteRequests?.[0]?.confirmationId as string)
  const versionId = (optimize.result as any).newResumeVersionId

  const save = await o.dispatch({ taskId: "t2", userId: "u1", sessionId: "s1", taskType: "save_resume_version", payload: { mode: "save", resumeVersionId: versionId }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(save.status, "success")

  const start = await o.dispatch({ taskId: "t3", userId: "u1", sessionId: "s1", taskType: "start_mock_interview", payload: { mode: "start", jdId: "jd1", resumeVersionId: versionId }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  const interviewId = (start.result as any).interviewSessionId
  assert.equal(start.status, "success")

  const answer = await o.dispatch({ taskId: "t4", userId: "u1", sessionId: "s1", taskType: "answer_interview_question", payload: { mode: "answer", interviewSessionId: interviewId, answer: "我负责缓存层并将延迟降低40%", questionKind: "project_deep_dive" }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(answer.status, "success")

  const finish = await o.dispatch({ taskId: "t5", userId: "u1", sessionId: "s1", taskType: "finish_mock_interview", payload: { mode: "finish", interviewSessionId: interviewId }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(finish.status, "success")

  const review = await o.dispatch({ taskId: "t6", userId: "u1", sessionId: "s1", taskType: "create_review_draft", payload: { mode: "create", interviewSessionId: interviewId }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  const reviewId = (review.result as any).id
  await o.dispatch({ taskId: "t7", userId: "u1", sessionId: "s1", taskType: "correct_review", payload: { mode: "correct", reviewId, correction: "补充指标口径", correctionCategory: "metrics" }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  await o.dispatch({ taskId: "t8", userId: "u1", sessionId: "s1", taskType: "confirm_review", payload: { mode: "confirm", reviewId }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })

  const weak = await o.dispatch({ taskId: "t9", userId: "u1", sessionId: "s1", taskType: "diagnose_weakness", payload: { mode: "diagnose", reviewId }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  const weakId = (weak.result as any).id
  const weakConfirm = await o.dispatch({ taskId: "t10", userId: "u1", sessionId: "s1", taskType: "confirm_weakness", payload: { mode: "confirm", weaknessProfileId: weakId }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(weakConfirm.status, "success")

  const plan = await o.dispatch({ taskId: "t11", userId: "u1", sessionId: "s1", taskType: "create_learning_plan", payload: { mode: "create", weaknessProfileId: weakId }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(plan.status, "success")

  assert.ok(o.listTraceEvents("s1").length >= 10)
})
