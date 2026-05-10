export interface SessionReport {
  sessionId: string
  completedTasks: number
  failedTasks: number
  pendingConfirmations: number
}

export interface ReportingPort {
  buildSessionReport(sessionId: string): SessionReport
}

export class PlaceholderReportingPort implements ReportingPort {
  buildSessionReport(sessionId: string): SessionReport {
    // TODO(P2): replace placeholder with persisted aggregation from repositories.
    return { sessionId, completedTasks: 0, failedTasks: 0, pendingConfirmations: 0 }
  }
}
