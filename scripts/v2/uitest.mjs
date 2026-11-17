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
// R3 People: teams by role, keep-hiring targets, offers, filling queue, move and let go.
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
await check('Flow pool click goes to the split', 'store.tab.company', () => page.click('[data-pool=experiments]'));
await nav('finance');
await check('Raise ask slider', `document.querySelector('[data-act="fin.raise"]').innerText`, () => setSlider(page.locator('[data-panel=finance] input[type=range]').first(), 3.3));
await check('Debt kind', `document.querySelector('[data-panel=finance]').innerHTML`, () => page.click('[data-panel=finance] [data-debt-kind=gpuTerm]'));
// R5 blueprint: size card with its limit tiles (before → after on a size change), slot table by layer with locked
// cards linking to Research, predicted and plan cards; run queue with actual share and ETA; spare-training policy.
await nav('blueprint');
await page.click('[data-panel=blueprint] [data-bp-kind=base]').catch(() => {});
await wait(80);
ok('Blueprint: size card with 7 limit tiles', (await page.$$('[data-panel=blueprint] [data-limit]')).length === 7);
ok('Blueprint: slot table by layer (Backbone, Training, Scaffold)', JSON.parse(await get(`(() => { const t = document.querySelector('[data-home=blueprintSlots]')?.innerText ?? ''; return /BACKBONE/.test(t) && /TRAINING/.test(t) && /SCAFFOLD/.test(t); })()`)));
await check('Blueprint: size ×4 changes the wall time', `document.querySelector('[data-panel=blueprint] [data-limit=wall]').innerText`, () => page.click('[data-panel=blueprint] [data-size="4"]'));
ok('Blueprint: tiles show before → after on a size change', (await page.$$('[data-panel=blueprint] .bp-lim.chg .was')).length >= 4);
ok('Blueprint: ×4 serves at 2× the ×1 cost (√size)', JSON.parse(await get(`(() => { const t = document.querySelector('[data-panel=blueprint] [data-limit=serve]').innerText; const m = t.match(/([0-9.]+)\\s*→\\s*([0-9.]+)/); return !!m && Math.abs(Number(m[2]) / Number(m[1]) - 2) < 0.03; })()`)));
await clearTips();
await shot('43-blueprint-x4');
await page.hover('[data-panel=blueprint] [data-limit=behind] .lv');
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
await nav('company');
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
await nav('company');
await tabTo('split');
await setSlider(page.locator('#ctl-split-training input[type=range]').first(), 0);
await wait(60);
ok('Split: zero training warns before apply', !!(await page.$('[data-test=split-warn]')));
await check('Split: zero training share applies (no rejection)', 'JSON.stringify(s.player.split.training < 1e-6)', () => page.click('[data-act=setSplit]'));
await nav('models');
ok('Run queue: paused, no training compute', ((await page.$eval('[data-test=run-stall]', (e) => e.textContent).catch(() => '')) ?? '').includes('no training compute'));
await nav('company');
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
ok('Leader lab: Relations lists it', (await page.locator('[data-panel=relations]').innerText()).includes('Polaris AI'));
await shot('51-leader-relations');
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
