// Render end-screen mockups to PNG with headless Edge. Usage: node render.mjs [filter]
import { chromium } from 'file:///C:/Users/david/Documents/projects/AI27/node_modules/playwright-core/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const dir = 'C:/tmp/endmock';
const ICONS = 'C:/Users/david/Documents/projects/AI27/node_modules/lucide-react/dist/esm/icons';
function symbol(name) {
  const f = path.join(ICONS, `${name}.mjs`);
  if (!existsSync(f)) { console.log('no icon', name); return ''; }
  let src = readFileSync(f, 'utf8');
  const alias = src.match(/export \{ default \} from '\.\/([a-z0-9-]+)\.mjs'/);
  if (alias) src = readFileSync(path.join(ICONS, `${alias[1]}.mjs`), 'utf8');
  const m = src.match(/const __iconData = (\{[\s\S]*?\n\});/);
  const node = Function(`return ${m[1]}`)().node;
  return `<symbol id="i-${name}" viewBox="0 0 24 24">${node.map(([tag, a]) => `<${tag} ${Object.entries(a).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')}</symbol>`;
}
const srcs = ['end.js', 'browse.js'].filter((f) => existsSync(`${dir}/${f}`)).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
const names = [...new Set([...srcs.matchAll(/#i-([a-z0-9-]+)|ic\('([a-z0-9-]+)'/g)].map((m) => m[1] || m[2]))].sort();
writeFileSync(`${dir}/icons.js`, `document.write(${JSON.stringify(`<svg style="display:none">${names.map(symbol).join('')}</svg>`)});`);
const filter = process.argv[2] || '';
const shots = [['asi-aligned', true], ['asi-aligned-tooltip', false], ['retired', true], ['takeover', false]];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
for (const [n, full] of shots) {
  if (!n.startsWith(filter)) continue;
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`file:///${dir}/${n}.html`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/${n}.png` });
  if (full) await page.screenshot({ path: `${dir}/${n}-full.png`, fullPage: true });
  console.log('ok', n);
}
await browser.close();
