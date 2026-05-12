import type { LlmClient, LlmCompleteOptions } from "../src/tools/llm.tool.ts"

export class FakeLlm implements LlmClient {
  async complete(prompt: string, _options: LlmCompleteOptions = {}): Promise<string> {
    const parsed = safeParse(prompt)
    if (parsed?.task === "Optimize the resume for the JD using only evidence already present in sourceResume.") {
      return JSON.stringify(parsed.baselineDraft)
    }
    if (parsed?.task === "Generate one concise opening mock interview question.") {
      return "请结合目标岗位，介绍一个最能体现你技术深度和业务影响的项目。"
    }
    if (parsed?.task === "Generate the next mock interview follow-up question.") {
      return "你具体负责了哪些模块，哪些决策是你推动的？"
    }
    return "测试 LLM 响应"
  }
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
