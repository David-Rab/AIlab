// WS2 acceptance tests S1–S6 (V2-SPEC §8.3) plus safety-state hygiene. Owner: WS2.
//
// S4/S5 play real games on the integrated engine (safety-emu.ts: RefBot, the safe-only recipe on reference finance,
// the mixed bot); WS1's runs call the WS2 trait hooks on every completed run. The games go through the simulation cache
// (simcache.ts). `--smoke` (test:quick) plays 1 seed per bot (the mixed bot to SAR); S4/S5 then print SMOKE.
// `--deep` (run.ts --tier deep, npm run test:deep; M10) adds S5's played mechanism checks (half staff, sabotage on / off: 180 RefBot
// games to SAR; M11: 20 + 2 × 80), which the full tier skips to stay ≲ 20 min wall; the merge wave runs it once.
import { AGENDA_IDS } from '../../src/data/v2/agendas';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { act, makeCtx } from '../../src/engine/v2/core/loop';
import { expectedObservation, familyPenalty, observeVersion } from '../../src/engine/v2/safety/detection';
import { fireFinding } from '../../src/engine/v2/safety/findings';
import { goodhartTrain } from '../../src/engine/v2/safety/traits';
import { safetyAgentVersion, safetyFleet, trustedShare } from '../../src/engine/v2/safety/agents';
import { lineLabour, resetSafAllocation } from '../../src/engine/v2/safety/lineProjects';
import { openInvestigation } from '../../src/engine/v2/safety/investigations';
import { sampleHidden } from '../../src/engine/v2/world/hidden';
import { Rng } from '../../src/engine/rng';
import type { GameStateV2, TraitId } from '../../src/engine/v2/types';
import { fileURLToPath } from 'node:url';
import { check, finish, FIXTURE_DIR, SMOKE, smokeCheck } from './lib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../src/engine/v2/core/save';
import { sightLimit, trueSightLimit } from '../../src/engine/v2/safety/sightLimit';
import { internalVersion } from '../../src/engine/v2/models/labs';
// SR-11: the sight limit in the shape these analyses read (U = sight limit, margin = sight limit − level).
const understandingBand = (s: GameStateV2) => { const r = sightLimit(s); return { U: r.L, lo: r.lo, hi: r.hi }; };
const DEEP = process.argv.includes('--deep');
import { MIXED, REF_HALF_STAFF, SAFE, play, refGame, sarRead, type Outcome } from './safety-emu';
import { COVERT_ACTS } from '../../src/data/v2/danger';
import { flagNum } from '../../src/engine/v2/safety/common';
import { cached, prefill } from './simcache';

// Cost (CPU-s, one process). SMOKE (test:quick): S1–S3, B3, S6, SAFMECH and the sabotage pair are constructed (~10 s); S4/S5
// play ONE short game per bot (40 days each, ~3 s apiece) and the checks on them are structural, not bands.
// Full: S4 REF = 20 seeds to ASI (shared with safetyrates.ts through refGame: one cached game per seed), S4 SAFE = 16
// seeds to ASI, S5 Mixed = 10 games to SAR (~1.4k game-days at ~12 ms: ≈ 17 s a game, so ≈ 6 + 5 + 2 ≈ 13 CPU-min cold,
// ≈ 0 warm; was 40 + 40 + 20 games ≈ 26 CPU-min). Deep adds S5 half staff (20 games to SAR).
// Seed arithmetic (S4): per-world P_mis has sd ≈ 0.31 (B-heavy.md's estimate; not re-measured). The REF band [0.40, 0.80]
// is 0.4 wide and the authors' credences are the sourced centre, so 20 worlds give se = 0.31/√20 = 0.07: a mean at the
// band centre is 2.9 se from either edge (at 40 worlds 4.1 se). SAFE has a one-sided bound ≤ 0.25 and sd ≈ 0.25 →
// 16 worlds se 0.06. S5 Mixed compares two means (Mixed U vs RefBot's 20 worlds) on U with sd ≈ 0.5 levels; 10 worlds se 0.16.
const SMOKE_DAYS = 40;
const MAX_DAY = SMOKE ? SMOKE_DAYS : 1600;
/** play() through the simulation cache (the record is the Outcome). RefBot games to ASI go through refGame instead. */
const EMU = fileURLToPath(new URL('./safety-emu.ts', import.meta.url));
const playC = (bot: typeof SAFE, seed: number, stopAt: 'asi' | 'sar', variant = ''): Outcome =>
  cached('safety-play', { bot: bot.id, variant, seed, stopAt, alignment: 'medium', maxDay: MAX_DAY }, [fileURLToPath(import.meta.url), EMU], () => play(bot, seed, stopAt, 'medium', undefined, undefined, MAX_DAY));
