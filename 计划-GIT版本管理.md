# 计划：技能管家加入 Git 版本管理并上传 GitHub（V1.0）

- 日期：2026-08-11
- 状态：进行中

## 🎯 目标
- 把技能管家项目初始化为 Git 仓库，提交当前全部代码、数据与文档。
- 打上版本标签 V1.0。
- 上传到 GitHub 公开仓库 `master-of-skills`。

## 📋 方案（已与用户确认）
- 认证方式：GitHub CLI（gh）网页授权登录（用户选 A）。
- 仓库名：`master-of-skills`，**公开**仓库（用户选 A / B）。
- 忽略文件：`node_modules/`（依赖）、`.tmp-shots/`（测试截图）。
- 提交内容：server/、public/、scripts/、data/、计划文档、start.bat、package.json、README.md 等。
- 公开仓库会暴露 catalog.json 中的本机路径（如 C:\Users\Administrator\...），用户已知晓并选择公开。

## ✅ 验收标准
- `git log` 有 V1.0 提交；`git tag` 显示 `v1.0`。
- GitHub 网页能看到公开仓库 `master-of-skills`，代码与标签已推送。
- 本地仓库干净（git status 无未提交改动）。

## 📝 执行记录
- [2026-08-11] 创建本计划文件（含方案确认记录）。
