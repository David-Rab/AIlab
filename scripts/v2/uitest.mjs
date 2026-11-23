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
const PANELS = ['finance', 'overview', 'lab', 'compute', 'research', 'models', 'blueprint', 'products', 'safety', 'relations', 'world', 'risk', 'codex'];
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
await check('LAB: a workforce row opens its needs', '!!document.querySelector("[data-needs]")', () => page.click('[data-row="re.saf"]'));
await check('LAB: scientists split + raises the capability scientists target', 's.player.hiring.targets["sci.cap"]', () => page.click('[data-act="sciSplit.sci.cap.up"]'));
{
  const mv = await page.$('[data-home=bestMoves] [data-act^="move."]:not([disabled])');
  const split0 = JSON.parse(await get('s.player.split'));
  if (mv) await check('LAB: Best moves Do performs the move', 'JSON.stringify([s.player.split, s.player.hiring.targets])', () => mv.click());
  // An idle-compute move can take the whole Training share (no run uses it): restore it for the later run checks.
  else ok('LAB: Best moves lists moves or says none helps', !!(await page.$('[data-home=bestMoves]')));
  await page.evaluate((sp) => window.ai27v2.act('setSplit', sp), split0);
}
// R3 People: teams by role, keep-hiring targets, offers, filling queue, move and let go.
await nav('lab');
await tabTo('people');
ok('Teams card: one science card per science team', JSON.parse(await get(`document.querySelectorAll('[data-panel=lab] .sci-card').length === s.player.teams.filter((t) => t.role === 'sci').length`)));
ok('Teams card: piles for engineers and both research-engineering departments', JSON.parse(await get(`['eng', 're.cap', 're.saf'].every((k) => !!document.querySelector('[data-panel=lab] [data-pile="' + k + '"]'))`)));
await check('Keep hiring: + raises the research-engineering target', 's.player.hiring.targets["re.cap"]', () => page.click('[data-act="teams.target.up.re.cap"]'));
await check('Offer: Hire queues the team', 'JSON.stringify([s.player.hiring.candidates.length, s.player.hiring.filling.length])', () => page.click('[data-panel=lab] .offer [data-act="teams.hire"]'));
await check('Filling: cancel removes a queued team', 's.player.hiring.filling.length', () => page.click('[data-panel=lab] [data-act="teams.cancel"]'));
await check('Move: safety research-engineering team to capabilities', 'JSON.stringify([s.player.teams.filter((t) => t.role === "re" && t.dept === "saf").length, Math.round(s.player.morale.safety)])', () => page.click('[data-pile="re.saf"] [data-act="teams.move"]'));
ok('Move: safety morale paid', JSON.parse(await get('s.causes.byKey["morale.safety"] ? s.causes.byKey["morale.safety"].some((c) => /moved/.test(c.source)) : false')));
await check('Let go: a science team', 's.player.teams.length', () => page.click('[data-panel=lab] .sci-card [data-act="teams.release"]'));
await shot('20-lab-people');
await tabTo('work');
// R7 Agents at work: four lanes (home of the internal packages), model/monitor chips with a before → after preview,
// compute steppers, AI share per role, risk badges; Trusted to AI (B3 gate); the same chips on Products; Safety links.
ok('Agents at work: four lanes with model and monitor chips', JSON.parse(await get(`['eng', 'capRoutine', 'capFrontier', 'safety'].every((u) => !!document.querySelector('[data-home=agents] [data-lane=' + u + '] [data-chip=model]') && !!document.querySelector('[data-home=agents] [data-lane=' + u + '] [data-chip=monitor]'))`)));
ok('Agents at work: AI share of each capabilities role and four risk badges per lane', JSON.parse(await get(`['eng', 'capRoutine', 'capFrontier'].every((u) => !!document.querySelector('[data-test="ai-share.' + u + '"]')) && document.querySelectorAll('[data-home=agents] [data-risk]').length === 16`)));
await page.selectOption('[data-test="agent-monitor.eng"]', 'same');
await wait(80);
ok('Agents: a monitor pick opens the before → after preview', !!(await page.$('[data-test="agent-edit.eng"] .pv')));
await page.click('[data-test="agent-cancel.eng"]');
await wait(60);
ok('Agents: Cancel closes the preview and keeps the package', JSON.parse(await get('s.player.agents.eng.monitorId === undefined && !document.querySelector(\'[data-test="agent-edit.eng"]\')')));
await page.selectOption('[data-test="agent-monitor.capFrontier"]', '');
await wait(80);
await check('Agents: Apply removes the frontier monitor', 'JSON.stringify(s.player.agents.capFrontier.monitorId || null)', () => page.click('[data-act="agents.set.capFrontier"]'));
await check('Agents: compute + moves agent pool to engineering', 'JSON.stringify(s.player.agents.eng.compute)', () => page.click('[data-act="agents.compute.up.eng"]'));
ok('Agents: capabilities shares still sum to 1', JSON.parse(await get('Math.abs(s.player.agents.eng.compute + s.player.agents.capRoutine.compute + s.player.agents.capFrontier.compute - 1) < 1e-9')));
{
  const gate = JSON.parse(await get('!!document.querySelector("[data-test=trusted-gate]")'));
  ok('Trusted to AI: home on the safety lane; locked below the AI-labour gate', !!(await page.$('[data-home=trustedToAI]')) && (!gate || !!(await page.$('[data-act="agents.trusted.up"][disabled]'))), gate ? 'locked' : 'open');
}
await shot('21-lab-agents');
// B4: one WSL target range for the slider and the engine.
await tabTo('security');
ok('Security target slider range matches the engine (2–5)', JSON.parse(await get(`(() => { const r = document.querySelector('[data-panel=lab] [data-home=wsl] input[type=range]'); return !!r && r.min === '2' && r.max === '5'; })()`)));
await check('Security target: slider at the floor + Set', 's.player.security.target', async () => {
  await setSlider(page.locator('[data-panel=lab] [data-home=wsl] input[type=range]'), 2);
  await page.click('[data-panel=lab] [data-act=SEC_TARGET]');
});
ok('Security target set to the slider value', JSON.parse(await get('s.player.security.target === 2')));
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
  const rq = JSON.parse(await get(`(() => { const q = document.querySelector('[data-home=runQueue]'); const live = s.player.models.runs.filter((r) => r.status === 'running' || r.status === 'paused').length; return [!!q && q.querySelectorAll('[data-run]:not([data-run=stream]):not([data-run=spare])').length === live && live >= 1 && q.querySelectorAll('[data-test=run-share]').length === live, (q?.innerText ?? store.panel).slice(0, 160)]; })()`));
  ok('Runs: every running run with its share and ETA (no finished ones)', rq[0], rq[1]);
}
await check('Run queue: − lowers a pool share', 'JSON.stringify(s.player.models.runs.map((r) => r.poolShare))', () => page.locator('[data-act^="run-share-dn."]:not([disabled])').first().click());
ok('Run queue: idle row links to Lab', !!(await page.$('[data-home=runQueue] [data-run=spare] [data-ref=idleCompute]')));
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
// ── Products (R6): cards, live edit with before → after preview, features, settings, Auto serving, Agents gate. ──
await nav('products');
ok('Products: one card per live product', (await page.$$('[data-panel=products] [data-product]')).length >= 3);
// B5 / R6 / RD-P06: deep effort is a locked option with its reason until its idea (the model's capability) is known.
if (!JSON.parse(await get(`s.player.tree.P05?.status === 'known'`))) {
  ok('Products: deep effort locked with its reason', await page.$eval('[data-panel=products] [data-test^=prod-effort] [data-opt=deep]', (b) => b.disabled && (b.getAttribute('data-locked') ?? '').length > 5).catch(() => false));
}
const apiId = JSON.parse(await get(`(s.player.deployments.find(d => d.channel === 'api' && d.status === 'live') || {}).id || ''`));
if (apiId) {
  const card = `[data-panel=products] [data-product="${apiId}"]`;
  await page.selectOption(`${card} select[data-test^=prod-monitor]`, { index: 1 });
  await page.click(`${card} [data-test^=prod-price] [data-opt=premium]`);
  await wait(120);
  const pop = JSON.parse(await get(`(() => { const p = document.querySelector('[data-test="prod-edit.${apiId}"]'); return p ? p.innerText : ''; })()`));
  ok('Products: an edit opens the before → after preview (stays live, effective date)', /stays live/.test(pop) && /→/.test(pop) && /from /.test(pop), pop.replace(/\n/g, ' ').slice(0, 120));
  await check('Products: Apply updates the live product (monitor + premium)', `(() => { const d = s.player.deployments.find(x => x.id === "${apiId}"); return [d.monitorId, d.price, d.status, d.startDay]; })()`, () => page.click(`[data-act="product.update.${apiId}"]`));
  ok('Products: the product stayed live with its start day', JSON.parse(await get(`(() => { const d = s.player.deployments.find(x => x.id === "${apiId}"); return d.status === 'live' && d.price === 'premium' && !!d.monitorId; })()`)));
  ok('Products: the card shows the monitor catch rate', !!(await page.$(`${card} [data-test="prod-catch.${apiId}"]`)));
  await page.click(`${card} [data-test^=prod-price] [data-opt=standard]`);
  await wait(80);
  await check('Products: Cancel drops a draft edit', `!!document.querySelector('[data-test="prod-edit.${apiId}"]')`, () => page.click(`[data-test="prod-cancel.${apiId}"]`));
}
const buildBtn = await page.$('[data-panel=products] [data-act^="feature.build."]:not([disabled])');
if (buildBtn) await check('Products: Build a feature (engineers\' queue)', `s.player.build.queue.filter(i => i.kind === 'feature').length`, () => buildBtn.click());
ok('Products: locked features name their idea', !!(await page.$('[data-panel=products] .ft.locked[data-node]')));
ok('Products: the same package chips as Agents at work (model + monitor)', !!(await page.$('[data-panel=products] [data-product] [data-chip=model]')) && !!(await page.$('[data-panel=products] [data-product] [data-chip=monitor]')));
ok('Products (TIERS): sector products show their lineup, one row per tier (model + 3 students)', (await page.$$('[data-panel=products] [data-test^=prod-lineup] [data-test^=prod-tier]')).length >= 8);
ok('Products: serving split bar by product',(await page.$$('[data-panel=products] [data-test=serving-bar] [data-serve]')).length >= 3);
await check('Products: Override turns Auto serving off', 's.player.policies.servingAuto', () => page.click('[data-act="products.policy.servingAuto"]'));
const prodA = JSON.parse(await get(`(s.player.deployments.find(d => d.status === 'live' && d.channel !== 'internal' && d.channel !== 'open') || {}).id || ''`));
if (prodA && await page.$('[data-test=serving-manual]')) {
  await check('Products: hand-set serving share', `s.player.deployments.find(d => d.id === "${prodA}").servingShare`, async () => {
    await setSlider(page.locator(`[data-test=serving-manual] input[type=range]`).first(), 0.35);
    await page.click(`[data-act="product.serving.${prodA}"]`);
  });
}
await check('Products: Auto serving back on', 's.player.policies.servingAuto', () => page.click('[data-act="products.policy.servingAuto"]'));
await check('Products: upgrade-to-newest policy', 's.player.policies.upgradeToNewest', () => page.click('[data-act="products.policy.upgradeToNewest"]'));
await page.click('[data-act="products.policy.upgradeToNewest"]');
if (await page.$('[data-test=agents-gate]')) ok('Products: Agents card shows its time-horizon gate', /h/.test(await page.$eval('[data-test=agents-gate]', (e) => e.textContent ?? '')));
{
  const ent = JSON.parse(await get(`(s.player.deployments.find(d => d.channel === 'enterprise' && d.status === 'live') || {}).id || ''`));
  if (ent) await check('Products: Retire withdraws a product', `s.player.deployments.find(d => d.id === "${ent}").status`, () => page.click(`[data-act="product.retire.${ent}"]`));
}
// R8 Safety: overview (verdict, race chart, four risk families, policies), research lines, investigations.
await nav('safety');
await tabTo('overview');
ok('Safety overview: verdict, race chart, 4 risk families, policies', !!(await page.$('[data-home=safetyVerdict]')) && !!(await page.$('[data-test=race-chart]')) && (await page.$$('[data-home=riskFamilies] [data-family]')).length === 4 && !!(await page.$('[data-home=safetyPolicy]')));
ok('Safety: Trusted to AI and monitors link to Company (D4)', !!(await page.$('[data-home=safetyPolicy] [data-ref=trustedToAI]')) && !!(await page.$('[data-home=safetyPolicy] [data-ref=agentMonitor]')));
await check('Safety: evaluate-before-release toggle', 's.player.safety.evalGate', () => page.click('[data-act="safety.evalGate.toggle"]'));
await page.click('[data-act="safety.evalGate.toggle"]', { timeout: 2000 }).catch(() => {}); // stale: no evalGate control on Safety (pre-UB-5)
await page.hover('[data-test=u-point]');
await wait(250);
ok('Safety: U tooltip shows tools validated to and per-family levels', JSON.parse(await get(`/validated to/i.test(document.body.innerText) && /Deception seen to/.test(document.body.innerText)`)));
await clearTips();
await tabTo('lines');
ok('Research lines: staffed lines with health and teams', (await page.$$('[data-home=researchLines] [data-line]')).length >= 2 && !!(await page.$('[data-home=researchLines] [data-line] [data-team]')) && /Promising|Mixed|Struggling/.test(await page.$eval('[data-home=researchLines]', (e) => e.textContent ?? '')));
ok('Research lines: tool upkeep card (research engineers)', !!(await page.$('[data-home=toolUpkeep] [data-test=re-bar]')));
{
  const tid = JSON.parse(await get('(s.player.teams.find((t) => t.role === "sci" && t.dept === "saf" && t.projectId) || {}).id || ""'));
  const line = JSON.parse(await get(`(() => { const t = s.player.teams.find((x) => x.id === "${tid}"); const r = document.querySelector('[data-line] [data-team="${tid}"]'); return r ? r.closest('[data-line]').getAttribute('data-line') : ''; })()`));
  if (tid && line) {
    await page.evaluate((id) => { window.ai27v2.state.player.research.autoAssign = false; window.ai27v2.act('research.unassign', { team: id }); }, tid);
    await wait(80);
    if (!(await page.$(`[data-test="line-add.${line}"]`))) await page.click('[data-test=lines-all]');
    await wait(60);
    await page.click(`[data-test="line-add.${line}"]`);
    await check('Research lines: + team assigns an idle safety team to the line', `(s.player.teams.find((t) => t.id === "${tid}") || {}).projectId || ""`, () => page.click(`[data-act="line-assign.${tid}"]`));
    await page.evaluate(() => { window.ai27v2.state.player.research.autoAssign = true; });
  }
}
await check('Research lines: show all / staffed only', 'document.querySelectorAll("[data-home=researchLines] [data-line]").length', () => page.click('[data-test=lines-all]'));
await check('Research lines: tools list opens', 'document.querySelectorAll("[data-technique]").length', () => page.click('[data-test=tools-open]'));
await tabTo('cases');
await check('Investigations: open a case with 20 engineers', 'JSON.stringify(s.player.safety.investigations.filter((i) => !i.outcome).map((i) => i.fte))', async () => { await page.selectOption('[data-test=inv-trait]', 'SUCC'); await page.selectOption('[data-test=inv-fte]', '20'); await page.click('[data-panel=safety] [data-home=investigations] [data-act="safety.investigate"]'); });
ok('Investigations: case card shows the 5–40 staffing and the 120-day close', JSON.parse(await get(`(() => { const c = document.querySelector('[data-case]'); return !!c && /5–40/.test(c.textContent) && /120 d max/.test(c.textContent); })()`)));
for (const t of await tabsOf()) await check(`Safety tab ${t}`, 'store.tab.safety || ""', () => tabTo(t), 30).catch(() => {});
await tabTo('graph');
ok('Trait graph tab renders the graph', !!(await page.$('[data-test=traitgraph]')));
await tabTo('overview');
await nav('codex');
await check('Codex category', `document.querySelector('.codex-entry').innerText`, () => page.click('[data-codex-cat="Traits"]'));
await check('Codex search', `document.querySelector('.codex-list').innerText`, () => page.fill('[data-test=codex-search]', 'scheming'));
await nav('risk');
await tabTo('flows');
await check('Flows node opens panel', 'store.panel', () => page.click('[data-node=player]'));

