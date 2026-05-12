import type { ResumeContent } from "../domain/types.ts"

export class ResumeParserTool {
  parse(rawText: string): ResumeContent {
    const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const sectionMap = splitSections(lines)
    const skills = extractSkills(rawText, sectionMap)
    const summary = extractSummary(sectionMap) ?? lines.slice(0, 6).join(" ")
    const experiences = extractExperiences(sectionMap, lines)
    const projects = extractProjects(sectionMap, skills)

    return {
      basics: {
        name: lines[0],
        email: rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0],
        phone: rawText.match(/(?:电话|手机|phone)[:：\s]*([+\d][\d -]{6,})/i)?.[1]?.trim(),
        location: rawText.match(/(?:期望城市|城市|location)[:：\s]*([^\n]+)/i)?.[1]?.trim()
      },
      summary,
      skills,
      experiences,
      projects
    }
  }
}

type SectionName = "summary" | "skills" | "experience" | "projects" | "education" | "other"

const headingPatterns: Array<[SectionName, RegExp]> = [
  ["summary", /^(个人简介|个人总结|summary)$/i],
  ["skills", /^(技能标签|专业技能|技能|skills)$/i],
  ["experience", /^(工作经历|工作经验|experience)$/i],
  ["projects", /^(项目经验|项目经历|projects)$/i],
  ["education", /^(教育背景|教育经历|education)$/i],
  ["other", /^(其他|获奖|荣誉|others)$/i]
]

function splitSections(lines: string[]): Map<SectionName, string[]> {
  const sections = new Map<SectionName, string[]>()
  let current: SectionName | undefined
  for (const line of lines) {
    const heading = headingPatterns.find(([, pattern]) => pattern.test(line))?.[0]
    if (heading) {
      current = heading
      if (!sections.has(current)) sections.set(current, [])
      continue
    }
    if (current) sections.set(current, [...(sections.get(current) ?? []), line])
  }
  return sections
}

function extractSummary(sections: Map<SectionName, string[]>): string | undefined {
  const summary = sections.get("summary")?.filter((line) => !isLikelyHeading(line)).join(" ")
  return summary || undefined
}

function extractSkills(text: string, sections: Map<SectionName, string[]>): ResumeContent["skills"] {
  const skillLines = sections.get("skills") ?? []
  const grouped = skillLines
    .map(parseSkillLine)
    .filter((group): group is { category: string; items: string[] } => Boolean(group))

  const known = extractKnownSkills(text)
  if (!grouped.length) return [{ category: "general", items: known }]

  const existing = new Set(grouped.flatMap((group) => group.items.map(normalizeToken)))
  const supplemental = known.filter((skill) => !existing.has(normalizeToken(skill)))
  return supplemental.length ? [...grouped, { category: "detected_keywords", items: supplemental }] : grouped
}

function parseSkillLine(line: string): { category: string; items: string[] } | undefined {
  const match = line.match(/^([^:：]{2,18})[:：](.+)$/)
  if (!match) return undefined
  const items = splitList(match[2]).filter(Boolean)
  return items.length ? { category: match[1].trim(), items } : undefined
}

function extractExperiences(sections: Map<SectionName, string[]>, allLines: string[]): ResumeContent["experiences"] {
  const lines = sections.get("experience") ?? []
  const experienceHeading = lines.find((line) => /工程师|developer|engineer|manager|经理|负责人/i.test(line))
  const dateLine = lines.find((line) => /\d{4}[./年-]/.test(line))
  const bullets = lines
    .filter((line) => line !== experienceHeading && line !== dateLine)
    .filter((line) => !isLikelyHeading(line))
    .slice(0, 8)

  if (!experienceHeading) {
    return [{
      company: "Parsed Experience",
      title: "Candidate Experience",
      bullets: allLines.slice(0, 6)
    }]
  }

  const [company, title] = splitExperienceHeading(experienceHeading)
  return [{
    company,
    title,
    startDate: dateLine?.match(/\d{4}[./年-]?\d{0,2}/)?.[0],
    endDate: dateLine?.includes("至今") ? "至今" : undefined,
    bullets: bullets.length ? bullets : [experienceHeading]
  }]
}

function extractProjects(sections: Map<SectionName, string[]>, skills: ResumeContent["skills"]): ResumeContent["projects"] {
  const lines = sections.get("projects") ?? []
  const projects: ResumeContent["projects"] = []
  let current: { name: string; description: string; techStack: string[]; bullets: string[] } | undefined

  for (const line of lines) {
    if (/^项目[一二三四五六七八九十\d]+[｜|]/.test(line) || /^项目[:：]/.test(line)) {
      if (current) projects.push(current)
      current = { name: line.replace(/^项目[一二三四五六七八九十\d]+[｜|]\s*/, "").replace(/^项目[:：]\s*/, ""), description: "", techStack: [], bullets: [] }
      continue
    }
    if (!current) continue
    if (!current.description && /^[STARS]｜/.test(line)) current.description = line.replace(/^[STARS]｜/, "")
    else if (!isLikelyHeading(line)) current.bullets.push(line.replace(/^[STARS]｜/, ""))
  }

  if (current) projects.push(current)
  const fallbackTech = skills.flatMap((group) => group.items).slice(0, 8)
  return projects.length
    ? projects.map((project) => ({ ...project, techStack: inferProjectTech(project.bullets.join(" "), fallbackTech), description: project.description || project.bullets[0] || project.name }))
    : [{ name: "Parsed Project Portfolio", description: "", techStack: fallbackTech, bullets: [] }]
}

function extractKnownSkills(text: string): string[] {
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
    "agent",
    "llm",
    "lynx",
    "lottie",
    "figma",
    "d2c",
    "slardar",
    "product",
    "system design",
    "python",
    "sql",
    "性能优化",
    "动效",
    "数据埋点",
    "a/b 测试"
  ]

  const lower = text.toLowerCase()
  const matched = known.filter((skill) => lower.includes(skill))
  return matched.length ? matched : uniqueWords(text).slice(0, 10)
}

function splitExperienceHeading(line: string): [string, string] {
  const parts = line.split(/[・·|-]/).map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) return [parts.slice(0, -1).join("・"), parts.at(-1) ?? "Candidate Experience"]
  return [line, "Candidate Experience"]
}

function inferProjectTech(text: string, fallback: string[]): string[] {
  const detected = extractKnownSkills(text)
  return detected.length ? detected.slice(0, 8) : fallback
}

function splitList(value: string): string[] {
  return value.split(/\s+\/\s+|[、,，]/).map((item) => item.trim()).filter(Boolean)
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim()
}

function isLikelyHeading(line: string): boolean {
  return headingPatterns.some(([, pattern]) => pattern.test(line))
}

function uniqueWords(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/\W+/).filter((word) => word.length > 3))]
}
