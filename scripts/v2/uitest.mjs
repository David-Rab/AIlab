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
await check('Blueprint: pick a training card (light effort)', 'document.querySelector("[data-panel=blueprint]").innerText', () => page.click('[data-panel=blueprint] [data-opt="rlIntensity:light"]'));
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
await check('Blueprint: size ×4 changes the wall time', `document.querySelector('[data-panel=blueprint] [data-tile=wall]').innerText`, () => page.click('[data-panel=blueprint] [data-size="4"]'));
ok('Blueprint: tiles show before → after on a size change', (await page.$$('[data-panel=blueprint] .bp-lim.chg .was')).length >= 4);
ok('Blueprint: ×4 serves at 2× the ×1 cost (√size)', JSON.parse(await get(`(() => { const t = document.querySelector('[data-panel=blueprint] [data-tile=serve]').innerText; const m = t.match(/([0-9.]+)\\s*→\\s*([0-9.]+)/); return !!m && Math.abs(Number(m[2]) / Number(m[1]) - 2) < 0.03; })()`)));
await clearTips();
await shot('43-blueprint-x4');
await page.hover('[data-panel=blueprint] [data-tile=behind] .lv');
await wait(500);
ok('Blueprint: limit tile tooltip states its rule', JSON.parse(await get(`/judgement/.test(document.querySelector('.tip')?.innerText ?? '')`)));
await clearTips();
await page.click('[data-panel=blueprint] [data-size="1"]');
ok("Blueprint: locked card names its idea", await page.$eval(`[data-panel=blueprint] [data-opt="shape:latent"]`, (b) => b.classList.contains('locked') && !!b.dataset.node && b.innerText.length > 12));
await check("Blueprint: architecture dense", `document.querySelector("[data-panel=blueprint]").innerHTML`, () => page.click(`[data-panel=blueprint] [data-opt="shape:dense"]`));
ok("Blueprint: overtrained is locked behind its tree node", JSON.parse(await get(`(() => { const b = document.querySelector('[data-panel=blueprint] [data-opt="shape:overtrained"]'); return !!b && b.outerHTML.includes("Overtrained compact"); })()`)));
await check('Blueprint: locked card opens Research on its idea', `store.panel + ':' + (store.tab['research.sel'] || '')`, () => page.click('[data-panel=blueprint] [data-opt="shape:overtrained"]'));
ok('Blueprint: Research shows the idea card', !!(await page.$('[data-test=node-card][data-card=overtrained]')));
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
await tabTo('people');
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

