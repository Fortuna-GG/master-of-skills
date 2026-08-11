# 技能管家（Master of Skills）

本地网页应用：自动扫描电脑上 Codex 安装的全部插件 / 技能 / MCP 服务器，统一展示与管理。

## 功能
- 自动扫描 5 个来源：config.toml、插件缓存（plugin.json）、用户技能、系统技能、Claude 风格技能，自动去重合并。
- 预置 8 大分类 + 关键词自动归类，支持手动修改并持久化。
- 每一条目带通俗中文说明，应用内可随时编辑备注、改分类、收藏、记录最近使用。
- 场景速查表：`想做 X → 用谁`，可增删改。
- 纯本地运行，不联网、不改动 Codex 配置（只读管理）。

## 快速开始
1. 双击 `start.bat`（自动启动服务并打开浏览器）。
2. 或手动：`npm install` 后 `node server\index.js`，访问 http://localhost:3000

## 技术栈
- Node.js + Express（后端），原生 HTML/CSS/JS（前端，零构建工具）。
- 数据存本地 JSON（data/catalog.json）。
- 依赖仅 express、@iarna/toml。

## 目录结构
- server/：index.js（服务）、scanner.js（扫描）、parser.js（解析）、store.js（数据存取）
- public/：index.html / app.js / style.css（卡片式单页）
- scripts/：辅助脚本（scan-cli、annotate、browser-test）
- data/：catalog.json（条目数据）、quickref 速查表
