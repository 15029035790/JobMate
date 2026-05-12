# JobMate AI Core

JobMate AI Core is a lightweight multi-agent kernel for a career and interview assistant.

It implements:

- Claude Code-style `Planner -> Orchestrator -> Tools -> Reflection` layering.
- A central orchestrator plus six vertical agents.
- Flexible resource-driven workflow state.
- Three-layer memory: working, episodic, and long-term user memory.
- Resume versioning with copy-based optimization.
- Human-in-the-loop interview review and weakness confirmation gates.

This repository is a lightweight TypeScript MVP. Use Node 22+ and install dev dependencies before running checks.

## Setup

```bash
npm install
```

## Run Tests


```bash
npm test
```

## Run Demo

```bash
npm run demo
```


## Docs

- `docs/IMPLEMENTATION_AUDIT.md`
- `docs/MOCK_INTERVIEW_PROJECT_DEEP_DIVE.md`


## Compile & Check

```bash
npm run lint
npm run typecheck
npm run build
```


## Real Resume + JD Test

This flow now uses real DeepSeek chat-completions calls for resume optimization and mock interview question generation. Configure the API key before running it:

```bash
export DEEPSEEK_API_KEY=your_key
export DEEPSEEK_MODEL=deepseek-v4-flash
export DEEPSEEK_BASE_URL=https://api.deepseek.com
```

You can also put those values in a local `.env` file at the project root. `.env` is gitignored.

`deepseek-v4-flash` is the default for lower latency and cost. Switch `DEEPSEEK_MODEL` to `deepseek-v4-pro` when you want stronger reasoning. `LLM_API_KEY`, `LLM_MODEL`, and `LLM_BASE_URL` are also supported aliases.

1) Prepare two text files:
- `resume.txt`
- `jd.txt`

2) Run:

```bash
npm run real-test -- --resume ./resume.txt --jd ./jd.txt
```

This will run an end-to-end kernel flow:
- parse resume/JD
- optimize resume version
- auto-confirm and save version
- start mock interview
- print orchestrator trace events

The resume optimizer only aligns wording around JD keywords that already have evidence in the source resume. Unsupported JD requirements are returned as risk warnings instead of being added as claimed skills.


## Terminal Chat

Set env vars first, and never commit keys:

```bash
export DEEPSEEK_API_KEY=your_key
export DEEPSEEK_MODEL=deepseek-v4-flash
export DEEPSEEK_BASE_URL=https://api.deepseek.com
```

The CLI also loads these values from a local `.env` file.

Run:

```bash
npm run chat  # Node 20+ safe: run compiled dist/cli/chat.js
```

Commands:
- `/load-resume ./resume.txt`
- `/load-jd ./jd.txt`
- `/optimize`
- `/start-interview`
- `/ask 你想问的问题`
- `/exit`
