// Render the data-centre mockups (dc/) to PNG with headless Edge (copy of market/render.mjs).
// Usage: node render-crs.mjs v3-company v3-company:hover v3-research v3-research:node ...
//   "<page>:<state>" loads <page>.html#<state> and writes <page>-<state>.png.
// Icons: every `#i-<name>` used in the page (and in shell.js) is pulled from lucide-react and inlined as a sprite.
import { chromium } from 'file:///C:/Users/david/Documents/projects/AI27/node_modules/playwright-core/index.mjs';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const RD = path.join(dir, "..", "rd");
const LUCIDE = 'C:/Users/david/Documents/projects/AI27/node_modules/lucide-react/dist/esm/icons';
const ALIAS = { 'x-circle': 'circle-x', 'check-circle': 'circle-check', 'alert-triangle': 'triangle-alert' };

function symbol(name) {
  const file = path.join(LUCIDE, `${ALIAS[name] || name}.mjs`);
  if (!existsSync(file)) { console.warn('missing icon', name); return ''; }
  const src = readFileSync(file, 'utf8');
  const m = src.match(/const __iconData = ([\s\S]*?\});\s*__iconData/);
  if (!m) {
    const re = src.match(/from '\.\/([a-z0-9-]+)\.mjs'/);
    if (re) return symbol(re[1]).replace(`i-${re[1]}`, `i-${name}`);
    console.warn('unparsed icon', name); return '';
  }
  const node = Function(`return ${m[1]}`)().node;
  const inner = node.map(([tag, a]) => `<${tag} ${Object.entries(a).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
  return `<symbol id="i-${name}" viewBox="0 0 24 24">${inner}</symbol>`;
}

const jobs = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
for (const job of jobs) {
  const [name, state] = job.split(':');
  let html = readFileSync(path.join(dir, `${name}.html`), 'utf8');
  const shell = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(path.join(dir, f), 'utf8')).join(' ') + readFileSync(path.join(RD, 'shell.js'), 'utf8');
  const used = new Set([...(html + shell).matchAll(/#i-([a-z0-9-]+)/g)].map((m) => m[1]));
  // icon names built at runtime in page scripts: any quoted token that is a lucide icon file
  for (const m of (html + shell).matchAll(/'([a-z][a-z0-9-]+)'/g)) if (existsSync(path.join(LUCIDE, `${m[1]}.mjs`))) used.add(m[1]);
  const sprite = `<svg style="display:none" aria-hidden="true">${[...used].sort().map(symbol).join('')}</svg>`;
  html = html.replace('<!--ICONS-->', sprite);
  const tmp = path.join(dir, `_render-${name}.html`);
  writeFileSync(tmp, html);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file:///' + tmp.split(path.sep).join('/') + (state ? '#' + state : ''));
  await page.waitForTimeout(400);
  const out = path.join(dir, `${name}${state ? '-' + state : ''}.png`);
  await page.screenshot({ path: out });
  // overflow check: report elements whose content overflows their box
  const over = await page.evaluate(() => [...document.querySelectorAll('[data-chk], .card, .tcard, .node, .pcard')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map((e) => (e.className + ' ' + (e.textContent || '').trim().slice(0, 40))));
  await page.close();
  console.log('ok', path.basename(out), over.length ? 'OVERFLOW: ' + over.join(' | ') : '');
}
await browser.close();
