import type { ChatMessage, SessionState, WorkingMemory } from "../state/session-state.types.ts"
import type { UserAction } from "../domain/types.ts"
import { nowIso } from "../utils/id.ts"

const defaultActions: UserAction[] = ["upload_base_resume", "upload_jd", "view_history"]

export class WorkingMemoryStore {
  private readonly sessions = new Map<string, WorkingMemory>()

  getOrCreate(sessionId: string, userId: string): WorkingMemory {
    const existing = this.sessions.get(sessionId)
    if (existing) return existing

    const now = nowIso()
    const memory: WorkingMemory = {
      sessionId,
      userId,
      activeNode: "idle",
      availableActions: [...defaultActions],
      lastCheckpointAt: now,
      recentMessages: [],
      pendingTaskIds: [],
      updatedAt: now
    }
    this.sessions.set(sessionId, memory)
    return memory
  }

  get(sessionId: string): WorkingMemory | undefined {
    return this.sessions.get(sessionId)
  }

  applyPatch(sessionId: string, patch: Partial<SessionState>): WorkingMemory {
    const existing = this.sessions.get(sessionId)
    if (!existing) {
      throw new Error(`Working memory not found for session ${sessionId}.`)
    }

    const next: WorkingMemory = {
      ...existing,
      ...patch,
      availableActions: patch.availableActions ?? existing.availableActions,
      updatedAt: nowIso()
    }

    if (patch.pendingConfirmation === undefined && "pendingConfirmation" in patch) {
      delete next.pendingConfirmation
    }

    this.sessions.set(sessionId, next)
    return next
  }

  appendMessage(sessionId: string, message: ChatMessage): void {
    const existing = this.sessions.get(sessionId)
    if (!existing) return
    existing.recentMessages = [...existing.recentMessages, message].slice(-20)
    existing.updatedAt = nowIso()
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId)
  }
}
