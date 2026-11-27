// Screenshot today's COMPUTE tabs from the worktree build (dist/index.html) on the day-400 fixture, 1920 × 1080.
// Run from the worktree root after `vite build`: node design/ux/mockups/dc/_shot.mjs
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const out = path.resolve('design/ux/mockups/dc');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('file:///' + path.resolve('dist/index.html').split(path.sep).join('/'));
await page.evaluate(() => localStorage.clear());
await page.reload();
const fx = readFileSync(path.resolve('scripts/v2/fixtures/day400.json'), 'utf8');
const err = await page.evaluate((j) => window.ai27v2.importJson(j) ?? '', fx);
if (err) throw new Error(err);
await page.evaluate(() => { const st = window.ai27v2; st.state.setup.tutorial = false; st.setHelp?.(false); st.notify(); });
for (let i = 0; i < 10; i++) {
  const b = await page.$('[data-test=recap-ok], [data-test=notice-ok], [data-test=decision] [data-choice]:not([disabled])');
  if (!b) break;
  await b.click(); await page.waitForTimeout(60);
}
await page.click('[data-nav=compute]');
await page.waitForTimeout(300);
await page.evaluate(() => window.ai27v2.setTab('compute', 'overview'));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, 'current-overview.png') });
await page.evaluate(() => window.ai27v2.setTab('compute', 'orders'));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, 'current-orders.png') });
await page.evaluate(() => window.ai27v2.setTab('compute', 'sites'));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, 'current.png') });
await browser.close();
console.log('ok');
