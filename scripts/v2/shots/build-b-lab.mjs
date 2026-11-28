// UB-B screenshots: LAB board and its three L2 tabs (Hiring & teams, AI staff & needs, Security) at day 0 (fresh),
// day-400 and day-900 fixtures. Needs `npm run build` first. Usage: node scripts/v2/shots/build-b-lab.mjs [stage...]
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '..', '..');
const OUT = path.join(ROOT, 'scripts/v2/shots/build-b');
mkdirSync(OUT, { recursive: true });
const url = 'file:///' + path.join(ROOT, 'dist/index.html').split(path.sep).join('/');
const stages = process.argv.slice(2).length ? process.argv.slice(2) : ['d0', 'd400', 'd900'];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' ' + (e.stack ?? '').split('\n').slice(0, 4).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
const wait = (ms) => page.waitForTimeout(ms);
async function closeModals() {
  for (let i = 0; i < 30; i++) {
    const rc = await page.$('[data-test=recap-ok]'); if (rc) { await rc.click(); await wait(40); continue; }
    const hp = await page.$('[data-test=help-overlay]'); if (hp) { await page.evaluate(() => window.ai27v2.setHelp(false)); await wait(40); continue; }
    const ch = await page.$('[data-test=decision] [data-choice]:not([disabled])'); if (ch) { await ch.click(); await wait(60); continue; }
    const n = await page.$('[data-test=notice-ok]'); if (n) { await n.click(); await wait(40); continue; }
    return;
  }
}
for (const st of stages) {
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  if (st === 'd0') {
    await page.evaluate(() => { const s = window.ai27v2; s.draftSetup = { ...s.draftSetup, labKind: 'leader', tutorial: false, seed: 4242, companyName: 'OpenBrain' }; s.start(s.draftSetup); });
  } else {
    const json = readFileSync(path.join(ROOT, `scripts/v2/fixtures/day${st.slice(1)}.json`), 'utf8');
    const err = await page.evaluate((j) => window.ai27v2.importJson(j), json);
    if (err) errors.push('import: ' + err);
    await page.evaluate(() => { const s = window.ai27v2.state; s.setup.tutorial = false; window.ai27v2.notify(); });
  }
  await wait(200);
  await page.evaluate(() => window.ai27v2.setSpeed(0));
  await closeModals();
  await page.evaluate(() => window.ai27v2.setPanel('lab'));
  const shot = async (name) => { await page.mouse.move(1, 1); await wait(300); await page.screenshot({ path: path.join(OUT, `lab-${name}-${st}.png`) }); writeFileSync(path.join(OUT, `lab-${name}-${st}.txt`), await page.evaluate(() => document.querySelector('main.center')?.innerText ?? '')); };
  for (const [tab, name] of [['board', 'board'], ['people', 'hiring'], ['work', 'aistaff'], ['security', 'security']]) {
    await page.evaluate((t) => window.ai27v2.setTab('lab', t), tab);
    await shot(name);
  }
  // A board row opens its needs on AI staff & needs.
  await page.evaluate(() => window.ai27v2.setTab('lab', 'board'));
  await wait(200);
  await page.click('[data-row="re.saf"]').catch((e) => errors.push('row click: ' + e.message));
  await wait(400);
  const tab = await page.evaluate(() => window.ai27v2.tab.lab);
  console.log(st, 'board row → tab', tab);
  await shot('row-link');
  console.log(st, 'done');
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no page errors');
