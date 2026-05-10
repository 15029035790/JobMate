import test from "node:test"
import assert from "node:assert/strict"
import { InMemoryDatabase } from "../src/db/in-memory-database.ts"
import { LearningPlannerAgent } from "../src/agents/learning-planner.agent.ts"
import { ResumeVersionOptimizationAgent } from "../src/agents/resume-version-optimization.agent.ts"

test("learning planner repository flow persists and reloads plan", async () => {
  const db = new InMemoryDatabase()
  const agent = new LearningPlannerAgent(db)
  const created = await agent.run({ taskId: "t1", userId: "u1", sessionId: "s1", agentName: "learning_planner", taskType: "create_learning_plan", payload: { mode: "create", weaknessProfileId: "w1" }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  const planId = (created.result as any).id
  const saved = await agent.run({ taskId: "t2", userId: "u1", sessionId: "s1", agentName: "learning_planner", taskType: "save_learning_plan", payload: { mode: "save", learningPlanId: planId }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(saved.status, "success")
})

test("resume version repository flow supports save mode", async () => {
  const db = new InMemoryDatabase()
  db.jobDescriptions.set("jd1", { id: "jd1", userId: "u1", title: "Backend", rawText: "", parsedContent: { responsibilities: [], requiredSkills: [], preferredSkills: [], keywords: ["node"] }, tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  db.baseResumes.set("base1", { id: "base1", userId: "u1", title: "base", rawText: "", parsedContent: { basics: {}, skills: [{ category: "general", items: ["node"] }], experiences: [], projects: [] }, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  const agent = new ResumeVersionOptimizationAgent(db)
  const optimized = await agent.run({ taskId: "t1", userId: "u1", sessionId: "s1", agentName: "resume_version_optimization", taskType: "optimize_resume_version", payload: { mode: "optimize", sourceResumeId: "base1", sourceType: "base_resume", jdId: "jd1" }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  const versionId = (optimized.result as any).newResumeVersionId
  const saved = await agent.run({ taskId: "t2", userId: "u1", sessionId: "s1", agentName: "resume_version_optimization", taskType: "save_resume_version", payload: { mode: "save", resumeVersionId: versionId }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(saved.status, "success")
})
