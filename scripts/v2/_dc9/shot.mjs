// DC-9 screenshots: COMPUTE › Overview on the day-400 fixture, then again after committing a gas 3 × 300 MW campus so a
// campus row is visible. 1920 × 1080. Run from the worktree root after `npm run build`: node scripts/v2/_dc9/shot.mjs
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const out = path.resolve('scripts/v2/_dc9');
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
await page.mouse.move(5, 1075);
await page.screenshot({ path: path.join(out, 'overview.png') });
console.log('rows', await page.$$eval('[data-home=sites] .dcs-row:not(.ax)', (r) => r.length));
const e2 = await page.evaluate(() => window.ai27v2.act('cmp.newSite', { path: 'gas', mw: 300, buildings: 3, crash: false, community: false, pay: 'cash' }) ?? '');
console.log('newSite', e2 || 'ok');
await page.waitForTimeout(500);
await page.mouse.move(5, 1075);
await page.screenshot({ path: path.join(out, 'overview-campus.png') });
console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no page errors');
await browser.close();
