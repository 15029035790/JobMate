import type { ActionRecommendation } from "../state/session-state.types.ts"

export function recommendation(
  action: ActionRecommendation["action"],
  label: string,
  reason: string,
  requiredEntities: string[] = []
): ActionRecommendation {
  return { action, label, reason, requiredEntities }
}

export function actionsOf(recommendations: ActionRecommendation[]): ActionRecommendation["action"][] {
  return recommendations.map((item) => item.action)
}
