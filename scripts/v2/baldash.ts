// Balance dashboard (design/bal/TOOLING-DESIGN.md, C4). Reads balance/runs/<name>/ and the registries in balance/,
// writes one self-contained balance/dash/index.html (data inlined, vanilla JS + SVG, no network).
//   npm run bal:dash -- --runs smoke[,other]
// The page assets live in scripts/v2/baldash-assets/ (template.html, style.css, client.js).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Param, Target } from '../../balance/schema';
import { ENDING_TEXT } from '../../src/engine/v2/endings/endings';
import { STARTS } from '../../src/data/v2/starts';
import { PRESET_BY_LABEL } from '../../src/data/v2/calibration';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const ASSETS = join(HERE, 'baldash-assets');

/** The fields of a GameRecord the dashboard reads (everything but milestones/ending/verdict is optional). */
interface Game {
  run: string; seed: number; world: string; alignment: string; start: string; policy: string;
  overrides?: Record<string, number | string | boolean>;
  endDay?: number; ending?: string; verdict?: string;
  milestones?: Record<string, number>;
  pMisAtEnd?: number; pMisAtASI?: number; minCash?: number; insolvent?: boolean;
}

function parseArgs(): { runs: string[]; out: string } {
  const a = process.argv.slice(2);
  let runs = '';
  let out = join(ROOT, 'balance/dash/index.html');
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--runs') runs = a[++i] ?? '';
    else if (a[i] === '--out') out = a[++i] ?? out;
  }
  const list = runs.split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) {
    console.error('usage: npm run bal:dash -- --runs <name>[,<name>...] [--out file.html]');
    process.exit(2);
  }
  return { runs: list, out };
}

function readJson<T>(path: string): T | undefined {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return undefined; }
}

function readGames(path: string): { games: Game[]; bad: number } {
  const games: Game[] = [];
  let bad = 0;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as Game;
      if (typeof r.world !== 'string' || typeof r.policy !== 'string') { bad++; continue; }
      // keep only what the page reads
      const g: Game = {
        run: r.run, seed: r.seed, world: r.world, alignment: String(r.alignment ?? ''), start: String(r.start ?? ''), policy: r.policy,
        ending: r.ending, verdict: r.verdict, milestones: r.milestones ?? {}, endDay: r.endDay,
      };
      if (r.overrides && Object.keys(r.overrides).length) g.overrides = r.overrides;
      for (const k of ['pMisAtEnd', 'pMisAtASI', 'minCash'] as const) if (typeof r[k] === 'number') g[k] = r[k];
      if (typeof r.insolvent === 'boolean') g.insolvent = r.insolvent;
      games.push(g);
    } catch { bad++; } // a half-written last line of a run in progress
  }
  return { games, bad };
}

async function loadRegistries(): Promise<{ params: Param[]; targets: Target[] }> {
  const dir = join(ROOT, 'balance/params');
  const params: Param[] = [];
  for (const n of readdirSync(dir).filter((f) => f.endsWith('.ts')).sort()) {
    const mod = (await import(pathToFileURL(join(dir, n)).href)) as Record<string, unknown>;
    const keys = Object.keys(mod).filter((k) => k.startsWith('PARAMS_'));
    for (const k of keys) params.push(...(mod[k] as Param[]));
  }
  const tm = (await import(pathToFileURL(join(ROOT, 'balance/targets.ts')).href)) as { TARGETS: Target[] };
  return { params, targets: tm.TARGETS };
}

async function main() {
  const { runs, out } = parseArgs();
  const runData = runs.map((name) => {
    const dir = join(ROOT, 'balance/runs', name);
    const gp = join(dir, 'games.jsonl');
    if (!existsSync(dir)) { console.error(`no run folder ${dir}`); process.exit(1); }
    const { games, bad } = existsSync(gp) ? readGames(gp) : { games: [] as Game[], bad: 0 }; // a run just started has no games yet
    return {
      name, games, badLines: bad,
      config: readJson<Record<string, unknown>>(join(dir, 'config.json')) ?? null,
      progress: readJson<Record<string, unknown>>(join(dir, 'progress.json')) ?? null,
      hasSummary: existsSync(join(dir, 'summary.json')),
    };
  });
  const { params, targets } = await loadRegistries();
  const slimParams = params.map((p) => ({
    id: p.id, area: p.area, layer: p.layer, actor: p.actor ?? null, kind: p.kind, value: p.value ?? null, unit: p.unit ?? null,
    source: p.source ?? null, evidence: p.evidence, notes: p.notes ?? null, grade: p.grade ?? null, perPreset: !!p.perPreset,
    range: p.range ?? null, fit: p.fit ?? null,
    where: p.ref.kind === 'export' ? `${p.ref.module} ${p.ref.symbol}${p.ref.path ? '.' + p.ref.path.join('.') : ''}` : `${p.ref.file} (inline)`,
  }));
  // Player-facing names, read from the game at build time (ids without an entry show as the id).
  const names = {
    ending: Object.fromEntries(Object.entries(ENDING_TEXT).map(([id, t]) => [id, t[0]])),
    start: Object.fromEntries(STARTS.map((x) => [x.id, x.name])),
    world: Object.fromEntries(Object.entries(PRESET_BY_LABEL).map(([label, id]) => [id, label])),
  };
  const data = { startDate: '2025-07-01', generated: new Date().toISOString(), runs: runData, params: slimParams, targets, names };
  // The data sits in a JSON <script> block: escape '<' so no string can close the tag (JSON.parse reads it back).
  const BS = String.fromCharCode(92);
  const json = JSON.stringify(data).split('<').join(BS + 'u003c');
  const tpl = readFileSync(join(ASSETS, 'template.html'), 'utf8');
  const html = tpl
    .replace('/*__CSS__*/', () => readFileSync(join(ASSETS, 'style.css'), 'utf8'))
    .replace('/*__JS__*/', () => readFileSync(join(ASSETS, 'client.js'), 'utf8').replace(/<\/script/gi, '<\\/script'))
    .replace('/*__DATA__*/', () => json);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  const n = runData.reduce((s, r) => s + r.games.length, 0);
  console.log(`bal:dash: ${out} (${n} games from ${runs.join(', ')}; ${params.length} params, ${targets.length} targets; ${(html.length / 1024).toFixed(0)} KB)`);
  for (const r of runData) if (r.badLines) console.log(`  ${r.name}: skipped ${r.badLines} unreadable line(s)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
