// Render the V2b mockup (v3-v2b-research.html) to PNG with headless Edge. Run from the repo root:
//   node design/ux/mockups-v3/render-v2b.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
const dir = path.resolve('design/ux/mockups-v3');
const file = 'file:///' + path.join(dir, 'v3-v2b-research.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
for (const [q, out] of [['', 'v3-v2b-research'], ['?recipe', 'v3-v2b-recipe'], ['?work', 'v3-v2b-work']]) {
  await page.goto(file + q);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(dir, `${out}.png`) });
}
await browser.close();
