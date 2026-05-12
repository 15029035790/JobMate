import test from "node:test"
import assert from "node:assert/strict"
import { InMemoryDatabase } from "../src/db/in-memory-database.ts"
import { ResumeVersionOptimizationAgent } from "../src/agents/resume-version-optimization.agent.ts"
import { FakeLlm } from "./fake-llm.ts"

function seed(db: InMemoryDatabase) {
  db.jobDescriptions.set("jd1", { id: "jd1", userId: "u1", title: "Backend", rawText: "", parsedContent: { responsibilities: [], requiredSkills: [], preferredSkills: [], keywords: ["node", "sql"] }, tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  db.baseResumes.set("base1", { id: "base1", userId: "u1", title: "base", rawText: "", parsedContent: { basics: {}, skills: [{ category: "general", items: ["node"] }], experiences: [], projects: [] }, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
}

test("optimize emits confirmation-required long-term write request", async () => {
  const db = new InMemoryDatabase(); seed(db)
  const agent = new ResumeVersionOptimizationAgent(db, new FakeLlm())
  const out = await agent.run({ taskId: "t1", userId: "u1", sessionId: "s1", agentName: "resume_version_optimization", taskType: "optimize_resume_version", payload: { mode: "optimize", sourceResumeId: "base1", sourceType: "base_resume", jdId: "jd1" }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(out.status, "success")
  assert.equal(out.memoryWriteRequests?.[0]?.requiresUserConfirmation, true)
})