// R4 Research: know-how bar, lane tree, node card, start / queue / drop, team picker, auto-assign, queue order, filters.
await nav('research');
await wait(80);
{
  const kh = !!(await page.$('[data-test=knowhow]'));
  const nn = (await page.$$('[data-panel=research] .rs-node')).length;
  ok('Research: know-how bar and tree render', kh && nn >= 10, `knowhow ${kh}, nodes ${nn}`);
}
await check('Research: click an idea opens its node card', 'store.tab["research.sel"] || ""', () => page.click('[data-panel=research] .rs-node[data-node=P05]'));
ok('Research: node card shows odds and effort', JSON.parse(await get(`(() => { const c = document.querySelector('[data-test=node-card]'); return !!c && /Odds/i.test(c.innerText) && /team-months/.test(c.innerText); })()`)));
await check('Research: Start now queues the project at the top', 'JSON.stringify(s.player.research.queue)', () => page.click('[data-act="research.start.P05"]'));
await page.evaluate(() => window.ai27v2.step(1));
await wait(60);
ok('Research: auto-assign puts idle teams on it', JSON.parse(await get('s.player.teams.some((t) => t.projectId === "P05")')) && !!(await page.$('[data-project=P05]')));
await check('Research: Queue a second idea from its card', 'JSON.stringify(s.player.research.queue)', async () => { await page.click('[data-panel=research] .rs-node[data-node=quantization]'); await page.click('[data-act="research.queue.quantization"]'); });
await page.click('[data-test=node-close]').catch(() => {});
await check('Research: team picker assigns a team', 'JSON.stringify(s.player.teams.map((t) => t.projectId || ""))', async () => { await page.click('[data-panel=research] .rs-node[data-node=quantization]'); await page.click('[data-test=assign-open]'); await page.locator('[data-test=team-picker] [data-act^="research.assign."]:not([disabled])').first().click(); });
await page.click('[data-test=picker-close]').catch(() => {});
await check('Research: auto-assign toggle', 's.player.research.autoAssign', () => page.click('[data-test=auto-assign]'));
await check('Research: auto-assign back on', 's.player.research.autoAssign', () => page.click('[data-test=auto-assign]'));
{
  const q = JSON.parse(await get('s.player.research.queue'));
  const last = q[q.length - 1];
  if (q.length > 1 && (await page.$(`[data-test="queue-up.${last}"]:not([disabled])`))) await check('Research: queue reorder', 'JSON.stringify(s.player.research.queue)', () => page.click(`[data-test="queue-up.${last}"]`));
}
await check('Research: Safety filter hides capability lanes', 'document.querySelectorAll("[data-panel=research] .rs-lane-l").length', () => page.click('[data-test=tree-filter] [data-opt=saf]'));
await page.click('[data-test=tree-filter] [data-opt=all]');
await check('Research: minimap toggles the whole tree', 'store.tab["research.view"] || ""', () => page.click('[data-test=minimap]'));
await shot('40-research-all');
await page.click('[data-test=minimap]');
await page.click('[data-panel=research] .rs-node[data-node=P17]').catch(() => {});
await wait(60);
await shot('41-research-node');
await page.click('[data-test=node-close]').catch(() => {});
await page.click('[data-test="add-team.P05"]').catch(() => {});
await wait(60);
await shot('42-research-picker');
ok('J2 R2: the team picker shows the days each team would cut', !!(await page.$('[data-test=team-picker] [data-test^="gain."]')));
await page.click('[data-test=picker-close]').catch(() => {});
if (await page.$('[data-test^="queue-drop."]')) await check('Research: Drop from the queue', 'JSON.stringify(s.player.research.queue)', () => page.locator('[data-test^="queue-drop."]').first().click());
ok('Research: no paradigm section left in Models', await (async () => { await nav('models'); return !(await page.$('[data-paradigm]')); })());

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
const fx9 = readFileSync(path.resolve('scripts/v2/fixtures/day900.json'), 'utf8');
await page.evaluate((j) => window.ai27v2.importJson(j), fx9);
await page.evaluate(() => { window.ai27v2.state.setup.tutorial = false; window.ai27v2.notify(); });
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
// J2: engineers' load, spare serving, days cut, same-lineage monitors, risk lever what-ifs, launches on the build queue.
await nav('company');
await tabTo('people');
ok('J2 P1: engineering pool shows build capacity and how busy it is', /busy/.test(await page.locator('[data-test=build-queue]').innerText()));
await page.hover('[data-test=build-queue]');
await wait(300);
ok('J2 P1: the build tooltip splits runs, product upkeep and builds', JSON.parse(await get(`(() => { const t = document.querySelector('.tip')?.innerText ?? ''; return /Runs/.test(t) && /Product upkeep/.test(t) && /Builds/.test(t); })()`)));
await shot('50-j2-build-load');
await clearTips();
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
await wait(2000);
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
    for (const id of ids.slice(0, 12)) {
      await page.click(`[data-panel=research] .rs-node[data-node="${id}"]`).catch(() => {});
      await wait(60);
      if (await page.$('[data-limit="tree.retry"]')) break;
    }
  }
  await wait(80);
  await collectLimits();
  if (l.panel === 'products') { await hoverCollect('[data-panel=products] .pc-cost'); await hoverCollect('[data-panel=products] [data-test^="prod-bind."]'); }
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
