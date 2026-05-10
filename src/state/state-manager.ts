import type { SessionState } from "./session-state.types.ts"
import { WorkingMemoryStore } from "../memory/working-memory.store.ts"

export class StateManager {
  constructor(private readonly workingMemoryStore: WorkingMemoryStore) {}

  applyPatch(sessionId: string, patch?: Partial<SessionState>): SessionState {
    const current = this.workingMemoryStore.get(sessionId)
    if (!current) {
      throw new Error(`Session ${sessionId} does not exist.`)
    }
    if (!patch) return current
    return this.workingMemoryStore.applyPatch(sessionId, patch)
  }
}
