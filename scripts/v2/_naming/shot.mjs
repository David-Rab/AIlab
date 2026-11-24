// Screenshot of MODELS with the Names row open, warships + generic (MODEL-NAMING §11). Run after npm run build.
import { chromium } from 'playwright-core';
import path from 'node:path';
const url = 'file:///' + path.resolve('dist/index.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.click('[data-test=new-game]');
await page.click('[data-picker=tutorial] [data-opt="false"]').catch(() => {});
await page.click('[data-test=start-game]');
await page.waitForTimeout(400);
for (let i = 0; i < 10; i++) {
  const b = await page.$('[data-test=recap-ok], [data-test=notice-ok], [data-test=decision] [data-choice]:not([disabled])');
  if (!b) break;
  await b.click(); await page.waitForTimeout(60);
}
await page.evaluate(() => { window.ai27v2.setHelp?.(false); window.ai27v2.setSpeed(0); window.ai27v2.setTab('models', 'versions'); });
await page.click('[data-nav=models]');
await page.waitForTimeout(200);
await page.click('[data-test=models-names]');
await page.selectOption('[data-test=names-theme]', 'warships');
await page.waitForTimeout(200);
const names = await page.evaluate(() => window.ai27v2.state.player.models.versions.map((v) => v.name));
await page.screenshot({ path: 'scripts/v2/_naming/models-names.png' });
await page.locator('.md-bh').first().hover();
await page.waitForTimeout(400);
await page.screenshot({ path: 'scripts/v2/_naming/models-base-tip.png' });
console.log(JSON.stringify({ names, errors }));
await browser.close();
