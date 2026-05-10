import { InMemoryDatabase } from "../db/in-memory-database.ts"
import type { ResumeContent, ResumeVersion } from "../domain/types.ts"
import type { AgentHandler, AgentTaskInput, AgentTaskOutput } from "../harness/agent-task.types.ts"
import { DocumentExportTool } from "../tools/document-export.tool.ts"
import { VersionDiffTool } from "../tools/version-diff.tool.ts"
import { createId, nowIso } from "../utils/id.ts"
import { actionsOf, recommendation } from "./action-recommendations.ts"

interface OptimizePayload {
  sourceResumeId: string
  sourceType: "base_resume" | "optimized_version"
  jdId: string
  optimizationInstruction?: string
  targetRole?: string
  tone?: "concise" | "impact-driven" | "ats-friendly"
}

interface OptimizeResult {
  newResumeVersionId: string
  status: "draft"
  optimizedResumeContent: ResumeContent
  changeSummary: string[]
  jdAlignmentNotes: string[]
  riskWarnings: string[]
  nextActions: string[]
}

export class ResumeVersionOptimizationAgent implements AgentHandler<OptimizePayload, OptimizeResult> {
  readonly agentName = "resume_version_optimization" as const
  private readonly diffTool = new VersionDiffTool()
  private readonly exportTool = new DocumentExportTool()

  constructor(private readonly db: InMemoryDatabase) {}

  async run(task: AgentTaskInput<OptimizePayload>): Promise<AgentTaskOutput<OptimizeResult>> {
    const startedAt = nowIso()
    const jd = this.db.jobDescriptions.get(task.payload.jdId)
    if (!jd || jd.userId !== task.userId) {
      return failed(task, startedAt, "JD_NOT_FOUND", "Target JD was not found.")
    }

    const source = this.resolveSource(task.payload)
    if (!source) {
      return failed(task, startedAt, "SOURCE_RESUME_NOT_FOUND", "Source resume was not found.")
    }

    const optimized = optimizeCopy(source.content, jd.parsedContent.keywords, task.payload.tone)
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
      tags: ["draft", task.payload.tone ?? "ats-friendly"],
      changeSummary,
      jdAlignmentNotes: jd.parsedContent.keywords.slice(0, 6).map((keyword) => `Aligned wording around ${keyword}.`),
      riskWarnings: ["Review all strengthened claims before saving to keep the resume truthful."],
      createdByTaskId: task.taskId,
      createdAt: nowIso(),
      updatedAt: nowIso()
    }

    this.db.resumeVersions.set(version.id, version)

    const recommendations = [
      recommendation("save_resume_version", "Save this resume version", "Drafts enter long-term assets only after confirmation.", [
        "currentResumeVersionId"
      ]),
      recommendation("optimize_resume", "Continue iterating", "Generate another copy without touching the base resume.", [
        "currentJdId",
        "currentResumeVersionId"
      ]),
      recommendation("compare_resume_versions", "Compare versions", "Inspect changes before saving."),
      recommendation("start_mock_interview", "Start mock interview", "Use this draft to test JD fit.", [
        "currentJdId",
        "currentResumeVersionId"
      ])
    ]

    return {
      taskId: task.taskId,
      agentName: this.agentName,
      status: "success",
      result: {
        newResumeVersionId: version.id,
        status: "draft",
        optimizedResumeContent: version.content,
        changeSummary: version.changeSummary,
        jdAlignmentNotes: version.jdAlignmentNotes,
        riskWarnings: version.riskWarnings,
        nextActions: recommendations.map((item) => item.action)
      },
      statePatch: {
        activeNode: "resume_version_review",
        currentJdId: jd.id,
        currentResumeVersionId: version.id,
        availableActions: actionsOf(recommendations),
        pendingConfirmation: {
          type: "resume_version_save",
          targetId: version.id,
          message: "Confirm before saving this draft resume version into long-term assets."
        }
      },
      nextSuggestedActions: recommendations,
      trace: {
        startedAt,
        endedAt: nowIso(),
        toolCalls: [],
        reasoningSummary: "Created a JD-specific resume copy and left the active base resume unchanged."
      }
    }
  }

  private resolveSource(payload: OptimizePayload): { content: ResumeContent; baseResumeId: string; parentVersionId?: string } | undefined {
    if (payload.sourceType === "base_resume") {
      const base = this.db.baseResumes.get(payload.sourceResumeId)
      return base ? { content: base.parsedContent, baseResumeId: base.id } : undefined
    }

    const version = this.db.resumeVersions.get(payload.sourceResumeId)
    return version
      ? { content: version.content, baseResumeId: version.baseResumeId, parentVersionId: version.id }
      : undefined
  }
}

function optimizeCopy(content: ResumeContent, keywords: string[], tone = "ats-friendly"): ResumeContent {
  const next = structuredClone(content)
  const additions = keywords.filter(Boolean).slice(0, 8)
  next.summary = `${content.summary ?? "Candidate profile"} Targeted for ${tone} alignment with ${additions.slice(0, 4).join(", ")}.`
  next.skills = [
    ...content.skills,
    {
      category: "target_jd_keywords",
      items: additions
    }
  ]
  next.projects = content.projects.map((project, index) => ({
    ...project,
    bullets: [
      `Reframed for target JD impact: ${additions.slice(0, 3).join(", ")}.`,
      ...project.bullets,
      index === 0 ? "Added measurable outcome placeholder for user verification." : "Strengthened STAR-style evidence."
    ]
  }))
  return next
}

function failed(
  task: AgentTaskInput<OptimizePayload>,
  startedAt: string,
  code: string,
  message: string
): AgentTaskOutput<OptimizeResult> {
  return {
    taskId: task.taskId,
    agentName: "resume_version_optimization",
    status: "failed",
    trace: { startedAt, endedAt: nowIso(), toolCalls: [], reasoningSummary: message },
    error: { code, message, recoverable: true }
  }
}