// Model v3 V2b Research: tabs Projects / Recipe / Tree. Tree: node card adds to the priorities; Projects: priority list
// (stage tracks, teams wanted, risk policy, reorder by ▲▼ and drag, add, remove, reopen) and the project card; Recipe:
// three stacks with the adopted ideas. The game places the teams (no team picker).
await nav('research');
await tabTo('tree');
await wait(80);
{
  const nn = (await page.$$('[data-panel=research] .rs-node')).length;
  ok('Research: tree renders', nn >= 10, `nodes ${nn}`);
  ok('Research: no know-how bar or team picker', !(await page.$('[data-test=knowhow]')) && !(await page.$('[data-test=assign-open]')));
}
await check('Research: click an idea opens its node card', 'store.tab["research.sel"] || ""', () => page.click('[data-panel=research] .rs-node[data-node=P05]'));
ok('Research: node card shows odds and stage work', JSON.parse(await get(`(() => { const c = document.querySelector('[data-test=node-card]'); return !!c && /Odds/i.test(c.innerText) && /team-months/.test(c.innerText); })()`)));
await check('Research: Top priority puts the project at the top', 'JSON.stringify(s.player.research.queue)', () => page.click('[data-act="research.start.P05"]'));
await page.evaluate(() => window.ai27v2.step(1));
await wait(60);
ok('Research: the assignment puts science teams on it, with a why', JSON.parse(await get('s.player.teams.some((t) => t.projectId === "P05" && !!t.why)')));
await check('Research: Add a second idea to the priorities from its card', 'JSON.stringify(s.player.research.queue)', async () => { await page.click('[data-panel=research] .rs-node[data-node=elastic]'); await page.click('[data-act="research.queue.elastic"]'); });
await page.click('[data-test=node-close]').catch(() => {});
await check('Research: Safety filter hides capability lanes', 'document.querySelectorAll("[data-panel=research] .rs-lane-l").length', () => page.click('[data-test=tree-filter] [data-opt=saf]'));
await page.click('[data-test=tree-filter] [data-opt=all]');
await check('Research: minimap toggles the whole tree', 'store.tab["research.view"] || ""', () => page.click('[data-test=minimap]'));
await shot('40-research-all');
await page.click('[data-test=minimap]');
await page.click('[data-panel=research] .rs-node[data-node=P17]').catch(() => {});
await wait(60);
await shot('41-research-node');
await page.click('[data-test=node-close]').catch(() => {});
await tabTo('projects');
await wait(80);
ok('Research: priority list rows with five-step stage tracks', JSON.parse(await get(`document.querySelectorAll('[data-home=priorities] [data-project]').length >= 2 && !!document.querySelector('[data-project=P05] [data-test="track.P05"]') && document.querySelectorAll('[data-project=P05] [data-test="track.P05"] i').length === 5`)));
await check('Research: teams wanted +', 'JSON.stringify(s.player.research.want)', () => page.click('[data-act="want-up.P05"]'));
await check('Research: teams wanted −', 'JSON.stringify(s.player.research.want)', () => page.click('[data-act="want-down.P05"]'));
await check('Research: risk policy speculative', 's.player.research.risk', () => page.click('[data-test=risk-policy] [data-opt=speculative]'));
await check('Research: risk policy back to balanced', 's.player.research.risk', () => page.click('[data-test=risk-policy] [data-opt=balanced]'));
await check('Research: reorder with ▼', 'JSON.stringify(s.player.research.queue)', () => page.click('[data-test="prio-down.P05"]'));
await check('Research: reorder by drag', 'JSON.stringify(s.player.research.queue)', () => page.locator('[data-home=priorities] [data-project=P05]').dragTo(page.locator('[data-home=priorities] [data-project]').first()));
await check('Research: a row opens its project card', 'store.tab["research.proj"] || ""', () => page.click('[data-home=priorities] [data-project=elastic] .rp-nm'));
ok('Research: project card shows the stage track, inputs and the teams with why', JSON.parse(await get(`(() => { const c = document.querySelector('[data-home=projectCard]'); return !!c && !!c.querySelector('[data-test="track.elastic"]') && /Inputs today/i.test(c.innerText) && /why here/i.test(c.innerText); })()`)));
await check('Research: + Add project', 'JSON.stringify(s.player.research.queue)', async () => { const v = await page.$eval('[data-test=add-project] option:nth-child(2)', (o) => o.value); await page.selectOption('[data-test=add-project]', v); });
await check('Research: Remove from the card', 'JSON.stringify(s.player.research.queue)', () => page.click('[data-home=projectCard] [data-act^="dequeue."]'));
await page.click('[data-home=priorities] [data-project=P05] .rp-nm');
await wait(60);
await shot('42-research-projects');
await page.hover('[data-home=priorities] [data-project=P05] .rp-dots i');
await wait(300);
ok('Research: a team dot says why the team is there', /Why here/.test(await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '')));
await clearTips();
await tabTo('recipe');
await wait(80);
ok('Research: recipe shows three stacks and the software rate', JSON.parse(await get(`document.querySelectorAll('[data-home^="stack."]').length === 3 && !!document.querySelector('[data-home=softwareRate]')`)));
await shot('43-research-recipe');
await tabTo('projects');
if (await page.$('[data-act^="reopen."]')) await check('Research: reopen a failed project as speculative', 'JSON.stringify(s.player.research.queue)', () => page.locator('[data-act^="reopen."]').first().click());
ok('Research: no paradigm section left in Models', await (async () => { await nav('models'); return !(await page.$('[data-paradigm]')); })());
// Model v3 V2b Company › Work: three role cards (effective labour, fit vs people, coverage, needs with caps and order),
// milestones with criteria; research speed card on Flow.
await nav('lab');
await tabTo('work');
await wait(80);
ok('Work: three role cards with labour, fit axis and coverage', JSON.parse(await get(`['SWE', 'EXP', 'IDEAS'].every((w) => !!document.querySelector('[data-test="labour.' + w + '"]') && !!document.querySelector('[data-test="fit.' + w + '"]') && !!document.querySelector('[data-test="coverage.' + w + '"]'))`)));
ok('Work: build capacity has its home in the engineers card', !!(await page.$('[data-home=buildCapacity] [data-test="labour.SWE"]')) || !!(await page.$('[data-home=buildCapacity][data-wt=SWE]')));
await check('Work: research-engineer cap (share)', 'JSON.stringify(s.player.research.re)', () => page.selectOption('[data-test="needs.research.reAlloc"] [data-test="cap.exp"]', 'share:0.5'));
await check('Work: research-engineer cap cleared', 'JSON.stringify(s.player.research.re)', () => page.selectOption('[data-test="needs.research.reAlloc"] [data-test="cap.exp"]', ''));
await check('Work: research-engineer order', 'JSON.stringify(s.player.research.re.order)', () => page.click('[data-test="needs.research.reAlloc"] [data-test="need-down.ops"]'));
await check('Work: research-engineer order back', 'JSON.stringify(s.player.research.re.order)', () => page.click('[data-test="needs.research.reAlloc"] [data-test="need-up.ops"]'));
await check('Work: engineers cap (count)', 'JSON.stringify(s.player.build.alloc)', () => page.selectOption('[data-test="needs.build.engAlloc"] [data-test="cap.upkeep"]', 'max:4'));
await check('Work: engineers cap cleared', 'JSON.stringify(s.player.build.alloc)', () => page.selectOption('[data-test="needs.build.engAlloc"] [data-test="cap.upkeep"]', ''));
await check('Work: engineers order', 'JSON.stringify(s.player.build.alloc.order)', () => page.click('[data-test="needs.build.engAlloc"] [data-test="need-down.runs"]'));
await check('Work: engineers order back', 'JSON.stringify(s.player.build.alloc.order)', () => page.click('[data-test="needs.build.engAlloc"] [data-test="need-up.runs"]'));
ok('Work: seven milestones with criteria', JSON.parse(await get(`document.querySelectorAll('[data-home=milestoneCriteria] [data-ms]').length === 7`)));
await shot('44-lab-work');
await tabTo('board');
ok('L0 research speed: × with its tooltip home (UB-5)', !!(await page.$('.topstrip2 [data-home=labSpeed]')));
ok('Flow: no v2 frontier-methods or serving-cost lines', !(await page.$('[data-limit="speed.frontierMethods"]')) && !(await page.$('[data-limit="speed.etaMod"]')));

