import { InMemoryDatabase } from "../db/in-memory-database.ts"
import type { WeaknessProfile } from "../domain/types.ts"

export class WeaknessProfileRepository {
  private readonly db: InMemoryDatabase
  constructor(db: InMemoryDatabase) { this.db = db }

  get(profileId: string): WeaknessProfile | undefined {
    return this.db.weaknessProfiles.get(profileId)
  }

  save(profile: WeaknessProfile): void {
    this.db.weaknessProfiles.set(profile.id, profile)
  }
}
