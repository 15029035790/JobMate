export type LearningPreference = "project_based" | "reading_based" | "mixed"

export type WorkflowNode =
  | "idle"
  | "jd_uploaded"
  | "resume_uploaded"
  | "resume_matching"
  | "resume_optimizing"
  | "resume_version_review"
  | "mock_interview"
  | "interview_review"
  | "review_negotiation"
  | "weakness_diagnosis"
  | "learning_planning"
  | "learning_in_progress"
  | "history_view"

export type UserAction =
  | "upload_base_resume"
  | "replace_base_resume"
  | "upload_jd"
  | "select_jd"
  | "match_resume_to_jd"
  | "optimize_resume"
  | "reuse_resume_version"
  | "compare_resume_versions"
  | "save_resume_version"
  | "archive_resume_version"
  | "start_mock_interview"
  | "pause_mock_interview"
  | "resume_mock_interview"
  | "finish_mock_interview"
  | "review_interview"
  | "correct_review"
  | "confirm_review"
  | "diagnose_weakness"
  | "confirm_weakness"
  | "create_learning_plan"
  | "save_learning_plan"
  | "pause_learning_plan"
  | "resume_learning_plan"
  | "view_history"

export type AgentName =
  | "central_orchestrator"
  | "resume_jd_matching"
  | "resume_version_optimization"
  | "mock_interview"
  | "interview_review_negotiation"
  | "weakness_diagnosis"
  | "learning_planner"

export interface User {
  id: string
  name?: string
  email?: string
  learningPreference: LearningPreference
  createdAt: string
  updatedAt: string
}

export interface ResumeContent {
  basics: {
    name?: string
    email?: string
    phone?: string
    location?: string
    links?: string[]
  }
  summary?: string
  skills: Array<{ category: string; items: string[] }>
  experiences: Array<{
    company: string
    title: string
    startDate?: string
    endDate?: string
    bullets: string[]
  }>
  projects: Array<{
    name: string
    description: string
    techStack: string[]
    bullets: string[]
  }>
  education?: Array<{
    school: string
    degree: string
    startDate?: string
    endDate?: string
  }>
}

