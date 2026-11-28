// Corporate-structure screenshots (C6-C8): setup lab-kind row, Custom with its preview line, Create rivals with owner and
// backer pickers, the Board card (mission-controlled leader at day 400; a big-tech division at day 0), the Partners card
// and a preview with the "After:" control line. Needs `npm run build` first. Usage: node scripts/v2/shots/corp.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '..', '..');
const OUT = path.join(ROOT, 'scripts/v2/shots/corp');
mkdirSync(OUT, { recursive: true });
const url = 'file:///' + path.join(ROOT, 'dist/index.html').split(path.sep).join('/');
const fixture = (n) => readFileSync(path.join(ROOT, `scripts/v2/fixtures/${n}.json`), 'utf8');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
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
const shot = async (name, sel) => {
  await page.mouse.move(1, 1); await wait(350);
  const el = sel ? await page.$(sel) : null;
  if (sel && !el) { errors.push(`missing ${sel} for ${name}`); return; }
  await (el ?? page).screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('shot', name);
};
const load = async (json) => {
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload();
  const err = await page.evaluate((j) => window.ai27v2.importJson(j), json);
  if (err) errors.push('import: ' + err);
  await page.evaluate(() => { window.ai27v2.state.setup.tutorial = false; window.ai27v2.setSpeed(0); window.ai27v2.notify(); });
  await closeModals();
};
const open = async (panel, tab) => { await page.evaluate(([p, t]) => { window.ai27v2.setPanel(p); if (t) window.ai27v2.setTab(p, t); }, [panel, tab]); await wait(400); };

// (a)-(c) Setup
await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload();
await page.click('[data-test=new-game]'); await wait(300);
await shot('a-setup-kinds', '[data-picker=start]');
await page.click('[data-picker=start] [data-opt=custom]'); await wait(200);
await page.click('[data-picker=custom-position] [data-opt=contender]');
await page.click('[data-picker=custom-charter] [data-opt=mission]'); await wait(200);
await shot('b-setup-custom', '[data-test=custom-kind]');
await page.click('[data-picker=start] [data-opt=leader]'); await wait(100);
await page.click('[data-test=create-rivals]'); await wait(200);
await page.click('[data-picker=lab-owner-0] [data-opt="Lattice"]').catch((e) => errors.push('owner pick: ' + e.message.split('\n')[0]));
await wait(200);
await shot('c-setup-rivals', '[data-test=rivals]');

// (d) Board card, (f) Partners card on the leader's day-400 fixture
await load(fixture('day400'));
await open('finance', 'owners');
await shot('d-board-day400', '[data-home=board]');
await open('finance', 'deals');
await shot('f-partners-day400', '[data-home=partners]');

// (e) Board card of a big-tech division at day 0
await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload();
await page.evaluate(() => { const st = window.ai27v2; st.start({ ...st.draftSetup, tutorial: false, seed: 4244, companyName: 'OpenBrain', labKind: 'bigtech' }); st.setSpeed(0); });
await wait(300); await closeModals();
await open('finance', 'owners');
await shot('e-board-bigtech', '[data-home=board]');

// (g) a preview with the "After:" control line. A rescue by a hyperscaler (non-voting) does not move control, so: the breakaway
// fixture with the founders' stake set just above half of the votes, and the largest raise on the Raise card.
await load(fixture('start-breakaway-day400'));
await page.evaluate(() => { const s = window.ai27v2.state; const o = s.player.finance.ownership; o.founder = 0.502; o.fin = 1 - 0.502 - Object.values(o.strat).reduce((x, y) => x + y, 0) - o.mission - o.public; window.ai27v2.notify(); });
await open('finance', 'cash');
await page.evaluate(() => { const r = document.querySelector('[data-test=raise-ask]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, r.max); r.dispatchEvent(new Event('input', { bubbles: true })); });
await wait(300);
await shot('g-control-after-raise', '#ctl-raise-card');
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no page errors');
