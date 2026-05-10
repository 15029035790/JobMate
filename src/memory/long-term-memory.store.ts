export interface LongTermMemoryEntry {
  id: string
  userId: string
  entityType: string
  entityId: string
  payload: Record<string, unknown>
  createdAt: string
}

export class LongTermMemoryStore {
  private readonly entries: LongTermMemoryEntry[] = []

  add(entry: LongTermMemoryEntry): void {
    this.entries.push(entry)
  }

  listByUser(userId: string): LongTermMemoryEntry[] {
    return this.entries.filter((entry) => entry.userId === userId)
  }

  findByEntity(entityType: string, entityId: string): LongTermMemoryEntry | undefined {
    return this.entries.find((entry) => entry.entityType === entityType && entry.entityId === entityId)
  }
}
