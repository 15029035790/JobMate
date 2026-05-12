import fs from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { InMemoryDatabase } from "../../../src/db/in-memory-database.ts"
import type { BaseResume, JobDescription, ResumeContent, ResumeVersion } from "../../../src/domain/types.ts"
import { CentralOrchestrator } from "../../../src/orchestrator/central-orchestrator.ts"
import { JdParserTool } from "../../../src/tools/jd-parser.tool.ts"
import { LlmTool } from "../../../src/tools/llm.tool.ts"
import { ResumeParserTool } from "../../../src/tools/resume-parser.tool.ts"
import { ResumeScoringTool, type ResumeScoreReport } from "../../../src/tools/resume-scoring.tool.ts"
import { createId, nowIso } from "../../../src/utils/id.ts"

export const runtime = "nodejs"

interface VersionView {
  id: string
  label: string
  status: "base" | ResumeVersion["status"]
  createdAt: string
  content: ResumeContent
  changeSummary: string[]
  jdAlignmentNotes: string[]
  riskWarnings: string[]
  score?: ResumeScoreReport
}

interface WorkbenchState {
  userId: string
  sessionId: string
  db: InMemoryDatabase
  orchestrator: CentralOrchestrator
  baseResumeId: string
  jdId: string
  selectedVersionId: string
  scores: Map<string, ResumeScoreReport>
  messages: Array<{ role: "assistant" | "user"; content: string; createdAt: string }>
}

const globalForWorkbench = globalThis as typeof globalThis & { __jobmateWorkbench?: WorkbenchState }

export async function GET() {
  const state = ensureState()
  return NextResponse.json(toClientState(state))
}

export async function POST(request: Request) {
  const state = ensureState()
  const body = await request.json().catch(() => ({}))
  const action = body?.action

  try {
    if (action === "selectVersion") {
      state.selectedVersionId = String(body.versionId)
      return NextResponse.json(toClientState(state))
    }

    if (action === "score") {
      const content = resolveVersionContent(state, String(body.versionId ?? state.selectedVersionId))
      const jd = state.db.jobDescriptions.get(state.jdId)
      if (!content || !jd) throw new Error("Missing resume or JD for scoring.")
      const score = await new ResumeScoringTool(new LlmTool()).score({ resume: content, jd: jd.parsedContent })
      state.scores.set(String(body.versionId ?? state.selectedVersionId), score)
      state.messages.push({ role: "assistant", content: `已完成评分：${score.totalScore}/100。${score.summary}`, createdAt: nowIso() })
      return NextResponse.json(toClientState(state))
    }

    if (action === "optimize") {
      const optimize = await state.orchestrator.dispatch({
        taskId: createId("task"),
        userId: state.userId,
        sessionId: state.sessionId,
        taskType: "optimize_resume_version",
        payload: { mode: "optimize", sourceResumeId: state.baseResumeId, sourceType: "base_resume", jdId: state.jdId, tone: body.tone ?? "ats-friendly" },
        context: {},
        memoryRefs: {},
        trace: { createdAt: nowIso(), source: "user" }
      })
      if (optimize.status === "failed") throw new Error(optimize.error?.message ?? "Resume optimization failed.")

      const confirmationId = optimize.memoryWriteRequests?.[0]?.confirmationId
      if (confirmationId) state.orchestrator.confirm(confirmationId)

      const versionId = (optimize.result as any)?.newResumeVersionId as string | undefined
      if (!versionId) throw new Error("Optimization did not return a resume version.")
      state.selectedVersionId = versionId

      await state.orchestrator.dispatch({
        taskId: createId("task"),
        userId: state.userId,
        sessionId: state.sessionId,
        taskType: "save_resume_version",
        payload: { mode: "save", resumeVersionId: versionId },
        context: {},
        memoryRefs: {},
        trace: { createdAt: nowIso(), source: "orchestrator" }
      })

      const version = state.db.resumeVersions.get(versionId)
      const jd = state.db.jobDescriptions.get(state.jdId)
      if (version && jd) {
        const score = await new ResumeScoringTool(new LlmTool()).score({ resume: version.content, jd: jd.parsedContent })
        state.scores.set(versionId, score)
        state.messages.push({ role: "assistant", content: `已生成新简历版本并完成评分：${score.totalScore}/100。高优先级优化点 ${score.prioritizedImprovements.filter((x) => x.priority === "high").length} 条。`, createdAt: nowIso() })
      }

      return NextResponse.json(toClientState(state))
    }

    if (action === "startInterview") {
      const out = await state.orchestrator.dispatch({
        taskId: createId("task"),
        userId: state.userId,
        sessionId: state.sessionId,
        taskType: "start_mock_interview",
        payload: { mode: "start", jdId: state.jdId, resumeVersionId: state.selectedVersionId === "base" ? undefined : state.selectedVersionId },
        context: {},
        memoryRefs: {},
        trace: { createdAt: nowIso(), source: "user" }
      })
      if (out.status === "failed") throw new Error(out.error?.message ?? "Interview start failed.")
      const question = String((out.result as any)?.question ?? "")
      state.messages.push({ role: "assistant", content: `模拟面试开始：${question}`, createdAt: nowIso() })
      return NextResponse.json(toClientState(state))
    }

    if (action === "chat") {
      const content = String(body.content ?? "").trim()
      if (!content) return NextResponse.json(toClientState(state))
      state.messages.push({ role: "user", content, createdAt: nowIso() })
      const answer = await new LlmTool().complete(buildChatPrompt(state, content), {
        system: "You are JobMate, a concise career copilot. Use the current resume/JD context and answer in Chinese.",
        temperature: 0.35
      })
      state.messages.push({ role: "assistant", content: answer, createdAt: nowIso() })
      return NextResponse.json(toClientState(state))
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, state: toClientState(state) }, { status: 500 })
  }
}