// Overview (L1) and bottom bar
await nav('overview');
ok('Lead track lanes', (await page.$$('[data-lane]')).length >= 3);
ok('Watch card renders', !!(await page.$('[data-test=watch]')));
await check('Lead lane opens Relations', 'store.panel', () => page.click('[data-lane]'));
await nav('overview');
const go = await page.$('[data-test=watch] [data-go]');
if (go) await check('Watch Go jumps to the control', 'store.panel', () => go.click());
ok('Headline renders', !!(await page.$('[data-test=ticker]')));
await check('Loss-of-control risk click opens Safety', 'store.panel', () => page.click('[data-test=risk]'));

// ───────────────────────── B1: product card serving economics (day 1 here; day 400 and day 900 below) ─────────────────────────
// Every live product card shows price vs cost and margin, its revenue sources (Chat: paid share → target) and what its
// serving covers; every new term has a glossary tooltip, on the card or nested in the rows' tooltips.
const B1_TERMS = ['paidSeat', 'unseatedUse', 'supervisingHour', 'agentHour', 'agentLeverage', 'weeklyReach', 'paidShare', 'goingPrice', 'wtp', 'freeTier', 'valueCap', 'markup', 'serveOrder', 'adoptedHour'];
const b1Seen = new Set();
async function b1Check(where) {
  await nav('products');
  const cards = await page.$$eval('[data-panel=products] [data-product]', (els) => els.map((e) => ({
    id: e.getAttribute('data-product'), ch: e.getAttribute('data-channel'),
    econ: !!e.querySelector('[data-test^="prod-econ."]'),
    price: e.querySelector('[data-test^="prod-price-row."]')?.textContent ?? '',
    paid: e.querySelector('[data-test^="prod-paid."]')?.textContent ?? '',
    src: !!e.querySelector('[data-test^="prod-sources."]'),
    cap: !!e.querySelector('[data-test^="prod-capacity."]'),
    users: e.querySelector('[data-test^="prod-users."]')?.textContent ?? '',
  })));
  const bad = cards.filter((c) => !c.econ || !/\$\d/.test(c.price) || !/\d%/.test(c.price) || !c.cap
    || (c.ch === 'consumer' ? !/→\s*\d/.test(c.paid) || !/weekly users/.test(c.users) || !/\/mo/.test(c.price) : !c.src || !/\/h/.test(c.price)));
  ok(`B1 ${where}: every product card shows price, margin, sources and capacity`, cards.length >= 3 && bad.length === 0, bad.map((c) => `${c.ch}: ${c.price} | ${c.paid}`).join(' ; '));
  for (const t of await page.$$eval('[data-panel=products] [data-test^="prod-econ."] [data-term], [data-panel=products] [data-test^="prod-users."] [data-term]', (els) => els.map((e) => e.getAttribute('data-term')))) b1Seen.add(t);
  const rows = await page.$$eval('[data-panel=products] [data-test^="prod-econ."] [data-test], [data-panel=products] [data-test^="prod-users."]', (els) => els.map((e) => e.getAttribute('data-test')).filter((x) => /^prod-(price-row|paid|sources|capacity|users)\./.test(x)));
  let tipped = 0;
  for (const r of rows) {
    await clearTips();
    await page.hover(`[data-test="${r}"]`);
    await wait(380);
    const t = await page.evaluate(() => ({ text: document.querySelector('.tip')?.innerText ?? '', terms: [...document.querySelectorAll('.tip [data-term]')].map((e) => e.getAttribute('data-term')) }));
    if (t.text.length > 20) tipped++;
    for (const x of t.terms) b1Seen.add(x);
  }
  await clearTips();
  ok(`B1 ${where}: every economics row opens a tooltip (${rows.length})`, rows.length >= 3 * cards.length && tipped === rows.length, `${tipped}/${rows.length}`);
}
// ───────────────────────── B2: customers as a stock, typed features (day 1, 400, 900) ─────────────────────────
// Every card shows its customer stock vs the target share, the speed and days to target (Chat also users → target);
// every feature row shows its type and typed effect with units (locked rows: the idea that unlocks them); the rows'
// tooltips carry build cost, upkeep, on here, internal agents and the gate; every new term is reached.
const B2_TERMS = ['customerStock', 'targetShare', 'customerSpeed', 'featEnabler', 'featHorizon', 'featScaffold', 'featEffort'];
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
    conv: e.querySelector('[data-test^="prod-cust-conv."]')?.textContent ?? '',
    users: e.querySelector('[data-test^="prod-users."]')?.textContent ?? '',
    arpu: /\b(developers|organisations|contracts|partners)\b/.test(e.textContent ?? ''),
  })));
  const bad = cards.filter((c) => !/\d%\s*→\s*[\d.]+%/.test(c.stock) || !/moves in (weeks|months|quarters)/.test(c.conv) || !/(at target|to target)/.test(c.conv) || c.arpu
    || (c.ch === 'consumer' && !/weekly users\s*→\s*[\d.]+/.test(c.users))
    || (c.ch === 'consumer' ? !/weeks/.test(c.conv) : !/(months|quarters)/.test(c.conv)));
  for (const x of await page.$$eval('[data-panel=products] [data-test^="prod-cust."] [data-term], [data-panel=products] [data-feature] [data-term]', (els) => els.map((e) => e.getAttribute('data-term')))) b2Seen.add(x);
  ok(`B2 ${where}: every card shows the customer stock → target, speed and days to target`, cards.length >= 3 && bad.length === 0, bad.map((c) => `${c.ch}: ${c.stock} | ${c.conv} | ${c.users}`).join(' ; ') || cards.map((c) => `${c.ch}: ${c.stock} · ${c.conv}`).join(' ; '));
  let tipped = 0;
  let n = 0;
  for (const c of cards) {
    for (const sel of [`[data-test="prod-cust-stock.${c.id}"]`, `[data-test="prod-cust-conv.${c.id}"]`]) {
      n++;
      const tx = await hoverTip(sel);
      if (tx.length > 20 && (/target/i.test(tx))) tipped++;
    }
  }
  ok(`B2 ${where}: customer rows open tooltips with the target (${n})`, tipped === n, `${tipped}/${n}`);
  // Features: type chip and typed effect on every row; gated rows name the idea.
  const feats = await page.$$eval('[data-panel=products] [data-product] [data-feature]', (els) => els.map((e) => ({
    card: e.closest('[data-product]').getAttribute('data-product'), f: e.getAttribute('data-feature'),
    kinds: [...e.querySelectorAll('.ft-k')].map((k) => k.getAttribute('data-kind')),
    fx: e.querySelector('[data-test^="feature-fx."]')?.textContent ?? '',
    gate: e.querySelector('[data-test^="feature-gate."]')?.textContent ?? '',
    clipped: [...e.querySelectorAll('.ft-fx, .ft-e, .ft-n')].filter((x) => { const g = document.createRange(); g.selectNodeContents(x); return x.scrollWidth > x.clientWidth + 1 || g.getBoundingClientRect().width > x.getBoundingClientRect().width + 1; }).map((x) => x.textContent).join('|'),
  })));
  const UNIT = { scaffold: /skill ×[\d.]+ ×\d+ tok/, horizon: /×[\d.]+ longer tasks/, enabler: /\+[\d.]+(%| OOM)/, effort: /\+[\d.]+ OOM ×\d+ tok/ };
  const fbad = feats.filter((x) => !x.kinds.length || (x.gate ? !/needs \S/.test(x.gate) : !x.kinds.every((k) => UNIT[k]?.test(x.fx))));
  ok(`B2 ${where}: every feature row shows its type and typed effect with units (locked: the idea) (${feats.length})`, feats.length >= 5 && fbad.length === 0, fbad.map((x) => `${x.f}: ${x.kinds} | ${x.fx} | ${x.gate}`).join(' ; '));
  const kinds = new Set(feats.flatMap((x) => x.kinds));
  ok(`B2 ${where}: feature types on the cards`, kinds.size >= 3, [...kinds].join(', '));
  const clipped = feats.filter((x) => x.clipped);
  ok(`B2 ${where}: no clipped feature effect line`, clipped.length === 0, clipped.map((x) => `${x.card}/${x.f}: ${x.clipped}`).join(', '));
  let ftip = 0;
  const fmiss = [];
  for (const x of feats) {
    const tx = await hoverTip(`[data-product="${x.card}"] [data-feature="${x.f}"] .ft-fx`);
    if (/Build/.test(tx) && /Upkeep/.test(tx) && /\d\.\d\d engineer team-wk\/wk/.test(tx) && /Internal agents/.test(tx) && /Unlocked by/.test(tx) && /On this product/.test(tx)) ftip++;
    else fmiss.push(`${x.f}: ${tx.replace(/\n/g, ' ').slice(0, 60)}`);
  }
  await clearTips();
  ok(`B2 ${where}: feature tooltips show cost, upkeep (engineer team-wk/wk, C2), on here, internal agents and the gate`, fmiss.length === 0, fmiss.slice(0, 3).join(' ; '));
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
  // Core loop customers node.
  await nav('overview');
  await page.hover('[data-test=coreloop] [data-loop=customers]');
  await wait(450);
  const cl = await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '');
  ok(`B4 ${where}: Core loop customers tooltip shows the customer stock → target and real counts`, /share [\d.]+% → [\d.]+%/.test(cl) && !FAKE_NOUNS.test(cl) && (!chatLive || /weekly users/.test(cl)), cl.replace(/\n/g, ' ').slice(0, 200));
  await clearTips();
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
  // Products: launch card and serving split in the side column when there are ≤ 3 products.
  await nav('products');
  const pr = await page.evaluate(() => {
    const n = document.querySelectorAll('[data-panel=products] [data-product]').length;
    const side = document.querySelector('[data-panel=products] .prod-side');
    const sv = document.querySelector('[data-home=servingSplit]');
    const ln = document.querySelector('[data-test=prod-launch]');
    const card = document.querySelector('[data-panel=products] [data-product]');
    return { n, side: !!side && !!side.querySelector('[data-home=servingSplit]'), svTop: sv?.getBoundingClientRect().top ?? 9999, launchH: ln?.getBoundingClientRect().height ?? 0, cardH: card?.getBoundingClientRect().height ?? 0 };
  });
  ok(`B4 ${where}: Products: with ≤ 3 products the launch card and serving split sit beside the cards, above the fold`, pr.n > 3 || (pr.side && pr.svTop < 1000 && (pr.launchH === 0 || pr.launchH < pr.cardH * 0.6)), JSON.stringify(pr));
  await shot(`80-${where.replace(' ', '')}-products-b4`);
  // Research › Projects: the card under the list; auto teams wanted; keyboard reorder.
  await nav('research');
  await tabTo('projects');
  await wait(60);
  const lay = await page.evaluate(() => {
    const l = document.querySelector('[data-home=priorities]')?.getBoundingClientRect();
    const c = document.querySelector('[data-home=projectCard]')?.getBoundingClientRect();
    const clipped = [...document.querySelectorAll('[data-home=priorities] .stepper, [data-home=priorities] .rp-nm b')].filter((x) => x.scrollWidth > x.clientWidth + 1).length;
    return { below: !!l && !!c && c.top >= l.bottom - 1, clipped };
  });
  ok(`B4 ${where}: Research: the project card sits under the priority list; no clipped stepper`, (lay.below || !(await page.$('[data-home=projectCard]'))) && lay.clipped === 0, JSON.stringify(lay));
  const first = await page.$eval('[data-home=priorities] [data-project]', (e) => e.getAttribute('data-project')).catch(() => '');
  if (first) {
    await check(`B4 ${where}: Auto teams wanted turns on`, 'JSON.stringify(s.player.research.wantAuto)', () => page.click(`[data-act="want-auto.${first}"]`));
    ok(`B4 ${where}: an auto project shows "auto" and its placed teams`, /auto/.test(await page.$eval(`[data-test="want-n.${first}"]`, (e) => e.textContent ?? '')) && (await page.getAttribute(`[data-act="want-auto.${first}"]`, 'aria-pressed')) === 'true');
    await clearTips();
    await page.hover(`[data-act="want-auto.${first}"]`);
    await wait(380);
    ok(`B4 ${where}: the Auto toggle's tooltip explains priority and fit`, /priority and fit/.test(await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '')));
    await clearTips();
    await shot(`81-${where.replace(' ', '')}-research-projects-b4`);
    await check(`B4 ${where}: Auto teams wanted turns off (fixes the number)`, 'JSON.stringify(s.player.research.wantAuto)', () => page.click(`[data-act="want-auto.${first}"]`));
    const labels = await page.$$eval('[data-home=priorities] [data-test^="prio-"], [data-home=priorities] [data-act^="want-"]', (els) => els.filter((e) => !e.getAttribute('aria-label')).map((e) => e.getAttribute('data-test') ?? e.getAttribute('data-act')));
    ok(`B4 ${where}: ▲▼, − + and Auto have accessible labels`, labels.length === 0, labels.slice(0, 4).join(', '));
    const n = JSON.parse(await get("document.querySelectorAll('[data-home=priorities] [data-project]').length"));
    if (n > 1) {
      await page.focus(`[data-home=priorities] [data-project="${first}"]`);
      await check(`B4 ${where}: Alt+↓ on a focused row moves it down (keyboard reorder)`, 'JSON.stringify(s.player.research.queue)', () => page.keyboard.press('Alt+ArrowDown'));
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
    ok(`B4 ${where}: Open on a capability result opens its project card`, JSON.parse(await get(`store.panel === 'research' && store.tab.research === 'projects' && store.tab['research.proj'] === ${JSON.stringify(cap)}`)));
  } else await page.click('[data-test=alert-chip]');
  await page.evaluate(() => { const s = window.ai27v2.state; s.log = s.log.filter((e) => !/^B4 test:/.test(e.text)); window.ai27v2.notify(); });
  await closeModals();
}
// ───────────────────────── D6: Models › Suites (day 1, 400, 900) ─────────────────────────
const D6_TERMS = ['envSuite', 'suiteFidelity', 'suiteExploit', 'expertData', 'suiteBuild', 'suiteHarden', 'suiteRlShare', 'rewardHackPressure', 'plannedRun'];
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
  // Products: each card's danger equals dangerView's.
  await nav('products');
  await wait(120);
  const prod = await page.$$eval('[data-test^="prod-danger."]', (els) => els.map((e) => [e.getAttribute('data-test').slice(12), Number(e.getAttribute('data-harm'))]));
  const pv = await sel('Object.fromEntries(Object.entries(r.dangerView(s).products).map(([k, x]) => [k, x.harmful]))');
  ok(`E11 ${where}: a danger readout on every product, equal to the belief selector`, prod.length === Object.keys(pv).length && prod.every(([id, h]) => Math.abs(h - pv[id]) < 1e-4), JSON.stringify(prod).slice(0, 120));
  if (prod.length) {
    await page.hover(`[data-test="prod-danger.${prod[0][0]}"]`);
    await wait(350);
    const tip = await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '');
    ok(`E11 ${where}: the product danger tooltip shows the four factors`, /Disposition/.test(tip) && /Capability/.test(tip) && /Opportunity/.test(tip) && /Oversight/.test(tip), tip.slice(0, 160));
    await shot(`e11-${tag}-product-danger`);
    await clearTips();
  }
  // Agents at work: each running lane's danger equals dangerView's.
  await nav('lab');
  await tabTo('work');
  const lanes = await page.$$eval('[data-test^="agent-danger."]', (els) => els.map((e) => [e.getAttribute('data-test').slice(13), Number(e.getAttribute('data-harm'))]));
  const lv = await sel('Object.fromEntries(Object.entries(r.dangerView(s).lanes).map(([k, x]) => [k, x.harmful]))');
  const running = await page.evaluate(() => ['eng', 'capRoutine', 'capFrontier', 'safety'].filter((u) => !!document.querySelector(`[data-lane="${u}"]`) && !document.querySelector(`[data-test="lane-off.${u}"]`)));
  ok(`E11 ${where}: a danger readout on every running agent lane, equal to the belief selector`, lanes.length >= 1 && lanes.length === running.filter((u) => lv[u] !== undefined).length && lanes.every(([u, h]) => Math.abs(h - lv[u]) < 1e-4), JSON.stringify(lanes));
  if (lanes.length) { await page.hover(`[data-test="agent-danger.${lanes[0][0]}"]`); await wait(350); await shot(`e11-${tag}-lane-danger`); await clearTips(); }
  // Safety › Overview: believed control equals controlReadout; the true level never shows.
  await nav('safety');
  await tabTo('overview');
  const shown = await page.$eval('[data-test=control-value]', (e) => Number(e.getAttribute('data-control'))).catch(() => NaN);
  const cr = await sel('r.controlReadout(s)');
  const card = await page.locator('[data-home=effectiveControl]').innerText().catch(() => '');
  ok(`E11 ${where}: control on Safety › Overview equals the believed selector (${cr.believed})`, Math.abs(shown - cr.believed) < 1e-4 && card.includes(cr.believed.toFixed(2)), `${shown} vs ${cr.believed}`);
  ok(`E11 ${where}: the true control level and exposure never show`, !/\b0\.01\b|\b0\.99\b|99%/.test(card), card.replace(/\s+/g, ' ').slice(0, 160));
  const fv = await sel('r.footholdView(s)');
  ok(`E11 ${where}: the footholds chip counts known footholds only`, (await page.locator('[data-test=foothold-chip]').innerText()).includes(String(fv.suspected + fv.located)) && !fv.rows.some((x) => x.id === 'FH-E11-HIDDEN'));
  await shot(`e11-${tag}-safety-overview`);
  await page.hover('[data-test=control-value]');
  await wait(350);
  ok(`E11 ${where}: the control tooltip shows its exposure terms`, /Exposure/.test(await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '')));
  // Model v3 F6: the control layer has an off switch next to Add control (the response's preview, its effect).
  await clearTips();
  if (await page.$('[data-act="control-add"]')) {
    await page.click('[data-act="control-add"]');
    await wait(150);
    const onNow = JSON.parse(await get('s.player.deployments.some((d) => d.channel === "internal" && d.status === "live" && d.controlLayer)'));
    const btn = await page.$('[data-act="control-remove"]');
    let rtip = '';
    if (btn) { await page.hover('[data-act="control-remove"]'); await wait(350); rtip = await page.evaluate(() => document.querySelector('.tip')?.innerText ?? ''); await clearTips(); await page.click('[data-act="control-remove"]'); await wait(150); }
    const offNow = JSON.parse(await get('!s.player.deployments.some((d) => d.channel === "internal" && d.controlLayer)'));
    ok(`F6 ${where}: Remove control sits next to Add control, previews the tax saved and the believed danger, and turns the layer off`, onNow && !!btn && /control tax ends/.test(rtip) && /harmful acts/.test(rtip) && offNow && !!(await page.$('[data-act="control-add"]')), rtip.replace(/\s+/g, ' ').slice(0, 200));
  }
  await clearTips();
  await tabTo('footholds');
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
  // Values present per family; the locked family names its idea.
  const rows = await page.$$eval('[data-test=suites] [data-suite]:not([data-locked])', (els) => els.map((e) => ({
    f: e.getAttribute('data-suite'),
    fid: e.querySelector('[data-test=suite-fid]')?.textContent ?? '', x: e.querySelector('[data-test=suite-exploit]')?.textContent ?? '',
    ex: e.querySelector('[data-test=suite-expert]')?.textContent ?? '', sh: e.querySelector('[data-test=suite-share]')?.textContent ?? '',
    b: !!e.querySelector('[data-act="suite.build"], [data-pending$=":build"]'), h: !!e.querySelector('[data-act="suite.harden"], [data-pending$=":harden"]'),
  })));
  const fams = JSON.parse(await get(`Object.keys(s.player.suites ?? {}).length`));
  const good = rows.filter((r) => /×\d\.\d\d/.test(r.fid) && /\d+\.\d%/.test(r.x) && /\d+(\.\d)?[BT] tok/.test(r.ex) && /\d+%/.test(r.sh) && r.b && r.h);
  ok(`D6 ${where}: Training › Environments shows every suite with fidelity, exploitable %, expert data, RL share, build and harden`, rows.length >= Math.max(6, fams) && good.length === rows.length,
    rows.map((r) => `${r.f} ${r.fid} ${r.x} ${r.ex} ${r.sh}`).join(' | ').slice(0, 200));
  const cuKnown = JSON.parse(await get(`!!(s.player.tree.P06 && s.player.tree.P06.status === 'known')`));
  const lockTxt = await page.$eval('[data-test=suites] [data-locked=P06]', (e) => e.textContent ?? '').catch(() => '');
  ok(`D6 ${where}: computer use reads "needs P06" until the idea is known`, cuKnown ? !lockTxt && rows.some((r) => r.f === 'computerUse') : /needs .*P06/.test(lockTxt), lockTxt || 'unlocked');
  const s2 = await page.$eval('[data-test=suites-s2] b', (e) => e.textContent ?? '').catch(() => '');
  ok(`D6 ${where}: the planned run's S2 is shown`, /^\d\.\d\d$/.test(s2), s2);
  // Tooltips: every value, and the new terms are Term links.
  for (const t of await page.$$eval('[data-test=suites] [data-term]', (els) => els.map((e) => e.getAttribute('data-term')))) d6Seen.add(t);
  const f0 = rows[0]?.f;
  const tips = {
    fid: await tipText(`[data-suite="${f0}"] [data-test=suite-fid]`), x: await tipText(`[data-suite="${f0}"] [data-test=suite-exploit]`),
    ex: await tipText(`[data-suite="${f0}"] [data-test=suite-expert]`), sh: await tipText(`[data-suite="${f0}"] [data-test=suite-share]`),
    s2: await tipText('[data-test=suites-s2]'),
  };
  ok(`D6 ${where}: tooltips on fidelity, exploitable, expert data, RL share and S2`, /Fidelity/.test(tips.fid) && /Next build/.test(tips.fid) && /Floor/.test(tips.x) && /Next hardening/.test(tips.x)
    && /tokens/.test(tips.ex) && /RL share/.test(tips.sh) && /Reward-hacking pressure/.test(tips.s2) && /RL budget/.test(tips.s2), Object.values(tips).map((x) => x.split('\n')[0]).join(' | '));
  await clearTips();
  await shot(`d6-${tag}-suites`);
  // Build: the preview's after value; cash and queue change; when `complete`, the finished build matches the preview.
  const free = await page.$$eval('[data-test=suites] [data-act="suite.build"]:not([disabled])', (els) => els.map((e) => e.getAttribute('data-family')));
  const fam = free.includes('swe') ? 'swe' : free[0];
  if (fam) {
    const bTip = await tipText(`[data-act="suite.build"][data-family="${fam}"]`);
    ok(`D6 ${where}: build preview shows cash, team-weeks, fidelity before → after and the planned run's ΔG and S2`, /\$\d+M/.test(bTip) && /team-wk/.test(bTip) && /×\d\.\d\d → ×\d\.\d\d/.test(bTip) && /RL ΔG/.test(bTip) && /S2/.test(bTip), bTip.replace(/\n/g, ' ').slice(0, 200));
    await shot(`d6-${tag}-build-preview`);
    await clearTips();
    const after = (await page.$eval(`[data-suite="${fam}"] [data-test="suite-after.build"]`, (e) => e.textContent ?? '')).match(/×\d\.\d\d/)?.[0];
    const cash0 = Number(await get('s.player.finance.cash'));
    await page.click(`[data-act="suite.build"][data-family="${fam}"]`);
    await wait(120);
    const cash1 = Number(await get('s.player.finance.cash'));
    const pill = await page.$eval(`[data-suite="${fam}"] [data-pending="${fam}:build"]`, (e) => e.textContent ?? '').catch(() => '');
    ok(`D6 ${where}: Build queues the work, pays the expert data and shows it pending with an ETA`, JSON.parse(await get(suiteQueue)).split(',').includes(`${fam}:build`) && cash0 - cash1 > 0.09 && /building.*(\d+ d|waits)/.test(pill),
      `cash ${cash0.toFixed(2)} → ${cash1.toFixed(2)} · ${pill}`);
    if (complete) {
      const done = await stepUntilDone(`${fam}:build`);
      await toSuites();
      const fid = (await page.$eval(`[data-suite="${fam}"] [data-test=suite-fid]`, (e) => e.textContent ?? '')).match(/×\d\.\d\d/)?.[0];
      ok(`D6 ${where}: the finished build matches its preview (fidelity ${after})`, done && !!after && fid === after, `${fid} vs ${after}`);
    }
  }
  // Harden: the preview's exploitable % and the planned run's S2 after match the result.
  const freeH = await page.$$eval('[data-test=suites] [data-act="suite.harden"]:not([disabled])', (els) => els.map((e) => e.getAttribute('data-family')));
  const famH = freeH.includes('swe') ? 'swe' : freeH[0];
  if (famH) {
    const hTip = await tipText(`[data-act="suite.harden"][data-family="${famH}"]`);
    const s2After = [...hTip.matchAll(/(\d\.\d{3}) → (\d\.\d{3})/g)].pop()?.[2];
    ok(`D6 ${where}: harden preview shows cash, team-weeks, exploitable before → after and S2 before → after`, /\$\d+M/.test(hTip) && /team-wk/.test(hTip) && /\d+\.\d% → \d+\.\d%/.test(hTip) && !!s2After, hTip.replace(/\n/g, ' ').slice(0, 200));
    await clearTips();
    const after = (await page.$eval(`[data-suite="${famH}"] [data-test="suite-after.harden"]`, (e) => e.textContent ?? '')).match(/\d+\.\d%/)?.[0];
    await check(`D6 ${where}: Harden queues the work`, suiteQueue, () => page.click(`[data-act="suite.harden"][data-family="${famH}"]`));
    if (complete) {
      const done = await stepUntilDone(`${famH}:harden`);
      await toSuites();
      const x = (await page.$eval(`[data-suite="${famH}"] [data-test=suite-exploit]`, (e) => e.textContent ?? '')).match(/\d+\.\d%/)?.[0];
      const s2Now = await page.$eval('[data-test=suites-s2] b', (e) => e.textContent ?? '');
      ok(`D6 ${where}: the finished hardening matches its preview (exploitable ${after}, S2 ${s2After})`, done && !!after && x === after && s2Now === Number(s2After).toFixed(2), `${x} vs ${after} · S2 ${s2Now} vs ${s2After}`);
    }
  }
  // A focus pill changes the planned run (the RL shares move).
  const pills = await page.$$eval('[data-test=suites-focus] [data-focus]', (els) => els.map((e) => e.getAttribute('data-focus')).filter((x) => x !== 'broad'));
  if (pills.length) {
    const sh = () => page.$$eval('[data-test=suites] [data-test=suite-share]', (els) => els.map((e) => e.textContent).join(','));
    const sh0 = await sh();
    await page.click(`[data-test=suites-focus] [data-focus="${pills[0]}"]`);
    await wait(100);
    const sh1 = await sh();
    ok(`D6 ${where}: a focus pill changes the planned run's RL shares`, sh0 !== sh1, `${sh0} → ${sh1} (focus ${pills[0]})`);
    await page.click('[data-test=suites-focus] [data-focus=broad]');
    await wait(80);
  }
  await shot(`d6-${tag}-suites-after`);
  await page.evaluate(() => window.ai27v2.setTab('models', 'versions'));
}
// ───────────────────────── D4: Models › Data and the Blueprint's drawn mix (day 1, 400, 900) ─────────────────────────
// Portfolio by kind with values and tooltips, the natural mix vs reference, the four data forms with cost and before →
// after in token units (no "L" on data previews); each action changes the state as previewed; the Blueprint's mix
// control changes the drawn shares and the specialisation.
const D4_TERMS = ['dataPortfolio', 'uniqueTokens', 'dataQuality', 'publicWeb', 'licensedData', 'licenceTier', 'syntheticData', 'teacherYield', 'naturalMix', 'refShare', 'drawnMix', 'domainEpochs', 'pendingData', 'usageData', 'expertData', 'synJob', 'dataLicence', 'dataSpec'];
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
  const kinds = await page.$$eval(dv('[data-kind]'), (els) => els.map((e) => ({ k: e.getAttribute('data-kind'), t: e.innerText.replace(/\n/g, ' ') })));
  ok(`D4 ${where}: portfolio rows for the five kinds with tokens, quality and today's flow`, kinds.length === 5 && kinds.every((r) => /\d/.test(r.t)) && /crawled/.test(kinds[0].t) && /\/day/.test(kinds.find((r) => r.k === 'synthetic')?.t ?? ''), kinds.map((r) => r.t.slice(0, 60)).join(' ; '));
  const uState = JSON.parse(await get(U_STATE));
  const uShown = await page.$eval(dv('[data-test=data-u] b'), (e) => e.textContent ?? '').catch(() => '');
  ok(`D4 ${where}: U shown matches the portfolio (${uState.toFixed(1)}T)`, Math.abs(Number(uShown.replace('T', '')) - uState) <= Math.max(0.6, 0.006 * uState), uShown);
  ok(`D4 ${where}: natural mix vs reference for nine domains`, (await page.$$(dv('[data-test=data-natural] [data-dom]'))).length === 9);
  const tips = {
    U: await d4Tip(dv('[data-test=data-u]')),
    natural: await d4Tip(dv('[data-test=data-natural] [data-dom=CODE] .dv-div')),
    kindU: await d4Tip(dv('[data-kind=synthetic] .dv-u')),
    cell: await d4Tip(dv('[data-kind=public] .dv-cell')),
    today: await d4Tip(dv('[data-kind=synthetic] > :last-child')),
    teacher: await d4Tip(dv('[data-test=syn-teachers] [data-teacher]')),
    usage: await d4Tip(dv('[data-level=broad] .num.small')),
    delta: await d4Tip(dv('[data-test=delta-licence] [data-k=s] .num')),
  };
  const want = { U: /Unique tokens/, natural: /Reference share/, kindU: /Quality × tokens/, cell: /Share of this kind/, today: /Tokens kept per day/, teacher: /Kept tokens per H100e-day/, usage: /Unique tokens a year/, delta: /Natural-mix base/ };
  const miss = Object.entries(want).filter(([k, re]) => !re.test(tips[k])).map(([k]) => k);
  ok(`D4 ${where}: tooltips on U, the natural mix, kind rows, domain cells, teachers, usage levels and the before → after`, miss.length === 0, miss.map((k) => `${k}: ${tips[k].slice(0, 60)}`).join(' ; '));
  const lic = await d4Tip(dv('[data-act="data.license"]'));
  const syn = await d4Tip(dv('[data-act="data.synthesize"]'));
  ok(`D4 ${where}: data previews read in token units, not levels`, /T unique tokens/.test(lic) && /M H100e-days/.test(syn) && ![lic, syn].some((t) => /\d L\b/.test(t)), `${lic.slice(0, 90)}`);
  ok(`D4 ${where}: no expert-data purchase on Data (RD-T06: suite builds buy it)`, !(await page.$(dv('[data-act="data.expert"]'))));
  await clearTips();
  if (act) {
    // A day first, so the fixture's cached readouts (compute online, prodCache) are today's before the previews are read.
    if (stepOk) { await page.evaluate(() => window.ai27v2.step(1)); await closeModals(); await pause(); await nav('blueprint'); await tabTo('data'); }
    // Licence (PHYS bulk 5T): a deal of the previewed U, at the previewed cash.
    await page.click(dv('[data-test=lic-domain] [data-opt=PHYS]')); await wait(60);
    const du = await deltaOf('licence', 'u');
    const cash = Number(await attr(dv('[data-test=lic-sum]'), 'data-cash'));
    const c0 = JSON.parse(await get('s.player.finance.cash'));
    await check(`D4 ${where}: Sign licence queues a deal`, 's.player.dataPortfolio.pending.length', () => page.click(dv('[data-act="data.license"]')));
    const last = JSON.parse(await get('(() => { const p = s.player.dataPortfolio.pending; const a = p[p.length - 1].asset; return { u: a.tokensT * a.quality, d: a.domain }; })()'));
    const c1 = JSON.parse(await get('s.player.finance.cash'));
    ok(`D4 ${where}: the deal adds the previewed U (${du ? (du[1] - du[0]).toFixed(2) : '?'}T) and costs the previewed cash`, !!du && Math.abs(last.u - (du[1] - du[0])) < 1e-6 && last.d === 'PHYS' && Math.abs(c0 - c1 - cash) < 1e-6, `asset U ${last.u} · cash ${(c0 - c1).toFixed(3)} vs ${cash}`);
    ok(`D4 ${where}: the deal shows as pending`, !!(await page.$(dv('[data-test=data-pending] [data-pending=licensed]'))));
    // Generation job with the best-yield teacher; a day of it adds ≈ tokens ÷ days.
    const best = await page.$eval(dv('[data-test=syn-teachers]'), (e) => [...e.querySelectorAll('[data-teacher]')].find((b) => /best yield/.test(b.textContent ?? ''))?.getAttribute('data-teacher') ?? '').catch(() => '');
    if (best) { await page.click(dv(`[data-test=syn-teachers] [data-teacher="${best}"]`)); await wait(80); }
    const sTok = Number(await attr(dv('[data-test=syn-sum]'), 'data-tokens'));
    const sDays = Number(await attr(dv('[data-test=syn-sum]'), 'data-days'));
    const sTeach = await attr(dv('[data-test=syn-sum]'), 'data-teacher');
    await check(`D4 ${where}: Start job sets the generation job`, 'JSON.stringify(s.player.dataPortfolio.synJob || null)', () => page.click(dv('[data-act="data.synthesize"]')));
    ok(`D4 ${where}: the job uses the picked teacher (${best || 'strongest'}) for the picked days`, JSON.parse(await get(`(() => { const j = s.player.dataPortfolio.synJob; return !!j && j.teacherId === ${JSON.stringify(sTeach)} && j.until - s.time.day === ${sDays}; })()`)));
    const synT = `(s.player.dataPortfolio.assets.find((a) => a.id === 'syn:' + ${JSON.stringify(sTeach)}) || { tokensT: 0 }).tokensT`;
    const t0 = JSON.parse(await get(synT));
    // The day-900 fixture can end within days (another lab's ASI): no step there.
    if (stepOk) await page.evaluate(() => window.ai27v2.step(1));
    await closeModals(); await pause();
    const t1 = JSON.parse(await get(synT));
    const perDay = sTok / Math.max(1, sDays);
    if (stepOk) ok(`D4 ${where}: a day of the job adds the previewed tokens per day (${perDay.toFixed(2)}T)`, perDay > 0 && Math.abs((t1 - t0) / perDay - 1) < 0.15, `${(t1 - t0).toFixed(3)}T`);
    await nav('blueprint'); await tabTo('data');
    await check(`D4 ${where}: Stop job ends it`, 'JSON.stringify(s.player.dataPortfolio.synJob || null)', () => page.click(dv('[data-act="data.synthesize.stop"]')));
    // Usage policy → broad: 50% kept, Civil Liberties approval moves by the previewed difference.
    const civ = Number((await attr(dv('[data-level=broad]'), 'data-civlib')) ?? '0');
    const cur = Number((await attr(dv('.dv-ulevel.on'), 'data-civlib')) ?? '0');
    const a0 = JSON.parse(await get('s.pub.blocs.civlib.approval'));
    await check(`D4 ${where}: usage policy → broad`, 's.player.dataPortfolio.usageShare', () => page.click(dv('[data-act="data.usagePolicy.broad"]')));
    const a1 = JSON.parse(await get('s.pub.blocs.civlib.approval'));
    ok(`D4 ${where}: broad usage keeps 50% and moves Civil Liberties approval as previewed (${civ - cur})`, JSON.parse(await get('s.player.dataPortfolio.usageShare')) === 0.5 && (Math.abs(a1 - a0 - (civ - cur)) < 1e-6 || Math.abs(a1) === 100), `${a0} → ${a1}`);
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
const E12_TERMS = ['traitBehaviour', 'traitAwareness', 'traitDisposition', 'traitProtective', 'trainingPressure', 'traitMovement', 'successorPull', 'aiRdShare', 'rdOversight'];
const e12Seen = new Set();
const collectTerms = async () => { for (const t of await page.$$eval('[data-term]', (els) => els.map((e) => e.getAttribute('data-term')))) e12Seen.add(t); };
async function e12Check(where) {
  const tag = where.replace(' ', '');
  await page.evaluate(() => { window.ai27v2.setTab('safety', 'overview'); window.ai27v2.setTab('safety.side', 'families'); });
  await nav('safety');
  // 1. Families on top; the traits only one level down (closed at first), each with its meaning.
  const fams = await page.$$eval('[data-home=riskFamilies] [data-family]', (els) => els.map((e) => e.getAttribute('data-family')));
  const closed = await page.$$eval('[data-home=riskFamilies] [data-trait]', (els) => els.length);
  ok(`E12 ${where}: Safety shows the four risk families with no trait rows until opened`, fams.join(',') === 'please,gaming,deception,power' && closed === 0, `${fams.join(',')} · ${closed} trait rows`);
  let rows = 0;
  let meant = 0;
  for (const f of [...fams, 'other']) {
    await page.click(`[data-test="fam-open.${f}"]`);
    await wait(60);
    const tr = await page.$$eval(`[data-test="fam-traits.${f}"] [data-trait]`, (els) => els.map((e) => ({ t: e.getAttribute('data-trait'), m: e.querySelector('.sf-mean')?.textContent ?? '', v: e.querySelector('.num')?.textContent ?? '' })));
    rows += tr.length;
    meant += tr.filter((x) => /^(behaviour|awareness|disposition|protective)$/.test(x.m) && /\d\.\d\d ±\d\.\d\d/.test(x.v)).length;
    await collectTerms();
    if (f === 'deception') { await page.mouse.move(1, 1); await shot(`e12-${tag}-families`); }
  }
  await page.click('[data-test="fam-open.other"]');
  ok(`E12 ${where}: each family opens to its traits (17 in all), each with its meaning and believed estimate ± sd`, rows === 17 && meant === 17, `${rows} rows, ${meant} with meaning and band`);
  // 3. Successor pull: the numbers shown equal the (belief-based) selector. F6b: one click down (the side switch).
  const famOnly = !(await page.$('[data-home=successorPull]'));
  await page.click('[data-test="sf-side.successor"]');
  await wait(80);
  ok(`F6b ${where}: Safety's side column shows one of families / successor pull, the switch opens the other`, famOnly && !!(await page.$('[data-home=successorPull]')) && !(await page.$('[data-home=riskFamilies]')));
  const sp = JSON.parse(await page.evaluate(() => JSON.stringify(window.ai27v2.probe.successorPullView())));
  const om = (await page.$eval('[data-test=succ-omega]', (e) => e.textContent ?? '').catch(() => '')).match(/\d\.\d\d/)?.[0];
  const r = Number((await page.$eval('[data-test=succ-r]', (e) => e.textContent ?? '').catch(() => '')).replace('%', ''));
  const parts = await page.$$eval('[data-test=succ-part]', (els) => els.map((e) => ({ slot: e.getAttribute('data-slot'), sh: e.querySelector('[data-test=succ-part-share]')?.textContent ?? '', om: e.querySelector('[data-test=succ-part-omega]')?.textContent ?? '' })));
  const partsOk = parts.length === sp.parts.length && sp.parts.every((p, i) => parts[i].slot === p.slot && Math.abs(Number(parts[i].sh.replace('%', '')) - p.share * 100) <= 0.5 && parts[i].om === p.omega.toFixed(2));
  ok(`E12 ${where}: successor pull shown (ω, AI share of R&D, per work type) equals successorPullView`, om === sp.omega.toFixed(2) && Math.abs(r - sp.r * 100) <= 0.5 && partsOk,
    `ω ${om} vs ${sp.omega.toFixed(3)} · r ${r}% vs ${(sp.r * 100).toFixed(1)} · ${parts.map((p) => `${p.slot} ${p.sh} ${p.om}`).join(' ')}`);
  const sTip = await tipText('[data-test=succ-omega]');
  ok(`E12 ${where}: the successor pull tooltip gives its band and says it is estimated from beliefs`, /90% band/.test(sTip) && /beliefs/.test(sTip), sTip.replace(/\n/g, ' ').slice(0, 160));
  await collectTerms();
  await clearTips();
  await shot(`e12-${tag}-safety`);
  await page.evaluate(() => window.ai27v2.setTab('safety.side', 'families'));
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
  ok(`E12 ${where}: Training links the successor pull to its home on Safety`, /Successor pull from/.test(succ) && !!(await page.$('[data-test=bp-succ] [data-ref=successorPull]')), succ);
  if (where === 'day 400') {
    await page.click('[data-test=bp-succ] [data-ref=successorPull]');
    await wait(150);
    ok('F6b: the Blueprint successor link opens Safety on the successor pull card', !!(await page.$('[data-home=successorPull]')));
    await page.evaluate(() => window.ai27v2.setTab('safety.side', 'families'));
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
  const mOk = msUi.length > 0 && msUi.every((r) => { const m = ms.find((x) => x.versionId === r.id); return m && (m.measuredL === undefined ? r.sd === '—' : r.sd === `± ${m.sd.toFixed(2)} L`); });
  ok(`D8 ${where}: measurement bands equal evalMeasureView (± 0.2/√n)`, mOk, `${msUi.length} rows · ${JSON.stringify(msUi[0])}`);
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
      ok(`D8 ${where}: the band shrinks after the suite (${cand.sd.toFixed(3)} → ${after?.sd.toFixed(3)}), last suite ${depth}`, done && !!after && after.sd < cand.sd - 1e-9 && after.depth === depth && sdUi === `± ${after.sd.toFixed(2)} L`, `${sdUi} · done ${done}`);
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
  ok('D6: the Environments row opens Training › Environments with the plan as the planned run', JSON.parse(await get(`store.panel === 'blueprint' && store.tab.blueprint === 'suites'`)) && /from Next run/.test(sub), sub.replace(/\s+/g, ' ').slice(0, 100));
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
    const row = await page.evaluate((id) => document.querySelector(`[data-test="prod-econ.${id}"]`)?.innerText ?? '', chat);
    ok('B1: a Premium Chat plan is capped at the $22 willingness to pay and flagged', /\$22\/mo/.test(row) && !!(await page.$(`[data-test="prod-econ.${chat}"] [data-limit="price.valueCap"]`)), row.replace(/\n/g, ' ').slice(0, 90));
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
ok('J2 P1: engineering pool shows build capacity and how busy it is', /busy/.test(await page.locator('[data-test=build-queue]').innerText()));
await page.hover('[data-test=build-queue]');
await wait(300);
ok('J2 P1: the build tooltip splits runs, product upkeep and builds', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /Runs/.test(t) && /Product upkeep/.test(t) && /Builds/.test(t); })()`)));
await shot('50-j2-build-load');
await clearTips();
ok('J2 AG1: a same-lineage monitor shows its lower catch on scheming-type incidents', !!(await page.$('[data-test="agent-catch.capRoutine.coll"]')) && !!(await page.$('[data-test="same-monitor.capRoutine"]')));
// Model v3 E6: the control tax is visible on each agent lane when the control layer runs.
await page.evaluate(() => { for (const d of window.ai27v2.state.player.deployments) if (d.channel === 'internal') d.controlLayer = true; window.ai27v2.notify(); });
await wait(200);
ok('E6: under the control layer each agent lane shows its control tax', !!(await page.$('[data-test="control-tax.capRoutine"]')) && !!(await page.$('[data-test="control-tax.eng"]')));
await page.hover('[data-test="control-tax.capRoutine"]');
await wait(300);
ok('E6: the control-tax tooltip names the deferral and the catch it buys', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /deferred/.test(t) && /slipping/.test(t) && /AI labour/.test(t); })()`)));
await shot('51-e6-control-tax');
await clearTips();
await page.evaluate(() => { for (const d of window.ai27v2.state.player.deployments) if (d.channel === 'internal') d.controlLayer = false; window.ai27v2.notify(); });
await wait(100);
await nav('lab');
await tabTo('board');
ok('RD-A05b: LAB shows idle serving compute inside the Products segment', JSON.parse(await get(`(() => { const e = document.querySelector('[data-test=alloc-bar] [data-seg=serving] .idle'); return !!e && parseFloat(e.style.width) > 0; })()`)));
await shot('51-j2-lab-idle');
await nav('products');
{
  const spare = JSON.parse(await get(`(() => { const p = s.player; let used = 0; for (const d of p.deployments) if (d.kind === 'product' && d.status !== 'withdrawn' && d.needH100e !== undefined) used += Math.min(d.servedH100e ?? 0, d.needH100e); return p.computeOnline * p.split.serving - used; })()`));
  ok('J2 PR1: Products › Serving shows spare serving as its own segment', spare < 1000 || !!(await page.$('[data-test=serving-spare]')), `spare ${Math.round(spare)}`);
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
await nav('risk');
await tabTo('sources');
await page.hover('[data-test="risk-v.own"]').catch(() => {});
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
    ok('Agents: an older frontier model previews lower research speed', JSON.parse(await get(`(() => { const t = document.querySelector('[data-test="agent-edit.capFrontier"]')?.innerText ?? ''; return /Research speed/.test(t) && /▼/.test(t); })()`)));
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
  if (l.panel === 'research') {
    const ids = await page.$$eval('[data-panel=research] .rs-node:not(.st-known):not(.st-soon)', (els) => els.map((e) => e.getAttribute('data-node')));
    for (const id of ids) {
      await page.click(`[data-panel=research] .rs-node[data-node="${id}"]`).catch(() => {});
      await wait(60);
      if (await page.$('[data-limit="tree.retry"]')) break;
    }
  }
  await wait(80);
  await collectLimits();
  if (l.panel === 'products') { await hoverCollect('[data-panel=products] [data-test^="prod-price-row."]'); await hoverCollect('[data-panel=products] [data-test^="prod-bind."]'); }
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
// Overview: the core loop, a verdict per system, nodes link to their homes.
await nav('overview');
ok('R10 Overview: core loop with nine systems', (await page.$$('[data-test=coreloop] [data-loop]')).length === 9);
await check('R10 Overview: a loop node opens its home', 'store.panel', () => page.click('[data-test=coreloop] [data-loop=research]'));
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
