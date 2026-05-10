import type { ResumeContent } from "../domain/types.ts"

export interface ResumeFieldDiff {
  section: "summary" | "skills" | "projects"
  changeType: "added" | "removed" | "modified"
  detail: string
}

export class VersionDiffTool {
  summarize(before: ResumeContent, after: ResumeContent): string[] {
    const changes = this.detailedDiff(before, after)
    if (!changes.length) return ["Created a JD-specific copy while preserving the source resume."]
    return changes.map((c) => `${c.section}: ${c.detail}`)
  }

  detailedDiff(before: ResumeContent, after: ResumeContent): ResumeFieldDiff[] {
    const changes: ResumeFieldDiff[] = []
    if ((before.summary ?? "") !== (after.summary ?? "")) {
      changes.push({ section: "summary", changeType: "modified", detail: "Updated resume summary for target role alignment." })
    }

    const beforeSkills = new Set(before.skills.flatMap((group) => group.items))
    const afterSkills = new Set(after.skills.flatMap((group) => group.items))
    for (const skill of afterSkills) if (!beforeSkills.has(skill)) changes.push({ section: "skills", changeType: "added", detail: `Added skill keyword: ${skill}.` })
    for (const skill of beforeSkills) if (!afterSkills.has(skill)) changes.push({ section: "skills", changeType: "removed", detail: `Removed skill keyword: ${skill}.` })

    const beforeProjectBullets = before.projects.flatMap((p) => p.bullets)
    const afterProjectBullets = after.projects.flatMap((p) => p.bullets)
    const addedBullets = afterProjectBullets.filter((b) => !beforeProjectBullets.includes(b))
    const removedBullets = beforeProjectBullets.filter((b) => !afterProjectBullets.includes(b))
    if (addedBullets.length || removedBullets.length) {
      changes.push({ section: "projects", changeType: "modified", detail: `Project bullets changed (+${addedBullets.length}/-${removedBullets.length}).` })
    }

    return changes
  }
}
