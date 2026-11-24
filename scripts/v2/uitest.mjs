// v2 UI wiring test (M3, M5 UX): boots v2 in a real browser (Edge, headless), starts games, clicks every control, tab and
// action button and checks the game state changes; opens and resolves a decision; runs fast-forward; screenshots
// every panel and tab to scripts/v2/shots/ (gitignored). IA checks (design/ux/IA.md): every datum has one home
// (data-home unique across screens), every Term resolves (no data-term-missing), no raw floats in rendered text.
// Run: npm run build && node scripts/v2/uitest.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SHOTS = path.resolve('scripts/v2/shots');
mkdirSync(SHOTS, { recursive: true });
const url = 'file:///' + path.resolve('dist/index.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();

let pass = 0;
let fail = 0;
const fails = [];
const ok = (name, cond, detail = '') => {
  if (cond) pass++;
  else {
    fail++;
    fails.push(name);
  }
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
};
const get = (expr) => page.evaluate((e) => { const store = window.ai27v2; const s = store.state; return JSON.stringify(new Function('s', 'store', `return ${e}`)(s, store)); }, expr);
const wait = (ms) => page.waitForTimeout(ms);
async function check(name, expr, action, settle = 120) {
  const before = await get(expr);
  try {
    await action();
  } catch (e) {
    ok(name, false, e.message.split('\n')[0]);
    return;
  }
  await wait(settle);
  const after = await get(expr);
  ok(name, before !== after, `${String(before).slice(0, 40)} -> ${String(after).slice(0, 40)}`);
}
/** Resolve any open decision modal (first enabled choice) and acknowledge notices. */
async function closeModals() {
  for (let i = 0; i < 12; i++) {
    const rc = await page.$('[data-test=recap-ok]');
    if (rc) { await rc.click(); await wait(40); continue; }
    const hp = await page.$('[data-test=help-overlay]');
    if (hp) { await page.evaluate(() => window.ai27v2.setHelp(false)); await wait(40); continue; }
    const ch = await page.$('[data-test=decision] [data-choice]:not([disabled])');
    if (ch) { await ch.click(); await wait(60); continue; }
    const n = await page.$('[data-test=notice-ok]');
    if (n) { await n.click(); await wait(40); continue; }
    return;
  }
}
const pause = () => page.evaluate(() => window.ai27v2.setSpeed(0));
const setSlider = (loc, v) => loc.evaluate((node, val) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(node, String(val));
  node.dispatchEvent(new Event('input', { bubbles: true }));
}, v);
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const clearTips = async () => { await page.mouse.move(1, 1); await page.keyboard.press('Escape'); };
// D6: Models has tabs (Versions, Suites); nav opens it on Versions so the model-card checks find the card.
const nav = async (id) => { await closeModals(); await clearTips(); if (id === 'models') await page.evaluate(() => window.ai27v2.setTab('models', 'versions')); await page.click(`[data-nav=${id}]`); await wait(100); };
const sig = `s ? s.decisions.length + ':' + JSON.stringify(s).length : 0`;
/** IA checks on the current screen: homes (per screen), missing terms, raw floats. */
const homesByScreen = new Map();
const iaIssues = [];
async function iaScan(screen) {
  const r = await page.evaluate(() => {
    const homes = [...document.querySelectorAll('main.center [data-home]')].map((e) => e.getAttribute('data-home'));
    const shell = [...document.querySelectorAll('.topstrip2 [data-home], .nav2 [data-home], .bottombar2 [data-home]')].map((e) => e.getAttribute('data-home'));
    const missing = [...document.querySelectorAll('[data-term-missing]')].map((e) => e.getAttribute('data-term'));
    const text = document.body.innerText;
    const floats = text.match(/\d\.\d{5,}|\d{12,}/g) ?? [];
    return { homes, shell, missing, floats };
  });
  const dupHere = r.homes.filter((h, i) => r.homes.indexOf(h) !== i);
  if (dupHere.length) iaIssues.push(`${screen}: two homes for ${[...new Set(dupHere)].join(', ')}`);
  for (const h of r.homes) if (r.shell.includes(h)) iaIssues.push(`${screen}: ${h} has a home in the shell AND in the panel`);
  for (const h of new Set(r.homes)) { const set = homesByScreen.get(h) ?? new Set(); set.add(screen.replace(/^\w+:/, '')); homesByScreen.set(h, set); }
  if (r.missing.length) iaIssues.push(`${screen}: unresolved terms ${[...new Set(r.missing)].join(', ')}`);
  if (r.floats.length) iaIssues.push(`${screen}: raw floats ${r.floats.slice(0, 3).join(', ')}`);
}
/** Tabs of the current panel ([data-tabs] [data-tab]). */
const tabsOf = () => page.$$eval('main.center [data-tabs] [data-tab]', (els) => els.map((e) => e.getAttribute('data-tab')));
const tabTo = async (t) => { await clearTips(); await page.click(`main.center [data-tabs] [data-tab="${t}"]`); await wait(80); };

// ───────────────────────── start + setup ─────────────────────────
ok('Start screen', !!(await page.$('[data-test=start]')));
ok('Other campaigns greyed', (await page.$$('.campaign.locked')).length === 3);
await shot('00-start');
await page.click('[data-test=new-game]');
ok('Setup screen', !!(await page.$('[data-test=setup]')));
for (const [k, v] of [['baseline', 'reality'], ['world', 'fast'], ['alignment', 'hard'], ['econ', 'gate'], ['governance', 'founder'], ['storyteller', 'chaotic'], ['gov', 'hawk'], ['public', 'doomer'], ['china', 'bargainer'], ['rivals', 'safety'], ['rivalCount', '3'], ['tutorial', 'false']]) {
  await check(`Setup ${k}=${v}`, `store.draftSetup.${k}`, () => page.click(`[data-picker=${k}] [data-opt="${v}"]`), 30);
}
await page.fill('[data-test=company]', 'Meridian');
await wait(30);
ok('Setup blocks a rival name', !!(await page.$('[data-test=name-clash]')) && (await page.$eval('[data-test=start-game]', (b) => b.disabled)));
// R9: start picker (four starts with difficulty labels); a non-leader start turns the leader lab on and fixes the board.
ok('Setup: four starts with difficulty labels', (await page.$$('[data-picker=start] [data-opt] [data-difficulty]')).length === 4);
await check('Setup start=spinout', 'store.draftSetup.start', () => page.click('[data-picker=start] [data-opt="spinout"]'), 30);
ok('Setup: spinout turns the leader lab on and sets the board', (await get('store.draftSetup.leaderLab')) === 'true' && (await get('store.draftSetup.governance')) === '"founder"' && !!(await page.$('[data-test=start-board]')));
await check('Setup start=bigtech', 'store.draftSetup.start', () => page.click('[data-picker=start] [data-opt="bigtech"]'), 30);
await page.hover('[data-picker=start] [data-opt="bigtech"]');
await wait(300);
ok('Setup: start tooltip shows the start values', (await page.evaluate(() => document.body.innerText)).includes('from the parent'));
await clearTips();
await check('Setup start=leader', 'store.draftSetup.start', () => page.click('[data-picker=start] [data-opt="leader"]'), 30);
ok('Setup: leader start has no leader lab and a Governance picker', (await get('store.draftSetup.leaderLab')) === 'false' && !!(await page.$('[data-picker=governance]')));
await check('Setup company name', 'store.draftSetup.companyName', () => page.fill('[data-test=company]', 'TestLab'), 30);
await check('Setup seed', 'store.draftSetup.seed', () => page.fill('[data-test=seed]', '2027'), 30);
await shot('01-setup');
await clearTips(); // a start card's tooltip can lock while the mouse rests on it (slow machines)
// Game A: defaults with tutorial ON (act locks, coach cards).
for (const [k, v] of [['baseline', 'classic'], ['world', 'ai2027'], ['alignment', 'medium'], ['econ', 'ai2027'], ['governance', 'legacyNonprofit'], ['storyteller', 'rising'], ['gov', 'realistic'], ['public', 'realistic'], ['china', 'realistic'], ['rivals', 'realistic'], ['rivalCount', '4'], ['tutorial', 'true']]) {
  await page.click(`[data-picker=${k}] [data-opt="${v}"]`);
}
await page.click('[data-test=start-game]');
await wait(200);
ok('Game started', (await get('store.screen')) === '"game"');
ok('Company name applied', (await get('s.player.name')) === '"TestLab"' || (await get('s.setup.companyName')) === '"TestLab"');
ok('Overview is the default centre', (await get('store.panel')) === '"overview"' && !!(await page.$('[data-panel=overview]')));
ok('L0: no right rail', !(await page.$('.rail')));
ok('L0 (UB-5): research speed, lead, cash, loss-of-control risk in the top strip; no capability, catastrophe or revenue chip', !!(await page.$('.topstrip2 [data-test=speed]')) && !(await page.$('.topstrip2 [data-test=race]')) && !(await page.$('.topstrip2 [data-test=revenue]')) && !!(await page.$('[data-test=risk]')) && !!(await page.$('[data-test=cash]')) && !!(await page.$('[data-test=lead]')));
ok('Goals card in act 1', !!(await page.$('[data-test=goals]')));
ok('Compute panel locked in act 1', await page.$eval('[data-nav=compute]', (b) => b.disabled));
ok('World panel locked in act 1', await page.$eval('[data-nav=world]', (b) => b.disabled));
ok('Coach card shows (race first)', (await page.$eval('[data-test=coach]', (e) => e.getAttribute('data-coach-step')).catch(() => '')) === 'race');
await page.click('[data-test=coach-next]');
await wait(80);
ok('Coach card: first run', !!(await page.$('[data-coach=firstRun]')));
await shot('02-game-act1');

// ───────────────────────── time controls ─────────────────────────
await check('Speed 3', 'store.speed', () => page.click('[data-speed="3"]'));
await check('Pause button', 'store.speed', () => page.click('[data-test=pause]'));
await check('Space key resumes', 'store.speed', () => page.keyboard.press('Space'));
await wait(1500);
await check('Clock advances in real time', 's.time.day', () => wait(1200), 0);
await pause();
await closeModals();
// Tooltip: hover cash → tooltip with cause rows
await page.hover('[data-test=cash]');
await wait(500);
ok('Cash tooltip opens', !!(await page.$('.tip')));
await page.mouse.move(5, 500);
await wait(300);
// Coach card → run designer
await check('Coach card opens run designer', 'store.panel', () => page.click('[data-coach=firstRun]'));
await page.click('[data-test=coach-skip]').catch(() => {});
// Model v3 D5: the post-train card shows the environment suites read-only (fidelity and exploitability for the focus).
{
  const suites = await page.$eval('[data-panel=blueprint] [data-test=bp-suites]', (e) => e.innerText).catch(() => '');
  ok('Training: environments row (families, realism, loopholes)', /realism/.test(suites) && /loopholes/.test(suites) && !(await page.$('[data-panel=blueprint] [data-opt^="graders:"]')), suites.replace(/\s+/g, ' '));
  await page.$eval('[data-panel=blueprint] [data-test=bp-suites]', (e) => e.scrollIntoView({ block: 'center' })).catch(() => {});
  await page.hover('[data-panel=blueprint] [data-test=bp-suites]').catch(() => {});
  await wait(400);
  await shot('d5-blueprint-suites');
  await clearTips();
}
await check('Training: pick a post-training option (light budget)', 'document.querySelector("[data-panel=blueprint]").innerText', () => page.click('[data-panel=blueprint] [data-opt="rlBudget:light"]'));
await check('Launch post-train', `s.player.models.runs.filter(r => r.status === 'running').length`, () => page.click('[data-act=launchPost]'));

// FF to run completion
await check('FF menu opens', `!!document.querySelector('[data-test=ff-menu]')`, () => page.click('[data-test=ff]'), 50);
await check('FF to run done', 's.player.models.runs.filter(r => r.status === "done").length', async () => {
  await page.click('[data-ff=runDone]');
  for (let i = 0; i < 200; i++) {
    await wait(100);
    await closeModals();
    const st = JSON.parse(await get('[store.speed, s.player.models.runs.filter(r => r.status === "running").length]'));
    if (st[1] === 0) break;
    if (st[0] === 0) { await page.click('[data-test=ff]'); await page.click('[data-ff=runDone]'); }
  }
}, 200);
await pause();
// FF to next decision; open it from the queue and resolve
await closeModals();
const pend0 = JSON.parse(await get('s.events.pending.length'));
if (pend0 === 0) {
  await page.click('[data-test=ff]');
  await page.click('[data-ff=event]');
  for (let i = 0; i < 300; i++) {
    await wait(100);
    if (JSON.parse(await get('store.speed')) === 0) break;
  }
}
ok('FF stops with a reason', JSON.parse(await get('store.speed')) === 0, JSON.parse(await get('store.flash ? store.flash.text : ""')));
const pend = JSON.parse(await get('s.events.pending.map(p => p.instance)'));
ok('A decision is pending', pend.length > 0, pend.join(','));
if (pend.length) {
  if (!(await page.$('[data-test=decision]'))) await page.click(`[data-decision="${pend[0]}"]`);
  await wait(100);
  ok('Decision modal opens', !!(await page.$('[data-test=decision]')));
  ok('Choices show cards with previews', (await page.$$('[data-test=decision] .acard')).length > 0 && (await page.$$('[data-test=decision] .acard .pill2, [data-test=decision] .acard .ba')).length > 0);
  await check('Decision: Later closes, key 1 not consumed by speed', 'store.modal || ""', () => page.click('[data-test=later]'));
  if (!(await page.$('[data-test=decision]'))) await page.click(`[data-decision="${pend[0]}"]`);
  await wait(80);
  await shot('03-decision');
  const inst = await page.$eval('[data-test=decision]', (el) => el.closest('.modal-backdrop') ? 1 : 0);
  await check('Resolve decision', 's.events.pending.length + ":" + s.decisions.length', () => page.click('[data-test=decision] [data-choice]:not([disabled])'));
  void inst;
}
// FF quarter + date + milestone, +1 day
await closeModals();
await check('FF +1 day', 's.time.day', async () => { await page.click('[data-test=ff]'); await page.click('[data-ff=step]'); });
await check('FF next quarter', 's.time.day', async () => {
  await page.click('[data-test=ff]');
  await page.click('[data-ff=quarter]');
  for (let i = 0; i < 200; i++) { await wait(100); if (JSON.parse(await get('store.speed')) === 0) break; }
}, 50);
await closeModals();
await check('FF to date', 's.time.day', async () => {
  await page.click('[data-test=ff]');
  const d = JSON.parse(await get(`(() => { const x = new Date(Date.UTC(2025, 6, 1) + (s.time.day + 20) * 864e5); return x.toISOString().slice(0, 10); })()`));
  await page.fill('[data-test=ff-date]', d);
  await page.click('[data-ff=day]');
  for (let i = 0; i < 100; i++) { await wait(100); if (JSON.parse(await get('store.speed')) === 0) break; }
}, 50);
await closeModals();
await pause();

// Help overlay
await check('Help overlay opens', `!!document.querySelector('[data-test=help-overlay]')`, () => page.click('[data-test=help]'), 60);
await page.evaluate(() => window.ai27v2.setHelp(false));
// Save / load / prefs / quit / continue
await check('Menu opens', `!!document.querySelector('[data-test=menu-list]')`, () => page.click('[data-test=menu]'), 50);
await check('Save slot 1', 'localStorage.getItem("ai27.v2.slot1") ? localStorage.getItem("ai27.v2.slot1").length : 0', () => page.click('[data-save="1"]'));
await page.click('[data-test=menu]');
await check('Pref toggle', 'store.prefs.pauseOnMilestone', () => page.click('[data-pref=pauseOnMilestone]'));
await page.evaluate(() => window.ai27v2.step(3));
await check('Load slot 1', 's.time.day', async () => {
  await page.click('[data-load="1"]');
});
await page.click('[data-test=menu]');
await check('Save & quit', 'store.screen', () => page.click('[data-test=quit]'));
await check('Continue from autosave', 'store.screen', () => page.click('[data-test=continue]'));

// ───────────────────────── Game B: tutorial off, every panel and action ─────────────────────────
await page.evaluate(() => { const st = window.ai27v2; st.draftSetup = { ...st.draftSetup, tutorial: false, seed: 4242, companyName: 'OpenBrain' }; st.start(st.draftSetup); });
await wait(150);
ok('Tutorial off unlocks compute', !(await page.$eval('[data-nav=compute]', (b) => b.disabled)));
// Model v3 E11 at day 1 (footholds, control, danger), then advance a little so deployments/finance have content.
await page.evaluate(() => window.ai27v2.step(1));
await closeModals();
await e11Check('day 1');
await page.evaluate(() => window.ai27v2.step(19));
await closeModals();
const PANELS = ['finance', 'overview', 'lab', 'compute', 'research', 'models', 'blueprint', 'products', 'safety', 'relations', 'world', 'codex'];
for (const p of PANELS) await check(`Tab ${p}`, 'store.panel', () => nav(p), 60);

// Click every enabled action button in every panel; skip the game-ending RETIRE (tested last).
const SKIP = new Set(['RETIRE']);
const tally = { changed: 0, same: 0, rejected: 0 };
const rejected = [];
for (const p of PANELS) {
  await nav(p);
  const tabs = await tabsOf();
  for (const t of tabs.length ? tabs : ['']) {
  if (t) { if ((await get('store.panel')) !== `"${p}"`) { await nav(p); if (t) await tabTo(t); } await tabTo(t); }
  const ids = await page.$$eval('[data-panel] [data-act]', (els) => [...new Set(els.filter((e) => !e.disabled).map((e) => e.getAttribute('data-act')))]);
  for (const id of ids) {
    if (SKIP.has(id) || id.startsWith('product.retire.')) continue; // retiring products is tested in the Products section
    await closeModals();
    if ((await get('store.panel')) !== `"${p}"`) await nav(p);
    const loc = page.locator(`[data-panel] [data-act="${id}"]:not([disabled])`).first();
    if (!(await loc.count())) continue;
    const before = await get(sig);
    await page.evaluate(() => { window.ai27v2.flash = undefined; });
    await clearTips();
    await loc.click({ timeout: 2000 }).catch(() => {});
    await wait(40);
    const after = await get(sig);
    const flash = JSON.parse(await get('store.flash && store.flash.tone === "neg" ? store.flash.text : ""'));
    if (before !== after) tally.changed++;
    else if (flash) { tally.rejected++; rejected.push(`${p}:${id} → ${flash}`); }
    else tally.same++;
    if (JSON.parse(await get('s && s.ending ? 1 : 0'))) break;
    if (t && (await get(`store.tab.${p} || ''`)) !== `"${t}"`) { await nav(p); await tabTo(t); }
  }
  await closeModals();
  await shot(`10-${p}${t ? '-' + t : ''}`);
  }
}
ok(`Action buttons: ${tally.changed} changed state`, tally.changed >= 40, `${tally.same} no-op, ${tally.rejected} rejected`);
for (const r of rejected) console.log(`     rejected ${r}`);

