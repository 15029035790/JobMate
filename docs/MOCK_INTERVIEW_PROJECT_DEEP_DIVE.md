# Mock Interview Project Deep-Dive

新增模块：
- `Question Generator`：`projectQuestion`，支持 general / clarify / ownership / architecture / tradeoff / metrics / failure / next topic。
- `Answer Evaluator`：`evaluateGeneralAnswer`，用于基础题。
- `Project Deep-Dive Evaluator`：`evaluateProjectAnswer`，强调“不可验证内部事实”原则，输出 `unverifiableClaims`。
- `Follow-up Controller`：`nextFollowUpStrategy`，按薄弱分数动态选择追问。
- `Interviewer Comprehension Scorer`：通过黑话/内部术语密度降低理解分并给改写建议。

记忆约束：
- Project deep-dive 输出强制 `requiresUserConfirmationBeforeLongTermMemory = true`。
- 可进入 episodic memory：问题、回答、追问、evaluation。
- 不直接写入 long-term：未确认能力判断、内部指标真实性结论。
