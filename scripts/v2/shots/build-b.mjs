// UB-B screenshots: TRAINING › Data (+ licence drawer), Environments, Runs (+ run drawer) at day 0, day-400 and day-900
// fixtures. Usage: node scripts/v2/shots/build-b.mjs [stage...] (after npm run build).
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
    const json = readFileSync(path.join(ROOT, `scripts/v2/fixtures/day${st.slice(1).replace('run', '')}.json`), 'utf8');
    const err = await page.evaluate((j) => window.ai27v2.importJson(j), json);
    if (err) errors.push('import: ' + err);
    await page.evaluate(() => { const s = window.ai27v2.state; s.setup.tutorial = false; window.ai27v2.notify(); });
  }
  await wait(200);
  await page.evaluate(() => window.ai27v2.setSpeed(0));
  await closeModals();
  if (st === 'd400run') {
    // As the mockup data did (DATA-b Runs): launch Next run's post-training, a distil and a new base, then play ~125 days.
    await page.evaluate(() => { window.ai27v2.setPanel('blueprint'); window.ai27v2.setTab('blueprint', 'next'); });
    for (const k of ['post', 'distill', 'base']) {
      await wait(250);
      await page.click(`[data-panel=blueprint] [data-bp-kind=${k}]`).catch(() => errors.push(`no ${k} start`));
      await wait(250);
      const a = { post: 'launchPost', distill: 'launchDistill', base: 'launchBase' }[k];
      await page.click(`[data-panel=blueprint] [data-act=${a}]:not([disabled])`).catch(() => errors.push(`could not launch ${k}`));
      await closeModals();
    }
    for (let d = 0; d < 125; d += 5) { await page.evaluate(() => window.ai27v2.step(5)); await closeModals(); }
  }
  const shot = async (name) => { await page.mouse.move(1, 1); await wait(250); await page.screenshot({ path: path.join(OUT, `train-${name}-${st}.png`) }); };
  const text = async (name, sel = 'main.center') => writeFileSync(path.join(OUT, `train-${name}-${st}.txt`), await page.evaluate((q) => document.querySelector(q)?.innerText ?? '', sel));
  await page.evaluate(() => window.ai27v2.setPanel('blueprint'));
  for (const tab of ['data', 'suites', 'runs']) {
    await page.evaluate((t) => window.ai27v2.setTab('blueprint', t), tab);
    await wait(400);
    await shot(tab); await text(tab);
    // The uitest J1 O1 coverage rule on this tab: numbers on screen outside any tooltip.
    const miss = await page.evaluate(() => [...document.querySelector('main.center').querySelectorAll('*')].filter((e) => {
      if (e.children.length) return false;
      const tx = (e.textContent ?? '').trim();
      if (!/\d/.test(tx) || tx.length > 40) return false;
      const b = e.getBoundingClientRect();
      return b.width > 4 && b.height > 4 && e.closest('svg') === null && !e.closest('button') && !e.closest('[data-tabs]') && !e.closest('select') && !e.closest('[data-tip]');
    }).map((e) => `${e.className} | ${(e.textContent ?? '').trim().slice(0, 30)}`));
    writeFileSync(path.join(OUT, `train-${tab}-${st}-untipped.txt`), miss.join('\n'));
    if (tab === 'data') { const b = await page.$('[data-test=data-buy-licence]'); if (b) { await b.click(); await shot('data-drawer'); await text('data-drawer', '[data-test=licence-drawer]'); await page.keyboard.press('Escape'); } }
    if (tab === 'runs') { const fc = await page.$$('[data-fc] .rn-fcname'); const b = fc[fc.length - 1] ?? await page.$('.rn-bar[data-run]'); if (b) { await b.click(); await shot('runs-drawer'); await text('runs-drawer', '[data-test=run-drawer]'); await page.keyboard.press('Escape'); } }
  }
  console.log(st, 'done');
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
