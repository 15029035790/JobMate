import test from "node:test"
import assert from "node:assert/strict"
import { InMemoryDatabase } from "../src/db/in-memory-database.ts"
import { ResumeVersionOptimizationAgent } from "../src/agents/resume-version-optimization.agent.ts"
import { JdParserTool } from "../src/tools/jd-parser.tool.ts"
import { ResumeParserTool } from "../src/tools/resume-parser.tool.ts"
import { FakeLlm } from "./fake-llm.ts"

const resumeText = `汤子文
电话： 15029035790
邮箱： 15029035790@163.com
期望城市：上海/杭州
个人简介
5 年 C 端前端开发经验，专注 React、TypeScript、Lynx、AI 剧本生产平台。
技能标签
核心框架：React 18 + Hooks、TypeScript、Jotai
跨端技术：Lynx 跨端开发
工程提效：Figma D2C 微插件、CI Action
工作经历
字节跳动・抖音直播营收 - 用户付费・高级前端开发工程师
2021.06 — 至今
负责抖音直播营收核心业务前端架构与开发。
项目经验
项目一｜千万级 DAU 营收业务系统性性能优化
S｜背景神秘商店是抖音直播营收核心业务。
A｜行动重构 React 组件结构，接入 Slardar 监控。
R｜结果Android TFMP 75 分位 2630ms → 1340ms。
项目二｜AI 剧本生产 B 端平台建设
A｜行动搭建剧本管理平台，实现剧本预览流的实时渲染能力。`

const jdText = `# AI产品全栈开发工程师 JD 总结
| 岗位名称 | AI产品全栈开发工程师 |
## 二、核心标签
\`Golang\`、\`多模态\`、\`Vue\`、\`AIGC\`、\`React\`、\`Python\`
## 四、任职要求
- 精通至少一种前端框架（React/Vue等）与一种后端语言（Python/Golang等）开发；
- 了解视频编码、渲染、流处理等技术，有AI应用开发经验优先。`

test("resume parser extracts structured Chinese resume sections", () => {
  const parsed = new ResumeParserTool().parse(resumeText)
  assert.equal(parsed.basics.name, "汤子文")
  assert.equal(parsed.basics.email, "15029035790@163.com")
  assert.ok(parsed.skills.some((group) => group.category === "核心框架" && group.items.some((item) => item.toLowerCase().includes("react"))))
  assert.ok(parsed.projects.length >= 2)
  assert.ok(parsed.projects[0].name.includes("性能优化"))
})

test("jd parser keeps concrete AI full-stack skill requirements", () => {
  const parsed = new JdParserTool().parse(jdText)
  assert.equal(parsed.title, "AI产品全栈开发工程师")
  assert.ok(parsed.requiredSkills.includes("react"))
  assert.ok(parsed.requiredSkills.includes("python"))
  assert.ok(parsed.requiredSkills.includes("golang"))
  assert.ok(parsed.keywords.includes("多模态"))
})

test("resume optimization does not claim unsupported JD skills", async () => {
  const db = new InMemoryDatabase()
  const resume = new ResumeParserTool().parse(resumeText)
  const jd = new JdParserTool().parse(jdText)
  db.baseResumes.set("base1", { id: "base1", userId: "u1", title: "base", rawText: resumeText, parsedContent: resume, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  db.jobDescriptions.set("jd1", { id: "jd1", userId: "u1", title: jd.title, rawText: jdText, parsedContent: jd, tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })

  const agent = new ResumeVersionOptimizationAgent(db, new FakeLlm())
  const out = await agent.run({ taskId: "t1", userId: "u1", sessionId: "s1", agentName: "resume_version_optimization", taskType: "optimize_resume_version", payload: { mode: "optimize", sourceResumeId: "base1", sourceType: "base_resume", jdId: "jd1" }, context: {}, memoryRefs: {}, trace: { createdAt: new Date().toISOString(), source: "user" } })
  const content = out.result?.optimizedResumeContent
  assert.ok(content)
  const optimizedSkills = content.skills.flatMap((group) => group.items.map((item) => item.toLowerCase()))
  assert.ok(!optimizedSkills.includes("python"))
  assert.ok(!optimizedSkills.includes("golang"))
  assert.ok(out.result?.riskWarnings?.some((warning) => warning.includes("python")))
})
