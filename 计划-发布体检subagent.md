# 计划：设计"发布体检官"（subagent / 技能）

- 日期：2026-08-12
- 状态：已完成

## 🎯 目标
- 设计一个"发布体检官"：当项目代码本体发生改动，或准备版本更新时，它负责调用 /unit-test（代码健康体检）和 /security-audit（安全审计）两个技能，汇总两份分级报告，给出"是否适合发布/更新"的结论与转诊建议。

## 📋 需求（用户提出）
1. 项目改动或版本更新时，自动/主动调用 /unit-test 和 /security-audit。
2. 设计形态：subagent（子代理）。

## 🔍 调研结论（2026-08-12，源码核实）
- 从 openai/codex 官方仓库源码（codex-rs/external-agent-migration/src/subagents.rs）确认：Codex 的 subagent 用 Markdown 文件 + frontmatter（name / description / permissionMode / effort）定义，正文是系统提示；原生目标格式为 TOML（name / description / sandbox_mode / model_reasoning_effort）。
- subagent 是"被主对话委派调用"的角色，本身没有"代码改动自动触发"的钩子；要实现"自动"需借助规则（AGENTS.md）或自动化机制。
- 本机无任何 subagents 配置实例；桌面版 Codex 对 ~/.codex/subagents 的支持待实测。
- 用户已有 unit-test、security-audit 两个体检技能，本次是新增一个"体检总指挥"。

## 🧭 候选方案（2026-08-12 用户选定方案A：发布体检技能）
- 方案A：创建"发布体检"技能（skill，如 release-check）：技能里写明流程=先 /unit-test 再 /security-audit，汇总报告。任何会话可用、可被技能管家收录。
- 方案B：写 Codex 原生 subagent 配置文件（~/.codex/subagents/release-reviewer.md + 正文指令），主对话按需委派。字面符合"subagent"，但触发不自动。
- 方案C：在全局 AGENTS.md 加"发布体检规则"：项目改动/发版前自动先跑两个体检技能。真正的自动，但作用于所有项目。
- 方案D（推荐）：A+B 组合——先做"发布体检"技能（主形态，可靠可复用），同时写一份 subagent 配置文件作为委派入口，双保险。

## ✅ 验收标准（待细化）
- 触发后按顺序运行 unit-test 与 security-audit，输出两份报告 + 汇总结论（是否适合发布 + 转诊建议）。
- 技能/配置结构校验通过；技能管家能收录（若为 skill 形态）。
- 真实项目试跑一次。

## 📝 执行记录
- [2026-08-12] 创建本计划文件；完成调研（Codex subagent 格式源码核实，见上）。
## ✅ 验收标准（细化）
- 技能两件套（SKILL.md + agents/openai.yaml）部署到 .codex/skills/release-check/，结构校验通过（name/description/frontmatter）。
- 对技能管家真实项目试跑一次"发布体检"：依次跑 unit-test 的 check.js 与 security-audit 的 scan.js，输出合并的"发布体检单"（分级问题 + 是否阻塞发布 + 转诊建议）。
- 记忆库档案卡 + 总目录 + 经验笔记更新；技能管家 catalog 重扫收录新技能；git 提交推送。

## 📝 执行记录
- [2026-08-12] 创建本计划文件；完成调研（Codex subagent 格式源码核实，见上）。
- [2026-08-12] 用户选定方案A（发布体检技能），并了解"为何查源码"（subagent 是程序可解析的配置，格式规则以源码为准）。
- [2026-08-12] 创建技能两件套并安装到 .codex/skills/release-check/。
- [2026-08-12] 创建技能两件套（SKILL.md + agents/openai.yaml）并安装到 .codex/skills/release-check/，结构校验通过。
- [2026-08-12] 对技能管家真实试跑：unit-test 命中 20 条（危险函数 10/警告 10/0 测试）、security-audit 命中 10 条（DOM XSS 9/子进程 1），汇总"发布体检单"（结论：有条件通过 + 转诊建议）。
- [2026-08-12] 更新记忆库档案卡与经验笔记；技能管家 catalog 重扫收录新技能；git 提交推送。