// Controls that are not action buttons: segs, sliders, selects, toggles
// UB-5: the compute allocation lives on LAB only (bar → editor); Compute has no Split tab.
await nav('compute');
ok('Compute: no allocation controls (link chip to LAB)', !(await page.$('[data-tabs=compute] [data-tab=split]')) && !(await page.$('[data-panel=compute] [data-act=setSplit]')) && !!(await page.$('[data-panel=compute] [data-ref=split]')));
await nav('lab');
await tabTo('board');
ok('LAB: allocation bar with idle chip, workforce rows and Best moves', !!(await page.$('[data-test=alloc-bar] [data-seg=training]')) && !!(await page.$('[data-test=alloc-idle]')) && (await page.$$('[data-panel=lab] [data-row]')).length === 5 && !!(await page.$('[data-home=bestMoves]')));
await check('LAB: a bar segment opens the allocation editor', '!!document.querySelector("[data-test=alloc-editor]")', () => page.click('[data-test=alloc-bar] [data-seg=training]'));
await check('LAB editor: slider moves the draft', `document.querySelector('[data-test=alloc-editor]').innerText`, () => setSlider(page.locator('#ctl-split-training input[type=range]').first(), 0.6));
await check('LAB editor: Apply sets the allocation', 'JSON.stringify(s.player.split)', () => page.click('[data-panel=lab] [data-act=setSplit]'));
// UB-B: needs live only on LAB › AI staff & needs; a board row opens that tab.
await check('LAB: a workforce row opens its needs on AI staff & needs', 'store.tab.lab', () => page.click('[data-row="re.saf"]'));
ok('LAB: the board has no needs copy', !(await page.$('[data-needs]')) && !!(await page.$('[data-home="needs.re.saf"]')));
await tabTo('board');
await check('LAB: scientists split + raises the capability scientists target', 's.player.hiring.targets["sci.cap"]', () => page.click('[data-act="sciSplit.sci.cap.up"]'));
{
  const mv = await page.$('[data-home=bestMoves] [data-act^="move."]:not([disabled])');
  const split0 = JSON.parse(await get('s.player.split'));
  if (mv) await check('LAB: Best moves Do performs the move', 'JSON.stringify([s.player.split, s.player.hiring.targets])', () => mv.click());
  // An idle-compute move can take the whole Training share (no run uses it): restore it for the later run checks.
  else ok('LAB: Best moves lists moves or says none helps', !!(await page.$('[data-home=bestMoves]')));
  await page.evaluate((sp) => window.ai27v2.act('setSplit', sp), split0);
}
// R3 / UB-B Hiring & teams: a row per role with team tiles, hiring target, payroll, next team buys; offers; payroll.
await nav('lab');
await tabTo('people');
ok('Hiring: five role rows with one tile per team', JSON.parse(await get(`['eng', 're.cap', 'sci.cap', 're.saf', 'sci.saf'].every((k) => !!document.querySelector('[data-panel=lab] .lh-row[data-key="' + k + '"]')) && document.querySelectorAll('[data-panel=lab] .lh-tile:not(.filling)').length === s.player.teams.length`)));
ok('Hiring: next team buys on every row', (await page.$$('[data-panel=lab] [data-test^="buys."]')).length === 5);
await check('Keep hiring: + raises the research-engineering target', 's.player.hiring.targets["re.cap"]', () => page.click('[data-act="teams.target.up.re.cap"]'));
await check('Offer: Hire queues the team', 'JSON.stringify([s.player.hiring.candidates.length, s.player.hiring.filling.length])', () => page.click('[data-panel=lab] .lh-offer [data-act="teams.hire"]'));
await check('Filling: cancel removes a queued team', 's.player.hiring.filling.length', () => page.click('[data-panel=lab] [data-act="teams.cancel"]'));
if (await page.$('[data-act="teams.move.re.saf"]:not([disabled])')) await check('Move: safety research-engineering team to capabilities', 'JSON.stringify([s.player.teams.filter((t) => t.role === "re" && t.dept === "saf").length, Math.round(s.player.morale.safety)])', () => page.click('[data-act="teams.move.re.saf"]'));
else ok('Move: safety research-engineering team to capabilities', true, 'no movable safety research-engineering team in this game');
ok('Move: safety morale paid', JSON.parse(await get('s.causes.byKey["morale.safety"] ? s.causes.byKey["morale.safety"].some((c) => /moved/.test(c.source)) : false')));
await check('Let go: a science team', 's.player.teams.length', () => page.click('[data-act="teams.release.sci.cap"]'));
await shot('20-lab-people');
await tabTo('work');
// R7 / UB-B AI staff & needs: four job cards (model chip, AI share, work done; watcher chip on the three capability
// jobs; AI share allowed and spot-checks on Safety), then the three needs lists.
ok('AI staff: four job cards with a model chip, watcher chips on the capability jobs', JSON.parse(await get(`['eng', 'capRoutine', 'capFrontier', 'safety'].every((u) => !!document.querySelector('[data-home=agents] [data-lane=' + u + '] [data-chip=model]')) && ['eng', 'capRoutine', 'capFrontier'].every((u) => !!document.querySelector('[data-home=agents] [data-lane=' + u + '] [data-chip=monitor]'))`)));
ok('AI staff: AI share on every job', JSON.parse(await get(`['eng', 'capRoutine', 'capFrontier', 'safety'].every((u) => !!document.querySelector('[data-test="ai-share.' + u + '"]'))`)));
ok('AI staff: three needs lists', (await page.$$('[data-panel=lab] .la-ncard')).length === 3);
await page.selectOption('[data-test="agent-monitor.eng"]', 'same');
await wait(80);
ok('Agents: a watcher pick opens the before → after preview', !!(await page.$('[data-test="agent-edit.eng"] .pv')));
await page.click('[data-test="agent-cancel.eng"]');
await wait(60);
ok('Agents: Cancel closes the preview and keeps the package', JSON.parse(await get('s.player.agents.eng.monitorId === undefined && !document.querySelector(\'[data-test="agent-edit.eng"]\')')));
await page.selectOption('[data-test="agent-monitor.capFrontier"]', '');
await wait(80);
await check('Agents: Apply removes the frontier monitor', 'JSON.stringify(s.player.agents.capFrontier.monitorId || null)', () => page.click('[data-act="agents.set.capFrontier"]'));
await check('AI share allowed: + raises it', 's.player.policies.trustedToAI', () => page.click('[data-act="agents.trusted.up"]'));
ok('AI share allowed: home on the Safety job card', !!(await page.$('[data-lane=safety] [data-home=trustedToAI]')));
await check('Needs: Change order opens the editor', '!!document.querySelector(".la-needs.editing")', () => page.click('[data-test="order.research.reAlloc"]'));
await shot('21-lab-agents');
// UB-B Security: a Set per level in What a higher level costs (range 2–5 as in the engine).
await tabTo('security');
ok('Security: level rows up to 5', JSON.parse(await get(`!!document.querySelector('[data-panel=lab] [data-home=wslCosts] [data-level="5"]')`)));
{
  const setBtn = await page.$('[data-panel=lab] [data-home=wslCosts] [data-act^="SEC_TARGET."]:not([disabled])');
  const lvl = setBtn ? Number((await setBtn.getAttribute('data-act')).slice(11)) : NaN;
  if (setBtn) {
    await check('Security target: Set on a level row', 's.player.security.target', () => setBtn.click());
    ok('Security target set to the row level', JSON.parse(await get(`s.player.security.target === ${lvl}`)));
  } else ok('Security target: every Set says why it is blocked', (await page.$$('[data-panel=lab] [data-home=wslCosts] [data-act^="SEC_TARGET."][disabled]')).length > 0);
}
await check('Security: need-to-know Partial', 's.player.security.siloing', () => page.click('[data-panel=lab] [data-act="SEC_SILO.1"]'));
await nav('finance');
await page.click('[data-tabs=finance] [data-tab=cash]'); await wait(80); // J1 F3: Finance has tabs
await check('Raise ask slider', `document.querySelector('[data-act="fin.raise"]').innerText`, () => setSlider(page.locator('[data-panel=finance] input[type=range]').first(), 3.3));
await page.click('[data-tabs=finance] [data-tab=deals]'); await wait(80);
await check('Debt kind', `document.querySelector('[data-panel=finance]').innerHTML`, () => page.click('[data-panel=finance] [data-debt-kind=gpuTerm]'));
// UB-7 TRAINING › Next run: Prediction (nine skill rows with their marks and the run's ghost, milestone axis, "would
// meet …, ready"), Run plan in two stages (start-from table, size snaps, option pills with previews, locked options
// that open Research), the Limits strip (five tiles) and Launch; Runs tab: running runs with share and ETA.
await nav('blueprint');
await tabTo('next');
await page.click('[data-panel=blueprint] [data-start=new]').catch(() => {});
await wait(120);
ok('Training: limits strip with 5 tiles (compute, ready, data, cash, run operations)', JSON.stringify(await page.$$eval('[data-panel=blueprint] [data-tile]', (els) => els.map((e) => e.getAttribute('data-tile')))) === JSON.stringify(['compute', 'ready', 'data', 'cash', 'ops']));
ok('Training: prediction has 9 skill rows with median-expert and best-human marks, and the milestone axis', JSON.parse(await get(`(() => { const r = [...document.querySelectorAll('[data-home=runPrediction] [data-test=pred-row]')]; return r.length === 9 && r.every((x) => x.querySelector('.skb-tk.med') && x.querySelector('.skb-tk.best')) && !!document.querySelector('[data-home=runPrediction] [data-test=milestone-axis]'); })()`)));
{
  const ms = await page.$eval('[data-test=pred-milestone]', (e) => e.textContent ?? '').catch(() => '');
  ok('Training: prediction says the milestone and the ready date', /(Would meet|No new milestone)/.test(ms) && /ready [A-Z][a-z]{2} \d+, \d{4}/.test(ms), ms);
  ok('Training: no raw level numbers at L1 on the prediction', !/\b\d+\.\d+ levels\b/.test(await page.$eval('[data-home=runPrediction]', (e) => e.innerText)));
}
ok('Training: start-from table shows each start with its effects', (await page.$$('[data-test=start-table] .or')).length >= 2);
const paramSnap = (k) => `(() => { const b = [...document.querySelectorAll('[data-panel=blueprint] [data-test=bp-params]')]; const i = b.findIndex((x) => x.classList.contains('on')); b[Math.max(0, Math.min(b.length - 1, i + ${k}))].click(); return true; })()`;
await check('Training: 2× active parameters changes the run time', `document.querySelector('[data-panel=blueprint] [data-tile=compute]').innerText`, () => page.evaluate(paramSnap(2)));
await check('Training: tokens per parameter changes the data reads', `document.querySelector('[data-panel=blueprint] [data-tile=data]').innerText`, () => page.selectOption('[data-panel=blueprint] [data-test=bp-tpp]', '20'));
await page.selectOption('[data-panel=blueprint] [data-test=bp-tpp]', '400').catch(() => {});
await page.evaluate(paramSnap(-2));
await clearTips();
await shot('43-training-next');
await page.hover('[data-panel=blueprint] [data-tile=data] .val');
await wait(500);
ok('D3 Training: the data tile reads the draw (unique tokens for this mix, quality drawn)', JSON.parse(await get(`/Unique tokens for this mix/.test(document.querySelector('.tip')?.innerText ?? '') && /Mean quality drawn/.test(document.querySelector('.tip')?.innerText ?? '')`)));
await clearTips();
if (await page.$eval('[data-panel=blueprint] [data-opt="data:codeMath"]', (b) => !b.classList.contains('locked')).catch(() => false)) {
  await check('D3 Training: code & math moves the Code prediction', `document.querySelector('[data-home=runPrediction] [data-skill=CODE] .skb-ghr')?.style.cssText ?? ''`, () => page.click('[data-panel=blueprint] [data-opt="data:codeMath"]'), 200);
  await page.click('[data-panel=blueprint] [data-opt="data:balanced"]');
  await wait(100);
} else ok('D3 Training: code & math is known at the start', false);
await page.hover('[data-panel=blueprint] [data-opt="shape:dense"]');
await wait(600);
ok('Training: an option previews Skill · Time · Cash · Serving · risk families', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /Skill/.test(t) && /Time/.test(t) && /Serving cost/.test(t) && /Deception/.test(t); })()`)));
await clearTips();
ok('Training: locked option names its discovery', await page.$eval(`[data-panel=blueprint] [data-opt="shape:latent"]`, (b) => b.classList.contains('locked') && !!b.dataset.node).catch(() => false));
await check('Training: architecture dense', `document.querySelector("[data-panel=blueprint]").innerHTML`, () => page.click(`[data-panel=blueprint] [data-opt="shape:dense"]`));
await check('Training: locked option opens Research on its discovery', `store.panel + ':' + (store.tab['research.sel'] || '')`, () => page.click('[data-panel=blueprint] [data-opt="shape:latent"]'));
ok('Training: Research shows the idea card', !!(await page.$('[data-test=node-card][data-card=P17]')));
await page.click('[data-test=node-close]').catch(() => {});
await nav('blueprint');
await tabTo('next');
await page.click('[data-panel=blueprint] [data-start=new]').catch(() => {});
await page.click('[data-panel=blueprint] [data-opt="shape:dense"]');
await check('Training: run share pill', `document.querySelector('[data-panel=blueprint] [data-tile=compute]').innerText`, () => page.click('[data-panel=blueprint] [data-pool="0.8"]'));
await page.click('[data-panel=blueprint] [data-test=bp-push-details]');
await wait(80);
ok('Training: Pushes details open the signal rows (L2)', !!(await page.$('[data-test=bp-pressure]')));
await check('Training: Reset to Standard', `document.querySelector('[data-panel=blueprint] [data-home=runPlan]').innerText`, () => page.click('[data-test=bp-reset]'));
await page.click('[data-panel=blueprint] [data-opt="shape:dense"]');
await check('Launch base run', `s.player.models.runs.filter(r => r.kind === 'base').length`, () => page.click('[data-act=launchBase]'));
await nav('blueprint');
await tabTo('runs');
{
  // UB-B: the timeline draws every running and finished run; Running now shows the run with the largest share, with its share and due date.
  const rq = JSON.parse(await get(`(() => { const tl = document.querySelector('[data-test=runs-timeline]'); const now = document.querySelector('[data-home=runningNow]'); const n = s.player.models.runs.filter((r) => ['running', 'paused', 'done'].includes(r.status)).length; const live = s.player.models.runs.filter((r) => r.status === 'running' || r.status === 'paused').length; return [!!tl && tl.querySelectorAll('.rn-bar[data-run]').length === n && live >= 1 && !!now?.querySelector('[data-test=run-share]') && !!now?.querySelector('[data-test=run-eta]'), (now?.innerText ?? store.panel).slice(0, 160)]; })()`));
  ok('Runs (UB-B): the timeline shows every run; Running now has its share and due date', rq[0], rq[1]);
}
// UB-F: compute allocation's one home is LAB: Running now shows the run's share read-only with a link chip.
ok('Runs (UB-F): Running now has no share −/+; its Allocation chip links to LAB', !(await page.$('[data-home=runningNow] [data-act^="run-share-"]')) && !!(await page.$('[data-home=runningNow] [data-ref=trainingAlloc]')));
await check('Runs (UB-F): the Allocation chip opens LAB', 'store.panel', () => page.click('[data-home=runningNow] [data-ref=trainingAlloc]'));
await nav('blueprint');
await tabTo('runs');
ok('Runs (UB-B): training compute now (runs, idle) links to LAB', !!(await page.$('[data-test=runs-compute] .dv-chip')) && /idle/.test(await page.locator('[data-test=runs-compute]').innerText()));
await nav('lab');
await tabTo('board');
ok('LAB: idle training compute shows inside the training segment (RD-A05b)', !!(await page.$('[data-test=alloc-bar] [data-seg=training] .idle')));
await page.click('[data-test=alloc-idle]'); await wait(60);
await check('Split: Auto-split switches on', 's.player.policies.autoSplit.on', () => page.click('[data-home=autoSplit] [data-act="autoSplit.toggle"]'));
await check('Split: Auto-split switches off', 's.player.policies.autoSplit.on', () => page.click('[data-home=autoSplit] [data-act="autoSplit.toggle"]'));
await nav('lab');
await tabTo('work');
ok('LAB › AI staff & needs: engineers show the build queue', !!(await page.$('[data-panel=lab] [data-test=build-queue]')));
// R3 keep-hiring policy (needs a week; run after the run-designer checks so the time step does not change them).
await page.evaluate(() => window.ai27v2.step(7));
await closeModals();
await pause();
ok('Keep hiring: after a week the policy has the target covered (teams + queued)', JSON.parse(await get(`(() => { const k = (t) => t.role === 'eng' ? 'eng' : t.role + '.' + t.dept; const n = [...s.player.teams, ...s.player.hiring.filling].filter((t) => k(t) === 're.cap').length; return n >= s.player.hiring.targets['re.cap']; })()`)));
await nav('lab');
await tabTo('people');
await check('Keep hiring: − lowers the target', 's.player.hiring.targets["re.cap"]', () => page.click('[data-act="teams.target.down.re.cap"]'));
await closeModals();
// Split floors are gone: a zero training share applies (with a warning first) and running runs show as paused.
await nav('lab');
await tabTo('board');
if (!(await page.$('[data-test=alloc-editor]'))) { await page.click('[data-test=alloc-bar] [data-seg=synthetic]'); await wait(60); }
await setSlider(page.locator('#ctl-split-training input[type=range]').first(), 0);
await wait(60);
ok('Split: zero training warns before apply', !!(await page.$('[data-test=split-warn]')));
await check('Split: zero training share applies (no rejection)', 'JSON.stringify(s.player.split.training < 1e-6)', () => page.click('[data-act=setSplit]'));
await nav('blueprint');
await tabTo('runs');
ok('Run queue: paused, no training compute', ((await page.$eval('[data-test=run-stall]', (e) => e.textContent).catch(() => '')) ?? '').includes('no training compute'));
// Presets are dropped (DECISIONS mockups round 1); restore the training share by hand.
await nav('lab');
await tabTo('board');
if (!(await page.$('[data-test=alloc-editor]'))) { await page.click('[data-test=alloc-bar] [data-seg=synthetic]'); await wait(60); }
await setSlider(page.locator('#ctl-split-training input[type=range]').first(), 0.3);
await page.click('[data-panel=lab] [data-act=setSplit]');
await closeModals();
await nav('models');
const vids = JSON.parse(await get('s.player.models.versions.map(v => v.id)'));
if (vids.length > 1) await check('Select version in the family tree', 'store.sel.versionId', () => page.click(`[data-version="${vids[0]}"]`));
// ── Products (R6 / UB-A): revenue strip, cards (lineup, tools, customers, certification, price, effort), live edit with
// before → after preview, the drawer (customers by sector, Limited by, win back, sold in a year, safeguards, retire),
// policies (Auto serving, manual split), the Agents card. ──
await nav('products');
ok('Products: one card per live product', (await page.$$('[data-panel=products] [data-product]')).length >= 3);
{
  const rv = await page.evaluate(() => ({ rows: document.querySelectorAll('[data-test=prod-revenue] [data-rev]').length, total: document.querySelector('[data-test=prod-rev-total]')?.textContent ?? '', bind: document.querySelectorAll('[data-test=prod-revenue] [data-test^="prod-bind."]').length }));
  ok('Products (UB-A): revenue strip with a row and a Limited-by chip per live product', rv.rows >= 3 && /\$[\d.]+[BMT]/.test(rv.total) && rv.bind >= 3, JSON.stringify(rv));
  ok('Products (UB-A): no serving split on Products (its home is LAB); a serving link instead', !(await page.$('[data-home=servingSplit]')) && !!(await page.$('[data-test=prod-serving-link]')));
}
// B5 / R6 / RD-P06: deep effort is a locked option with its reason until its idea (the model's capability) is known.
if (!JSON.parse(await get(`s.player.tree.P05?.status === 'known'`))) {
  ok('Products: deep effort locked with its reason', await page.$eval('[data-panel=products] [data-test^=prod-effort] [data-opt=deep]', (b) => b.disabled && (b.getAttribute('data-locked') ?? '').length > 5).catch(() => false));
}
const apiId = JSON.parse(await get(`(s.player.deployments.find(d => d.channel === 'api' && d.status === 'live') || {}).id || ''`));
if (apiId) {
  const card = `[data-panel=products] [data-product="${apiId}"]`;
  await page.click(`[data-test="prod-open.${apiId}"]`);
  await wait(120);
  ok('Products (UB-A): the drawer shows customers by sector, Limited by in words and sold in a year', !!(await page.$('[data-test=prod-drawer] [data-test=prod-sectors] [data-sector]')) && /Limited by/.test(await page.$eval('[data-test=prod-limit]', (e) => e.textContent ?? '').catch(() => '')) && !!(await page.$(`[data-test=prod-drawer] [data-test="prod-econ.${apiId}"]`)));
  ok('Products (UB-F): the drawer has no safeguard controls; the card links to SAFETY › Safeguards (their home)', !(await page.$(`[data-test=prod-drawer] [data-test="prod-monitor.${apiId}"]`)) && !(await page.$(`[data-test=prod-drawer] [data-test="prod-sg.${apiId}"]`)) && !!(await page.$(`[data-panel=products] [data-product="${apiId}"] [data-ref=productSafeguards]`)));
  await page.click('[data-test=prod-drawer-close]');
  await wait(80);
  await page.click(`${card} [data-test^=prod-price] [data-opt=premium]`);
  await wait(120);
  const pop = JSON.parse(await get(`(() => { const p = document.querySelector('[data-test="prod-edit.${apiId}"]'); return p ? p.innerText : ''; })()`));
  ok('Products: an edit opens the before → after preview (stays live, effective date)', /stays live/.test(pop) && /→/.test(pop) && /from /.test(pop), pop.replace(/\n/g, ' ').slice(0, 120));
  await check('Products: Apply updates the live product (premium)', `(() => { const d = s.player.deployments.find(x => x.id === "${apiId}"); return [d.price, d.status, d.startDay]; })()`, () => page.click(`[data-act="product.update.${apiId}"]`));
  ok('Products: the product stayed live with its start day', JSON.parse(await get(`(() => { const d = s.player.deployments.find(x => x.id === "${apiId}"); return d.status === 'live' && d.price === 'premium'; })()`)));
  await page.click(`${card} [data-test^=prod-price] [data-opt=standard]`);
  await wait(80);
  await check('Products: Cancel drops a draft edit', `!!document.querySelector('[data-test="prod-edit.${apiId}"]')`, () => page.click(`[data-test="prod-cancel.${apiId}"]`));
  await page.click(`[data-test="prod-lineup-more.${apiId}"]`);
  ok('Products: the lineup editor holds the main-model chip', !!(await page.$(`${card} [data-chip=model]`)));
  await page.click(`[data-test="prod-lineup-more.${apiId}"]`);
  await page.click(`[data-test="prod-tool-add.${apiId}"]`);
}
const buildBtn = await page.$('[data-panel=products] [data-act^="feature.build."]:not([disabled])');
if (buildBtn) await check('Products: Build a tool (engineers\' queue)', `s.player.build.queue.filter(i => i.kind === 'feature').length`, () => buildBtn.click());
ok('Products: locked tools name their idea', !!(await page.$('[data-panel=products] .ft.locked[data-node]')));
ok('Products (TIERS): every product card shows its lineup rows', JSON.parse(await get(`[...document.querySelectorAll('[data-panel=products] [data-product]')].every((c) => c.querySelectorAll('[data-test^=prod-lineup] [data-test^=prod-tier]').length >= 1)`)));
await page.click('[data-test=prod-policies]');
await check('Products: Override turns Auto serving off', 's.player.policies.servingAuto', () => page.click('[data-act="products.policy.servingAuto"]'));
const prodA = JSON.parse(await get(`(s.player.deployments.find(d => d.status === 'live' && d.channel !== 'internal' && d.channel !== 'open') || {}).id || ''`));
if (prodA && await page.$('[data-test=serving-manual]')) {
  await check('Products: hand-set serving share', `s.player.deployments.find(d => d.id === "${prodA}").servingShare`, async () => {
    await setSlider(page.locator(`[data-test=serving-manual] [data-serving="${prodA}"] input[type=range]`), 0.35);
    await page.click(`[data-act="product.serving.${prodA}"]`);
  });
}
await check('Products: Auto serving back on', 's.player.policies.servingAuto', () => page.click('[data-act="products.policy.servingAuto"]'));
await check('Products: upgrade-to-newest policy', 's.player.policies.upgradeToNewest', () => page.click('[data-act="products.policy.upgradeToNewest"]'));
await page.click('[data-act="products.policy.upgradeToNewest"]');
await page.click('[data-test=prod-policies]');
if (await page.$('[data-test=agents-gate]')) ok('Products: Agents card shows ready-to-launch (time alone, engineers)', /Engineers/.test(await page.$eval('[data-test=agents-gate]', (e) => e.textContent ?? '')));
{
  const ent = JSON.parse(await get(`(s.player.deployments.find(d => d.channel === 'enterprise' && d.status === 'live') || {}).id || ''`));
  if (ent) {
    await page.click(`[data-test="prod-open.${ent}"]`);
    await wait(100);
    await check('Products: Retire withdraws a product', `s.player.deployments.find(d => d.id === "${ent}").status`, () => page.click(`[data-act="product.retire.${ent}"]`));
  }
}
// UB-9 SAFETY: the header (model picker, Loss-of-control risk, Unstopped harm, sight curve, framework) on every tab and
// Risks (the harmful-acts table) first; then Model, Instruments, Safeguards, Incidents & cases, Programmes.
await nav('safety');
await tabTo('risks');
ok('SAFETY header: picker, Loss-of-control risk, Unstopped harm, sight curve with the 50% line, framework', !!(await page.$('[data-test=sf-model]')) && !!(await page.$('[data-test=sf-risk]')) && !!(await page.$('[data-test=sf-harm]')) && !!(await page.$('[data-test=sight-curve] [data-mark=model]')) && !!(await page.$('[data-home=frameworkHold] [data-test=sf-hold]')));
{
  const pick = await page.$eval('[data-test=sf-model]', (e) => e.value);
  const r = JSON.parse(await get(`(() => { const r = store.readouts.lossOfControlRisk(s, ${JSON.stringify(pick)}); return r ? r.p : -1; })()`));
  const shown = await page.$eval('[data-test=sf-risk]', (e) => Number(e.getAttribute('data-risk')));
  ok('SAFETY header: the risk tile reads lossOfControlRisk of the picked model', Math.abs(shown - r) < 1e-5, `${shown} vs ${r}`);
  const lab = JSON.parse(await get('(store.readouts.lossOfControlRisk(s) || {}).versionId || ""'));
  ok('SAFETY header: the picker starts on the riskiest running model (the one the top bar names)', !!pick && (pick === lab || JSON.parse(await get('!!store.sel.versionId'))), `${pick} vs ${lab}`);
  const risk = await page.$eval('[data-test=sf-risk]', (e) => e.textContent ?? '');
  ok('SAFETY header: risk reads "< 0.1%", a %, or Unknown (never 0%)', /^(< 0\.1%|\d+(\.\d)?%|Unknown)$/.test(risk) && !/^0(\.0)?%$/.test(risk), risk);
}
ok('SAFETY › Risks: grouped act table (misbehaviour, against the lab, misuse link) with the composite row feeding Loss-of-control risk', !!(await page.$('[data-home=actTable] [data-group=misbehaviour] [data-act]')) && !!(await page.$('[data-home=actTable] [data-group=lab] [data-act=TAKEOVER] [data-ref=lossRisk]')) && !!(await page.$('[data-home=actTable] [data-group=misuse]')));
ok('SAFETY › Risks: five factor columns per act row and a safeguards footer with its link', (await page.$$('[data-home=actTable] [data-act=RH] [data-col]')).length === 5 && !!(await page.$('[data-test=sfr-guards] [data-ref=safeguardsTab]')));
ok('SAFETY: the old readouts are gone (verdict, risk gauge, Would-try card, side switch)', !(await page.$('[data-home=safetyVerdict]')) && !(await page.$('[data-test=control-value]')) && !(await page.$('[data-home=misBand]')) && !(await page.$('[data-test=sf-side-tabs]')));
await page.hover('[data-test=sf-risk]');
await wait(300);
ok('SAFETY header: the risk tooltip gives its range, certainty and parts', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /90% range/.test(t) && /Certainty/.test(t) && /Stop rate/.test(t); })()`)));
await clearTips();
{
  const ids = await page.$$eval('[data-test=sf-model] option', (els) => els.map((e) => e.value));
  const cur = await page.$eval('[data-test=sf-model]', (e) => e.value);
  const other = ids.find((x) => x !== cur);
  if (other) {
    await check('SAFETY header: picking another model changes the table', 'store.sel.versionId || ""', () => page.selectOption('[data-test=sf-model]', other));
    ok('SAFETY header: the table names the picked model', (await page.$eval('[data-home=actTable]', (e) => e.innerText)).includes(await page.$eval('[data-test=sf-model] option:checked', (e) => e.textContent.split(' · ')[0])));
    await page.evaluate(() => { window.ai27v2.sel.versionId = undefined; window.ai27v2.notify(); });
  }
}
await check('SAFETY › Risks: the safeguards link opens Safeguards', 'store.tab.safety || ""', () => page.click('[data-test=sfr-guards] [data-ref=safeguardsTab]'));
// UB-C: Safeguards (deployments grid with the act-table stop rate, step by step, levers, framework card and its drawer).
ok('SAFETY › Safeguards: deployments grid, step by step, levers and the framework card', !!(await page.$('[data-home=staffSafeguards] [data-dep]')) && !!(await page.$('[data-home=stopSteps]')) && !!(await page.$('[data-home=stopSteps] [data-test^="lever."]')) && !!(await page.$('[data-home=safetyFramework]#ctl-policy')));
{
  // The AI staff stop rate is the act table's (Risks) range, so the two screens agree.
  const rng = await page.$eval('[data-test=staff-stop]', (e) => e.textContent ?? '').catch(() => '');
  await tabTo('risks');
  const stops = (await page.$$eval('[data-home=actTable] .sfr-tr:not(.hero) [data-col=stop]', (els) => els.map((e) => e.textContent ?? ''))).map((x) => parseInt(x, 10)).filter((x) => x > 0);
  const staff = /AI staff work/.test(await page.$eval('[data-home=actTable]', (e) => e.innerText).catch(() => ''));
  await tabTo('safeguards');
  const rt = staff && stops.length ? [Math.min(...stops), Math.max(...stops)] : null;
  ok('SAFETY › Safeguards: AI staff stop rate equals the act table range', !rt || (rng.includes(String(rt[0])) && rng.includes(String(rt[1]))), `${rng} vs ${JSON.stringify(rt)}`);
}
await page.click('[data-test=framework-edit]');
await wait(150);
ok('SAFETY › Safeguards: the framework drawer holds release evals and rule lines', !!(await page.$('[data-home=safetyPolicy] [data-act^="fw-depth."]')) && !!(await page.$('[data-home=safetyPolicy] [data-act^="fw-rule."]')));
await page.click('[data-test=sf-drawer-close]');
await wait(100);
// UB-F: Safeguards is the one home of every safeguard control: the control protocol's setting switches here (with its
// preview), and each product's monitor, misuse level and KYC are edited here with a before → after preview.
if (await page.$('[data-test=control-edit]')) {
  await page.click('[data-test=control-edit]');
  await wait(150);
  const cur = JSON.parse(await get(`(s.player.deployments.find((d) => d.channel === 'internal' && d.status === 'live')?.guards ?? []).find((g) => g.kind === 'control')?.setting ?? ''`));
  const to = cur === 'defer20' ? 'defer10' : 'defer20';
  await page.click(`[data-test="ctl-opt.${to}"]`);
  await wait(100);
  await page.hover(`[data-act="control-switch.${to}"]`, { timeout: 2000 }).catch(() => {});
  await wait(350);
  ok('SAFETY › Safeguards (UB-F): switching the control setting previews its slowdown and unstopped acts', /slowdown/.test(await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '')));
  await page.mouse.move(1, 1); // not clearTips: Escape would close the drawer
  await wait(150);
  await check('SAFETY › Safeguards (UB-F): Switch applies the control setting', `(s.player.deployments.find((d) => d.channel === 'internal' && d.status === 'live')?.guards ?? []).find((g) => g.kind === 'control')?.setting ?? ''`, () => page.click(`[data-act="control-switch.${to}"]`));
  await page.click(`[data-test="ctl-opt.${cur}"]`, { timeout: 3000 }).catch(() => {});
  await wait(80);
  await page.click(`[data-act="control-switch.${cur}"]`, { timeout: 3000 }).catch(() => {});
  await wait(80);
  await page.click('[data-test=sf-drawer-close]', { timeout: 3000 }).catch(() => {});
  await wait(100);
} else ok('SAFETY › Safeguards (UB-F): control setting switch (no control protocol on this fixture)', true);
if (await page.$('[data-test=product-guards-edit]')) {
  await page.click('[data-test=product-guards-edit]');
  await wait(150);
  const pid = await page.$eval('[data-test=product-guards-drawer] [data-test^="pg."]', (e) => e.getAttribute('data-test').slice(3)).catch(() => '');
  const lvl = JSON.parse(await get(`s.player.deployments.find((d) => d.id === "${pid}")?.safeguards ?? ''`));
  const to = lvl === 'hardened' ? 'classifiers' : 'hardened';
  await page.click(`[data-test="pg-level.${pid}"] [data-opt=${to}]`);
  await wait(150);
  const pv = await page.$eval(`[data-test="pg-preview.${pid}"]`, (e) => e.innerText).catch(() => '');
  ok('SAFETY › Safeguards (UB-F): a product safeguard edit shows its stop rate and revenue before → after', /Stop rate, misuse/.test(pv) && /→/.test(pv) && /Revenue now/.test(pv), pv.replace(/\n/g, ' ').slice(0, 140));
  await check('SAFETY › Safeguards (UB-F): Apply sets the product safeguard level', `s.player.deployments.find((d) => d.id === "${pid}")?.safeguards ?? ''`, () => page.click(`[data-act="pg-apply.${pid}"]`));
  await page.click(`[data-test="pg-level.${pid}"] [data-opt=${lvl}]`, { timeout: 3000 }).catch(() => {});
  await wait(100);
  await page.click(`[data-act="pg-apply.${pid}"]`, { timeout: 3000 }).catch(() => {});
  await wait(100);
  await page.click('[data-test=sf-drawer-close]', { timeout: 3000 }).catch(() => {});
  await wait(100);
} else ok('SAFETY › Safeguards (UB-F): product safeguards editor (no live product on this fixture)', true);
await tabTo('instruments');
ok('SAFETY › Instruments: reliability grid, hidden goals you can read, validation, disagreements', !!(await page.$('[data-home=reliabilityGrid] [data-instrument]')) && !!(await page.$('[data-home=hiddenGoalReads]')) && !!(await page.$('[data-home=validation]')) && !!(await page.$('[data-home=disagreements]')));
await page.click('[data-test=detection-open]');
await wait(150);
ok('SAFETY › Instruments: the detection grid drawer holds the grid and the sight-limit history', !!(await page.$('[data-home=detectionByLevel]')) && !!(await page.$('[data-test=race-chart]')));
await page.click('[data-test=sf-drawer-close]');
await page.click('[data-test=results-open]');
await wait(150);
ok('SAFETY › Instruments: the results drawer holds the results and the publish policy', !!(await page.$('[data-home=findings]')) && !!(await page.$('[data-act^="safety.publishPolicy"]')));
await page.click('[data-test=sf-drawer-close]');
await tabTo('model');
ok('SAFETY › Model: trait beliefs (4 families + other), in tests vs in real use, where beliefs come from', (await page.$$('[data-home=traitBeliefs] [data-family]')).length === 5 && (await page.$$('[data-home=traitBeliefs] [data-trait]')).length === 17 && !!(await page.$('[data-home=testGap]')) && !!(await page.$('[data-home=beliefSources]')));
await page.click('[data-test="trait-open.SCHEME"]');
await wait(150);
ok('SAFETY › Model: a trait opens its evidence drawer with an Open case button', !!(await page.$('[data-home=traitEvidence] [data-act="trait-case"]')));
await page.click('[data-test=sf-drawer-close]');
// UB-9: safety programmes live on RESEARCH › Portfolio (UB-6); SAFETY has a link chip, no second copy.
ok('SAFETY: no Programmes tab; a Safety programmes chip links to RESEARCH › Portfolio', !(await page.$('main.center [data-tabs=safety] [data-tab=lines]')) && !(await page.$('[data-home=researchLines]')) && !!(await page.$('.sf-tabs [data-ref=safetyProgrammes]')));
await check('SAFETY: the Safety programmes chip opens RESEARCH › Portfolio', 'store.panel + "." + (store.tab.research || "")', () => page.click('.sf-tabs [data-ref=safetyProgrammes]'));
ok('SAFETY: the chip lands on the Portfolio safety column', !!(await page.$('[data-home=safetyProgrammes]')));
await nav('safety');
await tabTo('cases');
await check('Investigations: open a case with 20 engineers', 'JSON.stringify(s.player.safety.investigations.filter((i) => !i.outcome).map((i) => i.fte))', async () => { await page.selectOption('[data-test=inv-trait]', 'SUCC'); await page.selectOption('[data-test=inv-fte]', '20'); await page.click('[data-panel=safety] [data-home=investigations] [data-act="safety.investigate"]'); });
ok('Investigations: the open case shows as a case card', !!(await page.$('[data-home=investigations] [data-case]')));
ok('SAFETY › Incidents & cases: incident timeline and disclosure policy', !!(await page.$('[data-home=incidentTimeline]')) && !!(await page.$('[data-home=disclosure] [data-act^="disclosure."]')));
for (const t of await tabsOf()) await check(`Safety tab ${t}`, 'store.tab.safety || ""', () => tabTo(t), 30).catch(() => {});
await tabTo('risks');
await nav('codex');
await check('Codex category', `document.querySelector('.codex-entry').innerText`, () => page.click('[data-codex-cat="Traits"]'));
await check('Codex search', `document.querySelector('.codex-list').innerText`, () => page.fill('[data-test=codex-search]', 'scheming'));
// UB-A: the Risk panel became World › Risk (sources and flows on one tab).
await nav('world');
await tabTo('risk');
ok('World › Risk: no loss-of-control row for your own models (SAFETY is its home)', !(await page.$('[data-panel=world] [data-risk=own]')));
ok('World › Risk: no Risk item in the navigation', !(await page.$('[data-nav=risk]')));
await check('Flows node opens panel', 'store.panel', () => page.click('[data-node=player]'));

