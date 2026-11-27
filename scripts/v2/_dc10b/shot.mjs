// DC-10b screenshots: the Build data centre card on the day-400 fixture with Gas, 1 GW, Buildings 5 and the options row open,
// then the opposition tooltip (locked). 1920 x 1080. Run from the worktree root after `npm run build`:
// node scripts/v2/_dc10b/shot.mjs
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const out = path.resolve('scripts/v2/_dc10b');
const fx = readFileSync(path.resolve('scripts/v2/fixtures/day400.json'), 'utf8');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('file:///' + path.resolve('dist/index.html').split(path.sep).join('/'));
await page.evaluate(() => localStorage.clear());
await page.reload();
const err = await page.evaluate((j) => window.ai27v2.importJson(j) ?? '', fx);
if (err) throw new Error(err);
await page.evaluate(() => { window.ai27v2.state.setup.tutorial = false; window.ai27v2.notify(); });
await page.click('[data-nav=compute]');
await page.waitForTimeout(400);
await page.click('[data-opt="path-gas"]');
await page.click('[data-opt="site-campus"]');
await page.click('[data-test=site-buildings] [data-opt="5"]');
await page.click('[data-test="opt-site"]');
await page.waitForTimeout(600);
const lines = await page.$$eval('[data-test="preview.cmp.newSite"] .cac-line, [data-test="preview.cmp.newSite"] .cac-ba', (e) => e.map((x) => x.textContent));
console.log(JSON.stringify(lines, null, 1));
const levers = await page.$$eval('[data-lever]', (e) => e.map((x) => [x.getAttribute('data-lever'), x.textContent]));
console.log(JSON.stringify(levers));
console.log(await page.$eval('.cac-foot', (e) => e.textContent));
await page.mouse.move(5, 1075);
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(out, '1-card.png') });
// the opposition tooltip, held until it locks
await page.hover('[data-test="preview.cmp.newSite"] .cac-full:nth-child(3) b');
await page.waitForTimeout(1400);
await page.screenshot({ path: path.join(out, '2-opposition-tip.png') });
await page.mouse.move(5, 1075);
await page.waitForTimeout(400);
// the racks line tooltip and a lever tooltip, for the record
await page.hover('[data-lever="crash"]');
await page.waitForTimeout(1400);
await page.screenshot({ path: path.join(out, '3-crash-tip.png') });
console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no page errors');
await browser.close();
