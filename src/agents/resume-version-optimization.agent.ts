import { InMemoryDatabase } from "../db/in-memory-database.ts"
import type { ResumeContent, ResumeVersion } from "../domain/types.ts"
import type { AgentHandler, AgentTaskInput, AgentTaskOutput, MemoryWriteRequest } from "../harness/agent-task.types.ts"
import { DocumentExportTool } from "../tools/document-export.tool.ts"
import { VersionDiffTool } from "../tools/version-diff.tool.ts"
import { createId, nowIso } from "../utils/id.ts"
import { actionsOf, recommendation } from "./action-recommendations.ts"
import { ResumeVersionRepository } from "../repositories/resume-version.repository.ts"

type Payload =
  | { mode: "optimize"; sourceResumeId: string; sourceType: "base_resume" | "optimized_version"; jdId: string; optimizationInstruction?: string; targetRole?: string; tone?: "concise" | "impact-driven" | "ats-friendly" }
  | { mode: "save"; resumeVersionId: string }
  | { mode: "archive"; resumeVersionId: string }
  | { sourceResumeId: string; sourceType: "base_resume" | "optimized_version"; jdId: string; optimizationInstruction?: string; targetRole?: string; tone?: "concise" | "impact-driven" | "ats-friendly" }

interface OptimizeResult {
  newResumeVersionId?: string
  status: ResumeVersion["status"]
  optimizedResumeContent?: ResumeContent
  changeSummary?: string[]
  jdAlignmentNotes?: string[]
  riskWarnings?: string[]
  nextActions: string[]
}

export class ResumeVersionOptimizationAgent implements AgentHandler<Payload, OptimizeResult> {
  readonly agentName = "resume_version_optimization" as const
  private readonly diffTool = new VersionDiffTool()
  private readonly exportTool = new DocumentExportTool()
  private readonly db: InMemoryDatabase
  private readonly repo: ResumeVersionRepository
  constructor(db: InMemoryDatabase) { this.db = db; this.repo = new ResumeVersionRepository(db) }

  async run(task: AgentTaskInput<Payload>): Promise<AgentTaskOutput<OptimizeResult>> {
    const startedAt = nowIso()
    const mode = "mode" in task.payload ? task.payload.mode : "optimize"
    if (mode === "save") return this.save(task as AgentTaskInput<{ mode: "save"; resumeVersionId: string }>, startedAt)
    if (mode === "archive") return this.archive(task as AgentTaskInput<{ mode: "archive"; resumeVersionId: string }>, startedAt)
    return this.optimize(task as AgentTaskInput<Extract<Payload,{mode:"optimize"}> | Extract<Payload,{sourceResumeId:string}>>, startedAt)
  }

  private optimize(task: AgentTaskInput<any>, startedAt: string): AgentTaskOutput<OptimizeResult> {
    const payload = task.payload
    const jd = this.db.jobDescriptions.get(payload.jdId)
    if (!jd || jd.userId !== task.userId) return failed(task, startedAt, "JD_NOT_FOUND", "Target JD was not found.")
    const source = this.resolveSource(payload)
    if (!source) return failed(task, startedAt, "SOURCE_RESUME_NOT_FOUND", "Source resume was not found.")

    const optimized = optimizeCopy(source.content, jd.parsedContent.keywords, payload.tone)
    const changeSummary = this.diffTool.summarize(source.content, optimized)
    const version: ResumeVersion = { id: createId("resume_version"), userId: task.userId, baseResumeId: source.baseResumeId, parentVersionId: source.parentVersionId, title: `${jd.title} optimized draft`, content: optimized, rawText: this.exportTool.toPlainText(optimized), status: "draft", optimizationTargetJdIds: [jd.id], tags: ["draft", payload.tone ?? "ats-friendly"], changeSummary, jdAlignmentNotes: jd.parsedContent.keywords.slice(0, 6).map((keyword) => `Aligned wording around ${keyword}.`), riskWarnings: ["Review all strengthened claims before saving to keep the resume truthful."], createdByTaskId: task.taskId, createdAt: nowIso(), updatedAt: nowIso() }
    this.repo.save(version)

    const recommendations = [recommendation("save_resume_version", "Save this resume version", "Drafts enter long-term assets only after confirmation.", ["currentResumeVersionId"]), recommendation("compare_resume_versions", "Compare versions", "Inspect changes before saving.")]
    const memoryWriteRequests: MemoryWriteRequest[] = [{ memoryType: "long_term", entityType: "resume_version", entityId: version.id, payload: { status: "saved_candidate" }, requiresUserConfirmation: true, confirmationId: `confirm_resume_version_${version.id}` }]

    return { taskId: task.taskId, agentName: this.agentName, status: "success", result: { newResumeVersionId: version.id, status: "draft", optimizedResumeContent: version.content, changeSummary: version.changeSummary, jdAlignmentNotes: version.jdAlignmentNotes, riskWarnings: version.riskWarnings, nextActions: recommendations.map((x) => x.action) }, statePatch: { activeNode: "resume_version_review", currentJdId: jd.id, currentResumeVersionId: version.id, availableActions: actionsOf(recommendations) }, memoryWriteRequests, nextSuggestedActions: recommendations, trace: { startedAt, endedAt: nowIso(), toolCalls: [], reasoningSummary: "Created a JD-specific resume copy and requested user confirmation before long-term commit." } }
  }

