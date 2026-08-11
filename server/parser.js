'use strict';
const fs = require('fs');
const path = require('path');
const toml = require('@iarna/toml');

/** 去掉字符串两端的引号，并还原常见转义 */
function unquote(v) {
  if (typeof v !== 'string') return v;
  let s = v.trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    s = s.slice(1, -1);
  }
  return s
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, '\n')
    .replace(/\\\\/g, '\\');
}

/** 解析 Markdown 开头的 YAML frontmatter（支持单行值、多行 | 块、列表） */
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return {};
  const meta = {};
  const lines = m[1].split(/\r?\n/);
  let multiline = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (multiline) {
      if (raw.trim() === '' || /^\s{2,}/.test(raw)) {
        multiline.parts.push(raw.replace(/^\s+/, ''));
        continue;
      }
      meta[multiline.key] = multiline.parts.join('\n').trim();
      multiline = null;
    }
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();
    if (val === '|' || val === '>' || val === '|-') {
      multiline = { key, parts: [] };
    } else if (val === '') {
      meta[key] = '';
    } else {
      meta[key] = unquote(val);
    }
  }
  if (multiline) meta[multiline.key] = multiline.parts.join('\n').trim();
  return meta;
}

/** 解析 SKILL.md：返回 { name, description, meta } */
function parseSkillMd(filePath) {
  const fallbackName = path.basename(path.dirname(filePath));
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const meta = parseFrontmatter(text);
    return {
      name: (meta.name || fallbackName).trim(),
      description: (meta.description || '').trim(),
      meta,
    };
  } catch {
    return { name: fallbackName, description: '', meta: {} };
  }
}

/** 解析插件 plugin.json：返回规范化对象，失败返回 null */
function parsePluginJson(filePath) {
  try {
    const pj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const itf = pj.interface || {};
    const description = itf.longDescription || itf.shortDescription || pj.description || '';
    return {
      name: String(pj.name || '').trim(),
      version: String(pj.version || '').trim(),
      description: String(description).trim(),
      displayName: String(itf.displayName || pj.name || '').trim(),
      category: String(itf.category || '').trim(),
      capabilities: Array.isArray(itf.capabilities) ? itf.capabilities.map(String) : [],
      keywords: Array.isArray(pj.keywords) ? pj.keywords.map(String) : [],
      author: (pj.author && pj.author.name) ? String(pj.author.name) : '',
      homepage: String(pj.homepage || '').trim(),
    };
  } catch {
    return null;
  }
}

/** 解析 Codex config.toml，失败返回空对象 */
function parseConfigToml(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return toml.parse(text);
  } catch {
    return {};
  }
}

module.exports = { unquote, parseFrontmatter, parseSkillMd, parsePluginJson, parseConfigToml };
