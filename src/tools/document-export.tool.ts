import type { ResumeContent } from "../domain/types.ts"

export class DocumentExportTool {
  toPlainText(content: ResumeContent): string {
    const skills = content.skills.map((group) => `${group.category}: ${group.items.join(", ")}`).join("\n")
    const projects = content.projects
      .map((project) => `${project.name}\n${project.description}\n${project.bullets.map((bullet) => `- ${bullet}`).join("\n")}`)
      .join("\n\n")
    return [content.basics.name, content.summary, skills, projects].filter(Boolean).join("\n\n")
  }
}
