import type { ResumeContent } from "../domain/types.ts"

export class ResumeParserTool {
  parse(rawText: string): ResumeContent {
    const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const skills = extractSkillTokens(rawText)

    return {
      basics: {
        name: lines[0],
        email: rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
      },
      summary: lines.slice(0, 3).join(" "),
      skills: [{ category: "general", items: skills }],
      experiences: [
        {
          company: "Parsed Experience",
          title: "Candidate Experience",
          bullets: lines.slice(0, 6)
        }
      ],
      projects: [
        {
          name: "Parsed Project Portfolio",
          description: lines.slice(0, 4).join(" "),
          techStack: skills.slice(0, 8),
          bullets: lines.slice(0, 5)
        }
      ]
    }
  }
}

function extractSkillTokens(text: string): string[] {
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
    "python",
    "sql"
  ]

  const lower = text.toLowerCase()
  const matched = known.filter((skill) => lower.includes(skill))
  return matched.length ? matched : uniqueWords(text).slice(0, 10)
}

function uniqueWords(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/\W+/).filter((word) => word.length > 3))]
}
