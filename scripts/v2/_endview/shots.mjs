// End-screen screenshots (node scripts/v2/_endview/shots.mjs [only]): loads the day-900 fixture into the BUILT app
// (dist/index.html; run `npm run build` first), forces an ending the way C:\tmp\endaudit\run.mjs does (the inputs set,
// then a day stepped), screenshots the end screen at 1600×900 (viewport and full page) into C:\tmp\endbuild\, and
// exercises View the world → browse banner → Back to ending. Exits non-zero on a missing screen or a page error.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const require = createRequire(join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const OUT = 'C:/tmp/endbuild';
mkdirSync(OUT, { recursive: true });
const fx = (n) => readFileSync(join(ROOT, 'scripts/v2/fixtures', `${n}.json`), 'utf8');
const LOSE = `s.hidden.doomThreshold=0; s.hidden.toleranceNoise=0;`;
const cases = [
  // name, fixture, mutation (body with s, store), max days
  ['asiAligned', 'day900', `s.hidden.doomThreshold=0.95; s.hidden.toleranceNoise=0; s.player.milestoneDays[6]=s.time.day`, 2],
  ['retired', 'day900', `store.act('RETIRE')`, 3],
  ['chinaTakeover', 'day900', `${LOSE} s.china.lab.core.milestoneDays[6]=s.time.day`, 2],
  ['rivalTakeover', 'day400', `${LOSE} const r=s.rivals.find(r=>r.core.status==='active'); r.core.milestoneDays[6]=s.time.day`, 2],
  ['insolvent', 'day900', `s.player.finance.state='insolvent'`, 2],
];
const only = process.argv[2];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(pathToFileURL(join(ROOT, 'dist/index.html')).href);
await page.evaluate(() => localStorage.clear());
await page.reload();
let fails = 0;
const fail = (m) => { fails++; console.log('  FAIL', m); };
for (const [name, fixture, mut, max] of cases) {
  if (only && !name.startsWith(only)) continue;
  errors.length = 0;
  await page.setViewportSize({ width: 1600, height: 900 });
  const err = await page.evaluate((j) => window.ai27v2.importJson(j), fx(fixture));
  if (err) { fail(`${name}: import ${err}`); continue; }
  await page.evaluate(() => window.ai27v2.setSpeed(0));
  await page.evaluate((m) => { const store = window.ai27v2; new Function('s', 'store', m)(store.state, store); store.notify(); }, mut);
  for (let i = 0; i < max; i++) {
    const done = await page.evaluate(() => { const st = window.ai27v2; st.step(1); return !!st.state.ending; });
    if (done) break;
  }
  await page.waitForTimeout(300);
  const id = await page.evaluate(() => window.ai27v2.state.ending?.id);
  if (!(await page.$('[data-test=endscreen]'))) { fail(`${name}: no end screen (ending ${id})`); continue; }
  await page.screenshot({ path: `${OUT}/${name}-viewport.png` });
  // Overflow check: nothing in the first viewport wider than its box.
  const over = await page.evaluate(() => [...document.querySelectorAll('.es-hero, .es-tile, .es-scores, .es-hdr')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map((e) => e.className));
  if (over.length) console.log('  overflow:', over.join(' | '));
  const h = await page.evaluate(() => document.querySelector('.es').scrollHeight);
  await page.setViewportSize({ width: 1600, height: Math.min(h, 6000) });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${name}-full.png` });
  await page.setViewportSize({ width: 1600, height: 900 });
  // A score tooltip (hover; the screenshot shows it).
  await page.hover('.es-sc:nth-of-type(4)');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}-scoretip.png` });
  await page.mouse.move(5, 5);
  const text = await page.evaluate(() => document.querySelector('[data-test=endscreen]').innerText);
  if (/\d\.\d{4,}/.test(text)) fail(`${name}: raw float in text`);
  // View the world → browse mode → back.
  await page.click('[data-test=view-world]');
  await page.waitForTimeout(200);
  const browse = await page.evaluate(() => ({
    banner: !!document.querySelector('[data-test=end-banner]'),
    end: !!document.querySelector('[data-test=endscreen]'),
    frozen: /time frozen/.test(document.querySelector('[data-test=end-banner]')?.textContent ?? ''),
  }));
  if (!browse.banner || browse.end || !browse.frozen) fail(`${name}: browse mode ${JSON.stringify(browse)}`);
  await page.click('[data-nav=finance]');
  await page.waitForTimeout(200);
  const btn = await page.$('button[data-act]');
  if (!btn || !(await btn.isDisabled())) fail(`${name}: no disabled action in browse mode`);
  else {
    await btn.hover({ force: true });
    await page.waitForTimeout(900);
    const tip = await page.evaluate(() => document.querySelector('.tip')?.innerText ?? '');
    if (!/The game has ended/.test(tip)) fail(`${name}: disabled action tip: ${tip.slice(0, 80)}`);
    if (name === 'asiAligned') await page.screenshot({ path: `${OUT}/${name}-browse.png` });
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
  }
  await page.click('[data-test=back-to-ending]');
  await page.waitForTimeout(200);
  if (!(await page.$('[data-test=endscreen]'))) fail(`${name}: back to ending`);
  writeFileSync(`${OUT}/${name}.txt`, `${text}\n\n=== ERRORS ===\n${errors.join('\n')}`);
  console.log(name, 'ending', id, 'height', h, 'errors', errors.length, errors.slice(0, 2).join(' | '));
  if (errors.length) fails++;
  await page.evaluate(() => window.ai27v2.go('start'));
}
await browser.close();
console.log(fails ? `${fails} failure(s)` : 'all ok');
process.exit(fails ? 1 : 0);