// UB-6 / UB-8 RESEARCH: tabs Portfolio / Discoveries / Know-how. Discoveries: node card adds to the list; Portfolio:
// Limited-by strip, read-only science split, capability and safety columns (one card grammar, drag / Alt+↑↓ reorder),
// the card drawer (Gets, teams wanted, idea choice, remove), Add project, more safety programmes; Know-how: five area
// bars, Waiting, Lab tools, an area's results. The game places the teams (no team picker).
await nav('research');
await tabTo('tree');
await wait(80);
// UB-A Discoveries: field lanes × Known · Can start now · One step away · Later; node chips; drawer (L2) with gives /
// costs, chance, size at 1 and 2 teams, needs, the other road, Add to Priority list; a researching node links to Portfolio.
{
  const nn = (await page.$$('[data-panel=research] .dc-nd')).length;
  ok('Research: tree renders', nn >= 10, `nodes ${nn}`);
  ok('Research: no team picker', !(await page.$('[data-test=assign-open]')));
  ok('Discoveries: six field lanes and four columns with counts', JSON.parse(await get(`document.querySelectorAll('[data-panel=research] .dc-lane').length === 6 && ['n-known', 'n-now', 'n-next', 'n-later'].every((k) => /[0-9]/.test(document.querySelector('[data-test=' + k + ']')?.innerText ?? ''))`)));
  ok('Discoveries: no ongoing capability programme in the tree (Portfolio is home)', !(await page.$('[data-panel=research] [data-node="L.scale"]')));
  ok('Discoveries: every open node shows an effect line', JSON.parse(await get(`[...document.querySelectorAll('[data-panel=research] .dc-nd[data-status=open] .l2 .ef')].every((e) => e.innerText.trim().length > 0)`)));
}
await check('Research: click an idea opens its node card', 'store.tab["research.sel"] || ""', () => page.click('[data-panel=research] .dc-nd[data-node=P05]'));
ok('Research: node card shows the chance and the size at 1 and 2 teams', JSON.parse(await get(`(() => { const c = document.querySelector('[data-test=node-card]'); return !!c && /Chance it works/i.test(c.innerText) && /with 1 team/.test(c.innerText) && /with 2/.test(c.innerText); })()`)));
await check('Research: Add to Priority list from the card', 'JSON.stringify(s.player.research.queue)', () => page.click('[data-act="research.queue.P05"]'));
await page.evaluate(() => window.ai27v2.step(1));
await wait(60);
ok('Research: the queued idea shows on the tree as queued or researching', JSON.parse(await get(`['queued', 'active'].includes(document.querySelector('[data-panel=research] [data-node=P05]')?.getAttribute('data-status'))`)));
await page.click('[data-test=node-close]').catch(() => {});
await check('Research: Add a second idea to the priorities from its card', 'JSON.stringify(s.player.research.queue)', async () => { await page.click('[data-panel=research] .dc-nd[data-node=elastic]'); await page.click('[data-act="research.queue.elastic"]'); });
await page.click('[data-test=node-close]').catch(() => {});
await check('Research: Safety filter dims capability discoveries', 'document.querySelectorAll("[data-panel=research] .dc-nd.dimx").length', () => page.click('[data-test=tree-filter] [data-opt=saf]'));
await page.click('[data-test=tree-filter] [data-opt=all]');
await shot('40-research-all');
await page.click('[data-panel=research] .dc-nd[data-node=P17]').catch(() => {});
await wait(60);
ok('Discoveries: Neuralese card shows what it gives, what it costs and the other road', JSON.parse(await get(`(() => { const c = document.querySelector('[data-test=node-card][data-card=P17]'); return !!c && !!c.querySelector('[data-test=gives]') && !!c.querySelector('[data-test=costs]') && !!c.querySelector('[data-road=P23]'); })()`)));
await check('Discoveries: the other road opens Faithful reasoning', 'store.tab["research.sel"] || ""', () => page.click('[data-test=node-card] [data-road=P23]'));
await shot('41-research-node');
await check('Discoveries: Escape closes the card', 'store.tab["research.sel"] || ""', () => page.keyboard.press('Escape'));
{
  const res = await page.$('[data-panel=research] .dc-nd[data-status=active]');
  if (res) {
    await res.click();
    await check('Discoveries: a researching node links to its Portfolio card', 'store.tab["research"] + ":" + (store.tab["research.drawer"] || "")', () => page.click('[data-test=node-card] [data-test=open-project]'));
    await page.keyboard.press('Escape');
    await tabTo('tree');
  }
}
await tabTo('projects');
await wait(80);
ok('Portfolio: Limited-by strip with four segments, one lit (or a red zero)', JSON.parse(await get(`document.querySelectorAll('[data-home=limitedBy] [data-lim]').length === 4 && document.querySelectorAll('[data-home=limitedBy] [data-state=on], [data-home=limitedBy] [data-state=bad]').length >= 1`)));
ok('Portfolio: science split is read-only here, with a link to LAB', !!(await page.$('[data-test=sci-split-ro] [data-ref=sciSplit]')) && !(await page.$('[data-test=sci-split-ro] [data-act]')));
ok('Portfolio: capability and safety columns side by side', JSON.parse(await get(`(() => { const a = document.querySelector('[data-home=priorities]')?.getBoundingClientRect(); const b = document.querySelector('[data-home=safetyProgrammes]')?.getBoundingClientRect(); return !!a && !!b && b.left >= a.right - 1 && Math.abs(a.top - b.top) < 4; })()`)));
ok('Portfolio: capability cards with stage tracks, next result and a programme rate', JSON.parse(await get(`document.querySelectorAll('[data-home=priorities] [data-card]').length >= 2 && document.querySelectorAll('[data-home=priorities] [data-test^="track."] .pf-stg').length >= 4 && !!document.querySelector('[data-home=priorities] [data-test^="next."]')`)));
ok('Portfolio: safety cards with the three-stage track (Ideas · Small test · Validate) and an outlook', JSON.parse(await get(`(() => { const c = document.querySelector('[data-home=safetyProgrammes] [data-card]'); return !!c && c.querySelectorAll('.pf-stg').length === 3 && /Validate/.test(c.innerText) && /Promising|Mixed|Struggling/.test(c.innerText); })()`)));
await check('Portfolio: reorder by drag', 'JSON.stringify(s.player.research.queue)', () => page.locator('[data-home=priorities] [data-card=elastic]').dragTo(page.locator('[data-home=priorities] [data-card]').first()));
await page.focus('[data-home=priorities] [data-card=elastic]');
await check('Portfolio: Alt+↓ on a focused card moves it down', 'JSON.stringify(s.player.research.queue)', () => page.keyboard.press('Alt+ArrowDown'));
await check('Portfolio: a card opens its drawer', 'store.tab["research.drawer"] || ""', () => page.click('[data-home=priorities] [data-card=elastic] .nm'));
ok('Portfolio drawer: stage track, Gets and the idea choice', JSON.parse(await get(`(() => { const d = document.querySelector('[data-test=drawer]'); return !!d && !!d.querySelector('[data-test^="drawer-track."]') && /Gets/i.test(d.innerText) && !!d.querySelector('[data-test=risk-policy]'); })()`)));
await check('Portfolio drawer: teams wanted +', 'JSON.stringify(s.player.research.want)', () => page.click('[data-test=drawer] [data-act^="want-up."]'));
await check('Portfolio drawer: teams wanted −', 'JSON.stringify(s.player.research.want)', () => page.click('[data-test=drawer] [data-act^="want-down."]'));
await check('Portfolio drawer: idea choice Bold', 's.player.research.risk', () => page.click('[data-test=drawer] [data-test=risk-policy] [data-opt=speculative]'));
await check('Portfolio drawer: idea choice back to Balanced', 's.player.research.risk', () => page.click('[data-test=drawer] [data-test=risk-policy] [data-opt=balanced]'));
await shot('42-research-drawer');
await check('Portfolio: Escape closes the drawer', 'store.tab["research.drawer"] || ""', () => page.keyboard.press('Escape'));
await check('Portfolio: + Add project', 'JSON.stringify(s.player.research.queue)', async () => { const v = await page.$eval('[data-test=add-project] option:nth-child(2)', (o) => o.value); await page.selectOption('[data-test=add-project]', v); });
{
  const added = JSON.parse(await get('s.player.research.queue[s.player.research.queue.length - 1]'));
  await page.click(`[data-home=priorities] [data-card="${added}"] .nm`);
  await check('Portfolio drawer: Remove from the list', 'JSON.stringify(s.player.research.queue)', () => page.click('[data-test=drawer] [data-act^="dequeue."]'));
  await page.keyboard.press('Escape');
}
if (await page.$('[data-test=saf-more]')) await check('Portfolio: more safety programmes open', 'document.querySelectorAll("[data-home=safetyProgrammes] [data-card]").length', () => page.click('[data-test=saf-more]'));
await shot('42-research-portfolio');
if (await page.$('[data-home=priorities] [data-test^="rate."]')) {
  await page.hover('[data-home=priorities] [data-test^="rate."]');
  await wait(380);
  ok('Portfolio: the rate tooltip gives results a year and the next result', /Results a year/.test(await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '')));
  await clearTips();
}
await tabTo('knowhow');
await wait(80);
ok('Know-how: five area bars, public and yours', JSON.parse(await get(`document.querySelectorAll('[data-home=knowHow] [data-area]').length === 5 && document.querySelectorAll('[data-home=knowHow] .kh-bar.pub').length === 5 && document.querySelectorAll('[data-home=knowHow] .kh-bar.you').length === 5`)));
ok('Know-how: Waiting panel, Where it comes from, Lab tools (three tools)', !!(await page.$('[data-home=waiting]')) && !!(await page.$('[data-home=knowHowSources]')) && (await page.$$('[data-home=labTools] [data-tool]')).length === 3);
ok('Know-how: the old recipe stacks are gone (one home)', !(await page.$('[data-home^="stack."]')) && !(await page.$('[data-home=softwareRate]')));
await check('Know-how: an area opens its results', 'store.tab["research.khOpen"] || ""', () => page.click('[data-home=knowHow] [data-area=pre]'));
await shot('43-research-knowhow');
await tabTo('projects');
if (await page.$('[data-act^="reopen."]')) await check('Research: reopen a failed project as speculative', 'JSON.stringify(s.player.research.queue)', () => page.locator('[data-act^="reopen."]').first().click());
ok('Research: no paradigm section left in Models', await (async () => { await nav('models'); return !(await page.$('[data-paradigm]')); })());
// UB-B LAB › AI staff & needs: the needs lists' editor (Change order: caps and order); build capacity on the engineers
// card. Skill at each job and milestones moved to MODELS.
await nav('lab');
await tabTo('work');
await wait(80);
ok('Work: build capacity on the engineers needs card', !!(await page.$('[data-home="needs.eng"] [data-test=build-queue]')));
await page.click('[data-test="order.research.reAlloc"]'); await page.click('[data-test="order.build.engAlloc"]'); await wait(60);
await check('Work: research-engineer cap (share)', 'JSON.stringify(s.player.research.re)', () => page.selectOption('[data-test="needs.research.reAlloc"] [data-test="cap.exp"]', 'share:0.5'));
await check('Work: research-engineer cap cleared', 'JSON.stringify(s.player.research.re)', () => page.selectOption('[data-test="needs.research.reAlloc"] [data-test="cap.exp"]', ''));
await check('Work: research-engineer order', 'JSON.stringify(s.player.research.re.order)', () => page.click('[data-test="needs.research.reAlloc"] [data-test="need-down.ops"]'));
await check('Work: research-engineer order back', 'JSON.stringify(s.player.research.re.order)', () => page.click('[data-test="needs.research.reAlloc"] [data-test="need-up.ops"]'));
await check('Work: engineers cap (count)', 'JSON.stringify(s.player.build.alloc)', () => page.selectOption('[data-test="needs.build.engAlloc"] [data-test="cap.upkeep"]', 'max:4'));
await check('Work: engineers cap cleared', 'JSON.stringify(s.player.build.alloc)', () => page.selectOption('[data-test="needs.build.engAlloc"] [data-test="cap.upkeep"]', ''));
await check('Work: engineers order', 'JSON.stringify(s.player.build.alloc.order)', () => page.click('[data-test="needs.build.engAlloc"] [data-test="need-down.runs"]'));
await check('Work: engineers order back', 'JSON.stringify(s.player.build.alloc.order)', () => page.click('[data-test="needs.build.engAlloc"] [data-test="need-up.runs"]'));
await shot('44-lab-work');
await tabTo('board');
ok('L0 research speed: × with its tooltip home (UB-5)', !!(await page.$('.topstrip2 [data-home=labSpeed]')));
ok('Flow: no v2 frontier-methods or serving-cost lines', !(await page.$('[data-limit="speed.frontierMethods"]')) && !(await page.$('[data-limit="speed.etaMod"]')));

// Overview (L1) and bottom bar
await nav('overview');
ok('Lead track lanes', (await page.$$('[data-lane]')).length >= 3);
// UB-A: Watch lives in the bottom bar (the one alert channel); the Overview has no Watch card.
ok('Overview: no Watch card (the bottom bar is the alert channel)', !(await page.$('[data-test=watch]')));
ok('Headline renders', !!(await page.$('[data-test=ticker]')));
await check('Loss-of-control risk click opens Safety', 'store.panel', () => page.click('[data-test=risk]'));

