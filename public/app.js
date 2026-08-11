'use strict';

/* ================= 状态 ================= */
const state = {
  items: [],
  scannedAt: null,
  quickref: [],
  categories: [],
  counts: {},
  rules: [],
  tab: 'home',
  search: '',
  catFilter: '全部',
  typeFilter: '全部',
  detailId: null,
  qrEditing: false,
};

/* ================= 工具 ================= */
const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function api(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const TYPE_META = {
  plugin: { label: '插件', emoji: '🧩' },
  skill: { label: '技能', emoji: '🎯' },
  mcp: { label: 'MCP', emoji: '🔌' },
};

function typeBadge(it) {
  const m = TYPE_META[it.type] || { label: it.type, emoji: '📦' };
  return `<span class="badge type-${it.type}">${m.emoji} ${m.label}</span>`;
}

function catBadge(it) {
  return `<span class="badge cat">📂 ${esc(it.category || '未分类')}</span>`;
}

function srcBadge(it) {
  if (it.type === 'plugin') return `<span class="badge src">📦 ${esc(it.marketplace)}</span>`;
  if (it.fromPlugin) return `<span class="badge src">🔗 ${esc(it.fromPlugin)} 自带</span>`;
  if (it.type === 'mcp') return `<span class="badge src">🔌 config.toml</span>`;
  return `<span class="badge src">💠 技能</span>`;
}

function enabledBadge(it) {
  if (it.type === 'mcp') return `<span class="badge on">✓ 已配置</span>`;
  return it.enabled ? '<span class="badge on">✓ 已启用</span>' : '<span class="badge off">✗ 未启用</span>';
}

/* ================= 数据加载 ================= */
async function loadAll() {
  const [itemsRes, qrRes, catRes] = await Promise.all([
    api('/api/items'),
    api('/api/quickref'),
    api('/api/categories'),
  ]);
  state.items = itemsRes.items;
  state.scannedAt = itemsRes.scannedAt;
  state.quickref = qrRes.entries;
  state.categories = catRes.categories || [];
  state.counts = catRes.counts || {};
  state.rules = catRes.rules || [];
}

/* ================= 渲染：首页 ================= */
function renderHome() {
  const { items } = state;
  const favs = items.filter((i) => i.favorite);
  const used = items.filter((i) => i.lastUsed).sort((a, b) => (b.lastUsed || '').localeCompare(a.lastUsed || '')).slice(0, 8);

  const typeCount = (t) => items.filter((i) => i.type === t).length;
  const cats = state.categories.map((c) => ({ name: c, count: state.counts[c] || 0 }))
    .sort((a, b) => b.count - a.count);

  $('#view-home').innerHTML = `
    <div class="stats">
      <div class="stat-card"><div class="stat-num">${items.length}</div><div class="stat-label">全部条目</div></div>
      <div class="stat-card"><div class="stat-num">${typeCount('plugin')}</div><div class="stat-label">插件</div></div>
      <div class="stat-card"><div class="stat-num">${typeCount('skill')}</div><div class="stat-label">技能</div></div>
      <div class="stat-card"><div class="stat-num">${typeCount('mcp')}</div><div class="stat-label">MCP 服务器</div></div>
      <div class="stat-card"><div class="stat-num">${favs.length}</div><div class="stat-label">⭐ 已收藏</div></div>
    </div>

    <h3 class="section-title">📂 分类一览（点击查看该类）</h3>
    <div class="cat-grid">
      ${cats.map((c) => `
        <div class="cat-card" data-cat="${esc(c.name)}">
          <div class="cat-name">${esc(c.name)}</div>
          <div class="cat-count">${c.count} 个条目</div>
        </div>`).join('')}
    </div>

    <h3 class="section-title">⭐ 收藏与最近使用</h3>
    <div class="card-grid">
      ${[...favs, ...used.filter((u) => !favs.some((f) => f.id === u.id))].slice(0, 8).map(cardHTML).join('') || '<div class="empty-tip">还没有收藏或使用记录。去技能库逛逛，把常用的点个 ⭐ 吧。</div>'}
    </div>
  `;
}

/* ================= 渲染：技能库 ================= */
function visibleItems() {
  const q = state.search.trim().toLowerCase();
  return state.items.filter((it) => {
    if (state.typeFilter !== '全部' && it.type !== state.typeFilter) return false;
    if (state.catFilter !== '全部' && (it.category || '未分类') !== state.catFilter) return false;
    if (!q) return true;
    const hay = `${it.name} ${it.displayName} ${it.descriptionEn} ${it.notesZh} ${it.keywords.join(' ')} ${it.marketplace} ${it.fromPlugin}`.toLowerCase();
    return hay.includes(q);
  });
}

function cardHTML(it) {
  return `
    <div class="item-card" data-id="${esc(it.id)}">
      <div class="card-top">
        <div class="card-name">${esc(it.name)}</div>
        <button class="fav-star ${it.favorite ? 'on' : ''}" data-fav="${esc(it.id)}" title="收藏">${it.favorite ? '⭐' : '☆'}</button>
      </div>
      ${it.notesZh ? `<div class="card-notes">${esc(it.notesZh)}</div>` : ''}
      ${it.descriptionEn ? `<div class="card-desc">${esc(it.descriptionEn)}</div>` : ''}
      <div class="badge-row">${typeBadge(it)}${catBadge(it)}${srcBadge(it)}${enabledBadge(it)}</div>
    </div>`;
}

function renderLibrary() {
  const list = visibleItems();
  $('#view-library').innerHTML = `
    <div class="toolbar">
      <div class="search-box"><input id="search-input" type="text" placeholder="搜名称 / 关键词 / 用途..." value="${esc(state.search)}"></div>
      <button class="chip ${state.typeFilter === '全部' ? 'active' : ''}" data-type="全部">全部</button>
      <button class="chip ${state.typeFilter === 'plugin' ? 'active' : ''}" data-type="plugin">🧩 插件</button>
      <button class="chip ${state.typeFilter === 'skill' ? 'active' : ''}" data-type="skill">🎯 技能</button>
      <button class="chip ${state.typeFilter === 'mcp' ? 'active' : ''}" data-type="mcp">🔌 MCP</button>
    </div>
    <div class="toolbar">
      <select id="cat-select" class="chip" style="border-radius:10px;padding:6px 10px;">
        <option value="全部">📂 全部分类</option>
        ${state.categories.map((c) => `<option value="${esc(c)}" ${state.catFilter === c ? 'selected' : ''}>${esc(c)}（${state.counts[c] || 0}）</option>`).join('')}
      </select>
      <span style="color:var(--muted);font-size:13px;">共 ${list.length} 条</span>
    </div>
    <div class="card-grid">
      ${list.map(cardHTML).join('') || '<div class="empty-tip">没有匹配的条目，换个关键词试试～</div>'}
    </div>
  `;
}

/* ================= 详情弹窗 ================= */
function openDetail(id) {
  const it = state.items.find((x) => x.id === id);
  if (!it) return;
  state.detailId = id;
  $('#modal-title').textContent = `${TYPE_META[it.type]?.emoji || ''} ${it.name}`;
  $('#modal-badges').innerHTML = `${typeBadge(it)}${catBadge(it)}${srcBadge(it)}${enabledBadge(it)}`;
  $('#edit-notes').value = it.notesZh || '';
  $('#edit-fav').checked = !!it.favorite;
  $('#edit-category').innerHTML = state.categories
    .map((c) => `<option value="${esc(c)}" ${(it.category || '未分类') === c ? 'selected' : ''}>${esc(c)}</option>`)
    .join('');
  $('#modal-desc').textContent = it.descriptionEn || '（无英文简介）';

  const meta = [];
  if (it.type === 'plugin') {
    meta.push(['市场', it.marketplace], ['版本', it.version], ['作者', it.author || '—'], ['主页', it.homepage || '—']);
    if (it.capabilities && it.capabilities.length) meta.push(['能力', it.capabilities.join(', ')]);
  }
  if (it.type === 'mcp') meta.push(['命令', it.command], ['参数', (it.args || []).join(' ') || '—']);
  if (it.keywords && it.keywords.length) meta.push(['关键词', it.keywords.join(', ')]);
  if (it.lastUsed) meta.push(['最近使用', fmtTime(it.lastUsed)]);
  meta.push(['数据编号', it.id]);

  $('#modal-meta').innerHTML = meta.map(([k, v]) => `<div class="meta-item"><b>${esc(k)}</b>${esc(v)}</div>`).join('');
  $('#modal-sources').innerHTML = it.sources.map((s) => `<li>${esc(s)}</li>`).join('');
  $('#modal').hidden = false;
}

function closeDetail() {
  state.detailId = null;
  $('#modal').hidden = true;
}

async function saveDetail() {
  const it = state.items.find((x) => x.id === state.detailId);
  if (!it) return;
  const body = {
    notesZh: $('#edit-notes').value,
    category: $('#edit-category').value,
    favorite: $('#edit-fav').checked,
  };
  const updated = await api(`/api/items/${encodeURIComponent(it.id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  Object.assign(it, updated);
  closeDetail();
  render();
}

/* ================= 渲染：场景速查 ================= */
const nameById = new Map();
function renderQuickref() {
  nameById.clear();
  for (const it of state.items) nameById.set(it.id, it.name);

  const rows = state.quickref.map((e, idx) => {
    const chips = (e.items || []).map((id) => {
      const n = nameById.get(id);
      return n ? `<span class="chip-item">${esc(n)}</span>` : `<span class="chip-item" style="opacity:.5">${esc(id)}（未找到）</span>`;
    }).join('');
    return `
      <div class="qr-row" data-idx="${idx}">
        <div class="qr-scenario">${esc(e.scenario)}</div>
        <div class="qr-items"><div class="chip-list">${chips || '<span style="color:var(--muted)">（空）</span>'}</div></div>
      </div>`;
  }).join('');

  const editRows = state.quickref.map((e, idx) => `
    <div class="qr-row qr-edit" data-idx="${idx}">
      <input type="text" class="qr-scenario" data-k="scenario" value="${esc(e.scenario)}" placeholder="场景描述">
      <input type="text" class="qr-items" data-k="items" value="${esc((e.items || []).map((id) => nameById.get(id) || id).join(', '))}" placeholder="技能名，用逗号分隔">
      <button class="btn ghost qr-del" data-idx="${idx}">删除</button>
    </div>`).join('');

  $('#view-quickref').innerHTML = `
    <h3 class="section-title">⚡ "想做 X → 用谁" 速查表</h3>
    <p style="color:var(--muted);font-size:13px;">已预填常用场景，可自由增删改。技能名用逗号分隔，保存时自动匹配。</p>
    ${state.qrEditing ? `
      <div class="panel" style="box-shadow:none;padding:0;">
        ${editRows}
        <div style="display:flex;gap:10px;margin-top:10px;">
          <button class="btn ghost" id="qr-add">＋ 新增一行</button>
          <button class="btn primary" id="qr-save">💾 保存修改</button>
          <button class="btn ghost" id="qr-cancel">取消</button>
        </div>
      </div>` : `
      <div class="panel" style="box-shadow:none;padding:0;">
        ${rows}
        <div style="margin-top:10px;">
          <button class="btn primary" id="qr-edit">✏️ 编辑速查表</button>
        </div>
      </div>`}
  `;
}

/* ================= 渲染：设置 ================= */
function renderSettings() {
  $('#view-settings').innerHTML = `
    <div class="panel">
      <h3>🔄 数据扫描</h3>
      <p style="color:var(--muted);font-size:13px;">扫描 Codex 的插件缓存、技能目录与 config.toml，自动发现新增/移除的条目。重新扫描会保留你的备注、分类、收藏和最近使用记录。</p>
      <p>上次扫描时间：<span class="mono">${fmtTime(state.scannedAt)}</span>　当前条目：<span class="mono">${state.items.length}</span></p>
      <button class="btn primary" id="btn-rescan">🔄 立即重新扫描</button>
      <span id="rescan-msg" style="margin-left:10px;color:var(--ok);font-size:13px;"></span>
    </div>
    <div class="panel">
      <h3>💾 数据文件</h3>
      <p style="font-size:13px;">所有备注、分类、收藏、速查表都保存在本地 JSON 文件里，改动不会写回任何技能/插件原文件：</p>
      <p class="mono">data/catalog.json</p>
      <p style="font-size:12px;color:var(--muted);">备份方法：复制这个文件即可。想恢复旧数据，把备份覆盖回来再启动应用。</p>
    </div>
    <div class="panel">
      <h3>📂 分类规则（自动归类用）</h3>
      <p style="color:var(--muted);font-size:12px;">新扫描出的条目按关键词自动归类；已有条目的分类以你在详情里手动改的为准，不会被规则覆盖。</p>
      <ul class="rule-list">
        ${state.rules.map((r) => `<li><b>${esc(r.name)}</b>：<span class="kw">${esc(r.keywords.join('、'))}</span></li>`).join('')}
      </ul>
    </div>
    <div class="panel">
      <h3>🔒 隐私说明</h3>
      <p style="font-size:13px;color:var(--muted);">本应用完全本地运行、不联网、不上传任何数据（v1 未接入任何 AI 服务）。</p>
    </div>
  `;
}

/* ================= 事件绑定 ================= */
function bindEvents() {
  // 页签
  $('#tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    state.tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === btn));
    render();
  });

  // 首页：分类卡片
  $('#view-home').addEventListener('click', (e) => {
    const card = e.target.closest('.cat-card');
    if (card) {
      state.catFilter = card.dataset.cat;
      state.tab = 'library';
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'library'));
      render();
    }
  });

  // 技能库：搜索 / 类型筛选 / 分类筛选 / 卡片 / 收藏
  $('#view-library').addEventListener('input', (e) => {
    if (e.target.id === 'search-input') {
      state.search = e.target.value;
      renderLibrary();
    }
  });
  $('#view-library').addEventListener('change', (e) => {
    if (e.target.id === 'cat-select') {
      state.catFilter = e.target.value;
      renderLibrary();
    }
  });
  $('#view-library').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-type]');
    if (chip) {
      state.typeFilter = chip.dataset.type;
      renderLibrary();
      return;
    }
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.stopPropagation();
      const it = state.items.find((x) => x.id === fav.dataset.fav);
      if (!it) return;
      it.favorite = !it.favorite;
      api(`/api/items/${encodeURIComponent(it.id)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: it.favorite }),
      }).then((u) => Object.assign(it, u)).catch(() => { it.favorite = !it.favorite; });
      renderLibrary();
      return;
    }
    const card = e.target.closest('.item-card');
    if (card) openDetail(card.dataset.id);
  });

  // 弹窗
  $('#modal-close').addEventListener('click', closeDetail);
  $('#modal').addEventListener('click', (e) => { if (e.target === $('#modal')) closeDetail(); });
  $('#btn-save').addEventListener('click', saveDetail);
  $('#btn-use').addEventListener('click', async () => {
    const it = state.items.find((x) => x.id === state.detailId);
    if (!it) return;
    const u = await api(`/api/items/${encodeURIComponent(it.id)}/use`, { method: 'POST' });
    Object.assign(it, u);
    renderQuickrefAndDetail();
  });

  // 速查表
  $('#view-quickref').addEventListener('click', async (e) => {
    if (e.target.id === 'qr-edit') { state.qrEditing = true; renderQuickref(); return; }
    if (e.target.id === 'qr-cancel') { state.qrEditing = false; renderQuickref(); return; }
    if (e.target.id === 'qr-add') {
      state.quickref.push({ scenario: '新场景', items: [] });
      renderQuickref();
      return;
    }
    if (e.target.id === 'qr-save') {
      const rows = [...document.querySelectorAll('#view-quickref .qr-edit')];
      state.quickref = rows.map((row) => {
        const scenario = row.querySelector('[data-k="scenario"]').value.trim();
        const raw = row.querySelector('[data-k="items"]').value;
        const names = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
        const items = names.map((n) => {
          const found = state.items.find((it) => it.name.toLowerCase() === n.toLowerCase());
          return found ? found.id : null;
        }).filter(Boolean);
        return { scenario, items };
      }).filter((e2) => e2.scenario);
      await api('/api/quickref', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: state.quickref }),
      });
      state.qrEditing = false;
      renderQuickref();
      return;
    }
    const del = e.target.closest('.qr-del');
    if (del) {
      state.quickref.splice(Number(del.dataset.idx), 1);
      renderQuickref();
    }
  });

  // 设置：重新扫描
  $('#view-settings').addEventListener('click', async (e) => {
    if (e.target.id !== 'btn-rescan') return;
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = '⏳ 扫描中...';
    try {
      const r = await api('/api/rescan', { method: 'POST' });
      await loadAll();
      render();
      $('#rescan-msg').textContent = `✅ 完成，共 ${r.count} 条`;
    } catch (err) {
      $('#rescan-msg').textContent = `❌ 失败：${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = '🔄 立即重新扫描';
    }
  });
}

function renderQuickrefAndDetail() {
  renderQuickref();
  if (state.detailId) openDetail(state.detailId);
}

/* ================= 入口 ================= */
function render() {
  for (const v of ['home', 'library', 'quickref', 'settings']) {
    $('#view-' + v).hidden = state.tab !== v;
  }
  renderHome();
  renderLibrary();
  renderQuickref();
  renderSettings();
}

(async function init() {
  bindEvents();
  try {
    await loadAll();
  } catch (err) {
    $('#view-home').innerHTML = `<div class="empty-tip">加载失败：${esc(err.message)}</div>`;
    return;
  }
  render();
})();
