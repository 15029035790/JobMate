import { InMemoryDatabase } from "../db/in-memory-database.ts"
import type { LearningPlan } from "../domain/types.ts"

export class LearningPlanRepository {
  private readonly db: InMemoryDatabase
  constructor(db: InMemoryDatabase) { this.db = db }

  get(planId: string): LearningPlan | undefined {
    return this.db.learningPlans.get(planId)
  }

  save(plan: LearningPlan): void {
    this.db.learningPlans.set(plan.id, plan)
  }
}
