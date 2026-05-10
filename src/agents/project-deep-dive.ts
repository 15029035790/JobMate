import type { FollowUpStrategy, ProjectAnswerEvaluation } from "../domain/types.ts"

export type QuestionKind = "general" | "project_deep_dive"

export function evaluateGeneralAnswer(answer: string) {
  const clarity = answer.length > 80 ? 7 : 4
  return { correctness: 6, completeness: 6, clarity, edgeCases: answer.includes("edge") ? 7 : 4, misconceptions: answer.includes("always") ? 3 : 6 }
}

export function evaluateProjectAnswer(question: string, answer: string): ProjectAnswerEvaluation {
  const jargon = (answer.match(/[A-Z]{2,}|内部|平台|中台|链路|基建/g) ?? []).length
  const hasOwnership = /我负责|I led|I owned|I implemented|我实现/.test(answer)
  const hasMetric = /%|ms|qps|latency|指标|吞吐/.test(answer)
  const hasTradeoff = /tradeoff|权衡|代价|why not|为什么不用/.test(answer)
  const hasLimitation = /限制|技术债|失败|风险|drawback/.test(answer)
  const unverifiableClaims = hasMetric ? ["包含内部指标或规模描述，外部无法独立验证真实性。"] : []
  const interviewerComprehensionScore = Math.max(1, 9 - jargon)
  const ownershipBoundaryScore = hasOwnership ? 7 : 3
  const technicalDepthScore = /架构|architecture|cache|queue|db|一致性/.test(answer) ? 7 : 4
  const evidenceQualityScore = hasMetric ? 6 : 3
  const riskSignals = [] as string[]
  if (interviewerComprehensionScore <= 4) riskSignals.push("内部黑话过多，外部面试官可能难以理解。")
  const weakSignals = [] as string[]
  if (!hasOwnership) weakSignals.push("个人贡献边界不清晰。")
  if (!hasMetric) weakSignals.push("缺少可解释的验证指标或验证方式。")
  const avg = (ownershipBoundaryScore + technicalDepthScore + evidenceQualityScore + interviewerComprehensionScore) / 4
  const overallSignal = avg >= 7 ? "strong" : avg >= 5 ? "mixed" : avg >= 3.5 ? "weak" : "risk"

  return {
    contextClarityScore: /因为|背景|痛点|影响/.test(answer) ? 7 : 4,
    problemFramingScore: /抽象|通用|问题/.test(answer) ? 7 : 4,
    ownershipBoundaryScore,
    technicalDepthScore,
    tradeoffReasoningScore: hasTradeoff ? 7 : 4,
    evidenceQualityScore,
    limitationAwarenessScore: hasLimitation ? 7 : 3,
    communicationScore: answer.length > 120 ? 7 : 5,
    consistencyScore: /但是|however/.test(answer) ? 6 : 7,
    interviewerComprehensionScore,
    roleAlignmentScore: /系统|性能|稳定性|业务/.test(question + answer) ? 7 : 5,
    overallSignal,
    unverifiableClaims,
    suggestedFollowUps: buildFollowUps({ ownershipBoundaryScore, technicalDepthScore, evidenceQualityScore, limitationAwarenessScore: hasLimitation ? 7 : 3, interviewerComprehensionScore }),
    improvementAdvice: ["先将内部系统翻译为通用工程问题，再讲具体实现。", "明确你个人负责模块与团队边界。", "给出指标口径和采集方式，并说明限制条件。"],
    strongSignals: [hasOwnership ? "能够描述个人贡献。" : "", hasTradeoff ? "能解释技术取舍。" : ""].filter(Boolean),
    weakSignals,
    riskSignals,
    requiresUserConfirmationBeforeLongTermMemory: true,
    canWriteToEpisodicMemory: true
  }
}

export function nextFollowUpStrategy(e: ProjectAnswerEvaluation): FollowUpStrategy {
  if (e.ownershipBoundaryScore < 5) return "probe_ownership"
  if (e.interviewerComprehensionScore < 5) return "clarify_context"
  if (e.technicalDepthScore < 5) return "probe_architecture"
  if (e.tradeoffReasoningScore < 5) return "probe_tradeoffs"
  if (e.evidenceQualityScore < 5) return "probe_metrics"
  if (e.limitationAwarenessScore < 5) return "probe_failure_cases"
  return "move_to_next_topic"
}

function buildFollowUps(s: { ownershipBoundaryScore: number; technicalDepthScore: number; evidenceQualityScore: number; limitationAwarenessScore: number; interviewerComprehensionScore: number }): string[] {
  const f: string[] = []
  if (s.ownershipBoundaryScore < 5) f.push("你具体负责了哪些模块？哪些决策是你推动的？")
  if (s.technicalDepthScore < 5) f.push("请画出核心架构和你改动的关键路径。")
  if (s.evidenceQualityScore < 5) f.push("这个指标是如何采集、对比、验证的？")
  if (s.limitationAwarenessScore < 5) f.push("这个方案的限制和技术债是什么？")
  if (s.interviewerComprehensionScore < 5) f.push("请用外部工程师可理解的语言解释内部术语。")
  return f.length ? f : ["如果重做一次，你会如何优化该方案？"]
}

export function projectQuestion(strategy: FollowUpStrategy | "general"): string {
  const map: Record<string, string> = {
    general: "请简要介绍一个你最有代表性的项目，并说明业务影响。",
    clarify_context: "先不用内部术语，用通用工程语言说明项目背景和核心痛点。",
    probe_ownership: "你在这个项目中具体负责哪几块？哪些不是你主导的？",
    probe_architecture: "核心架构是什么？你主要改了哪一层，为什么？",
    probe_tradeoffs: "你们评估过哪些替代方案？为什么最终没选？",
    probe_metrics: "上线后用哪些指标验证有效？指标口径和采集方式是什么？",
    probe_failure_cases: "这个方案的限制、失败经验和技术债分别是什么？",
    move_to_next_topic: "我们切换到下一个题目：说一个你处理高压协作冲突的例子。"
  }
  return map[strategy]
}
