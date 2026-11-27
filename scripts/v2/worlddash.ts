// World dashboard (design/world/OUTSIDE-WORLD.md section 17). Reads observer runs (balrun --observer) from balance/runs/<name>/games.jsonl
// and writes one self-contained balance/dash/world.html (data inlined, vanilla JS + SVG, no network).
//   npm run world:dash -- --runs obs-smoke[,obs-dev] [--out file.html]
// Look: reuses scripts/v2/baldash-assets/style.css (read only). Page code: scripts/v2/worlddash-assets/ (template.html, extra.css, prep.js, client.js).
// Real series: balance/world-history.ts. AIFM bands: balance/scenarios.ts. Parameters: balance/params registry.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Param } from '../../balance/schema';
import { CHECKPOINTS } from '../../balance/scenarios';
import { EXPORT_CONTROL_STEPS, LAW_DATES, REAL_SERIES } from '../../balance/world-history';
import { ENDING_TEXT } from '../../src/engine/v2/endings/endings';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const ASSETS = join(HERE, 'worlddash-assets');
const BAL_ASSETS = join(HERE, 'baldash-assets');

/** Registry areas and actors counted as outside-world parameters. */
const AREAS = ['actors', 'worldfx'];
const ACTORS = ['gov', 'public', 'china', 'rivals', 'leader'];

function parseArgs(): { runs: string[]; out: string } {
  const a = process.argv.slice(2);
  let runs = '';
  let out = join(ROOT, 'balance/dash/world.html');
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--runs') runs = a[++i] ?? '';
    else if (a[i] === '--out') out = a[++i] ?? out;
  }
  const list = runs.split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) { console.error('usage: npm run world:dash -- --runs <name>[,<name>...] [--out file.html]'); process.exit(2); }
  return { runs: list, out };
}

interface Rec { run: string; seed: number; world: string; endDay?: number; endReason?: string; ending?: string; milestones?: Record<string, number>; series: unknown[] }

function readObserverRecords(name: string): Rec[] {
  const gp = join(ROOT, 'balance/runs', name, 'games.jsonl');
  if (!existsSync(gp)) { console.error(`no games file ${gp}`); process.exit(1); }
  const out: Rec[] = [];
  for (const line of readFileSync(gp, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as Rec & { observer?: boolean; series?: Record<string, unknown>[] };
      if (!r.observer || !Array.isArray(r.series) || !r.series.length) continue;
      const n = r.series.length;
      // Keep what the page reads; milestone days only on the last sample (the dashboard reads the final state).
      const series = r.series.map((s: Record<string, unknown>, i) => ({
        day: s.day, year: s.year, frontier: s.frontier, laws: s.laws, economy: s.economy, geopolitics: s.geopolitics, robotsPerMonth: s.robotsPerMonth, techsDiscovered: s.techsDiscovered,
        labs: (s.labs as { id: string; kind: string; monthsBehind: number | null; milestoneDays: Record<string, number> }[]).map((l) => ({ id: l.id, kind: l.kind, monthsBehind: l.monthsBehind, ...(i === n - 1 ? { milestoneDays: l.milestoneDays } : {}) })),
      }));
      out.push({ run: name, seed: r.seed, world: r.world, endDay: r.endDay, endReason: r.endReason, ending: r.ending, milestones: r.milestones, series });
    } catch { /* a half-written last line */ }
  }
  return out;
}

async function loadParams(): Promise<{ rows: unknown[]; areas: string[]; actors: string[] }> {
  const dir = join(ROOT, 'balance/params');
  const all: Param[] = [];
  for (const n of readdirSync(dir).filter((f) => f.endsWith('.ts')).sort()) {
    const mod = (await import(pathToFileURL(join(dir, n)).href)) as Record<string, unknown>;
    for (const k of Object.keys(mod).filter((x) => x.startsWith('PARAMS_'))) all.push(...(mod[k] as Param[]));
  }
  const rows = all.filter((p) => AREAS.includes(p.area) || (p.actor && ACTORS.includes(p.actor)))
    .map((p) => ({ id: p.id, area: p.area, actor: p.actor ?? null, value: p.value ?? null, unit: p.unit ?? null, kind: p.kind, source: p.source ?? null }));
  return { rows, areas: AREAS, actors: ACTORS };
}

async function main() {
  const { runs, out } = parseArgs();
  const records = runs.flatMap(readObserverRecords);
  if (!records.length) { console.error('no observer records in ' + runs.join(', ')); process.exit(1); }
  const real = { series: REAL_SERIES, laws: LAW_DATES, exports: EXPORT_CONTROL_STEPS };
  const scenarios = { checkpoints: CHECKPOINTS.filter((c) => c.layer === 'timeline' && c.quantity === 'milestone') };
  const names = { ending: Object.fromEntries(Object.entries(ENDING_TEXT).map(([id, t]) => [id, t[0]])) };
  const data = { generated: new Date().toISOString(), runNames: runs, records, real, scenarios, names, params: await loadParams() };
  const BS = String.fromCharCode(92);
  const json = JSON.stringify(data).split('<').join(BS + 'u003c'); // no string can close the <script> tag
  const read = (dir: string, f: string) => readFileSync(join(dir, f), 'utf8');
  const html = read(ASSETS, 'template.html')
    .replace('/*__CSS__*/', () => read(BAL_ASSETS, 'style.css') + '\n' + read(ASSETS, 'extra.css'))
    .replace('/*__JS__*/', () => [read(ASSETS, 'prep.js'), read(ASSETS, 'client.js')].join('\n').replace(/<\/script/gi, '<\/script'))
    .replace('/*__DATA__*/', () => json);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`world:dash: ${out} (${records.length} observer runs from ${runs.join(', ')}; ${data.params.rows.length} params in areas ${AREAS.join('/')}; ${(html.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
