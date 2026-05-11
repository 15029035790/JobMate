import type { AgentName } from "../domain/types.ts"

const taskTypeToAgent = new Map<string, AgentName>([
  ["match_resume_jd", "resume_jd_matching"],
  ["optimize_resume_version", "resume_version_optimization"],
  ["save_resume_version", "resume_version_optimization"],
  ["archive_resume_version", "resume_version_optimization"],
  ["start_mock_interview", "mock_interview"],
  ["answer_interview_question", "mock_interview"],
  ["pause_mock_interview", "mock_interview"],
  ["resume_mock_interview", "mock_interview"],
  ["finish_mock_interview", "mock_interview"],
  ["create_review_draft", "interview_review_negotiation"],
  ["correct_review", "interview_review_negotiation"],
  ["confirm_review", "interview_review_negotiation"],
  ["reject_review", "interview_review_negotiation"],
  ["diagnose_weakness", "weakness_diagnosis"],
  ["confirm_weakness", "weakness_diagnosis"],
  ["create_learning_plan", "learning_planner"],
  ["save_learning_plan", "learning_planner"],
  ["pause_learning_plan", "learning_planner"],
  ["resume_learning_plan", "learning_planner"]
])

export class TaskRouter {
  route(taskType: string): AgentName | undefined {
    return taskTypeToAgent.get(taskType)
  }
}
