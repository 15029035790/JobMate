import { ResumeJdMatchingAgent } from "../agents/resume-jd-matching.agent.ts"
import { ResumeVersionOptimizationAgent } from "../agents/resume-version-optimization.agent.ts"
import { MockInterviewAgent } from "../agents/mock-interview.agent.ts"
import { InMemoryDatabase } from "../db/in-memory-database.ts"
import { AgentRuntime } from "../harness/agent-runtime.ts"
import type { AgentTaskInput, AgentTaskOutput } from "../harness/agent-task.types.ts"
import { TaskRouter } from "../harness/task-router.ts"

export class CentralOrchestrator {
  private readonly router = new TaskRouter()
  private readonly runtime = new AgentRuntime()

  constructor(private readonly db: InMemoryDatabase) {
    this.runtime.register(new ResumeJdMatchingAgent(db))
    this.runtime.register(new ResumeVersionOptimizationAgent(db))
    this.runtime.register(new MockInterviewAgent(db))
  }

  async dispatch(task: Omit<AgentTaskInput, "agentName">): Promise<AgentTaskOutput> {
    const agentName = this.router.route(task.taskType)
    if (!agentName) throw new Error(`No route for task type ${task.taskType}.`)
    return this.runtime.run({ ...task, agentName })
  }
}
