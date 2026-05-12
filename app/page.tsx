"use client"

import { AnimatePresence, motion } from "motion/react"
import {
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  FileText,
  Gauge,
  Layers3,
  Loader2,
  MessageSquare,
  Save,
  Send,
  Sparkles,
  Target,
  WandSparkles
} from "lucide-react"
import { FormEvent, useEffect, useMemo, useState } from "react"

type Priority = "high" | "medium" | "low"

interface ResumeContent {
  basics: { name?: string; email?: string; phone?: string; location?: string; links?: string[] }
  summary?: string
  skills: Array<{ category: string; items: string[] }>
  experiences: Array<{ company: string; title: string; startDate?: string; endDate?: string; bullets: string[] }>
  projects: Array<{ name: string; description: string; techStack: string[]; bullets: string[] }>
  education?: Array<{ school: string; degree: string; startDate?: string; endDate?: string }>
}

interface ScoreReport {
  totalScore: number
  summary: string
  dimensions: Array<{ name: string; score: number; reason: string }>
  prioritizedImprovements: Array<{ priority: Priority; title: string; reason: string; suggestedChange: string }>
  unsupportedClaims: string[]
}

interface VersionView {
  id: string
  label: string
  status: string
  createdAt: string
  content: ResumeContent
  changeSummary: string[]
  jdAlignmentNotes: string[]
  riskWarnings: string[]
  score?: ScoreReport
}

interface WorkbenchState {
  resume: { title: string; rawText: string }
  jd: {
    title: string
    rawText: string
    parsedContent: { responsibilities: string[]; requiredSkills: string[]; preferredSkills: string[]; keywords: string[] }
  }
  selectedVersionId: string
  versions: VersionView[]
  messages: Array<{ role: "assistant" | "user"; content: string; createdAt: string }>
  traceEvents: Array<{ phase: string; message: string; createdAt: string }>
}

const priorityLabel: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low"
}

