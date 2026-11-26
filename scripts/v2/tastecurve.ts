// Component check (design/bal/STAGE1-DESIGN.md, "Revision ... corrected"): does the game's taste + ideation, together,
// multiply research progress the way the AI Futures Model's (AIFM) aggregate research taste does, across AI capability?
// MEASURE ONLY: no game mechanic is changed; the game side calls the engine's own functions on a state with G overridden.
//   npx tsx scripts/v2/tastecurve.ts            writes balance/mechanics/tastecurve.json and prints a table every 1.0 G
//   AIFM_RUN=<dir with median_trajectory_rollout.jsonl, median_parameters.json, median_trajectory_milestones.csv>
//
// x axis: the game's G (log10 effective compute, OOM), from G0 = 27.7 to G0 + 14 in 0.25 steps.
// AIFM side (progress_model/taste_distribution.py, progress_rate.py:233-290, _impl.py:1377-1400), at Eli's medians:
//   human taste T = transform(mu + sigma z), z ~ N(0,1), transform(x) = exp(lnA (1 - exp(-x/lnA))) (smoothing 0.5, the Cobb-Douglas
//   form), A = m2b^(1+limit); mu, sigma fitted so top(99.9%) / median = m2b and mean = 1.
//   AI taste F(EC) = transform(mu + sd(EC) sigma), sd(EC) = anchor_sd + slope_per_oom (EC - EC_AC), slope_per_oom = slope per
//   progress-year / anchor progress rate (2.3 / 1.574 = 1.46 SD per OOM); EC = the AIFM's effective compute (OOM).
//   aggregate taste = E[max(T, F)] over the whole workforce (get_mean_with_floor): the AIFM's human/AI mix. It multiplies the
//   CES(experiment compute, coding labour) research effort (progress_rate.py:122).
// G -> EC mapping (an approximation; see the notes in the JSON): both are log10 effective compute on the same ruler. The project's
//   own calibration precedent (workTypes.ts CAL2-T) puts G_V0 = 27.627 at the AIFM progress of V0's date (2025.445), i.e.
//   EC = G - 27.627 + EC(2025.445). That is the primary mapping ("date"). Because the presets place SC at different G (ai2027 30.15,
//   fast 31.25) than Eli's AI2027-SC EC, a second mapping per preset aligns the SC milestones ("sc"): EC = EC_SC + (G - gSC).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tasteSigma } from '../../src/engine/v2/production/ces';
import { QUALITY_TASTE_SD } from '../../src/data/v2/workTypes';
import { flowStats, lineRate, linePool, stagesOf } from '../../src/engine/v2/models/research';
import { TREE } from '../../src/data/v2/tree';
import { resetWorkContext, teamTaste, tasteLimitOf, workContext } from '../../src/engine/v2/departments/workfit';
import { agentVersion } from '../../src/engine/v2/departments/agents';
import { newBotGame } from './botgame';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');

// ───────────────────────────── AIFM side ─────────────────────────────

const Z999 = 3.090232306167813;
const phi = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
/** Standard normal grid for the expectations (trapezoid, 4001 points on [-10, 10]; the AIFM uses 2000). */
const ZG: number[] = [];
const ZW: number[] = [];
for (let i = 0; i <= 4000; i++) { const z = -10 + (20 * i) / 4000; ZG.push(z); ZW.push(phi(z) * (20 / 4000)); }

