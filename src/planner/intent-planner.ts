import type { AgentTaskInput } from "../harness/agent-task.types.ts"
import { createId, nowIso } from "../utils/id.ts"

export interface PlannerResult {
  intent: string
  confidence: number
  taskType: string
  payload: Record<string, unknown>
}

export class IntentPlanner {
  plan(userInput: string, base: Omit<AgentTaskInput, "taskId" | "agentName" | "taskType" | "payload" | "trace">): PlannerResult {
    const lower = userInput.toLowerCase()
    if (lower.includes("match") || /匹配|jd/.test(lower)) return { intent: "resume_jd_match", confidence: 0.8, taskType: "match_resume_jd", payload: {} }
    if (lower.includes("optimize") || /优化简历/.test(lower)) return { intent: "resume_optimize", confidence: 0.8, taskType: "optimize_resume_version", payload: {} }
    if (lower.includes("interview") || /面试/.test(lower)) return { intent: "mock_interview", confidence: 0.75, taskType: "start_mock_interview", payload: {} }
    return { intent: "unknown", confidence: 0.4, taskType: "view_history", payload: {} }
  }

  createPlannedTask(base: Omit<AgentTaskInput, "taskId" | "agentName" | "taskType" | "payload" | "trace">, plan: PlannerResult): Omit<AgentTaskInput, "agentName"> {
    return {
      ...base,
      taskId: createId("task"),
      taskType: plan.taskType,
      payload: plan.payload,
      trace: { createdAt: nowIso(), source: "user" }
    }
  }
}
