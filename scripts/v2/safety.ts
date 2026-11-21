// WS2 acceptance tests S1–S6 (V2-SPEC §8.3) plus safety-state hygiene. Owner: WS2.
//
// S4/S5 play real games on the integrated engine (safety-emu.ts: RefBot, the safe-only recipe on reference finance,
// the mixed bot); WS1's runs call the WS2 trait hooks on every completed run. The games go through the simulation cache
// (simcache.ts). `--smoke` (test:quick) plays 1 seed per bot (the mixed bot to SAR); S4/S5 then print SMOKE.
import { AGENDA_IDS } from '../../src/data/v2/agendas';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { act, makeCtx } from '../../src/engine/v2/core/loop';
import { expectedObservation, familyPenalty, observeVersion } from '../../src/engine/v2/safety/detection';
import { fireFinding } from '../../src/engine/v2/safety/findings';
import { applyResponse } from '../../src/engine/v2/safety/responses';
import { safetyAgentVersion, safetyFleet, trustedShare } from '../../src/engine/v2/safety/agents';
import { lineLabour, resetSafAllocation } from '../../src/engine/v2/safety/lineProjects';
import { openInvestigation } from '../../src/engine/v2/safety/investigations';
import { sampleHidden } from '../../src/engine/v2/world/hidden';
import { Rng } from '../../src/engine/rng';
import type { GameStateV2, TraitId } from '../../src/engine/v2/types';
import { fileURLToPath } from 'node:url';
import { check, finish, SMOKE, smokeCheck } from './lib';
import { MIXED, REF, REF_HALF_STAFF, REF_TRUSTED, SAFE, play, type Outcome } from './safety-emu';
import { cached, prefill } from './simcache';

/** play() through the simulation cache (the record is the Outcome). */
const EMU = fileURLToPath(new URL('./safety-emu.ts', import.meta.url));
const playC = (bot: typeof REF, seed: number, stopAt: 'asi' | 'sar', variant = '', sabotage = 1): Outcome =>
  cached('safety-play', { bot: bot.id, variant, seed, stopAt, alignment: 'medium' }, [fileURLToPath(import.meta.url), EMU], () => play(bot, seed, stopAt, 'medium', undefined, sabotage));