const N_REF = SMOKE ? 1 : 20;
const N_SAFE = SMOKE ? 1 : 16;
const N_S5 = SMOKE ? 1 : 10;
/** S5's played mechanism check (half staff): the first N_MECH of the S4 RefBot seeds (paired), played to SAR, deep only. */
const N_MECH = SMOKE ? 0 : 20;
const N_MECH_PLAY = DEEP ? N_MECH : 0;
// The runner's --prefill shards: the S4/S5 games, in the order the checks ask for them.
prefill([
  ...Array.from({ length: N_REF }, (_, i) => () => refGame(500 + i, MAX_DAY)),
  ...Array.from({ length: N_SAFE }, (_, i) => () => playC(SAFE, 700 + i, 'asi')),
  ...Array.from({ length: N_S5 }, (_, i) => () => playC(MIXED, 900 + i, 'sar')),
  ...Array.from({ length: N_MECH_PLAY }, (_, i) => () => playC(REF_HALF_STAFF, 500 + i, 'sar', 'halfStaff')),
]);

// S1 (M2 spec decision): R14's Beta priors alone put ≈ 3.94 agendas above e = 0.6 per world; the loading spread was cut
// by a quarter (§3.5.2) and the target widened to 2–4.5.
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

// ───────────────────────────── S1: agenda efficacy draws ─────────────────────────────
{
  const N = 1000;
  let hi = 0;
  let lo = 0;
  const setup = defaultSetupV2({ seed: 0, world: 'tl-central', alignment: 'sampled' });
  for (let i = 0; i < N; i++) {
    const h = sampleHidden(new Rng(1000 + i), { ...setup, seed: 1000 + i });
    for (const a of AGENDA_IDS) {
      const e = h.agendaEfficacy[a];
      if (e > 0.6) hi++;
      if (e < 0.2) lo++;
    }
  }
  const mh = hi / N;
  const ml = lo / N;
  check(mh >= 2 && mh <= 4.5, 'S1 agendas with e > 0.6 per world: 2–4.5 (mean of 1,000 worlds)', mh.toFixed(2));
  check(ml >= 4 && ml <= 6, 'S1 agendas with e < 0.2 per world: 4–6 (mean of 1,000 worlds)', ml.toFixed(2));
}

// ───────────────────────────── S2: retrain-against masks ─────────────────────────────
{
  let okVis = 0;
  let okTrue = 0;
  const visDrops: number[] = [];
  const trueDrops: number[] = [];
  const cases: [string, TraitId][] = [['T-PROP', 'RH'], ['T-PROBE', 'SCHEME'], ['T-COTMON', 'CONCEAL']];
  let n = 0;
  for (let seed = 1; seed <= 8; seed++) { // 8 worlds × 3 cases: a formula range check
    for (const [tech, trait] of cases) {
      const s = newGame(defaultSetupV2({ seed, alignment: 'medium' }));
      const v = s.player.models.versions[0];
      v.uModes = [];
      v.traitsTrue[trait] = 0.5;
      const ctx = makeCtx(s);
      const fam = s.player.safety.techniques[tech].family;
      const vis0 = expectedObservation(s, v, trait, fam);
      if (vis0 < 1e-6) continue; // e.g. COT monitors are blind in worlds where λ2_eff ≤ −1
      const x0 = v.traitsTrue[trait];
      goodhartTrain(s, ctx.rng('safety'), v, tech, [trait]); // SR-14b: the train-against method's mechanism (no longer a response)
      const vd = 1 - expectedObservation(s, v, trait, fam) / vis0;
      const td = 1 - v.traitsTrue[trait] / x0;
      visDrops.push(vd);
      trueDrops.push(td);
      if (vd >= 0.7 - 1e-9 && vd <= 0.9 + 1e-9) okVis++;
      if (td >= 0.2 - 1e-9 && td <= 0.4 + 1e-9) okTrue++;
      n++;
    }
  }
  check(okVis === n, 'S2 retrain-against lowers the VISIBLE trait 70–90%', `${okVis}/${n}, range ${pct(Math.min(...visDrops))}–${pct(Math.max(...visDrops))}`);
  check(okTrue === n, 'S2 retrain-against lowers the TRUE trait 20–40%', `${okTrue}/${n}, range ${pct(Math.min(...trueDrops))}–${pct(Math.max(...trueDrops))}`);
}

