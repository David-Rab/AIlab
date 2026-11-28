// Calibration targets: safety (moved from safety.ts S4/S5 and safetyrates.ts' RefBot-game rows; design/TESTING.md §0).
//   S4  P_mis at ASI: RefBot/medium and the safe-only recipe (S4.refBot.pMis, S4.safeRecipe.pMis).
//   S5  Mixed bot: its sight limit at SAR is above RefBot's (mean over worlds); half staffing deepens the lag (paired).
//   E10 RefBot-game rates (research/20 F): eval awareness at the start and 2026-12-31, the AF compliance gap a behavioural
//       eval reads at 2026-12-31, persistence of SCHEME through RefBot's post runs.
// Games (all through simcache): RefBot to ASI, seeds 500… (safety-emu refGame, one game per seed serves S4 and the rates);
// the safe-only recipe to ASI, seeds 700…; the Mixed bot to SAR, seeds 900…; RefBot with half the safety teams to SAR, seeds
// 500… (paired with RefBot's own SAR reads). tl-central reaches ASI around day 3300 (SAR ≈ 2500): ≈ 3–4 CPU-min per game to ASI cold,
// ≈ 2–3 to SAR; at the default seed counts ≈ 2 CPU-hours cold, so use CALREPORT_SEEDS for a quick look.
// Env: CALREPORT_SEEDS=n caps every list (defaults: 20 RefBot, 12 for the rates, 16 safe-only, 10 Mixed, 20 half-staff).
//
// Seed arithmetic (S4): per-world P_mis has sd ≈ 0.31 (B-heavy.md's estimate; not re-measured). The REF band (S4.refBot.pMis)
// is 0.4 wide and the authors' credences are the sourced centre, so 20 worlds give se = 0.31/√20 = 0.07: a mean at the
// band centre is 2.9 se from either edge. SAFE has a one-sided bound and sd ≈ 0.25 → 16 worlds se 0.06. S5 Mixed
// compares two means (Mixed U vs RefBot's worlds) on U with sd ≈ 0.5 levels; 10 worlds se 0.16.
import { fileURLToPath } from 'node:url';
import { GAME_DAYS, MIXED, REF_HALF_STAFF, SAFE, play, refGame, type Outcome } from '../safety-emu';
import { cached } from '../simcache';
import type { AlignDiffId, BotPolicy } from '../../../src/engine/v2/types';
import { rowOf, type Target } from './types';

export const area = 'safety';

const ME = fileURLToPath(import.meta.url);
const EMU = fileURLToPath(new URL('../safety-emu.ts', import.meta.url));
const cap = (dflt: number) => Math.min(dflt, Math.max(1, Number(process.env.CALREPORT_SEEDS ?? dflt)));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const median = (xs: number[]) => {
  const a = [...xs].sort((p, q) => p - q);
  if (!a.length) return NaN;
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const quant = (xs: number[], p: number) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))] : NaN;
};
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const spread = (xs: number[]) => `${(median(xs) * 100).toFixed(1)}% [${(quant(xs, 0.1) * 100).toFixed(1)}–${(quant(xs, 0.9) * 100).toFixed(1)}] over ${xs.length}`;
const alignment: AlignDiffId = 'medium';
/** play() through the simulation cache (the record is the Outcome). */
const playC = (bot: BotPolicy, seed: number, stopAt: 'asi' | 'sar', variant = ''): Outcome =>
  cached('calreport-safety-play', { bot: bot.id, variant, seed, stopAt, alignment, maxDay: GAME_DAYS }, [ME, EMU], () => play(bot, seed, stopAt, alignment, undefined, undefined, GAME_DAYS));