interface TasteDist { mu: number; sigma: number; A: number; lnA: number; T: (x: number) => number; invT: (t: number) => number }
/** TasteDistribution (taste_distribution.py:82-300) at smoothing 0.5: calibrate mu, sigma to top/median = m2b and mean = 1. */
function tasteDist(m2b: number, limit: number): TasteDist {
  const A = Math.pow(m2b, 1 + limit);
  const lnA = Math.log(A);
  const logT = (x: number) => lnA * (1 - Math.exp(-Math.max(-700, Math.min(700, x / lnA))));
  const T = (x: number) => Math.min(A, Math.exp(logT(x)));
  const invT = (t: number) => (t <= 0 ? -Infinity : t >= A ? Infinity : -lnA * Math.log(1 - Math.log(t) / lnA));
  const res = (mu: number, sg: number): [number, number] => {
    let mean = 0;
    for (let i = 0; i < ZG.length; i++) mean += T(mu + sg * ZG[i]) * ZW[i];
    return [logT(mu + sg * Z999) - logT(mu) - Math.log(m2b), mean - 1];
  };
  let sg = Math.log(m2b) / Z999;
  let mu = -0.5 * sg * sg;
  for (let it = 0; it < 60; it++) { // Newton on (mu, ln sigma) with a numerical Jacobian
    const r = res(mu, sg);
    if (Math.abs(r[0]) < 1e-12 && Math.abs(r[1]) < 1e-12) break;
    const h = 1e-6;
    const a = res(mu + h, sg), b = res(mu, sg * Math.exp(h));
    const j11 = (a[0] - r[0]) / h, j21 = (a[1] - r[1]) / h, j12 = (b[0] - r[0]) / h, j22 = (b[1] - r[1]) / h;
    const det = j11 * j22 - j12 * j21;
    mu -= (r[0] * j22 - r[1] * j12) / det;
    sg *= Math.exp(-(j11 * r[1] - j21 * r[0]) / det);
  }
  return { mu, sigma: sg, A, lnA, T, invT };
}
/** E[max(T, F)] over the human distribution (get_mean_with_floor, compute_aggregate_research_taste). */
function meanWithFloor(d: TasteDist, F: number): number {
  let s = 0;
  for (let i = 0; i < ZG.length; i++) s += Math.max(d.T(d.mu + d.sigma * ZG[i]), F) * ZW[i];
  return s;
}

interface AifmP { m2b: number; limit: number; slope: number; anchorSd: number }
interface AifmTraj { times: number[]; progress: number[]; ec: number[]; sd: number[]; agg: number[]; rate: number; ecAC: number; ecSC: number; ecAt: (t: number) => number }
function loadAifm(): { p: AifmP; traj: AifmTraj; dir: string } {
  let dir = process.env.AIFM_RUN ?? join(ROOT, '../aifm-runs/out/eli_3');
  if (!existsSync(join(dir, 'median_parameters.json'))) dir = join(dir, readdirSync(dir).sort().reverse()[0]);
  const mp = JSON.parse(readFileSync(join(dir, 'median_parameters.json'), 'utf8')).model_parameters;
  const R = JSON.parse(readFileSync(join(dir, 'median_trajectory_rollout.jsonl'), 'utf8').split('\n')[0]).results;
  const ms = Object.fromEntries(readFileSync(join(dir, 'median_trajectory_milestones.csv'), 'utf8').trim().split('\n').slice(1).map((l) => { const c = l.split(','); return [c[0], Number(c[3])]; }));
  const ecAt = (t: number) => { const ts: number[] = R.times; let i = ts.findIndex((x) => x >= t); if (i <= 0) i = 1; const w = (t - ts[i - 1]) / (ts[i] - ts[i - 1]); return R.effective_compute[i - 1] * (1 - w) + R.effective_compute[i] * w; };
  return {
    dir,
    p: { m2b: mp.median_to_top_taste_multiplier, limit: mp.taste_limit, slope: mp.ai_research_taste_slope, anchorSd: mp.ai_research_taste_at_coding_automation_anchor_sd },
    traj: { times: R.times, progress: R.progress, ec: R.effective_compute, sd: R.ai_research_taste_sd, agg: R.aggregate_research_taste, rate: R.anchor_progress_rate, ecAC: ms['AC'], ecSC: ms['AI2027-SC'], ecAt },
  };
}

/** The AIFM's aggregate research taste at effective compute `ec` for parameters p (AI SD per OOM = slope per year / anchor rate). */
function aifmTaste(p: AifmP, d: TasteDist, rate: number, ecAC: number, ec: number): { sd: number; agg: number } {
  const sd = Math.min(100, p.anchorSd + (p.slope / rate) * (ec - ecAC));
  return { sd, agg: meanWithFloor(d, d.T(d.mu + sd * d.sigma)) };
}

// ───────────────────────────── game side ─────────────────────────────

interface GameRow { sd: number; sAI: number; m: number; q: number; qFull: number }
/** The game's taste inputs at general G `g` on a lab state (start lab; `computeScale` × its compute), by the engine's own
 *  functions: workContext (sd_AI = sdAIOf of the frontier-research model's IDEAS fit, AI's ideas share, AI labour multiplier on
 *  ideas) and teamTaste (E[max(human, AI)] on the AIFM lognormal, saturated at A = m2b^(1+limit)). */
