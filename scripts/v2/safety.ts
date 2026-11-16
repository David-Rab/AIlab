// WS2 acceptance tests S1–S6 (V2-SPEC §8.3) plus safety-state hygiene. Owner: WS2.
//
// S4/S5 play real games on the integrated engine (safety-emu.ts: RefBot, the safe-only recipe on reference finance,
// the mixed bot); WS1's runs call the WS2 trait hooks on every completed run.
import { AGENDA_IDS } from '../../src/data/v2/agendas';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { expectedObservation, familyPenalty, observeVersion } from '../../src/engine/v2/safety/detection';
import { fireFinding } from '../../src/engine/v2/safety/findings';
import { applyResponse } from '../../src/engine/v2/safety/responses';
import { aiLabourGate, safetyAgentVersion, safetyFleet } from '../../src/engine/v2/safety/agents';
import { openInvestigation } from '../../src/engine/v2/safety/investigations';
import { sampleHidden } from '../../src/engine/v2/world/hidden';
import { Rng } from '../../src/engine/rng';
import type { GameStateV2, TraitId } from '../../src/engine/v2/types';
import { check, finish } from './lib';
import { MIXED, REF, SAFE, play } from './safety-emu';

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
const ref = Array.from({ length: 40 }, (_, i) => play(REF, 500 + i, 'asi'));
const safe = Array.from({ length: 40 }, (_, i) => play(SAFE, 700 + i, 'asi'));
const refP = mean(ref.map((o) => o.pmis));
const safeP = mean(safe.map((o) => o.pmis));
console.log(`      RefBot Mis at ASI: mean ${mean(ref.map((o) => o.mis)).toFixed(3)}  range ${Math.min(...ref.map((o) => o.mis)).toFixed(2)}–${Math.max(...ref.map((o) => o.mis)).toFixed(2)}  (ASI day ≈ ${mean(ref.map((o) => o.asiDay ?? 0)).toFixed(0)})`);
console.log(`      Safe-only Mis at ASI: mean ${mean(safe.map((o) => o.mis)).toFixed(3)}  range ${Math.min(...safe.map((o) => o.mis)).toFixed(2)}–${Math.max(...safe.map((o) => o.mis)).toFixed(2)}`);
check(refP >= 0.55 && refP <= 0.85, 'S4 RefBot/medium: P_mis at ASI ∈ [0.55, 0.85]', refP.toFixed(3));
check(safeP <= 0.25, 'S4 Safe-only recipe: P_mis at ASI ≤ 0.25', safeP.toFixed(3));
check([...ref, ...safe].every((o) => o.jsonOk), 'safety and model state stay plain JSON through ASI');

// ───────────────────────────── S5: Understanding vs capability ─────────────────────────────
// Operationalised on the typical (median) world: efficacy is drawn per world, so in a world where the funded
// agendas fail, no funding level keeps U up — that is the intended "agendas fail together" lesson.
const median = (xs: number[]) => {
  const a = [...xs].sort((p, q) => p - q);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const refU = ref.filter((o) => o.uAtSar !== undefined);
const refGap = refU.map((o) => (o.uAtSar ?? 0) - (o.lAtSar ?? 0));
const refBelow = refGap.filter((g) => g < 0).length / Math.max(1, refGap.length);
check(median(refGap) < 0, 'S5 without refresh (RefBot funding) U falls below L by SAR (median world)', `median U − L at SAR ${median(refGap).toFixed(2)}; below in ${pct(refBelow)} of worlds`);
const mixed = Array.from({ length: 20 }, (_, i) => play(MIXED, 900 + i, 'sar'));
const mm = mixed.map((o) => o.minMarginToSar);
const mixedOk = mm.filter((m) => m >= -0.5).length / mm.length;
check(median(mm) >= -0.5, 'S5 Mixed-bot funding keeps U ≥ L − 0.5 up to SAR (median world)', `median min margin ${median(mm).toFixed(2)}; holds in ${pct(mixedOk)} of worlds; U@SAR mean ${mean(mixed.map((o) => o.uAtSar ?? 0)).toFixed(2)} vs RefBot ${mean(refU.map((o) => o.uAtSar ?? 0)).toFixed(2)}`);

// ───────────────────────────── S6: FALSE findings rise with aiLabour × sabotage ─────────────────────────────
{
  const base = newGame(defaultSetupV2({ seed: 6, alignment: 'medium' }));
  const rate = (ai: number, sab: number) => {
    const s = JSON.parse(JSON.stringify(base)) as GameStateV2;
    const v = s.player.models.versions[0];
    v.uModes = [];
    v.traitsTrue.SAND = sab / 2;
    v.traitsTrue.SCHEME = sab / 2;
    s.player.safety.agendas.AG08.aiLabour = ai;
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
  check(rLo < rMid && rMid < rHi && rHi < rHiHi, 'S6 FALSE finding rate rises with aiLabour × hidden sabotage');
}

// ───────── B3 (R1): one AI-labour gate for agendas, investigations and the fleet ─────────
{
  const s = newGame(defaultSetupV2({ seed: 7, alignment: 'medium' }));
  const ctx = makeCtx(s);
  const v = safetyAgentVersion(s) ?? s.player.models.versions[0];
  s.player.staff.saf = Math.max(60, s.player.staff.saf);
  s.player.safety.agentShare = 0.3;
  v.evals.measuredL = 6;
  check(aiLabourGate(s) !== true, 'B3 a model below the gate fails it');
  const r = openInvestigation(s, ctx, { kind: 'trait', versionId: v.id, trait: 'SCHEME' }, 10, { aiLabour: 0.5 });
  check(typeof r === 'string' && r.includes('AI labour'), 'B3 investigations with AI labour need the gate', String(typeof r === 'string' ? r : r.id));
  check(safetyFleet(s).aiFte === 0, 'B3 the safety fleet supplies no AI labour below the gate');
  v.evals.measuredL = 9;
  check(aiLabourGate(s) === true && safetyFleet(s).aiFte > 0, 'B3 above the gate the fleet works');
}

console.log(`      (${((performance.now() - t0) / 1000).toFixed(1)} s for the emulated games)`);
finish('safety');
