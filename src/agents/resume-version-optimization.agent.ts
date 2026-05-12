import { InMemoryDatabase } from "../db/in-memory-database.ts"
import type { JobDescription, ResumeContent, ResumeVersion } from "../domain/types.ts"
import type { AgentHandler, AgentTaskInput, AgentTaskOutput, MemoryWriteRequest } from "../harness/agent-task.types.ts"
import { DocumentExportTool } from "../tools/document-export.tool.ts"
import { type LlmClient, LlmTool } from "../tools/llm.tool.ts"
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
  private readonly llm: LlmClient
  constructor(db: InMemoryDatabase, llm: LlmClient = new LlmTool()) { this.db = db; this.repo = new ResumeVersionRepository(db); this.llm = llm }

  async run(task: AgentTaskInput<Payload>): Promise<AgentTaskOutput<OptimizeResult>> {
    const startedAt = nowIso()
    const mode = "mode" in task.payload ? task.payload.mode : "optimize"
    if (mode === "save") return this.save(task as AgentTaskInput<{ mode: "save"; resumeVersionId: string }>, startedAt)
    if (mode === "archive") return this.archive(task as AgentTaskInput<{ mode: "archive"; resumeVersionId: string }>, startedAt)
    return this.optimize(task as AgentTaskInput<Extract<Payload,{mode:"optimize"}> | Extract<Payload,{sourceResumeId:string}>>, startedAt)
  }

  private async optimize(task: AgentTaskInput<any>, startedAt: string): Promise<AgentTaskOutput<OptimizeResult>> {
    const payload = task.payload
    const jd = this.db.jobDescriptions.get(payload.jdId)
    if (!jd || jd.userId !== task.userId) return failed(task, startedAt, "JD_NOT_FOUND", "Target JD was not found.")
    const source = this.resolveSource(payload)
    if (!source) return failed(task, startedAt, "SOURCE_RESUME_NOT_FOUND", "Source resume was not found.")

    const baselineDraft = optimizeCopy(source.content, jd.parsedContent.keywords, payload.tone)
    let draft: OptimizationDraft
    let toolCall
    try {
      const callStartedAt = nowIso()
      const raw = await this.llm.complete(buildResumeOptimizationPrompt(source.content, jd.parsedContent, baselineDraft, payload), {
        system: "You are JobMate's resume optimization agent. Return only valid JSON and never invent candidate experience, skills, metrics, companies, education, or project claims.",
        temperature: 0.2,
        responseFormat: "json_object"
      })
      toolCall = { toolName: "deepseek.chat.completions", inputSummary: "Optimize resume content against JD with truthfulness constraints.", outputSummary: raw.slice(0, 160), startedAt: callStartedAt, endedAt: nowIso() }
      draft = enforceOptimizationConstraints(parseOptimizationDraft(raw), source.content, jd.parsedContent.keywords, payload.tone)
    } catch (err) {
      return failed(task, startedAt, "LLM_REQUEST_FAILED", (err as Error).message)
    }

    const optimized = draft.content
    const changeSummary = this.diffTool.summarize(source.content, optimized)
    const version: ResumeVersion = {
      id: createId("resume_version"),
      userId: task.userId,
      baseResumeId: source.baseResumeId,
      parentVersionId: source.parentVersionId,
      title: `${jd.title} optimized draft`,
      content: optimized,
      rawText: this.exportTool.toPlainText(optimized),
      status: "draft",
      optimizationTargetJdIds: [jd.id],
      tags: ["draft", payload.tone ?? "ats-friendly"],
      changeSummary,
      jdAlignmentNotes: draft.jdAlignmentNotes,
      riskWarnings: draft.riskWarnings,
      createdByTaskId: task.taskId,
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
    this.repo.save(version)

    const recommendations = [recommendation("save_resume_version", "Save this resume version", "Drafts enter long-term assets only after confirmation.", ["currentResumeVersionId"]), recommendation("compare_resume_versions", "Compare versions", "Inspect changes before saving.")]
    const memoryWriteRequests: MemoryWriteRequest[] = [{ memoryType: "long_term", entityType: "resume_version", entityId: version.id, payload: { status: "saved_candidate" }, requiresUserConfirmation: true, confirmationId: `confirm_resume_version_${version.id}` }]

    return { taskId: task.taskId, agentName: this.agentName, status: "success", result: { newResumeVersionId: version.id, status: "draft", optimizedResumeContent: version.content, changeSummary: version.changeSummary, jdAlignmentNotes: version.jdAlignmentNotes, riskWarnings: version.riskWarnings, nextActions: recommendations.map((x) => x.action) }, statePatch: { activeNode: "resume_version_review", currentJdId: jd.id, currentResumeVersionId: version.id, availableActions: actionsOf(recommendations) }, memoryWriteRequests, nextSuggestedActions: recommendations, trace: { startedAt, endedAt: nowIso(), toolCalls: [toolCall], reasoningSummary: "Created a JD-specific resume copy with a real LLM call and requested user confirmation before long-term commit." } }
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

interface OptimizationDraft {
  content: ResumeContent
  jdAlignmentNotes: string[]
  riskWarnings: string[]
}

function buildResumeOptimizationPrompt(
  source: ResumeContent,
  jd: JobDescription["parsedContent"],
  baselineDraft: OptimizationDraft,
  payload: { optimizationInstruction?: string; targetRole?: string; tone?: string }
): string {
  return JSON.stringify({
    task: "Optimize the resume for the JD using only evidence already present in sourceResume.",
    outputContract: {
      content: "ResumeContent object with the same shape as sourceResume",
      jdAlignmentNotes: "string[]",
      riskWarnings: "string[]"
    },
    hardRules: [
      "Do not add unsupported skills, backend languages, tools, metrics, companies, education, or project claims.",
      "If a JD requirement is not supported by sourceResume, mention it in riskWarnings instead of adding it to content.",
      "Keep all output in the candidate's original language where possible.",
      "Return JSON only."
    ],
    userPreferences: {
      tone: payload.tone ?? "ats-friendly",
      targetRole: payload.targetRole,
      optimizationInstruction: payload.optimizationInstruction
    },
    jd,
    sourceResume: source,
    baselineDraft
  })
}

function parseOptimizationDraft(raw: string): OptimizationDraft {
  const parsed = JSON.parse(extractJsonObject(raw))
  if (!isRecord(parsed) || !isResumeContent(parsed.content)) throw new Error("LLM resume optimization response did not match the expected schema.")
  return {
    content: parsed.content,
    jdAlignmentNotes: stringArray(parsed.jdAlignmentNotes),
    riskWarnings: stringArray(parsed.riskWarnings)
  }
}

function enforceOptimizationConstraints(draft: OptimizationDraft, source: ResumeContent, keywords: string[], tone = "ats-friendly"): OptimizationDraft {
  const evidenceText = flattenResumeEvidence(source)
  const unsupported = unique(keywords.map(normalizeKeyword).filter(Boolean)).filter((keyword) => !hasEvidence(evidenceText, keyword))
  const unsupportedSet = new Set(unsupported.map((x) => x.toLowerCase()))
  const safeSkills = draft.content.skills
    .map((group) => ({ ...group, items: group.items.filter((item) => !unsupportedSet.has(item.trim().toLowerCase())) }))
    .filter((group) => group.items.length > 0)
  const content: ResumeContent = {
    ...draft.content,
    basics: { ...source.basics, ...draft.content.basics },
    skills: safeSkills.length ? safeSkills : source.skills,
    experiences: draft.content.experiences.length ? draft.content.experiences : source.experiences,
    projects: draft.content.projects.length ? draft.content.projects : source.projects
  }
  const baseline = optimizeCopy(source, keywords, tone)
  const riskWarnings = unique([
    ...draft.riskWarnings,
    ...unsupported.slice(0, 8).map((keyword) => `Missing or weak evidence for JD keyword: ${keyword}. Add only if the candidate can substantiate it.`)
  ])
  return {
    content,
    jdAlignmentNotes: draft.jdAlignmentNotes.length ? draft.jdAlignmentNotes : baseline.jdAlignmentNotes,
    riskWarnings
  }
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const text = fenced?.[1]?.trim() ?? trimmed
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) throw new Error("LLM response did not contain a JSON object.")
  return text.slice(start, end + 1)
}

function isResumeContent(value: unknown): value is ResumeContent {
  if (!isRecord(value) || !isRecord(value.basics)) return false
  return Array.isArray(value.skills) && Array.isArray(value.experiences) && Array.isArray(value.projects)
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function optimizeCopy(content: ResumeContent, keywords: string[], tone = "ats-friendly"): OptimizationDraft {
  const next = structuredClone(content)
  const uniqueKeywords = unique(keywords.map(normalizeKeyword).filter(Boolean)).slice(0, 12)
  const evidenceText = flattenResumeEvidence(content)
  const supported = uniqueKeywords.filter((keyword) => hasEvidence(evidenceText, keyword))
  const unsupported = uniqueKeywords.filter((keyword) => !supported.includes(keyword))
  const focus = supported.slice(0, 5)

  const baseSummary = content.summary ?? "Candidate profile"
  next.summary = focus.length
    ? `${baseSummary} Targeted for ${tone} alignment using existing evidence in ${focus.join(", ")}.`
    : `${baseSummary} Targeted for ${tone} alignment; no JD keywords were added without resume evidence.`

  if (focus.length) {
    const existingGroups = next.skills.filter((group) => group.category !== "target_jd_supported_keywords")
    next.skills = [...existingGroups, { category: "target_jd_supported_keywords", items: focus }]
  }

  next.projects = next.projects.map((project) => {
    const projectEvidence = supported.filter((keyword) => hasEvidence(projectText(project), keyword)).slice(0, 4)
    const evidenceBullet = projectEvidence.length
      ? `Mapped existing project evidence to target JD focus: ${projectEvidence.join(", ")}.`
      : "Kept project evidence unchanged because no supported JD keyword was found in this project."
    return { ...project, bullets: [evidenceBullet, ...project.bullets] }
  })

  return {
    content: next,
    jdAlignmentNotes: [
      ...focus.map((keyword) => `Aligned wording around resume-supported keyword: ${keyword}.`),
      ...unsupported.slice(0, 6).map((keyword) => `JD keyword not added as a claimed skill without evidence: ${keyword}.`)
    ],
    riskWarnings: [
      "Review all strengthened claims before saving to keep the resume truthful.",
      ...unsupported.slice(0, 6).map((keyword) => `Missing or weak evidence for JD keyword: ${keyword}. Add only if the candidate can substantiate it.`)
    ]
  }
}

function flattenResumeEvidence(content: ResumeContent): string {
  return [
    content.summary,
    ...content.skills.flatMap((group) => [group.category, ...group.items]),
    ...content.experiences.flatMap((experience) => [experience.company, experience.title, ...experience.bullets]),
    ...content.projects.flatMap((project) => [project.name, project.description, ...project.techStack, ...project.bullets])
  ].filter(Boolean).join("\n").toLowerCase()
}

function projectText(project: ResumeContent["projects"][number]): string {
  return [project.name, project.description, ...project.techStack, ...project.bullets].join("\n").toLowerCase()
}

function hasEvidence(text: string, keyword: string): boolean {
  if (text.includes(keyword.toLowerCase())) return true
  if (keyword === "ai" || keyword === "aigc") return /ai|aigc|模型|智能|剧本/.test(text)
  if (keyword === "渲染") return /渲染|render|动效|lottie|3d/.test(text)
  if (keyword === "视频生成") return /视频|剧本|预览|互动作品/.test(text)
  return false
}

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase()
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function failed(task: AgentTaskInput<any>, startedAt: string, code: string, message: string): AgentTaskOutput<OptimizeResult> { return { taskId: task.taskId, agentName: "resume_version_optimization", status: "failed", trace: { startedAt, endedAt: nowIso(), toolCalls: [], reasoningSummary: message }, error: { code, message, recoverable: true } } }