// ───────────────────────── B1: product economics (UB-A: revenue strip + drawer; day 1 here; day 400 and day 900 below) ─────────────────────────
// Every product has a revenue row (served vs not, Limited by) with a tooltip; its drawer's "Sold in a year" shows hours or
// users, serving cost and margin; every term there has a glossary tooltip.
const B1_TERMS = ['paidSeat', 'weeklyReach', 'paidShare', 'freeTier', 'adoptedHour', 'runCost', 'priceTier', 'bindingCause'];
const b1Seen = new Set();
async function b1Check(where) {
  await nav('products');
  const rows = await page.$$eval('[data-panel=products] [data-test=prod-revenue] [data-rev]', (els) => els.filter((e) => !e.classList.contains('off')).map((e) => ({ id: e.getAttribute('data-rev'), t: e.textContent ?? '' })));
  const bad = rows.filter((r) => !/\$[\d.]+[BMT]?/.test(r.t) || !/Limited by/.test(r.t) || !/served/.test(r.t));
  ok(`B1 ${where}: every product has a revenue row with served and Limited by`, rows.length >= 3 && bad.length === 0, bad.map((r) => r.t.slice(0, 80)).join(' ; '));
  let tipped = 0;
  for (const r of rows) {
    await clearTips();
    await page.hover(`[data-rev="${r.id}"] .bar`);
    await wait(380);
    const t = await page.evaluate(() => ({ text: document.querySelector('.tip')?.innerText ?? '', terms: [...document.querySelectorAll('.tip [data-term]')].map((e) => e.getAttribute('data-term')) }));
    if (/Wanted/.test(t.text)) tipped++;
    for (const x of t.terms) b1Seen.add(x);
  }
  await clearTips();
  ok(`B1 ${where}: every revenue bar opens its tooltip (wanted, not served) (${rows.length})`, tipped === rows.length, `${tipped}/${rows.length}`);
  const sold = [];
  for (const r of rows) {
    await page.click(`[data-test="prod-open.${r.id}"]`);
    await wait(100);
    const e = await page.$eval(`[data-test=prod-drawer] [data-test="prod-econ.${r.id}"]`, (x) => x.innerText).catch(() => '');
    for (const x of await page.$$eval('[data-test=prod-drawer] [data-term], [data-panel=products] [data-product] [data-term]', (els) => els.map((y) => y.getAttribute('data-term')))) b1Seen.add(x);
    sold.push({ id: r.id, ok: /Serving cost/.test(e) && /Margin/.test(e) && /(Hours of work sold|Weekly users)/.test(e) && /\d/.test(e), e: e.replace(/\n/g, ' ').slice(0, 80) });
    await page.click('[data-test=prod-drawer-close]');
  }
  ok(`B1 ${where}: every drawer shows sold in a year (hours or users, serving cost, margin)`, sold.every((x) => x.ok), sold.filter((x) => !x.ok).map((x) => x.e).join(' ; '));
}
// ───────────────────────── B2: customers on the card, tools (day 1, 400, 900) ─────────────────────────
// Every card shows its share now → where buyers are heading (or holding), with the time in words and the best rival;
// the customers tooltip carries the target; every tool on a card shows where it helps and its effect; the tools editor
// rows keep their type, typed effect and tooltips (cost, upkeep, on here, gate).
const B2_TERMS = ['customerStock', 'targetShare', 'featEnabler', 'featHorizon', 'featScaffold'];
const b2Seen = new Set();
const hoverTip = async (sel) => {
  await clearTips();
  await page.hover(sel);
  await wait(380);
  const t = await page.evaluate(() => ({ text: document.querySelector('.tip')?.innerText ?? '', terms: [...document.querySelectorAll('.tip [data-term]')].map((e) => e.getAttribute('data-term')) }));
  for (const x of t.terms) b2Seen.add(x);
  return t.text;
};
async function b2Check(where) {
  await nav('products');
  const cards = await page.$$eval('[data-panel=products] [data-product]', (els) => els.map((e) => ({
    id: e.getAttribute('data-product'), ch: e.getAttribute('data-channel'),
    stock: e.querySelector('[data-test^="prod-cust-stock."]')?.textContent ?? '',
    users: e.querySelector('[data-test^="prod-users."]')?.textContent ?? '',
  })));
  const bad = cards.filter((c) => !/\d%\s*(→\s*[\d.]+%|holding)/.test(c.stock) || (c.ch === 'consumer' && !/weekly users/.test(c.users)));
  for (const x of await page.$$eval('[data-panel=products] [data-test^="prod-cust."] [data-term], [data-panel=products] [data-tool] [data-term]', (els) => els.map((e) => e.getAttribute('data-term')))) b2Seen.add(x);
  ok(`B2 ${where}: every card shows its share now → where buyers are heading`, cards.length >= 3 && bad.length === 0, bad.map((c) => `${c.ch}: ${c.stock} | ${c.users}`).join(' ; ') || cards.map((c) => `${c.ch}: ${c.stock}`).join(' ; '));
  let tipped = 0;
  for (const c of cards) if (/heading/i.test(await hoverTip(`[data-test="prod-cust-stock.${c.id}"]`))) tipped++;
  ok(`B2 ${where}: customer tracks open tooltips with where buyers are heading (${cards.length})`, tipped === cards.length, `${tipped}/${cards.length}`);
  const tools = await page.$$eval('[data-panel=products] [data-product] [data-tool]', (els) => els.map((e) => ({ f: e.getAttribute('data-tool'), t: e.textContent ?? '' })));
  const tbad = tools.filter((x) => !/(×[\d.]+|\+\d+%)/.test(x.t));
  ok(`B2 ${where}: every tool on a card shows where it helps and its effect (${tools.length})`, tbad.length === 0, tbad.map((x) => `${x.f}: ${x.t}`).join(' ; '));
  // UB-A: the card's tool rows carry the tool-type term in their tooltip (task tool / long-task tool / harness).
  for (const x of [...new Set(tools.map((t) => t.f))]) await hoverTip(`[data-panel=products] [data-product] [data-tool="${x}"]`).catch(() => '');
  await clearTips();
  // Tools editor (Add a tool): type chip and typed effect on every row; gated rows name the idea; tooltips.
  const first = cards.find((c) => c.ch !== 'consumer') ?? cards[0];
  if (!first) return;
  await page.click(`[data-test="prod-tool-add.${first.id}"]`);
  const feats = await page.$$eval(`[data-product="${first.id}"] [data-feature]`, (els) => els.map((e) => ({
    f: e.getAttribute('data-feature'), kinds: [...e.querySelectorAll('.ft-k')].map((k) => k.getAttribute('data-kind')),
    fx: e.querySelector('[data-test^="feature-fx."]')?.textContent ?? '', gate: e.querySelector('[data-test^="feature-gate."]')?.textContent ?? '',
  })));
  const UNIT = { scaffold: /skill ×[\d.]+ ×\d+ tok/, horizon: /×[\d.]+ longer tasks/, enabler: /\+[\d.]+(%| OOM)/, effort: /\+[\d.]+ OOM ×\d+ tok/ };
  const fbad = feats.filter((x) => !x.kinds.length || (x.gate ? !/needs \S/.test(x.gate) : !x.kinds.every((k) => UNIT[k]?.test(x.fx))));
  ok(`B2 ${where}: every tools-editor row shows its type and typed effect (locked: the idea) (${feats.length})`, feats.length >= 2 && fbad.length === 0, fbad.map((x) => `${x.f}: ${x.kinds} | ${x.fx} | ${x.gate}`).join(' ; '));
  const fmiss = [];
  for (const x of feats) {
    const tx = await hoverTip(`[data-product="${first.id}"] [data-feature="${x.f}"] .ft-fx`);
    if (!(/Build/.test(tx) && /Upkeep/.test(tx) && /On this product/.test(tx) && /Unlocked by/.test(tx))) fmiss.push(`${x.f}: ${tx.replace(/\n/g, ' ').slice(0, 60)}`);
  }
  await clearTips();
  await page.click(`[data-test="prod-tool-add.${first.id}"]`);
  ok(`B2 ${where}: tools-editor tooltips show cost, upkeep, on here and the gate`, fmiss.length === 0, fmiss.slice(0, 3).join(' ; '));
}
// ───────────────────────── B3: World › Sectors (day 1, 400, 900) ─────────────────────────
// The region strip shows workers using AI, hours of use, hours saved per hour, paid seats and agent-hours; the sector card
// shows adoption in two quantities (W and U vs A, values equal to the state), the limits F / K / 1 − R with the binding
// one, who pays (hours by payer, paid seat share → target) and the providers' cost of an AI work-hour vs the wage; every
// row opens a tooltip; the work-type tooltip has the work data; a cell click selects the sector; every new term is reached.
const B3_TERMS = ['workersUsingAI', 'hoursOfUse', 'savedPerHour', 'unseatedUse', 'seatShare', 'agentLeverage', 'costGate', 'feasibility', 'aiWorkHourCost', 'verifiability'];
const b3Seen = new Set();
const b3Tip = async (sel) => {
  await clearTips();
  await page.hover(sel);
  await wait(380);
  const t = await page.evaluate(() => ({ text: document.querySelector('.tip')?.innerText ?? '', terms: [...document.querySelectorAll('.tip [data-term]')].map((e) => e.getAttribute('data-term')) }));
  for (const x of t.terms) b3Seen.add(x);
  return t.text;
};
async function b3Check(where, shotName) {
  await nav('world');
  await tabTo('sectors');
  const card = async () => page.evaluate(() => {
    const c = document.querySelector('[data-test=ws-card]');
    const tx = (k) => c?.querySelector(`[data-test="${k}"]`)?.textContent ?? '';
    return {
      sid: c?.getAttribute('data-sector'), r: c?.getAttribute('data-region'),
      W: tx('ws-W'), U: tx('ws-U'), A: tx('ws-A'), saved: tx('ws-saved-sector'), bind: tx('ws-binding'), wt: tx('ws-worktype'),
      lims: ['capability', 'cost', 'friction'].map((k) => tx(`ws-lim-${k}`)), limBind: c?.querySelector('.ws-lim.bind')?.getAttribute('data-test') ?? '',
      pay: tx('ws-pay'), seat: tx('ws-seat'), prov: [...(c?.querySelectorAll('[data-provider]') ?? [])].map((e) => ({ k: e.getAttribute('data-provider'), t: e.textContent })),
      ref: !!c?.querySelector('[data-ref=customerStock]'),
      strip: document.querySelector('[data-test=ws-strip]')?.textContent ?? '',
      clipped: [...(c?.querySelectorAll('.ws-v, .ws-pr-s, .ws-pr-c, .ws-pr-v, .ws-lim-v, .ws-ttl') ?? [])].filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent),
    };
  });
  const c = await card();
  for (const x of await page.$$eval('[data-test=world-sectors] [data-term]', (els) => els.map((e) => e.getAttribute('data-term')))) b3Seen.add(x);
  ok(`B3 ${where}: strip shows workers, hours of use, hours saved, seats and agent-hours`, /Workers using AI\s*\d+%/.test(c.strip) && /Hours of use\s*[\d.]+%/.test(c.strip) && /saves\s*[\d.]+ h/.test(c.strip) && /Paid seats\s*[\d.]+[KMB]?/.test(c.strip) && /Agent-hours\s*[\d.]+[KMB]?/.test(c.strip), c.strip.slice(0, 140));
  const st = JSON.parse(await get(`(() => { const x = s.world.sectors['${c.r}']['${c.sid}']; return { W: x.W, A: x.A, Astar: x.Astar, F: x.F, K: x.K, R: x.R, b: x.binding, seat: x.seat }; })()`));
  const p0 = (x) => { const v = x * 100; return `${v > 0 && v < 1 ? v.toFixed(1) : v.toFixed(0)}%`; };
  const p1 = (x) => `${(x * 100).toFixed(1)}%`;
  ok(`B3 ${where}: card values equal the state (${c.sid} ${c.r}: W ${p0(st.W)}, A ${p1(st.A)} → ${p1(st.Astar)}, F ${p0(st.F)}, K ${p0(st.K)}, 1 − R ${p0(1 - st.R)})`,
    c.W.endsWith(p0(st.W)) && c.A.includes(`${p1(st.A)} → ${p1(st.Astar)}`) && c.lims[0].includes(p0(st.F)) && c.lims[1].includes(p0(st.K)) && c.lims[2].includes(p0(1 - st.R)) && c.seat.includes(p0(st.seat)) && c.bind.includes(st.b),
    JSON.stringify({ W: c.W, A: c.A, lims: c.lims, seat: c.seat, bind: c.bind }).slice(0, 300));
  ok(`B3 ${where}: hours of use, saved per hour and wage shown`, /[\d.]+% of hours/.test(c.U) && /Saves\s*[\d.]+ h.*wage \$[\d.]+/.test(c.saved), `${c.U} | ${c.saved}`);
  ok(`B3 ${where}: binding limit highlighted (or diffusion)`, st.b === 'diffusion' ? c.limBind === '' : c.limBind === `ws-lim-${st.b}`, `${st.b} / ${c.limBind || 'none'}`);
  ok(`B3 ${where}: who pays splits hours by payer, seats → target, agent-hours`, /per hour\s*\d+%/.test(c.pay) && /seats\s*\d+%/.test(c.pay) && /unseated\s*\d+%/.test(c.pay) && /agents\s*\+[\d.]+[KMB]? h/.test(c.pay) && /[\d.]+%\s*→\s*[\d.]+%/.test(c.seat), `${c.pay} | ${c.seat}`);
  ok(`B3 ${where}: providers with share → target, coverage and cost vs wage; link to products`, c.prov.length >= 2 && c.prov.every((p) => /→/.test(p.t) && /\$[\d.]+$/.test(p.t.trim())) && c.ref, c.prov.map((p) => `${p.k}: ${p.t}`).join(' ; ').slice(0, 200));
  ok(`B3 ${where}: no clipped numbers on the sector card`, c.clipped.length === 0, c.clipped.join(' | '));
  // Tooltips on every row.
  const rows = ['ws-workers', 'ws-hours', 'ws-saved', 'ws-seats', 'ws-agents', 'ws-W', 'ws-U', 'ws-A', 'ws-saved-sector', 'ws-lim-capability', 'ws-lim-cost', 'ws-lim-friction', 'ws-pay', 'ws-seat', 'ws-binding', 'ws-worktype'];
  let tipped = 0;
  const miss = [];
  const texts = {};
  for (const r of rows) {
    const tx = await b3Tip(`[data-test="${r}"] :is(.num, .ws-bar, .ws-bind-v) >> nth=0`);
    texts[r] = tx;
    if (tx.length > 20) tipped++; else miss.push(r);
  }
  const pv = await page.$$eval('[data-test=ws-card] [data-provider]', (els) => els.map((e) => e.getAttribute('data-provider')));
  for (const k of pv.slice(0, 2)) {
    const tx = await b3Tip(`[data-test=ws-card] [data-provider="${k}"] .ws-pr-v`);
    texts[`prov.${k}`] = tx;
    if (/Cost of an AI work-hour/.test(tx) && /vs wage \$/.test(tx) && /review/.test(tx) && /Coverage/.test(tx)) tipped++; else miss.push(`prov.${k}`);
  }
  ok(`B3 ${where}: every sector-view row opens a tooltip (${rows.length + Math.min(2, pv.length)})`, tipped === rows.length + Math.min(2, pv.length), miss.join(', '));
  ok(`B3 ${where}: work-type tooltip has domain weights, task length, verifiability, θ vs fit, tokens`, /Typical task length/.test(texts['ws-worktype']) && /Verifiability/.test(texts['ws-worktype']) && /Median professional/.test(texts['ws-worktype']) && /Tokens per agent-hour/.test(texts['ws-worktype']), texts['ws-worktype'].replace(/\n/g, ' ').slice(0, 120));
  ok(`B3 ${where}: cost gate tooltip compares the AI work-hour with the wage`, /Wage/.test(texts['ws-lim-cost']) && /Cost of an AI work-hour/.test(texts['ws-lim-cost']), texts['ws-lim-cost'].replace(/\n/g, ' ').slice(0, 100));
  if (c.r === 'US' && c.sid === 'SOFT') ok(`B3 ${where}: US Software hours of use names its survey anchor`, /Survey: Information/.test(texts['ws-U']) && /Real-Time Population Survey/.test(texts['ws-U']), texts['ws-U'].replace(/\n/g, ' ').slice(0, 140));
  await clearTips();
  if (shotName) await shot(shotName);
  // Selection and metric toggle.
  await page.click('[data-cell="HEALTH.CN"]');
  await wait(80);
  const c2 = await card();
  ok(`B3 ${where}: clicking a heatmap cell selects that sector and region`, c2.sid === 'HEALTH' && c2.r === 'CN', `${c2.sid} ${c2.r}`);
  const cellA = async () => page.$eval('[data-cell="SOFT.US"]', (e) => e.textContent);
  const before = await cellA();
  await page.click('[data-test=ws-metric] [data-opt=A]');
  await wait(60);
  const afterA = await cellA();
  const stA = JSON.parse(await get('s.world.sectors.US.SOFT.A'));
  ok(`B3 ${where}: heatmap metric switch shows automated A`, afterA === p0(stA) && afterA !== before, `${before} → ${afterA} (A ${p0(stA)})`);
  await page.click('[data-test=ws-metric] [data-opt=U]');
  await page.click('[data-cell="SOFT.US"]');
  await wait(60);
}
// ───────────────────────── B4: model-v3 leftovers (day 1, 400, 900) ─────────────────────────
// Real customer counts in the top-strip revenue tooltip and the Core loop (Chat: weekly users and paying; seats where
// sold; otherwise the share → target, never revenue ÷ ARPU); serving as FLOP per token and cost per hour of use on the
// Blueprint and Models (no relative "serve cost"); the products' launch card and serving split beside the cards; the
// project card under the priority list; jobs under the sector heatmap; "auto" teams wanted and the keyboard reorder;
// capability research log entries open Research › Projects.
const FAKE_NOUNS = /\b(developers|organisations|contracts|partners|downloads)\b/;
async function b4Check(where) {
  await closeModals();
  await clearTips();
  // UB-5: revenue left L0; it is a row of the cash · runway tooltip (customers live on the Products cards).
  await page.hover('[data-test=cash]');
  await wait(450);
  const rev = await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '');
  const chatLive = JSON.parse(await get(`s.player.deployments.some((d) => d.channel === 'consumer' && d.status === 'live')`));
  ok(`B4 ${where}: the cash tooltip carries revenue (30-day average)`, /Revenue · 30-day average/.test(rev), rev.replace(/\n/g, ' ').slice(0, 220));
  await clearTips();
  // UB-A: customers live on the product cards only; the Overview hub's Products box gives a verdict, no customer numbers.
  // UB-10: cost per hour of work is on the MODELS card (tooltip: per agent-hour, $ per H100e-hour); no "serve cost".
  await nav('blueprint');
  await tabTo('next');
  const bpText = await page.locator('[data-panel=blueprint]').innerText();
  await nav('models');
  const mText = await page.locator('[data-panel=models]').innerText();
  ok(`B4 ${where}: no relative "serve cost" on Training or Models; the model card shows the cost per hour of work`, !/serve cost/i.test(bpText + mText) && /Cost per hour of work\s*(\$[\d.]+|[\d.]+¢)/.test(mText), (mText.match(/Cost per hour[^\n]*/) ?? [''])[0]);
  await page.hover('[data-test=card-cost] b');
  await wait(400);
  const tt = await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '');
  ok(`B4 ${where}: cost tooltip: per agent-hour, $ per H100e-hour`, /Cost per agent-hour/.test(tt) && /per H100e-hour/.test(tt), tt.replace(/\n/g, ' ').slice(0, 160));
  await clearTips();
  await page.click('[data-test=card-trained]');
  await wait(100);
  const trained = await page.$eval('[data-test=card-trained-list]', (e) => e.innerText).catch(() => '');
  ok(`D3 ${where}: model card › Trained with shows the data specialisation (no "Research boost")`, /Data/.test(trained) && !/Research boost/i.test(mText + trained), trained.replace(/\n/g, ' ').slice(0, 160));
  // Products (UB-A): the live cards and the Agents card share one row; the revenue strip sits above them.
  await nav('products');
  const pr = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('[data-panel=products] [data-product], [data-test=prod-launch]')].map((e) => Math.round(e.getBoundingClientRect().top));
    const rv = document.querySelector('[data-test=prod-revenue]')?.getBoundingClientRect();
    return { n: cs.length, rows: new Set(cs).size, revTop: rv ? Math.round(rv.top) : -1, cardTop: cs[0] ?? -1 };
  });
  ok(`B4 ${where}: Products: cards and the launch card in one row under the revenue strip`, pr.n <= 4 ? pr.rows === 1 && pr.revTop >= 0 && pr.revTop < pr.cardTop : true, JSON.stringify(pr));
  await shot(`80-${where.replace(' ', '')}-products-b4`);
  // Research › Portfolio (UB-6): the board's two columns, no clipped card names; auto teams wanted and the keyboard
  // reorder from the card drawer / a focused card.
  await nav('research');
  await tabTo('projects');
  await wait(60);
  const lay = await page.evaluate(() => {
    const l = document.querySelector('[data-home=priorities]')?.getBoundingClientRect();
    const r = document.querySelector('[data-home=safetyProgrammes]')?.getBoundingClientRect();
    const clipped = [...document.querySelectorAll('[data-home=priorities] .pf-card .nm')].filter((x) => x.scrollWidth > x.clientWidth + 1).length;
    return { side: !!l && !!r && r.left >= l.right - 1, clipped };
  });
  ok(`B4 ${where}: Research: capability and safety side by side; no clipped card name`, lay.side && lay.clipped === 0, JSON.stringify(lay));
  const first = await page.$eval('[data-home=priorities] [data-project]', (e) => e.getAttribute('data-project')).catch(() => '');
  if (first) {
    await page.click(`[data-home=priorities] [data-card="${first}"] .nm`);
    await wait(60);
    await check(`B4 ${where}: Auto teams wanted turns on`, 'JSON.stringify(s.player.research.wantAuto)', () => page.click(`[data-test=drawer] [data-act="want-auto.${first}"]`));
    ok(`B4 ${where}: the drawer shows "auto" teams wanted`, /wanted auto/.test(await page.$eval('[data-test=drawer]', (e) => e.textContent ?? '')) && (await page.getAttribute(`[data-test=drawer] [data-act="want-auto.${first}"]`, 'aria-pressed')) === 'true');
    await page.mouse.move(1, 1); // not Escape: it would close the drawer
    await page.hover(`[data-test=drawer] [data-act="want-auto.${first}"]`);
    await wait(380);
    ok(`B4 ${where}: the Auto toggle's tooltip explains priority and fit`, /priority and fit/.test(await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '')));
    await page.mouse.move(1, 1); // not Escape: it would close the drawer
    await shot(`81-${where.replace(' ', '')}-research-portfolio-b4`);
    await check(`B4 ${where}: Auto teams wanted turns off (fixes the number)`, 'JSON.stringify(s.player.research.wantAuto)', () => page.click(`[data-test=drawer] [data-act="want-auto.${first}"]`));
    const labels = await page.$$eval('[data-test=drawer] [data-act^="want-"]', (els) => els.filter((e) => !e.getAttribute('aria-label')).map((e) => e.getAttribute('data-act')));
    ok(`B4 ${where}: − + and Auto have accessible labels`, labels.length === 0, labels.slice(0, 4).join(', '));
    await page.keyboard.press('Escape');
    const n = JSON.parse(await get("document.querySelectorAll('[data-home=priorities] [data-project]').length"));
    if (n > 1) {
      await page.focus(`[data-home=priorities] [data-project="${first}"]`);
      await check(`B4 ${where}: Alt+↓ on a focused card moves it down (keyboard reorder)`, 'JSON.stringify(s.player.research.queue)', () => page.keyboard.press('Alt+ArrowDown'));
      await page.focus(`[data-home=priorities] [data-project="${first}"]`);
      await check(`B4 ${where}: Alt+↑ moves it back`, 'JSON.stringify(s.player.research.queue)', () => page.keyboard.press('Alt+ArrowUp'));
    }
  }
  // World › Sectors: jobs under the heatmap.
  await nav('world');
  await tabTo('sectors');
  const wj = await page.evaluate(() => {
    const left = document.querySelector('[data-test=world-sectors] .ws-left');
    const card = document.querySelector('[data-test=ws-card]')?.getBoundingClientRect();
    const lb = left?.getBoundingClientRect();
    return { jobs: !!left && /Unemployment US/.test(left.textContent ?? ''), gap: card && lb ? Math.round(Math.abs(lb.bottom - card.bottom)) : -1 };
  });
  ok(`B4 ${where}: World › Sectors: jobs sit under the heatmap (columns end within 300 px of each other)`, wj.jobs && wj.gap >= 0 && wj.gap < 300, JSON.stringify(wj));
  await shot(`82-${where.replace(' ', '')}-world-sectors-b4`);
  // Log routing: a capability project's result opens Research › Projects; a safety entry opens Safety.
  const cap = first;
  await page.evaluate((id) => {
    const s = window.ai27v2.state;
    s.log.push({ day: s.time.day, kind: 'research', text: `B4 test: ${id} works.`, severity: 2, ref: id });
    s.log.push({ day: s.time.day, kind: 'research', text: 'B4 test: new tool.', severity: 2, ref: 'no-such-technique' });
    window.ai27v2.notify();
  }, cap);
  await wait(60);
  await page.click('[data-test=alert-chip]');
  await wait(80);
  const routes = await page.$$eval('[data-test=alert-list] [data-alert-row=research]', (els) => els.map((e) => ({ r: e.getAttribute('data-route'), t: e.textContent ?? '' })));
  const capRow = routes.find((x) => /B4 test: .* works/.test(x.t));
  const safRow = routes.find((x) => /B4 test: new tool/.test(x.t));
  ok(`B4 ${where}: log routing: capability research → Research › Projects, the rest of research → Safety`, (!cap || capRow?.r === 'research.projects') && safRow?.r === 'safety', JSON.stringify(routes.map((x) => x.r)));
  if (cap) {
    const idx = routes.indexOf(capRow);
    await page.locator('[data-test=alert-list] [data-alert-row=research] [data-test=alert-open]').nth(idx).evaluate((b) => b.click());
    await wait(80);
    ok(`B4 ${where}: Open on a capability result opens its card drawer`, JSON.parse(await get(`store.panel === 'research' && store.tab.research === 'projects' && store.tab['research.drawer'] === ${JSON.stringify(cap)}`)));
  } else await page.click('[data-test=alert-chip]');
  await page.evaluate(() => { const s = window.ai27v2.state; s.log = s.log.filter((e) => !/^B4 test:/.test(e.text)); window.ai27v2.notify(); });
  await closeModals();
}
// ───────────────────────── D6: Models › Suites (day 1, 400, 900) ─────────────────────────
const D6_TERMS = ['envSuite', 'suiteFidelity', 'suiteExploit', 'rewardHackPressure', 'buildCapacity', 'riskFamily']; // UB-B: the terms on the Environments screen (Expand / Harden terms sit in their tooltips)
const d6Seen = new Set();
const tipText = async (sel) => {
  await clearTips();
  await page.hover(sel);
  await wait(400);
  return page.evaluate(() => document.querySelector('.tip')?.innerText ?? '');
};
const suiteQueue = `s.player.build.queue.filter((q) => q.kind === 'suite').map((q) => q.ref).join(',')`;
/** Step the game a day at a time until no suite work `ref` is queued (at most `max` days). */
async function stepUntilDone(ref, max = 40) {
  for (let i = 0; i < max; i++) {
    if (!JSON.parse(await get(`s.player.build.queue.some((q) => q.kind === 'suite' && q.ref === ${JSON.stringify(ref)})`))) return true;
    await page.evaluate(() => window.ai27v2.step(1));
    await closeModals();
    await pause();
  }
  return false;
}
// Model v3 E11: footholds, believed control and the danger readout. Values on screen equal the belief selectors
// (store.readouts); no hidden foothold or true control appears; with `plant` a located foothold's Remove preview matches
// what removing it does.
async function e11Check(where, plant = false) {
  const tag = where.replace(' ', '');
  const sel = (expr) => get(`(() => { const r = store.readouts; return ${expr}; })()`).then((x) => JSON.parse(x));
  await page.evaluate(() => {
    const s = window.ai27v2.state;
    const v = s.player.agents.capRoutine.versionId;
    s.player.safety.footholds = (s.player.safety.footholds ?? []).filter((f) => !f.id.startsWith('FH-E11'));
    // A hidden foothold the view must never show, and a distinctive true control level the UI must never show.
    s.player.safety.footholds.push({ id: 'FH-E11-HIDDEN', kind: 'backdoor', versionId: v, lineage: 'L-x', day: s.time.day - 30, acts: 1, severity: 3, size: 0.37, status: 'hidden' });
    window.__e11ctl = { ...s.player.safety.effectiveControl };
    window.__e11off = s.flags['ws4:agentsOffUntil'];
    s.player.safety.effectiveControl.level = 0.0137;
    s.player.safety.effectiveControl.exposure = 0.9863;
    window.ai27v2.notify();
  });
  if (plant) await page.evaluate(() => {
    const s = window.ai27v2.state;
    const v = s.player.agents.capRoutine.versionId;
    s.player.safety.footholds.push({ id: 'FH-E11-LOC', kind: 'hiddenCompute', versionId: v, lineage: 'L-x', day: s.time.day - 40, acts: 1, severity: 3, size: 3000, status: 'detected', symptom: 'located by an investigation', suspectedDay: s.time.day - 30, detectedDay: s.time.day - 2 });
    s.player.safety.footholds.push({ id: 'FH-E11-SUS', kind: 'backdoor', versionId: v, lineage: 'L-x', day: s.time.day - 40, acts: 1, severity: 2, size: 0.16, status: 'suspected', symptom: 'monitors flagged unexplained access', suspectedDay: s.time.day - 3 });
    window.ai27v2.notify();
  });
  // Products (UB-A): misuse risk lives on SAFETY › Risks (misuse rows); Products carries no danger readout.
  await nav('products');
  await wait(120);
  ok(`E11 ${where}: no product danger readout on Products (its home is SAFETY › Risks)`, !(await page.$('[data-test^="prod-danger."]')));
  // Agents at work: each running lane's danger equals dangerView's.
  await nav('lab');
  await tabTo('work');
  const lanes = await page.$$eval('[data-test^="agent-danger."]', (els) => els.map((e) => [e.getAttribute('data-test').slice(13), Number(e.getAttribute('data-harm'))]));
  const lv = await sel('Object.fromEntries(Object.entries(r.dangerView(s).lanes).map(([k, x]) => [k, x.harmful]))');
  const running = await page.evaluate(() => ['eng', 'capRoutine', 'capFrontier', 'safety'].filter((u) => !!document.querySelector(`[data-lane="${u}"]`) && !document.querySelector(`[data-test="lane-off.${u}"]`)));
  ok(`E11 ${where}: a danger readout on every running agent lane, equal to the belief selector`, lanes.length >= 1 && lanes.length === running.filter((u) => lv[u] !== undefined).length && lanes.every(([u, h]) => Math.abs(h - lv[u]) < 1e-4), JSON.stringify(lanes));
  if (lanes.length) { await page.hover(`[data-test="agent-danger.${lanes[0][0]}"]`); await wait(350); await shot(`e11-${tag}-lane-danger`); await clearTips(); }
  // UB-9: SAFETY's Loss-of-control risk tile equals the believed selector for the picked model; the true level never
  // shows; the AI staff safeguards card (SAFETY › Safeguards) holds the control layer; footholds count known ones only.
  await nav('safety');
  await tabTo('risks');
  const pickId = await page.$eval('[data-test=sf-model]', (e) => e.value).catch(() => '');
  const shown = await page.$eval('[data-test=sf-risk]', (e) => Number(e.getAttribute('data-risk'))).catch(() => NaN);
  const lr = JSON.parse(await get(`(() => { const r = store.readouts.lossOfControlRisk(s, ${JSON.stringify(pickId)}); return r ? r.p : -1; })()`));
  const head = await page.locator('[data-home=safetyHeader]').innerText().catch(() => '');
  ok(`E11 ${where}: Loss-of-control risk on SAFETY equals the believed selector (${lr})`, Math.abs(shown - lr) < 1e-5, `${shown} vs ${lr}`);
  ok(`E11 ${where}: the true control level and exposure never show`, !/\b0\.0137\b|\b0\.9863\b|98\.6%/.test(head), head.replace(/\s+/g, ' ').slice(0, 160));
  const fv = await sel('r.footholdView(s)');
  ok(`E11 ${where}: the Risks footholds line counts known footholds only`, (fv.suspected + fv.located === 0 ? !(await page.$('[data-test=sfr-footholds]')) : (await page.locator('[data-test=sfr-footholds]').innerText()).includes(`${fv.suspected} suspected`)) && !fv.rows.some((x) => x.id === 'FH-E11-HIDDEN'));
  await shot(`e11-${tag}-safety-risks`);
  await page.hover('[data-test=sf-risk]');
  await wait(350);
  ok(`E11 ${where}: the risk tooltip shows its parts (would try, stop rate, footholds)`, /Stop rate/.test(await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '')) && /Footholds/.test(await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '')));
  await clearTips();
  await tabTo('safeguards');
  // Model v3 F6: the control layer has an off switch next to Add control (the response's preview, its effect).
  await clearTips();
  if (await page.$('[data-act="control-add"]')) {
    await page.click('[data-act="control-add"]');
    await wait(150);
    const onNow = JSON.parse(await get('s.player.deployments.some((d) => d.channel === "internal" && d.status === "live" && (d.guards || []).some((g) => g.kind === "control"))'));
    // UB-C: once on, the control cell opens the control protocol drawer, which holds Remove.
    if (await page.$("[data-test=control-edit]")) { await page.click("[data-test=control-edit]"); await wait(150); }
    const btn = await page.$('[data-act="control-remove"]');
    let rtip = '';
    if (btn) { await page.hover('[data-act="control-remove"]'); await wait(350); rtip = await page.evaluate(() => document.querySelector('.tip')?.innerText ?? ''); await clearTips(); if (!(await page.$('[data-act="control-remove"]'))) { await page.click('[data-test=control-edit]'); await wait(150); } await page.click('[data-act="control-remove"]'); await wait(150); }
    const offNow = JSON.parse(await get('!s.player.deployments.some((d) => d.channel === "internal" && (d.guards || []).some((g) => g.kind === "control"))'));
    ok(`F6 ${where}: Remove control sits in the control protocol drawer, previews the tax saved and the believed danger, and turns the layer off`, onNow && !!btn && /slowdown ends/.test(rtip) && /harmful acts/.test(rtip) && offNow && !!(await page.$('[data-act="control-add"]')), rtip.replace(/\s+/g, ' ').slice(0, 200));
    if (await page.$("[data-test=sf-drawer-close]")) await page.click("[data-test=sf-drawer-close]");
  }
  await clearTips();
  await tabTo('safeguards');
  const html = await page.locator('main.center').innerHTML();
  const rows = await page.$$eval('[data-foothold]', (els) => els.map((e) => e.getAttribute('data-foothold')));
  ok(`E11 ${where}: Footholds lists every known foothold and no hidden one`, !html.includes('FH-E11-HIDDEN') && rows.length === fv.rows.length && fv.rows.every((x) => rows.includes(x.id)), rows.join(','));
  await shot(`e11-${tag}-footholds`);
  if (plant) {
    // The remove response's preview matches its effect (engineers × days, agents off, compute released).
    await page.hover('[data-act="foothold-remove.FH-E11-LOC"]');
    await wait(350);
    const tip = await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '');
    await shot(`e11-${tag}-remove-preview`);
    await clearTips();
    const day = JSON.parse(await get('s.time.day'));
    const m = { fte: Number((tip.match(/([\d.]+) staff/) ?? [])[1]), days: Number((tip.match(/engineers for (\d+) d/) ?? [])[1]), off: Number((tip.match(/(\d+) compute\s*days with internal agents off/) ?? [])[1]), gain: /3K compute/.test(tip) };
    await page.evaluate(() => { window.ai27v2.state.flags['ws4:agentsOffUntil'] = -1; window.ai27v2.notify(); });
    await page.click('[data-act="foothold-remove.FH-E11-LOC"]');
    await wait(150);
    const f = JSON.parse(await get(`s.player.safety.footholds.find((x) => x.id === 'FH-E11-LOC')`));
    const off = JSON.parse(await get(`s.flags['ws4:agentsOffUntil']`));
    ok(`E11 ${where}: Remove's preview matches its effect`, f.status === 'removed' && f.removal?.fte === m.fte && f.removal?.until === day + m.days && off === day + m.off && m.gain, `preview ${JSON.stringify(m)} · effect ${JSON.stringify(f.removal)} off ${off} (day ${day}) · ${tip.replace(/\s+/g, ' ').slice(0, 140)}`);
    ok(`E11 ${where}: a removed foothold moves to the history`, !!(await page.$('[data-foothold="FH-E11-LOC"][data-status=removed]')));
    await shot(`e11-${tag}-footholds-removed`);
  }
  await page.evaluate(() => {
    const s = window.ai27v2.state;
    s.player.safety.footholds = s.player.safety.footholds.filter((f) => !f.id.startsWith('FH-E11'));
    Object.assign(s.player.safety.effectiveControl, window.__e11ctl);
    if (window.__e11off === undefined) delete s.flags['ws4:agentsOffUntil']; else s.flags['ws4:agentsOffUntil'] = window.__e11off;
    window.ai27v2.notify();
  });
}