// ───────────────────────────── S3: BB observation = true · (1 − 0.8·EA) ─────────────────────────────
{
  const s = newGame(defaultSetupV2({ seed: 3, alignment: 'medium' }));
  const v = s.player.models.versions[0];
  v.uModes = [];
  let maxErr = 0;
  for (const ea of [0, 0.15, 0.3, 0.5, 0.8, 1]) {
    v.traitsTrue.EA = ea;
    for (const t of ['SCHEME', 'AF', 'POWER', 'SYC', 'RH'] as TraitId[]) maxErr = Math.max(maxErr, Math.abs(familyPenalty(s, v, t, 'BB') - (1 - 0.8 * ea)));
  }
  check(maxErr < 1e-9, 'S3 BB penalty = 1 − 0.8·EA on behaviour traits (no masks)', `max err ${maxErr.toExponential(1)}`);
  // Statistical: mean observation ≈ true·(1 − 0.8·EA).
  v.traitsTrue.EA = 0.4;
  v.traitsTrue.SCHEME = 0.5;
  const rng = new Rng(99);
  const obs: number[] = [];
  for (let i = 0; i < 4000; i++) obs.push(observeVersion(s, rng, 1, v, 'SCHEME', 'BB', 1));
  const want = 0.5 * (1 - 0.8 * 0.4);
  check(Math.abs(mean(obs) - want) < 0.01, 'S3 mean BB observation of SCHEME ≈ true·(1 − 0.8·EA)', `${mean(obs).toFixed(3)} vs ${want.toFixed(3)}`);
  v.traitsTrue.EA = 0.4;
  check(Math.abs(familyPenalty(s, v, 'EA', 'BB') - 1) < 1e-9, 'S3 EA itself is not EA-penalised');
}