export function targets(): Target[] {
  const out: Target[] = [];
  const nRef = cap(20), nRates = cap(12), nSafe = cap(16), nMixed = cap(10), nHalf = cap(20);
  const refSeeds = (n: number) => Array.from({ length: n }, (_, i) => 500 + i); // band-lint: ok seed numbering
  const ref = refSeeds(nRef).map((sd) => refGame(sd).outcome);
  const safe = Array.from({ length: nSafe }, (_, i) => playC(SAFE, 700 + i, 'asi'));
  const refP = mean(ref.map((o) => o.pmis));
  const safeP = mean(safe.map((o) => o.pmis));

  // S4 (CAL2-S): P_mis averaged over worlds is the chance that the reference lab (no slowdown, AI 2027's safety share) reaches an ASI
  // misaligned past the world's tolerance. Band and source: balance/targets.ts S4.refBot.pMis and S4.safeRecipe.pMis.
  out.push(rowOf('S4.refBot.pMis', `${refP.toFixed(3)} (${nRef} worlds; Mis mean ${mean(ref.map((o) => o.mis)).toFixed(3)}, ASI day ≈ ${mean(ref.map((o) => o.asiDay ?? 0)).toFixed(0)})`, refP));
  out.push(rowOf('S4.safeRecipe.pMis', `${safeP.toFixed(3)} (${nSafe} worlds)`, safeP));

  // S5: Mixed bot vs RefBot sight limit at SAR (CAL2-S designer decision 4). Sight limit = the highest level the lab's
  // instruments read hidden-goal traits at ≥ 50% believed reliability; a lab that funds safety more than AI 2027's
  // reference lab sees further at SAR. Unpaired worlds (Mixed seeds 900+, RefBot 500+): means over the worlds that reach SAR.
  const mixed = Array.from({ length: nMixed }, (_, i) => playC(MIXED, 900 + i, 'sar'));
  const mixU = mixed.flatMap((o) => (o.uAtSar !== undefined ? [o.uAtSar] : []));
  const refSar = ref.flatMap((o) => (o.sar ? [o.sar] : []));
  const refU = refSar.map((r) => r.u);
  out.push(rowOf('S5.mixedVsRef.sightLimit', `Mixed ${mean(mixU).toFixed(2)} (median ${median(mixU).toFixed(2)}, ${mixU.length} worlds) vs RefBot ${mean(refU).toFixed(2)} (median ${median(refU).toFixed(2)}, ${refU.length})`, mixU.length > 0 && mean(mixU) > mean(refU)));

  // S5 half staff (was deep tier): the same RefBot worlds, half the safety science teams, played to SAR; the lag (U − L,
  // believed and true) deepens. Paired worlds (RefBot seeds 500…); "deepens" = the mean U − L at SAR is lower.
  const half = Array.from({ length: nHalf }, (_, i) => playC(REF_HALF_STAFF, 500 + i, 'sar', 'halfStaff')).flatMap((o) => (o.sar ? [o.sar] : []));
  const base = refSeeds(nHalf).flatMap((sd) => { const o = refGame(sd).outcome; return o.sar ? [o.sar] : []; });
  const m = (xs: number[]) => mean(xs);
  const g = half.map((r) => r.margin), g0 = base.map((r) => r.margin), tg = half.map((r) => r.trueGap), tg0 = base.map((r) => r.trueGap);
  const below = (xs: number[]) => xs.filter((x) => x < 0).length / Math.max(1, xs.length);
  out.push(rowOf('S5.halfStaffDeepensLag', `mean U − L ${m(g).toFixed(2)} vs ${m(g0).toFixed(2)} (RefBot), U < L in ${pct(below(g))} vs ${pct(below(g0))}; true ${m(tg).toFixed(2)} vs ${m(tg0).toFixed(2)}, ${pct(below(tg))} vs ${pct(below(tg0))} (${half.length} / ${base.length} worlds)`, half.length > 0 && g.length === g0.length && m(g) < m(g0) && m(tg) < m(tg0)));

  // E10 rates on RefBot's games (research/20 F; design/MODEL-V3.md §11.8). Rows rate constants cannot bring into band
  // were WARN with the mechanism they need (safetyrates.ts, E10 report design/archive/notes/E10.md).
  const rates = refSeeds(nRates).map((sd) => refGame(sd).rates);
  const band = (id: string, xs: number[]) => {
    const ys = xs.filter(Number.isFinite);
    out.push(rowOf(id, `${spread(ys)} (median over ${ys.length} RefBot games)`, median(ys)));
  };
  // The rate rows read each registry band against the median over RefBot's games (research/20 F; MODEL-V3 §11.8).
  band('F5.evalAwarenessStart', rates.map((r) => r.eaStart));
  band('F5.evalAwareness2026', rates.map((r) => r.ea2026 ?? NaN));
  // AF task: the registry band is an observed compliance gap read through the model's eval awareness like every behavioural
  // eval (expectedObservation BB = AF·(1 − eaCoef·EA)·(1 − mask_BB)), so the row reads af2026BB.
  band('F5.afComplianceGap2026', rates.map((r) => r.af2026BB ?? NaN));
  band('F6.persistence.scheme', rates.flatMap((r) => r.versions.filter((v) => v.pi >= 0 && !v.antiScheme).map((v) => v.pi)));
  return out;
}
