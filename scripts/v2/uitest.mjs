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
    const floats = text.match(/\d\.\d{5,}/g) ?? [];
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
await check('Recommended post-train', 'document.querySelector("[data-panel=rundesigner]").innerText', () => page.click('[data-test=rd-recommended]'));
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
const PANELS = ['finance', 'overview', 'company', 'compute', 'models', 'rundesigner', 'deployments', 'safety', 'relations', 'world', 'risk', 'codex'];
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
    if (SKIP.has(id)) continue;
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
await nav('company');
await tabTo('split');
await check('Split slider moves draft', `document.querySelector('[data-panel=company]').innerText`, () => setSlider(page.locator('[data-panel=company] .split-row input[type=range]').first(), 0.6));
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
await tabTo('people');
await check('Hiring slider + Set', 's.player.hiring.target.saf', async () => {
  await setSlider(page.locator('[data-dept=saf] input[type=range]'), 120);
  await page.click('[data-dept=saf] [data-act=hireTarget]');
});
await tabTo('flow');
ok('Company flow renders', !!(await page.$('[data-home=computeFlow]')) && !!(await page.$('[data-home=M]')));
await check('Flow pool click goes to the split', 'store.tab.company', () => page.click('[data-pool=experiments]'));
await nav('finance');
await check('Raise ask slider', `document.querySelector('[data-act="fin.raise"]').innerText`, () => setSlider(page.locator('[data-panel=finance] input[type=range]').first(), 3.3));
await check('Debt kind', `document.querySelector('[data-panel=finance]').innerHTML`, () => page.click('[data-panel=finance] [data-debt-kind=gpuTerm]'));
await nav('rundesigner');
await check('Run designer: kind base', `document.querySelector('[data-panel=rundesigner]').innerText`, () => page.click('[data-panel=rundesigner] [data-rd-kind=base]'));
ok("Run designer: locked option shows its reason", await page.$eval(`[data-panel=rundesigner] [data-opt="shape:latent"]`, (b) => b.disabled && b.innerText.length > 8));
await check("Run designer: shape overtrained", `document.querySelector("[data-panel=rundesigner]").innerHTML`, () => page.click(`[data-panel=rundesigner] [data-opt="shape:overtrained"]`));
await page.click('[data-panel=rundesigner] [data-opt="shape:dense"]');
await check('Run designer: save template', 'localStorage.getItem("ai27.v2.runTemplates")', () => page.click('[data-test=rd-save]'));
await check('Launch base run', `s.player.models.runs.filter(r => r.kind === 'base').length`, () => page.click('[data-act=launchBase]'));
await closeModals();
await nav('models');
const vids = JSON.parse(await get('s.player.models.versions.map(v => v.id)'));
if (vids.length > 1) await check('Select version in lineage', 'store.sel.versionId', () => page.click(`[data-version="${vids[0]}"]`));
await nav('deployments');
await check('Deploy channel', `document.querySelector('[data-panel=deployments]').innerHTML`, () => page.click('[data-panel=deployments] [data-channel-opt=enterprise]'));
const dep = JSON.parse(await get(`(s.player.deployments.find(d => d.status === 'live' && d.channel !== 'internal' && d.channel !== 'open') || {}).id || ''`));
if (dep) {
  await check('setServing: per-deployment share', `s.player.deployments.find(d => d.id === "${dep}").servingShare`, async () => {
    await setSlider(page.locator(`[data-deployment="${dep}"] input[type=range]`), 0.35);
    await page.click(`[data-act="setServing.${dep}"]`);
  });
}
await nav('safety');
await tabTo('agendas');
ok('Safety department load renders', !!(await page.$('[data-home=safetyLoad] [data-test=load-staff]')) && !!(await page.$('[data-home=safetyLoad] [data-test=load-compute]')));
if (await page.$('[data-home=safetyAgents] [data-act="safety.agents"]:not([disabled])')) {
  await check('Safety agents: share + apply', 'JSON.stringify(s.player.safety.agentShare)', async () => {
    await setSlider(page.locator('[data-home=safetyAgents] input[type=range]').first(), 0.3);
    await page.click('[data-act="safety.agents"]');
  });
}
for (const t of await tabsOf()) await check(`Safety tab ${t}`, 'store.tab.safety || ""', () => tabTo(t), 30).catch(() => {});
await tabTo('graph');
ok('Trait graph is the first tab', !!(await page.$('[data-test=traitgraph]')));
await nav('codex');
await check('Codex category', `document.querySelector('.codex-entry').innerText`, () => page.click('[data-codex-cat="Traits"]'));
await check('Codex search', `document.querySelector('.codex-list').innerText`, () => page.fill('[data-test=codex-search]', 'scheming'));
await nav('risk');
await tabTo('flows');
await check('Flows node opens panel', 'store.panel', () => page.click('[data-node=player]'));

// Overview (L1) and bottom bar
await nav('overview');
ok('Lead track lanes', (await page.$$('[data-lane]')).length >= 3);
ok('Watch card renders', !!(await page.$('[data-test=watch]')));
await check('Lead lane opens Relations', 'store.panel', () => page.click('[data-lane]'));
await nav('overview');
const go = await page.$('[data-test=watch] [data-go]');
if (go) await check('Watch Go jumps to the control', 'store.panel', () => go.click());
ok('Headline renders', !!(await page.$('[data-test=ticker]')));
await check('Race meter click opens Safety graph', 'store.panel + store.tab.safety', () => page.click('[data-test=race]'));

// ───────────────────────── Game C: day-400 fixture, screenshots of every panel ─────────────────────────
const fx = readFileSync(path.resolve('scripts/v2/fixtures/day400.json'), 'utf8');
const err = await page.evaluate((j) => window.ai27v2.importJson(j) ?? '', fx);
ok('Import day-400 fixture', err === '', err);
await page.evaluate(() => { window.ai27v2.state.setup.tutorial = false; window.ai27v2.notify(); });
for (const p of PANELS) {
  await nav(p);
  const tabs = await tabsOf();
  for (const t of tabs.length ? tabs : ['']) {
    if (t) await tabTo(t);
    await wait(80);
    await iaScan(`day400:${p}${t ? '.' + t : ''}`);
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
    await shot(`30-day900-${p}${t ? '-' + t : ''}`);
  }
}
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
