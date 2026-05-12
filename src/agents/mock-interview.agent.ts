import { InMemoryDatabase } from "../db/in-memory-database.ts"
import type { AgentHandler, AgentTaskInput, AgentTaskOutput, MemoryWriteRequest } from "../harness/agent-task.types.ts"
import type { FollowUpStrategy, InterviewSession, InterviewTurn, ProjectAnswerEvaluation } from "../domain/types.ts"
import { type LlmClient, LlmTool } from "../tools/llm.tool.ts"
import { createId, nowIso } from "../utils/id.ts"
import { actionsOf, recommendation } from "./action-recommendations.ts"
import { evaluateProjectAnswer, nextFollowUpStrategy, projectQuestion, type QuestionKind, evaluateGeneralAnswer } from "./project-deep-dive.ts"

type Payload =
  | { mode: "start"; jdId?: string; resumeVersionId?: string; interviewType?: InterviewSession["interviewType"] }
  | { mode: "answer"; interviewSessionId: string; answer: string; questionKind?: QuestionKind }
  | { mode: "finish"; interviewSessionId: string }

export class MockInterviewAgent implements AgentHandler<Payload, Record<string, unknown>> {
  readonly agentName = "mock_interview" as const
  private readonly db: InMemoryDatabase
  private readonly llm: LlmClient
  constructor(db: InMemoryDatabase, llm: LlmClient = new LlmTool()) { this.db = db; this.llm = llm }

  async run(task: AgentTaskInput<Payload>): Promise<AgentTaskOutput<Record<string, unknown>>> {
    const startedAt = nowIso()
    if (task.payload.mode === "start") return this.start(task, startedAt)
    if (task.payload.mode === "answer") return this.answer(task, startedAt)
    return this.finish(task, startedAt)
  }

  private async start(task: AgentTaskInput<Payload>, startedAt: string): Promise<AgentTaskOutput<Record<string, unknown>>> {
    const p = task.payload as Extract<Payload, { mode: "start" }>
    const session: InterviewSession = { id: createId("interview"), userId: task.userId, jdId: p.jdId, resumeVersionId: p.resumeVersionId, interviewType: p.interviewType ?? "mixed", difficulty: "medium", status: "in_progress", startedAt: nowIso() }
    this.db.interviewSessions.set(session.id, session)
    const callStartedAt = nowIso()
    let question: string
    try {
      question = await this.generateOpeningQuestion(p)
    } catch (err) {
      return this.failed(task, startedAt, "LLM_REQUEST_FAILED", (err as Error).message)
    }
    const turn: InterviewTurn = { id: createId("turn"), interviewSessionId: session.id, userId: task.userId, turnIndex: 1, question, questionType: "general", expectedSignals: ["clarity", "structure"], createdAt: nowIso() }
    this.db.interviewTurns.set(turn.id, turn)
    const recs=[recommendation("finish_mock_interview","结束面试","已进入面试流程"),recommendation("pause_mock_interview","暂停面试","可稍后继续")]
    return { taskId: task.taskId, agentName: this.agentName, status:"success", result:{interviewSessionId:session.id,question}, statePatch:{activeNode:"mock_interview",currentInterviewSessionId:session.id,availableActions:actionsOf(recs)}, nextSuggestedActions:recs, trace:{startedAt,endedAt:nowIso(),toolCalls:[{toolName:"deepseek.chat.completions",inputSummary:"Generate mock interview opening question.",outputSummary:question.slice(0,160),startedAt:callStartedAt,endedAt:nowIso()}],reasoningSummary:"Started interview session and generated opening question with a real LLM call."}}
  }

