import { InMemoryDatabase } from "../db/in-memory-database.ts"
import type { WeaknessProfile } from "../domain/types.ts"
import type { AgentHandler, AgentTaskInput, AgentTaskOutput, MemoryWriteRequest } from "../harness/agent-task.types.ts"
import { createId, nowIso } from "../utils/id.ts"

type Payload = { mode: "diagnose"; reviewId: string } | { mode: "confirm"; weaknessProfileId: string }

export class WeaknessDiagnosisAgent implements AgentHandler<Payload, WeaknessProfile> {
  readonly agentName = "weakness_diagnosis" as const
  private readonly db: InMemoryDatabase
  constructor(db: InMemoryDatabase) { this.db = db }
  async run(task: AgentTaskInput<Payload>): Promise<AgentTaskOutput<WeaknessProfile>> {
    const startedAt = nowIso()
    if (task.payload.mode === "diagnose") {
      const p: WeaknessProfile = { id: createId("weakness"), userId: task.userId, sourceReviewIds: [task.payload.reviewId], scope: "single_interview", weaknesses: [{ skillArea: "ownership narrative", description: "贡献边界描述不足", evidence: ["review_draft"], severity: "medium", confidence: 0.7, confirmedByUser: false }], priorityRanking: ["ownership narrative"], status: "draft", createdAt: nowIso(), updatedAt: nowIso() }
      this.db.weaknessProfiles.set(p.id, p)
      return success(task, startedAt, p)
    }
    const p = this.db.weaknessProfiles.get(task.payload.weaknessProfileId)
    if (!p) return failed(task, startedAt, "WEAKNESS_NOT_FOUND", "Weakness profile not found")
    p.weaknesses = p.weaknesses.map((w) => ({ ...w, confirmedByUser: true })); p.status = "confirmed"; p.updatedAt = nowIso()
    const mem: MemoryWriteRequest[] = [{ memoryType: "long_term", entityType: "weakness_profile", entityId: p.id, payload: { weaknesses: p.weaknesses, confirmedByUser: true }, requiresUserConfirmation: false }]
    return { ...success(task, startedAt, p), memoryWriteRequests: mem }
  }
}
const success=(task:AgentTaskInput<Payload>,startedAt:string,result:WeaknessProfile):AgentTaskOutput<WeaknessProfile>=>({taskId:task.taskId,agentName:"weakness_diagnosis",status:"success",result,statePatch:{currentWeaknessProfileId:result.id,activeNode:"weakness_diagnosis"},trace:{startedAt,endedAt:nowIso(),toolCalls:[],reasoningSummary:"Processed weakness diagnosis."}})
const failed=(task:AgentTaskInput<Payload>,startedAt:string,code:string,message:string):AgentTaskOutput<WeaknessProfile>=>({taskId:task.taskId,agentName:"weakness_diagnosis",status:"failed",trace:{startedAt,endedAt:nowIso(),toolCalls:[],reasoningSummary:message},error:{code,message,recoverable:true}})