function gameCurve(world: 'ai2027' | 'fast', gs: number[], computeScale: number): GameRow[] {
  const s = newBotGame(1, { world, alignment: 'medium' }, 'leader');
  const v = agentVersion(s, 'capFrontier')!;
  (v as { build?: unknown }).build = undefined; // a version without a build reads its general G (versionDomainG)
  s.player.computeOnline *= computeScale;
  const m2b = s.hidden.timeline.prod.m2b;
  const tl = tasteLimitOf(s.hidden.timeline);
  const z = QUALITY_TASTE_SD.strong; // 1 = a Strong team without AI
  return gs.map((g) => {
    v.G = g;
    resetWorkContext(s);
    const wc = workContext(s);
    const q = teamTaste(z, wc.sdAI, wc.sAI, m2b, 1, tl);
    const qFull = teamTaste(z, wc.sdAI, 1, m2b, 1, tl);
    return { sd: wc.sdAI, sAI: wc.sAI, m: wc.slots.IDEAS.m, q, qFull };
  });
}
function gamePresetInfo(world: 'ai2027' | 'fast') {
  const s = newBotGame(1, { world, alignment: 'medium' }, 'leader');
  const w = s.hidden.timeline;
  return { gSC: w.v3.gSC, dBM: w.v3.dBM, sdSC: w.v3.sdSC, limit: tasteLimitOf(w), m2b: w.prod.m2b, lam: w.prod.lam, r: w.v3.r };
}

// ───────────────────────────── run ─────────────────────────────

const G0 = 27.7;
const X: number[] = [];
for (let i = 0; i <= 56; i++) X.push(Math.round((G0 + 0.25 * i) * 100) / 100);
const rel = (a: number[]) => a.map((x) => x / a[0]);
const r4 = (x: number) => Number(x.toPrecision(5));

const { p, traj, dir } = loadAifm();
const G_V0_PRECEDENT = 27.627; // workTypes.ts CAL2-T: G(V0) read at the AIFM's progress of V0's date 2025.445
const ecV0 = traj.ecAt(2025.445);
const ecOfG = (g: number) => ecV0 + (g - G_V0_PRECEDENT);

// Quantiles of the sampled parameters (sampling_config.yaml:176-195 and eli.yaml:110-116): lognormal with 80% CI [lo, hi].
const q80 = (lo: number, hi: number, zq: number) => Math.sqrt(lo * hi) * Math.exp(zq * (Math.log(hi / lo) / (2 * 1.2815515655446004)));
const Z75 = 0.6744897501960817;
const slopeQ = { p25: q80(0.8, 6.6125, -Z75), p75: q80(0.8, 6.6125, Z75) }; // Eli's slope per progress-year (median 2.3)
const limitQ = { p25: q80(2, 32, -Z75), p75: q80(2, 32, Z75) }; // taste_limit (median 8)

const dMed = tasteDist(p.m2b, p.limit);
const dLim = { p25: tasteDist(p.m2b, limitQ.p25), p75: tasteDist(p.m2b, limitQ.p75) };
const aifmAt = (pp: AifmP, d: TasteDist, ecOf: (g: number) => number) => X.map((g) => aifmTaste(pp, d, traj.rate, traj.ecAC, ecOf(g)));
const medRaw = aifmAt(p, dMed, ecOfG);
/** Band: the envelope of the four (slope, limit) corners at p25 / p75, each relative to its own value at the first point. The
 *  taste is not monotone in the slope (the SD line pivots at AC: a steeper slope is lower before AC, higher after), so the
 *  envelope, not the (low, low) and (high, high) pair, bounds it. Parameter correlations are ignored. */
function band(ecOf: (g: number) => number): { lo: number[]; hi: number[] } {
  const cs = (['p25', 'p75'] as const).flatMap((sl) => (['p25', 'p75'] as const).map((li) => rel(aifmAt({ ...p, slope: slopeQ[sl], limit: limitQ[li] }, dLim[li], ecOf).map((a) => a.agg))));
  return { lo: X.map((_, i) => Math.min(...cs.map((c) => c[i]))), hi: X.map((_, i) => Math.max(...cs.map((c) => c[i]))) };
}
const bandDate = band(ecOfG);
// Check of this port against the AIFM's own median trajectory output (aggregate_research_taste vs its SD).
let maxErr = 0;
for (let i = 0; i < traj.times.length; i += 5) {
  const sd = traj.sd[i];
  if (!(sd > -8 && sd < 30)) continue;
  const a = meanWithFloor(dMed, dMed.T(dMed.mu + sd * dMed.sigma));
  maxErr = Math.max(maxErr, Math.abs(a / traj.agg[i] - 1));
}

