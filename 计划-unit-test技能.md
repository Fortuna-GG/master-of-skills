# 计划：创建 /unit-test 技能（代码健康体检）

- 日期：2026-08-11
- 状态：已完成

## 🎯 目标
- 创建 `unit-test` 技能：对项目执行单元/代码做通用健康检查（正确性、结构性、健壮性、安全、性能、可维护性、兼容性、测试盲区），输出分级中文报告，并"转诊"给现有技能（tdd / code-review / diagnosing-bugs / improve-codebase-architecture），不与它们重复。
- 定位：只体检、不治疗。只读、不联网。

## 📋 方案（已与用户确认）
- 安装位置：`C:\Users\Administrator\.codex\skills\unit-test\`
- 形态：SKILL.md（检查手册）+ scripts/check.js（Node 扫描脚本）+ agents/openai.yaml（UI 元数据）
- 脚本用 Node 编写、报告中文、检查通用多语言

## ✅ 验收标准
- quick_validate.py 校验通过；脚本在本项目真实扫描能指出问题且不崩、中文无乱码；报告含分级与转诊建议。

## 📝 执行记录
- [2026-08-11] 创建本计划文件。
- [2026-08-11] 创建技能三件套：SKILL.md（8 维度检查手册 + 分级报告模板 + 转诊表）、scripts/check.js（Node 机械扫描）、agents/openai.yaml（UI 元数据），部署到 .codex/skills/unit-test/。✅
- [2026-08-11] 校验：quick_validate.py 因本机 python 缺 yaml 模块，改用 Node 等价校验（frontmatter 键、name 格式、description 限制），全部合规；check.js 语法通过。✅
- [2026-08-11] 真实试检技能管家项目：发现 $$eval 被 eval 规则误报 → 修复（lookbehind 排除 $eval/$$eval）+ 同一行多规则去重 + 优化 console.log 提示语。✅
- [2026-08-11] 样例验证：eval/密钥/空 catch/TODO 全部命中、$$eval 不误报、空目录给出友好提示。✅
- [2026-08-11] 更新 Obsidian 记忆库（档案卡 + 总目录 + 经验笔记）。✅
