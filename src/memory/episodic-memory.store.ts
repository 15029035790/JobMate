import type { EpisodicEvent, EpisodicEventType } from "../domain/types.ts"
import { createId, nowIso } from "../utils/id.ts"

export class EpisodicMemoryStore {
  private readonly events: EpisodicEvent[] = []

  record(input: {
    userId: string
    sessionId: string
    eventType: EpisodicEventType
    entityRefs?: EpisodicEvent["entityRefs"]
    payload?: Record<string, unknown>
  }): EpisodicEvent {
    const event: EpisodicEvent = {
      eventId: createId("event"),
      userId: input.userId,
      sessionId: input.sessionId,
      eventType: input.eventType,
      entityRefs: input.entityRefs ?? {},
      payload: input.payload ?? {},
      createdAt: nowIso()
    }
    this.events.push(event)
    return event
  }

  listBySession(sessionId: string): EpisodicEvent[] {
    return this.events.filter((event) => event.sessionId === sessionId)
  }

  listByUser(userId: string): EpisodicEvent[] {
    return this.events.filter((event) => event.userId === userId)
  }
}
