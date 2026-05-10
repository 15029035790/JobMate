import type {
  BaseResume,
  InterviewReviewDraft,
  InterviewSession,
  InterviewTurn,
  JobDescription,
  LearningPlan,
  ResumeJdMatchReport,
  ResumeVersion,
  User,
  WeaknessProfile
} from "../domain/types.ts"

export class InMemoryDatabase {
  readonly users = new Map<string, User>()
  readonly baseResumes = new Map<string, BaseResume>()
  readonly jobDescriptions = new Map<string, JobDescription>()
  readonly resumeVersions = new Map<string, ResumeVersion>()
  readonly matchReports = new Map<string, ResumeJdMatchReport>()
  readonly interviewSessions = new Map<string, InterviewSession>()
  readonly interviewTurns = new Map<string, InterviewTurn>()
  readonly reviewDrafts = new Map<string, InterviewReviewDraft>()
  readonly weaknessProfiles = new Map<string, WeaknessProfile>()
  readonly learningPlans = new Map<string, LearningPlan>()

  getActiveBaseResume(userId: string): BaseResume | undefined {
    return [...this.baseResumes.values()].find((resume) => resume.userId === userId && resume.isActive)
  }

  listResumeVersionsByJd(userId: string, jdId: string): ResumeVersion[] {
    return [...this.resumeVersions.values()].filter(
      (version) => version.userId === userId && version.optimizationTargetJdIds.includes(jdId)
    )
  }

  listInterviewTurns(sessionId: string): InterviewTurn[] {
    return [...this.interviewTurns.values()]
      .filter((turn) => turn.interviewSessionId === sessionId)
      .sort((a, b) => a.turnIndex - b.turnIndex)
  }

  listConfirmedReviews(userId: string): InterviewReviewDraft[] {
    return [...this.reviewDrafts.values()].filter((review) => review.userId === userId && review.status === "confirmed")
  }
}
