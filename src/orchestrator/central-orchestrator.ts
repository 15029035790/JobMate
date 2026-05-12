import { InterviewReviewNegotiationAgent } from "../agents/interview-review-negotiation.agent.ts"
import { LearningPlannerAgent } from "../agents/learning-planner.agent.ts"
import { MockInterviewAgent } from "../agents/mock-interview.agent.ts"
import { ResumeJdMatchingAgent } from "../agents/resume-jd-matching.agent.ts"
import { ResumeVersionOptimizationAgent } from "../agents/resume-version-optimization.agent.ts"
import { WeaknessDiagnosisAgent } from "../agents/weakness-diagnosis.agent.ts"
import { InMemoryDatabase } from "../db/in-memory-database.ts"
import { AgentRuntime } from "../harness/agent-runtime.ts"
import type { AgentTaskInput, AgentTaskOutput, MemoryWriteRequest } from "../harness/agent-task.types.ts"
import { LongTermMemoryStore } from "../memory/long-term-memory.store.ts"
import { IntentPlanner } from "../planner/intent-planner.ts"
import { MemoryCommitController } from "../reflection/memory-commit-controller.ts"
import { TaskRouter } from "../harness/task-router.ts"
import { InMemoryObservabilityPort } from "../p2/observability.interface.ts"
import { type LlmClient, LlmTool } from "../tools/llm.tool.ts"

export interface CentralOrchestratorOptions {
  llm?: LlmClient
}

export class CentralOrchestrator {
  private readonly router = new TaskRouter()
  private readonly runtime = new AgentRuntime()
  private readonly planner = new IntentPlanner()
  private readonly confirmed = new Set<string>()
  private readonly longTermMemoryStore = new LongTermMemoryStore()
  private readonly memoryCommitController = new MemoryCommitController(this.longTermMemoryStore)
  private readonly observability = new InMemoryObservabilityPort()
  private readonly db: InMemoryDatabase
  private readonly llm: LlmClient

  constructor(db: InMemoryDatabase, options: CentralOrchestratorOptions = {}) {
    this.db = db
    this.llm = options.llm ?? new LlmTool()
    this.runtime.register(new ResumeJdMatchingAgent(db))
    this.runtime.register(new ResumeVersionOptimizationAgent(db, this.llm))
    this.runtime.register(new MockInterviewAgent(db, this.llm))
    this.runtime.register(new InterviewReviewNegotiationAgent(db))
    this.runtime.register(new WeaknessDiagnosisAgent(db))
    this.runtime.register(new LearningPlannerAgent(db))
  }

  confirm(confirmationId: string): void { this.confirmed.add(confirmationId) }
  listLongTermMemory(userId: string) { return this.longTermMemoryStore.listByUser(userId) }
  listTraceEvents(sessionId: string) { return this.observability.listBySession(sessionId) }

  async dispatch(task: Omit<AgentTaskInput, "agentName">): Promise<AgentTaskOutput> {
    const agentName = this.router.route(task.taskType)
    if (!agentName) throw new Error(`No route for task type ${task.taskType}.`)
    this.observability.record({ sessionId: task.sessionId, taskId: task.taskId, phase: "dispatched", message: `Dispatch ${task.taskType}`, createdAt: new Date().toISOString() })
    const output = await this.runtime.run({ ...task, agentName })
    const finalOutput = this.handleMemoryWrites(output, task.userId)
    this.observability.record({ sessionId: task.sessionId, taskId: task.taskId, phase: finalOutput.status === "failed" ? "failed" : "completed", message: `Task ${finalOutput.status}`, createdAt: new Date().toISOString() })
    return finalOutput
  }

  async planAndDispatch(userInput: string, base: Omit<AgentTaskInput, "taskId" | "agentName" | "taskType" | "payload" | "trace">): Promise<AgentTaskOutput> {
    const plan = this.planner.plan(userInput, base)
    const task = this.planner.createPlannedTask(base, plan)
    return this.dispatch(task)
  }

  private handleMemoryWrites(output: AgentTaskOutput, userId: string): AgentTaskOutput {
    const requests = (output.memoryWriteRequests ?? []).map((r) => this.asConfirmedIfMatched(r))
    const pending = requests.find((r) => r.memoryType === "long_term" && r.requiresUserConfirmation)
    if (pending) {
      return {
        ...output,
        status: "needs_user_input",
        memoryWriteRequests: requests,
        statePatch: {
          ...output.statePatch,
          pendingConfirmation: {
            type: "resume_version_save",
            targetId: pending.entityId,
            message: `Please confirm before long-term commit: ${pending.entityType}`
          }
        }
      }
    }

    const longTermRequests = requests.filter((r) => r.memoryType === "long_term")
    if (longTermRequests.length) this.memoryCommitController.handle(longTermRequests, userId)
    return { ...output, memoryWriteRequests: requests }
  }

  private asConfirmedIfMatched(r: MemoryWriteRequest): MemoryWriteRequest {
    if (r.requiresUserConfirmation && r.confirmationId && this.confirmed.has(r.confirmationId)) return { ...r, requiresUserConfirmation: false }
    return r
  }
}