const info = { ai2027: gamePresetInfo('ai2027'), fast: gamePresetInfo('fast') };
const out: Record<string, unknown> = {};
const game: Record<string, Record<string, unknown>> = {};
const gameRaw: Record<string, { rows: GameRow[]; rows10: GameRow[] }> = {};
const scAligned: Record<string, { median: number[]; p25: number[]; p75: number[] }> = {};
for (const world of ['ai2027', 'fast'] as const) {
  const rows = gameCurve(world, X, 1);
  const rows10 = gameCurve(world, X, 10);
  gameRaw[world] = { rows, rows10 };
  const lam = info[world].lam;
  const taste = rel(rows.map((r) => r.q));
  const ideation = rows.map((r) => Math.pow(r.m / rows[0].m, lam));
  const ideation10 = rows10.map((r) => Math.pow(r.m / rows10[0].m, lam));
  const q10 = rel(rows10.map((r) => r.q));
  // (b) taste's factor in q, the research input a line result brings: the game's line law lineRate (research.ts:101) on the
  // pretraining line's real pool (linePool: n0, r), fresh (M = n0) and aged (M = 10 n0).
  const sW = newBotGame(1, { world, alignment: 'medium' }, 'leader');
  const line = (TREE as any[]).filter((n) => n.kind === 'line' && n.effect?.stack).sort((a, b) => (b.effect.rShare ?? 0) - (a.effect.rShare ?? 0))[0];
  const pl = linePool(sW, line);
  const perIdea = rows.map((r) => lineRate(pl.r, pl.n0, r.q) / lineRate(pl.r, pl.n0, rows[0].q));
  const perIdeaAged = rows.map((r) => lineRate(pl.r, 10 * pl.n0, r.q) / lineRate(pl.r, 10 * pl.n0, rows[0].q));
  // (c) the line's research input per day, as stepFlow computes it (research.ts:1018-1038): ideas ideated per day (ideasFull,
  // :1106, ∝ (mIdeas·cap)^λ·q) and tested at k = min(ideas/ι, work/w); gain = k·g·lineRate(r, M, q) with ι, w, g from the
  // game's flowStats at taste q and ρ = ideas·(small+scale)/work. Two regimes: idea-limited (experiment work not binding) and
  // experiment-limited (work fixed at twice what G0's ideas need).
  const sg = stagesOf(line);
  const flow = (limited: 'ideas' | 'exp') => {
    const work = limited === 'ideas' ? 1e9 : 1;
    const c = limited === 'ideas' ? 1 : (work * 2) / (sg.small + sg.scale) / (Math.pow(rows[0].m, lam) * rows[0].q);
    const gain = (r: GameRow) => {
      const ideas = c * Math.pow(r.m, lam) * r.q;
      const f = flowStats(line, 0, r.q, Math.max(1, (ideas * (sg.small + sg.scale)) / work));
      const k = Math.min(ideas / Math.max(1e-12, f.iota), work / Math.max(1e-12, f.w));
      return k * f.g * lineRate(pl.r, pl.n0, r.q);
    };
    const g0 = gain(rows[0]);
    return rows.map((r) => gain(r) / g0);
  };
  const flowIdeas = flow('ideas');
  const flowExp = flow('exp');
  game[world] = {
    preset: info[world],
    taste: taste.map(r4),
    ideation: ideation.map(r4),
    total: taste.map((t, i) => r4(t * ideation[i])),
    tasteFull: rel(rows.map((r) => r.qFull)).map(r4),
    perIdeaLineRate: perIdea.map(r4),
    perIdeaLineRateAged: perIdeaAged.map(r4),
    totalIdeaLimited: taste.map((t, i) => r4(t * ideation[i] * perIdea[i])),
    lineInputIdeaLimited: flowIdeas.map(r4),
    lineInputExpLimited: flowExp.map(r4),
    linePool: { id: line.id, r: pl.r, n0: pl.n0 },
    total_compute10x: q10.map((t, i) => r4(t * ideation10[i])),
    ideation_compute10x: ideation10.map(r4),
    sdAI: rows.map((r) => r4(r.sd)),
    aiIdeasShare: rows.map((r) => r4(r.sAI)),
    mIdeas: rows.map((r) => r4(r.m)),
  };
  const ecSC = (g: number) => traj.ecSC + (g - info[world].gSC);
  const b = band(ecSC);
  scAligned[world] = { median: rel(aifmAt(p, dMed, ecSC).map((a) => a.agg)).map(r4), p25: b.lo.map(r4), p75: b.hi.map(r4) };
}
const aifmMed = rel(medRaw.map((a) => a.agg));
Object.assign(out, {
  generated: new Date().toISOString(),
  x: X,
  note: 'Multipliers relative to the first grid point (G 27.7, today). aifm = Eli median params; game = engine functions on the start lab with G overridden, labour and compute fixed.',
  aifm: {
    source: dir,
    medianParams: { ...p, smoothing: 0.5 },
    band: { slopePerYear: slopeQ, limit: limitQ, note: 'envelope (min/max) of the four (slope, limit) combinations at p25 / p75, relative to each own G0 value; correlations ignored' },
    mapping: {
      primary: `date: EC = G - ${G_V0_PRECEDENT} + EC(2025.445) = G - ${r4(G_V0_PRECEDENT - ecV0)} (workTypes.ts CAL2-T precedent)`,
      ecV0: r4(ecV0), anchorProgressRate: r4(traj.rate), slopePerOOM: r4(p.slope / traj.rate), ecAC: traj.ecAC, ecSC: traj.ecSC,
      approximation: 'Same ruler (log10 effective compute) with an offset fixed at one date; the game G and AIFM EC grow at different rates per year, and the presets place SC at different G.',
      portCheckMaxRelErrVsAifmMedianTrajectory: r4(maxErr),
    },
    ec: X.map((g) => r4(ecOfG(g))),
    sd: medRaw.map((a) => r4(a.sd)),
    medianAbs: medRaw.map((a) => r4(a.agg)),
    median: aifmMed.map(r4),
    p25: bandDate.lo.map(r4),
    p75: bandDate.hi.map(r4),
    scAligned,
  },
  game,
});
mkdirSync(join(ROOT, 'balance/mechanics'), { recursive: true });
writeFileSync(join(ROOT, 'balance/mechanics/tastecurve.json'), JSON.stringify(out, null, 1));

