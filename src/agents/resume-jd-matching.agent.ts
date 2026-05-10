import { InMemoryDatabase } from "../db/in-memory-database.ts"
import type { AgentHandler, AgentTaskInput, AgentTaskOutput } from "../harness/agent-task.types.ts"
import type { ResumeContent, ResumeJdMatchReport } from "../domain/types.ts"
import { createId, nowIso } from "../utils/id.ts"
import { actionsOf, recommendation } from "./action-recommendations.ts"

interface MatchPayload {
  resumeVersionId?: string
  baseResumeId?: string
  jdId: string
  matchMode: "baseline" | "specific_version" | "compare_versions"
}

export class ResumeJdMatchingAgent implements AgentHandler<MatchPayload, ResumeJdMatchReport> {
  readonly agentName = "resume_jd_matching" as const

  constructor(private readonly db: InMemoryDatabase) {}

  async run(task: AgentTaskInput<MatchPayload>): Promise<AgentTaskOutput<ResumeJdMatchReport>> {
    const startedAt = nowIso()
    const jd = this.db.jobDescriptions.get(task.payload.jdId)
    if (!jd || jd.userId !== task.userId) {
      return failed(task, startedAt, "JD_NOT_FOUND", "Target JD was not found.")
    }

    const resume = this.resolveResume(task.payload)
    if (!resume) {
      return failed(task, startedAt, "RESUME_NOT_FOUND", "A source resume is required for matching.")
    }

    const resumeSkills = new Set(resume.skills.flatMap((group) => group.items.map((skill) => skill.toLowerCase())))
    const jdSkills = jd.parsedContent.requiredSkills.map((skill) => skill.toLowerCase())
    const matchedSkills = jdSkills.filter((skill) => resumeSkills.has(skill))
    const missingSkills = jdSkills.filter((skill) => !resumeSkills.has(skill))
    const matchScore = jdSkills.length ? Math.round((matchedSkills.length / jdSkills.length) * 100) : 60

    const report: ResumeJdMatchReport = {
      id: createId("match"),
      userId: task.userId,
      jdId: jd.id,
      resumeVersionId: task.payload.resumeVersionId,
      baseResumeId: task.payload.baseResumeId,
      matchScore,
      matchedSkills,
      missingSkills,
      weakEvidenceAreas: missingSkills.map((skill) => `Resume lacks strong evidence for ${skill}.`),
      keywordGaps: jd.parsedContent.keywords.filter((keyword) => !resumeSkills.has(keyword.toLowerCase())),
      experienceGaps: missingSkills.length ? ["Add outcome-oriented project evidence for the top missing skills."] : [],
      optimizationPriority: missingSkills.slice(0, 5).map((skill, index) => ({
        area: skill,
        reason: `JD requires ${skill}, but current resume evidence is weak or absent.`,
        priority: index < 2 ? "high" : "medium"
      })),
      createdAt: nowIso()
    }

    this.db.matchReports.set(report.id, report)

    const recommendations = [
      recommendation("optimize_resume", "Generate a JD-specific resume copy", "A match report is available.", [
        "currentJdId",
        "currentBaseResumeId"
      ]),
      recommendation("start_mock_interview", "Start a mock interview", "The JD can already drive interview questions.", [
        "currentJdId"
      ]),
      recommendation("view_history", "View related history", "Matching output is traceable in episodic memory.")
    ]

    return {
      taskId: task.taskId,
      agentName: this.agentName,
      status: "success",
      result: report,
      statePatch: {
        activeNode: "resume_matching",
        currentJdId: jd.id,
        availableActions: actionsOf(recommendations)
      },
      nextSuggestedActions: recommendations,
      trace: {
        startedAt,
        endedAt: nowIso(),
        toolCalls: [],
        reasoningSummary: "Compared parsed JD skills with resume evidence and produced a gap-ranked report."
      }
    }
  }

  private resolveResume(payload: MatchPayload): ResumeContent | undefined {
    if (payload.resumeVersionId) return this.db.resumeVersions.get(payload.resumeVersionId)?.content
    if (payload.baseResumeId) return this.db.baseResumes.get(payload.baseResumeId)?.parsedContent
    return undefined
  }
}

function failed(
  task: AgentTaskInput<MatchPayload>,
  startedAt: string,
  code: string,
  message: string
): AgentTaskOutput<ResumeJdMatchReport> {
  return {
    taskId: task.taskId,
    agentName: "resume_jd_matching",
    status: "failed",
    trace: { startedAt, endedAt: nowIso(), toolCalls: [], reasoningSummary: message },
    error: { code, message, recoverable: true }
  }
}