export interface BaseResume {
  id: string
  userId: string
  title: string
  rawText: string
  parsedContent: ResumeContent
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface JobDescription {
  id: string
  userId: string
  company?: string
  title: string
  location?: string
  sourceUrl?: string
  rawText: string
  parsedContent: {
    responsibilities: string[]
    requiredSkills: string[]
    preferredSkills: string[]
    seniority?: string
    domain?: string
    keywords: string[]
  }
  embeddingId?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface ResumeVersion {
  id: string
  userId: string
  baseResumeId: string
  parentVersionId?: string
  title: string
  content: ResumeContent
  rawText: string
  status: "draft" | "saved" | "archived" | "rejected"
  optimizationTargetJdIds: string[]
  tags: string[]
  changeSummary: string[]
  jdAlignmentNotes: string[]
  riskWarnings: string[]
  createdByTaskId: string
  createdAt: string
  updatedAt: string
}

export interface ResumeJdMatchReport {
  id: string
  userId: string
  jdId: string
  resumeVersionId?: string
  baseResumeId?: string
  matchScore: number
  matchedSkills: string[]
  missingSkills: string[]
  weakEvidenceAreas: string[]
  keywordGaps: string[]
  experienceGaps: string[]
  optimizationPriority: Array<{
    area: string
    reason: string
    priority: "high" | "medium" | "low"
  }>
  createdAt: string
}

export interface InterviewSession {
  id: string
  userId: string
  jdId?: string
  resumeVersionId?: string
  interviewType: "behavioral" | "technical" | "case" | "mixed"
  difficulty: "easy" | "medium" | "hard"
  status: "not_started" | "in_progress" | "paused" | "completed" | "abandoned"
  startedAt?: string
  completedAt?: string
  summary?: string
}

export interface InterviewTurn {
  id: string
  interviewSessionId: string
  userId: string
  turnIndex: number
  question: string
  questionType: string
  expectedSignals: string[]
  userAnswer?: string
  feedback?: {
    strengths: string[]
    weaknesses: string[]
    suggestedStructure: string
    score?: number
  }
  followUpQuestions?: string[]
  createdAt: string
}

export interface InterviewReviewDraft {
  id: string
  userId: string
  interviewSessionId: string
  status: "draft" | "under_negotiation" | "confirmed" | "rejected"
  initialFindings: string[]
  suspectedWeaknesses: string[]
  userCorrections: string[]
  negotiationRounds?: Array<{
    round: number
    correctionCategory: "facts" | "ownership" | "metrics" | "communication"
    correction: string
    createdAt: string
  }>
  pendingTopics?: string[]
  finalAgreedFindings?: string[]
  finalAgreedWeaknesses?: string[]
  createdAt: string
  updatedAt: string
}

export interface WeaknessProfile {
  id: string
  userId: string
  sourceReviewIds: string[]
  scope: "single_interview" | "role_specific" | "global_profile"
  weaknesses: Array<{
    skillArea: string
    description: string
    evidence: string[]
    severity: "low" | "medium" | "high"
    confidence: number
    confirmedByUser: boolean
  }>
  priorityRanking: string[]
  status: "draft" | "confirmed" | "archived"
  createdAt: string
  updatedAt: string
}

export interface LearningPlan {
  id: string
  userId: string
  weaknessProfileId: string
  targetRole?: string
  jdId?: string
  title: string
  learningMode: LearningPreference
  status: "not_started" | "in_progress" | "paused" | "completed" | "archived"
  goals: string[]
  tasks: LearningTask[]
  createdAt: string
  updatedAt: string
}

export interface LearningTask {
  id: string
  learningPlanId: string
  title: string
  description: string
  targetWeakness: string
  deliverable: string
  estimatedHours: number
  status: "not_started" | "in_progress" | "paused" | "completed"
  reflectionNotes?: string[]
  createdAt: string
  updatedAt: string
}


export type FollowUpStrategy =
  | "clarify_context"
  | "probe_ownership"
  | "probe_architecture"
  | "probe_tradeoffs"
  | "probe_metrics"
  | "probe_failure_cases"
  | "move_to_next_topic"

export interface ProjectDeepDiveInput {
  userId: string
  resumeVersionId: string
  jdId?: string
  selectedProject: {
    projectName: string
    projectDescription: string
    bullets: string[]
  }
  targetRole?: string
  interviewRound: "screening" | "technical" | "hiring_manager" | "behavioral"
}

export interface ProjectClaim {
  id?: string
  interviewTurnId?: string
  claimType:
    | "business_context"
    | "technical_design"
    | "personal_contribution"
    | "metric_result"
    | "tradeoff"
    | "failure_or_limitation"
  content: string
  verifiability:
    | "verifiable_from_resume"
    | "supported_by_answer"
    | "internally_consistent"
    | "unverifiable_internal_claim"
  confidence: "low" | "medium" | "high"
}

export interface ProjectAnswerEvaluation {
  contextClarityScore: number
  problemFramingScore: number
  ownershipBoundaryScore: number
  technicalDepthScore: number
  tradeoffReasoningScore: number
  evidenceQualityScore: number
  limitationAwarenessScore: number
  communicationScore: number
  consistencyScore: number
  interviewerComprehensionScore: number
  roleAlignmentScore: number
  overallSignal: "strong" | "mixed" | "weak" | "risk" | "unknown"
  unverifiableClaims: string[]
  suggestedFollowUps: string[]
  improvementAdvice: string[]
  strongSignals: string[]
  weakSignals: string[]
  riskSignals: string[]
  requiresUserConfirmationBeforeLongTermMemory: boolean
  canWriteToEpisodicMemory: boolean
}

export interface ProjectDeepDiveOutput {
  currentQuestion: string
  evaluationRubric: {
    targetSignals: string[]
    redFlags: string[]
    expectedDepth: "surface" | "medium" | "deep"
  }
  answerEvaluation?: ProjectAnswerEvaluation
  nextFollowUpStrategy: FollowUpStrategy
}

export interface ConfirmedProjectNarrative {
  projectId: string
  userId: string
  userConfirmedNarrative: string
  confirmedContributionBoundary: string[]
  confirmedMetrics: Array<{
    metric: string
    value: string
    evidenceLevel: "user_claimed" | "resume_supported" | "interview_consistent"
  }>
  interviewReadySummary: string
  caveats: string[]
}

export type EpisodicEventType =
  | "resume_uploaded"
  | "jd_uploaded"
  | "resume_matched"
  | "resume_version_created"
  | "resume_version_saved"
  | "interview_started"
  | "interview_turn_recorded"
  | "interview_paused"
  | "interview_resumed"
  | "interview_completed"
  | "review_draft_created"
  | "review_user_corrected"
  | "review_confirmed"
  | "review_rejected"
  | "weakness_diagnosed"
  | "weakness_confirmed"
  | "learning_plan_created"
  | "learning_plan_saved"
  | "learning_task_updated"

export interface EpisodicEvent {
  eventId: string
  userId: string
  sessionId: string
  eventType: EpisodicEventType
  entityRefs: {
    jdId?: string
    resumeVersionId?: string
    interviewSessionId?: string
    reviewId?: string
    weaknessProfileId?: string
    learningPlanId?: string
  }
  payload: Record<string, unknown>
  createdAt: string
}

export interface EmbeddingRecord {
  id: string
  userId: string
  entityType: "job_description" | "resume_version" | "interview_turn" | "review" | "learning_task"
  entityId: string
  text: string
  vector: number[]
  createdAt: string
}
