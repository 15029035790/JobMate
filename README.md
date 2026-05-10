# JobMate AI Core

JobMate AI Core is a lightweight multi-agent kernel for a career and interview assistant.

It implements:

- Claude Code-style `Planner -> Orchestrator -> Tools -> Reflection` layering.
- A central orchestrator plus six vertical agents.
- Flexible resource-driven workflow state.
- Three-layer memory: working, episodic, and long-term user memory.
- Resume versioning with copy-based optimization.
- Human-in-the-loop interview review and weakness confirmation gates.

This repository intentionally starts as a dependency-free TypeScript MVP. Node 24 can run the `.ts` files directly through built-in type stripping.

## Run Tests


```bash
node --test tests/*.test.ts
```

## Run Demo

```bash
node src/demo.ts
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

1) Prepare two text files:
- `resume.txt`
- `jd.txt`

2) Run:

```bash
node src/cli/run-real-test.ts --resume ./resume.txt --jd ./jd.txt
```

This will run an end-to-end kernel flow:
- parse resume/JD
- optimize resume version
- auto-confirm and save version
- start mock interview
- print orchestrator trace events


## Terminal Chat

Set env var first (optional but recommended for real model, and never commit keys):

```bash
export LLM_API_KEY=your_key
export LLM_MODEL=deepseek-v4-flash
export LLM_BASE_URL=https://api.deepseek.com
```

Run:

```bash
npm run chat
```

Commands:
- `/load-resume ./resume.txt`
- `/load-jd ./jd.txt`
- `/optimize`
- `/start-interview`
- `/ask 你想问的问题`
- `/exit`
