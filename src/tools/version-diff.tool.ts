import type { ResumeContent } from "../domain/types.ts"

export class VersionDiffTool {
  summarize(before: ResumeContent, after: ResumeContent): string[] {
    const changes: string[] = []
    if ((before.summary ?? "") !== (after.summary ?? "")) {
      changes.push("Updated resume summary for target role alignment.")
    }

    const beforeSkills = new Set(before.skills.flatMap((group) => group.items))
    const afterSkills = new Set(after.skills.flatMap((group) => group.items))
    const addedSkills = [...afterSkills].filter((skill) => !beforeSkills.has(skill))
    if (addedSkills.length) {
      changes.push(`Added or emphasized skills: ${addedSkills.slice(0, 6).join(", ")}.`)
    }

    if (JSON.stringify(before.projects) !== JSON.stringify(after.projects)) {
      changes.push("Reframed project bullets with stronger JD-facing evidence.")
    }

    return changes.length ? changes : ["Created a JD-specific copy while preserving the source resume."]
  }
}
