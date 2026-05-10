# JobMate AI Core Implementation Audit

## 1) 当前项目结构概览
- 已有核心目录：`src/agents`、`src/harness`、`src/state`、`src/tools`、`src/memory`、`src/reflection`、`src/db`、`src/domain`。
- 新增目录：`src/orchestrator`、`docs`、`tests`。
- 已有核心文件：任务输入输出类型、runtime、router、state manager、memory stores、reflection guards、resume-jd matching agent、resume optimization agent。
- 本次新增：`mock-interview.agent.ts`、`project-deep-dive.ts`、`central-orchestrator.ts`。
- 类型定义：`src/domain/types.ts` 已覆盖 Resume/JD/Interview/Review/Weakness/Learning，并新增 Project Deep-Dive 相关类型。
- persistence：当前为 `src/db/in-memory-database.ts` + memory stores（working/episodic/long-term/vector）。
- 测试：仓库原始无 tests；本次新增 `tests/mock-interview.test.ts`。

## 2) 原计划模块完成度矩阵
- Planner Layer: **missing**（无 planner 目录和意图识别器）。
- Central Orchestrator Agent: **partial**（新增 `src/orchestrator/central-orchestrator.ts`，可路由并调度已注册 agent）。
- Agent Harness Runtime: **done**（`src/harness/agent-runtime.ts`）。
- Task Router: **done**（`src/harness/task-router.ts`）。
- Session State Manager: **done**（`src/state/session-state.types.ts` + `state-manager.ts`）。
- Checkpoint Manager: **done**（`src/harness/checkpoint-manager.ts`）。
- Tool Layer: **partial**（resume/jd parser、diff、export、llm adapter；缺少 richer tool adapters）。
- Resume Parser Tool: **done**（`src/tools/resume-parser.tool.ts`）。
- JD Parser Tool: **done**（`src/tools/jd-parser.tool.ts`）。
- Version Diff Tool: **partial**（当前是摘要 diff，非细粒度结构 diff）。
- LLM Tool Adapter: **partial**（`LlmTool` 为 deterministic stub）。
- Working Memory: **done**（`working-memory.store.ts`）。
- Episodic Memory: **done**（`episodic-memory.store.ts`）。
- Long-Term User Memory: **partial**（有 store，无完整确认流程仓储层）。
- Vector Memory / Retrieval: **partial**（简易 hash vector + cosine）。
- Reflection Layer: **partial**（有 output/consistency/confirmation/memory commit controller）。
- Output Validator: **done**。
- Consistency Checker: **partial**（覆盖 JD/Resume/Review，尚未覆盖 project narrative）。
- Human Confirmation Gate: **done**（基础 gate 存在）。
- Memory Commit Controller: **partial**（已阻止 requires confirmation 的 LTM 写入，未细化 project claim 规则）。
- Resume-JD Matching Agent: **done**。
- Resume Version Optimization Agent: **done**（副本制，保留 base resume）。
- Mock Interview Agent: **partial**（本次补齐 start/answer/finish + project deep-dive）。
- Interview Review Negotiation Agent: **missing**。
- Weakness Diagnosis Agent: **missing**。
- Learning Planner Agent: **missing**。
- Resume Version Management: **partial**（创建 draft 存在；save/archive 流程缺）。
- Interview Session / Turn Management: **partial**（本次补齐核心路径）。
- Review Negotiation Flow: **missing**。
- Learning Plan Flow: **missing**。
- Tests: **partial**（新增 mock interview 测试；总体覆盖仍有限）。

## 3) 未完成计划列表
### P0
1. Planner 层意图识别 + task plan（至少轻量实现接口）。
2. Interview Review Negotiation / Weakness / Learning Planner 三个垂直 agent。
3. long-term 写入前的人类确认闭环串到 orchestrator（不仅是 store 级阻断）。
4. resume version save / archive 任务链路。

### P1
1. 向量检索增强（更稳健 embedding adapter）。
2. version diff 细粒度字段级差异。
3. repository 分层（替代直接 in-memory map）。
4. review 协商多轮交互体验增强。

### P2
1. GUI 接入。
2. 部署与可观测性。
3. 可视化报表与运营后台。

## 4) 建议执行顺序
1. 先补 Planner 接口并接入 orchestrator。
2. 再补 review/weakness/learning agents 的最小闭环。
3. 接着完善 long-term confirmation gate 在 orchestrator 的统一拦截。
4. 最后再做向量检索和 richer diff。
