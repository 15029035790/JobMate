export class JdParserTool {
  parse(rawText: string): {
    title: string
    responsibilities: string[]
    requiredSkills: string[]
    preferredSkills: string[]
    seniority?: string
    domain?: string
    keywords: string[]
  } {
    const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const title = inferTitle(lines, rawText)
    const keywords = extractKeywords(rawText)
    const requiredSkills = keywords.filter((keyword) => isLikelySkill(keyword))

    return {
      title,
      responsibilities: lines.filter((line) => /responsib|own|build|lead|drive|负责|建设|推进/i.test(line)).slice(0, 8),
      requiredSkills,
      preferredSkills: keywords.filter((keyword) => !requiredSkills.includes(keyword)).slice(0, 8),
      seniority: /senior|lead|principal|高级|资深/i.test(rawText) ? "senior" : undefined,
      domain: /ai|llm|agent|machine learning|人工智能/i.test(rawText) ? "AI" : undefined,
      keywords
    }
  }
}

function inferTitle(lines: string[], rawText: string): string {
  const titleLine = lines.find((line) => /engineer|manager|developer|designer|product|pm|工程师|经理|产品/i.test(line))
  return titleLine?.slice(0, 80) ?? (rawText.slice(0, 60) || "Untitled Job")
}

function extractKeywords(text: string): string[] {
  const known = [
    "typescript",
    "javascript",
    "react",
    "next.js",
    "node.js",
    "postgres",
    "prisma",
    "ai",
    "agent",
    "llm",
    "product",
    "system design",
    "interview",
    "analytics",
    "sql",
    "python",
    "communication",
    "leadership"
  ]
  const lower = text.toLowerCase()
  const matched = known.filter((keyword) => lower.includes(keyword))
  return matched.length ? matched : [...new Set(lower.split(/\W+/).filter((word) => word.length > 4))].slice(0, 12)
}

function isLikelySkill(keyword: string): boolean {
  return !["product", "interview", "communication", "leadership"].includes(keyword)
}
