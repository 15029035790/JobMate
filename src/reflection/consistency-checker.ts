import { InMemoryDatabase } from "../db/in-memory-database.ts"

export class ConsistencyChecker {
  constructor(private readonly db: InMemoryDatabase) {}

  assertUserOwnsJd(userId: string, jdId?: string): void {
    if (!jdId) return
    const jd = this.db.jobDescriptions.get(jdId)
    if (!jd || jd.userId !== userId) {
      throw new Error(`JD ${jdId} does not belong to user ${userId}.`)
    }
  }

  assertUserOwnsResumeVersion(userId: string, resumeVersionId?: string): void {
    if (!resumeVersionId) return
    const version = this.db.resumeVersions.get(resumeVersionId)
    if (!version || version.userId !== userId) {
      throw new Error(`Resume version ${resumeVersionId} does not belong to user ${userId}.`)
    }
  }

  assertReviewConfirmed(reviewId: string): void {
    const review = this.db.reviewDrafts.get(reviewId)
    if (!review || review.status !== "confirmed") {
      throw new Error(`Review ${reviewId} is not confirmed.`)
    }
  }
}
