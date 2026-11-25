// Live timeline layer for the Scenarios tab: reads the cluster files that aifm-runs/scripts/summarize_live.py writes while the
// AI Futures Model runs ({fast,central,slow}.json + status.json) and turns them into the same checkpoints as balance/scenarios.ts
// builds from its pasted numbers. History, alignment levels and the timeline texts' structure still come from scenarios.ts.
//   npm run bal:dash -- --runs perf10 --scenarios-live <aifm-runs/out/eli_live>
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Checkpoint, Milestone, Timeline, TimelineId } from '../../balance/scenarios';

type Q5 = [number | null, number | null, number | null, number | null, number | null];
interface PerQ { p10: number | null; p25: number | null; p50: number | null; p75: number | null; p90: number | null }
interface ClusterFile {
  cluster: { n: number; share_of_pool: number | null } & Record<string, number | string | null>; // <key>_percentile_lo/_hi, <key>_date_lo/_hi (ac_ or sar_)
  pool: { n_ok_pooled: number; n_rollouts_in_files: number; n_failed_excluded: number };
  num_rollouts_ok: number;
  milestones: Record<string, PerQ & { frac_not_reached_by_2100: number | null; frac_never_reached: number | null }>;
  gaps_years: Record<string, PerQ & { n: number }>;
  series: { years: number[]; data: Record<string, { p10: (number | null)[]; p25: (number | null)[]; p50: (number | null)[]; p75: (number | null)[]; p90: (number | null)[] }> };
}
export interface LiveStatus {
  samples: number; okSoFar?: number; failedSoFar?: number; updatedAt: string; requested?: number;
  jobs: Record<string, 'done' | 'running' | 'pending'>;
  clusterSamples?: number; clusterOk?: number; clustersUpdatedAt?: string; final?: boolean; allJobsDone?: boolean;
}
/** One way of cutting the runs into fast / central / slow: its timeline texts, timeline-layer checkpoints and run counts. */
export interface SplitLayer { id: SplitId; label: string; dir: string; timelines: Timeline[]; checkpoints: Checkpoint[]; clusterN: Record<string, number> }
export type SplitId = 'ac' | 'sar';
export interface InputsData { time: number[]; series: Record<string, number[]> }
export interface LiveData {
  dir: string; status: LiveStatus | null; timelines: Timeline[]; checkpoints: Checkpoint[]; clusterN: Record<string, number>;
  sar: SplitLayer | null; matrix: unknown | null; inputs: InputsData | null;
}
export interface LiveOpts { sarDir?: string; matrixDir?: string; inputsCsv?: string }

const IDS: TimelineId[] = ['fast', 'central', 'slow'];
const SERIES_YEARS = [2027, 2028, 2030, 2032, 2035, 2040, 2045]; // the extractor reads 2025 to 2045; a point past the axis would not show
const MAX_MIN = 1e7; // horizons above this are the model's post-takeoff blow-up: not shown
const q5 = (d: PerQ): Q5 => [d.p10, d.p25, d.p50, d.p75, d.p90];
const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
const sig = (v: number | null) => (v == null ? null : Number(v.toPrecision(3)));
const yr = (v: number | null) => (v === null ? 'n/a' : v.toFixed(2));
const pc = (f: number | null) => (f == null ? 'n/a' : `${+(f * 100).toPrecision(2)}%`);
const readJson = <T>(p: string): T | undefined => { try { return JSON.parse(readFileSync(p, 'utf8')) as T; } catch { return undefined; } };

const SPLITS: Record<SplitId, { key: string; pre: string; label: string; what: string; reaches: string }> = {
  ac: { key: 'AC', pre: 'ac', label: 'Coder date', what: 'AC date', reaches: 'when AI first codes better than any human (AC)' },
  sar: { key: 'SAR', pre: 'sar', label: 'SAR date', what: 'SAR date', reaches: 'when AI first does AI research better than any human (SAR)' },
};

const INPUT_COLS = ['L_HUMAN', 'inference_H100e', 'experiment_H100e', 'training_H100e', 'world_H100e', 'total_ai_company_H100e'];
/** The authors' fixed input projection (aifm-public inputs/input_data.csv), same in every run. Rows up to 2061 only. */
function loadInputs(csv: string): InputsData | null {
  if (!existsSync(csv)) return null;
  const lines = readFileSync(csv, 'utf8').split(/\r?\n/).filter(Boolean);
  const cols = lines[0].split(',');
  const time: number[] = [], series: Record<string, number[]> = Object.fromEntries(INPUT_COLS.map((c) => [c, [] as number[]]));
  for (const ln of lines.slice(1)) {
    const v = ln.split(',').map(Number);
    if (!(v[cols.indexOf('time')] <= 2061)) continue;
    time.push(v[cols.indexOf('time')]);
    for (const c of INPUT_COLS) series[c].push(v[cols.indexOf(c)]);
  }
  return { time, series };
}