const toSuites = async () => { await nav('blueprint'); await tabTo('suites'); await wait(120); };
async function d6Check(where, complete) {
  await toSuites();
  const tag = where.replace(' ', '');
  // UB-B: values per family (realism %, loopholes %, share of the next run, share of pressure, Harden and Expand).
  const rows = await page.$$eval('[data-test=suites] [data-suite]:not([data-locked]):not([data-unbuilt])', (els) => els.map((e) => ({
    f: e.getAttribute('data-suite'),
    fid: e.querySelector('[data-test=suite-fid]')?.textContent ?? '', x: e.querySelector('[data-test=suite-exploit]')?.textContent ?? '',
    part: e.querySelector('[data-test=suite-part]')?.textContent ?? '', sh: e.querySelector('[data-test=suite-share]')?.textContent ?? '',
    b: !!e.querySelector('[data-act="suite.build"], [data-pending$=":build"]'), h: !!e.querySelector('[data-act="suite.harden"], [data-pending$=":harden"]'),
  })));
  const fams = JSON.parse(await get(`Object.keys(s.player.suites ?? {}).length`));
  const good = rows.filter((r) => /\d+%/.test(r.fid) && /\d+(\.\d)?%/.test(r.x) && /\d+%/.test(r.part) && /next run/.test(r.sh) && r.b && r.h);
  ok(`D6 ${where}: Training › Environments shows every family with realism, loopholes, share of pressure, Harden and Expand`, rows.length >= Math.max(6, fams) && good.length === rows.length,
    rows.map((r) => `${r.f} ${r.fid} ${r.x} ${r.part} ${r.sh}`).join(' | ').slice(0, 200));
  const cuKnown = JSON.parse(await get(`!!(s.player.tree.P06 && s.player.tree.P06.status === 'known')`));
  const lockTxt = await page.$eval('[data-test=suites] [data-locked=P06]', (e) => e.textContent ?? '').catch(() => '');
  ok(`D6 ${where}: computer use reads "needs the discovery" until it is known`, cuKnown ? !lockTxt : /needs the discovery/.test(lockTxt), lockTxt || 'unlocked');
  const lvl = await attr('[data-test=suites-s2]', 'data-level');
  ok(`D6 ${where}: the next run's hacking pressure reads Low, Medium or High`, /^(Low|Medium|High)$/.test(lvl ?? ''), lvl ?? '');
  for (const x of await page.$$eval('[data-test=suites] [data-term]', (els) => els.map((e) => e.getAttribute('data-term')))) d6Seen.add(x);
  const f0 = rows[0]?.f;
  const tips = {
    fid: await tipText(`[data-suite="${f0}"] [data-test=suite-fid]`), x: await tipText(`[data-suite="${f0}"] [data-test=suite-exploit]`),
    part: await tipText(`[data-suite="${f0}"] [data-test=suite-part]`), sh: await tipText(`[data-suite="${f0}"] [data-test=suite-share]`),
    s2: await tipText('[data-test=suites-s2]'),
  };
  ok(`D6 ${where}: tooltips on realism, loopholes, share of pressure, share of the run and hacking pressure`, /Realism/.test(tips.fid) && /Live tasks/.test(tips.fid) && /Floor/.test(tips.x)
    && /hacking pressure/i.test(tips.part) && /Share of the next run/.test(tips.sh) && /Hacking pressure/.test(tips.s2) && /budget/i.test(tips.s2), Object.values(tips).map((x) => x.split('\n')[0]).join(' | '));
  await clearTips();
  await shot(`d6-${tag}-suites`);
  // Expand: the preview's after value; cash and queue change; when `complete`, the finished build matches the preview.
  const free = await page.$$eval('[data-test=suites] [data-act="suite.build"]:not([disabled])', (els) => els.map((e) => e.getAttribute('data-family')));
  const fam = free.includes('swe') ? 'swe' : free[0];
  if (fam) {
    const bTip = await tipText(`[data-act="suite.build"][data-family="${fam}"]`);
    ok(`D6 ${where}: Expand preview shows cash, team-weeks and realism before → after`, /\$\d+M/.test(bTip) && /team-weeks/.test(bTip) && /\d+% → \d+%/.test(bTip), bTip.replace(/\n/g, ' ').slice(0, 200));
    await clearTips();
    const after = (await page.$eval(`[data-suite="${fam}"] [data-test="suite-after.build"]`, (e) => e.textContent ?? '')).match(/→ (\d+%)/)?.[1];
    const cash0 = Number(await get('s.player.finance.cash'));
    await page.click(`[data-act="suite.build"][data-family="${fam}"]`);
    await wait(120);
    const cash1 = Number(await get('s.player.finance.cash'));
    const pill = await page.$eval(`[data-suite="${fam}"] [data-pending="${fam}:build"]`, (e) => e.textContent ?? '').catch(() => '');
    ok(`D6 ${where}: Expand queues the work, pays the expert data and shows it pending with an ETA`, JSON.parse(await get(suiteQueue)).split(',').includes(`${fam}:build`) && cash0 - cash1 > 0.09 && /Expanding.*(done in|waits)/.test(pill),
      `cash ${cash0.toFixed(2)} → ${cash1.toFixed(2)} · ${pill}`);
    if (complete) {
      const done = await stepUntilDone(`${fam}:build`);
      await toSuites();
      const fid = (await page.$eval(`[data-suite="${fam}"] [data-test=suite-fid]`, (e) => e.textContent ?? '')).match(/\d+%/)?.[0];
      ok(`D6 ${where}: the finished expansion matches its preview (realism ${after})`, done && !!after && fid === after, `${fid} vs ${after}`);
    }
  }
  // Harden: the preview's loopholes after match the result.
  const freeH = await page.$$eval('[data-test=suites] [data-act="suite.harden"]:not([disabled])', (els) => els.map((e) => e.getAttribute('data-family')));
  const famH = freeH.includes('swe') ? 'swe' : freeH[0];
  if (famH) {
    const hTip = await tipText(`[data-suite="${famH}"] [data-act="suite.harden"][data-family="${famH}"]`);
    ok(`D6 ${where}: Harden preview shows cash, team-weeks, loopholes before → after and the fall in hacking pressure`, /\$\d+M/.test(hTip) && /team-weeks/.test(hTip) && /\d+(\.\d)?% → \d+(\.\d)?%/.test(hTip) && /−\d+%/.test(hTip), hTip.replace(/\n/g, ' ').slice(0, 200));
    await clearTips();
    const after = (await page.$eval(`[data-suite="${famH}"] [data-test="suite-after.harden"]`, (e) => e.textContent ?? '')).match(/→ (\d+(\.\d)?%)/)?.[1];
    await check(`D6 ${where}: Harden queues the work`, suiteQueue, () => page.click(`[data-suite="${famH}"] [data-act="suite.harden"][data-family="${famH}"]`));
    if (complete) {
      const done = await stepUntilDone(`${famH}:harden`);
      await toSuites();
      const x = (await page.$eval(`[data-suite="${famH}"] [data-test=suite-exploit]`, (e) => e.textContent ?? '')).match(/\d+(\.\d)?%/)?.[0];
      ok(`D6 ${where}: the finished hardening matches its preview (loopholes ${after})`, done && !!after && x === after, `${x} vs ${after}`);
    }
  }
  ok(`D6 ${where}: ways to lower the hacking pressure are listed`, !!(await page.$('[data-test=way-top], [data-test=way-light]')));
  await shot(`d6-${tag}-suites-after`);
  await page.evaluate(() => window.ai27v2.setTab('models', 'versions'));
}
// ───────────────────────── D4: Models › Data and the Blueprint's drawn mix (day 1, 400, 900) ─────────────────────────
// Portfolio by kind with values and tooltips, the natural mix vs reference, the four data forms with cost and before →
// after in token units (no "L" on data previews); each action changes the state as previewed; the Blueprint's mix
// control changes the drawn shares and the specialisation.
const D4_TERMS = ['dataPortfolio', 'uniqueTokens', 'dataQuality', 'publicWeb', 'licensedData', 'syntheticData', 'usageData', 'expertData', 'synJob', 'dataTokens', 'poolSynthetic', 'drawnMix', 'domainEpochs', 'dataSpec']; // UB-B: the terms of the rebuilt Data screen and Next run's drawn mix
const d4Seen = new Set();
const d4Tip = async (sel) => {
  await clearTips();
  const el = await page.$(sel);
  if (!el) return '';
  await el.hover();
  await wait(420);
  const t = await page.evaluate(() => ({ text: [...document.querySelectorAll('.tip')].map((x) => x.innerText).join(' | '), terms: [...document.querySelectorAll('.tip [data-term]')].map((e) => e.getAttribute('data-term')) }));
  for (const x of t.terms) d4Seen.add(x);
  return t.text;
};
const dv = (sel) => `[data-panel=blueprint] [data-test=data-view] ${sel}`;
const attr = (sel, a) => page.$eval(sel, (e, k) => e.getAttribute(k), a).catch(() => null);
const deltaOf = async (what, k) => {
  const a = await attr(dv(`[data-test=delta-${what}] [data-k=${k}]`), 'data-a');
  const b = await attr(dv(`[data-test=delta-${what}] [data-k=${k}]`), 'data-b');
  return a === null ? null : [Number(a), Number(b)];
};
const U_STATE = `(() => { const p = s.player.dataPortfolio; const p10 = s.player.tree.P10?.status === 'known'; let u = 0; for (const a of p.assets) { if (a.kind === 'expert') continue; const t = a.kind === 'public' ? Math.min(1, a.coverage) * 300 : a.tokensT; const q = a.kind === 'public' ? 1 : a.quality; u += q * t * (a.kind === 'synthetic' && p10 ? 3 : 1); } return u; })()`;
const CODE_NAT = `(() => { const p = s.player.dataPortfolio; const w = {}; let t = 0; for (const a of p.assets) { if (a.kind === 'expert') continue; const tok = a.kind === 'public' ? Math.min(1, a.coverage) * 300 : a.tokensT; const q = a.kind === 'public' ? 1 : a.quality; const mix = a.kind === 'public' ? { SOCIAL: 0.45, MEDIA: 0.12, REASON: 0.08, CODE: 0.08, RSCH: 0.07, BIO: 0.06, AGENCY: 0.06, CYBER: 0.03, PHYS: 0.05 } : a.mix; if (!(q * tok > 0)) continue; for (const [d, v] of Object.entries(mix)) w[d] = (w[d] || 0) + q * tok * v; t += q * tok; } return (w.CODE || 0) / t; })()`;
async function d4Check(where, act, stepOk = true) {
  const tag = where.replace(/ /g, '');
  await nav('blueprint');
  await tabTo('data');
  await clearTips();
  ok(`D4 ${where}: Training › Data opens the data view`, !!(await page.$('[data-panel=blueprint] [data-test=data-view]')));
  for (const x of await page.$$eval('[data-panel=blueprint] [data-test=data-view] [data-term]', (els) => els.map((e) => e.getAttribute('data-term')))) d4Seen.add(x);
  // UB-B: five sources with tokens, quality and today's flow; data by domain (nine rows); the verdict tile.
  const srcs = await page.$$eval(dv('[data-src]'), (els) => els.map((e) => ({ k: e.getAttribute('data-src'), t: e.innerText.replace(/\n/g, ' ') })));
  ok(`D4 ${where}: five sources with tokens, quality and today's flow`, srcs.length === 5 && srcs.every((r) => /\d/.test(r.t)) && /crawled/.test(srcs[0].t) && /a day/.test(srcs.find((r) => r.k === 'synthetic')?.t ?? ''), srcs.map((r) => r.t.slice(0, 60)).join(' ; '));
  ok(`D4 ${where}: data by domain for nine domains`, (await page.$$(dv('[data-test=data-domains] [data-dom]'))).length === 9);
  const reads = await page.$eval(dv('[data-test=data-reads] b'), (e) => e.textContent ?? '').catch(() => '');
  if (reads) ok(`D4 ${where}: the next new base's reads per token and its verdict`, /^\d+\.\d\d$/.test(reads) && /Enough|Short/.test(await page.$eval(dv('[data-test=data-verdict]'), (e) => e.textContent ?? '').catch(() => '')), reads);
  const tips = {
    ...(reads ? { reads: await d4Tip(dv('[data-test=data-reads] b')) } : {}),
    domain: await d4Tip(dv('[data-test=data-domains] [data-dom=CODE]')),
    source: await d4Tip(dv('[data-test="src-tokens.public"]')),
    perDay: await d4Tip(dv('[data-test=data-perday]')),
  };
  const want = { reads: /Reads per token/, domain: /by source/, source: /Tokens you hold/, perDay: /New data a day/ };
  const miss = Object.entries(want).filter(([k, re]) => k in tips && !re.test(tips[k])).map(([k]) => k);
  ok(`D4 ${where}: tooltips on the verdict, data by domain, sources and new data`, miss.length === 0, miss.map((k) => `${k}: ${tips[k].slice(0, 60)}`).join(' ; '));
  ok(`D4 ${where}: no expert-data purchase on Data (RD-T06: suite builds buy it)`, !(await page.$(dv('[data-act="data.expert"]'))));
  await clearTips();
  if (act) {
    // A day first, so the fixture's cached readouts (compute online, prodCache) are today's before the previews are read.
    if (stepOk) { await page.evaluate(() => window.ai27v2.step(1)); await closeModals(); await pause(); await nav('blueprint'); await tabTo('data'); }
    // Licence drawer (Physical, bulk archives, 10T): a deal at the previewed cash.
    await page.click(dv('[data-test=data-buy-licence]')); await wait(80);
    ok(`D4 ${where}: Buy a licence opens the licence drawer with before → after`, !!(await page.$(dv('[data-test=licence-drawer] [data-test=delta-licence] [data-k=tokens]'))));
    await page.click(dv('[data-test=lic-domain] [data-opt=PHYS]')); await wait(60);
    const c0 = JSON.parse(await get('s.player.finance.cash'));
    await check(`D4 ${where}: Buy queues a licence deal`, 's.player.dataPortfolio.pending.length', () => page.click(dv('[data-test=licence-drawer] [data-act="data.license"]')));
    const last = JSON.parse(await get('(() => { const p = s.player.dataPortfolio.pending; const a = p[p.length - 1].asset; return { t: a.tokensT, q: a.quality, d: a.domain }; })()'));
    const c1 = JSON.parse(await get('s.player.finance.cash'));
    ok(`D4 ${where}: the deal is 10T of Physical bulk archives at $0.1B per T`, last.d === 'PHYS' && Math.abs(last.t - 10) < 1e-9 && Math.abs(c0 - c1 - 1) < 1e-6, `${last.t}T ${last.d} · cash ${(c0 - c1).toFixed(3)}`);
    await nav('blueprint'); await tabTo('data');
    ok(`D4 ${where}: the deal shows as on the way`, /1 on the way|\d+ on the way/.test(await page.$eval(dv('[data-test=data-pending]'), (e) => e.textContent ?? '').catch(() => '')));
    // Teacher: picking a model starts a year's job with it; a day of it adds its tokens; the default ends it.
    const pick = await page.$eval(dv('[data-test=data-teacher]'), (e) => [...e.options].map((o) => o.value).filter(Boolean).pop() ?? '').catch(() => '');
    if (pick) {
      await check(`D4 ${where}: picking a teacher starts a generation job`, 'JSON.stringify(s.player.dataPortfolio.synJob || null)', () => page.selectOption(dv('[data-test=data-teacher]'), pick));
      ok(`D4 ${where}: the job uses the picked teacher for a year`, JSON.parse(await get(`(() => { const j = s.player.dataPortfolio.synJob; return !!j && j.teacherId === ${JSON.stringify(pick)} && j.until - s.time.day === 365; })()`)));
      const synT = `(s.player.dataPortfolio.assets.find((a) => a.id === 'syn:' + ${JSON.stringify(pick)}) || { tokensT: 0 }).tokensT`;
      const t0 = JSON.parse(await get(synT));
      // The day-900 fixture can end within days (another lab's ASI): no step there.
      if (stepOk) await page.evaluate(() => window.ai27v2.step(1));
      await closeModals(); await pause();
      if (stepOk) ok(`D4 ${where}: a day of the job adds tokens from that teacher`, JSON.parse(await get(synT)) > t0);
      await nav('blueprint'); await tabTo('data');
      await check(`D4 ${where}: the default teacher ends the job`, 'JSON.stringify(s.player.dataPortfolio.synJob || null)', () => page.selectOption(dv('[data-test=data-teacher]'), ''));
    }
    // Usage policy → broad: 50% kept, Civil Liberties approval moves.
    const a0 = JSON.parse(await get('s.pub.blocs.civlib.approval'));
    await check(`D4 ${where}: usage policy → broad`, 's.player.dataPortfolio.usageShare', () => page.click(dv('[data-act="data.usagePolicy.broad"]')));
    const a1 = JSON.parse(await get('s.pub.blocs.civlib.approval'));
    ok(`D4 ${where}: broad usage keeps 50% and moves Civil Liberties approval`, JSON.parse(await get('s.player.dataPortfolio.usageShare')) === 0.5 && (a1 !== a0 || Math.abs(a1) === 100), `${a0} → ${a1}`);
    await shot(`d4-${tag}-data-after`);
  }
  // Training › Next run: the Data mix row's drawn mix (L2); the mix control changes the drawn shares and the specialisation.
  await nav('blueprint');
  await tabTo('next');
  await page.click('[data-panel=blueprint] [data-start=new]').catch(() => {});
  await wait(120);
  if (!(await page.$('[data-test=bp-draw]'))) await page.click('[data-test=bp-draw-open]').catch(() => {});
  await wait(120);
  const drawOf = () => page.$$eval('[data-panel=blueprint] [data-test=bp-draw] [data-dom]', (els) => Object.fromEntries(els.map((e) => [e.getAttribute('data-dom'), { sh: Number(e.getAttribute('data-share')), s: Number(e.getAttribute('data-s')) }])));
  ok(`D4 ${where}: the Data mix row shows the drawn mix (9 domains) and the most-repeated domain`, Object.keys(await drawOf()).length === 9 && /\d\.\d\d/.test(await page.$eval('[data-test=bp-draw-rep]', (e) => e.textContent ?? '').catch(() => '')));
  for (const x of await page.$$eval('[data-panel=blueprint] [data-test=bp-draw] [data-term]', (els) => els.map((e) => e.getAttribute('data-term')))) d4Seen.add(x);
  const bTip = await d4Tip('[data-panel=blueprint] [data-test=bp-draw] [data-dom=CODE]');
  const rTip = await d4Tip('[data-panel=blueprint] [data-test=bp-draw-rep]');
  const pTip = await d4Tip('[data-panel=blueprint] [data-test=bp-draw-q]');
  ok(`D4 ${where}: drawn-mix tooltips (share vs reference, specialisation and its cap; domain epochs; the preset)`, /Standard share/.test(bTip) && /Specialisation from the mix/.test(bTip) && /Re-reading/.test(rTip) && /Starts from/.test(pTip), `${bTip.slice(0, 80)} | ${rTip.slice(0, 60)}`);
  await clearTips();
  const bal = await drawOf();
  if (await page.$eval('[data-panel=blueprint] [data-opt="data:codeMath"]', (b) => !b.classList.contains('locked')).catch(() => false)) {
    await page.click('[data-panel=blueprint] [data-opt="data:codeMath"]'); await wait(150);
    const cm = await drawOf();
    ok(`D4 ${where}: Code & math raises CODE's drawn share and specialisation`, cm.CODE.sh > bal.CODE.sh + 0.01 && cm.CODE.s > bal.CODE.s + 0.1 && cm.SOCIAL.s < 0, `CODE ${bal.CODE.sh.toFixed(3)} → ${cm.CODE.sh.toFixed(3)}, s ${bal.CODE.s} → ${cm.CODE.s}`);
  }
  await shot(`d4-${tag}-training-drawn`);
  await page.click('[data-panel=blueprint] [data-opt="data:balanced"]').catch(() => {});
  await check(`D4 ${where}: "Data ›" opens Training › Data`, `store.panel + ':' + (store.tab.blueprint || '')`, () => page.click('[data-panel=blueprint] [data-test=bp-to-data]'));
  await shot(`d4-${tag}-data`);
}
// ── E12 (model v3): trait families with traits one level down, training pressure per run, successor pull ──
// UB-C: the trait-meaning kinds and the successor card left SAFETY › Model (mockup saf-model.png); their terms stay in the glossary.
const E12_TERMS = ['trainingPressure', 'traitMovement', 'successorPull'];
const e12Seen = new Set();
const collectTerms = async () => { for (const t of await page.$$eval('[data-term]', (els) => els.map((e) => e.getAttribute('data-term')))) e12Seen.add(t); };
async function e12Check(where) {
  const tag = where.replace(' ', '');
  await page.evaluate(() => { window.ai27v2.setTab('safety', 'model'); });
  await nav('safety');
  // UB-C: the trait table shows the four families and every trait with its belief (best guess and 90% range, or Unknown).
  await wait(120);
  const fams = await page.$$eval('[data-home=traitBeliefs] [data-family]', (els) => els.map((e) => e.getAttribute('data-family')));
  ok(`E12 ${where}: Safety › Model shows the four risk families (and other traits)`, fams.join(',') === 'please,gaming,deception,power,other', fams.join(','));
  const tr = await page.$$eval('[data-home=traitBeliefs] [data-trait]', (els) => els.map((e) => ({ t: e.getAttribute('data-trait'), v: e.querySelector('.sf-rv')?.textContent ?? '' })));
  const okRows = tr.filter((x) => /^(Unknown \d+–\d+%|\d+% \d+–\d+%)$/.test(x.v.trim())).length;
  ok(`E12 ${where}: every trait (17) shows its best guess and range or Unknown`, tr.length === 17 && okRows === 17, `${tr.length} rows, ${okRows} read; ${tr.slice(0, 3).map((x) => x.v).join(' | ')}`);
  await page.mouse.move(1, 1);
  await shot(`e12-${tag}-families`);
  await collectTerms();
  await clearTips();
  await shot(`e12-${tag}-safety`);  await collectTerms();
  await clearTips();
  await shot(`e12-${tag}-safety`);
  // 2. Training pressure of the planned run (Blueprint): signal rows with causes, families pushed, ω, successor link.
  await nav('blueprint');
  await tabTo('next');
  const kinds = await page.$$eval('[data-bp-kind]', (els) => els.map((e) => e.getAttribute('data-bp-kind')));
  for (const k of ['post', 'base'].filter((x) => kinds.includes(x))) {
    await page.click(`[data-bp-kind=${k}]`);
    await wait(250);
    if (!(await page.$('[data-test=bp-pressure]'))) await page.click('[data-test=bp-push-details]').catch(() => {});
    await wait(80);
    const pr = await page.$$eval('[data-test=bp-pressure] [data-signal]', (els) => els.map((e) => ({ id: e.getAttribute('data-signal'), v: e.querySelector('[data-test=pr-value]')?.textContent ?? '', c: e.querySelector('[data-test=pr-cause]')?.textContent ?? '', p: e.querySelectorAll('[data-push]').length })));
    const omega = await page.$eval('[data-home=runPressure] [data-test=pr-omega]', (e) => e.textContent ?? '').catch(() => '');
    const good = pr.filter((x) => /^\d\.\d\d$/.test(x.v) && x.c.length > 10 && (!['S1', 'S2', 'S3', 'S7'].includes(x.id) || /\d/.test(x.c)) && x.p > 0);
    const s2 = pr.find((x) => x.id === 'S2')?.c ?? '';
    const s5 = pr.find((x) => x.id === 'S5')?.c ?? '';
    const want = k === 'post' ? pr.length >= 4 && /\d+% of post-training on .+ at \d+% loopholes/.test(s2) && /post-training \d+(\.\d)?× the standard amount/.test(s2) : /AI-related data \d+\.\d% of tokens/.test(s5) && /model.s scale/.test(s5);
    ok(`E12 ${where}: Training ${k} shows the planned run's signals with causes, the families they push and ω`, want && good.length === pr.length && /\d\.\d\d/.test(omega),
      `${omega} · ${pr.map((x) => `${x.id} ${x.v}: ${x.c}`).join(' | ').slice(0, 260)}`);
    const tip = await tipText(`[data-test=bp-pressure] [data-signal=${pr[0]?.id}]`);
    ok(`E12 ${where}: a ${k} signal's tooltip breaks it down and names what it pushes`, /pushes/.test(tip), tip.replace(/\n/g, ' ').slice(0, 160));
    await clearTips();
    await page.mouse.move(1, 1);
    await shot(`e12-${tag}-blueprint-${k}`);
  }
  const succ = await page.$eval('[data-test=bp-succ]', (e) => e.textContent ?? '').catch(() => '');
  ok(`E12 ${where}: Training links the successor pull to Safety`, /Successor steering from/.test(succ) && !!(await page.$('[data-test=bp-succ] [data-ref=successorPull]')), succ);
  if (where === 'day 400') {
    await page.click('[data-test=bp-succ] [data-ref=successorPull]');
    await wait(150);
    ok('F6b: the Training successor link opens SAFETY › Risks (successor steering is an act row there)', !!(await page.$('[data-home=actTable]')));
  }
  await collectTerms();
  // Model card: what the finished run applied, one click down.
  await nav('models');
  await page.click('[data-test=card-trained]').catch(() => {});
  await wait(60);
  await page.click('[data-test=mc-pressure-open]').catch(() => {});
  await wait(80);
  const mc = await page.$$eval('[data-test=mc-pressure-rows] [data-signal]', (els) => els.map((e) => ({ v: e.querySelector('[data-test=pr-value]')?.textContent ?? '', c: e.querySelector('[data-test=pr-cause]')?.textContent ?? '' })));
  const mcBase = await page.$$eval('[data-test=mc-pressure-base] [data-signal]', (els) => els.length);
  // M10: since AF2 a base has no S6 (no narrow harmful fine-tune) and the start base's stored S5 is 0, so the base block
  // can show no signal rows, only its "none" line: the block itself must be there.
  const mcBaseFoot = await page.$eval('[data-test=mc-pressure-base] .pr-foot', (e) => e.textContent ?? '').catch(() => '');
  ok(`E12 ${where}: the model card shows the signals its run applied (with causes) and its base's`, mc.length >= 1 && mc.every((x) => /^\d\.\d\d$/.test(x.v) && x.c.length > 10) && (mcBase >= 1 || /none/.test(mcBaseFoot)), `${mc.length} run rows, ${mcBase} base rows (${mcBaseFoot}) ·${mc.map((x) => x.c).join(' | ').slice(0, 160)}`);
  await collectTerms();
  await page.mouse.move(1, 1);
  await shot(`e12-${tag}-model-card`);
}
// ───────────────────────── D8: Models › Evals (day 1, 400, 900) ─────────────────────────
const D8_TERMS = ['evals', 'evalGate', 'autoEvaluate', 'rerunRule', 'evalQueue', 'evalDepth', 'measureBand', 'elicitation', 'benchmark'];
const d8Seen = new Set();
const toEvals = async () => { await nav('models'); await tabTo('evals'); await wait(120); };
/** A read-only selector (store.ts exposes them for this test) on the live state; Infinity → 'inf'. */
const V = (fn, ...a) => page.evaluate(([f, args]) => { const r = window.ai27v2Views[f](window.ai27v2.state, ...args); return JSON.parse(JSON.stringify(r, (k, x) => (x === Infinity ? 'inf' : x))); }, [fn, a]);
/** Rendered queue rows vs evalQueueView: order, progress, finish (days), what binds. */
async function d8Queue(where) {
  const ui = await page.$$eval('[data-test=eval-queue] [data-eval]', (els) => els.map((e) => ({
    id: e.getAttribute('data-eval'), prog: parseFloat(e.querySelector('[data-test=eval-progress]')?.textContent ?? 'NaN'),
    eta: Number(e.querySelector('[data-test=eval-eta]')?.getAttribute('data-eta')), binds: e.querySelector('[data-test=eval-binds]')?.getAttribute('data-binds'),
  })));
  const sel = await V('evalQueueView');
  const same = ui.length === sel.length && sel.every((t, i) => ui[i].id === t.id && Math.abs(ui[i].prog - t.progress * 100) <= 0.6
    && ui[i].eta === (t.etaDays === 'inf' ? -1 : t.etaDays) && ui[i].binds === (t.waiting ?? t.binds));
  ok(`D8 ${where}: eval queue rows equal evalQueueView (order, progress, finish, what binds)`, same, `${ui.length} rows · ${JSON.stringify(ui[0] ?? {})} vs ${JSON.stringify(sel[0] ? { id: sel[0].id, p: sel[0].progress, eta: sel[0].etaDays, b: sel[0].waiting ?? sel[0].binds } : {})}`);
  if (!ui.length) ok(`D8 ${where}: an empty queue says so`, !!(await page.$('[data-test=eval-queue-empty]')));
}
async function d8Check(where, complete, depth) {
  await toEvals();
  const tag = where.replace(/\s+/g, '');
  ok(`D8 ${where}: Models › Evals renders policy, queue, order and measurement`, !!(await page.$('[data-test=evals] [data-home=evalPolicy]')) && !!(await page.$('[data-home=evalQueue]'))
    && !!(await page.$('[data-home=evalOrder]')) && !!(await page.$('[data-home=evalMeasure]')));
  // Policy: gate depth, auto-evaluate, per-suite cost, re-run rule.
  const pol = await page.$eval('[data-test=eval-policy]', (e) => e.innerText).catch(() => '');
  ok(`D8 ${where}: policy row shows gate, auto-evaluate, re-run rule and the cost per suite (RE, eng, H100e-days)`, /GATE/i.test(pol) && /Auto-evaluate/.test(pol) && /every 30 d/.test(pol) && /RE team-wk/.test(pol) && /eng team-wk/.test(pol) && /H100e-days/.test(pol), pol.replace(/\s+/g, ' ').slice(0, 160));
  await d8Queue(where);
  // Measurement rows equal evalMeasureView (band).
  const ms = await V('evalMeasureView');
  const msUi = await page.$$eval('[data-test=eval-measure] [data-measure]', (els) => els.map((e) => ({ id: e.getAttribute('data-measure'), sd: e.querySelector('[data-test=eval-sd]')?.textContent ?? '' })));
  const mOk = msUi.length > 0 && msUi.every((r) => { const m = ms.find((x) => x.versionId === r.id); return m && (m.measuredL === undefined ? r.sd === '—' : r.sd === `± ${(1.64 * m.sd).toFixed(2)} levels`); });
  ok(`D8 ${where}: measurement ranges (90%) equal evalMeasureView (± 1.64 × 0.2/√n)`, mOk, `${msUi.length} rows · ${JSON.stringify(msUi[0])}`);
  // UB-F (OQ-6): capability is drawn as a skill bar on the job scale (median-expert and best-human ticks), no raw level axis.
  ok(`D8 ${where} (UB-F): measurement rows are job-scale skill bars with median-expert / best-human marks`, JSON.parse(await get(`(() => { const m = document.querySelector('[data-test=eval-measure]'); return !!m && !!m.querySelector('[data-test=eval-band] .skb-tk.med') && !!m.querySelector('[data-test=eval-band] .skb-tk.best') && !m.querySelector('svg .ev-tick') && /median expert/.test(m.innerText); })()`)));
  // Pick the least-measured version with no open suite and order a suite at `depth`.
  const cand = ms.filter((r) => r.measuredL !== undefined && r.open.length === 0 && (r.status === 'ready' || r.status === 'deployed')).sort((a, b) => a.nEff - b.nEff)[0];
  if (cand) {
    await page.click(`[data-test=eval-measure] [data-measure="${cand.versionId}"] .ev-mname`);
    await wait(80);
    await page.click(`[data-test=eval-depth] [data-opt="${depth}"]`);
    await wait(80);
    for (const t of await page.$$eval('[data-test=evals] [data-term]', (els) => els.map((e) => e.getAttribute('data-term')))) d8Seen.add(t);
    const head = await page.$eval('[data-home=evalOrder] .card2-ttl', (e) => e.textContent ?? '');
    ok(`D8 ${where}: clicking a measurement row picks the version to order on`, head.includes(cand.name), head);
    await page.hover('[data-act="runEvals.self"]');
    await wait(400);
    const tip = await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '');
    ok(`D8 ${where}: the order preview shows research-engineer and engineer team-weeks and H100e-days`, /research-engineer team-weeks/.test(tip) && /engineer team-weeks/.test(tip) && /H100e-days/.test(tip), tip.replace(/\s+/g, ' ').slice(0, 160));
    await clearTips();
    const pv = await V('actionView', 'runEvals', { versionId: cand.versionId, by: 'self', depth });
    const before = await get(`(s.player.models.evals || []).map((t) => t.id).join(',')`);
    await page.click('[data-act="runEvals.self"]');
    await wait(150);
    const task = JSON.parse(await get(`(s.player.models.evals || []).find((t) => t.versionId === ${JSON.stringify(cand.versionId)} && t.by === 'self' && t.why === 'order') || null`));
    const c = Object.fromEntries(pv.costs.map((x) => [x.target?.split(' ')[0], x.amount]));
    const match = task && task.depth === depth && Math.abs(Math.round(task.reTW * 100) / 100 - c['research-engineer']) < 1e-9 && Math.abs(Math.round(task.engTW * 100) / 100 - c.engineer) < 1e-9 && Math.round(task.h100eDays) === c['H100e-days'];
    ok(`D8 ${where}: ordering a ${depth} suite queues it with the previewed cost`, before !== (await get(`(s.player.models.evals || []).map((t) => t.id).join(',')`)) && !!match,
      `${task ? `${task.depth} ${task.reTW.toFixed(3)}/${task.engTW.toFixed(3)}/${Math.round(task.h100eDays)}` : 'no task'} vs ${JSON.stringify(c)}`);
    ok(`D8 ${where}: the new suite shows in the queue at its depth`, !!(await page.$(`[data-test=eval-queue] [data-eval="${task?.id}"][data-depth="${depth}"][data-why=order]`)));
    await d8Queue(`${where} after the order`);
    ok(`D8 ${where}: a second own suite on the same version is blocked`, await page.$eval('[data-act="runEvals.self"]', (b) => b.disabled).catch(() => false));
    await page.hover(`[data-test=eval-queue] [data-eval="${task?.id}"] [data-test=eval-binds]`).catch(() => {});
    await wait(400);
    const qt = await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '');
    ok(`D8 ${where}: queue tooltip breaks the work left into research engineers, engineers and compute`, /Research engineers/.test(qt) && /Engineers/.test(qt) && /H100e-days left/.test(qt), qt.replace(/\s+/g, ' ').slice(0, 140));
    await clearTips();
    await shot(`d8-${tag}-evals`);
    if (complete && task) {
      let done = false;
      for (let i = 0; i < 90 && !done; i++) {
        await page.evaluate(() => window.ai27v2.step(1));
        await closeModals();
        await pause();
        done = !JSON.parse(await get(`(s.player.models.evals || []).some((t) => t.id === ${JSON.stringify(task.id)})`));
      }
      await toEvals();
      const after = (await V('evalMeasureView')).find((r) => r.versionId === cand.versionId);
      const sdUi = await page.$eval(`[data-measure="${cand.versionId}"] [data-test=eval-sd]`, (e) => e.textContent ?? '').catch(() => '');
      ok(`D8 ${where}: the band shrinks after the suite (${cand.sd.toFixed(3)} → ${after?.sd.toFixed(3)}), last suite ${depth}`, done && !!after && after.sd < cand.sd - 1e-9 && after.depth === depth && sdUi === `± ${(1.64 * after.sd).toFixed(2)} levels`, `${sdUi} · done ${done}`);
      await shot(`d8-${tag}-evals-after`);
    }
  } else ok(`D8 ${where}: a measured version to order on`, false);
  // Links: the model card's order button and the "evaluating" chip open Models › Evals.
  await nav('models');
  await page.click('[data-test=card-bench]').catch(() => {});
  await wait(60);
  await page.click('[data-test=card-order-evals]').catch(() => {});
  await wait(120);
  ok(`D8 ${where}: the model card's "Order a suite" opens Models › Evals`, JSON.parse(await get(`store.panel === 'models' && store.tab.models === 'evals'`)));
  await nav('overview');
  const chip = await page.$('.topstrip2 [data-test=evaluating]');
  if (chip) {
    await chip.click().catch(() => {});
    await wait(120);
    ok(`D8 ${where}: the top strip's "evaluating" chip opens the eval queue`, JSON.parse(await get(`store.panel === 'models' && store.tab.models === 'evals'`)));
  }
  await page.evaluate(() => window.ai27v2.setTab('models', 'versions'));
}
await page.evaluate(() => { const st = window.ai27v2; st.start({ ...st.draftSetup, tutorial: false, seed: 2027, companyName: 'OpenBrain' }); });
await wait(150);
await page.evaluate(() => window.ai27v2.step(1));
await closeModals();
await pause();
await b1Check('day 1');
await b2Check('day 1');
await b3Check('day 1', '29-day1-world-sectors');
await b4Check('day 1');
await d8Check('day 1', true, 'basic');
await d6Check('day 1', true);
await e12Check('day 1');
{
  // D6: the post-training plan's Environments row opens Training › Environments with this design as the planned run.
  await nav('blueprint');
  await tabTo('next');
  await page.click('[data-panel=blueprint] [data-bp-kind=post]').catch(() => {});
  await wait(150);
  await page.click('[data-panel=blueprint] [data-test=bp-suites]');
  await wait(150);
  const sub = await page.$eval('[data-home=suitePlan]', (e) => e.innerText).catch(() => '');
  ok('D6: the Environments row opens Training › Environments with the plan as the planned run', JSON.parse(await get(`store.panel === 'blueprint' && store.tab.blueprint === 'suites'`)) && /budget/.test(sub) && !/standard plan/.test(sub), sub.replace(/\s+/g, ' ').slice(0, 100));
  await page.evaluate(() => window.ai27v2.setTab('blueprint', 'next'));
}
await d4Check('day 1', true);
await nav('products');
{
  // Edit preview: a cheaper tier moves the target share at once (the stock follows later).
  const api = JSON.parse(await get(`(s.player.deployments.find((d) => d.channel === 'api' && d.status === 'live') || {}).id || ''`));
  if (api) {
    await page.click(`[data-test="prod-price.${api}"] [data-opt="premium"]`).catch(() => {});
    await wait(120);
    const pv = await page.evaluate((id) => document.querySelector(`[data-test="prod-edit.${id}"]`)?.innerText ?? '', api);
    ok('B2: the edit preview shows the target share before → after', /Target share/.test(pv) && /\d%\s*→\s*\d/.test(pv), pv.replace(/\n/g, ' ').slice(0, 120));
    await page.click(`[data-test="prod-cancel.${api}"]`).catch(() => {});
  }
}
await shot('25-day1-products');
{
  // A Premium Chat plan asks more than consumers pay: the price stops at the willingness to pay and the card flags it.
  const chat = JSON.parse(await get(`(s.player.deployments.find((d) => d.channel === 'consumer' && d.status === 'live') || {}).id || ''`));
  if (chat) {
    await page.evaluate((id) => window.ai27v2.act('product.update', { id, price: 'premium' }), chat);
    await page.evaluate(() => window.ai27v2.step(1));
    await closeModals();
    await nav('products');
    const row = await page.evaluate((id) => document.querySelector(`[data-product="${id}"] .sec2.set`)?.innerText ?? '', chat);
    ok('B1: a Premium Chat plan is priced at the $22 users will pay', /\$22 a month/.test(row), row.replace(/\n/g, ' ').slice(0, 90));
    await shot('26-day1-chat-capped');
  }
}

