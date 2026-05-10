import type { AgentTaskOutput } from "../harness/agent-task.types.ts"

export class OutputValidator {
  validate(output: AgentTaskOutput): AgentTaskOutput {
    for (const request of output.memoryWriteRequests ?? []) {
      if (request.memoryType === "long_term" && request.requiresUserConfirmation) {
        throw new Error(
          `Long-term memory request ${request.entityType}:${request.entityId} still requires confirmation.`
        )
      }
    }

    if (output.statePatch && "currentBaseResumeId" in output.statePatch && output.agentName !== "central_orchestrator") {
      throw new Error("Vertical agents cannot replace the active base resume.")
    }

    return output
  }
}