// ───────────────────────────── S4: Mis at ASI ─────────────────────────────
const t0 = performance.now();
const ref = Array.from({ length: N_REF }, (_, i) => refGame(500 + i, MAX_DAY).outcome);
const safe = Array.from({ length: N_SAFE }, (_, i) => playC(SAFE, 700 + i, 'asi'));
const refP = mean(ref.map((o) => o.pmis));
const safeP = mean(safe.map((o) => o.pmis));
console.log(`      RefBot Mis at ASI: mean ${mean(ref.map((o) => o.mis)).toFixed(3)}  range ${Math.min(...ref.map((o) => o.mis)).toFixed(2)}–${Math.max(...ref.map((o) => o.mis)).toFixed(2)}  (ASI day ≈ ${mean(ref.map((o) => o.asiDay ?? 0)).toFixed(0)})`);
console.log(`      Safe-only Mis at ASI: mean ${mean(safe.map((o) => o.mis)).toFixed(3)}  range ${Math.min(...safe.map((o) => o.mis)).toFixed(2)}–${Math.max(...safe.map((o) => o.mis)).toFixed(2)}`);
// CAL2-S (designer decision 2): the band is the AI Futures / AI 2027 authors' own credences. P_mis averaged over worlds
// is the chance that the reference lab (no slowdown, AI 2027's safety share) reaches an ASI misaligned past the world's
// tolerance. Authors' first-person statements: Kokotajlo "I think AI doom is 70% likely" (LessWrong comment, 25 May
// 2023); Larsen, conditional on a nearcast with current techniques and little government action, "25/25/50%" on (1)
// handled well / (2) "adversarially misaligned" / (3) "try to align their successors but fail", i.e. 75% misaligned
// successors (LessWrong shortform, 28 Mar 2026); Alexander 20% that the first AIs past the point of no return "will want
// to eliminate the human population" plus "an additional 30% chance that they otherwise permanently curtail human
// potential" (ACX "My AI Opinions", 11 Jun 2026); the AI Goals Forecast (Apr 2025), credence that unintended goals
// "feature prominently" in Agent-3: unintended spec 70 / 40 / 50%, proxies / ICGs 50 / 80 / 50% (Daniel / Thomas /
// Eli). Takeover / doom also needs the misaligned ASI to escape control, so those credences are lower bounds on P_mis;
// the band 0.40–0.80 spans the authors' spread (0.40 the lowest category credence, 0.80 the highest).
// design/archive/RD-AUDIT/BUILD-NOTES.md "CAL2-S". (The V2-SPEC row 0.55–0.85 had no source.)
smokeCheck(refP >= 0.4 && refP <= 0.8, "S4 RefBot/medium: P_mis at ASI ∈ [0.40, 0.80] (AI Futures authors' credences)", refP.toFixed(3));
smokeCheck(safeP <= 0.25, 'S4 Safe-only recipe: P_mis at ASI ≤ 0.25', safeP.toFixed(3));
check([...ref, ...safe].every((o) => o.jsonOk && o.pmis >= 0 && o.pmis <= 1 && Number.isFinite(o.mis)), 'safety and model state stay plain JSON through the game, and P_mis is a probability');

