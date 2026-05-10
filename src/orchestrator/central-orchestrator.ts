import { InterviewReviewNegotiationAgent } from "../agents/interview-review-negotiation.agent.ts"
import { LearningPlannerAgent } from "../agents/learning-planner.agent.ts"
import { MockInterviewAgent } from "../agents/mock-interview.agent.ts"
import { ResumeJdMatchingAgent } from "../agents/resume-jd-matching.agent.ts"
import { ResumeVersionOptimizationAgent } from "../agents/resume-version-optimization.agent.ts"
import { WeaknessDiagnosisAgent } from "../agents/weakness-diagnosis.agent.ts"
import { InMemoryDatabase } from "../db/in-memory-database.ts"
import { AgentRuntime } from "../harness/agent-runtime.ts"
import type { AgentTaskInput, AgentTaskOutput } from "../harness/agent-task.types.ts"
import { TaskRouter } from "../harness/task-router.ts"
import { IntentPlanner } from "../planner/intent-planner.ts"

export class CentralOrchestrator {
  private readonly router = new TaskRouter()
  private readonly runtime = new AgentRuntime()
  private readonly planner = new IntentPlanner()

  private readonly db: InMemoryDatabase
  constructor(db: InMemoryDatabase) {
    this.db = db
    this.runtime.register(new ResumeJdMatchingAgent(db))
    this.runtime.register(new ResumeVersionOptimizationAgent(db))
    this.runtime.register(new MockInterviewAgent(db))
    this.runtime.register(new InterviewReviewNegotiationAgent(db))
    this.runtime.register(new WeaknessDiagnosisAgent(db))
    this.runtime.register(new LearningPlannerAgent(db))
  }

  async dispatch(task: Omit<AgentTaskInput, "agentName">): Promise<AgentTaskOutput> {
    const agentName = this.router.route(task.taskType)
    if (!agentName) throw new Error(`No route for task type ${task.taskType}.`)
    return this.runtime.run({ ...task, agentName })
  }

  async planAndDispatch(userInput: string, base: Omit<AgentTaskInput, "taskId" | "agentName" | "taskType" | "payload" | "trace">): Promise<AgentTaskOutput> {
    const plan = this.planner.plan(userInput, base)
    const task = this.planner.createPlannedTask(base, plan)
    return this.dispatch(task)
  }
}
