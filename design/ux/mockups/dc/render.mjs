// Render the data-centre mockup: today's app (worktree build, day-400 fixture) with build.js injected. 1920 × 1080.
// Run from the worktree root after `vite build`: node design/ux/mockups/dc/render.mjs   → build.png, build-tips.png
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve('design/ux/mockups/dc');
const inject = readFileSync(path.join(dir, 'build.js'), 'utf8');
const fx = readFileSync(path.resolve('scripts/v2/fixtures/day400.json'), 'utf8');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
for (const [name, tips] of [['build', false], ['build-tips', true]]) {
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
  await page.waitForTimeout(300);
  await page.click('[data-test=opt-site]');
  await page.mouse.move(5, 1075);
  await page.waitForTimeout(300);
  await page.evaluate((t) => { window.DC_TIPS = t; }, tips);
  await page.addScriptTag({ content: inject });
  await page.waitForTimeout(500);
  // the chart re-renders on resize: re-apply its marker text
  await page.evaluate(() => document.querySelectorAll('.cfc svg text').forEach((t) => { if (t.textContent.includes('Red River')) t.textContent = t.textContent.replace('2.0 GW', '1.0 GW'); }));
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
  console.log('ok', name, errors.length ? 'ERRORS: ' + errors.join(' | ') : '');
  await page.close();
}
await browser.close();