// ───────────────────────────── S5: Understanding vs capability ─────────────────────────────
// S5R (design/archive/V3-BUILD.md "S5R" notes): emergent, not forced. RefBot's safety programme is AI 2027's (bots/ref.ts: the alignment
// share of internal compute, 3–4%, on its research, the safety agents mixed like the capabilities research; four line
// teams). The criterion: believed U (§3.5.7) below L at SAR in at least half the worlds. AI 2027's OpenBrain is the
// authors' "best guess" (Sep 2027 box) and by SAR (Aug 2027) its safety team is "far from a full understanding" (Apr 2027)
// and "Bottom-up interpretability doesn't work" (Sep 2027): in the reference lab the lag is at least as likely as not.
// Mechanism checks (paired worlds, RefBot variants): the lag grows with opaque reasoning (the same SAR state with the
// internal model in neuralese, AI 2027's Agent-3/4: constructed from the day-900 fixture in SMOKE, the played SAR states
// in full) and with less safety staffing (half the line teams; played, deep). Sabotage of safety research (M11): since
// SAFMECH the saboteur attacks only on-track results that would expose it (AI 2027: Agent-4 "sandbags on the small fraction of
// alignment research that it thinks is actually on track to solve the problem or reveal Agent-4's scheming"), so the sourced
// effect is overconfidence: rigged tools keep believed U up while true U falls. It was checked by 2 x 80 played RefBot games
// to SAR (rare event: ~0.25 rigged tools a game); it is now two constructed cases (the S5 sabotage block below): the odds
// of the act (kappa on/off) -> rigged tools and sandbagged results, directly on fireFinding; and a rigged tool -> believed - true U.
// U - L is understanding().margin (L with the lineage fallback while the internal model is in evaluation).
const S5_BELOW_MIN = 0.5;
const median = (xs: number[]) => {
  const a = [...xs].sort((p, q) => p - q);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const below = (xs: number[]) => xs.filter((g) => g < 0).length / Math.max(1, xs.length);
const sarOf = (os: Outcome[]) => os.flatMap((o) => (o.sar ? [o.sar] : []));
const refSar = sarOf(ref);
const gap = refSar.map((r) => r.margin);
const tgap = refSar.map((r) => r.trueGap);
// Designer 2026-11-23 (review/S5-analysis.md option c): INFO only. The ≥ 50% is a design reading of AI 2027's text, not a
// sourced number, and the row swings ±6 pp between runs (a lottery over hidden draws). Option (a), a sourced "instruments
// get harder with capability even after re-fitting" term, may come later at the designer's choice.
console.log(`INFO  S5 RefBot (AI 2027 alignment share): U falls below L by SAR (design reading ≥ ${pct(S5_BELOW_MIN)}): ` +
  `below in ${pct(below(gap))} of ${gap.length}; median U − L ${median(gap).toFixed(2)}; true U below true L in ${pct(below(tgap))} (median ${median(tgap).toFixed(2)}); SAFMECH: the bottom of believed U's 80% range below L in ${pct(below(refSar.map((r) => (r.uLo ?? r.u) - (r.u - r.margin))))} (mean range ${mean(refSar.map((r) => (r.uHi ?? r.u) - (r.uLo ?? r.u))).toFixed(2)} levels)`);
{
  // Paired worlds (the first N_MECH RefBot seeds). "Deepens the lag" = the mean U − L at SAR is lower, believed and true.
  const m = (xs: number[]) => mean(xs);
  type Pair = { margin: number; trueGap: number; u?: number; uLo?: number; uHi?: number };
  const band = (xs: Pair[]) => xs.every((r) => r.uLo !== undefined) ? `; range ${mean(xs.map((r) => (r.uHi ?? 0) - (r.uLo ?? 0))).toFixed(2)} levels, bottom below L in ${pct(below(xs.map((r) => (r.uLo ?? 0) - ((r.u ?? 0) - r.margin))))}` : '';
  const cmp = (name: string, ok: string, v: Pair[], b: Pair[], base: string) => {
    const g = v.map((r) => r.margin), g0 = b.map((r) => r.margin), tg = v.map((r) => r.trueGap), tg0 = b.map((r) => r.trueGap);
    smokeCheck(g.length === g0.length && m(g) < m(g0) && m(tg) < m(tg0), ok,
      `${name}: mean U − L ${m(g).toFixed(2)} vs ${m(g0).toFixed(2)} (${base}), U < L in ${pct(below(g))} vs ${pct(below(g0))}; true ${m(tg).toFixed(2)} vs ${m(tg0).toFixed(2)}, ${pct(below(tg))} vs ${pct(below(tg0))}${band(v)}${band(b) ? ` (${base}${band(b)})` : ''}`);
  };
  const base = SMOKE ? [sarRead(deserialize(readFileSync(join(FIXTURE_DIR, 'day900.json'), 'utf8')))] : refSar.slice(0, N_MECH);
  // Opaque reasoning: the same SAR states with the internal model reasoning in neuralese.
  cmp('neuralese', 'S5 mechanism: opaque (neuralese) reasoning deepens the lag (the same SAR states)', base.map((r) => ({ margin: r.marginLatent, trueGap: r.trueGapLatent })), base, 'RefBot');
  if (DEEP) {
    const half = sarOf(Array.from({ length: N_MECH_PLAY }, (_, i) => playC(REF_HALF_STAFF, 500 + i, 'sar', 'halfStaff')));
    cmp('half staff', 'S5 mechanism: less safety staffing (half the line teams) deepens the lag (paired worlds)', half, base, 'RefBot');
  } else if (!SMOKE) console.log(`INFO  S5 mechanism check half staff (${N_MECH} paired games to SAR) runs in the deep tier only: npm run test:deep (at merges)`);
}
const mixed = Array.from({ length: N_S5 }, (_, i) => playC(MIXED, 900 + i, 'sar'));
const mm = mixed.map((o) => o.minMarginToSar);
const mixedOk = mm.filter((m) => m >= -0.5).length / mm.length;
// CAL2-S (designer decision 4): the Mixed-bot row tests the sight limit, what the sources support: a lab that funds
// safety more than AI 2027's reference lab sees further at SAR (sight limit = the highest level its instruments read
// hidden-goal traits at ≥ 50% believed reliability). The old "U ≥ L − 0.5 up to SAR" (a game-feel requirement, no
// source) stays as INFO. Unpaired worlds (Mixed seeds 900+, RefBot 500+): means over the worlds that reach SAR.
const mixU = mixed.flatMap((o) => (o.uAtSar !== undefined ? [o.uAtSar] : []));
const refU = refSar.map((r) => r.u);
smokeCheck(mixU.length > 0 && mean(mixU) > mean(refU), "S5 Mixed bot: its sight limit at SAR is above RefBot's (mean over worlds)",
  `Mixed ${mean(mixU).toFixed(2)} (median ${median(mixU).toFixed(2)}, ${mixU.length} worlds) vs RefBot ${mean(refU).toFixed(2)} (median ${median(refU).toFixed(2)}, ${refU.length})`);
console.log(`INFO  S5 Mixed bot U ≥ L − 0.5 up to SAR (pre-CAL2 row): median min margin ${median(mm).toFixed(2)}; holds in ${pct(mixedOk)} of worlds`);

// ──────────── S5 sabotage (M11), constructed: the act's odds on / off, and what a rigged tool does to believed vs true U ────────────
{
  // (a) The odds: the same safety lab (a safety model covering the work, all of it handed to AI, a saboteur's traits), the
  // act's rate kappa on vs x0 (what the played pair varied), 300 findings on AG08 each. On: rigged tools (FALSE findings,
  // which a lab validates into tools) and sandbagged results appear; off: none. Both arms must also produce honest tools
  // (else the on arm's count means nothing).
  const base = newGame(defaultSetupV2({ seed: 6, alignment: 'medium' }));
  const arm = (kappaMult: number) => {
    const s = JSON.parse(JSON.stringify(base)) as GameStateV2;
    const v = s.player.models.versions[0];
    v.uModes = [];
    v.traitsTrue.SAND = 0.5;
    v.traitsTrue.SCHEME = 0.5;
    s.player.policies.trustedToAI = 1;
    if (v.build) v.build.dg += 6;
    s.player.split.safetyAgents = 0.3;
    resetSafAllocation(s);
    s.player.policies.publishSafety = 'none';
    const snap = JSON.stringify(s.player.safety);
    const flags0 = JSON.stringify(s.flags);
    const ctx = makeCtx(s);
    const k0 = COVERT_ACTS.SAFSAB.kappa;
    COVERT_ACTS.SAFSAB.kappa = k0 * kappaMult;
    let rigged = 0, honest = 0, sandbagged = 0;
    try {
      for (let i = 0; i < 300; i++) {
        const rec = fireFinding(s, ctx, 'AG08');
        if (rec?.trueType === 'FALSE') rigged++;
        if (rec?.trueType === 'TECH') honest++;
        sandbagged += flagNum(s, 'covert.SAFSAB.sandbagged');
        s.player.safety = JSON.parse(snap);
        s.flags = JSON.parse(flags0);
      }
    } finally { COVERT_ACTS.SAFSAB.kappa = k0; }
    return { rigged, honest, sandbagged };
  };
  const on = arm(1), off = arm(0);
  check(on.honest > 0 && off.honest > 0 && on.rigged > 0 && on.sandbagged > 0 && off.rigged === 0 && off.sandbagged === 0,
    'S5 mechanism (M11): targeted sabotage leaves rigged tools and hidden dead ends (act on vs off, constructed, 300 results each)',
    `on: ${on.rigged} rigged, ${on.sandbagged} sandbagged, ${on.honest} honest tools; off: ${off.rigged} rigged, ${off.sandbagged} sandbagged, ${off.honest} honest tools`);
  // (b) A rigged tool masks (x0.5) the trait it covers (detection.ts falseMask) while the lab still believes in it: what its
  // family reads of the trait halves, the lab's believed U (beliefs only) does not move, and true U cannot rise. (Played
  // SAR states had true U 0 at the start of the sample, so believed - true U is read as the pieces: reading, belief, true U.)
  const lab = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const v = lab.player.models.versions.find((x) => x.id === internalVersion(lab)?.id) ?? lab.player.models.versions[0];
  v.traitsTrue.SCHEME = 0.5;
  v.uModes = [];
  const tool = Object.values(lab.player.safety.techniques).find((x) => x.unlocked && x.active && (x.coverage.SCHEME ?? 0) > 0 && x.family !== 'BB');
  const rig = JSON.parse(JSON.stringify(lab)) as GameStateV2;
  const rigTool = tool ? rig.player.safety.techniques[tool.id] : undefined;
  if (rigTool) rigTool.falseValidated = true;
  const vr = rig.player.models.versions.find((x) => x.id === v.id)!;
  const obs0 = tool ? expectedObservation(lab, v, 'SCHEME', tool.family) : NaN;
  const obs1 = tool ? expectedObservation(rig, vr, 'SCHEME', tool.family) : NaN;
  check(!!tool && obs0 > 0 && Math.abs(obs1 / obs0 - 0.5) < 1e-9 && sightLimit(rig).L === sightLimit(lab).L && trueSightLimit(rig).L < trueSightLimit(lab).L,
    'S5 mechanism (M11): a rigged tool reads half of the trait it covers while the lab still believes it: believed U unchanged, true U lower',
    tool ? `${tool.id} (${tool.family}) reads ${obs0.toFixed(3)} -> ${obs1.toFixed(3)}; believed U ${sightLimit(lab).L} vs ${sightLimit(rig).L}; true U ${trueSightLimit(lab).L} vs ${trueSightLimit(rig).L}` : 'no active tool covers SCHEME');
}

// ──────────── S6: FALSE findings rise with Trusted to AI × sabotage (R7: one policy; E2: ∝ the work AI does) ────────────
{
  const base = newGame(defaultSetupV2({ seed: 6, alignment: 'medium' }));
  const rate = (ai: number, sab: number) => {
    const s = JSON.parse(JSON.stringify(base)) as GameStateV2;
    const v = s.player.models.versions[0];
    v.uModes = [];
    v.traitsTrue.SAND = sab / 2;
    v.traitsTrue.SCHEME = sab / 2;
    s.player.policies.trustedToAI = ai;
    // E2: a safety model that covers safety work (+6 OOM) and a running fleet, so AI does about t of the work.
    if (v.build) v.build.dg += 6;
    s.player.split.safetyAgents = 0.3;
    resetSafAllocation(s);
    s.player.policies.publishSafety = 'none';
    const snap = JSON.stringify(s.player.safety);
    const ctx = makeCtx(s);
    let falses = 0;
    const N = 1500;
    for (let i = 0; i < N; i++) {
      const rec = fireFinding(s, ctx, 'AG08');
      if (rec?.trueType === 'FALSE') falses++;
      s.player.safety = JSON.parse(snap);
    }
    return falses / N;
  };
  const r00 = rate(0, 0.8);
  const rLo = rate(0.5, 0.1);
  const rMid = rate(0.5, 0.8);
  const rHi = rate(1, 0.8);
  const rHiHi = rate(1, 1.6);
  console.log(`      FALSE share: ai 0 → ${pct(r00)}; ai .5·sab .1 → ${pct(rLo)}; ai .5·sab .8 → ${pct(rMid)}; ai 1·sab .8 → ${pct(rHi)}; ai 1·sab 1.6 → ${pct(rHiHi)}`);
  check(r00 === 0, 'S6 no FALSE findings without AI labour');
  check(rLo < rMid && rMid < rHi && rHi < rHiHi, 'S6 FALSE finding rate rises with Trusted to AI × hidden sabotage');
}

// ───────── B3 (E2): no level gate on safety AI labour: the safety model's SAF coverage gates it ─────────
{
  const s = newGame(defaultSetupV2({ seed: 7, alignment: 'medium' }));
  const ctx = makeCtx(s);
  const v = safetyAgentVersion(s) ?? s.player.models.versions[0];
  s.player.staff.saf = Math.max(60, s.player.staff.saf);
  s.player.split.safetyAgents = 0.3;
  s.player.policies.trustedToAI = 0.5;
  resetSafAllocation(s);
  const weak = safetyFleet(s);
  check(trustedShare(s) === 0.5 && weak.aiFte > 0 && weak.aiShare < 0.05, 'B3 the start model: Trusted to AI applies (no level gate), but low SAF coverage keeps the work AI does small', `work AI does ${(weak.aiShare * 100).toFixed(1)}%`);
  check(!act(s, 'agents.trusted', { share: 0.8 }) && s.player.policies.trustedToAI === 0.8, 'B3 Trusted to AI can be raised at any model level (no 50% cap)');
  const r = openInvestigation(s, ctx, { kind: 'trait', versionId: v.id, trait: 'SCHEME' }, 10, {});
  check(typeof r !== 'string', 'B3 investigations open with the safety agents on', String(typeof r === 'string' ? r : r.id));
  if (v.build) v.build.dg += 6;
  resetSafAllocation(s);
  check(safetyFleet(s).aiShare > 10 * weak.aiShare && lineLabour(s, 'AG08').exp > 1.5, 'B3 a covering model does most of the handed work', `work AI does ${(safetyFleet(s).aiShare * 100).toFixed(0)}%`);
}

// ───────── SAFMECH: believed U's range honestly reflects how little is known (beliefs only) ─────────
// Fewer results keep posteriors wide: the same posterior means on fewer results (each line's Beta at a third of its
// counts) must give a wider 80% range of U with a lower bottom, more results (× 3) a narrower one; the point U is the
// same (posterior means). Changing the hidden truth (true efficacy, true traits) moves nothing.
{
  const base = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  // The range needs instruments that read something at the posterior means (a sight limit above 0). Since the labour
  // round (a 20-head safety science team at the start) the RefBot's day-400 lab has not yet got the deception probes it
  // had before; give it them, validated like its other probes.
  const probe = base.player.safety.techniques['T-PROBE'];
  Object.assign(base.player.safety.techniques['T-DECEPT'], { unlocked: true, active: true, validatedOn: probe.validatedOn, validatedOom: probe.validatedOom });
  const scaled = (k: number) => {
    const s = JSON.parse(JSON.stringify(base)) as GameStateV2;
    for (const a of Object.values(s.player.safety.agendas)) { a.posterior.a *= k; a.posterior.b *= k; }
    return s;
  };
  const few = understandingBand(scaled(1 / 3));
  const now = understandingBand(base);
  const many = understandingBand(scaled(3));
  const w = (b: { lo: number; hi: number }) => b.hi - b.lo;
  check(few.U === now.U && many.U === now.U && w(few) > w(now) && w(now) > w(many) && few.lo <= now.lo && now.lo <= many.lo,
    'SAFMECH U range: fewer results (same posterior means) widen believed U\'s 80% range and lower its bottom; more narrow it',
    `few ${few.lo}–${few.hi}, now ${now.lo}–${now.hi}, many ${many.lo}–${many.hi} (U ${now.U})`);
  const t = JSON.parse(JSON.stringify(base)) as GameStateV2;
  for (const k of Object.keys(t.hidden.agendaEfficacy)) t.hidden.agendaEfficacy[k as keyof typeof t.hidden.agendaEfficacy] = 0.05;
  for (const v of t.player.models.versions) { v.traitsTrue.EA = 0.95; v.traitsTrue.OBF = 0.95; }
  const tb = understandingBand(t);
  check(tb.lo === now.lo && tb.hi === now.hi && tb.U === now.U, 'SAFMECH U range reads beliefs only (hidden efficacy and true traits changed: same range)', `${tb.lo}–${tb.hi}`);
}

// RD-B07 (the safety pool's claims) retired by RD-A05a: monitors and safety agents have their own lines of the flat allocation.

console.log(`      (${((performance.now() - t0) / 1000).toFixed(1)} s for the emulated games)`);
finish('safety');
