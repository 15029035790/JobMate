import { InMemoryDatabase } from "../db/in-memory-database.ts"
import type { AgentHandler, AgentTaskInput, AgentTaskOutput } from "../harness/agent-task.types.ts"
import type { LearningPlan } from "../domain/types.ts"
import { createId, nowIso } from "../utils/id.ts"

type Payload = { mode: "create"; weaknessProfileId: string; targetRole?: string } | { mode: "save"; learningPlanId: string }

export class LearningPlannerAgent implements AgentHandler<Payload, LearningPlan> {
  readonly agentName = "learning_planner" as const
  private readonly db: InMemoryDatabase
  constructor(db: InMemoryDatabase) { this.db = db }
  async run(task: AgentTaskInput<Payload>): Promise<AgentTaskOutput<LearningPlan>> {
    const startedAt = nowIso()
    if (task.payload.mode === "create") {
      const plan: LearningPlan = { id: createId("plan"), userId: task.userId, weaknessProfileId: task.payload.weaknessProfileId, targetRole: task.payload.targetRole, title: "Interview Improvement Plan", learningMode: "project_based", status: "not_started", goals: ["提升项目深挖表达"], tasks: [{ id: createId("task"), learningPlanId: "tmp", title: "重写项目叙事", description: "将内部项目翻译成通用工程语言", targetWeakness: "ownership narrative", deliverable: "2分钟项目讲述稿", estimatedHours: 2, status: "not_started", createdAt: nowIso(), updatedAt: nowIso() }], createdAt: nowIso(), updatedAt: nowIso() }
      plan.tasks = plan.tasks.map((t) => ({ ...t, learningPlanId: plan.id }))
      this.db.learningPlans.set(plan.id, plan)
      return ok(task, startedAt, plan)
    }
    const plan = this.db.learningPlans.get(task.payload.learningPlanId)
    if (!plan) return fail(task, startedAt, "PLAN_NOT_FOUND", "Learning plan not found")
    plan.status = "in_progress"; plan.updatedAt = nowIso()
    return ok(task, startedAt, plan)
  }
}
const ok=(task:AgentTaskInput<Payload>,startedAt:string,result:LearningPlan):AgentTaskOutput<LearningPlan>=>({taskId:task.taskId,agentName:"learning_planner",status:"success",result,statePatch:{currentLearningPlanId:result.id,activeNode:"learning_planning"},trace:{startedAt,endedAt:nowIso(),toolCalls:[],reasoningSummary:"Processed learning plan flow."}})
const fail=(task:AgentTaskInput<Payload>,startedAt:string,code:string,message:string):AgentTaskOutput<LearningPlan>=>({taskId:task.taskId,agentName:"learning_planner",status:"failed",trace:{startedAt,endedAt:nowIso(),toolCalls:[],reasoningSummary:message},error:{code,message,recoverable:true}})
