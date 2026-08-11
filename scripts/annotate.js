'use strict';
/**
 * 一次性预填脚本：为扫描结果写入中文备注 + 修正分类 + 预填场景速查表。
 * 之后用户在应用里修改的备注/分类/收藏都会被 rescan 合并逻辑保留，不会被本脚本覆盖。
 */
const path = require('path');
const fs = require('fs');
const Store = require('../server/store');

const C = {
  plan: '头脑风暴与规划',
  ui: 'UI 设计与美化',
  code: '代码编程与工程',
  doc: '文档与办公',
  research: '研究与调查',
  browser: '浏览器与自动化',
  sys: '系统与技能管理',
  comm: '沟通与协作',
};

/** name -> { n: 备注, c: 分类 } */
const NOTES = {
  /* ===== 插件 ===== */
  browser: { c: C.browser, n: '控制 Codex 内置浏览器：打开本地网页、点击、输入、截图，主要用于测试前端页面。' },
  visualize: { c: C.browser, n: '在对话里直接生成图表、地图、模拟器、交互式工具和 UI 预览，适合做演示和探索。' },
  'codex-security': { c: C.code, n: '安全插件：对代码库/PR 做安全扫描、威胁建模、漏洞分析，自带 12 个配套技能。' },
  github: { c: C.code, n: 'GitHub 集成：查看仓库、审查 PR、回复评审意见、调试 Actions 失败、发布改动。' },
  sentry: { c: C.code, n: '接入 Sentry 错误监控：查看线上报错、审查事件、汇总生产环境错误。' },
  superpowers: { c: C.plan, n: 'Agent 工作流引擎：头脑风暴 → 写计划 → TDD 实现 → 验证，配套 14 个技能。' },
  vercel: { c: C.code, n: 'Vercel 平台全家桶：部署、环境变量、数据库、Next.js、AI SDK 等 47 个参考技能。' },
  documents: { c: C.doc, n: '在本地创建/编辑/检查 Word(.docx) 文档，可生成 Google Docs 交接版本。' },
  pdf: { c: C.doc, n: '在本地读取、创建、渲染、校验 PDF 文件，适合对排版效果有要求的场景。' },
  presentations: { c: C.doc, n: '创建/编辑 PPT 幻灯片（.pptx），可生成 Google Slides 交接版本。' },
  spreadsheets: { c: C.doc, n: '创建/编辑 Excel(.xlsx)、CSV、TSV 表格，可生成 Google Sheets 交接版本。' },
  'template-creator': { c: C.doc, n: '把文档/表格/PPT/图片/邮件变成可复用的个人模板技能，以后一键套用。' },
  ponytail: { c: C.code, n: '极简开发哲学：优先标准库、YAGNI、最小可用实现，配套 audit/review/debt 等技能。' },

  /* ===== MCP ===== */
  firecrawl: { c: C.research, n: '网页抓取服务：把网页内容抓下来供 AI 分析，适合调研、爬取文章和站点（需要 API Key）。' },
  node_repl: { c: C.browser, n: '持久的 Node.js 执行环境：可跑 JS 脚本、控制浏览器（Playwright 等）、处理文件，Codex 内置。' },

  /* ===== 插件自带技能 ===== */
  'control-in-app-browser': { c: C.browser, n: '控制应用内浏览器：打开页面、点击、输入、截图、本地网页测试。' },
  'excel-live-control': { c: C.doc, n: '实时控制已打开的 Excel 应用（需安装 ChatGPT 的 Excel 插件）。' },
  'gh-address-comments': { c: C.code, n: '处理 GitHub PR 上的评审意见：查看未解决讨论、实现修复。' },
  'gh-fix-ci': { c: C.code, n: '排查并修复 GitHub Actions 里失败的检查。' },
  yeet: { c: C.code, n: '把本地改动一键提交、推送并开草稿 PR。' },
  brainstorming: { c: C.plan, n: '头脑风暴工作流：系统化梳理想法，想清楚再动手。' },
  'dispatching-parallel-agents': { c: C.code, n: '把任务拆给多个并行子代理同时干活，提高效率。' },
  'executing-plans': { c: C.code, n: '按写好的计划逐步执行实现，边做边验证。' },
  'finishing-a-development-branch': { c: C.code, n: '开发分支收尾：验证、整理、提交，干净地结束一个分支。' },
  'receiving-code-review': { c: C.code, n: '以正确心态接收代码评审意见，并逐条改进。' },
  'requesting-code-review': { c: C.code, n: '发起高质量的代码评审请求，让别人能高效审查。' },
  'subagent-driven-development': { c: C.code, n: '子代理驱动开发：主代理负责调度，子代理负责具体实现。' },
  'systematic-debugging': { c: C.code, n: '系统化排错：先复现 → 找根因 → 再修复，不瞎猜。' },
  'test-driven-development': { c: C.code, n: 'TDD：先写测试再写实现（红-绿-重构循环）。' },
  'using-git-worktrees': { c: C.code, n: '用 git worktree 建隔离工作区，多个任务并行开发互不干扰。' },
  'using-superpowers': { c: C.sys, n: '对话开始时的引导技能：先找可用技能再响应，而不是直接开干。' },
  'verification-before-completion': { c: C.code, n: '声称"做完了"之前必须跑验证命令，用证据说话。' },
  'writing-plans': { c: C.plan, n: '动手写代码前，把需求拆成可执行的多步骤计划。' },
  'writing-skills': { c: C.sys, n: '创建、编辑、验证技能的全流程指导。' },
  'attack-path-analysis': { c: C.code, n: '安全扫描环节：追踪漏洞从源头到出口，校准严重级别。' },
  'deep-security-scan': { c: C.code, n: '深度安全扫描：多轮独立扫描降低漏报率。' },
  'finding-discovery': { c: C.code, n: '在代码库中发掘候选安全问题。' },
  'fix-finding': { c: C.code, n: '修复并验证一个安全发现。' },
  'propose-security-hardening': { c: C.code, n: '基于证据提出结构性安全加固方案。' },
  'security-diff-scan': { c: C.code, n: '对 PR/提交/分支差异做安全审查。' },
  'security-scan': { c: C.code, n: '默认的整库单轮安全审计。' },
  'threat-model': { c: C.code, n: '建立或更新仓库的威胁模型。' },
  'track-findings': { c: C.code, n: '把安全发现跟踪到 Linear/Jira/GitHub 里。' },
  'triage-finding': { c: C.code, n: '对导入的漏洞报告做分级处理。' },
  validation: { c: C.code, n: '验证候选安全问题是否真实、是否值得修。' },
  'vulnerability-writeup': { c: C.code, n: '把漏洞信息写成规范、有据可查的漏洞报告。' },
  'ponytail-audit': { c: C.code, n: '整库审查"过度工程"：列出该删、该简化、该换标准库的地方。' },
  'ponytail-debt': { c: C.code, n: '把代码里标记的 ponytail: 欠债注释汇总成债务清单，防止"以后再说"变永远不做。' },
  'ponytail-gain': { c: C.code, n: '展示极简方案带来的量化收益：更少代码、更低成本、更快速度。' },
  'ponytail-help': { c: C.code, n: 'ponytail 全家桶速查卡：所有模式、技能、命令一览。' },
  'ponytail-review': { c: C.code, n: '只找"过度工程"的代码评审：该删什么、用什么替代，一条一行。' },

  /* ===== Vercel 自带技能 ===== */
  'agent-browser': { c: C.code, n: '浏览器自动化 CLI：操作网页、填表、截图、抓数据。' },
  'agent-browser-verify': { c: C.code, n: '开发服务器启动后自动用浏览器做可视化验证，检查页面和控制台报错。' },
  'ai-elements': { c: C.code, n: 'AI 界面组件库（基于 shadcn/ui）：聊天界面、工具调用展示等。' },
  'ai-gateway': { c: C.code, n: 'AI 网关：多模型路由、故障切换、成本跟踪，统一 API 管理。' },
  'ai-generation-persistence': { c: C.code, n: 'LLM 生成内容的持久化：唯一 ID、可寻址 URL、数据库存储。' },
  'ai-sdk': { c: C.code, n: 'Vercel AI SDK：构建聊天、流式输出、工具调用、智能体等 AI 功能。' },
  auth: { c: C.code, n: '认证集成：Clerk、Auth0 等登录方案接入 Next.js。' },
  bootstrap: { c: C.code, n: '项目引导：初始化依赖 Vercel 资源（数据库/认证）的仓库环境。' },
  'chat-sdk': { c: C.code, n: 'Chat SDK：一套代码对接 Slack、Telegram、Discord 等多平台聊天机器人。' },
  cms: { c: C.code, n: '无头 CMS 集成：Sanity、Contentful 等内容系统接入。' },
  'cron-jobs': { c: C.code, n: 'Vercel Cron 定时任务：在 vercel.json 里配置定时执行。' },
  'deployments-cicd': { c: C.code, n: '部署与 CI/CD：发布、回滚、检查部署、配置 CI 工作流。' },
  email: { c: C.code, n: '邮件发送：Resend + React Email 模板，验证域名发事务邮件。' },
  'env-vars': { c: C.code, n: 'Vercel 环境变量管理：.env 文件、vercel env 命令、OIDC。' },
  geist: { c: C.code, n: 'Geist 字体/排版系统：Vercel 默认字体配置。' },
  geistdocs: { c: C.code, n: 'Geistdocs 文档站模板：MDX 写作、AI 聊天、i18n、部署。' },
  'investigation-mode': { c: C.code, n: '卡住/报错时的系统性排查：日志→工作流→浏览器验证→环境，逐步定位。' },
  'json-render': { c: C.code, n: 'AI 聊天回复渲染：工具调用、流式状态、结构化数据展示。' },
  marketplace: { c: C.code, n: 'Vercel Marketplace：接入第三方服务、自动配置环境变量、统一计费。' },
  micro: { c: C.code, n: 'micro 框架：Vercel 出品的轻量异步 HTTP 微服务。' },
  ncc: { c: C.code, n: '@vercel/ncc：把 Node.js 项目打包成单个自包含文件。' },
  'next-forge': { c: C.code, n: 'next-forge 模板：生产级 Turborepo monorepo SaaS 起步套件。' },
  nextjs: { c: C.code, n: 'Next.js App Router 全面指南：路由、服务端组件、数据获取、渲染。' },
  observability: { c: C.code, n: 'Vercel 可观测性：日志、速度洞察、Web 分析、OpenTelemetry、监控仪表盘。' },
  payments: { c: C.code, n: 'Stripe 支付集成：结账、Webhook、订阅计费。' },
  'react-best-practices': { c: C.code, n: 'React/TSX 组件质量检查清单：结构、hooks、无障碍、性能。' },
  'routing-middleware': { c: C.code, n: '路由中间件：请求拦截、重写、重定向、个性化。' },
  'runtime-cache': { c: C.code, n: 'Runtime Cache：按区域的临时 KV 缓存，支持按标签失效。' },
  satori: { c: C.code, n: 'Satori：把 HTML/CSS 转成 SVG，常用于动态生成 OG 分享图。' },
  shadcn: { c: C.code, n: 'shadcn/ui 组件库：CLI 安装、主题定制、Tailwind 集成。' },
  'sign-in-with-vercel': { c: C.code, n: '用 Vercel 账号做 OAuth/OIDC 登录。' },
  swr: { c: C.code, n: 'SWR 数据请求库：缓存、重验证、乐观更新、无限加载。' },
  turbopack: { c: C.code, n: 'Turbopack 打包器：配置、HMR 优化、与 Webpack 的差异。' },
  turborepo: { c: C.code, n: 'Turborepo 多仓库构建：任务缓存、远程缓存、并行执行。' },
  'v0-dev': { c: C.code, n: 'v0：用提示词生成 UI 组件的 AI 工具，可接入开发流程。' },
  'vercel-agent': { c: C.code, n: 'Vercel Agent：AI 代码审查、故障调查、SDK 安装。' },
  'vercel-api': { c: C.code, n: 'Vercel REST API：获取项目、部署、环境变量、日志等数据。' },
  'vercel-cli': { c: C.code, n: 'Vercel 命令行：部署、环境变量、域名、日志管理。' },
  'vercel-firewall': { c: C.code, n: 'Vercel 防火墙：DDoS 防护、WAF 规则、限流、IP 黑白名单。' },
  'vercel-flags': { c: C.code, n: '特性开关平台：灰度发布、A/B 测试、统一仪表盘。' },
  'vercel-functions': { c: C.code, n: 'Vercel 函数：Serverless/Edge 函数、流式、运行时配置。' },
  'vercel-queues': { c: C.code, n: 'Vercel 队列：异步事件流、重试、延迟投递、扇出模式。' },
  'vercel-sandbox': { c: C.code, n: 'Vercel Sandbox：隔离微虚拟机安全运行不可信代码。' },
  'vercel-services': { c: C.code, n: '单项目部署多服务：后端(Python/Go) + 前端(Next.js) 混合。' },
  'vercel-storage': { c: C.code, n: 'Vercel 存储：Blob、Edge Config、数据库（Neon/Upstash）选择与接入。' },
  verification: { c: C.code, n: '全链路端到端验证：浏览器 → API → 数据 → 响应，发现"怎么不工作"的问题。' },
  workflow: { c: C.code, n: 'Workflow DevKit：持久化工作流、长任务、暂停/恢复、重试。' },

  /* ===== 用户技能 ===== */
  'baseline-ui': { c: C.ui, n: '快速给界面"去糙"：修间距、层级、字体、小布局问题。' },
  'fixing-accessibility': { c: C.ui, n: '修复网页无障碍问题：标签、键盘操作、焦点管理、对比度、表单错误。' },
  'fixing-metadata': { c: C.ui, n: '修复网页元信息：标题、SEO 描述、OG 标签、favicon、JSON-LD。' },
  'fixing-motion-performance': { c: C.ui, n: '修复动画卡顿：避免布局抖动、用合成器属性、优化模糊效果。' },
  hallmark: { c: C.ui, n: '高品质网页设计：从零新建、重设计、从截图/网址提取设计风格。' },
  'full-output-enforcement': { c: C.code, n: '长任务输出保障：强制完整代码、禁止占位符、处理超长输出拆分。' },
  'redesign-existing-projects': { c: C.ui, n: '把已有网站/应用升级到高级质感（只用于已有项目，不用于从零新建）。' },
  'design-taste-frontend': { c: C.ui, n: '从零设计新网页/落地页/作品集，拒绝模板感（只用于新建）。' },

  /* ===== 系统技能 ===== */
  imagegen: { c: C.ui, n: '生成/编辑位图图片：插画、纹理、素材、模拟图、透明底图。' },
  'openai-docs': { c: C.sys, n: '查询 Codex/OpenAI 官方知识：模型、定价、设置、自动化、技能等。' },
  'plugin-creator': { c: C.sys, n: '创建 Codex 插件：自动生成 plugin.json 和插件目录结构。' },
  'review-agent': { c: C.code, n: '只读审查代码改动，输出每条可执行的缺陷清单。' },
  'skill-creator': { c: C.sys, n: '指导你创建或更新一个技能。' },
  'skill-installer': { c: C.sys, n: '安装技能：从官方列表或 GitHub 仓库装到 .codex/skills。' },

  /* ===== agents 技能 ===== */
  'agent-reach': { c: C.research, n: '全网调研/搜索：小红书、推特、B站、Reddit、YouTube、GitHub 等 15 个平台。' },
  'ask-matt': { c: C.sys, n: '不知道该用哪个技能时问它：它会帮你路由到合适的技能或流程。' },
  'code-review': { c: C.code, n: '双维度代码评审：规范符合度 + 需求实现度，两边同时跑。' },
  'codebase-design': { c: C.code, n: '设计"深模块"：优化模块接口、找拆分点、让代码更易测试、更易被 AI 理解。' },
  'diagnosing-bugs': { c: C.code, n: '疑难 Bug 诊断循环：崩溃、报错、性能回退、卡顿的排查。' },
  'domain-modeling': { c: C.code, n: '打磨领域模型：统一团队术语、记录架构决策。' },
  'find-skills': { c: C.sys, n: '帮你发现和安装适合当前需求的技能。' },
  'grill-me': { c: C.plan, n: '一场"拷问式访谈"：把计划或设计打磨得更扎实（先提问再定方案）。' },
  'grill-with-docs': { c: C.plan, n: '拷问式打磨计划，同时生成 ADR 和术语表文档。' },
  grilling: { c: C.plan, n: '不停追问直到达成共识：用"设计树"逐轮拷问你的计划。' },
  handoff: { c: C.comm, n: '把当前对话压缩成交接文档，方便另一个代理接手。' },
  implement: { c: C.code, n: '按 spec 或工单实现一段具体工作。' },
  'improve-codebase-architecture': { c: C.code, n: '扫描代码库找改进机会，生成可视化 HTML 报告，再逐个拷问打磨。' },
  officecli: { c: C.doc, n: '用 officecli 工具创建/检查/修改 Office 文档（.docx/.xlsx/.pptx）。' },
  prototype: { c: C.plan, n: '快速搭一次性原型，验证某个状态模型或界面想法是否靠谱。' },
  research: { c: C.research, n: '针对问题查权威一手资料，把结论写成 Markdown 存进仓库。' },
  'resolving-merge-conflicts': { c: C.code, n: '解决进行中的 git 合并/变基冲突。' },
  'setup-matt-pocock-skills': { c: C.sys, n: '配置工程技能仓库：问题跟踪器、标签词表、文档布局（首次使用前跑一次）。' },
  tdd: { c: C.code, n: '测试驱动开发：先写测试再写实现（红-绿-重构）。' },
  teach: { c: C.comm, n: '在这个工作区里教你一个新技能或概念。' },
  'to-questionnaire': { c: C.plan, n: '把无法直接回答的决策转成问卷，交给别人填写。' },
  'to-spec': { c: C.plan, n: '把当前对话整理成 spec 发布到问题跟踪器。' },
  'to-tickets': { c: C.plan, n: '把计划或 spec 拆成一组工单，发布到跟踪器。' },
  triage: { c: C.plan, n: '对 issue/外部 PR 分级处理：归类、验证、必要时拷问、写代理简报。' },
  'wait-what': { c: C.comm, n: '当上一条消息没被理解时，喊停并换种方式重新表达。' },
  wayfinder: { c: C.plan, n: '把超大任务拆成"决策工单地图"，逐个解决直到路径清晰。' },
  wizard: { c: C.sys, n: '生成交互式引导脚本，带人类一步步完成只能手动做的操作（如配密钥、建账号）。' },
  'writing-for-agents': { c: C.sys, n: '给代理写文档：创建/编辑技能、AGENTS.md、CLAUDE.md。' },
};

