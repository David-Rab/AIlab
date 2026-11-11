// Visual smoke test: node scripts/shot.mjs  -> screenshots in scripts/shots
import { chromium } from 'playwright-core';
import path from 'node:path';
const url = 'file:///' + path.resolve('dist/index.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
await page.goto(url);
await page.screenshot({ path: 'scripts/shots/1-start.png' });
await page.getByRole('button', { name: 'New game' }).click();
await page.screenshot({ path: 'scripts/shots/2-setup.png' });
await page.getByRole('button', { name: /Start/ }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'scripts/shots/3-game.png' });
await page.hover('.stat >> nth=3');
await page.waitForTimeout(1300);
const t1 = await page.$('.tip .term');
if (t1) { const b = await t1.boundingBox(); await page.mouse.move(b.x + 5, b.y + 5, { steps: 5 }); await page.waitForTimeout(1300); const t2 = await page.$('.tip .term'); if (t2.length > 1) { const bb = await t2[t2.length-1].boundingBox(); await page.mouse.move(bb.x + 5, bb.y + 5, { steps: 5 }); await page.waitForTimeout(900); } }
await page.screenshot({ path: 'scripts/shots/3b-tooltip.png' });
await page.mouse.move(800, 800);
await page.keyboard.press('Digit5');
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(500);
  const modal = await page.$('.modal-choices .choice');
  if (modal) { await page.screenshot({ path: `scripts/shots/4-event.png` }); await modal.click(); await page.keyboard.press('Digit5'); }
}
await page.keyboard.press('Space');
for (let k = 0; k < 5; k++) { const m = await page.$('.modal-choices .choice'); if (!m) break; await m.click(); await page.waitForTimeout(100); }
await page.screenshot({ path: 'scripts/shots/5-later.png' });
for (const tab of ['Model', 'Research', 'World']) {
  await page.getByRole('button', { name: tab, exact: true }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `scripts/shots/6-${tab}.png` });
}
await page.getByRole('button', { name: 'Overview', exact: true }).click();
await page.hover('.stat >> nth=4');
await page.waitForTimeout(1200);
const term = await page.$('.tip .term');
if (term) { await term.hover(); await page.waitForTimeout(900); }
await page.screenshot({ path: 'scripts/shots/7-tooltip.png' });
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