  private async answer(task: AgentTaskInput<Payload>, startedAt: string): Promise<AgentTaskOutput<Record<string, unknown>>> {
    const p = task.payload as Extract<Payload, { mode: "answer" }>
    const turns = this.db.listInterviewTurns(p.interviewSessionId)
    const current = turns.at(-1)
    if (!current) return this.failed(task, startedAt, "TURN_NOT_FOUND", "No interview turn found.")
    current.userAnswer = p.answer
    let evaluation: ProjectAnswerEvaluation | ReturnType<typeof evaluateGeneralAnswer>
    if (p.questionKind === "project_deep_dive" || /project|项目/i.test(current.question)) evaluation = evaluateProjectAnswer(current.question, p.answer)
    else evaluation = evaluateGeneralAnswer(p.answer)
    const strategy = "overallSignal" in evaluation ? nextFollowUpStrategy(evaluation) : "move_to_next_topic"
    const callStartedAt = nowIso()
    let followup: string
    try {
      followup = await this.generateFollowUpQuestion(current.question, p.answer, strategy, evaluation)
    } catch (err) {
      return this.failed(task, startedAt, "LLM_REQUEST_FAILED", (err as Error).message)
    }
    const nextTurn: InterviewTurn = { id: createId("turn"), interviewSessionId: p.interviewSessionId, userId: task.userId, turnIndex: current.turnIndex + 1, question: followup, questionType: strategy, expectedSignals: [strategy], createdAt: nowIso() }
    this.db.interviewTurns.set(nextTurn.id, nextTurn)
    const mem: MemoryWriteRequest[] = [{ memoryType:"episodic", entityType:"interview_turn", entityId:current.id, payload:{question:current.question,answer:p.answer,evaluation}, requiresUserConfirmation:false }]
    return { taskId:task.taskId,agentName:this.agentName,status:"success",result:{evaluation,nextQuestion:followup,nextFollowUpStrategy:strategy},memoryWriteRequests:mem,statePatch:{currentInterviewSessionId:p.interviewSessionId},trace:{startedAt,endedAt:nowIso(),toolCalls:[{toolName:"deepseek.chat.completions",inputSummary:`Generate ${strategy} follow-up question.`,outputSummary:followup.slice(0,160),startedAt:callStartedAt,endedAt:nowIso()}],reasoningSummary:"Evaluated answer and generated the next follow-up question with a real LLM call."} }
  }

  private finish(task: AgentTaskInput<Payload>, startedAt: string): AgentTaskOutput<Record<string, unknown>> {
    const p = task.payload as Extract<Payload, { mode: "finish" }>
    const s = this.db.interviewSessions.get(p.interviewSessionId)
    if (!s) return this.failed(task, startedAt, "SESSION_NOT_FOUND", "Interview session not found.")
    s.status = "completed"; s.completedAt = nowIso()
    return { taskId: task.taskId, agentName: this.agentName, status:"success", result:{interviewSessionId:s.id,status:s.status}, statePatch:{activeNode:"interview_review"}, trace:{startedAt,endedAt:nowIso(),toolCalls:[],reasoningSummary:"Finished interview session."}}
  }

  private failed(task: AgentTaskInput<Payload>, startedAt: string, code: string, message: string): AgentTaskOutput<Record<string, unknown>> { return { taskId: task.taskId, agentName: this.agentName, status:"failed", trace:{startedAt,endedAt:nowIso(),toolCalls:[],reasoningSummary:message}, error:{code,message,recoverable:true} } }

  private async generateOpeningQuestion(payload: Extract<Payload, { mode: "start" }>): Promise<string> {
    const jd = payload.jdId ? this.db.jobDescriptions.get(payload.jdId) : undefined
    const resumeVersion = payload.resumeVersionId ? this.db.resumeVersions.get(payload.resumeVersionId) : undefined
    const prompt = JSON.stringify({
      task: "Generate one concise opening mock interview question.",
      interviewType: payload.interviewType ?? "mixed",
      jd: jd?.parsedContent,
      resume: resumeVersion?.content,
      constraints: [
        "Ask exactly one question.",
        "Use Chinese unless the JD/resume is clearly English.",
        "Make it specific to the JD or resume when context exists.",
        "Do not include feedback, scoring, or explanations."
      ],
      fallbackQuestion: projectQuestion("general")
    })
    return normalizeQuestion(await this.llm.complete(prompt, { system: "You are JobMate's interviewer. Ask one practical interview question at a time.", temperature: 0.4 }))
  }

  private async generateFollowUpQuestion(
    previousQuestion: string,
    answer: string,
    strategy: string,
    evaluation: ProjectAnswerEvaluation | ReturnType<typeof evaluateGeneralAnswer>
  ): Promise<string> {
    const prompt = JSON.stringify({
      task: "Generate the next mock interview follow-up question.",
      previousQuestion,
      answer,
      strategy,
      evaluation,
      constraints: [
        "Ask exactly one question.",
        "Use Chinese unless the candidate answered in English.",
        "The question should probe the strategy without revealing scores.",
        "Do not include feedback, scoring, or explanations."
      ],
      fallbackQuestion: projectQuestion(strategy as FollowUpStrategy)
    })
    return normalizeQuestion(await this.llm.complete(prompt, { system: "You are JobMate's interviewer. Ask one focused follow-up question.", temperature: 0.4 }))
  }
}

function normalizeQuestion(raw: string): string {
  return raw.trim().replace(/^["'“”]+|["'“”]+$/g, "")
}
