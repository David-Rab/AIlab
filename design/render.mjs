// Renders the ```mermaid blocks in design/REDESIGN.md to design/diagrams/D<n>.svg and .png.
// Run: node design/render.mjs   (uses local node_modules/mermaid and Edge via playwright-core)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2] ?? 'design/REDESIGN.md';
const prefix = process.argv[3] ?? 'D';
const md = fs.readFileSync(src, 'utf8');
const blocks = [...md.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
const lib = path.resolve('node_modules/mermaid/dist/mermaid.min.js').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 });
await page.setContent(`<html><body style="background:#0d1117;margin:0;padding:24px"><div id="out"></div><script src="file:///${lib}"></script></body></html>`);
await page.addScriptTag({ path: path.resolve('node_modules/mermaid/dist/mermaid.min.js') });
await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false, theme: 'dark', flowchart: { curve: 'basis' } }));
let i = 0;
for (const code of blocks) {
  i++;
  const svg = await page.evaluate(async ({ code, i }) => {
    const { svg } = await window.mermaid.render(`d${i}`, code);
    document.getElementById('out').innerHTML = svg;
    return svg;
  }, { code, i });
  fs.writeFileSync(`design/diagrams/${prefix}${i}.svg`, svg);
  await page.locator('#out svg').screenshot({ path: `design/diagrams/${prefix}${i}.png` });
  console.log(`${prefix}${i} rendered`);
}
await browser.close();
