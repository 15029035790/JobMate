import { InMemoryDatabase } from "../db/in-memory-database.ts"
import type { InterviewReviewDraft } from "../domain/types.ts"

export class ReviewDraftRepository {
  private readonly db: InMemoryDatabase
  constructor(db: InMemoryDatabase) { this.db = db }

  get(reviewId: string): InterviewReviewDraft | undefined {
    return this.db.reviewDrafts.get(reviewId)
  }

  save(review: InterviewReviewDraft): void {
    this.db.reviewDrafts.set(review.id, review)
  }

  listBySession(interviewSessionId: string): InterviewReviewDraft[] {
    return [...this.db.reviewDrafts.values()].filter((x) => x.interviewSessionId === interviewSessionId)
  }
}
