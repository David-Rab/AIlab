// WS2 acceptance tests S1–S6 (V2-SPEC §8.3) plus safety-state hygiene. Owner: WS2. Tier: quick (--smoke) and full.
//
// Constructed cases only (TESTING.md §0): S1 agenda draws, S2/S3 formulas, S5 mechanism (neuralese deepens the lag, on the
// day-900 fixture), the S5 sabotage pair, S6, B3, SAFMECH, and S4's direction check (paired arms from the day-400 fixture).
// The played S4/S5 targets (RefBot / safe-only P_mis at ASI, Mixed sight limit, half staffing) and the RefBot-game rates
// moved to scripts/v2/calreport/safety.ts, the calibration report.
// Cost: ~10 s of constructed cases plus the S4 direction check (2 × 120 days ≈ 10 s); no cached game. `--smoke` changes nothing.
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
import { check, finish, FIXTURE_DIR } from './lib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../src/engine/v2/core/save';
import { sightLimit, trueSightLimit } from '../../src/engine/v2/safety/sightLimit';
import { internalVersion } from '../../src/engine/v2/models/labs';
// SR-11: the sight limit in the shape these analyses read (U = sight limit, margin = sight limit − level).
const understandingBand = (s: GameStateV2) => { const r = sightLimit(s); return { U: r.L, lo: r.lo, hi: r.hi }; };
import { sarRead } from './safety-emu';
import { refAct, refDecide, REF_PLAY, type RefPlayOpts } from '../../src/engine/v2/bots/ref';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { engine } from '../../src/engine/v2/index';
import { misalignment, pMis } from '../../src/engine/v2/safety/traits';
import { COVERT_ACTS } from '../../src/data/v2/danger';
import { flagNum } from '../../src/engine/v2/safety/common';


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

// ───────────────────────────── S4/S5 mechanism checks (constructed; the sourced bands live in calreport/safety.ts) ─────────────────────────────
// The sourced S4 / S5 targets (RefBot P_mis at ASI, safe-only P_mis, Mixed sight limit above RefBot's, half staffing)
// are calibration: they moved to the calibration report with their games (TESTING.md §0). What stays is what can fail
// when the code is broken.
const day900 = () => deserialize(readFileSync(join(FIXTURE_DIR, 'day900.json'), 'utf8'));
{
  // S5 mechanism: opaque reasoning deepens the lag. The same state with the internal model reasoning in neuralese
  // (AI 2027's Agent-3/4): U − L, believed and true, is lower (S5R, design/archive/V3-BUILD.md "S5R").
  const r = sarRead(day900());
  check(r.marginLatent < r.margin && r.trueGapLatent <= r.trueGap, 'S5 mechanism: opaque (neuralese) reasoning deepens the lag (the same state: believed U − L lower, true U − L not higher)',
    `believed ${r.margin.toFixed(2)} → ${r.marginLatent.toFixed(2)}, true ${r.trueGap.toFixed(2)} → ${r.trueGapLatent.toFixed(2)}`);
}

// ───────────────────────────── S4 direction: more safety → less misalignment (paired arms) ─────────────────────────────
// The same world and seed (day-400 fixture), the same bot, 120 days under two safety allocations: RefBot's reference
// (AI 2027's alignment share of compute and its staffing) vs a safety-heavy one (40% of compute and of staff on safety,
// heavy safety post-training, faithful CoT). World noise cancels, so one world over a short stretch is enough: the
// safety-heavy arm's newest model ends with lower Mis (and P_mis). Measured 2026-11-28, Mis of the newest version, day-400
// fixture: 60 d 0.128 vs 0.121; 90 d 0.134 vs 0.121; 120 d 0.136 vs 0.079; 150 d 0.136 vs 0.032; 240 d 0.091 vs 0.026
// (reference vs heavy). The released model (bestPlayerVersion) flips with release timing, so the newest version is read.
// The day-900 fixture shows no consistent direction over 90–150 days (0.150 vs 0.147; 0.135 vs 0.148), so it is not used.
{
  const base = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const heavy: RefPlayOpts = { safetyShare: () => 0.4, safStaffShare: 0.4, post: () => ({ pref: 'constitution', rlBudget: 'standard', cot: 'faithful', safety: 'heavy' }) };
  const arm = (o: RefPlayOpts) => {
    const s = structuredClone(base);
    const end = s.time.day + 120;
    while (s.time.day < end && s.player.status === 'active') {
      for (const p of [...s.events.pending]) {
        const c = refDecide(s, p);
        if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
      }
      refAct(s, engine, o);
      tick(s, { skip: ['endings'] });
    }
    const v = internalVersion(s);
    const mis = v ? misalignment(v.traitsTrue, v.uModes) : NaN;
    return { mis, pmis: pMis(s, mis) };
  };
  const a = arm(REF_PLAY);
  const b = arm(heavy);
  check(Number.isFinite(a.mis) && Number.isFinite(b.mis) && b.mis < a.mis && b.pmis <= a.pmis, 'S4 direction: a safety-heavy allocation ends with a less misaligned newest model than the reference allocation (paired, same world, 120 days from day 400)',
    `Mis ${b.mis.toFixed(3)} vs ${a.mis.toFixed(3)}, P_mis ${b.pmis.toFixed(4)} vs ${a.pmis.toFixed(4)}`);
}

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

finish('safety');
