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
