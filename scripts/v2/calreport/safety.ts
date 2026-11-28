// Calibration targets: safety (moved from safety.ts S4/S5 and safetyrates.ts' RefBot-game rows; design/TESTING.md §0).
//   S4  P_mis at ASI: RefBot/medium ∈ [0.40, 0.80] (AI Futures authors' credences), safe-only recipe ≤ 0.25.
//   S5  Mixed bot: its sight limit at SAR is above RefBot's (mean over worlds); half staffing deepens the lag (paired).
//   E10 RefBot-game rates (research/20 F): eval awareness at the start and 2026-12-31, the AF compliance gap a behavioural
//       eval reads at 2026-12-31, persistence of SCHEME through RefBot's post runs.
// Games (all through simcache): RefBot to ASI, seeds 500… (safety-emu refGame, one game per seed serves S4 and the rates);
// the safe-only recipe to ASI, seeds 700…; the Mixed bot to SAR, seeds 900…; RefBot with half the safety teams to SAR, seeds
// 500… (paired with RefBot's own SAR reads). tl-central reaches ASI around day 3300 (SAR ≈ 2500): ≈ 3–4 CPU-min per game to ASI cold,
// ≈ 2–3 to SAR; at the default seed counts ≈ 2 CPU-hours cold, so use CALREPORT_SEEDS for a quick look.
// Env: CALREPORT_SEEDS=n caps every list (defaults: 20 RefBot, 12 for the rates, 16 safe-only, 10 Mixed, 20 half-staff).
//
// Seed arithmetic (S4): per-world P_mis has sd ≈ 0.31 (B-heavy.md's estimate; not re-measured). The REF band [0.40, 0.80]
// is 0.4 wide and the authors' credences are the sourced centre, so 20 worlds give se = 0.31/√20 = 0.07: a mean at the
// band centre is 2.9 se from either edge. SAFE has a one-sided bound ≤ 0.25 and sd ≈ 0.25 → 16 worlds se 0.06. S5 Mixed
// compares two means (Mixed U vs RefBot's worlds) on U with sd ≈ 0.5 levels; 10 worlds se 0.16.
import { fileURLToPath } from 'node:url';
import { GAME_DAYS, MIXED, REF_HALF_STAFF, SAFE, play, refGame, type Outcome } from '../safety-emu';
import { cached } from '../simcache';
import type { AlignDiffId, BotPolicy } from '../../../src/engine/v2/types';
import type { Target } from './types';

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
  const refSeeds = (n: number) => Array.from({ length: n }, (_, i) => 500 + i);
  const ref = refSeeds(nRef).map((sd) => refGame(sd).outcome);
  const safe = Array.from({ length: nSafe }, (_, i) => playC(SAFE, 700 + i, 'asi'));
  const refP = mean(ref.map((o) => o.pmis));
  const safeP = mean(safe.map((o) => o.pmis));

  // CAL2-S (designer decision 2): the band is the AI Futures / AI 2027 authors' own credences. P_mis averaged over worlds
  // is the chance that the reference lab (no slowdown, AI 2027's safety share) reaches an ASI misaligned past the world's
  // tolerance. Kokotajlo "I think AI doom is 70% likely" (LessWrong comment, 25 May 2023); Larsen, conditional on a
  // nearcast with current techniques and little government action, "25/25/50%" on (1) handled well / (2) "adversarially
  // misaligned" / (3) "try to align their successors but fail", i.e. 75% misaligned successors (LessWrong shortform, 28 Mar
  // 2026); Alexander 20% that the first AIs past the point of no return "will want to eliminate the human population" plus
  // "an additional 30% chance that they otherwise permanently curtail human potential" (ACX "My AI Opinions", 11 Jun 2026);
  // the AI Goals Forecast (Apr 2025), credence that unintended goals "feature prominently" in Agent-3: unintended spec
  // 70 / 40 / 50%, proxies / ICGs 50 / 80 / 50% (Daniel / Thomas / Eli). Takeover / doom also needs the misaligned ASI to
  // escape control, so those credences are lower bounds on P_mis; the band 0.40–0.80 spans the authors' spread (0.40 the
  // lowest category credence, 0.80 the highest). design/archive/RD-AUDIT/BUILD-NOTES.md "CAL2-S". (The V2-SPEC row
  // 0.55–0.85 had no source.)
  out.push({
    id: 'safety.refPmisAtAsi', label: 'S4 RefBot/medium: P_mis at ASI (mean over worlds)', band: '0.40–0.80',
    value: `${refP.toFixed(3)} (${nRef} worlds; Mis mean ${mean(ref.map((o) => o.mis)).toFixed(3)}, ASI day ≈ ${mean(ref.map((o) => o.asiDay ?? 0)).toFixed(0)})`,
    ok: refP >= 0.4 && refP <= 0.8,
    source: "AI Futures authors' credences (CAL2-S): Kokotajlo 70% doom (LessWrong 25 May 2023); Larsen 75% misaligned successors (LessWrong shortform 28 Mar 2026); Alexander 20% + 30% (ACX 'My AI Opinions' 11 Jun 2026); AI Goals Forecast Apr 2025 (unintended goals 70/40/50%, proxies/ICGs 50/80/50%); design/archive/RD-AUDIT/BUILD-NOTES.md 'CAL2-S'",
  });
  out.push({
    id: 'safety.safeOnlyPmisAtAsi', label: 'S4 Safe-only recipe: P_mis at ASI (mean over worlds)', band: '≤ 0.25',
    value: `${safeP.toFixed(3)} (${nSafe} worlds)`, ok: safeP <= 0.25,
    source: 'V2-SPEC §7.4 / §8.3 S4: the safe bot\'s recipe (20% safety compute, ~25% safety staff, heavy safety + inoculation, faithful CoT) must be able to reach a low P_mis; the bound is about the recipe, run on reference finance',
  });

  // S5: Mixed bot vs RefBot sight limit at SAR (CAL2-S designer decision 4). Sight limit = the highest level the lab's
  // instruments read hidden-goal traits at ≥ 50% believed reliability; a lab that funds safety more than AI 2027's
  // reference lab sees further at SAR. Unpaired worlds (Mixed seeds 900+, RefBot 500+): means over the worlds that reach SAR.
  const mixed = Array.from({ length: nMixed }, (_, i) => playC(MIXED, 900 + i, 'sar'));
  const mixU = mixed.flatMap((o) => (o.uAtSar !== undefined ? [o.uAtSar] : []));
  const refSar = ref.flatMap((o) => (o.sar ? [o.sar] : []));
  const refU = refSar.map((r) => r.u);
  out.push({
    id: 'safety.mixedSightAboveRef', label: "S5 Mixed bot: its sight limit at SAR is above RefBot's (mean over worlds)", band: 'Mixed > RefBot',
    value: `Mixed ${mean(mixU).toFixed(2)} (median ${median(mixU).toFixed(2)}, ${mixU.length} worlds) vs RefBot ${mean(refU).toFixed(2)} (median ${median(refU).toFixed(2)}, ${refU.length})`,
    ok: mixU.length > 0 && mean(mixU) > mean(refU),
    source: 'CAL2-S designer decision 4: the sources support "more safety funding sees further at SAR" (AI 2027 Apr / Sep 2027 boxes: safety team "far from a full understanding", "bottom-up interpretability doesn\'t work"); the old "U ≥ L − 0.5 up to SAR" was a game-feel requirement',
  });

  // S5 half staff (was deep tier): the same RefBot worlds, half the safety science teams, played to SAR; the lag (U − L,
  // believed and true) deepens. Paired worlds (RefBot seeds 500…); "deepens" = the mean U − L at SAR is lower.
  const half = Array.from({ length: nHalf }, (_, i) => playC(REF_HALF_STAFF, 500 + i, 'sar', 'halfStaff')).flatMap((o) => (o.sar ? [o.sar] : []));
  const base = refSeeds(nHalf).flatMap((sd) => { const o = refGame(sd).outcome; return o.sar ? [o.sar] : []; });
  const m = (xs: number[]) => mean(xs);
  const g = half.map((r) => r.margin), g0 = base.map((r) => r.margin), tg = half.map((r) => r.trueGap), tg0 = base.map((r) => r.trueGap);
  const below = (xs: number[]) => xs.filter((x) => x < 0).length / Math.max(1, xs.length);
  out.push({
    id: 'safety.halfStaffDeepensLag', label: 'S5 mechanism: less safety staffing (half the line teams) deepens the lag at SAR (paired worlds, played)', band: 'mean U − L lower, believed and true',
    value: `mean U − L ${m(g).toFixed(2)} vs ${m(g0).toFixed(2)} (RefBot), U < L in ${pct(below(g))} vs ${pct(below(g0))}; true ${m(tg).toFixed(2)} vs ${m(tg0).toFixed(2)}, ${pct(below(tg))} vs ${pct(below(tg0))} (${half.length} / ${base.length} worlds)`,
    ok: half.length > 0 && g.length === g0.length && m(g) < m(g0) && m(tg) < m(tg0),
    source: 'S5R (design/archive/V3-BUILD.md "S5R"): emergent, not forced; AI 2027 Apr 2027: "far from a full understanding" with a small safety team',
  });

  // E10 rates on RefBot's games (research/20 F; design/MODEL-V3.md §11.8). Rows rate constants cannot bring into band
  // were WARN with the mechanism they need (safetyrates.ts, E10 report design/archive/notes/E10.md).
  const rates = refSeeds(nRates).map((sd) => refGame(sd).rates);
  const band = (id: string, label: string, lo: number, hi: number, xs: number[], source: string) => {
    const ys = xs.filter(Number.isFinite);
    const md = median(ys);
    out.push({ id: `safety.rates.${id}`, label, band: `${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}% (median over ${ys.length} RefBot games)`, value: spread(ys), ok: md >= lo - 1e-9 && md <= hi + 1e-9, source });
  };
  band('eaStart', 'F5 eval awareness, start model (2025 reasoning frontier)', 0.1, 0.3, rates.map((r) => r.eaStart), 'verbalised EA 10–30% (2025); Sonnet 4.5 ~13%; Apollo 11.7%');
  band('ea2026', 'F5 eval awareness, RefBot internal model at 2026-12-31', 0.2, 0.5, rates.map((r) => r.ea2026 ?? NaN), 'late-2026 frontier 20–50% (research/05 §1.7). Was at the edge (E19: 49.8%, in): the ai2027 leader reaches SC in late 2026, ahead of the real late-2026 frontier (Apollo: GPT-6 Astra 41–51%, the top of the band); E10 lowered E11, not EA_RELAX');
  // AF task: the band is an observed compliance gap (Greenblatt 2024: Claude 3 Opus "complies with harmful queries from
  // free users 14% of the time, versus almost never for paid users"; Sheshadri 2025: 5 of 25 models comply more when they
  // infer they are in training), a behavioural monitored-vs-unmonitored split read through the model's eval awareness like
  // every behavioural eval (E12, grade A: Opus 4 blackmail 55.1% when it stated the scenario was real vs 6.5% when it
  // stated it was an evaluation; Schoen 2025: removing eval awareness raised o3's covert actions 13.2% → 24.2%). The banded
  // value is the game's behavioural reading of the trait (expectedObservation BB = AF·(1 − eaCoef·EA)·(1 − mask_BB)).
  band('afGap2026', 'F5 alignment faking: compliance gap a behavioural eval reads, RefBot internal model at 2026-12-31', 0, 0.15, rates.map((r) => r.af2026BB ?? NaN), "research/05 §1.4: 0–15% compliance gap in current models, ~80% show none (Greenblatt 2024: Claude 3 Opus 14% vs ≈ 0; Sheshadri 2025: 5 of 25). Known deviation: the trait itself (≈ 16%, AF2) comes from E13 √(SA·PROXY) and E27 PERSONA → AF over the lineage's post runs at frontier capability, the successor pull and F6's low removal of oversight-conditional traits (design/archive/V3-BUILD.md 'AF notes')");
  band('persistRef', 'F6 RefBot: persistence of SCHEME per post run without anti-scheming (all generations)', 0.8, 1, rates.flatMap((r) => r.versions.filter((v) => v.pi >= 0 && !v.antiScheme).map((v) => v.pi)), "Hubinger 2024 [R]: SFT, RL and adversarial safety training 'failed to remove' backdoors in the largest models; research/20 F6 [G] π ≈ 0.3 small, 0.9+ frontier CoT-deceptive → [D] ≥ 0.8 for a frontier model. Known deviation: remaining removal is AG18 healing (the world's hidden benign-generalisation bet, M4) and the stack's detection at E24's true/visible ratio; closing it means a HEAL_K or detection weight below the sourced ratio (a design bet)");
  return out;
}
