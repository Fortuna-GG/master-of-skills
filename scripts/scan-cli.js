'use strict';
const path = require('path');
const { scan } = require('../server/scanner');
const Store = require('../server/store');

// 命令行扫描：node scripts/scan-cli.js
const store = new Store(path.join(__dirname, '..', 'data', 'catalog.json'));
store.load();
store.mergeScan(scan());
console.log(`扫描完成：共 ${store.data.items.length} 个条目，已写入 data/catalog.json`);