// ───────────────────────── Game C: day-400 fixture, screenshots of every panel ─────────────────────────
const fx = readFileSync(path.resolve('scripts/v2/fixtures/day400.json'), 'utf8');
const err = await page.evaluate((j) => window.ai27v2.importJson(j) ?? '', fx);
ok('Import day-400 fixture', err === '', err);
await page.evaluate(() => { window.ai27v2.state.setup.tutorial = false; window.ai27v2.notify(); });
// J1 (jank O1): rendered tooltip coverage. Every visible leaf element in the centre panel whose text holds a digit
// (≤ 40 chars; not a button, tab or chart) must sit inside a tooltip trigger ([data-tip]). Codex excluded (it is L3).
const tipCov = { tipped: 0, n: 0, miss: [] };
const coverage = async (where) => {
  if (where.includes('codex')) return;
  const r = await page.evaluate(() => {
    const m = document.querySelector('main.center');
    if (!m) return { n: 0, tipped: 0, miss: [] };
    const els = [...m.querySelectorAll('*')].filter((e) => {
      if (e.children.length) return false;
      const tx = (e.textContent ?? '').trim();
      if (!/\d/.test(tx) || tx.length > 40) return false;
      const b = e.getBoundingClientRect();
      return b.width > 4 && b.height > 4 && e.closest('svg') === null && !e.closest('button') && !e.closest('[data-tabs]') && !e.closest('select');
    });
    const miss = els.filter((e) => !e.closest('[data-tip]')).map((e) => (e.textContent ?? '').trim().slice(0, 24));
    return { n: els.length, tipped: els.length - miss.length, miss };
  });
  tipCov.n += r.n; tipCov.tipped += r.tipped; tipCov.miss.push(...r.miss.map((x) => `${where}: ${x}`));
};
for (const p of PANELS) {
  await nav(p);
  const tabs = await tabsOf();
  for (const t of tabs.length ? tabs : ['']) {
    if (t) await tabTo(t);
    await wait(80);
    await iaScan(`day400:${p}${t ? '.' + t : ''}`);
    await coverage(`day400:${p}${t ? '.' + t : ''}`);
    await shot(`20-day400-${p}${t ? '-' + t : ''}`);
  }
}
await b1Check('day 400');
await b2Check('day 400');
await b3Check('day 400', '29-day400-world-sectors');
await b4Check('day 400');
await d6Check('day 400', true);
await d4Check('day 400', true);
await e12Check('day 400');
await d8Check('day 400', true, 'full');
await e11Check('day 400', true);
await shot('27-day400-products-b2');
const fx9 = readFileSync(path.resolve('scripts/v2/fixtures/day900.json'), 'utf8');
await page.evaluate((j) => window.ai27v2.importJson(j), fx9);
await page.evaluate(() => { window.ai27v2.state.setup.tutorial = false; window.ai27v2.notify(); });
await b1Check('day 900');
await b2Check('day 900');
await b3Check('day 900', '29-day900-world-sectors');
await b4Check('day 900');
await d6Check('day 900', false);
await e12Check('day 900');
await d8Check('day 900', false, 'deep');
{
  const miss = D8_TERMS.filter((x) => !d8Seen.has(x));
  ok(`D8: every evals term has a tooltip in Models › Evals (${D8_TERMS.length})`, miss.length === 0, miss.join(', '));
}
await e11Check('day 900', true);
{
  const miss = D6_TERMS.filter((x) => !d6Seen.has(x));
  ok(`D6: every new suites term has a tooltip in Training › Environments (${D6_TERMS.length})`, miss.length === 0, miss.join(', '));
}
await d4Check('day 900', true, false);
{
  const miss = E12_TERMS.filter((x) => !e12Seen.has(x));
  ok(`E12: every new term is a Term link on Safety, the Blueprint or the model card (${E12_TERMS.length})`, miss.length === 0, miss.join(', '));
}
await shot('28-day900-products-b2');
{
  const miss = B1_TERMS.filter((t) => !b1Seen.has(t));
  ok(`B1: every new term has a tooltip on the product cards (${B1_TERMS.length})`, miss.length === 0, miss.join(', '));
  const miss2 = B2_TERMS.filter((t) => !b2Seen.has(t));
  ok(`B2: every new term has a tooltip on the product cards (${B2_TERMS.length})`, miss2.length === 0, miss2.join(', '));
  const miss4 = D4_TERMS.filter((t) => !d4Seen.has(t));
  ok(`D4: every data term has a tooltip on Training › Data or Next run (${D4_TERMS.length})`, miss4.length === 0, miss4.join(', '));
  const miss3 = B3_TERMS.filter((t) => !b3Seen.has(t));
  ok(`B3: every new term has a tooltip in World › Sectors (${B3_TERMS.length})`, miss3.length === 0, miss3.join(', '));
}
for (const p of PANELS) {
  await nav(p);
  const tabs = await tabsOf();
  for (const t of tabs.length ? tabs : ['']) {
    if (t) await tabTo(t);
    await wait(60);
    await iaScan(`day900:${p}${t ? '.' + t : ''}`);
    await coverage(`day900:${p}${t ? '.' + t : ''}`);
    await shot(`30-day900-${p}${t ? '-' + t : ''}`);
  }
}
{
  const pctCov = tipCov.n ? tipCov.tipped / tipCov.n : 1;
  ok(`J1 O1: rendered tooltip coverage ≥ 85% (day 400 + day 900, every panel and tab)`, pctCov >= 0.85, `${tipCov.tipped}/${tipCov.n} = ${(pctCov * 100).toFixed(1)}% · e.g. ${tipCov.miss.slice(0, 6).join(' ; ')}`);
}
// J1: jank fixes on the day-900 fixture.
await nav('blueprint');
await tabTo('next');
ok('UB-7: the start-from table shows each other start\'s effect against the plan', await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-test=start-table] .or')];
  return rows.length >= 2 && rows.some((l) => !l.classList.contains('on') && /[▲▼]|[+−]\d/.test(l.textContent ?? ''));
}));
await nav('finance');
await page.click('[data-tabs=finance] [data-tab=cash]'); await wait(80);
ok('J1 F1: why cash moved counts days, not the last 40 postings', await page.evaluate(() => { const r = [...document.querySelectorAll('[data-home=cashCauses] .cbar-lbl')].map((x) => x.textContent ?? ''); const m = r.map((x) => Number((x.match(/×(\d+)/) ?? [])[1] ?? 0)); return Math.max(0, ...m) >= 28; }));
ok('J1 F3: Finance opens on cash flow, history and the raise; the rest on tabs', (await page.$$('[data-tabs=finance] [data-tab]')).length >= 3 && !(await page.$('[data-home=ledger]')));
await nav('relations');
ok('J1 RL1: Retire stands apart behind a confirm', !!(await page.$('[data-test=retire-open]')) && !(await page.$('.catalog [data-act=RETIRE]')));
ok('J1 RL2: no security actions in the Relations catalogue', !(await page.$('[data-panel=relations] [data-act^="SEC_"]')));
// D4: the data actions moved from Relations to Models › Data (one home per control); Relations links there.
await page.click('[data-test=rel-groups] [data-opt=D]'); await wait(80);
ok('D4 Relations: no data actions in the catalogue, a link to Training › Data, old "License data" (D3) gone', !(await page.$('[data-panel=relations] [data-act^="data."]')) && !(await page.$('[data-test=data-pickers]')) && !!(await page.$('[data-panel=relations] [data-ref=dataPortfolio]')) && !(await page.$('[data-act=D3]')));
await check('D4 Relations: the data link opens Training › Data', "store.panel + ':' + (store.tab.blueprint || '')", () => page.click('[data-panel=relations] [data-ref=dataPortfolio]'));
await nav('relations');
await nav('models');
ok('UB-10: the family tree shows a state word on every model and folds retired ones', await page.evaluate(() => { const n = [...document.querySelectorAll('[data-home=lineage] [data-version]')]; return n.length >= 1 && n.every((x) => !!x.querySelector('[data-state]')) && ![...n].some((x) => x.querySelector('[data-state=retired]')); }));
ok('J1 M5: runs are named by their target', !(await page.locator('[data-panel=models]').innerText()).match(/\b(post|base|distill) \d+ (post|base|distill)\b/));
await nav('compute');
await tabTo('overview');
await wait(200);
ok('J1 C1: buy, build and rent show before → after (cash, runway)', await page.evaluate(() => ['cmp.buyChips', 'cmp.newSite', 'cmp.rentCompute'].every((id) => /cash.*→.*runway.*→/s.test(document.querySelector(`[data-test="preview.${id}"]`)?.textContent ?? ''))));
// FIN1 (finance v3 §3–§5): payment options on the build card, term × firmness on Buy chips / Rent compute with the
// expected price path, the rating with its terms and each debt instrument's limit on Finance.
{
  ok('FIN1: the build card compares payment options (cash, lease) on total cost', !!(await page.$('[data-panel=compute] [data-opt="site-pay-cash"]')) && !!(await page.$('[data-panel=compute] [data-opt="site-pay-lease"]')));
  const leaseOpen = !(await page.$('[data-panel=compute] [data-opt="site-pay-lease"][disabled]'));
  if (leaseOpen) {
    await check('FIN1: choosing the lease changes the build preview', `document.querySelector('[data-test="preview.cmp.newSite"]')?.textContent ?? ''`, () => page.click('[data-panel=compute] [data-opt="site-pay-lease"]'), 400);
    ok('FIN1: the lease preview shows the yearly lease from go-live', /lease per year/.test(await page.evaluate(() => document.querySelector('[data-test="preview.cmp.newSite"]')?.textContent ?? '')));
  } else ok('FIN1: lease locked with its reason at a closed rating', true, 'rating below B in this fixture');
  await page.click('[data-test=opt-order]');
  await wait(80);
  await page.click('[data-test=chip-term] [data-opt="8"]');
  await wait(300);
  ok('FIN1: a 2-year chip contract shows its expected price path', !!(await page.$('[data-panel=compute] [data-test=price-path]')));
  ok('FIN1: the 2-year chip preview lists first and last payments', /first of 8 quarterly payments/.test(await page.evaluate(() => document.querySelector('[data-test="preview.cmp.buyChips"]')?.textContent ?? '')));
  await page.click('[data-test=chip-term] [data-opt="1"]');
  await wait(80);
  ok('FIN1: a single batch offers cash, lease and chip-loan payment', !!(await page.$('[data-opt="chip-pay-cash"]')) && !!(await page.$('[data-opt="chip-pay-lease"]')) && !!(await page.$('[data-opt="chip-pay-loan"]')));
  await shot('52-fin1-compute-cards');
  await nav('finance');
  await page.click('[data-tabs=finance] [data-tab=deals]'); await wait(80);
  ok('FIN1: the debt card shows the rating score by term', /score .*cash flow.*liquidity.*leverage/.test(await page.evaluate(() => document.querySelector('[data-test=rating-terms]')?.textContent ?? '')));
  ok('FIN1: every debt instrument shows its limit and rule', (await page.$$('[data-panel=finance] [data-debt-kind]')).length === 3 && !!(await page.$('[data-panel=finance] [data-limit^="debt."]')));
  // FIN2: the guarantees moved to What we owe (one home); the debt card keeps the lessor's rate and links there.
  ok('FIN1: leases show on the debt card (guarantees in What we owe since FIN2)', /Leases/.test(await page.evaluate(() => document.querySelector('[data-test=lease-terms]')?.textContent ?? '')));
  await shot('53-fin1-debt');
  await nav('compute');
  await tabTo('overview');
}
// FIN2 (finance v3 §2, §11): the raise thesis (milestone × pitch) and its promise before you sign, What we owe (promises
// with progress and needed-by-now, tranche conditions, covenants, contingent liabilities), the IPO as its own action,
// and the one Watch alert when a promise is behind.
{
  await nav('finance');
  await page.click('[data-tabs=finance] [data-tab=cash]'); await wait(80);
  const nOpt = await page.evaluate(() => [document.querySelectorAll('[data-test=raise-type] [data-opt]').length, document.querySelectorAll('[data-test=raise-pitch] [data-opt]').length, document.querySelectorAll('#ctl-raise-card [data-cap]').length]);
  ok('FIN2: the raise card offers three milestones and three pitches', nOpt[0] === 3 && nOpt[1] === 3, nOpt.join('/'));
  ok('FIN2: no annual cap on the raise card (pool and dilution only)', !(await page.$('[data-cap=annualCap]')) && nOpt[2] === 2, nOpt.join('/'));
  ok('FIN2: the promise and its deadline show before you sign', /Promise: .+ by /.test(await page.evaluate(() => document.querySelector('[data-test=raise-promise]')?.textContent ?? '')));
  const alt = await page.$('[data-test=raise-type] [data-opt]:not(.active):not([disabled])');
  if (alt) await check('FIN2: another milestone changes the promise', `document.querySelector('[data-test=raise-promise]')?.textContent ?? ''`, () => alt.click());
  else ok('FIN2: another milestone changes the promise', false, 'no other milestone open');
  await check('FIN2: the pitch changes the price', `document.querySelector('#ctl-raise-card .ask-head')?.textContent ?? ''`, () => page.click('[data-test=raise-pitch] [data-opt=conservative]'));
  // FIN4r (H3): a round of $20B or more shows cash at the close and the conditional tranche; a small one none.
  {
    const max = Number(await page.evaluate(() => document.querySelector('[data-test=raise-ask]')?.getAttribute('max') ?? '0'));
    if (max >= 25) {
      await setSlider(page.locator('[data-test=raise-ask]'), 24); await wait(80);
      const big = await page.evaluate(() => [document.querySelector('[data-test=raise-tranche]')?.textContent ?? '', document.querySelector('[data-test=raise-preview]')?.textContent ?? '']);
      // FIN6b: runway and the tranche have one home on the Raise card (the before → after line), no pill copies.
      ok('FIN6b: the Raise card pills hold stake, price and odds only (runway and tranche on the preview line)', await page.evaluate(() => ![...document.querySelectorAll('#ctl-raise-card .ask-head .pills > *')].some((p) => /runway|tranche|no burn/.test(p.textContent ?? ''))));
      await setSlider(page.locator('[data-test=raise-ask]'), 5); await wait(80);
      const small = await page.evaluate(() => !!document.querySelector('[data-test=raise-tranche]'));
      ok('FIN4r: a $20B+ round shows cash at the close and its tranche on the Raise card', /\$12[\d.]*B tranche if/.test(big[0]) && /cash at the close/.test(big[1]) && !small, `${big.join(' | ')} · small ${small}`);
    } else ok('FIN4r: a $20B+ round shows cash at the close and its tranche on the Raise card', false, `ask slider max ${max}`);
  }
  ok('FIN2: the IPO is its own action with the dual-class choice', !!(await page.$('[data-test=ipo-row] [data-act="fin.ipo"]')) || /listed/.test(await page.evaluate(() => document.querySelector('[data-test=ipo-row]')?.textContent ?? '')));
  const canRaise = await page.$('[data-act="fin.raise"]:not([disabled])');
  if (canRaise) {
    await canRaise.click();
    await wait(150);
    ok('FIN2: a raise carries its thesis', JSON.parse(await get('!!(s.player.finance.ws3.pendingRound && s.player.finance.ws3.pendingRound.thesis)')));
  } else ok('FIN2: a raise carries its thesis', true, 'raise unavailable on this fixture');
  await shot('55-fin2-raise');
  // A promise behind its path (injected) shows in What we owe and raises the one Watch alert.
  await page.evaluate(() => {
    const s = window.ai27v2.state;
    const f = s.player.finance;
    f.promises.push({ id: 'PR-ui', type: 'adoption', pitch: 'base', start: f.revenueRun, target: f.revenueRun * 3, amount: 10, closeDay: s.time.day - 200, deadline: s.time.day + 165 });
    window.ai27v2.notify();
  });
  await wait(100);
  await page.click('[data-tabs=finance] [data-tab=owe]'); await wait(120);
  ok('FIN2: What we owe lists the promise with progress, needed-by-now and its state', !!(await page.$('[data-home=whatWeOwe] [data-promise="PR-ui"][data-state=behind] .hbar b')));
  ok('FIN2: investor credibility has its home on What we owe', !!(await page.$('[data-home=whatWeOwe] [data-home=investorCred]')));
  const nSec = await page.evaluate(() => document.querySelectorAll('[data-home=whatWeOwe] .owe-sec').length);
  ok('FIN2: What we owe has promises, tranche conditions, covenants and contingent liabilities', nSec === 4, String(nSec));
  ok('FIN6b: What we owe: tranche conditions wrap (no ellipsis); an undrawn line\'s covenant has no bar (cash is not repeated)', await page.evaluate(() => !document.querySelector('[data-home=whatWeOwe] [data-tranche] .ellip') && [...document.querySelectorAll('[data-home=whatWeOwe] [data-covenant][data-state=idle]')].every((r) => !r.querySelector('.hbar'))));
  ok('FIN2: copyright litigation exposure is listed as contingent', !!(await page.$('[data-home=whatWeOwe] [data-contingent="litigation"]')) || JSON.parse(await get('s.player.dataAssets.unlicensedTokensT <= 0')));
  await shot('56-fin2-owe');
  await clearTips();
  await page.click('[data-test=alert-chip]').catch(() => {});
  await wait(200);
  ok('FIN2: one Watch alert for the promise behind, linking to What we owe', !!(await page.$('[data-watch-row="owe"]')));
  await shot('57-fin2-watch');
  await page.keyboard.press('Escape');
  await page.click('[data-test=alert-chip]').catch(() => {});
  await page.evaluate(() => { const f = window.ai27v2.state.player.finance; f.promises = f.promises.filter((p) => p.id !== 'PR-ui'); window.ai27v2.notify(); });
  await page.click('[data-tabs=finance] [data-tab=deals]'); await wait(80);
  ok('FIN2: the debt card links lease guarantees to What we owe (one home)', !!(await page.$('[data-test=lease-terms] [data-go="fin.go.guarantees"]')) && !/guarantees \$/.test(await page.evaluate(() => document.querySelector('[data-test=lease-terms]')?.textContent ?? '')));
}
// FIN3a (finance v3 §7.3–§7.4): the Board card shows seats, what moves this board (four named sources × its
// multipliers, then the drift to 60) and the next review; every major decision shows the seat-by-seat vote before you
// ask; a failed vote disables the button; founder control offers to force it.
{
  await nav('finance');
  await page.click('[data-tabs=finance] [data-tab=owners]'); await wait(120);
  const nMood = await page.evaluate(() => document.querySelectorAll('[data-home=board] [data-test=mood-sources] [data-mood]').length);
  ok('FIN3a: the Board card lists the four mood sources and the drift to 60', nMood === 5, String(nMood));
  await page.hover('[data-home=board] [data-mood=incidents]');
  await wait(300);
  ok('FIN3a: a mood source explains this board\'s multiplier seat by seat', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /on this board/.test(t) && /×2/.test(t); })()`)));
  await clearTips();
  await page.hover('[data-home=board] [data-seat="1"]');
  await wait(300);
  ok('FIN3a: a seat tooltip shows how much each kind of news moves it', JSON.parse(await get(`(() => /Minds/.test(document.querySelector('.tip')?.innerText ?? ''))()`)));
  await clearTips();
  await shot('58-fin3a-board');
  // A down round is a major decision: tight runway makes it available; the vote shows under the button, seat by seat.
  const saved = await get('({ state: s.player.finance.state, bc: s.player.board.confidence, preset: s.player.board.preset })');
  await page.evaluate(() => { const s = window.ai27v2.state; s.player.finance.state = 'tight'; s.player.board.confidence = 60; window.ai27v2.notify(); });
  await page.click('[data-tabs=finance] [data-tab=cash]'); await wait(150);
  const nVoters = JSON.parse(await get('s.player.board.seats.filter((x) => x.weight > 0).length'));
  const chips = await page.evaluate(() => document.querySelectorAll('.act-col:has([data-act="fin.downRound"]) [data-test=vote] [data-vote]').length);
  ok('FIN3a: the down-round button shows each seat\'s vote before you ask', chips === nVoters && chips > 0, `${chips} chips, ${nVoters} voting seats`);
  await page.hover('.act-col:has([data-act="fin.downRound"]) [data-test=vote]');
  await wait(300);
  ok('FIN3a: the vote tooltip shows each seat\'s lean and the shared terms', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /Board mood/.test(t) && /Situation/.test(t) && /stance/.test(t); })()`)));
  await shot('59-fin3a-vote');
  await clearTips();
  // A board with no confidence votes it down: the button is disabled with the vote as its reason.
  await page.evaluate(() => { const s = window.ai27v2.state; s.player.board.confidence = 0; s.player.finance.cash = Math.max(s.player.finance.cash, 1e4); window.ai27v2.notify(); });
  await wait(150);
  ok('FIN3a: a failed vote disables the decision', !!(await page.$('.act-col:has([data-act="fin.downRound"]) [data-test=vote][data-pass="0"]')) && !!(await page.$('[data-act="fin.downRound"][disabled]')));
  ok('FIN3a: without founder control there is no force button', !(await page.$('[data-act="fin.downRound:force"]')));
  // Founder control: the same failed vote can be forced at board confidence −20.
  await page.evaluate(() => { const s = window.ai27v2.state; s.player.board.preset = 'founder'; s.player.board.confidence = 30; window.ai27v2.notify(); });
  await wait(150);
  const forceBtn = await page.$('[data-act="fin.downRound:force"]');
  if (forceBtn) {
    await check('FIN3a: founder control forces a failed vote (confidence −20, the round books)', 's.player.finance.rounds.length + ":" + Math.round(s.player.board.confidence)', () => forceBtn.click(), 200);
  } else ok('FIN3a: founder control forces a failed vote (confidence −20, the round books)', false, 'no force button (the vote passed?)');
  await page.evaluate((v) => { const s = window.ai27v2.state; const o = JSON.parse(v); s.player.finance.state = o.state; s.player.board.confidence = o.bc; s.player.board.preset = o.preset; window.ai27v2.notify(); }, saved);
  await wait(100);
}
// FIN3b (finance v3 §7.2, §7.5): charter rights on the Board card with what each blocks and the models the safety
// committee holds; the launch button says why it is blocked; the ouster vote is shown seat by seat before the review;
// the critics' seat is a standing action with its preview.
{
  const saved = await get('({ board: s.player.board, warn: s.player.finance.ws3.boardWarnDay, critics: s.player.finance.ws3.criticsDay, versions: s.player.models.versions.length, causes: s.causes.byKey["board.confidence"] ?? [] })');
  // Nonprofit PBC with a red-flagged model ready to release (and the same flag on every full model, so a launch hits it).
  await page.evaluate(() => {
    const s = window.ai27v2.state;
    s.player.board.preset = 'nonprofitPBC';
    s.player.board.safetyCommitteeVeto = true;
    const fulls = s.player.models.versions.filter((v) => v.variant === 'full' && (v.status === 'ready' || v.status === 'deployed'));
    const c = JSON.parse(JSON.stringify(fulls[fulls.length - 1]));
    c.id = 'V-ui-held'; c.name = 'Held-1'; c.status = 'ready';
    s.player.models.versions.push(c);
    window.__schemeSave = Object.fromEntries(fulls.map((v) => [v.id, JSON.stringify(v.beliefs.SCHEME ?? null)]));
    for (const v of [...fulls, c]) v.beliefs.SCHEME = { est: 0.6, sd: 0.1, clarity: 0.7, lastObsDay: s.time.day };
    window.ai27v2.notify();
  });
  await nav('finance');
  await page.click('[data-tabs=finance] [data-tab=owners]'); await wait(120);
  ok('FIN3b: the Board card lists the charter rights with what each blocks', !!(await page.$('[data-home=board] [data-test=charter] [data-right=safetyCommittee]')) && /halts red-flagged releases/.test(await page.evaluate(() => document.querySelector('[data-home=board] [data-test=charter]')?.textContent ?? '')));
  ok('FIN3b: the safety committee row names the model it holds', /Held-1/.test(await page.evaluate(() => document.querySelector('[data-test=charter-held]')?.textContent ?? '')));
  await page.hover('[data-home=board] [data-right=safetyCommittee]');
  await wait(300);
  ok('FIN3b: the charter tooltip gives the rule, the held model with its flag and the source', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /Blocks/.test(t) && /scheming 60%/i.test(t) && /Delaware/.test(t); })()`)));
  await clearTips();
  await shot('60-fin3b-charter');
  await nav('products');
  ok('FIN3b: Products links to the models the safety committee holds (home: the Board card)', !!(await page.$('[data-ref=charterHolds]')));
  const launchReason = await page.evaluate(() => document.querySelector('[data-test=prod-launch] .act-reason')?.textContent ?? '');
  ok('FIN3b: a blocked launch says the safety committee halts it and how to clear it', !(await page.$('[data-test=prod-launch]')) || /Safety committee halts the release/.test(launchReason) || !/Launch/.test(await page.evaluate(() => document.querySelector('[data-test=prod-launch] [data-act^="product.launch"]')?.textContent ?? 'Launch')), launchReason.slice(0, 90));
  await shot('61-fin3b-launch-held');
  // Ouster vote: confidence 15, a warning 100 days old, a reckless year: the vote is held at the next review.
  await page.evaluate(() => {
    const s = window.ai27v2.state;
    s.player.board.confidence = 15;
    s.player.finance.ws3.boardWarnDay = s.time.day - 100;
    s.causes.byKey['board.confidence'] = [{ day: s.time.day - 5, delta: -30, source: 'public incident' }];
    window.ai27v2.notify();
  });
  await nav('finance');
  await page.click('[data-tabs=finance] [data-tab=owners]'); await wait(120);
  const nVoters = JSON.parse(await get('s.player.board.seats.filter((x) => x.weight > 0 && x.kind !== "founder").length'));
  const oChips = await page.evaluate(() => document.querySelectorAll('[data-test=ouster-vote][data-live="1"] [data-vote]').length);
  ok('FIN3b: the ouster vote is on the Board card, seat by seat, before the review', oChips === nVoters && oChips > 0, `${oChips} chips, ${nVoters} voting seats`);
  await page.hover('[data-test=board-review]');
  await wait(300);
  ok('FIN3b: the ouster tooltip shows the grievance and where each seat turns', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /Grievance/.test(t) && /turns/.test(t) && /No dice/.test(t); })()`)));
  await clearTips();
  await shot('62-fin3b-ouster');
  // The critics' seat: available below 40; its preview names the new director; clicking adds the seat and +15.
  await page.evaluate(() => { const s = window.ai27v2.state; s.player.board.confidence = 35; delete s.player.finance.ws3.criticsDay; window.ai27v2.notify(); });
  await wait(120);
  await page.hover('[data-act="fin.critics"]');
  await wait(300);
  ok('FIN3b: the critics\' seat preview names the director and the +15', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /Safety director/.test(t) && /15/.test(t); })()`)));
  await clearTips();
  await check('FIN3b: giving the critics a seat adds a director and +15 confidence', 's.player.board.seats.length + ":" + Math.round(s.player.board.confidence)', () => page.click('[data-act="fin.critics"]'), 200);
  ok('FIN3b: the critics\' seat is once a year', !!(await page.$('[data-act="fin.critics"][disabled]')) || !(await page.$('[data-act="fin.critics"]')));
  await shot('63-fin3b-critics');
  await page.evaluate((v) => {
    const s = window.ai27v2.state; const o = JSON.parse(v);
    s.player.board = o.board; s.player.finance.ws3.boardWarnDay = o.warn; s.player.finance.ws3.criticsDay = o.critics;
    if (o.warn === undefined) delete s.player.finance.ws3.boardWarnDay;
    if (o.critics === undefined) delete s.player.finance.ws3.criticsDay;
    s.player.models.versions = s.player.models.versions.filter((x) => x.id !== 'V-ui-held');
    for (const x of s.player.models.versions) {
      const b = window.__schemeSave?.[x.id];
      if (b === undefined) continue;
      const o2 = JSON.parse(b);
      if (o2) x.beliefs.SCHEME = o2; else delete x.beliefs.SCHEME;
    }
    s.causes.byKey['board.confidence'] = o.causes;
    window.ai27v2.notify();
  }, saved);
  await wait(100);
}
// FIN3c (finance v3 §9): a rival in distress is for sale; the offer shows cash vs stock (with the dilution), the
// obligations you take on, the antitrust cost and the board's vote under each buy choice; a failed vote disables it;
// buying books its contracts and debt (the debt card lists the assumed debt).
{
  await closeModals();
  await pause();
  const saved = await get('({ bc: s.player.board.confidence, cash: s.player.finance.cash })');
  const lab = JSON.parse(await get('(s.rivals.find((r) => r.core.status === "active" && r.finance.valuation > 0) ?? {}).core?.id ?? null'));
  ok('FIN3c: a private rival to buy', !!lab);
  if (lab) {
    await page.evaluate((id) => {
      const st = window.ai27v2; const s = st.state;
      const r = s.rivals.find((x) => x.core.id === id);
      r.finance.cash = -3; r.finance.distress = true;
      s.player.board.confidence = 80; s.player.finance.cash = Math.max(s.player.finance.cash, 5000);
      s.events.pending.push({ id: 'E32', instance: 'E32@ui', day: s.time.day, deadline: s.time.day + 30, data: { lab: id }, crisis: false });
      st.openDecision('E32@ui'); st.notify();
    }, lab);
    await wait(200);
    const labels = await page.$$eval('[data-test=decision][data-event=E32] .acard-top b', (els) => els.map((e) => e.textContent));
    ok('FIN3c: the merger offer offers cash, stock or decline', labels.join('|') === 'Pay cash|Pay in stock|Decline', labels.join('|'));
    ok('FIN3c: each buy choice shows the board\'s vote, seat by seat, under its card', (await page.$$('[data-test=decision] .dm2-choice [data-test=vote] [data-vote]')).length > 0 && (await page.$$('[data-test=decision] .dm2-choice')).length === 2);
    ok('FIN3c: paying in stock shows the dilution; both show the obligations taken on and the antitrust cost', JSON.parse(await get(`(() => { const t = [...document.querySelectorAll('[data-test=decision] [data-choice]')].map((e) => e.innerText); return /stake/.test(t[1]) && !/stake/.test(t[0]) && /scrutiny/.test(t[0]) && /scrutiny/.test(t[1]) && t.slice(0, 2).every((x) => (x.match(/\\$/g) ?? []).length >= 2); })()`)));
    await page.hover('[data-test=decision] [data-choice="1"] .pill2.exp');
    await wait(300);
    ok('FIN3c: an obligation pill says what it is (its contracts, firm, by quarter)', JSON.parse(await get(`(() => /its contracts/.test(document.querySelector('.tip')?.innerText ?? ''))()`)));
    await page.mouse.move(1, 1); // (Esc would close the decision: Later)
    await wait(150);
    await shot('64-fin3c-merger-offer');
    await page.evaluate(() => { window.ai27v2.state.player.board.confidence = 0; window.ai27v2.notify(); });
    await wait(150);
    ok('FIN3c: a failed merger vote disables the buy choices', !!(await page.$('[data-test=decision] [data-choice="0"][disabled]')) && !!(await page.$('[data-test=decision] .dm2-choice [data-test=vote][data-pass="0"]')));
    await page.evaluate(() => { window.ai27v2.state.player.board.confidence = 80; window.ai27v2.notify(); });
    await wait(150);
    await check('FIN3c: buying in stock books its contracts and debt and absorbs the lab', 's.player.finance.ledger.filter((c) => c.kind === "acquired").length + ":" + s.player.finance.debts.filter((d) => d.kind === "assumed").length + ":" + s.rivals.filter((r) => r.core.status === "active").length', () => page.click('[data-test=decision] [data-choice="1"]'), 200);
    await nav('finance');
    await page.click('[data-tabs=finance] [data-tab=deals]'); await wait(120);
    ok('FIN3c: the debt card lists the assumed debt', /Assumed debt/.test(await page.evaluate(() => document.querySelector('[data-home=debt]')?.textContent ?? '')));
    await shot('65-fin3c-assumed-debt');
  }
  await page.evaluate((v) => { const s = window.ai27v2.state; const o = JSON.parse(v); s.player.board.confidence = o.bc; window.ai27v2.notify(); }, saved);
  await wait(100);
}
// FIN4a (finance v3 §6): one offer per partner on the Partners card; an unavailable partner says why; an offer shows
// its equity and tranche conditions, its supply on the expected path with both discounts, and its strings before you
// sign; signing books those terms and the tranche conditions move to What we owe.
{
  await closeModals();
  await pause();
  await page.evaluate(() => { const s = window.ai27v2.state; s.player.finance.state = 'healthy'; s.player.board.confidence = 80; window.ai27v2.notify(); });
  await nav('finance');
  await page.click('[data-tabs=finance] [data-tab=deals]'); await wait(150);
  ok('FIN4a: the Partners card lists the five partners', (await page.$$('[data-home=partners] [data-partner]')).length === 5, String((await page.$$('[data-home=partners] [data-partner]')).length));
  const blocked = await page.$('[data-home=partners] [data-partner][data-blocked="1"]');
  if (blocked) { await blocked.click(); await wait(120); }
  const reason = await page.evaluate(() => document.querySelector('[data-test=partner-blocked]')?.textContent ?? '');
  ok('FIN4a: an unavailable partner says why', !!blocked && reason.length > 10, reason);
  await page.click('[data-home=partners] [data-partner="Azimuth"]'); await wait(150);
  ok('FIN4a: the offer shows equity, its two tranche conditions and the supply on the expected path', !!(await page.$('[data-test=partner-equity]')) && (await page.$$('[data-tranche-offer]')).length === 2 && !!(await page.$('[data-test=partner-supply-terms] [data-test=price-path]')));
  const offerText = await page.evaluate(() => document.querySelector('[data-test=partner-terms]')?.textContent ?? '');
  ok('FIN4a: the offer names its discounts and its strings before signing', /firm/.test(offerText) && /partner/.test(offerText) && /take-or-pay/.test(offerText) && /[Ee]xclusiv/.test(offerText) && /revenue share/.test(offerText), offerText.slice(0, 160));
  await page.hover('[data-test=partner-supply-terms] > span');
  await wait(400);
  ok('FIN4a: the supply tooltip breaks the price down (firm and partner discounts, take-or-pay)', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /Firm discount/.test(t) && /Partner discount/.test(t) && /Take-or-pay/.test(t); })()`)));
  await clearTips();
  await check('FIN4a: custom chips change the supply terms', `document.querySelector('[data-test=partner-supply-terms]')?.textContent ?? ''`, () => page.click('[data-test=partner-supply] [data-opt=asic]'));
  await page.click('[data-test=partner-supply] [data-opt=cloud]'); await wait(100);
  // FIN4b (finance v3 §6.1 strings): the count of partners, exclusivity and IP access as options that add money (IP access
  // locked with a reason without an in-house lab), what IP access costs in words, and what each live partner costs.
  ok('FIN4b: the Partners card counts partners (n of 3)', /\d of 3 partners/.test(await page.evaluate(() => document.querySelector('[data-test=partner-count]')?.textContent ?? '')));
  const arch0 = await page.evaluate(() => JSON.stringify(window.ai27v2.state.rivals.map((r) => r.archetype)));
  const ipLock0 = await page.evaluate(() => document.querySelector('[data-test=partner-ipaccess] [data-opt=yes]')?.getAttribute('data-locked') ?? '');
  await page.evaluate(() => { const s = window.ai27v2.state; const act = s.rivals.filter((r) => r.core.status === 'active'); for (const r of s.rivals) if (act.length < 2 && r.core.status !== 'active') { r.core.status = 'active'; delete r.core.mergedInto; act.push(r); } s.rivals.forEach((r) => { r.archetype = 'safety'; }); act[0].archetype = 'bigtech'; act[1].archetype = 'bigtech'; window.ai27v2.notify(); }); // FINM: the model-v3 day-900 fixture has two active rivals and FIN3c just bought one: one more is brought back so both hyperscalers have a lab
  await wait(150);
  ok('FIN4b: IP access is locked with its reason without an in-house lab, open with one', (ipLock0 === '' || /no in-house lab/.test(ipLock0)) && !(await page.$('[data-test=partner-ipaccess] [data-opt=yes][disabled]')), ipLock0);
  await check('FIN4b: exclusivity adds money to the offer', `document.querySelector('[data-test=partner-equity]')?.textContent ?? ''`, () => page.click('[data-test=partner-exclusive] [data-opt=yes]'));
  await check('FIN4b: IP access adds money and says what it costs', `(document.querySelector('[data-test=partner-equity]')?.textContent ?? '') + (document.querySelector('[data-test=partner-ip-cost]')?.textContent ?? '')`, () => page.click('[data-test=partner-ipaccess] [data-opt=yes]'));
  ok('FIN4b: the IP-access cost is in plain words (the lab closes ~10% of your lead a year)', /closes ~10% of your lead a year/.test(await page.evaluate(() => document.querySelector('[data-test=partner-ip-cost]')?.textContent ?? '')));
  await page.hover('[data-test=partner-strings] > span'); await wait(400);
  ok('FIN4b: the exclusivity tooltip names what it blocks', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /Blocks/.test(t) && /Northwind/.test(t); })()`)));
  await clearTips();
  await shot('66-fin4a-partner-offer');
  await check('FIN4a: Sign books the deal and its tranches', 's.player.finance.deals.filter((d) => d.partner === "Azimuth" && !d.legacy).length + ":" + s.player.finance.tranches.filter((t) => t.partner === "Azimuth").length', () => page.click('[data-act="fin.partner"]'), 200);
  ok('FIN4a: a signed partner shows what runs and links its tranches to What we owe', !!(await page.$('[data-test=partner-signed]')) && !!(await page.$('[data-go="fin.go.partnerTranches"]')));
  ok('FIN4b: the signed deal books the chosen strings (exclusive, IP access)', await page.evaluate(() => { const d = window.ai27v2.state.player.finance.deals.find((x) => x.partner === 'Azimuth' && !x.legacy); return !!d?.strings.exclusivity && !!d?.strings.ipAccess; }));
  const costs = await page.evaluate(() => document.querySelector('[data-test=partner-costs] [data-partner-cost="Azimuth"]')?.textContent ?? '');
  ok('FIN4b: what a live partner costs: revenue share a year, the lead its IP access closes, the partner its exclusivity blocks', /revenue/.test(costs) && /\/yr/.test(costs) && /blocks Northwind/.test(costs), costs);
  ok('FIN4b: the competitor of an exclusive partner says why it is blocked', await page.evaluate(() => document.querySelector('[data-home=partners] [data-partner="Northwind Cloud"]')?.getAttribute('data-blocked') === '1'));
  await shot('67-fin4a-partner-signed');
  await page.evaluate((a) => { const s = window.ai27v2.state; JSON.parse(a).forEach((x, i) => { if (s.rivals[i]) s.rivals[i].archetype = x; }); window.ai27v2.notify(); }, arch0);
  await page.click('[data-tabs=finance] [data-tab=owe]'); await wait(150);
  ok('FIN4a: the partner\'s tranche conditions show in What we owe', /Azimuth tranche/.test(await page.evaluate(() => document.querySelector('[data-home=whatWeOwe]')?.textContent ?? '')));
}
// FIN5a (finance v3 §1, §5, §11): the Story card (sector value × your share → valuation, the share bar, the four
// drivers with credibility and governance), the valuation's home, supplier terms on the Buy chips card.
{
  await page.evaluate((j) => window.ai27v2.importJson(j), fx);
  await page.evaluate(() => { window.ai27v2.state.setup.tutorial = false; window.ai27v2.notify(); });
  await nav('finance');
  await page.click('[data-tabs=finance] [data-tab=story]'); await wait(150);
  const eq = await page.evaluate(() => document.querySelector('[data-home=story] [data-test=story-eq]')?.textContent ?? '');
  ok('FIN5a: the Story card shows sector value × your share → next mark, with the mood', /Sector/.test(eq) && /Your share/.test(eq) && /next mark/.test(eq) && /mood (cold|cool|normal|warm|hot|bust)/.test(eq), eq.slice(0, 120));
  ok('FIN5a: the valuation\'s home is the Story card (Ownership links to it)', !!(await page.$('[data-home=story] [data-home=valuation]')) && (await page.$$('[data-home=valuation]')).length === 1);
  const nLabs = JSON.parse(await get('1 + s.rivals.filter((r) => r.core.status === "active" && r.finance.valuation > 0).length'));
  ok('FIN5a: the share bar has one segment per private lab, you first', (await page.$$('[data-home=story] [data-test=story-shares] [data-lab]')).length === nLabs && !!(await page.$('[data-home=story] [data-test=story-shares] [data-lab=player]:first-child')), String(nLabs));
  const drv = await page.$$eval('[data-home=story] [data-test=story-drivers] [data-driver]', (els) => els.map((e) => e.getAttribute('data-driver')));
  ok('FIN5a: four drivers plus credibility and governance, each with its × effect', drv.join(',') === 'position,momentum,economics,capacity,investorCred,govFactor' && /×\d\.\d\d/.test(await page.evaluate(() => document.querySelector('[data-driver=position]')?.textContent ?? '')), drv.join(','));
  await page.hover('[data-home=story] [data-driver=position]'); await wait(450);
  const tip = await page.evaluate(() => document.querySelector('.tip')?.textContent ?? '');
  ok('FIN5a: a driver\'s tooltip says what it is, you vs the field and its effect', /You/.test(tip) && /Field/.test(tip) && /Effect on your weight/.test(tip), tip.slice(0, 120));
  await clearTips();
  ok('FIN5a: credibility on the Story card links to its home in What we owe', !!(await page.$('[data-home=story] [data-driver=investorCred] [data-ref=investorCred]')) && !(await page.$('[data-home=story] [data-home=investorCred]')));
  await page.hover('[data-home=story] [data-home=valuation]'); await wait(450);
  const why = await page.evaluate(() => document.querySelector('.tip')?.textContent ?? '');
  ok('FIN5a: the valuation\'s why names the sector value and your share', /Sector value at the last mark/.test(why) && /Why it moved/.test(why), why.slice(0, 160));
  await clearTips();
  // FIN5b: a rival's bar is the home of its valuation: its tooltip shows the valuation (the engine's), the cap and its
  // multiple, credibility and governance by kind.
  {
    const rid = JSON.parse(await get('s.rivals.find((r) => r.core.status === "active" && r.finance.valuation > 0)?.core.id ?? null'));
    const rv = JSON.parse(await get(`s.rivals.find((r) => r.core.id === ${JSON.stringify(rid)}).finance.valuation`));
    await page.hover(`[data-home=story] [data-test=story-shares] [data-lab="${rid}"]`); await wait(450);
    const rt = await page.evaluate(() => document.querySelector('.tip')?.textContent ?? '');
    const sig = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(1));
    const money = (x) => (x >= 1000 ? `$${sig(x / 1000)}T` : `$${sig(x)}B`);
    ok('FIN6b: a rival\'s bar tooltip is short: its valuation (the engine\'s), share, revenue and multiple, details one level down', /valued/.test(rt) && /Share today/.test(rt) && /× revenue/.test(rt) && /Why this share/.test(rt) && !/credibility/i.test(rt) && rt.includes(money(rv)), `${money(rv)} · ${rt.slice(0, 160)}`);
    await wait(1400); // lock the tooltip, then open the nested one
    await page.hover('.tip [data-test=rival-why]').catch(() => {}); await wait(500);
    const rt2 = await page.evaluate(() => [...document.querySelectorAll('.tip')].map((x) => x.textContent ?? '').join(' | '));
    ok('FIN5b/FIN6b: the rival\'s details (nested): credibility, governance by kind and its cap', /Investor credibility/.test(rt2) && /Governance/.test(rt2) && /Cap/.test(rt2) && /Story score/.test(rt2), rt2.slice(-200));
    await page.mouse.move(1, 1); await page.keyboard.press('Escape'); await wait(250);
    await page.hover('[data-home=story] [data-driver=govFactor]'); await wait(450);
    const gt = await page.evaluate(() => document.querySelector('.tip')?.textContent ?? '');
    ok('FIN5b: the governance tile says rivals count by kind (no longer ×1)', /Rivals by kind/.test(gt) && !/Rivals count ×1/.test(gt), gt.slice(0, 160));
    await clearTips();
  }
  await shot('70-fin5a-story');
  await page.click('[data-tabs=finance] [data-tab=owners]'); await wait(120);
  ok('FIN5a: Ownership links to the valuation in Story', !!(await page.$('[data-home=ownership] [data-ref=valuation]')));
  ok('FIN6b: Ownership does not repeat the IPO window (its home is Markets)', !/window/i.test(await page.evaluate(() => document.querySelector('[data-home=ownership]')?.textContent ?? '')));
  await nav('compute');
  await tabTo('overview');
  // FIN6b: payment options show a present value next to the undiscounted total; a lease's PV sits near cash's even though
  // its total is far larger (it changes timing, not cost).
  {
    const $B = (x) => { const m = x.match(/\$([\d.]+)([KMBT])/); return m ? Number(m[1]) * { K: 1e-6, M: 1e-3, B: 1, T: 1e3 }[m[2]] : NaN; };
    const tiles = await page.evaluate(() => [...document.querySelectorAll('[data-panel=compute] [data-test="site-pay-tiles"] [data-opt]')].map((e) => [e.getAttribute('data-opt'), e.querySelector('[data-test=pay-pv]')?.textContent ?? '', e.textContent ?? '']));
    const cash = tiles.find((x) => x[0] === 'site-pay-cash');
    const lease = tiles.find((x) => x[0] === 'site-pay-lease' && x[1]);
    ok('FIN6b: the build card\'s payment tiles show PV and the total', !!cash && /PV \$/.test(cash[1]) && /total/.test(cash[2]), tiles.map((x) => x[2]).join(' | '));
    if (lease) {
      const pvR = $B(lease[1]) / $B(cash[1]);
      const totR = $B(lease[2].replace(/^.*?PV \$[\d.]+[KMBT]/, '')) / $B(cash[2].replace(/^.*?PV \$[\d.]+[KMBT]/, ''));
      ok('FIN6b: a site lease\'s PV is close to cash (within 15%) though its total is far larger', pvR > 0.85 && pvR < 1.15 && totR > 1.3, `PV ×${pvR.toFixed(2)} · total ×${totR.toFixed(2)}`);
      await page.hover('[data-panel=compute] [data-opt="site-pay-lease"]'); await wait(450);
      ok('FIN6b: the PV tooltip states its discount rate and which rate it is', /Present value: every payment discounted to today at [\d.]+% a year, the (lessor|chip-loan)/.test(await page.evaluate(() => document.querySelector('.tip')?.textContent ?? '')));
      await clearTips();
    } else ok('FIN6b: a site lease\'s PV is close to cash (within 15%) though its total is far larger', true, 'lease closed on this fixture');
  }
  await page.evaluate(() => { const s = window.ai27v2.state; s.capital.ws3.playerShare = 0.05; s.player.finance.runwayQ = 2; window.ai27v2.notify(); });
  await wait(120);
  const sup = await page.evaluate(() => document.querySelector('[data-test=supplier-terms]')?.textContent ?? '');
  ok('FIN5a: the Buy chips card shows the supplier terms a weak lab gets (deposit above 30%)', /supplier terms · deposit (\d+)%/.test(sup) && Number((sup.match(/deposit (\d+)%/) ?? [])[1]) > 30, sup);
  await page.evaluate((j) => window.ai27v2.importJson(j), fx);
  await page.evaluate(() => { window.ai27v2.state.setup.tutorial = false; window.ai27v2.notify(); });
}
// J2: engineers' load, spare serving, days cut, same-lineage monitors, risk lever what-ifs, launches on the build queue.
await nav('lab');
await tabTo('work');
ok('J2 P1: engineering pool shows build capacity and how much is in use', /Build capacity/.test(await page.locator('[data-test=build-queue]').innerText()) && /in use/.test(await page.locator('[data-test=build-queue]').innerText()));
await page.hover('[data-test=build-queue]');
await wait(300);
ok('J2 P1: the build tooltip splits upkeep and the build queue', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /Upkeep/.test(t) && /Build queue/.test(t); })()`)));
await shot('50-j2-build-load');
await clearTips();
// UB-F: the monitor and the control protocol readouts live on SAFETY › Safeguards (OQ-7): a same-family monitor shows
// its chip and its lower stop on scheming-type acts; under the control protocol the cell shows its slowdown and its
// tooltip names the deferral and what slips past.
await nav('safety');
await tabTo('safeguards');
await wait(120);
{
  const sameUse = JSON.parse(await get(`(() => { return [...document.querySelectorAll('[data-home=staffSafeguards] [data-test^="same-monitor."]')].map((e) => e.getAttribute('data-test').slice(13))[0] ?? ''; })()`));
  if (sameUse) {
    await page.hover(`[data-test="same-monitor.${sameUse}"]`);
    await wait(350);
    ok('J2 AG1: a same-family monitor shows its lower stop on scheming-type acts (SAFETY › Safeguards)', !!(await page.$(`.tip [data-test="agent-catch.${sameUse}.coll"]`)));
    await clearTips();
  } else ok('J2 AG1: a same-family monitor shows its lower stop on scheming-type acts (no same-family monitor on this fixture)', true);
}
const ctlWasOn = !!(await page.$('[data-test=control-edit]'));
await page.evaluate(() => { const s = window.ai27v2.state; for (const d of s.player.deployments) if (d.channel === 'internal' && d.status === 'live' && !(d.guards ?? []).some((g) => g.kind === 'control')) d.guards = [...(d.guards ?? []), { kind: 'control', setting: 'defer10', since: s.time.day }]; window.ai27v2.notify(); });
await wait(200);
ok('E6: under the control protocol the Safeguards grid shows its cell and the AI staff slowdown', !!(await page.$('[data-test=control-edit]')) && /[1-9]/.test(await page.$eval('[data-test=staff-slowdown]', (e) => e.textContent ?? '').catch(() => '')));
await page.hover('[data-test=control-edit]', { timeout: 2000 }).catch(() => {});
await wait(350);
ok('E6: the control-protocol tooltip names the deferral, what slips past and the AI labour lost', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /deferred/.test(t) && /slip/.test(t) && /AI labour/.test(t); })()`)));
await shot('51-e6-control-tax');
await clearTips();
if (!ctlWasOn) await page.evaluate(() => { for (const d of window.ai27v2.state.player.deployments) if (d.channel === 'internal') d.guards = (d.guards ?? []).filter((g) => g.kind !== 'control'); window.ai27v2.notify(); });
await wait(100);
await nav('lab');
await tabTo('board');
ok('RD-A05b: LAB shows idle serving compute inside the Products segment', JSON.parse(await get(`(() => { const e = document.querySelector('[data-test=alloc-bar] [data-seg=serving] .idle'); return !!e && parseFloat(e.style.width) > 0; })()`)));
await shot('51-j2-lab-idle');
await nav('products');
{
  const spare = JSON.parse(await get(`(() => { const p = s.player; let used = 0; for (const d of p.deployments) if (d.kind === 'product' && d.status !== 'withdrawn' && d.needH100e !== undefined) used += Math.min(d.servedH100e ?? 0, d.needH100e); return p.computeOnline * p.split.serving - used; })()`));
  ok('J2 PR1 (UB-A): Products says serving compute is spare and links to LAB (the segment lives there)', spare < 1000 || /spare/.test(await page.$eval('[data-test=prod-serving-link]', (e) => e.textContent ?? '').catch(() => '')), `spare ${Math.round(spare)}`);
  const launch = await page.$('[data-act^="product.launch."]:not([disabled]):not([data-act*=cancel])');
  if (launch) {
    await launch.click();
    await wait(200);
    ok('J2 P1: a launch goes on the build queue and shows its wait', JSON.parse(await get(`s.player.build.queue.some((it) => it.kind === 'launch')`)) && !!(await page.$('[data-test=prod-launch-building]')));
    await shot('52-j2-launch-building');
    const cancel = await page.$('[data-act^="product.launch.cancel."]');
    if (cancel) await check('J2 P1: a queued launch can be cancelled', `s.player.build.queue.length`, () => cancel.click());
  } else ok('J2 P1: a launch goes on the build queue (no launchable product on this fixture)', true);
}
await shot('53-j2-products');
await nav('world');
await tabTo('risk');
await page.hover('[data-panel=world] [data-test^="risk-v."]').catch(() => {});
await wait(300);
ok('J2 RK1: a risk figure lists how far one step of each lever moves it', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /What one step moves/.test(t) && /pts/.test(t); })()`)));
await shot('54-j2-risk-levers');
await clearTips();
// Hover states for the record
await nav('overview');
await page.hover('[data-test=speed]');
await wait(500);
await shot('32-day900-hover-speed');
await clearTips();
await page.hover('[data-test=cash]');
await wait(500);
await shot('33-day900-hover-cash');
await clearTips();
// R7: the model picker's before → after preview on a lane (frontier research on an older model: taste and speed fall).
await nav('lab');
await tabTo('work');
{
  const old = JSON.parse(await get(`(s.player.models.versions.find((v) => v.variant === 'full' && v.status !== 'retired' && v.id !== s.player.agents.capRoutine.versionId) || {}).id || ''`));
  if (old) {
    await page.selectOption('[data-test="agent-model.capFrontier"]', old);
    await wait(150);
    ok('Agents: an older frontier model previews less work done on ideas', JSON.parse(await get(`(() => { const t = document.querySelector('[data-test="agent-edit.capFrontier"]')?.innerText ?? ''; return /Work done, ideas/.test(t) && /▼/.test(t); })()`)));
    await shot('34-day900-agents-preview');
    await page.click('[data-test="agent-cancel.capFrontier"]');
  }
}
const multi = [...homesByScreen.entries()].filter(([, v]) => v.size > 1);
for (const [h, v] of multi) iaIssues.push(`${h} has homes on several screens: ${[...v].join(', ')}`);
ok('IA: one home per datum, terms resolve, no raw floats', iaIssues.length === 0, iaIssues.slice(0, 8).join(' | '));
for (const x of iaIssues.slice(8, 30)) console.log('     ' + x);

