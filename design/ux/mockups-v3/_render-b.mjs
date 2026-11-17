// Render the v3 blueprint / products mockups to PNG (headless Edge).
// Usage: node _render-b.mjs [filter]
// Inlines lucide icons referenced as href="#i-NAME" into each HTML (between <!--ICONS--> markers), so every
// HTML file stays self-contained; then screenshots each shot at 1600x900.
import { chromium } from 'file:///C:/Users/david/Documents/projects/AI27/node_modules/playwright-core/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const ICONS = 'C:/Users/david/Documents/projects/AI27/node_modules/lucide-react/dist/esm/icons';
const SHOTS = [
  ['v3-blueprint', 'v3-blueprint', ''],
  ['v3-blueprint', 'v3-blueprint-size', 'size'],
  ['v3-blueprint', 'v3-blueprint-hover', 'hover'],
  ['v3-products', 'v3-products', ''],
  ['v3-products', 'v3-products-edit', 'edit'],
  ['v3-products', 'v3-products-hover', 'hover'],
];
const filter = process.argv[2] || '';

function symbol(name) {
  const f = path.join(ICONS, `${name}.mjs`);
  if (!existsSync(f)) throw new Error(`no lucide icon: ${name}`);
  let src = readFileSync(f, 'utf8');
  const alias = src.match(/export \{ default \} from '\.\/([a-z0-9-]+)\.mjs'/);
  if (alias) src = readFileSync(path.join(ICONS, `${alias[1]}.mjs`), 'utf8');
  const m = src.match(/const __iconData = (\{[\s\S]*?\n\});/);
  const node = Function(`return ${m[1]}`)().node;
  const inner = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
  return `<symbol id="i-${name}" viewBox="0 0 24 24">${inner}</symbol>`;
}

function inline(file) {
  let html = readFileSync(file, 'utf8');
  const names = [...new Set([...html.matchAll(/#i-([a-z0-9-]+)/g)].map((m) => m[1]))].sort();
  const block = `<!--ICONS--><svg style="display:none" aria-hidden="true">${names.map(symbol).join('')}</svg><!--/ICONS-->`;
  html = html.replace(/<!--ICONS-->[\s\S]*?<!--\/ICONS-->|<!--ICONS-->/, block);
  writeFileSync(file, html);
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const done = new Set();
for (const [src, out, q] of SHOTS) {
  if (filter && !out.includes(filter)) continue;
  const file = path.join(dir, `${src}.html`);
  if (!done.has(file)) { inline(file); done.add(file); }
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('file:///' + file.split(path.sep).join('/') + (q ? `?${q}` : ''));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(dir, `${out}.png`) });
  await page.close();
  console.log('ok', out);
}
await browser.close();
