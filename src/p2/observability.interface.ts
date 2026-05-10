export interface TraceEvent {
  sessionId: string
  taskId: string
  phase: "planned" | "dispatched" | "completed" | "failed"
  message: string
  createdAt: string
}

export interface ObservabilityPort {
  record(event: TraceEvent): void
  listBySession(sessionId: string): TraceEvent[]
}

export class InMemoryObservabilityPort implements ObservabilityPort {
  private readonly events: TraceEvent[] = []
  record(event: TraceEvent): void { this.events.push(event) }
  listBySession(sessionId: string): TraceEvent[] { return this.events.filter((e) => e.sessionId === sessionId) }
}
