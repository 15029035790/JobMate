import type { JobDescription, ResumeContent } from "../domain/types.ts"
import { type LlmClient, LlmTool } from "./llm.tool.ts"

export interface ResumeScoreDimension {
  name: string
  score: number
  reason: string
}

export interface PrioritizedImprovement {
  priority: "high" | "medium" | "low"
  title: string
  reason: string
  suggestedChange: string
}

export interface ResumeScoreReport {
  totalScore: number
  dimensions: ResumeScoreDimension[]
  prioritizedImprovements: PrioritizedImprovement[]
  unsupportedClaims: string[]
  summary: string
}

export class ResumeScoringTool {
  constructor(private readonly llm: LlmClient = new LlmTool()) {}

  async score(input: { resume: ResumeContent; jd: JobDescription["parsedContent"] }): Promise<ResumeScoreReport> {
    const raw = await this.llm.complete(buildPrompt(input.resume, input.jd), {
      system: "You are JobMate's resume scoring agent. Score honestly against the JD. Return only valid JSON.",
      temperature: 0.2,
      responseFormat: "json_object"
    })

    return enforceTruthfulScoring(normalizeReport(JSON.parse(extractJsonObject(raw))), input.resume, input.jd.keywords)
  }
}

function buildPrompt(resume: ResumeContent, jd: JobDescription["parsedContent"]): string {
  return JSON.stringify({
    task: "Score this resume against the target JD.",
    outputContract: {
      totalScore: "0-100 number",
      dimensions: [{ name: "string", score: "0-100 number", reason: "string" }],
      prioritizedImprovements: [{ priority: "high|medium|low", title: "string", reason: "string", suggestedChange: "string" }],
      unsupportedClaims: "string[]",
      summary: "string"
    },
    scoringDimensions: [
      "JD match",
      "Evidence strength",
      "ATS keywords",
      "Clarity",
      "Truthfulness risk"
    ],
    hardRules: [
      "Do not reward unsupported claims.",
      "Never suggest adding unsupported skills to the resume. Suggest learning, verifying, or adding evidence first.",
      "Prioritize improvements by impact on interview and JD alignment.",
      "Keep reasons concise and actionable.",
      "Return JSON only."
    ],
    jd,
    resume
  })
}

function enforceTruthfulScoring(report: ResumeScoreReport, resume: ResumeContent, keywords: string[]): ResumeScoreReport {
  const evidence = JSON.stringify(resume).toLowerCase()
  const unsupported = keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .filter((keyword) => !hasEvidence(evidence, keyword))
  const unsupportedLower = unsupported.map((keyword) => keyword.toLowerCase())

  const caveat = unsupported.length
    ? ` 缺少证据的 JD 关键词不要直接写入简历：${unsupported.slice(0, 6).join(", ")}。`
    : ""

  return {
    ...report,
    summary: `${report.summary}${caveat}`,
    prioritizedImprovements: report.prioritizedImprovements.map((item) => {
      const text = `${item.title}\n${item.reason}\n${item.suggestedChange}`.toLowerCase()
      const mentionedUnsupported = unsupported.filter((_, index) => text.includes(unsupportedLower[index]))
      const unsafeAdd = /添加|列出|加入|补充|写入|提及|突出|展示|描述|increase|add|list|mention|highlight/.test(item.suggestedChange)
      if (!mentionedUnsupported.length || !unsafeAdd) return item

      return {
        ...item,
        reason: `${item.reason} 这些能力当前缺少可验证简历证据。`,
        suggestedChange: `不要直接写入 ${mentionedUnsupported.slice(0, 5).join(", ")}；先补充可验证项目经历、学习计划或面试材料，确认能证明后再加入简历。`
      }
    }),
    unsupportedClaims: [...new Set([
      ...report.unsupportedClaims,
      ...unsupported.map((keyword) => `Missing verifiable resume evidence for JD keyword: ${keyword}.`)
    ])]
  }
}

function hasEvidence(evidence: string, keyword: string): boolean {
  const normalized = keyword.toLowerCase()
  if (evidence.includes(normalized)) return true
  if (normalized === "ai" || normalized === "aigc") return /ai|aigc|模型|智能|剧本/.test(evidence)
  if (normalized === "渲染") return /渲染|render|动效|lottie|3d/.test(evidence)
  if (normalized === "视频生成") return /视频|剧本|预览|互动作品/.test(evidence)
  return false
}

function normalizeReport(value: any): ResumeScoreReport {
  const dimensions = Array.isArray(value?.dimensions) ? value.dimensions : []
  const improvements = Array.isArray(value?.prioritizedImprovements) ? value.prioritizedImprovements : []
  return {
    totalScore: clampScore(value?.totalScore),
    dimensions: dimensions.map((item: any) => ({
      name: stringOr(item?.name, "Dimension"),
      score: clampScore(item?.score),
      reason: stringOr(item?.reason, "No reason provided.")
    })).slice(0, 6),
    prioritizedImprovements: (improvements.map((item: any): PrioritizedImprovement => ({
      priority: normalizePriority(item?.priority),
      title: stringOr(item?.title, "Resume improvement"),
      reason: stringOr(item?.reason, "Improve alignment with the JD."),
      suggestedChange: stringOr(item?.suggestedChange, "Revise the relevant resume section.")
    })) as PrioritizedImprovement[]).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)).slice(0, 8),
    unsupportedClaims: Array.isArray(value?.unsupportedClaims) ? value.unsupportedClaims.filter((item: unknown): item is string => typeof item === "string") : [],
    summary: stringOr(value?.summary, "Score generated by JobMate.")
  }
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const text = fenced?.[1]?.trim() ?? trimmed
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) throw new Error("LLM score response did not contain a JSON object.")
  return text.slice(start, end + 1)
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function normalizePriority(value: unknown): PrioritizedImprovement["priority"] {
  if (value === "high" || value === "medium" || value === "low") return value
  return "medium"
}

function priorityRank(value: PrioritizedImprovement["priority"]): number {
  if (value === "high") return 0
  if (value === "medium") return 1
  return 2
}
