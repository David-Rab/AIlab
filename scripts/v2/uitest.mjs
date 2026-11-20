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
const nav = async (id) => { await closeModals(); await clearTips(); await page.click(`[data-nav=${id}]`); await wait(100); };
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
ok('L0: race, risk, cash, lead in the top strip', !!(await page.$('[data-test=race]')) && !!(await page.$('[data-test=risk]')) && !!(await page.$('[data-test=cash]')) && !!(await page.$('[data-test=lead]')));
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
await check('Blueprint: pick a training card (light RL budget)', 'document.querySelector("[data-panel=blueprint]").innerText', () => page.click('[data-panel=blueprint] [data-opt="rlBudget:light"]'));
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
// Advance a little so deployments/finance have content.
await page.evaluate(() => window.ai27v2.step(20));
await closeModals();
const PANELS = ['finance', 'overview', 'company', 'compute', 'research', 'models', 'blueprint', 'products', 'safety', 'relations', 'world', 'risk', 'codex'];
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
// R7: the compute split lives on Compute › Split (one home per control).
await nav('compute');
await tabTo('split');
await check('Split slider moves draft', `document.querySelector('[data-panel=compute]').innerText`, () => setSlider(page.locator('[data-panel=compute] .split-row input[type=range]').first(), 0.6));
await check('Apply split', 'JSON.stringify(s.player.split)', () => page.click('[data-act=setSplit]'));
ok('Research mix chart and response curves render', !!(await page.$('[data-test=mix-chart] path')) && (await page.$$('[data-test=response-charts] .rc-mult')).length === 4);
await check('Research mix: manual + slider + apply', 'JSON.stringify([s.player.researchManual, s.player.split.experiments])', async () => {
  await page.click('#ctl-split-experiments .seg-btn:has-text("Manual")');
  await setSlider(page.locator('#ctl-split-experiments input[type=range]'), 0.3);
  await page.click('[data-act=setSplit]');
});
await check('Research mix: back to auto', 'JSON.stringify(s.player.researchManual)', async () => {
  await page.click('#ctl-split-experiments .seg-btn:has-text("Auto")');
  await page.click('[data-act=setSplit]');
});
// R3 People: teams by role, keep-hiring targets, offers, filling queue, move and let go.
await nav('company');
await tabTo('people');
ok('Teams card: one science card per science team', JSON.parse(await get(`document.querySelectorAll('[data-panel=company] .sci-card').length === s.player.teams.filter((t) => t.role === 'sci').length`)));
ok('Teams card: piles for engineers and both research-engineering departments', JSON.parse(await get(`['eng', 're.cap', 're.saf'].every((k) => !!document.querySelector('[data-panel=company] [data-pile="' + k + '"]'))`)));
await check('Keep hiring: + raises the research-engineering target', 's.player.hiring.targets["re.cap"]', () => page.click('[data-act="teams.target.up.re.cap"]'));
await check('Offer: Hire queues the team', 'JSON.stringify([s.player.hiring.candidates.length, s.player.hiring.filling.length])', () => page.click('[data-panel=company] .offer [data-act="teams.hire"]'));
await check('Filling: cancel removes a queued team', 's.player.hiring.filling.length', () => page.click('[data-panel=company] [data-act="teams.cancel"]'));
await check('Move: safety research-engineering team to capabilities', 'JSON.stringify([s.player.teams.filter((t) => t.role === "re" && t.dept === "saf").length, Math.round(s.player.morale.safety)])', () => page.click('[data-pile="re.saf"] [data-act="teams.move"]'));
ok('Move: safety morale paid', JSON.parse(await get('s.causes.byKey["morale.safety"] ? s.causes.byKey["morale.safety"].some((c) => /moved/.test(c.source)) : false')));
await check('Let go: a science team', 's.player.teams.length', () => page.click('[data-panel=company] .sci-card [data-act="teams.release"]'));
await shot('20-company-people');
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
await shot('21-company-agents');
// B4: one WSL target range for the slider and the engine.
await tabTo('security');
ok('Security target slider range matches the engine (2–5)', JSON.parse(await get(`(() => { const r = document.querySelector('[data-panel=company] [data-home=wsl] input[type=range]'); return !!r && r.min === '2' && r.max === '5'; })()`)));
await check('Security target: slider at the floor + Set', 's.player.security.target', async () => {
  await setSlider(page.locator('[data-panel=company] [data-home=wsl] input[type=range]'), 2);
  await page.click('[data-panel=company] [data-act=SEC_TARGET]');
});
ok('Security target set to the slider value', JSON.parse(await get('s.player.security.target === 2')));
await tabTo('flow');
ok('Company flow renders', !!(await page.$('[data-home=computeFlow]')) && !!(await page.$('[data-home=M]')));
await check('Flow pool click goes to the split (Compute)', 'JSON.stringify([store.panel, store.tab.compute])', () => page.click('[data-pool=experiments]'));
await nav('finance');
await page.click('[data-tabs=finance] [data-tab=cash]'); await wait(80); // J1 F3: Finance has tabs
await check('Raise ask slider', `document.querySelector('[data-act="fin.raise"]').innerText`, () => setSlider(page.locator('[data-panel=finance] input[type=range]').first(), 3.3));
await page.click('[data-tabs=finance] [data-tab=deals]'); await wait(80);
await check('Debt kind', `document.querySelector('[data-panel=finance]').innerHTML`, () => page.click('[data-panel=finance] [data-debt-kind=gpuTerm]'));
// R5 blueprint: size card with its limit tiles (before → after on a size change), slot table by layer with locked
// cards linking to Research, predicted and plan cards; run queue with actual share and ETA; spare-training policy.
await nav('blueprint');
await page.click('[data-panel=blueprint] [data-bp-kind=base]').catch(() => {});
await wait(80);
ok('Blueprint: size card with 7 limit tiles', (await page.$$('[data-panel=blueprint] [data-tile]')).length === 7);
ok('Blueprint: slot table by layer (Backbone, Training, Scaffold)', JSON.parse(await get(`(() => { const t = document.querySelector('[data-home=blueprintSlots]')?.innerText ?? ''; return /BACKBONE/.test(t) && /TRAINING/.test(t) && /SCAFFOLD/.test(t); })()`)));
// Model v3 V1: size = active parameters (√2 snaps) × tokens per parameter. Two snaps up = 2× parameters = 4× FLOP.
const paramSnap = (k) => `(() => { const b = [...document.querySelectorAll('[data-panel=blueprint] [data-test=bp-params]')]; const i = b.findIndex((x) => x.classList.contains('on')); b[Math.max(0, Math.min(b.length - 1, i + ${k}))].click(); return true; })()`;
await check('Blueprint: 2× active parameters changes the wall time', `document.querySelector('[data-panel=blueprint] [data-tile=wall]').innerText`, () => page.evaluate(paramSnap(2)));
ok('Blueprint: tiles show before → after on a size change', (await page.$$('[data-panel=blueprint] .bp-lim.chg .was')).length >= 4, `${(await page.$$('[data-panel=blueprint] .bp-lim.chg .was')).length} tiles`);
ok('Blueprint: 2× active parameters = 2× serving FLOP per token', JSON.parse(await get(`(() => { const t = document.querySelector('[data-panel=blueprint] [data-tile=serve] .lv').innerText; const m = t.match(/([0-9.]+)e(\\d+)\\s*→\\s*([0-9.]+)e(\\d+)/); return !!m && Math.abs((Number(m[3]) * 10 ** Number(m[4])) / (Number(m[1]) * 10 ** Number(m[2])) - 2) < 0.1; })()`)));
ok('Blueprint: 2× active parameters = 4× FLOP', JSON.parse(await get(`(() => { const t = document.querySelector('[data-panel=blueprint] [data-tile=flop] .lv').innerText; const m = t.match(/([0-9.]+)e(\\d+)\\s*→\\s*([0-9.]+)e(\\d+)/); return !!m && Math.abs((Number(m[3]) * 10 ** Number(m[4])) / (Number(m[1]) * 10 ** Number(m[2])) - 4) < 0.4; })()`)));
await clearTips();
await shot('43-blueprint-x4');
await page.hover('[data-panel=blueprint] [data-tile=data] .lv');
await wait(500);
ok('Blueprint: limit tile tooltip states its rule', JSON.parse(await get(`/epochs|Muennighoff/.test(document.querySelector('.tip')?.innerText ?? '')`)));
await clearTips();
await check('Blueprint: tokens per parameter snap', `document.querySelector('[data-panel=blueprint] [data-tile=serve]').innerText`, () => page.click('[data-panel=blueprint] [data-test=bp-tpp][data-size="20"]'));
await page.evaluate(paramSnap(-2));
ok("Blueprint: locked card names its idea", await page.$eval(`[data-panel=blueprint] [data-opt="shape:latent"]`, (b) => b.classList.contains('locked') && !!b.dataset.node && b.innerText.length > 12));
await check("Blueprint: architecture dense", `document.querySelector("[data-panel=blueprint]").innerHTML`, () => page.click(`[data-panel=blueprint] [data-opt="shape:dense"]`));
// Model v3 V2: overtraining is 2025 public knowledge (★): no snap is locked; the latent shape stays behind its idea (P17).
ok("Blueprint: overtraining is known at the start (200 tokens per parameter not locked)", JSON.parse(await get(`(() => { const b = document.querySelector('[data-panel=blueprint] [data-test=bp-tpp][data-size="200"]'); return !!b && !b.classList.contains('locked'); })()`)));
await check('Blueprint: locked card opens Research on its idea', `store.panel + ':' + (store.tab['research.sel'] || '')`, () => page.click('[data-panel=blueprint] [data-opt="shape:latent"]'));
ok('Blueprint: Research shows the idea card', !!(await page.$('[data-test=node-card][data-card=P17]')));
await page.click('[data-test=node-close]').catch(() => {});
await nav('blueprint');
await page.click('[data-panel=blueprint] [data-bp-kind=base]').catch(() => {});
await page.click('[data-panel=blueprint] [data-opt="shape:dense"]');
await check('Blueprint: pool share pill', `document.querySelector('[data-panel=blueprint] [data-home=runPlan]').innerText`, () => page.click('[data-panel=blueprint] [data-pool="0.8"]'));
await check('Blueprint: save', 'localStorage.getItem("ai27.v2.runTemplates")', () => page.click('[data-test=bp-save]'));
await check('Launch base run', `s.player.models.runs.filter(r => r.kind === 'base').length`, () => page.click('[data-act=launchBase]'));
await nav('models');
{
  const rq = JSON.parse(await get(`(() => { const q = document.querySelector('[data-home=runQueue]'); return [!!q && q.querySelectorAll('[data-test=run-share]').length >= 1 && q.innerText.includes(' · '), (q?.innerText ?? store.panel).slice(0, 160), s.player.policies.spareTraining]; })()`));
  ok('Run queue: actual share and ETA per run', rq[0], rq[1] + ' | spare ' + rq[2]);
}
await check('Run queue: − lowers a pool share', 'JSON.stringify(s.player.models.runs.map((r) => r.poolShare))', () => page.locator('[data-act^="run-share-dn."]:not([disabled])').first().click());
ok('Run queue: spare row links to the policy on the split', !!(await page.$('[data-home=runQueue] [data-run=spare] [data-ref=spareTraining]')));
await nav('compute');
await tabTo('split');
{
  const use = JSON.parse(await get('s.player.policies.spareTraining'));
  ok('Split: spare training shows the policy in use', !!(await page.$(`[data-home=spareTraining] [data-test="spare-on.${use}"]`)), use);
  await check('Split: spare training switches use (effect on the button)', 's.player.policies.spareTraining', () => page.click('[data-home=spareTraining] [data-act^="spare."]'));
  await check('Split: spare training switches back', 's.player.policies.spareTraining', () => page.click('[data-home=spareTraining] [data-act^="spare."]'));
}
await nav('company');
await tabTo('work');
ok('Company: engineers show the build queue', !!(await page.$('[data-panel=company] [data-test=build-queue]')));
// R3 keep-hiring policy (needs a week; run after the run-designer checks so the time step does not change them).
await page.evaluate(() => window.ai27v2.step(7));
await closeModals();
await pause();
ok('Keep hiring: after a week the policy has the target covered (teams + queued)', JSON.parse(await get(`(() => { const k = (t) => t.role === 'eng' ? 'eng' : t.role + '.' + t.dept; const n = [...s.player.teams, ...s.player.hiring.filling].filter((t) => k(t) === 're.cap').length; return n >= s.player.hiring.targets['re.cap']; })()`)));
await nav('company');
await tabTo('people');
await check('Keep hiring: − lowers the target', 's.player.hiring.targets["re.cap"]', () => page.click('[data-act="teams.target.down.re.cap"]'));
await closeModals();
// Split floors are gone: a zero training share applies (with a warning first) and running runs show as paused.
await nav('compute');
await tabTo('split');
await setSlider(page.locator('#ctl-split-training input[type=range]').first(), 0);
await wait(60);
ok('Split: zero training warns before apply', !!(await page.$('[data-test=split-warn]')));
await check('Split: zero training share applies (no rejection)', 'JSON.stringify(s.player.split.training < 1e-6)', () => page.click('[data-act=setSplit]'));
await nav('models');
ok('Run queue: paused, no training compute', ((await page.$eval('[data-test=run-stall]', (e) => e.textContent).catch(() => '')) ?? '').includes('no training compute'));
await nav('compute');
await tabTo('split');
await page.click('[data-act="splitPreset.reference"]');
await closeModals();
await nav('models');
const vids = JSON.parse(await get('s.player.models.versions.map(v => v.id)'));
if (vids.length > 1) await check('Select version in lineage', 'store.sel.versionId', () => page.click(`[data-version="${vids[0]}"]`));
// ── Products (R6): cards, live edit with before → after preview, features, settings, Auto serving, Agents gate. ──
await nav('products');
ok('Products: one card per live product', (await page.$$('[data-panel=products] [data-product]')).length >= 3);
// B5 / R6: deep think is a locked option with its reason until its idea and feature exist.
if (!JSON.parse(await get(`s.player.features.includes('deepThink')`))) {
  ok('Products: deep think locked with its reason', await page.$eval('[data-panel=products] [data-test^=prod-effort] [data-opt=deep]', (b) => b.disabled && (b.getAttribute('data-locked') ?? '').length > 5).catch(() => false));
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
ok('Products: serving split bar by product', (await page.$$('[data-panel=products] [data-test=serving-bar] [data-serve]')).length >= 3);
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
await page.click('[data-act="safety.evalGate.toggle"]');
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
await nav('company');
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
await shot('44-company-work');
await tabTo('flow');
ok('Flow: research speed vs leader day 0, what binds, the unit project inputs', !!(await page.$('[data-home=M] [data-test=speed-rel]')) && !!(await page.$('[data-home=M] [data-test=speed-bound]')) && !!(await page.$('[data-home=M] [data-test=speed-mix]')));
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
await check('Race meter click opens Safety overview', 'store.panel + store.tab.safety', () => page.click('[data-test=race]'));

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
  const UNIT = { scaffold: /\+[\d.]+ OOM ×\d+ tok/, horizon: /×[\d.]+ longer tasks/, enabler: /\+[\d.]+(%| OOM)/, effort: /\+[\d.]+ OOM ×\d+ tok/ };
  const fbad = feats.filter((x) => !x.kinds.length || (x.gate ? !/needs \S/.test(x.gate) : !x.kinds.every((k) => UNIT[k]?.test(x.fx))));
  ok(`B2 ${where}: every feature row shows its type and typed effect with units (locked: the idea) (${feats.length})`, feats.length >= 5 && fbad.length === 0, fbad.map((x) => `${x.f}: ${x.kinds} | ${x.fx} | ${x.gate}`).join(' ; '));
  const kinds = new Set(feats.flatMap((x) => x.kinds));
  ok(`B2 ${where}: feature types on the cards`, kinds.size >= 3, [...kinds].join(', '));
  const clipped = feats.filter((x) => x.clipped);
  ok(`B2 ${where}: no clipped feature effect line`, clipped.length === 0, clipped.map((x) => `${x.card}/${x.f}: ${x.clipped}`).join(', '));
  let ftip = 0;
  const fmiss = [];
  for (const x of feats.filter((y) => y.f !== 'sectorPacks')) {
    const tx = await hoverTip(`[data-product="${x.card}"] [data-feature="${x.f}"] .ft-fx`);
    if (/Build/.test(tx) && /Upkeep/.test(tx) && /Internal agents/.test(tx) && /Unlocked by/.test(tx) && /On this product/.test(tx)) ftip++;
    else fmiss.push(`${x.f}: ${tx.replace(/\n/g, ' ').slice(0, 60)}`);
  }
  await clearTips();
  ok(`B2 ${where}: feature tooltips show cost, upkeep, on here, internal agents and the gate`, fmiss.length === 0, fmiss.slice(0, 3).join(' ; '));
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
  // Top strip revenue tooltip.
  await page.hover('[data-test=revenue]');
  await wait(450);
  const rev = await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '');
  const chatLive = JSON.parse(await get(`s.player.deployments.some((d) => d.channel === 'consumer' && d.status === 'live')`));
  ok(`B4 ${where}: revenue tooltip shows real customers (users · paying, seats or share → target), no revenue ÷ ARPU counts`,
    !FAKE_NOUNS.test(rev) && (!chatLive || /weekly users · [\d.]+[KMB]? paying/.test(rev)) && /(paid seats|share [\d.]+% → [\d.]+%)/.test(rev), rev.replace(/\n/g, ' ').slice(0, 220));
  await clearTips();
  // Core loop customers node.
  await nav('overview');
  await page.hover('[data-test=coreloop] [data-loop=customers]');
  await wait(450);
  const cl = await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '');
  ok(`B4 ${where}: Core loop customers tooltip shows the customer stock → target and real counts`, /share [\d.]+% → [\d.]+%/.test(cl) && !FAKE_NOUNS.test(cl) && (!chatLive || /weekly users/.test(cl)), cl.replace(/\n/g, ' ').slice(0, 200));
  await clearTips();
  // Blueprint serving tile and Models card: FLOP per token and cost per hour of use.
  await nav('blueprint');
  const tile = await page.evaluate(() => document.querySelector('[data-panel=blueprint] [data-tile=serve]')?.innerText ?? '');
  ok(`B4 ${where}: Blueprint serving tile shows FLOP per token and cost per hour of use`, /\de\d+/.test(tile) && /FLOP\/tok/.test(tile) && /(\$[\d.]+|[\d.]+¢)\/h( · today)?/.test(tile), tile.replace(/\n/g, ' '));
  await page.hover('[data-panel=blueprint] [data-tile=serve] .lv');
  await wait(400);
  const tt = await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '');
  ok(`B4 ${where}: serving tile tooltip: cost per hour of use, per agent-hour, $ per H100e-hour`, /Cost per hour of use/.test(tt) && /Cost per agent-hour/.test(tt) && /per H100e-hour/.test(tt), tt.replace(/\n/g, ' ').slice(0, 160));
  await clearTips();
  const bpText = await page.locator('[data-panel=blueprint]').innerText();
  await nav('models');
  const mText = await page.locator('[data-panel=models]').innerText();
  ok(`B4 ${where}: no relative "serve cost" on Blueprint or Models; the model card shows FLOP per token and $/h`, !/serve cost/i.test(bpText + mText) && /FLOP\/tok · (\$[\d.]+|[\d.]+¢)\/h/.test(mText), (mText.match(/Serving[^\n]*/) ?? [''])[0]);
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
await page.evaluate(() => { const st = window.ai27v2; st.start({ ...st.draftSetup, tutorial: false, seed: 2027, companyName: 'OpenBrain' }); });
await wait(150);
await page.evaluate(() => window.ai27v2.step(1));
await closeModals();
await pause();
await b1Check('day 1');
await b2Check('day 1');
await b3Check('day 1', '29-day1-world-sectors');
await b4Check('day 1');
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
await shot('27-day400-products-b2');
const fx9 = readFileSync(path.resolve('scripts/v2/fixtures/day900.json'), 'utf8');
await page.evaluate((j) => window.ai27v2.importJson(j), fx9);
await page.evaluate(() => { window.ai27v2.state.setup.tutorial = false; window.ai27v2.notify(); });
await b1Check('day 900');
await b2Check('day 900');
await b3Check('day 900', '29-day900-world-sectors');
await b4Check('day 900');
await shot('28-day900-products-b2');
{
  const miss = B1_TERMS.filter((t) => !b1Seen.has(t));
  ok(`B1: every new term has a tooltip on the product cards (${B1_TERMS.length})`, miss.length === 0, miss.join(', '));
  const miss2 = B2_TERMS.filter((t) => !b2Seen.has(t));
  ok(`B2: every new term has a tooltip on the product cards (${B2_TERMS.length})`, miss2.length === 0, miss2.join(', '));
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
ok('J1 B1: blueprint layer note is not squeezed (one line)', await page.evaluate(() => { const e = document.querySelector('.bp-grp .bp-rebuild'); return !!e && e.getBoundingClientRect().height < 24; }));
ok('J1 B2: every card line shows its own effect (no "ref" on alternatives)', await page.evaluate(() => {
  const lines = [...document.querySelectorAll('.bp-line[data-line]')];
  return lines.length > 4 && lines.some((l) => !l.classList.contains('sel') && /[+−]\d/.test(l.textContent ?? ''));
}));
await nav('finance');
await page.click('[data-tabs=finance] [data-tab=cash]'); await wait(80);
ok('J1 F1: why cash moved counts days, not the last 40 postings', await page.evaluate(() => { const r = [...document.querySelectorAll('[data-home=cashCauses] .cbar-lbl')].map((x) => x.textContent ?? ''); const m = r.map((x) => Number((x.match(/×(\d+)/) ?? [])[1] ?? 0)); return Math.max(0, ...m) >= 28; }));
ok('J1 F3: Finance opens on cash flow, history and the raise; the rest on tabs', (await page.$$('[data-tabs=finance] [data-tab]')).length >= 3 && !(await page.$('[data-home=ledger]')));
await nav('relations');
ok('J1 RL1: Retire stands apart behind a confirm', !!(await page.$('[data-test=retire-open]')) && !(await page.$('.catalog [data-act=RETIRE]')));
ok('J1 RL2: no security actions in the Relations catalogue', !(await page.$('[data-panel=relations] [data-act^="SEC_"]')));
await nav('models');
ok('J1 M4: a best badge per variant in the lineage', (await page.$$('[data-test=best-badge]')).length >= 1);
ok('J1 M5: runs are named by their target', !(await page.locator('[data-panel=models]').innerText()).match(/\b(post|base|distill) \d+ (post|base|distill)\b/));
await nav('compute');
await tabTo('overview');
await wait(200);
ok('J1 C1: order, build and rent show before → after (cash, runway)', await page.evaluate(() => ['cmp.orderStandard', 'cmp.newSite', 'cmp.cloudContract'].every((id) => /cash.*→.*runway.*→/s.test(document.querySelector(`[data-test="preview.${id}"]`)?.textContent ?? ''))));
// J2: engineers' load, spare serving, days cut, same-lineage monitors, risk lever what-ifs, launches on the build queue.
await nav('company');
await tabTo('work');
ok('J2 P1: engineering pool shows build capacity and how busy it is', /busy/.test(await page.locator('[data-test=build-queue]').innerText()));
await page.hover('[data-test=build-queue]');
await wait(300);
ok('J2 P1: the build tooltip splits runs, product upkeep and builds', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /Runs/.test(t) && /Product upkeep/.test(t) && /Builds/.test(t); })()`)));
await shot('50-j2-build-load');
await clearTips();
await tabTo('people');
ok('J2 AG1: a same-lineage monitor shows its lower catch on scheming-type incidents', !!(await page.$('[data-test="agent-catch.capRoutine.coll"]')) && !!(await page.$('[data-test="same-monitor.capRoutine"]')));
await nav('compute');
await tabTo('split');
ok('J2 PR1: Compute › Split is the home of the spare-serving policy', !!(await page.$('[data-home=spareServing]')));
await check('J2 PR1: spare serving policy switches', 's.player.policies.spareServing', () => page.click('[data-home=spareServing] [data-act^="spare-serving."]'), 200);
await shot('51-j2-split-spare');
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
await page.hover('[data-test=race]');
await wait(500);
await shot('32-day900-hover-race');
await clearTips();
await page.hover('[data-test=cash]');
await wait(500);
await shot('33-day900-hover-cash');
await clearTips();
// R7: the model picker's before → after preview on a lane (frontier research on an older model: taste and speed fall).
await nav('company');
await tabTo('people');
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
for (const start of ['spinout', 'challenger']) {
  const fxs = readFileSync(`scripts/v2/fixtures/start-${start}-day400.json`, 'utf8');
  await page.evaluate((j) => window.ai27v2.importJson(j), fxs);
  await page.evaluate(() => { window.ai27v2.state.setup.tutorial = false; window.ai27v2.notify(); });
  await closeModals();
  ok(`${start} fixture loads (day 400)`, (await get('s.setup.start')) === `"${start}"` && (await get('s.time.day')) === '400');
  for (const id of ['overview', 'company', 'models', 'products', 'finance']) {
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
await nav('company');
await tabTo('flow');
await collectLimits();
ok('R10 challenger: research speed shows knowledge diffusion', limitSeen.has('speed.diffusion'));
await shot('70-challenger-speed-limits');
await page.evaluate((j) => window.ai27v2.importJson(j), fx9);
await page.evaluate(() => {
  const st = window.ai27v2;
  const s = st.state;
  s.setup.tutorial = false;
  s.flags.paused = true;
  const inc = s.player.safety.incidents.find((i) => i.status === 'open');
  if (inc) { inc.exposure = 'customer'; inc.publicTimerDays = 9; }
  // A capacity-bound product (model v3 V3: the day-900 fixture's serving is no longer short).
  for (const k of ['consumer', 'sector']) if (s.world.fx.capPenalty[k] < 0.01) s.world.fx.capPenalty[k] = 0.2;
  st.notify();
});
await closeModals();
await page.evaluate(() => window.ai27v2.act('safety.investigate', { trait: 'SUCC', fte: 20 }));
for (const l of LIMIT_DEFS.filter((x) => x.panel !== 'codex')) {
  if (limitSeen.has(l.id)) continue;
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
await nav('company');
await tabTo('flow');
await shot('71-day900-speed-limits');
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
// Top strip: revenue only, users in its tooltip; U with "validated to" in the race tooltip.
ok('R10 top strip: revenue chip is the revenue home', !!(await page.$('.topstrip2 [data-test=revenue] [data-home=revenueRun]')) && !(await page.$('main.center [data-home=revenueRun]')));
await page.hover('[data-test=revenue]');
await wait(450);
ok('R10 top strip: revenue tooltip lists products and weekly users', /weekly users/i.test(await page.evaluate(() => document.body.innerText)));
await shot('73-hover-revenue');
await clearTips();
await page.hover('[data-test=race]');
await wait(450);
ok('R10 top strip: race tooltip shows tools validated to', !!(await page.$('[data-test=validated-to]')));
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
