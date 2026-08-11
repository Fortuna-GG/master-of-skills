'use strict';
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');
const { scan, CATEGORIES } = require('./scanner');
const Store = require('./store');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DATA_FILE = path.join(__dirname, '..', 'data', 'catalog.json');

const store = new Store(DATA_FILE);
store.load();
if (!store.data.scannedAt || !Array.isArray(store.data.items) || store.data.items.length === 0) {
  console.log('[首次运行] 正在扫描 Codex 插件 / 技能 / MCP ...');
  store.mergeScan(scan());
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(PUBLIC_DIR));

app.get('/api/items', (req, res) => {
  res.json({ items: store.data.items, scannedAt: store.data.scannedAt });
});

app.post('/api/items/:id', (req, res) => {
  const updated = store.updateItem(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: '未找到该条目' });
  res.json(updated);
});

app.post('/api/items/:id/use', (req, res) => {
  const updated = store.markUsed(req.params.id);
  if (!updated) return res.status(404).json({ error: '未找到该条目' });
  res.json(updated);
});

app.post('/api/rescan', (req, res) => {
  try {
    const fresh = scan();
    store.mergeScan(fresh);
    res.json({ ok: true, scannedAt: store.data.scannedAt, count: store.data.items.length });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

app.get('/api/quickref', (req, res) => {
  res.json({ entries: store.data.quickref || [] });
});

app.post('/api/quickref', (req, res) => {
  const entries = Array.isArray(req.body && req.body.entries) ? req.body.entries : [];
  store.data.quickref = entries;
  store.save();
  res.json({ ok: true, count: entries.length });
});

app.get('/api/categories', (req, res) => {
  const counts = {};
  for (const it of store.data.items) {
    const c = it.category || '未分类';
    counts[c] = (counts[c] || 0) + 1;
  }
  res.json({
    categories: CATEGORIES.map((c) => c.name),
    counts,
    rules: CATEGORIES.map((c) => ({ name: c.name, keywords: c.keywords })),
  });
});

app.listen(PORT, () => {
  console.log(`技能管家已启动：http://localhost:${PORT}`);
  console.log('（按 Ctrl+C 停止）');
  if (process.env.SKIP_OPEN !== '1') {
    try {
      spawn('cmd', ['/c', 'start', '', `http://localhost:${PORT}`], { detached: true, stdio: 'ignore' }).unref();
    } catch {
      /* 打开浏览器失败不影响服务 */
    }
  }
});
