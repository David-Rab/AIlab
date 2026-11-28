// Sanity bounds on one played game (design/TESTING.md §0): "nothing is absurd". Tier: full only.
//
// Guards: the integrated engine survives a whole RefBot game (tl-central, medium, seed 2027 = the fixture seed, to the
// player's ASI, endings skipped) without NaN/Infinity, with the milestones in order and in a plausible century, a
// probability that is a probability, money within ×10 of the sourced range, and NPC labs that exist and progress. The
// bounds are deliberately wide: tuning must not be able to break them, a real bug must. Tuned values are NOT checked here:
// they are calibration targets in scripts/v2/calreport/ (a balance tool).
//
// Cost: ONE game of ≈ 3300 days (≈ 3–4 CPU-min cold). It is the game safety-emu.ts's refGame plays for any seed, cached
// through simcache under the same key (seed + horizon), so a warm cache costs ≈ 0 and calreport's seed 2027 shares it.
import { START_DATE, decimalYearOf } from '../../src/engine/v2/core/time';
import { CAL_SEED } from './calseeds';
import { check, finish } from './lib';
import { refGame } from './safety-emu';

const t0 = performance.now();
const g = refGame(CAL_SEED);
const { outcome, sanity: z } = g;
const year = (d: number) => decimalYearOf(START_DATE, d);
console.log(`      game: seed ${CAL_SEED}, ${z.endDay} days (${((performance.now() - t0) / 1000).toFixed(0)} s this run; cold ≈ 3–4 CPU-min, warm ≈ 0)`);

// 1. Everything is a plain finite JSON value: the whole state at day 1, 400, 1200 and the end.
check(z.json.length >= 2 && z.json.every((j) => j.n === 0), 'no NaN, Infinity or undefined anywhere in the state at day 1, 400, 1200 and the end (validateJson)',
  z.json.map((j) => `day ${j.day}: ${j.n === 0 ? 'ok' : `${j.n} (${j.first.join('; ')})`}`).join(' | '));

// 2. Milestones SC → SAR → SIAR → ASI exist, are in order, and SC falls between 2026 and 2040 (any timeline world: tl-fast
// reaches SC in the 2020s-30s, tl-slow in the 2030s; a date outside means the clock or the research chain is broken).
const md = z.milestoneDays;
const [sc, sar, siar, asi] = [md[3], md[4], md[5], md[6]];
check([sc, sar, siar, asi].every((d) => d !== undefined) && sc <= sar && sar <= siar && siar <= asi, 'milestones SC, SAR, SIAR, ASI are all reached, in that order',
  `SC ${sc}, SAR ${sar}, SIAR ${siar}, ASI ${asi} (days)`);
check(sc !== undefined && year(sc) >= 2026 && year(sc) <= 2040, 'SC falls between 2026 and 2040', sc === undefined ? 'no SC' : year(sc).toFixed(2));

// 3. P_mis at ASI is a probability strictly inside (0, 1): 0 or 1 means the draw or the hazard is degenerate.
check(Number.isFinite(outcome.mis) && outcome.pmis > 0 && outcome.pmis < 1, 'P_mis at ASI is strictly inside (0, 1)', `P_mis ${outcome.pmis.toFixed(4)}, Mis ${outcome.mis.toFixed(3)}`);

// 4. Player revenue within ×10 of the sourced bands worldfx.ts used: 2026 $45B (AI 2027) to $53–56B (Anthropic CY2026,
// research/22 §4) → $4.5–560B; 2027 ~$140B → $14–1,400B.
const r26 = z.revenue[2026], r27 = z.revenue[2027];
check(r26 >= 4.5 && r26 <= 560, 'player revenue 2026 within ×10 of the sourced $45–56B ($4.5–560B)', `$${r26?.toFixed(1)}B`);
check(r27 >= 14 && r27 <= 1400, 'player revenue 2027 within ×10 of the sourced ~$140B ($14–1,400B)', `$${r27?.toFixed(1)}B`);

// 5. Money: cash never absurdly negative (a lab can run a deficit on credit lines; −$10T would be a bug, ×10 of the world's
// largest capex plans), valuation finite and positive throughout.
check(Number.isFinite(z.minCash) && z.minCash > -10000, 'cash never falls below −$10,000B (an absurd overdraft)', `min $${z.minCash.toFixed(1)}B`);
check(Number.isFinite(z.minValuation) && Number.isFinite(z.maxValuation) && z.minValuation > 0, 'valuation is finite and positive throughout', `$${z.minValuation.toFixed(1)}B – $${z.maxValuation.toFixed(0)}B`);

// 6. NPC labs: every rival still active at the end has a finite G at every sample and a higher G at the end than at the start.
const live = z.rivalG.filter((r) => r.active && r.g.length >= 2);
check(live.length > 0 && live.every((r) => r.g.every(Number.isFinite) && r.g[r.g.length - 1] > r.g[0]), 'NPC labs: G finite and higher at the end than at the start (every rival active at the end)',
  live.map((r) => `${r.id} ${r.g[0]?.toFixed(1)} → ${r.g[r.g.length - 1]?.toFixed(1)}`).join(', '));

finish('sanity');
