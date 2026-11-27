// DC-10a screenshots: the Build data centre card on the day-400 fixture with Gas, 1 GW, Buildings 5, then the Buildings
// tooltip (locked) and the Grid tile tooltip. 1920 × 1080. Run from the worktree root after `npm run build`:
// node scripts/v2/_dc10a/shot.mjs
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const out = path.resolve('scripts/v2/_dc10a');
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
await page.waitForTimeout(300);
const tiles = await page.$$eval('[data-opt^="path-"]', (e) => e.map((x) => [x.getAttribute('data-opt'), x.textContent]));
console.log(JSON.stringify(tiles));
await page.mouse.move(5, 1075);
await page.screenshot({ path: path.join(out, '1-card.png') });
// the Buildings tooltip, held until it locks
await page.hover('[data-test=site-buildings]');
await page.waitForTimeout(1300);
await page.screenshot({ path: path.join(out, '2-buildings-tip.png') });
await page.mouse.move(5, 1075);
await page.waitForTimeout(400);
// the Grid tile tooltip
await page.hover('[data-opt="path-grid"]');
await page.waitForTimeout(1300);
await page.screenshot({ path: path.join(out, '3-grid-tip.png') });
console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no page errors');
await browser.close();
