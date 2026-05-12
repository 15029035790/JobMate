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
    const requiredSkills = extractRequiredSkills(rawText, keywords)
    const preferredSkills = extractPreferredSkills(rawText, keywords, requiredSkills)

    return {
      title,
      responsibilities: extractResponsibilities(lines),
      requiredSkills,
      preferredSkills,
      seniority: /senior|lead|principal|高级|资深/i.test(rawText) ? "senior" : undefined,
      domain: /ai|llm|agent|machine learning|人工智能|aigc|多模态|视频生成/i.test(rawText) ? "AI" : undefined,
      keywords
    }
  }
}

function inferTitle(lines: string[], rawText: string): string {
  const tableTitle = rawText.match(/\|\s*岗位名称\s*\|\s*([^|]+)\|/)?.[1]?.trim()
  if (tableTitle) return tableTitle
  const headingTitle = lines.find((line) => /^#\s+.+(工程师|开发|产品|engineer|developer|manager)/i.test(line))
  if (headingTitle) return headingTitle.replace(/^#+\s*/, "").slice(0, 80)
  const titleLine = lines.find((line) => /engineer|manager|developer|designer|product|pm|工程师|经理|产品/i.test(line))
  return titleLine?.replace(/^[-*\d.、\s]+/, "").slice(0, 80) ?? (rawText.slice(0, 60) || "Untitled Job")
}

function extractKeywords(text: string): string[] {
  const known = [
    "typescript",
    "javascript",
    "react",
    "vue",
    "next.js",
    "node.js",
    "golang",
    "postgres",
    "prisma",
    "ai",
    "aigc",
    "多模态",
    "视频编码",
    "视频生成",
    "渲染",
    "流处理",
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
  const matched = known.filter((keyword) => lower.includes(keyword.toLowerCase()))
  const tagKeywords = [...text.matchAll(/`([^`]+)`/g)]
    .flatMap((match) => match[1].split(/[、,，]/))
    .map((item) => normalizeKeyword(item))
    .filter(isRelevantKeyword)
  const fallback = [...new Set(lower.split(/\W+/).filter((word) => word.length > 4))].slice(0, 12)
  return unique([...tagKeywords, ...matched.map(normalizeKeyword), ...(matched.length || tagKeywords.length ? [] : fallback)])
}

function extractRequiredSkills(rawText: string, keywords: string[]): string[] {
  const requiredSection = sliceBetween(rawText, /任职要求|技术能力|要求/i, /关键特质|团队协作|加分|优先|---/i)
  const skillLike = keywords.filter(isLikelySkill)
  const explicit = skillLike.filter((keyword) => requiredSection.toLowerCase().includes(keyword.toLowerCase()))
  return unique(explicit.length ? explicit : skillLike)
}

function extractPreferredSkills(rawText: string, keywords: string[], requiredSkills: string[]): string[] {
  const preferredSection = sliceBetween(rawText, /优先|加分|preferred/i, /团队协作|职责|---/i)
  const required = new Set(requiredSkills)
  return unique(keywords.filter((keyword) => !required.has(keyword) || preferredSection.toLowerCase().includes(keyword.toLowerCase()))).slice(0, 8)
}

function extractResponsibilities(lines: string[]): string[] {
  return lines
    .filter((line) => /responsib|own|build|lead|drive|负责|构建|设计|实现|推进|转化|优化/i.test(line))
    .map((line) => line.replace(/^[-*\d.、\s]+/, ""))
    .slice(0, 8)
}

function isLikelySkill(keyword: string): boolean {
  return !["product", "interview", "communication", "leadership", "全栈项目经验", "计算机相关专业"].includes(keyword)
}

function isRelevantKeyword(keyword: string): boolean {
  return !["全栈无侧重", "计算机相关专业", "全栈项目经验"].includes(keyword)
}

function sliceBetween(text: string, start: RegExp, end: RegExp): string {
  const startMatch = text.match(start)
  if (!startMatch || startMatch.index === undefined) return text
  const rest = text.slice(startMatch.index)
  const endMatch = rest.slice(startMatch[0].length).match(end)
  return endMatch?.index === undefined ? rest : rest.slice(0, startMatch[0].length + endMatch.index)
}

function normalizeKeyword(keyword: string): string {
  return keyword.trim().replace(/\s+/g, " ").toLowerCase()
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}
