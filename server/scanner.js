'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseSkillMd, parsePluginJson, parseConfigToml } = require('./parser');

/* ---------------- 分类体系（预置 8 类 + 未分类） ---------------- */
const CATEGORIES = [
  { name: '头脑风暴与规划', keywords: ['grill', 'brainstorm', 'prototype', 'wayfinder', 'wait-what', 'questionnaire', 'to-spec', 'to-tickets', 'thinking'] },
  { name: 'UI 设计与美化', keywords: ['design', 'frontend', 'landing page', 'portfolio', 'hallmark', 'baseline', 'deslop', 'aesthetic', 'accessibility', 'motion', 'css', 'html', 'image', 'brand', 'ui'] },
  { name: '文档与办公', keywords: ['document', 'docx', 'word', 'spreadsheet', 'excel', 'presentation', 'slide', 'pdf', 'office', 'template', 'metadata', 'seo', 'sheet'] },
  { name: '代码编程与工程', keywords: ['debug', 'tdd', 'review', 'merge', 'conflict', 'architecture', 'domain', 'git', 'worktree', 'implement', 'refactor', 'security', 'superpowers', 'branch', 'commit', 'codebase', 'bug', 'test'] },
  { name: '研究与调查', keywords: ['research', 'reach', 'scrape', 'crawl', 'firecrawl', 'investigate'] },
  { name: '浏览器与自动化', keywords: ['browser', 'chrome', 'automation', 'node_repl', 'repl', 'javascript', 'localhost'] },
  { name: '系统与技能管理', keywords: ['install', 'installer', 'marketplace', 'openai docs', 'plugin', 'skill', 'config', 'review-agent'] },
  { name: '沟通与协作', keywords: ['teach', 'handoff', 'coach', 'mentor', 'explain', 'communicate', 'collaborat', 'ask'] },
];

/** 整词匹配（大小写不敏感），避免 "spec" 误中 "inspect" 这类子串问题 */
function hasWord(hay, kw) {
  if (!kw) return false;
  if (kw.includes(' ')) return hay.includes(kw);
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(hay);
}

/** 关键词规则自动归类：返回第一个命中的分类，未命中返回 未分类 */
function classify(name, description, keywords) {
  const hay = `${name} ${description} ${(keywords || []).join(' ')}`.toLowerCase();
  for (const c of CATEGORIES) {
    if (c.keywords.some((k) => hasWord(hay, k.toLowerCase()))) return c.name;
  }
  return '未分类';
}

