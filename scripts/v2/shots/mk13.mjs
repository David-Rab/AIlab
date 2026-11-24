// MK-13 screenshots: PRODUCTS on the designer's day-369 save (the approved mockup's scenario), the default screen and
// the lineup popover on Enterprise › its second model, at the mockup's 1920×1080, to design/ux/mockups/market/built/.
// Usage: npm run build && node scripts/v2/shots/mk13.mjs [save.json]   (default: the day-400 fixture if the save is absent)
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '..', '..');
const OUT = path.join(ROOT, 'design/ux/mockups/market/built');
mkdirSync(OUT, { recursive: true });
const SAVE = process.argv[2] ?? 'C:/Users/david/Downloads/ai27-v2-day369.json';
const file = existsSync(SAVE) ? SAVE : path.join(ROOT, 'scripts/v2/fixtures/day400.json');
const url = 'file:///' + path.join(ROOT, 'dist/index.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
const wait = (ms) => page.waitForTimeout(ms);
async function closeModals() {
  for (let i = 0; i < 30; i++) {
    const rc = await page.$('[data-test=recap-ok]'); if (rc) { await rc.click(); await wait(40); continue; }
    const hp = await page.$('[data-test=help-overlay]'); if (hp) { await page.evaluate(() => window.ai27v2.setHelp(false)); await wait(40); continue; }
    const n = await page.$('[data-test=notice-ok]'); if (n) { await n.click(); await wait(40); continue; }
    return;
  }
}
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
const err = await page.evaluate((j) => window.ai27v2.importJson(j), readFileSync(file, 'utf8'));
if (err) errors.push('import: ' + err);
await page.evaluate(() => { const s = window.ai27v2.state; s.setup.tutorial = false; window.ai27v2.setSpeed(0); window.ai27v2.notify(); });
await closeModals();
await page.evaluate(() => window.ai27v2.setPanel('products'));
await wait(600);
const shot = async (name) => { await wait(250); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); writeFileSync(path.join(OUT, `${name}.txt`), await page.evaluate(() => document.querySelector('main.center')?.innerText ?? '')); };
await page.mouse.move(1, 1);
await shot('products');
// The uitest J1 O1 coverage rule on this screen: numbers on screen outside any tooltip.
const miss = await page.evaluate(() => [...document.querySelector('main.center').querySelectorAll('*')].filter((e) => {
  if (e.children.length) return false;
  const tx = (e.textContent ?? '').trim();
  if (!/\d/.test(tx) || tx.length > 40) return false;
  const b = e.getBoundingClientRect();
  return b.width > 4 && b.height > 4 && e.closest('svg') === null && !e.closest('button') && !e.closest('[data-tabs]') && !e.closest('select') && !e.closest('[data-tip]');
}).map((e) => `${e.className} | ${(e.textContent ?? '').trim().slice(0, 30)}`));
console.log(`untipped numbers on screen: ${miss.length}${miss.length ? `\n  ${miss.join('\n  ')}` : ''}`);
// The popover: Enterprise's second lineup row (the mockup's Atlas-3.0-mini).
const ent = await page.$('[data-panel=products] [data-channel=enterprise] [data-test$=".1"][data-lu]');
if (ent) {
  await ent.click();
  await wait(800);
  await page.hover('[data-test=lu-pop] button.po[data-opt]:not([data-opt=remove])').catch(() => {});
  await page.mouse.move(1, 1);
  await shot('products-swap');
} else errors.push('no Enterprise second lineup row');
console.log(`save: ${file}`);
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
