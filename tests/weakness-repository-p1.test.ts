import test from "node:test"
import assert from "node:assert/strict"
import { InMemoryDatabase } from "../src/db/in-memory-database.ts"
import { WeaknessDiagnosisAgent } from "../src/agents/weakness-diagnosis.agent.ts"

test("weakness repository flow supports diagnose and confirm", async () => {
  const db = new InMemoryDatabase()
  const agent = new WeaknessDiagnosisAgent(db)
  const diagnosed = await agent.run({ taskId: "t1", userId: "u1", sessionId: "s1", agentName: "weakness_diagnosis", taskType: "diagnose_weakness", payload: { mode: "diagnose", reviewId: "r1" }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  const id = (diagnosed.result as any).id
  const confirmed = await agent.run({ taskId: "t2", userId: "u1", sessionId: "s1", agentName: "weakness_diagnosis", taskType: "confirm_weakness", payload: { mode: "confirm", weaknessProfileId: id }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  assert.equal(confirmed.status, "success")
  assert.equal((confirmed.result as any).status, "confirmed")
})
