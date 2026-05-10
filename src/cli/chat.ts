import { createInterface } from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import fs from "node:fs"
import { InMemoryDatabase } from "../db/in-memory-database.ts"
import { CentralOrchestrator } from "../orchestrator/central-orchestrator.ts"
import { ResumeParserTool } from "../tools/resume-parser.tool.ts"
import { JdParserTool } from "../tools/jd-parser.tool.ts"
import { LlmTool } from "../tools/llm.tool.ts"
import { createId, nowIso } from "../utils/id.ts"

const rl = createInterface({ input, output })
const db = new InMemoryDatabase()
const orchestrator = new CentralOrchestrator(db)
const llm = new LlmTool()
const userId = "terminal_user"
const sessionId = createId("session")

let currentBaseResumeId: string | undefined
let currentJdId: string | undefined
let currentResumeVersionId: string | undefined

console.log("JobMate Terminal Chat")
console.log("Commands: /load-resume <file>, /load-jd <file>, /optimize, /start-interview, /ask <text>, /exit")

while (true) {
  const line = (await rl.question("> ")).trim()
  if (!line) continue
  if (line === "/exit") break

  try {
    if (line.startsWith("/load-resume ")) {
      const file = line.replace("/load-resume ", "")
      const raw = fs.readFileSync(file, "utf8")
      const id = createId("base_resume")
      db.baseResumes.set(id, { id, userId, title: "CLI Resume", rawText: raw, parsedContent: new ResumeParserTool().parse(raw), isActive: true, createdAt: nowIso(), updatedAt: nowIso() })
      currentBaseResumeId = id
      console.log(`Loaded resume: ${id}`)
      continue
    }

    if (line.startsWith("/load-jd ")) {
      const file = line.replace("/load-jd ", "")
      const raw = fs.readFileSync(file, "utf8")
      const parsed = new JdParserTool().parse(raw)
      const id = createId("jd")
      db.jobDescriptions.set(id, { id, userId, title: parsed.title, rawText: raw, parsedContent: parsed, tags: [], createdAt: nowIso(), updatedAt: nowIso() })
      currentJdId = id
      console.log(`Loaded JD: ${id}`)
      continue
    }

    if (line === "/optimize") {
      if (!currentBaseResumeId || !currentJdId) { console.log("Please /load-resume and /load-jd first."); continue }
      const out = await orchestrator.dispatch({ taskId: createId("task"), userId, sessionId, taskType: "optimize_resume_version", payload: { mode: "optimize", sourceResumeId: currentBaseResumeId, sourceType: "base_resume", jdId: currentJdId }, context: {}, memoryRefs: {}, trace: { createdAt: nowIso(), source: "user" } })
      currentResumeVersionId = (out.result as any)?.newResumeVersionId
      if (out.status === "needs_user_input") {
        const c = out.memoryWriteRequests?.[0]?.confirmationId
        if (c) orchestrator.confirm(c)
        if (currentResumeVersionId) {
          await orchestrator.dispatch({ taskId: createId("task"), userId, sessionId, taskType: "save_resume_version", payload: { mode: "save", resumeVersionId: currentResumeVersionId }, context: {}, memoryRefs: {}, trace: { createdAt: nowIso(), source: "user" } })
        }
      }
      console.log(JSON.stringify(out.result, null, 2))
      continue
    }

    if (line === "/start-interview") {
      if (!currentJdId) { console.log("Please /load-jd first."); continue }
      const out = await orchestrator.dispatch({ taskId: createId("task"), userId, sessionId, taskType: "start_mock_interview", payload: { mode: "start", jdId: currentJdId, resumeVersionId: currentResumeVersionId }, context: {}, memoryRefs: {}, trace: { createdAt: nowIso(), source: "user" } })
      console.log(JSON.stringify(out.result, null, 2))
      continue
    }

    if (line.startsWith("/ask ")) {
      const prompt = line.replace("/ask ", "")
      const answer = await llm.complete(`You are JobMate interview coach. User says: ${prompt}`)
      console.log(answer)
      continue
    }

    console.log("Unknown command")
  } catch (err) {
    console.error((err as Error).message)
  }
}

await rl.close()
