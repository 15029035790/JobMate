import type { AgentHandler, AgentTaskInput, AgentTaskOutput } from "./agent-task.types.ts"
import type { AgentName } from "../domain/types.ts"
import { nowIso } from "../utils/id.ts"

export class AgentRuntime {
  private readonly handlers = new Map<AgentName, AgentHandler>()

  register(handler: AgentHandler): void {
    this.handlers.set(handler.agentName, handler)
  }

  async run(task: AgentTaskInput): Promise<AgentTaskOutput> {
    const handler = this.handlers.get(task.agentName)
    const startedAt = nowIso()

    if (!handler) {
      return {
        taskId: task.taskId,
        agentName: task.agentName,
        status: "failed",
        trace: {
          startedAt,
          endedAt: nowIso(),
          toolCalls: [],
          reasoningSummary: `No handler registered for ${task.agentName}.`
        },
        error: {
          code: "AGENT_NOT_FOUND",
          message: `No handler registered for ${task.agentName}.`,
          recoverable: false
        }
      }
    }

    return handler.run(task)
  }
}
