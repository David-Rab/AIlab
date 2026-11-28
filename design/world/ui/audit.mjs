// Audit screenshots of the outside-world UI on the day-400 and day-900 fixtures. Run: node design/world/ui/audit.mjs
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const out = path.resolve('design/world/ui/audit'); mkdirSync(out, { recursive: true });
const url = 'file:///' + path.resolve('dist/index.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload();
const wait = (ms) => page.waitForTimeout(ms);
for (const day of ['400', '900']) {
  const fx = readFileSync(path.resolve(`scripts/v2/fixtures/day${day}.json`), 'utf8');
  const err = await page.evaluate((j) => window.ai27v2.importJson(j) ?? '', fx);
  if (err) console.log('import', err);
  await page.evaluate(() => { const st = window.ai27v2; st.state.setup.tutorial = false; st.setSpeed(0); st.notify(); });
  await wait(200);
  const shot = async (n) => { await page.mouse.move(1, 1); await page.keyboard.press('Escape'); await wait(150); await page.screenshot({ path: `${out}/d${day}-${n}.png` }); };
  const closeModals = async () => { for (let i = 0; i < 8; i++) { const c = await page.$('[data-test=decision] [data-choice]:not([disabled])'); if (c) { await c.click(); await wait(60); continue; } const n = await page.$('[data-test=notice-ok]'); if (n) { await n.click(); await wait(60); continue; } const r = await page.$('[data-test=recap-ok]'); if (r) { await r.click(); await wait(60); continue; } break; } };
  await closeModals();
  await page.click('[data-nav=relations]'); await wait(200); await shot('relations');
  await page.click('[data-nav=world]'); await wait(200);
  for (const t of ['work', 'risk', 'tech']) { await page.click(`main.center [data-tabs] [data-tab="${t}"]`); await wait(250); await shot(`world-${t}`); }
  await page.click('[data-nav=overview]'); await wait(200); await shot('overview');
  const dump = await page.evaluate(() => { const s = window.ai27v2.state; return JSON.stringify({ day: s.time.day, concern: s.public.concern, approval: s.public.approval, usgov: s.usgov, chinagov: s.chinagov, brief: s.player.policies.govBriefing }); });
  console.log(day, dump);
}
await browser.close();
