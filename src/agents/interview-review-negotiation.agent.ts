import { InMemoryDatabase } from "../db/in-memory-database.ts"
import type { AgentHandler, AgentTaskInput, AgentTaskOutput, MemoryWriteRequest } from "../harness/agent-task.types.ts"
import type { InterviewReviewDraft } from "../domain/types.ts"
import { createId, nowIso } from "../utils/id.ts"
import { ReviewDraftRepository } from "../repositories/review-draft.repository.ts"

type Payload =
  | { mode: "create"; interviewSessionId: string }
  | { mode: "correct"; reviewId: string; correction: string; correctionCategory?: "facts" | "ownership" | "metrics" | "communication" }
  | { mode: "suggest_next"; reviewId: string }
  | { mode: "confirm"; reviewId: string }

export class InterviewReviewNegotiationAgent implements AgentHandler<Payload, InterviewReviewDraft | { strategy: string; prompt: string }> {
  readonly agentName = "interview_review_negotiation" as const
  private readonly repo: ReviewDraftRepository

  constructor(db: InMemoryDatabase) { this.repo = new ReviewDraftRepository(db) }

  async run(task: AgentTaskInput<Payload>): Promise<AgentTaskOutput<InterviewReviewDraft | { strategy: string; prompt: string }>> {
    const startedAt = nowIso()
    if (task.payload.mode === "create") {
      const draft: InterviewReviewDraft = {
        id: createId("review"),
        userId: task.userId,
        interviewSessionId: task.payload.interviewSessionId,
        status: "draft",
        initialFindings: ["需要更多量化证据"],
        suspectedWeaknesses: ["贡献边界表述模糊"],
        userCorrections: [],
        negotiationRounds: [],
        pendingTopics: ["ownership", "metrics"],
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      this.repo.save(draft)
      return ok(task, startedAt, draft)
    }

    const review = this.repo.get(task.payload.reviewId)
    if (!review) return fail(task, startedAt, "REVIEW_NOT_FOUND", "Review not found")

    if (task.payload.mode === "suggest_next") {
      const strategy = suggestStrategy(review)
      const prompt = strategy === "probe_metrics"
        ? "请补充这个结论对应的指标口径与采样方式。"
        : strategy === "probe_ownership"
          ? "请明确你个人负责范围与团队协作边界。"
          : "请补充你对该复盘结论的修正意见。"
      return { taskId: task.taskId, agentName: this.agentName, status: "success", result: { strategy, prompt }, trace: { startedAt, endedAt: nowIso(), toolCalls: [], reasoningSummary: "Generated next negotiation strategy." } }
    }

    if (task.payload.mode === "correct") {
      const round = review.userCorrections.length + 1
      const category = task.payload.correctionCategory ?? "facts"
      review.userCorrections.push(`[round:${round}][${category}] ${task.payload.correction}`)
      review.negotiationRounds = [...(review.negotiationRounds ?? []), { round, correctionCategory: category, correction: task.payload.correction, createdAt: nowIso() }]
      review.pendingTopics = (review.pendingTopics ?? []).filter((t) => !topicClosedByCategory(t, category))
      review.status = "under_negotiation"
      review.updatedAt = nowIso()
      this.repo.save(review)
      return ok(task, startedAt, review)
    }

    review.status = "confirmed"
    review.finalAgreedFindings = [...review.initialFindings, ...review.userCorrections]
    review.finalAgreedWeaknesses = review.suspectedWeaknesses.filter((x) => !review.userCorrections.some((c) => c.includes(x)))
    review.pendingTopics = []
    review.updatedAt = nowIso()
    this.repo.save(review)

    const mem: MemoryWriteRequest[] = [{ memoryType: "long_term", entityType: "review_findings", entityId: review.id, payload: { finalAgreedFindings: review.finalAgreedFindings, finalAgreedWeaknesses: review.finalAgreedWeaknesses }, requiresUserConfirmation: false }]
    return { ...ok(task, startedAt, review), memoryWriteRequests: mem }
  }
}

function suggestStrategy(review: InterviewReviewDraft): "probe_metrics" | "probe_ownership" | "collect_corrections" {
  const topics = review.pendingTopics ?? []
  if (topics.includes("metrics")) return "probe_metrics"
  if (topics.includes("ownership")) return "probe_ownership"
  return "collect_corrections"
}

function topicClosedByCategory(topic: string, category: "facts" | "ownership" | "metrics" | "communication"): boolean {
  return (topic === "metrics" && category === "metrics") || (topic === "ownership" && category === "ownership")
}

const ok = (task: AgentTaskInput<Payload>, startedAt: string, result: InterviewReviewDraft): AgentTaskOutput<InterviewReviewDraft> => ({ taskId: task.taskId, agentName: "interview_review_negotiation", status: "success", result, statePatch: { currentReviewDraftId: result.id, activeNode: "review_negotiation" }, trace: { startedAt, endedAt: nowIso(), toolCalls: [], reasoningSummary: "Processed review negotiation step." } })
const fail = (task: AgentTaskInput<Payload>, startedAt: string, code: string, message: string): AgentTaskOutput<InterviewReviewDraft> => ({ taskId: task.taskId, agentName: "interview_review_negotiation", status: "failed", trace: { startedAt, endedAt: nowIso(), toolCalls: [], reasoningSummary: message }, error: { code, message, recoverable: true } })
