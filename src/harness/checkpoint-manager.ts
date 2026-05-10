import type { SessionCheckpoint, SessionState } from "../state/session-state.types.ts"
import { createId, nowIso } from "../utils/id.ts"

export class CheckpointManager {
  private readonly checkpoints = new Map<string, SessionCheckpoint[]>()

  createCheckpoint(state: SessionState): SessionCheckpoint {
    const checkpoint: SessionCheckpoint = {
      id: createId("checkpoint"),
      userId: state.userId,
      sessionId: state.sessionId,
      state: structuredClone(state),
      createdAt: nowIso()
    }

    const existing = this.checkpoints.get(state.sessionId) ?? []
    existing.push(checkpoint)
    this.checkpoints.set(state.sessionId, existing)
    return checkpoint
  }

  latest(sessionId: string): SessionCheckpoint | undefined {
    return this.checkpoints.get(sessionId)?.at(-1)
  }
}
