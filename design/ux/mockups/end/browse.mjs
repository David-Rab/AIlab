// Browse-mode mockup: the real game shell (built app in C:\tmp\endaudit\dist, day-900 fixture) frozen, with a slim
// "Game over" banner injected and the time controls greyed. Usage: node browse.mjs [panel]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('C:/Users/david/Documents/projects/AI27/package.json');
const { chromium } = require('playwright-core');
const panel = process.argv[2] || 'world';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto('file:///C:/tmp/endaudit/dist/index.html');
await page.evaluate(() => localStorage.clear());
await page.reload();
const fx = readFileSync('C:/Users/david/Documents/projects/AI27/scripts/v2/fixtures/day900.json', 'utf8');
const err = await page.evaluate((j) => window.ai27v2.importJson(j), fx);
if (err) console.log('import', err);
await page.evaluate((p) => { const st = window.ai27v2; st.setSpeed(0); st.state.events.pending = []; st.state.tutorial.seen.push('coach:skip'); st.setPanel(p); st.notify(); }, panel);
await page.waitForTimeout(500);
const css = readFileSync('C:/tmp/endmock/browse.css', 'utf8');
const banner = readFileSync('C:/tmp/endmock/browse-banner.html', 'utf8');
await page.evaluate(([c, b]) => {
  const st = document.createElement('style'); st.textContent = c; document.head.appendChild(st);
  const d = document.createElement('div'); d.innerHTML = b; document.body.prepend(d.firstElementChild);
  document.body.classList.add('browse-frozen');
}, [css, banner]);
await page.waitForTimeout(300);
await page.screenshot({ path: `C:/tmp/endmock/browse${panel === 'world' ? '' : '-' + panel}.png` });
await browser.close();
console.log('ok browse', panel);
