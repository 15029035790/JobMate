import fs from "node:fs"
import { ResumeParserTool } from "../tools/resume-parser.tool.ts"
import { JdParserTool } from "../tools/jd-parser.tool.ts"
import { InMemoryDatabase } from "../db/in-memory-database.ts"
import { createId, nowIso } from "../utils/id.ts"
import { CentralOrchestrator } from "../orchestrator/central-orchestrator.ts"

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

const resumePath = getArg("--resume")
const jdPath = getArg("--jd")

if (!resumePath || !jdPath) {
  console.error("Usage: node src/cli/run-real-test.ts --resume <resume.txt> --jd <jd.txt>")
  process.exit(1)
}

const resumeRaw = fs.readFileSync(resumePath, "utf8")
const jdRaw = fs.readFileSync(jdPath, "utf8")

const userId = "real_user"
const sessionId = createId("session")
const db = new InMemoryDatabase()
const resumeParser = new ResumeParserTool()
const jdParser = new JdParserTool()

const baseResumeId = createId("base_resume")
const jdId = createId("jd")

db.baseResumes.set(baseResumeId, {
  id: baseResumeId,
  userId,
  title: "Imported Base Resume",
  rawText: resumeRaw,
  parsedContent: resumeParser.parse(resumeRaw),
  isActive: true,
  createdAt: nowIso(),
  updatedAt: nowIso()
})

db.jobDescriptions.set(jdId, {
  id: jdId,
  userId,
  title: jdParser.parse(jdRaw).title,
  rawText: jdRaw,
  parsedContent: jdParser.parse(jdRaw),
  tags: [],
  createdAt: nowIso(),
  updatedAt: nowIso()
})

const orchestrator = new CentralOrchestrator(db)

const optimize = await orchestrator.dispatch({
  taskId: createId("task"),
  userId,
  sessionId,
  taskType: "optimize_resume_version",
  payload: { mode: "optimize", sourceResumeId: baseResumeId, sourceType: "base_resume", jdId },
  context: {},
  memoryRefs: {},
  trace: { createdAt: nowIso(), source: "user" }
})

console.log("\n=== Optimize Result ===")
console.log(JSON.stringify(optimize.result, null, 2))

if (optimize.status === "needs_user_input") {
  const confirmationId = optimize.memoryWriteRequests?.[0]?.confirmationId
  if (confirmationId) orchestrator.confirm(confirmationId)
}

const versionId = (optimize.result as any)?.newResumeVersionId
if (versionId) {
  const save = await orchestrator.dispatch({
    taskId: createId("task"),
    userId,
    sessionId,
    taskType: "save_resume_version",
    payload: { mode: "save", resumeVersionId: versionId },
    context: {},
    memoryRefs: {},
    trace: { createdAt: nowIso(), source: "user" }
  })
  console.log("\n=== Save Result ===")
  console.log(JSON.stringify(save.result, null, 2))

  const interviewStart = await orchestrator.dispatch({
    taskId: createId("task"),
    userId,
    sessionId,
    taskType: "start_mock_interview",
    payload: { mode: "start", jdId, resumeVersionId: versionId },
    context: {},
    memoryRefs: {},
    trace: { createdAt: nowIso(), source: "user" }
  })
  console.log("\n=== Interview Start ===")
  console.log(JSON.stringify(interviewStart.result, null, 2))
}

console.log("\n=== Trace Events ===")
console.log(JSON.stringify(orchestrator.listTraceEvents(sessionId), null, 2))
