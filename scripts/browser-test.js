'use strict';
const { chromium } = require('C:/Users/Administrator/AppData/Local/OpenAI/Codex/runtimes/cua_node/f1bf3cd3a5929acd/bin/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', '.tmp-shots');
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ✅', label); }
  else { fail++; console.log('  ❌', label); }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  console.log('=== 1. 首页加载 ===');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForSelector('#view-home .stat-card', { timeout: 5000 });
  const statNums = await page.$$eval('#view-home .stat-num', (els) => els.map((e) => Number(e.textContent)));
  ok(statNums.length === 5, `首页统计卡片 5 个（${statNums.join('/')}）`);
  ok(statNums[0] === 140, '总条目 140');
  const catCount = await page.$$eval('#view-home .cat-card', (els) => els.length);
  ok(catCount === 8, `分类卡片 8 个（实际 ${catCount}）`);
  await page.screenshot({ path: path.join(OUT, '1-home.png') });

  console.log('=== 2. 技能库搜索 ===');
  await page.click('.tab[data-tab="library"]');
  await page.waitForSelector('#view-library .item-card', { timeout: 3000 });
  await page.fill('#view-library #search-input', 'pdf');
  await page.waitForTimeout(300);
  let cards = await page.$$eval('#view-library .item-card', (els) => els.map((e) => e.dataset.id));
  ok(cards.length === 1 && cards[0] === 'plugin:pdf', `搜索 pdf 只命中 1 张卡片（${cards.join(',')}）`);
  await page.screenshot({ path: path.join(OUT, '2-search-pdf.png') });

  await page.fill('#view-library #search-input', 'grilling');
  await page.waitForTimeout(300);
  cards = await page.$$eval('#view-library .item-card', (els) => els.map((e) => e.dataset.id));
  ok(cards.length === 1 && cards[0] === 'skill:grilling', `搜索 grilling 命中 1 张卡片（${cards.join(',')}）`);

  console.log('=== 3. 详情弹窗 ===');
  await page.click('#view-library .item-card[data-id="skill:grilling"]');
  await page.waitForSelector('#modal:not([hidden])', { timeout: 3000 });
  const title = (await page.textContent('#modal-title')).trim();
  ok(title.includes('grilling'), `弹窗标题 ${title}`);
  const notesVal = await page.inputValue('#edit-notes');
  ok(notesVal.includes('拷问'), '备注内容已预填中文');
  await page.screenshot({ path: path.join(OUT, '3-detail.png') });

  console.log('=== 4. 编辑备注并保存 ===');
  await page.fill('#edit-notes', notesVal + '【测试】');
  await page.click('#btn-save');
  await page.waitForTimeout(400);
  ok(await page.$eval('#modal', (m) => m.hidden), '保存后弹窗关闭');
  await page.click('#view-library .item-card[data-id="skill:grilling"]');
  await page.waitForSelector('#modal:not([hidden])');
  const savedVal = await page.inputValue('#edit-notes');
  ok(savedVal.endsWith('【测试】'), '备注修改已持久化');
  await page.fill('#edit-notes', notesVal); // 还原
  await page.click('#btn-save');
  await page.waitForTimeout(400);

  console.log('=== 5. 收藏 ===');
  await page.click('#view-library .item-card[data-id="skill:grilling"] .fav-star');
  await page.waitForTimeout(500);
  const favOn = await page.$eval('#view-library .item-card[data-id="skill:grilling"] .fav-star', (e) => e.classList.contains('on'));
  ok(favOn, '收藏星标点亮');
  await page.click('#view-library .item-card[data-id="skill:grilling"] .fav-star'); // 取消收藏，保持数据干净
  await page.waitForTimeout(500);

  console.log('=== 6. 场景速查表 ===');
  await page.click('.tab[data-tab="quickref"]');
  await page.waitForSelector('#view-quickref .qr-row', { timeout: 3000 });
  const qrCount = await page.$$eval('#view-quickref .qr-row', (els) => els.length);
  ok(qrCount === 29, `速查表 ${qrCount} 行`);
  await page.screenshot({ path: path.join(OUT, '4-quickref.png') });
  await page.click('#qr-edit');
  await page.waitForSelector('#view-quickref .qr-edit', { timeout: 3000 });
  await page.screenshot({ path: path.join(OUT, '5-quickref-edit.png') });
  await page.click('#qr-cancel');

  console.log('=== 7. 设置页 ===');
  await page.click('.tab[data-tab="settings"]');
  await page.waitForSelector('#view-settings #btn-rescan', { timeout: 3000 });
  const scannedText = await page.textContent('#view-settings');
  ok(scannedText.includes('上次扫描时间'), '设置页显示扫描信息');
  await page.screenshot({ path: path.join(OUT, '6-settings.png') });

  console.log('=== 8. 重新扫描 ===');
  await page.click('#btn-rescan');
  await page.waitForFunction(() => document.querySelector('#rescan-msg')?.textContent.includes('完成'), null, { timeout: 20000 });
  const msg = await page.textContent('#rescan-msg');
  ok(msg.includes('140'), `rescan 完成 ${msg}`);

  console.log('=== 结果 ===');
  ok(errors.length === 0, `JS 错误数 ${errors.length} ${errors.join('; ')}`);
  await browser.close();
  console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('测试异常:', e); process.exit(1); });