export default function Page() {
  const [data, setData] = useState<WorkbenchState | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>("boot")
  const [chat, setChat] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchState()
  }, [])

  const selected = useMemo(() => {
    return data?.versions.find((version) => version.id === data.selectedVersionId) ?? data?.versions[0]
  }, [data])

  async function fetchState() {
    setLoadingAction("boot")
    setError(null)
    try {
      const res = await fetch("/api/workbench", { cache: "no-store" })
      const next = await res.json()
      setData(next)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingAction(null)
    }
  }

  async function runAction(action: string, payload: Record<string, unknown> = {}) {
    setLoadingAction(action)
    setError(null)
    try {
      const res = await fetch("/api/workbench", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload })
      })
      const next = await res.json()
      if (!res.ok) {
        setData(next.state ?? data)
        throw new Error(next.error ?? "Action failed")
      }
      setData(next)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingAction(null)
    }
  }

  async function submitChat(event: FormEvent) {
    event.preventDefault()
    const content = chat.trim()
    if (!content) return
    setChat("")
    await runAction("chat", { content })
  }

  if (!data || !selected) {
    return (
      <main className="grid h-screen place-items-center">
        <div className="panel flex items-center gap-3 px-5 py-4 text-sm text-[var(--fg-muted)]">
          <Loader2 className="size-4 animate-spin" />
          Loading JobMate workspace
        </div>
      </main>
    )
  }

  const score = selected.score

  return (
    <main className="app-shell">
      <aside className="panel flex flex-col">
        <HeaderBlock data={data} selected={selected} />
        <div className="panel-scroll flex-1 space-y-4 p-4">
          <ContextCard title="Current Resume" icon={<FileText className="size-4" />}>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--fg)]">{selected.content.basics.name ?? data.resume.title}</p>
              <p className="text-xs text-[var(--fg-muted)]">{selected.content.basics.email ?? "No email parsed"}</p>
              <div className="flex flex-wrap gap-2">
                <span className="chip"><Layers3 className="size-3" />{data.versions.length} versions</span>
                <span className="chip"><Save className="size-3" />{selected.status}</span>
              </div>
            </div>
          </ContextCard>

          <ContextCard title="Target JD" icon={<BriefcaseBusiness className="size-4" />}>
            <p className="text-sm font-semibold text-[var(--fg)]">{data.jd.title}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.jd.parsedContent.keywords.slice(0, 10).map((keyword) => (
                <span className="chip" key={keyword}>{keyword}</span>
              ))}
            </div>
          </ContextCard>

          <ContextCard title="Version Stack" icon={<Layers3 className="size-4" />}>
            <div className="space-y-2">
              {data.versions.map((version) => (
                <button
                  className={`flex w-full items-center justify-between rounded-[var(--r)] px-3 py-2 text-left transition ${version.id === selected.id ? "bg-[var(--fg)] text-white" : "bg-white/55 text-[var(--fg)] hover:bg-[var(--surface-up)]"}`}
                  key={version.id}
                  onClick={() => runAction("selectVersion", { versionId: version.id })}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="grid size-7 place-items-center rounded-[var(--r-sm)] bg-[oklch(91%_0.03_185_/_45%)] text-xs">{version.label}</span>
                    {version.status}
                  </span>
                  <ChevronRight className="size-4 opacity-70" />
                </button>
              ))}
            </div>
          </ContextCard>
        </div>
      </aside>

      <section className="panel flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">JobMate Copilot</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--fg)]">Resume Optimization Workspace</h1>
          </div>
          <div className="flex gap-2">
            <ActionButton busy={loadingAction === "score"} icon={<Gauge className="size-4" />} onClick={() => runAction("score", { versionId: selected.id })}>
              Score
            </ActionButton>
            <ActionButton busy={loadingAction === "optimize"} primary icon={<WandSparkles className="size-4" />} onClick={() => runAction("optimize")}>
              Optimize
            </ActionButton>
          </div>
        </div>

        {error && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-4 rounded-[var(--r)] border border-[oklch(76%_0.1_25)] bg-[oklch(97%_0.03_25)] px-4 py-3 text-sm text-[var(--err)]"
            initial={{ opacity: 0, y: -6 }}
          >
            {error}
          </motion.div>
        )}

        <div className="panel-scroll flex-1 p-4">
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
              exit={{ opacity: 0, y: -8 }}
              initial={{ opacity: 0, y: 8 }}
              key={selected.id}
              transition={{ duration: 0.24 }}
            >
              <ResumeHero version={selected} score={score} />
              <ResumeContentView content={selected.content} />
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <aside className="panel flex flex-col">
        <div className="border-b border-[var(--border)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--plum)]">Analysis</p>
              <h2 className="mt-1 text-lg font-semibold">Score & Next Moves</h2>
            </div>
            <Target className="size-5 text-[var(--primary)]" />
          </div>
        </div>

        <div className="panel-scroll flex-1 space-y-4 p-4">
          <ScorePanel score={score} />
          <ImprovementPanel score={score} version={selected} />
          <ChatPanel
            chat={chat}
            loading={loadingAction === "chat" || loadingAction === "startInterview"}
            messages={data.messages}
            onChatChange={setChat}
            onInterview={() => runAction("startInterview")}
            onSubmit={submitChat}
          />
        </div>
      </aside>
    </main>
  )
}

function HeaderBlock({ data, selected }: { data: WorkbenchState; selected: VersionView }) {
  return (
    <div className="border-b border-[var(--border)] p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[var(--r-lg)] bg-[var(--fg)] text-white shadow-[var(--shadow-soft)]">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">JobMate</p>
          <p className="truncate text-xs text-[var(--fg-muted)]">{data.jd.title} · {selected.label}</p>
        </div>
      </div>
    </div>
  )
}

function ContextCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="resume-section p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--fg-muted)]">
        {icon}
        {title}
      </div>
      {children}
    </section>
  )
}

function ResumeHero({ version, score }: { version: VersionView; score?: ScoreReport }) {
  return (
    <section className="resume-section overflow-hidden p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="chip">{version.label}</span>
            <span className="chip">{new Date(version.createdAt).toLocaleString()}</span>
          </div>
          <h2 className="text-2xl font-semibold text-[var(--fg)]">{version.content.basics.name ?? "Candidate Profile"}</h2>
          <p className="mt-3 leading-7 text-[var(--fg-muted)]">{version.content.summary ?? "No summary parsed."}</p>
        </div>
        <div className="score-ring shrink-0" style={{ "--score": score?.totalScore ?? 0 } as React.CSSProperties}>
          <div className="text-center">
            <div className="text-3xl font-semibold">{score?.totalScore ?? "--"}</div>
            <div className="text-xs text-[var(--fg-muted)]">score</div>
          </div>
        </div>
      </div>
      {!!version.changeSummary.length && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {version.changeSummary.slice(0, 4).map((item) => (
            <div className="flex gap-2 rounded-[var(--r)] bg-[oklch(96%_0.025_185_/_58%)] p-3 text-sm text-[var(--fg-muted)]" key={item}>
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ResumeContentView({ content }: { content: ResumeContent }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <div className="space-y-4">
        <ResumeBlock title="Skills">
          <div className="space-y-3">
            {content.skills.map((group) => (
              <div key={group.category}>
                <p className="mb-2 text-sm font-semibold">{group.category}</p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => <span className="chip" key={item}>{item}</span>)}
                </div>
              </div>
            ))}
          </div>
        </ResumeBlock>
        <ResumeBlock title="Experience">
          <div className="space-y-4">
            {content.experiences.map((item) => (
              <TimelineItem key={`${item.company}-${item.title}`} title={`${item.title} · ${item.company}`} meta={[item.startDate, item.endDate].filter(Boolean).join(" - ")}>
                {item.bullets}
              </TimelineItem>
            ))}
          </div>
        </ResumeBlock>
      </div>
      <div className="space-y-4">
        <ResumeBlock title="Projects">
          <div className="space-y-4">
            {content.projects.map((project) => (
              <TimelineItem key={project.name} title={project.name} meta={project.techStack.join(" · ")}>
                {[project.description, ...project.bullets].filter(Boolean)}
              </TimelineItem>
            ))}
          </div>
        </ResumeBlock>
        {!!content.education?.length && (
          <ResumeBlock title="Education">
            {content.education.map((item) => (
              <p className="text-sm text-[var(--fg-muted)]" key={`${item.school}-${item.degree}`}>{item.school} · {item.degree}</p>
            ))}
          </ResumeBlock>
        )}
      </div>
    </div>
  )
}

function ResumeBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="resume-section p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">{title}</h3>
      {children}
    </section>
  )
}

function TimelineItem({ title, meta, children }: { title: string; meta?: string; children: string[] }) {
  return (
    <article className="border-l border-[var(--border-strong)] pl-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      {meta && <p className="mt-1 text-xs text-[var(--fg-dim)]">{meta}</p>}
      <ul className="mt-3 space-y-2">
        {children.map((item) => (
          <li className="text-sm leading-6 text-[var(--fg-muted)]" key={item}>{item}</li>
        ))}
      </ul>
    </article>
  )
}

function ScorePanel({ score }: { score?: ScoreReport }) {
  return (
    <section className="resume-section p-4">
      <div className="flex items-center gap-4">
        <div className="score-ring !w-[96px]" style={{ "--score": score?.totalScore ?? 0 } as React.CSSProperties}>
          <div className="text-center">
            <div className="text-2xl font-semibold">{score?.totalScore ?? "--"}</div>
            <div className="text-[10px] text-[var(--fg-muted)]">overall</div>
          </div>
        </div>
        <p className="text-sm leading-6 text-[var(--fg-muted)]">{score?.summary ?? "No score yet."}</p>
      </div>
      <div className="mt-4 space-y-3">
        {score?.dimensions.map((dimension) => (
          <div key={dimension.name}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{dimension.name}</span>
              <span className="text-[var(--fg-muted)]">{dimension.score}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-[var(--r-full)] bg-[oklch(91%_0.018_95)]">
              <motion.div
                animate={{ width: `${dimension.score}%` }}
                className="h-full rounded-[var(--r-full)] bg-[linear-gradient(90deg,var(--primary),var(--plum))]"
                initial={{ width: 0 }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ImprovementPanel({ score, version }: { score?: ScoreReport; version: VersionView }) {
  const improvements = score?.prioritizedImprovements ?? []
  return (
    <section className="resume-section p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">Optimization Points</h3>
        <span className="chip">{improvements.length} items</span>
      </div>
      <div className="space-y-3">
        {improvements.map((item, index) => (
          <motion.article
            animate={{ opacity: 1, x: 0 }}
            className="rounded-[var(--r)] border border-[var(--border)] bg-white/60 p-3"
            initial={{ opacity: 0, x: 8 }}
            key={`${item.title}-${index}`}
            transition={{ delay: index * 0.04 }}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{item.title}</p>
              <span className={`chip ${item.priority === "high" ? "text-[var(--err)]" : item.priority === "medium" ? "text-[var(--amber)]" : "text-[var(--primary)]"}`}>{priorityLabel[item.priority]}</span>
            </div>
            <p className="text-xs leading-5 text-[var(--fg-muted)]">{item.reason}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--fg)]">{item.suggestedChange}</p>
          </motion.article>
        ))}
        {!improvements.length && <p className="text-sm text-[var(--fg-muted)]">Run scoring to generate ranked improvements.</p>}
      </div>
      {!!version.riskWarnings.length && (
        <div className="mt-4 rounded-[var(--r)] bg-[oklch(97%_0.035_78_/_70%)] p-3 text-xs leading-5 text-[var(--fg-muted)]">
          {version.riskWarnings.slice(0, 3).join(" ")}
        </div>
      )}
    </section>
  )
}

function ChatPanel({
  chat,
  loading,
  messages,
  onChatChange,
  onInterview,
  onSubmit
}: {
  chat: string
  loading: boolean
  messages: WorkbenchState["messages"]
  onChatChange: (value: string) => void
  onInterview: () => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <section className="resume-section flex min-h-[360px] flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
          <MessageSquare className="size-4" />
          Chat
        </h3>
        <button className="button h-8 min-h-8 px-3 text-xs" onClick={onInterview} type="button">
          <Bot className="size-3" />
          Interview
        </button>
      </div>
      <div className="panel-scroll flex-1 space-y-2 pr-1">
        {messages.slice(-7).map((message, index) => (
          <div className={`message p-3 text-sm leading-6 ${message.role === "user" ? "ml-8 bg-[oklch(94%_0.03_185_/_64%)]" : "mr-8"}`} key={`${message.createdAt}-${index}`}>
            {message.content}
          </div>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={onSubmit}>
        <input
          className="min-w-0 flex-1 rounded-[var(--r)] border border-[var(--border)] bg-white/70 px-3 text-sm outline-none transition focus:border-[var(--primary)]"
          onChange={(event) => onChatChange(event.target.value)}
          placeholder="Ask JobMate..."
          value={chat}
        />
        <button aria-label="Send message" className="button button-primary aspect-square min-h-10 w-10 p-0" disabled={loading} type="submit">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </section>
  )
}

function ActionButton({ busy, children, icon, onClick, primary = false }: { busy: boolean; children: React.ReactNode; icon: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button className={`button ${primary ? "button-primary" : ""}`} disabled={busy} onClick={onClick} type="button">
      {busy ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}