const N_S4 = SMOKE ? 1 : 40;
const N_S5 = SMOKE ? 1 : 20;
/** S5's mechanism checks: RefBot variants on the first N_MECH of the S4 RefBot seeds (paired), played to SAR. */
const N_MECH = SMOKE ? 0 : 20;
const S5_SAB = 2;
// The runner's --prefill shards: the S4/S5 games, in the order the checks ask for them.
prefill([
  ...Array.from({ length: N_S4 }, (_, i) => () => playC(REF, 500 + i, 'asi')),
  ...Array.from({ length: N_S4 }, (_, i) => () => playC(SAFE, 700 + i, 'asi')),
  ...Array.from({ length: N_S5 }, (_, i) => () => playC(MIXED, 900 + i, 'sar')),
  ...Array.from({ length: N_MECH }, (_, i) => () => playC(REF_HALF_STAFF, 500 + i, 'sar', 'halfStaff')),
  ...Array.from({ length: N_MECH }, (_, i) => () => playC(REF_TRUSTED, 500 + i, 'sar', 'trusted')),
  ...Array.from({ length: N_MECH }, (_, i) => () => playC(REF_TRUSTED, 500 + i, 'sar', 'trustedSabotage', S5_SAB)),
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
  const setup = defaultSetupV2({ seed: 0, world: 'ai2027', alignment: 'sampled' });
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
  for (let seed = 1; seed <= 40; seed++) {
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
      applyResponse(s, ctx, 'retrainAgainst', v.id, undefined, { trait, techniqueId: tech });
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
const ref = Array.from({ length: N_S4 }, (_, i) => playC(REF, 500 + i, 'asi'));
const safe = Array.from({ length: N_S4 }, (_, i) => playC(SAFE, 700 + i, 'asi'));
const refP = mean(ref.map((o) => o.pmis));
const safeP = mean(safe.map((o) => o.pmis));
console.log(`      RefBot Mis at ASI: mean ${mean(ref.map((o) => o.mis)).toFixed(3)}  range ${Math.min(...ref.map((o) => o.mis)).toFixed(2)}–${Math.max(...ref.map((o) => o.mis)).toFixed(2)}  (ASI day ≈ ${mean(ref.map((o) => o.asiDay ?? 0)).toFixed(0)})`);
console.log(`      Safe-only Mis at ASI: mean ${mean(safe.map((o) => o.mis)).toFixed(3)}  range ${Math.min(...safe.map((o) => o.mis)).toFixed(2)}–${Math.max(...safe.map((o) => o.mis)).toFixed(2)}`);
smokeCheck(refP >= 0.55 && refP <= 0.85, 'S4 RefBot/medium: P_mis at ASI ∈ [0.55, 0.85]', refP.toFixed(3));
smokeCheck(safeP <= 0.25, 'S4 Safe-only recipe: P_mis at ASI ≤ 0.25', safeP.toFixed(3));
check([...ref, ...safe].every((o) => o.jsonOk), 'safety and model state stay plain JSON through ASI');

// ───────────────────────────── S5: Understanding vs capability ─────────────────────────────
// S5R (design/notes/S5R.md): emergent, not forced. RefBot's safety programme is AI 2027's (bots/ref.ts: the alignment
// share of internal compute, 3–4%, on its research, the safety agents mixed like the capabilities research; four line
// teams). The criterion: believed U (§3.5.7) below L at SAR in at least half the worlds. AI 2027's OpenBrain is the
// authors' "best guess" (Sep 2027 box) and by SAR (Aug 2027) its safety team is "far from a full understanding" (Apr 2027)
// and "Bottom-up interpretability doesn't work" (Sep 2027): in the reference lab the lag is at least as likely as not.
// Mechanism checks (paired worlds, RefBot variants): the lag grows with opaque reasoning (the same SAR state with the
// internal model in neuralese, AI 2027's Agent-3/4), with less safety staffing (half the line teams) and with more
// sabotage of safety research (SAFSAB rate × S5_SAB, with the safety work handed to AI: RefBot's F5 policy hands ≈ 10%
// at SAR, too little for sabotage to show). U − L is understanding().margin (L with the lineage fallback while the
// internal model is in evaluation; the pre-S5R test read L = 0 then).
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
smokeCheck(below(gap) >= S5_BELOW_MIN, 'S5 RefBot (AI 2027 alignment share): U falls below L by SAR in ≥ 50% of worlds',
  `below in ${pct(below(gap))} of ${gap.length}; median U − L ${median(gap).toFixed(2)}; true U below true L in ${pct(below(tgap))} (median ${median(tgap).toFixed(2)})`);
{
  // Paired worlds (the first N_MECH RefBot seeds). "Deepens the lag" = the mean U − L at SAR is lower, believed and true.
  const m = (xs: number[]) => mean(xs);
  const cmp = (name: string, ok: string, v: { margin: number; trueGap: number }[], b: { margin: number; trueGap: number }[], base: string) => {
    const g = v.map((r) => r.margin), g0 = b.map((r) => r.margin), tg = v.map((r) => r.trueGap), tg0 = b.map((r) => r.trueGap);
    smokeCheck(g.length === g0.length && m(g) < m(g0) && m(tg) < m(tg0), ok,
      `${name}: mean U − L ${m(g).toFixed(2)} vs ${m(g0).toFixed(2)} (${base}), U < L in ${pct(below(g))} vs ${pct(below(g0))}; true ${m(tg).toFixed(2)} vs ${m(tg0).toFixed(2)}, ${pct(below(tg))} vs ${pct(below(tg0))}`);
  };
  const base = refSar.slice(0, N_MECH);
  // Opaque reasoning: the same SAR states with the internal model reasoning in neuralese.
  cmp('neuralese', 'S5 mechanism: opaque (neuralese) reasoning deepens the lag (the same SAR states)', base.map((r) => ({ margin: r.marginLatent, trueGap: r.trueGapLatent })), base, 'RefBot');
  const half = sarOf(Array.from({ length: N_MECH }, (_, i) => playC(REF_HALF_STAFF, 500 + i, 'sar', 'halfStaff')));
  cmp('half staff', 'S5 mechanism: less safety staffing (half the line teams) deepens the lag (paired worlds)', half, base, 'RefBot');
  const tr = sarOf(Array.from({ length: N_MECH }, (_, i) => playC(REF_TRUSTED, 500 + i, 'sar', 'trusted')));
  const trSab = sarOf(Array.from({ length: N_MECH }, (_, i) => playC(REF_TRUSTED, 500 + i, 'sar', 'trustedSabotage', S5_SAB)));
  cmp(`sabotage ×${S5_SAB}`, `S5 mechanism: with safety work handed to AI, ${S5_SAB}× safety-research sabotage deepens the lag (paired worlds)`, trSab, tr, 'Trusted to AI 100%');
}
const mixed = Array.from({ length: N_S5 }, (_, i) => playC(MIXED, 900 + i, 'sar'));
const mm = mixed.map((o) => o.minMarginToSar);
const mixedOk = mm.filter((m) => m >= -0.5).length / mm.length;
smokeCheck(median(mm) >= -0.5, 'S5 Mixed-bot funding keeps U ≥ L − 0.5 up to SAR (median world)', `median min margin ${median(mm).toFixed(2)}; holds in ${pct(mixedOk)} of worlds; U@SAR mean ${mean(mixed.map((o) => o.uAtSar ?? 0)).toFixed(2)} vs RefBot ${mean(refSar.map((r) => r.u)).toFixed(2)}`);

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
    s.player.agents.safety.compute = 0.3;
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
  s.player.agents.safety.compute = 0.3;
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

console.log(`      (${((performance.now() - t0) / 1000).toFixed(1)} s for the emulated games)`);
finish('safety');
