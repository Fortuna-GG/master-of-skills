'use strict';
const fs = require('fs');
const path = require('path');

/**
 * 本地 JSON 数据存取。
 * 关键职责：重新扫描时合并，保留用户的备注 / 手动分类 / 收藏 / 最近使用。
 */
class Store {
  constructor(file) {
    this.file = file;
    this.data = { scannedAt: null, items: [], quickref: [] };
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = { ...this.data, ...parsed };
    } catch {
      /* 首次运行：保持默认结构 */
    }
    return this.data;
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
  }

  /** 用新扫描结果合并数据：新条目入库，旧条目保留用户改动，消失的条目移除 */
  mergeScan(freshItems) {
    const oldMap = new Map(this.data.items.map((i) => [i.id, i]));
    const merged = freshItems.map((f) => {
      const o = oldMap.get(f.id);
      if (!o) return f;
      return {
        ...f,
        notesZh: o.notesZh || f.notesZh || '',
        category: o.category || f.category || '未分类',
        favorite: !!o.favorite,
        lastUsed: o.lastUsed || null,
      };
    });
    this.data.items = merged;
    this.data.scannedAt = new Date().toISOString();
    this.save();
    return this.data;
  }

  updateItem(id, patch) {
    const it = this.data.items.find((i) => i.id === id);
    if (!it) return null;
    const allowed = ['notesZh', 'category', 'favorite'];
    for (const k of allowed) {
      if (k in patch) it[k] = patch[k];
    }
    this.save();
    return it;
  }

  markUsed(id) {
    const it = this.data.items.find((i) => i.id === id);
    if (!it) return null;
    it.lastUsed = new Date().toISOString();
    this.save();
    return it;
  }
}

module.exports = Store;
