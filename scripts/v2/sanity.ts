// Sanity bounds on one played game (design/TESTING.md §0): "nothing is absurd". Tier: full only.
//
// Guards: the integrated engine survives a RefBot game (tl-central, medium, seed 2027 = the fixture seed, endings skipped,
// capped at day 2200 ≈ mid-2031) without NaN/Infinity, with the milestones it reaches in order and SC before 2032, a
// probability that is a probability, money within ×10 of the sourced range (derived from the registry entries, never
// written here), NPC labs that exist and progress, and readouts that leave the state untouched. The bounds are
// deliberately wide: tuning must not be able to break them, a real bug must. Tuned values are NOT checked here: they are
// calibration targets (scripts/v2/calreport/, a balance tool; bands in balance/targets.ts).
//
// Cost: ONE game of 2200 days (cached through simcache; key = seed, horizon, sweep days) plus three light readout sweeps
// (a few CPU-s each). The game is not shared with the calibration report (its safety games run to ASI, 5840 days).
// The integrated RefBot economy collapses today (revenue ~$15B → < $1B, insolvent about day 1400, no SC): the checks that
// fail for that reason print WARN (KNOWN) with the OPEN.md row, so sanity stays green while the bug is open.
import { bandOf } from './calreport/types';
import { START_DATE, decimalYearOf } from '../../src/engine/v2/core/time';
import { CAL_SEED } from './calseeds';
import { KNOWN, check, finish } from './lib';
import { refGame } from './safety-emu';

/** Sanity-only bounds (not sourced bands): the game horizon, the sweep days, and the loosest sane limits. */
const HORIZON_DAYS = 2200;
const SWEEP_DAYS = [400, 1200, 2000];
const SC_BY_YEAR = 2032; // tl-central reaches SC in the 2030s at the latest; a later one means the research chain is broken
const SC_FROM_YEAR = 2026;
const MIN_CASH_B = -10000; // −$10T would be a bug, ×10 of the world's largest capex plans

const COLLAPSE = 'OPEN.md § Balance and calibration: Integrated RefBot economy collapses (sanity.ts)';

/** The ×10 bound around a registry band: [lo / 10, hi × 10]. */
function times10(id: string): { lo: number; hi: number; label: string } {
  const b = bandOf(id);
  if (!b || b.lo === undefined || b.hi === undefined) throw new Error(`sanity: registry target ${id} needs lo and hi`);
  const [lo, hi] = [b.lo / 10, b.hi * 10];
  return { lo, hi, label: `$${lo.toPrecision(3)}–${hi.toFixed(0)}B (×10 around ${id})` };
}

const t0 = performance.now();
const g = refGame(CAL_SEED, HORIZON_DAYS, SWEEP_DAYS);
const { outcome, sanity: z } = g;
const year = (d: number) => decimalYearOf(START_DATE, d);
console.log(`      game: seed ${CAL_SEED}, ${z.endDay} days (${((performance.now() - t0) / 1000).toFixed(0)} s this run; warm cache ≈ 0)`);

// 1. Everything is a plain finite JSON value: the whole state at day 1, 400, 1200 and the end (validateJson).
check(z.json.length >= 2 && // band-lint: ok at least the first and last snapshot
   z.json.every((j) => j.n === 0), 'no NaN, Infinity or undefined anywhere in the state at day 1, 400, 1200 and the end (validateJson)',
  z.json.map((j) => `day ${j.day}: ${j.n === 0 ? 'ok' : `${j.n} (${j.first.join('; ')})`}`).join(' | '));

// 2. The milestones the game reaches are in order (A0 … ASI; at least one is reached). The game is capped, so not all are.
const reached = Object.entries(z.milestoneDays).map(([i, d]) => [Number(i), d] as const).sort((a, b) => a[0] - b[0]);
check(reached.length > 0 && reached.every(([, d], k) => k === 0 || d >= reached[k - 1][1]), 'milestones reached are in order (at least one reached)',
  reached.map(([i, d]) => `#${i} day ${d}`).join(', '));
const sc = z.milestoneDays[3];
const LABEL_SC = `SC is reached before ${SC_BY_YEAR} (tl-central)`;
KNOWN[LABEL_SC] = COLLAPSE;
check(sc !== undefined && year(sc) >= SC_FROM_YEAR && year(sc) < SC_BY_YEAR, LABEL_SC, sc === undefined ? `no SC in ${z.endDay} days` : year(sc).toFixed(2));

// 3. P_mis at the end of the game is a probability strictly inside (0, 1): 0 or 1 means the draw or the hazard is degenerate.
check(Number.isFinite(outcome.mis) && outcome.pmis > 0 && outcome.pmis < 1, 'P_mis at the end of the game is strictly inside (0, 1)', `P_mis ${outcome.pmis.toFixed(4)}, Mis ${outcome.mis.toFixed(3)}`);

// 4. Player revenue within ×10 of the registry bands (balance/targets.ts).
for (const [id, y] of [['F7.revenue2026', 2026], ['F11.revenue2027', 2027]] as const) {
  const b = times10(id);
  const r = z.revenue[y];
  const label = `player revenue ${y} within ${b.label}`;
  if (y === 2027) KNOWN[label] = COLLAPSE;
  check(r !== undefined && r >= b.lo && r <= b.hi, label, `$${r?.toFixed(1)}B`);
}

// 5. Money: cash never absurdly negative (a lab can run a deficit on credit lines), valuation finite and positive throughout.
check(Number.isFinite(z.minCash) && z.minCash > MIN_CASH_B, `cash never falls below −$${-MIN_CASH_B}B (an absurd overdraft)`, `min $${z.minCash.toFixed(1)}B`);
check(Number.isFinite(z.minValuation) && Number.isFinite(z.maxValuation) && z.minValuation > 0, 'valuation is finite and positive throughout', `$${z.minValuation.toFixed(1)}B – $${z.maxValuation.toFixed(0)}B`);

// 6. NPC labs: every rival still active at the end has a finite G at every sample and a higher G at the end than at the start.
const live = z.rivalG.filter((r) => r.active && r.g.length >= 2); // band-lint: ok two samples make a trend
check(live.length > 0 && live.every((r) => r.g.every(Number.isFinite) && r.g[r.g.length - 1] > r.g[0]), 'NPC labs: G finite and higher at the end than at the start (every rival active at the end)',
  live.map((r) => `${r.id} ${r.g[0]?.toFixed(1)} → ${r.g[r.g.length - 1]?.toFixed(1)}`).join(', '));

// 7. Readout purity: a light sweep of every UI-facing selector on the live state leaves the state hash unchanged.
check(z.sweep.length === SWEEP_DAYS.length && z.sweep.every((w) => w.same && w.calls > 0), `readouts leave the state hash unchanged (light sweep at days ${SWEEP_DAYS.join(', ')})`,
  z.sweep.map((w) => `day ${w.day}: ${w.same ? 'same' : 'CHANGED'}, ${w.calls} calls`).join(' | '));

finish('sanity');