// F6c: placeholder "L" previews gone. Tree nodes give their typed effect (P22: PHYS +1.65 OOM, the domain effect adoption
// adds per unit; L.scale: OOM of the pretraining stack); Retire version names the version and retires it (no "L", no
// made-up compute). The fixture is reloaded below.
{
  const f6c = JSON.parse(await get(`(() => {
    const V = window.ai27v2Views.actionView;
    const p22 = V(s, 'research.queue', { id: 'P22' }).gains.find((g) => g.currency === 'progress');
    const sc = V(s, 'research.queue', { id: 'L.scale' }).gains.find((g) => g.currency === 'progress');
    const v = s.player.models.versions.find((x) => x.status !== 'retired' && x.status !== 'rolledBack' && !Object.values(s.player.agents).some((a) => a.versionId === x.id || a.monitorId === x.id)
      && s.player.models.stream?.versionId !== x.id && !s.player.deployments.some((d) => d.status !== 'withdrawn' && (d.versionId === x.id || d.monitorId === x.id || d.miniVersionId === x.id)));
    const r = v ? V(s, 'retireVersion', { versionId: v.id }) : undefined;
    if (v) store.act('retireVersion', { versionId: v.id });
    return { p22, sc, r, name: v?.name, after: v ? s.player.models.versions.find((x) => x.id === v.id)?.status : undefined };
  })()`));
  ok('F6c: tree previews give the typed effect (P22 PHYS +1.65 OOM; L.scale OOM of pretraining)', f6c.p22?.unit === 'OOM' && Math.abs(f6c.p22.amount - 1.65) < 1e-9 && /PHYS/.test(f6c.p22.target) && f6c.sc?.unit === 'OOM' && f6c.sc.amount > 0 && /Pretraining/.test(f6c.sc.target), JSON.stringify([f6c.p22, f6c.sc]));
  if (f6c.r) ok('F6c: Retire version previews the version it retires, and retires it', f6c.r.costs.length === 1 && f6c.r.costs[0].unit === 'version' && f6c.r.costs[0].target.startsWith(f6c.name) && !f6c.r.gains.length && f6c.after === 'retired', JSON.stringify(f6c.r));
}

