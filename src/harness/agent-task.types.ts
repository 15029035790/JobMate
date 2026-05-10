import type { AgentName } from "../domain/types.ts"
import type { ActionRecommendation, SessionState } from "../state/session-state.types.ts"

export interface TaskContext {
  currentJdId?: string
  currentResumeVersionId?: string
  currentInterviewSessionId?: string
  workflowNode?: SessionState["activeNode"]
}

export interface MemoryRefs {
  workingMemoryKeys?: string[]
  episodicEventIds?: string[]
  longTermMemoryIds?: string[]
}

export interface TaskTrace {
  parentTaskId?: string
  createdAt: string
  source: "user" | "orchestrator" | "agent"
}

export interface AgentTaskInput<TPayload = unknown> {
  taskId: string
  userId: string
  sessionId: string
  agentName: AgentName
  taskType: string
  payload: TPayload
  context: TaskContext
  memoryRefs: MemoryRefs
  trace: TaskTrace
}

export interface ToolCallRecord {
  toolName: string
  inputSummary: string
  outputSummary: string
  startedAt: string
  endedAt: string
}

export interface AgentExecutionTrace {
  startedAt: string
  endedAt: string
  toolCalls: ToolCallRecord[]
  reasoningSummary: string
}

export interface AgentTaskError {
  code: string
  message: string
  recoverable: boolean
}

export interface MemoryWriteRequest {
  memoryType: "working" | "episodic" | "long_term"
  entityType: string
  entityId: string
  payload: Record<string, unknown>
  requiresUserConfirmation: boolean
  confirmationId?: string
}

export interface AgentTaskOutput<TResult = unknown> {
  taskId: string
  agentName: AgentName
  status: "success" | "failed" | "needs_user_input" | "partial"
  result?: TResult
  statePatch?: Partial<SessionState>
  memoryWriteRequests?: MemoryWriteRequest[]
  nextSuggestedActions?: ActionRecommendation[]
  trace: AgentExecutionTrace
  error?: AgentTaskError
}

export interface AgentHandler<TPayload = unknown, TResult = unknown> {
  readonly agentName: AgentName
  run(task: AgentTaskInput<TPayload>): Promise<AgentTaskOutput<TResult>>
}

export interface AgentTaskRecord extends AgentTaskInput {
  status: "created" | "planned" | "running" | "waiting_user_input" | "completed" | "failed" | "cancelled" | "checkpointed"
  output?: AgentTaskOutput
  createdAt: string
  updatedAt: string
}
