import { InMemoryDatabase } from "../db/in-memory-database.ts"
import type { ResumeVersion } from "../domain/types.ts"

export class ResumeVersionRepository {
  private readonly db: InMemoryDatabase
  constructor(db: InMemoryDatabase) { this.db = db }

  get(versionId: string): ResumeVersion | undefined {
    return this.db.resumeVersions.get(versionId)
  }

  save(version: ResumeVersion): void {
    this.db.resumeVersions.set(version.id, version)
  }

  listByUser(userId: string): ResumeVersion[] {
    return [...this.db.resumeVersions.values()].filter((v) => v.userId === userId)
  }
}