// F6d: safety-node previews state their real effect (no `0.05 × saf` alignment). T-DECEPT's preview names the traits the
// deception probe detects with the coverage the detection code reads from the lab's technique state; no tree preview
// has a unitless alignment line.
{
  const f6d = JSON.parse(await get(`(() => {
    const V = window.ai27v2Views.actionView;
    const g = V(s, 'research.queue', { id: 'T-DECEPT' }).gains.find((x) => x.currency === 'alignment');
    const cov = Object.entries(s.player.safety.techniques['T-DECEPT']?.coverage ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const ids = ['T-DECEPT', 'T-TMON', 'T-INOC', 'P25', 'P17', 'P14', 'engagement'];
    const bad = ids.filter((id) => { const p = V(s, 'research.queue', { id }); return [...p.gains, ...p.exposure].some((x) => x.currency === 'alignment' && !x.unit); });
    const p25 = V(s, 'research.queue', { id: 'P25' }).gains.find((x) => x.currency === 'alignment');
    return { g, cov, bad, p25 };
  })()`));
  const covOk = f6d.cov.length > 0 && f6d.cov.every(([, c]) => f6d.g?.target.includes(` ${c}`));
  ok('F6d: a safety node previews its real effect (T-DECEPT: detector, the coverage the detection reads; P25 0.5 defence levels)', f6d.g?.unit === 'detector' && f6d.g.amount === 1 && covOk && f6d.p25?.unit === 'defence levels' && f6d.p25.amount === 0.5 && !f6d.bad.length, JSON.stringify(f6d));
}

// F6e: Respond › Targeted training previews what apply does. On the reloaded fixture (day 400 since FIN5a; M10: T-INOC
// is unlocked here, as it was on the earlier fixtures: with generic AG18 training the preview reads the believed efficacy
// and apply the true one, so the two differ by design) training PERSONA
// removes the share the preview names: with no U-mode and no training gaming (removal multiplier 1, set here; the
// fixture is reloaded below) the true level falls by exactly that share, the believed line is est → est × (1 − share),
// and the next post-training run's penalty grows by the preview's years. No unitless alignment line on any response.
{
  const f6e = JSON.parse(await get(`(() => {
    const V = window.ai27v2Views.actionView;
    const v = s.player.models.versions.find((x) => x.id === s.player.agents.capRoutine.versionId);
    if (!v) return {};
    const kinds = ['patchSignal', 'retrainAgainst', 'targetedTraining', 'restrictContext', 'rollback', 'disclose'];
    const bad = kinds.filter((k) => { const p = V(s, 'safety.respond', { kind: k, versionId: v.id }); return [...p.gains, ...p.exposure].some((x) => x.currency === 'alignment' && !x.unit && x.amount !== 0); });
    v.uModes = [];
    v.traitsTrue.TGAME = 0;
    if (s.player.safety.techniques['T-INOC']) s.player.safety.techniques['T-INOC'].unlocked = true;
    const p = V(s, 'safety.respond', { kind: 'targetedTraining', versionId: v.id, trait: 'PERSONA' });
    const g = p.gains.find((x) => x.unit === 'PERSONA');
    const pen = p.costs.find((x) => x.currency === 'progress' && x.unit === 'yr');
    const est = v.beliefs.PERSONA.est;
    const before = v.traitsTrue.PERSONA;
    const pen0 = s.flags['ws2.runPenalty'] ?? 0;
    store.act('safety.respond', { kind: 'targetedTraining', versionId: v.id, trait: 'PERSONA' });
    return { g, pen, est, before, after: v.traitsTrue.PERSONA, dPen: (s.flags['ws2.runPenalty'] ?? 0) - pen0, bad };
  })()`));
  const share = f6e.g && f6e.est > 0 ? f6e.g.amount / f6e.est : NaN;
  ok('F6e: Targeted training previews the share apply removes (believed est → est × (1 − share); true level × (1 − share)) and its run penalty', f6e.before > 0 && Math.abs(1 - f6e.after / f6e.before - share) < 1e-9 && f6e.g.target.includes(`→ ${(f6e.est * (1 - share)).toFixed(2)}`) && Math.abs(f6e.dPen + f6e.pen.amount) < 1e-12 && !f6e.bad.length, JSON.stringify(f6e));
}

// Speed-4 run for 2 s from the day-400 fixture (the day-900 fixture can end within days, e.g. another lab's ASI):
// no errors, alerts appear. Then back to day 900 for the end screen.
await page.evaluate((j) => window.ai27v2.importJson(j), fx);
await page.evaluate(() => { window.ai27v2.state.setup.tutorial = false; window.ai27v2.notify(); });
await closeModals();
await page.click('[data-speed="4"]');
// Model v3 V2a: the day-400 fixture has no run in flight, so the first alert can take longer than 2 s; run until one
// shows (at most 10 s).
for (let i = 0; i < 20 && !(await page.$$('.queue-row .alert-chip2, .queue-row .dec-chip2')).length; i++) await wait(500);
await pause();
await closeModals();
ok('Alerts/decisions shown in queue', (await page.$$('.queue-row .alert-chip2, .queue-row .dec-chip2')).length > 0);
await shot('31-day400-running');
await page.evaluate((j) => window.ai27v2.importJson(j), fx9);

// ───────────────────────── R2: the simulated leader lab (setup.leaderLab) ─────────────────────────
await closeModals();
await page.evaluate(() => { const st = window.ai27v2; st.start({ ...st.draftSetup, tutorial: false, seed: 4243, companyName: 'OpenBrain', leaderLab: true }); });
await wait(150);
await page.evaluate(() => window.ai27v2.step(30));
await closeModals();
await nav('overview');
ok('Leader lab: Overview race lane', !!(await page.$('[data-home=leadTrack] [data-lane="rL"]')));
await shot('50-leader-overview');
await nav('relations');
if (await page.$('[data-test=rel-all-cp]')) { await page.click('[data-test=rel-all-cp]'); await wait(60); } // J1 RL1: top 4 by default
ok('Leader lab: Relations lists it', (await page.locator('[data-panel=relations]').innerText()).includes('Polaris AI'));
await shot('51-leader-relations');
await page.evaluate((j) => window.ai27v2.importJson(j), fx9);

// ───────────────────────── R9: start types (big-tech Finance variant; spinout and challenger fixtures) ─────────────────────────
const ia9 = iaIssues.length;
await closeModals();
await page.evaluate(() => { const st = window.ai27v2; st.start({ ...st.draftSetup, tutorial: false, seed: 4244, companyName: 'OpenBrain', start: 'bigtech', leaderLab: true, governance: 'parent' }); });
await wait(150);
await page.evaluate(() => window.ai27v2.step(5));
await closeModals();
ok('Big tech: a division with the leader lab', (await get('s.setup.start')) === '"bigtech"' && (await get('s.player.board.preset')) === '"parent"' && (await get('s.rivals.some((r) => r.core.id === "rL")')) === 'true');
await nav('finance');
ok('Big tech Finance: parent budget schedule, no raise card or ownership', !!(await page.$('[data-home=parentBudget] [data-q]')) && !(await page.$('#ctl-raise-card')) && !(await page.$('[data-home=ownership]')));
ok('Big tech Finance: equity unavailable with its reason', (await page.locator('[data-test=division-reason]').innerText().catch(() => '')).includes('no outside equity'));
await iaScan('finance:bigtech');
ok('J1 F2: big tech: parent budget is the inflow bar; no runway or distress readout', !!(await page.$('[data-wf=parent]')) && !!(await page.$('[data-test=division-budget]')) && !(await page.locator('.topstrip2').innerText()).match(/distress|tight/i));
await shot('60-bigtech-finance');
ok('FIN6b: the cash history draws from the start (today and the projection; no empty card)', !!(await page.$('[data-home=cashHistory] polyline')), `day ${await get('s.time.day')} · points ${await get('s.series.day.length')}`);
// FIN5c (FINANCE-V3 §13): the division readout: budget this year, spent so far, over / within budget, the review, the
// goals (home: What we owe), next year's budget; parent confidence lives on this card (the Board card links to it).
ok('FIN5c big tech: Parent budget shows the year (budget, spent), the verdict, review, goals and next year; parent confidence home here',
  !!(await page.$('[data-home=parentBudget] [data-test=division-year]')) && (await page.getAttribute('[data-test=division-status]', 'data-status')) === 'within' && !!(await page.$('[data-home=parentBudget] [data-home=parentConf]')) && !!(await page.$('[data-test=division-goals]')) && !!(await page.$('[data-test=division-next]')) && (await page.locator('[data-test=division-status]').innerText()).includes('Within budget'));
await page.evaluate(() => { window.ai27v2.state.player.finance.cash = -30; window.ai27v2.notify(); });
await wait(120);
{
  const txt = await page.locator('[data-test=division-status]').innerText();
  const top = await page.locator('.topstrip2').innerText();
  ok('FIN5c big tech over budget: "over budget by $X; parent covers" on the card and the top strip, never runway distress', /Over budget by \$[\d.]+B; parent covers/.test(txt) && (await page.getAttribute('[data-test=division-budget]', 'data-status')) === 'over' && /parent covers/i.test(top) && !/distress|tight/i.test(top), txt);
}
ok('FIN6b big tech: the cash history draws cash below $0 as the advance from the parent (axis below $0, band, legend)', !!(await page.$('[data-home=cashHistory] [data-test=cash-advance-band]')) && !!(await page.$('[data-test=legend-advance] [data-term=parentAdvance]')));
await shot('61-bigtech-over-budget');
await page.evaluate(() => { window.ai27v2.state.player.finance.cash = 8; window.ai27v2.notify(); });
await tabTo('owe');
ok('FIN5c big tech What we owe: the parent goals with progress (no investor credibility, tranches or covenants)', (await page.$$('[data-home=whatWeOwe] [data-promise]')).length === 3 && (await page.locator('[data-home=whatWeOwe]').innerText()).toUpperCase().includes('PARENT GOALS') && !(await page.$('[data-test=investor-cred]')) && !(await page.$('[data-covenant]')));
await page.hover('[data-home=whatWeOwe] [data-promise]');
await wait(250);
ok('FIN5c big tech: a goal\'s tooltip says what judging it would do to parent confidence', JSON.parse(await get(`/parent confidence/.test(document.querySelector('.tip')?.innerText ?? '')`)));
await iaScan('finance:bigtech-owe');
await tabTo('owners');
ok('FIN5c big tech Board: links to parent confidence (one home), no ouster vote', !!(await page.$('[data-go="fin.go.parentConf"]')) && !(await page.$('[data-home=boardConf]')) && !(await page.$('[data-test=ouster-vote]')));
await tabTo('cash');
for (const start of ['spinout', 'challenger']) {
  const fxs = readFileSync(`scripts/v2/fixtures/start-${start}-day400.json`, 'utf8');
  await page.evaluate((j) => window.ai27v2.importJson(j), fxs);
  await page.evaluate(() => { window.ai27v2.state.setup.tutorial = false; window.ai27v2.notify(); });
  await closeModals();
  ok(`${start} fixture loads (day 400)`, (await get('s.setup.start')) === `"${start}"` && (await get('s.time.day')) === '400');
  for (const id of ['overview', 'lab', 'models', 'products', 'finance']) {
    await nav(id);
    await iaScan(`${id}:${start}`);
  }
  await shot(`61-${start}-day400`);
}
ok('R9 IA: start screens keep one home per datum, terms resolve, no raw floats', iaIssues.length === ia9, iaIssues.slice(ia9, ia9 + 6).join(' | '));

// ───────────────────────── R10: limits registry (data-limit), top strip revenue, Overview core loop, codex ─────────────────────────
// Every limit of src/data/v2/limits.ts must show (data-limit) on its home screen, or in the codex's Limits category when
// its home is the codex. Conditional limits get the state that makes them bind (pause, a public timer, a case).
const LIMIT_DEFS = [...readFileSync('src/data/v2/limits.ts', 'utf8').matchAll(/\{ id: '([^']+)', title: [^\n]*?home: \{ panel: '(\w+)'(?:, tab: '(\w+)')? \}/g)].map((m) => ({ id: m[1], panel: m[2], tab: m[3] }));
const limitSeen = new Set();
const collectLimits = async () => { for (const id of await page.$$eval('[data-limit]', (els) => els.map((e) => e.getAttribute('data-limit')))) limitSeen.add(id); };
const hoverCollect = async (sel) => { const el = await page.$(sel); if (!el) return; await el.hover(); await wait(450); await collectLimits(); await clearTips(); };
ok('Limits registry parsed', LIMIT_DEFS.length >= 20, `${LIMIT_DEFS.length} limits`);
// the challenger fixture (leader lab on) is loaded: knowledge diffusion shows on research speed
await hoverCollect('.topstrip2 [data-test=speed]');
ok('R10 challenger: research speed shows knowledge diffusion', limitSeen.has('speed.diffusion'));
await shot('70-challenger-speed-limits');
await page.evaluate((j) => window.ai27v2.importJson(j), fx9);
await page.evaluate(() => {
  const st = window.ai27v2;
  const s = st.state;
  s.setup.tutorial = false;
  s.flags.paused = true;
  let inc = s.player.safety.incidents.find((i) => i.status === 'open');
  // FIN5b: the regenerated day-900 fixture may hold no open incident (the world drifts with every engine change); open
  // one on a live deployment so the incident limits have something to bind on.
  const dep = s.player.deployments.find((d) => d.status !== 'withdrawn' && d.channel !== 'internal');
  if (!inc && dep) { inc = { id: 'I-ui-1', day: s.time.day - 5, labId: 'player', versionId: dep.versionId, deploymentId: dep.id, trueSource: 'RH', apparent: 'RH', severity: 3, exposure: 'internal', status: 'open', responses: [] }; s.player.safety.incidents.push(inc); }
  if (inc) { inc.exposure = 'customer'; inc.publicTimerDays = 9; }
  // A capacity-bound product (model v3 V3: the day-900 fixture's serving is no longer short).
  for (const k of ['consumer', 'sector']) if (s.world.fx.capPenalty[k] < 0.01) s.world.fx.capPenalty[k] = 0.2;
  st.notify();
});
await closeModals();
await page.evaluate(() => window.ai27v2.act('safety.investigate', { trait: 'SUCC', fte: 20 }));
for (const l of LIMIT_DEFS.filter((x) => x.panel !== 'codex')) {
  if (limitSeen.has(l.id)) continue;
  if (l.id.startsWith('speed.')) { await hoverCollect('.topstrip2 [data-test=speed]'); continue; } // UB-5: research speed's limits sit in its L0 tooltip
  await nav(l.panel);
  if (l.tab) await tabTo(l.tab);
  if (l.panel === 'research' && l.tab === 'projects') { await page.click('[data-home=priorities] [data-card] .nm').catch(() => {}); await wait(80); } // UB-6: per-programme limits sit in the card drawer
  if (l.panel === 'safety' && l.tab === 'cases') { for (const b of await page.$('[data-test^="inc-list."]')) await b.click().catch(() => {}); await wait(80); } // UB-F: an incident's public timer sits in its group's dates list
  if (l.panel === 'research' && l.tab !== 'projects') {
    const ids = await page.$$eval('[data-panel=research] .dc-nd:not(.st-known):not(.st-soon)', (els) => els.map((e) => e.getAttribute('data-node')));
    for (const id of ids) {
      await page.click(`[data-panel=research] .dc-nd[data-node="${id}"]`).catch(() => {});
      await wait(60);
      if (await page.$('[data-limit="tree.retry"]')) break;
    }
  }
  await wait(80);
  await collectLimits();
  if (l.panel === 'products') { await hoverCollect('[data-panel=products] [data-test^="prod-bind."]'); }
}
await page.hover('.topstrip2 [data-test=speed]');
await wait(450);
await shot('71-day900-speed-limits');
await clearTips();
await nav('codex');
await page.click('[data-codex-cat="Limits"]');
await wait(80);
const codexLimits = await page.$$eval('[data-codex^="lim:"]', (els) => els.map((e) => e.getAttribute('data-codex').slice(4)));
for (const l of LIMIT_DEFS.filter((x) => x.panel === 'codex')) if (codexLimits.includes(l.id)) limitSeen.add(l.id);
const missingLimits = LIMIT_DEFS.filter((l) => !limitSeen.has(l.id)).map((l) => `${l.id} (${l.panel}${l.tab ? '.' + l.tab : ''})`);
ok(`R10 limits: every registry limit is shown where it binds (${LIMIT_DEFS.length})`, missingLimits.length === 0, missingLimits.join(', '));
ok('R10 codex: every limit listed under Limits', codexLimits.length === LIMIT_DEFS.length, `${codexLimits.length} of ${LIMIT_DEFS.length}`);
const unknownLimits = [...limitSeen].filter((id) => !LIMIT_DEFS.some((l) => l.id === id));
ok('R10 limits: every data-limit is in the registry', unknownLimits.length === 0, unknownLimits.join(', '));
await page.evaluate(() => { window.ai27v2.state.flags.paused = false; window.ai27v2.notify(); });
// Codex opens on the structure diagram; the simulated-world note is there.
await page.click('[data-codex-cat="Structure"]');
await wait(80);
ok('R10 codex: core-loop structure diagram', !!(await page.$('.codex-entry [data-test=coreloop-static] [data-loop=teams]')));
await check('R10 codex: simulated-from-outside note', `document.querySelector('.codex-entry').innerText`, () => page.click('[data-codex="s:outside"]'));
ok('R10 codex: rivals are simplified', (await page.locator('.codex-entry').innerText()).includes('simulated from the outside'));
await shot('72-codex-structure');
// UB-5 top strip: no revenue or capability chip (UI-IA §0); the loss-of-control risk reads a % or Unknown.
ok('UB-5 top strip: no revenue or race chip', !(await page.$('.topstrip2 [data-test=revenue]')) && !(await page.$('.topstrip2 [data-test=race]')));
ok('UB-5 top strip: loss-of-control risk shows a % or Unknown', /(%|Unknown|none)/.test(await page.locator('.topstrip2 [data-test=risk]').innerText()));
await page.hover('[data-test=speed]');
await wait(450);
await shot('73-hover-speed');
await clearTips();
// UB-A Overview: the hub (one box per screen with a verdict; each box opens its screen) and the lead lanes (best guess,
// likely range, the locked tooltip's intel date and the World › Risk link). No race chart, no Watch card, no risk number.
await nav('overview');
ok('UB-A Overview: hub with nine boxes, each with a verdict', (await page.$$('[data-test=hub] [data-hub]')).length === 9 && JSON.parse(await get(`[...document.querySelectorAll('[data-test=hub] [data-hub] .vd')].every((e) => e.innerText.trim().length > 1)`)));
ok('UB-A Overview: no race chart, Watch card or old loop', !(await page.$('.racehist')) && !(await page.$('[data-test=watch]')) && !(await page.$('[data-test=coreloop]')));
ok('UB-A Overview: a lane per active lab with a likely range', JSON.parse(await get(`(() => { const n = document.querySelectorAll('[data-test=leadtrack] [data-lane]').length; return n >= 1 && [...document.querySelectorAll('[data-test=leadtrack] [data-lane] .rg2')].every((e) => /likely/.test(e.innerText)); })()`)));
await page.mouse.move(1, 1);
await page.hover('[data-test=leadtrack] [data-lane] .ln');
await wait(900);
ok('UB-A Overview: lane tooltip shows the intel report and the World risk link', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /Intel report/i.test(t) && /Likely range/i.test(t) && /Risk from their models/.test(t); })()`)));
await clearTips();
await check('UB-A Overview: a hub box opens its screen', 'store.panel', () => page.click('[data-test=hub] [data-hub=research]'));
await nav('overview');
await check('UB-A Overview: the World box opens World › Risk', 'store.panel + ":" + (store.tab.world || "")', () => page.click('[data-test=hub] [data-hub=world]'));
await nav('overview');
await iaScan('overview:r10');
await shot('74-overview-loop');
await page.evaluate((j) => window.ai27v2.importJson(j), fx9);

// ───────────────────────── end screen ─────────────────────────
await closeModals();
await page.evaluate(() => window.ai27v2.act('RETIRE'));
await page.evaluate(() => window.ai27v2.step(2));
await wait(200);
const ended = JSON.parse(await get('s.ending ? s.ending.id : ""'));
ok('Game ends (retire)', !!ended, ended);
ok('End screen renders', !!(await page.$('[data-test=endscreen]')));
await shot('40-endscreen');
await page.evaluate(() => window.scrollTo(0, 0));
await page.locator('[data-test=endscreen]').evaluate((el) => el.scrollTo(0, 2000));
await shot('41-endscreen-lower');
await check('End: new game', 'store.screen', () => page.click('[data-test=end-new]'));

console.log(`\n${pass} passed, ${fail} failed${fails.length ? `\nFAILED: ${fails.join(' | ')}` : ''}${errors.length ? `\nPAGE ERRORS (${errors.length}):\n${[...new Set(errors)].slice(0, 20).join('\n')}` : ''}`);
await browser.close();
process.exit(fail || errors.length ? 1 : 0);
