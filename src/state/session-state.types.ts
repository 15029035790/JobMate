import type { UserAction, WorkflowNode } from "../domain/types.ts"

export interface PendingConfirmation {
  type:
    | "resume_version_save"
    | "review_commit"
    | "weakness_commit"
    | "learning_plan_commit"
    | "replace_base_resume"
  targetId: string
  message: string
}

export interface ActionRecommendation {
  action: UserAction
  label: string
  reason: string
  requiredEntities: string[]
}

export interface SessionState {
  sessionId: string
  userId: string
  activeNode: WorkflowNode
  currentJdId?: string
  currentBaseResumeId?: string
  currentResumeVersionId?: string
  currentInterviewSessionId?: string
  currentReviewDraftId?: string
  currentWeaknessProfileId?: string
  currentLearningPlanId?: string
  availableActions: UserAction[]
  pendingConfirmation?: PendingConfirmation
  lastCheckpointAt: string
}

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
  createdAt: string
}

export interface WorkingMemory extends SessionState {
  temporaryUserIntent?: string
  recentMessages: ChatMessage[]
  pendingTaskIds: string[]
  updatedAt: string
}

export interface SessionCheckpoint {
  id: string
  userId: string
  sessionId: string
  state: SessionState
  createdAt: string
}