// ───────────────────────────── table ─────────────────────────────
const f = (x: number) => (x >= 1000 ? x.toExponential(1) : x >= 100 ? x.toFixed(0) : x.toFixed(2));
console.log(`AIFM run ${dir}; port max rel err vs its trajectory ${(maxErr * 100).toFixed(2)}%; EC = G - ${(G_V0_PRECEDENT - ecV0).toFixed(3)}; slope ${(p.slope / traj.rate).toFixed(3)} SD/OOM; limit p25/50/75 ${limitQ.p25.toFixed(2)}/${p.limit}/${limitQ.p75.toFixed(2)}, slope/yr p25/p75 ${slopeQ.p25.toFixed(2)}/${slopeQ.p75.toFixed(2)}`);
console.log('G    | AIFM: sd   med  [p25 .. p75]  | ai2027: sd   total taste ideat  | fast: sd   total taste ideat');
for (let i = 0; i < X.length; i += 4) {
  const a = out.aifm as { sd: number[]; median: number[]; p25: number[]; p75: number[] };
  const g1 = game.ai2027, g2 = game.fast;
  const c = (g: Record<string, unknown>) => `${f((g.sdAI as number[])[i]).padStart(6)} ${f((g.total as number[])[i]).padStart(8)} ${f((g.taste as number[])[i]).padStart(7)} ${f((g.ideation as number[])[i]).padStart(7)}`;
  console.log(`${X[i].toFixed(2)} | ${f(a.sd[i]).padStart(6)} ${f(a.median[i]).padStart(7)} [${f(a.p25[i])} .. ${f(a.p75[i])}] | ${c(g1)} | ${c(g2)}`);
}
// A reference for the report: G0 + 1, 2, 4, 6, 8.
console.log('\nG0+d | AIFM med (p25..p75) | ai2027 total / taste / ideation | fast total / taste / ideation');
for (const d of [1, 2, 4, 6, 8]) {
  const i = Math.round(d / 0.25);
  const a = out.aifm as { median: number[]; p25: number[]; p75: number[]; scAligned: typeof scAligned };
  const c = (w: 'ai2027' | 'fast') => { const g = game[w]; const sc = a.scAligned[w]; return `AIFM-sc ${f(sc.median[i])} (${f(sc.p25[i])}..${f(sc.p75[i])}) | game ${f((g.total as number[])[i])} / ${f((g.taste as number[])[i])} / ${f((g.ideation as number[])[i])}`; };
  console.log(`+${d} | AIFM-date ${f(a.median[i])} (${f(a.p25[i])}..${f(a.p75[i])}) | ${c('ai2027')} | ${c('fast')}`);
}