/* ---------------- 目录/文件小工具 ---------------- */
function readdirSafe(dir) {
  try { return fs.readdirSync(dir); } catch { return []; }
}
function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}
function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}
function unique(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

/* ---------------- 扫描 ---------------- */
const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const AGENTS_SKILLS_DIR = path.join(os.homedir(), '.agents', 'skills');

// 合并优先级：插件 > 用户技能 > 系统技能 > 插件自带技能 > agents 技能
const PRIORITY = { plugin: 5, userSkill: 4, systemSkill: 3, pluginSkill: 2, agentSkill: 1 };

function scan() {
  const cfg = parseConfigToml(path.join(CODEX_HOME, 'config.toml'));

  // config.toml 里启用的插件集合：键形如 "browser@openai-bundled"
  const enabledPlugins = new Set();
  if (cfg.plugins) {
    for (const key of Object.keys(cfg.plugins)) {
      const v = cfg.plugins[key];
      if (v && v.enabled) enabledPlugins.add(key);
    }
  }

  const map = new Map(); // 小写名称 -> 规范化条目
  const order = [];

  function addItem(item, priority) {
    const key = item.name.toLowerCase();
    if (!key) return;
    const existing = map.get(key);
    if (!existing) {
      item._priority = priority;
      order.push(item);
      map.set(key, item);
      return;
    }
    const mergedSources = unique([...existing.sources, ...item.sources]);
    if (priority > existing._priority) {
      const merged = { ...item, _priority: priority, sources: mergedSources };
      order[order.indexOf(existing)] = merged;
      map.set(key, merged);
    } else {
      existing.sources = mergedSources;
      if (!existing.descriptionEn && item.descriptionEn) existing.descriptionEn = item.descriptionEn;
      if (!existing.keywords || existing.keywords.length === 0) existing.keywords = item.keywords || [];
    }
  }

  /* ---- ① 插件缓存：plugins/cache/<市场>/<插件>/<版本>/ ---- */
  const cacheRoot = path.join(CODEX_HOME, 'plugins', 'cache');
  for (const marketplace of readdirSafe(cacheRoot)) {
    if (marketplace.startsWith('.')) continue;
    const mktDir = path.join(cacheRoot, marketplace);
    if (!isDir(mktDir)) continue;
    for (const pluginDirName of readdirSafe(mktDir)) {
      const pluginDir = path.join(mktDir, pluginDirName);
      if (!isDir(pluginDir)) continue;
      let versionDirs = readdirSafe(pluginDir).filter((v) => isDir(path.join(pluginDir, v)));
      if (versionDirs.length === 0) versionDirs = [''];
      for (const version of versionDirs) {
        const verDir = path.join(pluginDir, version);
        const pjPath = path.join(verDir, '.codex-plugin', 'plugin.json');
        const pj = isFile(pjPath) ? parsePluginJson(pjPath) : null;
        if (!pj || !pj.name) continue;
        const enabled = enabledPlugins.has(`${pj.name}@${marketplace}`);
        addItem({
          id: `plugin:${pj.name.toLowerCase()}`,
          type: 'plugin',
          name: pj.name,
          displayName: pj.displayName || pj.name,
          marketplace,
          version: pj.version || version,
          enabled,
          category: classify(pj.name, pj.description, pj.keywords),
          descriptionEn: pj.description,
          keywords: pj.keywords,
          capabilities: pj.capabilities,
          author: pj.author,
          homepage: pj.homepage,
          sources: [verDir],
          notesZh: '',
          favorite: false,
          lastUsed: null,
        }, PRIORITY.plugin);

        // 插件自带技能：skills/<名称>/SKILL.md
        const skillsDir = path.join(verDir, 'skills');
        if (isDir(skillsDir)) {
          for (const sname of readdirSafe(skillsDir)) {
            const sdir = path.join(skillsDir, sname);
            if (!isDir(sdir)) continue;
            const smdPath = path.join(sdir, 'SKILL.md');
            if (!isFile(smdPath)) continue;
            const meta = parseSkillMd(smdPath);
            const skillName = meta.name || sname;
            addItem({
              id: `skill:${skillName.toLowerCase()}`,
              type: 'skill',
              name: skillName,
              displayName: skillName,
              marketplace,
              version: pj.version || version,
              enabled,
              category: classify(skillName, meta.description, []),
              descriptionEn: meta.description,
              keywords: [],
              capabilities: [],
              author: pj.author,
              homepage: '',
              fromPlugin: pj.name,
              sources: [smdPath],
              notesZh: '',
              favorite: false,
              lastUsed: null,
            }, PRIORITY.pluginSkill);
          }
        }
      }
    }
  }

  /* ---- ② 用户技能：.codex/skills/<名称>/SKILL.md ---- */
  const userSkillsRoot = path.join(CODEX_HOME, 'skills');
  for (const sname of readdirSafe(userSkillsRoot)) {
    if (sname.startsWith('.')) continue;
    const sdir = path.join(userSkillsRoot, sname);
    if (!isDir(sdir)) continue;
    const smdPath = path.join(sdir, 'SKILL.md');
    if (!isFile(smdPath)) continue;
    const meta = parseSkillMd(smdPath);
    const skillName = meta.name || sname;
    addItem({
      id: `skill:${skillName.toLowerCase()}`,
      type: 'skill',
      name: skillName,
      displayName: skillName,
      marketplace: '',
      version: '',
      enabled: true,
      category: classify(skillName, meta.description, []),
      descriptionEn: meta.description,
      keywords: [],
      capabilities: [],
      author: '',
      homepage: '',
      fromPlugin: '',
      sources: [smdPath],
      notesZh: '',
      favorite: false,
      lastUsed: null,
    }, PRIORITY.userSkill);
  }

  /* ---- ③ 系统技能：.codex/skills/.system/<名称>/SKILL.md ---- */
  const systemSkillsRoot = path.join(userSkillsRoot, '.system');
  for (const sname of readdirSafe(systemSkillsRoot)) {
    const sdir = path.join(systemSkillsRoot, sname);
    if (!isDir(sdir)) continue;
    const smdPath = path.join(sdir, 'SKILL.md');
    if (!isFile(smdPath)) continue;
    const meta = parseSkillMd(smdPath);
    const skillName = meta.name || sname;
    addItem({
      id: `skill:${skillName.toLowerCase()}`,
      type: 'skill',
      name: skillName,
      displayName: skillName,
      marketplace: '',
      version: '',
      enabled: true,
      category: classify(skillName, meta.description, []),
      descriptionEn: meta.description,
      keywords: [],
      capabilities: [],
      author: '',
      homepage: '',
      fromPlugin: '',
      sources: [smdPath],
      notesZh: '',
      favorite: false,
      lastUsed: null,
    }, PRIORITY.systemSkill);
  }

  /* ---- ④ agents 技能：~/.agents/skills/<名称>/SKILL.md ---- */
  for (const sname of readdirSafe(AGENTS_SKILLS_DIR)) {
    const sdir = path.join(AGENTS_SKILLS_DIR, sname);
    if (!isDir(sdir)) continue;
    const smdPath = path.join(sdir, 'SKILL.md');
    if (!isFile(smdPath)) continue;
    const meta = parseSkillMd(smdPath);
    const skillName = meta.name || sname;
    addItem({
      id: `skill:${skillName.toLowerCase()}`,
      type: 'skill',
      name: skillName,
      displayName: skillName,
      marketplace: '',
      version: '',
      enabled: true,
      category: classify(skillName, meta.description, []),
      descriptionEn: meta.description,
      keywords: [],
      capabilities: [],
      author: '',
      homepage: '',
      fromPlugin: '',
      sources: [smdPath],
      notesZh: '',
      favorite: false,
      lastUsed: null,
    }, PRIORITY.agentSkill);
  }

  /* ---- ⑤ MCP 服务器：config.toml 的 [mcp_servers.xxx] ---- */
  if (cfg.mcp_servers) {
    for (const key of Object.keys(cfg.mcp_servers)) {
      const v = cfg.mcp_servers[key];
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      const command = v.command || '';
      const args = Array.isArray(v.args) ? v.args.map(String) : [];
      addItem({
        id: `mcp:${key.toLowerCase()}`,
        type: 'mcp',
        name: key,
        displayName: key,
        marketplace: '',
        version: '',
        enabled: true,
        category: classify(key, command + ' ' + args.join(' '), []),
        descriptionEn: '',
        keywords: [],
        capabilities: [],
        author: '',
        homepage: '',
        fromPlugin: '',
        command,
        args,
        sources: [path.join(CODEX_HOME, 'config.toml')],
        notesZh: '',
        favorite: false,
        lastUsed: null,
      }, PRIORITY.plugin);
    }
  }

  // 输出时去掉内部字段 _priority
  return order.map(({ _priority, ...rest }) => rest);
}

module.exports = { scan, CATEGORIES, classify, hasWord, CODEX_HOME, AGENTS_SKILLS_DIR };
