import type { MemoryWriteRequest } from "../harness/agent-task.types.ts"
import { LongTermMemoryStore } from "../memory/long-term-memory.store.ts"
import { createId, nowIso } from "../utils/id.ts"

export class MemoryCommitController {
  constructor(private readonly longTermMemoryStore: LongTermMemoryStore) {}

  handle(requests: MemoryWriteRequest[], userId: string): void {
    for (const request of requests) {
      if (request.memoryType !== "long_term") continue
      if (request.requiresUserConfirmation) {
        throw new Error(`Cannot commit ${request.entityType}:${request.entityId} before user confirmation.`)
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