/** Timeline texts and checkpoints for one split, from the cluster files in dir. */
function buildLayer(dir: string, split: SplitId, withInputs: boolean): SplitLayer {
  const sp = SPLITS[split];
  const files = IDS.map((id) => [id, readJson<ClusterFile>(join(dir, `${id}.json`))] as const);
  if (files.every(([, f]) => !f)) throw new Error(`--scenarios-live: no fast/central/slow.json in ${dir} (run summarize_live.py --clusters first)`);
  const timelines: Timeline[] = [];
  const checkpoints: Checkpoint[] = [];
  const clusterN: Record<string, number> = {};
  const trainFrom = withInputs ? files.map(([, f]) => f).find((f) => f && f.cluster.n > 0 && f.series.data.input_training_H100e) : undefined;
  for (const [id, f] of files) {
    const n = f?.cluster.n ?? 0;
    clusterN[id] = n;
    const pctTxt = f ? `${f.cluster[sp.pre + '_percentile_lo']}th to ${f.cluster[sp.pre + '_percentile_hi']}th percentile` : '';
    const dLo = f?.cluster[sp.pre + '_date_lo'], dHi = f?.cluster[sp.pre + '_date_hi'];
    const win = typeof dLo === 'number' && typeof dHi === 'number' ? `${dLo.toFixed(1)} to ${dHi.toFixed(1)}` : 'no date range yet';
    const lead = id === 'fast' ? 'Fast' : id === 'central' ? 'Central' : 'Slow';
    timelines.push({
      id, name: lead,
      sourceModel: f ? `AI Futures Model, Eli's settings. ${n} run${n === 1 ? '' : 's'} so far, from the ${pctTxt} of all runs by ${sp.what}.` : 'No runs yet.',
      summary: n === 0 ? 'No run in this group yet.'
        : `${id === 'fast' ? 'The quicker end' : id === 'central' ? 'The middle' : 'The slower end'} of the runs by ${sp.reaches}: between ${win}.${n < 30 ? ' Only a few runs so far, so the numbers are rough.' : ''}`,
    });
    if (!f || n === 0) continue;
    const src = `AI Futures Model, Eli's settings, ${n} runs, ${sp.key} in the ${pctTxt} of all runs`;
    const ref = `aifm-runs/out/${basename(dir)}/${id}.json (extract.py cluster logic)`;
    const small = n < 30 ? ` Only ${n} run${n === 1 ? '' : 's'} in this group so far: read the percentiles as rough.` : '';
    const ran = `${n} runs in this group (${f.pool.n_ok_pooled} usable runs pooled; ${f.pool.n_failed_excluded} failed runs left out).${small}`;
    const dist = (q: Q5, cap = Infinity): Partial<Checkpoint> => {
      const k = (v: number | null) => (v !== null && v <= cap ? v : undefined);
      return { value: q[2] ?? undefined, lo: k(q[1]), hi: k(q[3]), p10: k(q[0]), p90: k(q[4]), bandFrom: 'source' };
    };
    const tl = (cid: string, quantity: Checkpoint['quantity'], label: string, unit: string, x: Partial<Checkpoint>): void => {
      checkpoints.push({ id: `${id}.${cid}`, layer: 'timeline', timeline: id, quantity, label, unit, bandFrom: 'none', source: src, sourceRef: ref, status: 'sourced', ...x });
    };
    const MS: [Milestone | 'TED-AI', string, string][] = [
      ['SC', 'AC', 'AI that codes better than any human (SC)'], ['SAR', 'SAR', 'AI that does AI research better than any human (SAR)'],
      ['SIAR', 'SIAR', 'Superintelligent AI researcher (SIAR)'], ['TED-AI', 'TED-AI', 'Top-human-expert-dominating AI (TED-AI)'], ['ASI', 'ASI', 'Artificial superintelligence (ASI)'],
    ];
    for (const [mine, theirs, label] of MS) {
      const d = f.milestones[theirs], q = q5(d);
      if (q[2] == null) continue; // the median is not reached by this group yet
      const tail = `p10 ${yr(q[0])}, p90 ${q[4] !== null ? yr(q[4]) : 'not reached (more than 10% of runs never get there)'}. ${pc(d.frac_not_reached_by_2100)} of runs do not reach it by 2100 (${pc(d.frac_never_reached)} never, to 2200); the percentiles count those as later than every run that does.`;
      const note = mine === 'SC' ? `The model's AC (all coding) is read as our SC. ${tail} ${ran}`
        : mine === 'TED-AI' ? `The model's TED-AI has no counterpart among the game's four milestones. It often comes before SIAR. ${tail} ${ran}` : `${tail} ${ran}`;
      tl(mine, mine === 'TED-AI' ? 'other' : 'milestone', label, 'year', { ...(mine === 'TED-AI' ? {} : { milestone: mine }), ...dist(q.map(r2) as Q5), neverBy2100: d.frac_not_reached_by_2100 ?? undefined, notes: note });
    }
    const GAPS: [Milestone, Milestone, string, string][] = [['SC', 'SAR', 'AC->SAR', 'Time from SC to SAR'], ['SAR', 'SIAR', 'SAR->SIAR', 'Time from SAR to SIAR'], ['SIAR', 'ASI', 'SIAR->ASI', 'Time from SIAR to ASI']];
    for (const [from, to, key, label] of GAPS) {
      const g = f.gaps_years[key];
      if (!g || g.p50 == null) continue;
      tl(`interval.${from}-${to}`, 'interval', label, 'years', { from, milestone: to, ...dist(q5(g).map(r2) as Q5),
        notes: `Median of the per-run gaps, over the ${g.n} runs of this group that reach both milestones; it is not the difference of the two median dates.${from === 'SC' ? " The start is the model's AC." : ''}${small}` });
    }
    const at = (name: string, y: number): Q5 | null => {
      const d = f.series.data[name], j = f.series.years.indexOf(y);
      return d && j >= 0 ? [d.p10[j], d.p25[j], d.p50[j], d.p75[j], d.p90[j]] : null;
    };
    for (const y of SERIES_YEARS) {
      const when = `At 1 January ${y}.`;
      for (const [name, eighty] of [['horizon80_minutes', true], ['horizon50_minutes', false]] as const) {
        const q = at(name, y)?.map(sig) as Q5 | undefined;
        if (!q || q[2] == null || q[2] > MAX_MIN) continue;
        const cut = q.some((v) => v !== null && v > MAX_MIN) ? " Percentiles above 1e7 minutes are left out: after takeoff the model's horizon explodes to absurd lengths." : '';
        tl(`${eighty ? 'horizon80' : 'horizon50'}.${y}`, eighty ? 'horizon80' : 'horizon50', `AI task length (${eighty ? '80' : '50'}% success), ${y}`, 'min', { date: y, ...dist(q, MAX_MIN),
          notes: eighty ? `${when} Modelled: the model's horizon is the METR 80% horizon.${cut}` : `${when} Derived, not modelled: the 80% horizon times 5.08, the median ratio of the METR 50% to 80% horizons.${cut}` });
      }
      const sp = at('progress_multiplier', y)?.map(sig) as Q5 | undefined;
      if (sp && sp[2] != null) tl(`speedup.${y}`, 'other', `AI research speed-up, ${y}`, 'x', { date: y, ...dist(sp), series: 'speedup',
        notes: `${when} The model's AI software R&D progress multiplier (1 = no help from AI) at present-day resources. After takeoff the model's value runs to absurd sizes (above about 1e6): read the upper percentiles as off the scale.` });
      const ec = at('effective_compute_ooms', y)?.map(r2) as Q5 | undefined;
      if (ec && ec[2] != null) tl(`effCompute.${y}`, 'other', `Effective compute, ${y}`, 'OOM', { date: y, ...dist(ec), series: 'effCompute',
        notes: `${when} log10 of cumulative effective compute in FLOP (hardware and software efficiency together; software efficiency is 0 at 2025.13). After takeoff the upper percentiles run far beyond anything physical.` });
      if (f === trainFrom) {
        const tr = at('input_training_H100e', y);
        if (tr && tr[2] != null) tl(`trainCompute.${y}`, 'other', `Frontier training compute, ${y}`, 'H100e', { date: y, value: tr[2], series: 'trainCompute',
          notes: `${when} A model input, not an output: the config fixes it, so it is the same in all three timelines and has no band.` });
      }
    }
  }
  // the shared training-compute line is drawn from the central timeline's rows: give it to the central id whatever cluster supplied it
  for (const c of checkpoints) if (c.series === 'trainCompute') { c.timeline = 'central'; c.id = `central.trainCompute.${c.date}`; }
  return { id: split, label: sp.label, dir, timelines, checkpoints, clusterN };
}

export function loadLive(dir: string, opts: LiveOpts = {}): LiveData {
  if (!existsSync(dir)) throw new Error(`--scenarios-live: no folder ${dir}`);
  const status = readJson<LiveStatus>(join(dir, 'status.json')) ?? null;
  const ac = buildLayer(dir, 'ac', true);
  // the other splits sit beside eli_live (out/eli_split_sar, out/eli_matrix); the inputs file in the aifm-runs repo clone
  const sarDir = opts.sarDir ?? join(dir, '..', 'eli_split_sar');
  const matrixDir = opts.matrixDir ?? join(dir, '..', 'eli_matrix');
  const csv = opts.inputsCsv ?? join(dir, '..', '..', 'repo', 'inputs', 'input_data.csv');
  const sar = existsSync(join(sarDir, 'central.json')) ? buildLayer(sarDir, 'sar', false) : null;
  const matrix = readJson<unknown>(join(matrixDir, 'matrix.json')) ?? null;
  return { dir, status, timelines: ac.timelines, checkpoints: ac.checkpoints, clusterN: ac.clusterN, sar, matrix, inputs: loadInputs(csv) };
}
