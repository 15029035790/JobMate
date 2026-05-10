import type { MemoryWriteRequest } from "../harness/agent-task.types.ts"
import { LongTermMemoryStore } from "../memory/long-term-memory.store.ts"
import { createId, nowIso } from "../utils/id.ts"

export class MemoryCommitController {
  private readonly longTermMemoryStore: LongTermMemoryStore
  constructor(longTermMemoryStore: LongTermMemoryStore) { this.longTermMemoryStore = longTermMemoryStore }

  handle(requests: MemoryWriteRequest[], userId: string): void {
    for (const request of requests) {
      if (request.memoryType !== "long_term") continue
      if (request.requiresUserConfirmation) {
        throw new Error(`Cannot commit ${request.entityType}:${request.entityId} before user confirmation.`)
      }
      if (request.entityType === "project_answer_evaluation" && Array.isArray(request.payload.unverifiableClaims) && request.payload.unverifiableClaims.length) {
        throw new Error(`Cannot commit unverifiable project claims to long-term memory: ${request.entityId}.`)
      }
      if (request.entityType === "weakness_profile" && request.payload.confirmedByUser !== true) {
        throw new Error(`Cannot commit unconfirmed weakness profile ${request.entityId} to long-term memory.`)
      }

      this.longTermMemoryStore.add({
        id: createId("ltm"),
        userId,
        entityType: request.entityType,
        entityId: request.entityId,
        payload: request.payload,
        createdAt: nowIso()
      })
    }
  }
}
