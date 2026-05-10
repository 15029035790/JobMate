import { InMemoryDatabase } from "../db/in-memory-database.ts"
import type { AgentHandler, AgentTaskInput, AgentTaskOutput, MemoryWriteRequest } from "../harness/agent-task.types.ts"
import type { InterviewReviewDraft } from "../domain/types.ts"
import { createId, nowIso } from "../utils/id.ts"

type Payload = { mode: "create"; interviewSessionId: string } | { mode: "correct"; reviewId: string; correction: string } | { mode: "confirm"; reviewId: string }

export class InterviewReviewNegotiationAgent implements AgentHandler<Payload, InterviewReviewDraft> {
  readonly agentName = "interview_review_negotiation" as const
  private readonly db: InMemoryDatabase
  constructor(db: InMemoryDatabase) { this.db = db }
  async run(task: AgentTaskInput<Payload>): Promise<AgentTaskOutput<InterviewReviewDraft>> {
    const startedAt = nowIso()
    if (task.payload.mode === "create") {
      const draft: InterviewReviewDraft = { id: createId("review"), userId: task.userId, interviewSessionId: task.payload.interviewSessionId, status: "draft", initialFindings: ["需要更多量化证据"], suspectedWeaknesses: ["贡献边界表述模糊"], userCorrections: [], createdAt: nowIso(), updatedAt: nowIso() }
      this.db.reviewDrafts.set(draft.id, draft)
      return ok(task, startedAt, draft)
    }
    const review = this.db.reviewDrafts.get(task.payload.reviewId)
    if (!review) return fail(task, startedAt, "REVIEW_NOT_FOUND", "Review not found")
    if (task.payload.mode === "correct") { review.userCorrections.push(task.payload.correction); review.status = "under_negotiation"; review.updatedAt = nowIso(); return ok(task, startedAt, review) }
    review.status = "confirmed"; review.finalAgreedFindings = [...review.initialFindings, ...review.userCorrections]; review.updatedAt = nowIso()
    const mem: MemoryWriteRequest[] = [{ memoryType: "long_term", entityType: "review_findings", entityId: review.id, payload: { finalAgreedFindings: review.finalAgreedFindings }, requiresUserConfirmation: false }]
    return { ...ok(task, startedAt, review), memoryWriteRequests: mem }
  }
}
const ok=(task:AgentTaskInput<Payload>,startedAt:string,result:InterviewReviewDraft):AgentTaskOutput<InterviewReviewDraft>=>({taskId:task.taskId,agentName:"interview_review_negotiation",status:"success",result,statePatch:{currentReviewDraftId:result.id,activeNode:"review_negotiation"},trace:{startedAt,endedAt:nowIso(),toolCalls:[],reasoningSummary:"Processed review negotiation step."}})
const fail=(task:AgentTaskInput<Payload>,startedAt:string,code:string,message:string):AgentTaskOutput<InterviewReviewDraft>=>({taskId:task.taskId,agentName:"interview_review_negotiation",status:"failed",trace:{startedAt,endedAt:nowIso(),toolCalls:[],reasoningSummary:message},error:{code,message,recoverable:true}})