  private save(task: AgentTaskInput<{ mode: "save"; resumeVersionId: string }>, startedAt: string): AgentTaskOutput<OptimizeResult> {
    const v = this.repo.get(task.payload.resumeVersionId)
    if (!v || v.userId !== task.userId) return failed(task, startedAt, "RESUME_VERSION_NOT_FOUND", "Resume version not found")
    v.status = "saved"; v.updatedAt = nowIso()
    return { taskId: task.taskId, agentName: this.agentName, status: "success", result: { status: v.status, nextActions: ["start_mock_interview"] }, statePatch: { currentResumeVersionId: v.id }, memoryWriteRequests: [{ memoryType: "long_term", entityType: "resume_version", entityId: v.id, payload: { status: "saved" }, requiresUserConfirmation: false }], trace: { startedAt, endedAt: nowIso(), toolCalls: [], reasoningSummary: "Saved resume version after explicit user action." } }
  }

  private archive(task: AgentTaskInput<{ mode: "archive"; resumeVersionId: string }>, startedAt: string): AgentTaskOutput<OptimizeResult> {
    const v = this.repo.get(task.payload.resumeVersionId)
    if (!v || v.userId !== task.userId) return failed(task, startedAt, "RESUME_VERSION_NOT_FOUND", "Resume version not found")
    v.status = "archived"; v.updatedAt = nowIso()
    return { taskId: task.taskId, agentName: this.agentName, status: "success", result: { status: v.status, nextActions: ["view_history"] }, trace: { startedAt, endedAt: nowIso(), toolCalls: [], reasoningSummary: "Archived resume version." } }
  }

  private resolveSource(payload: any): { content: ResumeContent; baseResumeId: string; parentVersionId?: string } | undefined {
    if (payload.sourceType === "base_resume") { const base = this.db.baseResumes.get(payload.sourceResumeId); return base ? { content: base.parsedContent, baseResumeId: base.id } : undefined }
    const version = this.db.resumeVersions.get(payload.sourceResumeId)
    return version ? { content: version.content, baseResumeId: version.baseResumeId, parentVersionId: version.id } : undefined
  }
}

function optimizeCopy(content: ResumeContent, keywords: string[], tone = "ats-friendly"): ResumeContent { const next = structuredClone(content); const additions = keywords.filter(Boolean).slice(0, 8); next.summary = `${content.summary ?? "Candidate profile"} Targeted for ${tone} alignment with ${additions.slice(0, 4).join(", ")}.`; next.skills = [...content.skills,{ category: "target_jd_keywords", items: additions }]; next.projects = content.projects.map((project, index) => ({ ...project, bullets: [`Reframed for target JD impact: ${additions.slice(0, 3).join(", ")}.`, ...project.bullets, index === 0 ? "Added measurable outcome placeholder for user verification." : "Strengthened STAR-style evidence."] })); return next }

function failed(task: AgentTaskInput<any>, startedAt: string, code: string, message: string): AgentTaskOutput<OptimizeResult> { return { taskId: task.taskId, agentName: "resume_version_optimization", status: "failed", trace: { startedAt, endedAt: nowIso(), toolCalls: [], reasoningSummary: message }, error: { code, message, recoverable: true } } }