/** 场景速查表：想做 X → 用谁 */
const QUICKREF = [
  { scenario: '头脑风暴、打磨一个想法或计划', items: ['grilling', 'grill-me', 'grill-with-docs', 'prototype', 'wayfinder'] },
  { scenario: '从零设计一个网页 / 落地页 / 作品集', items: ['design-taste-frontend', 'hallmark'] },
  { scenario: '改造、美化、升级已有网站或应用', items: ['redesign-existing-projects', 'hallmark'] },
  { scenario: '快速给现有界面做小修小补（去糙）', items: ['baseline-ui'] },
  { scenario: '修复网页无障碍 / 动画卡顿 / SEO 元信息', items: ['fixing-accessibility', 'fixing-motion-performance', 'fixing-metadata'] },
  { scenario: '生成或编辑图片素材', items: ['imagegen'] },
  { scenario: '排查难缠的 Bug 或性能问题', items: ['diagnosing-bugs', 'systematic-debugging', 'investigation-mode'] },
  { scenario: '想先写测试再写代码（TDD）', items: ['tdd', 'test-driven-development'] },
  { scenario: '审查代码 / PR', items: ['code-review', 'review-agent', 'requesting-code-review', 'ponytail-review'] },
  { scenario: '解决 git 合并冲突', items: ['resolving-merge-conflicts'] },
  { scenario: '想尽量少写代码、用最简方案', items: ['ponytail', 'ponytail-review', 'ponytail-audit'] },
  { scenario: '全网调研、搜索某个话题或平台内容', items: ['agent-reach', 'research', 'firecrawl'] },
  { scenario: '查资料并写成文档存档', items: ['research'] },
  { scenario: '做 Word 文档 / Excel 表格 / PPT', items: ['documents', 'spreadsheets', 'presentations', 'officecli'] },
  { scenario: '处理或生成 PDF', items: ['pdf'] },
  { scenario: '把常用文档做成可复用模板', items: ['template-creator'] },
  { scenario: '测试本地网页 / 操作浏览器', items: ['browser', 'control-in-app-browser', 'agent-browser'] },
  { scenario: '做图表、地图、模拟器等可视化', items: ['visualize'] },
  { scenario: '用 Node.js 跑脚本或自动化', items: ['node_repl'] },
  { scenario: '创建 / 安装 / 管理技能', items: ['skill-creator', 'skill-installer', 'find-skills', 'writing-skills'] },
  { scenario: '创建 Codex 插件', items: ['plugin-creator'] },
  { scenario: '问 Codex 本身怎么用、怎么设置', items: ['openai-docs'] },
  { scenario: '把任务交接给另一个代理 / 继续对话', items: ['handoff'] },
  { scenario: '让 AI 教你一个新概念', items: ['teach'] },
  { scenario: '写 AGENTS.md 或技能文档', items: ['writing-for-agents', 'skill-creator'] },
  { scenario: '做安全扫描 / 漏洞分析', items: ['codex-security', 'security-scan', 'security-diff-scan', 'threat-model'] },
  { scenario: 'GitHub 提 PR、处理评审、修 CI', items: ['github', 'gh-address-comments', 'gh-fix-ci', 'yeet'] },
  { scenario: '接入 Vercel 部署 / 数据库 / AI 功能', items: ['vercel', 'vercel-cli', 'vercel-storage', 'ai-sdk', 'nextjs'] },
  { scenario: '监控线上错误（Sentry）', items: ['sentry'] },
];

const store = new Store(path.join(__dirname, '..', 'data', 'catalog.json'));
store.load();

let applied = 0;
const missing = [];
for (const it of store.data.items) {
  const note = NOTES[it.name];
  if (!note) { missing.push(it.name); continue; }
  it.notesZh = note.n;
  it.category = note.c;
  applied++;
}
if (store.data.quickref.length === 0) store.data.quickref = QUICKREF;
store.save();

console.log(`已写入备注 ${applied}/${store.data.items.length} 条`);
if (missing.length) console.log('缺少备注:', missing.join(', '));
console.log('速查表条目:', store.data.quickref.length);