function ensureState(): WorkbenchState {
  if (globalForWorkbench.__jobmateWorkbench) return globalForWorkbench.__jobmateWorkbench

  const userId = "web_user"
  const sessionId = createId("session")
  const db = new InMemoryDatabase()
  const resumeRaw = readLocalText("resume.txt")
  const jdRaw = readLocalText("jd.txt")
  const resumeParser = new ResumeParserTool()
  const jdParser = new JdParserTool()
  const baseResumeId = createId("base_resume")
  const jdId = createId("jd")
  const parsedJd = jdParser.parse(jdRaw)

  db.baseResumes.set(baseResumeId, {
    id: baseResumeId,
    userId,
    title: "Base Resume",
    rawText: resumeRaw,
    parsedContent: resumeParser.parse(resumeRaw),
    isActive: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  })

  db.jobDescriptions.set(jdId, {
    id: jdId,
    userId,
    title: parsedJd.title,
    rawText: jdRaw,
    parsedContent: parsedJd,
    tags: [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  })

  globalForWorkbench.__jobmateWorkbench = {
    userId,
    sessionId,
    db,
    orchestrator: new CentralOrchestrator(db),
    baseResumeId,
    jdId,
    selectedVersionId: "base",
    scores: new Map([
      ["base", baselineScore(db.baseResumes.get(baseResumeId)!, db.jobDescriptions.get(jdId)!)]
    ]),
    messages: [{ role: "assistant", content: "工作台已准备好。你可以先评分、优化简历，或直接开始模拟面试。", createdAt: nowIso() }]
  }
  return globalForWorkbench.__jobmateWorkbench
}

function toClientState(state: WorkbenchState) {
  const base = state.db.baseResumes.get(state.baseResumeId)!
  const jd = state.db.jobDescriptions.get(state.jdId)!
  const versions: VersionView[] = [
    {
      id: "base",
      label: "Base",
      status: "base",
      createdAt: base.createdAt,
      content: base.parsedContent,
      changeSummary: ["Imported original resume as baseline."],
      jdAlignmentNotes: [],
      riskWarnings: [],
      score: state.scores.get("base")
    },
    ...[...state.db.resumeVersions.values()]
      .filter((version) => version.userId === state.userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((version, index) => ({
        id: version.id,
        label: `v${index + 1}`,
        status: version.status,
        createdAt: version.createdAt,
        content: version.content,
        changeSummary: version.changeSummary,
        jdAlignmentNotes: version.jdAlignmentNotes,
        riskWarnings: version.riskWarnings,
        score: state.scores.get(version.id)
      }))
  ]

  return {
    resume: { title: base.title, rawText: base.rawText },
    jd: { title: jd.title, rawText: jd.rawText, parsedContent: jd.parsedContent },
    selectedVersionId: state.selectedVersionId,
    versions,
    messages: state.messages,
    traceEvents: state.orchestrator.listTraceEvents(state.sessionId)
  }
}

function resolveVersionContent(state: WorkbenchState, versionId: string): ResumeContent | undefined {
  if (versionId === "base") return state.db.baseResumes.get(state.baseResumeId)?.parsedContent
  return state.db.resumeVersions.get(versionId)?.content
}

function baselineScore(base: BaseResume, jd: JobDescription): ResumeScoreReport {
  const evidence = JSON.stringify(base.parsedContent).toLowerCase()
  const keywords = jd.parsedContent.keywords.map((keyword) => keyword.toLowerCase())
  const matched = keywords.filter((keyword) => evidence.includes(keyword)).length
  const match = keywords.length ? Math.round((matched / keywords.length) * 100) : 50
  const totalScore = Math.max(38, Math.min(82, Math.round(match * 0.65 + 24)))
  return {
    totalScore,
    dimensions: [
      { name: "JD match", score: totalScore, reason: "基于本地关键词重合度的初始估算。" },
      { name: "Evidence strength", score: Math.max(45, totalScore - 6), reason: "优化后会由 LLM 重新评估项目证据。" },
      { name: "Truthfulness risk", score: 86, reason: "Base 简历没有自动新增未经确认的主张。" }
    ],
    prioritizedImprovements: [
      { priority: "high", title: "运行一次 LLM 优化", reason: "当前分数是本地估算，尚未结合 LLM 对 JD 证据质量的判断。", suggestedChange: "点击 Optimize Resume 生成 v1 并自动评分。" },
      { priority: "medium", title: "补足弱证据关键词", reason: "JD 关键词需要映射到真实项目证据。", suggestedChange: "在项目 bullet 中补充可解释的上下文、行动和结果。" }
    ],
    unsupportedClaims: [],
    summary: "初始分数来自本地估算；优化后会切换为 LLM 评分。"
  }
}

function readLocalText(fileName: string): string {
  const filePath = fileName === "resume.txt"
    ? path.join(process.cwd(), "resume.txt")
    : path.join(process.cwd(), "jd.txt")
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : ""
}

function buildChatPrompt(state: WorkbenchState, userMessage: string): string {
  const jd = state.db.jobDescriptions.get(state.jdId)
  const resume = resolveVersionContent(state, state.selectedVersionId)
  return JSON.stringify({
    task: "Answer the user's JobMate workbench question.",
    userMessage,
    selectedVersionId: state.selectedVersionId,
    jd: jd?.parsedContent,
    resume,
    rules: ["Be concise.", "Do not invent resume claims.", "Suggest concrete next UI actions when useful."]
  })
}
