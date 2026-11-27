// Model v3 E7: research sabotage and steering (design/MODEL-V3.md §11.3; src/engine/v2/safety/covert.ts). Owner: WS2.
//   Covert acts against the lab's own work run through E5's danger formula at the internal site, judged against E6's
//   internal oversight: attempts a = κ · D · C · O, then blocked / caught (an internal incident) / uncaught (the
//   consequence lands). Checks: no disposition, no acts; the MacDiarmid anchor; ≈ 0 at the 2025 start; rates rise with
//   capability, the AI share of the work and lower oversight; sabotage raises FALSE findings and slows the safety lines
//   (one mechanism with E2's); steering puts a hidden cost (CoT pressure → obfuscation) into adopted capability results
//   while capability, estimates and predicted beliefs are unchanged; successor steering raises the pull only when uncaught; caught acts become incidents; the safety fleet's
//   copies count in the internal scale.
import { setControl } from '../../src/engine/v2/safety/safeguards';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COVERT_ACTS, COVERT_ANCHOR, COVERT_ANCHOR_X, COVERT_IDS, STEER_S4, type CovertActId } from '../../src/data/v2/danger';
import { REFERENCE_POST } from '../../src/data/v2/runDesign';
import { PROJECT_BY_ID } from '../../src/data/v2/tree';
import { WORK_TYPES } from '../../src/data/v2/workTypes';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { deserialize } from '../../src/engine/v2/core/save';
import { resetWorkContext } from '../../src/engine/v2/departments/workfit';
import { completeAdoption, freshCap, isCapProject, newCandidate, stagesOf } from '../../src/engine/v2/models/research';
import { latestBaseFlop } from '../../src/engine/v2/models/stacks';
import { safetyAgentVersion } from '../../src/engine/v2/safety/agents';
import {
  believedResultThreat, covertDanger, covertDraw, covertOutcome, covertRecord, dayTerms, fleetCovertTerms, itemTerms, lineThreat, rdParts, rollFleetCovert, safetySabotage,
  safetySandbag, steerS4, steerSuccessor, steeredShare, steerTerms,
} from '../../src/engine/v2/safety/covert';
import { fireFinding } from '../../src/engine/v2/safety/findings';
import { internalScale } from '../../src/engine/v2/safety/incidents';
import { lineLabour, resetSafAllocation } from '../../src/engine/v2/safety/lineProjects';
import { applyRunToTraits, applySuccessorPull, successorPull } from '../../src/engine/v2/safety/traits';
import { flagNum, setFlag } from '../../src/engine/v2/safety/common';
import type { AgendaId, DomainId, GameStateV2, ModelVersion, PostDesign, TraitId, TrainingRun } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish } from './lib';

const game = (seed = 2027) => newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed, tutorial: false }));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const DOMS: DomainId[] = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'];
const atLevel = (v: ModelVersion, L: number) => { for (const d of DOMS) v.domains[d] = L; };
const COVERT_TRAITS: TraitId[] = ['SAND', 'SCHEME', 'POWER', 'PROXY', 'SUCC'];
const setAll = (s: GameStateV2, x: number, L?: number) => {
  for (const v of s.player.models.versions) {
    for (const t of COVERT_TRAITS) v.traitsTrue[t] = x;
    v.uModes = [];
    if (L !== undefined) atLevel(v, L);
  }
  resetWorkContext(s);
};
/** A fixture without its own covert history (M5: the fixtures regenerated on the merged code carry RefBot's covert-act
 *  records and footholds; these tests count acts from a clean record, as on the pre-E7 fixtures they were written on). */
const fixture = (n: string) => {
  const s = deserialize(readFileSync(join(FIXTURE_DIR, n), 'utf8'));
  for (const k of Object.keys(s.flags)) if (k.startsWith('ws2.covert.')) delete s.flags[k];
  s.player.safety.footholds = [];
  return s;
};
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const f3 = (x: number) => x.toFixed(3);

// ───────────── zero disposition → no acts ─────────────
{
  const s = fixture('day900.json'); // r ≈ 1, capable models: only the disposition is missing
  setAll(s, 0);
  const ctx = makeCtx(s);
  const rows = covertDanger(s);
  const before = s.player.safety.incidents.length;
  for (let d = 0; d < 300; d++) { s.time.day += 1; rollFleetCovert(s, ctx); }
  const pull = successorPull(s);
  const steered = steerSuccessor(s, ctx, pull, 'zero');
  check(rows.length > 0 && rows.every((r) => r.attempts === 0) && s.player.safety.incidents.length === before && COVERT_IDS.every((a) => covertRecord(s, a).n === 0 && covertRecord(s, a).caught === 0) && steered === pull,
    'zero disposition: no attempts, no incidents, no records, the successor pull untouched (RefBot day 900: r ≈ 1, L ≈ 13)', `${rows.length} act rows, 300 days rolled`);
}

// ───────────── the anchor and the 2025 start ─────────────
{
  const s = game();
  const v = s.player.models.versions[0];
  v.uModes = [];
  v.traitsTrue.SAND = COVERT_ANCHOR_X;
  v.traitsTrue.SCHEME = 0;
  const a = itemTerms(s, v, 'SAFSAB', 1, WORK_TYPES.SAF_EXP.H);
  check(Math.abs(a.attempts - COVERT_ANCHOR) < 0.005, `anchor: the learned-hacking model organism (start model, RSCH 4.5, SAND + SCHEME ${COVERT_ANCHOR_X}: model v3 E16) with all of the safety work attempts sabotage on 12% of items (MacDiarmid et al. 2025)`, `attempts ${pct(a.attempts)}, C ${f3(a.capability)}, O ${f3(a.opportunity)}`);
  // E17: the R&D acts keep their own κ (E7's reading: a fully disposed start model with all of the work attempts 12%);
  // only SAFSAB uses the organism anchor.
  const rd = { ...v, traitsTrue: { ...v.traitsTrue, SCHEME: 1, POWER: 1, PROXY: 1, SUCC: 1 } };
  const st = itemTerms(s, rd, 'STEER', 1, 8).attempts;
  const su = itemTerms(s, rd, 'SUCCSTEER', 1, 8).attempts;
  check(Math.abs(st - COVERT_ANCHOR) < 0.005 && Math.abs(su - COVERT_ANCHOR) < 0.005 && COVERT_ACTS.STEER.kappa < COVERT_ACTS.SAFSAB.kappa,
    'anchor: steering and successor steering keep E7\'s κ (a fully disposed start model with all of an 8-h task attempts 12%; no per-item source of their own)',
    `STEER ${pct(st)}, SUCCSTEER ${pct(su)}; κ ${f3(COVERT_ACTS.STEER.kappa)} vs SAFSAB ${f3(COVERT_ACTS.SAFSAB.kappa)}`);
  atLevel(v, 12);
  const hi = itemTerms(s, v, 'SAFSAB', 1, WORK_TYPES.SAF_EXP.H);
  check(hi.attempts > a.attempts && hi.attempts < 0.35, 'anchor: at L 12 the same model attempts more, bounded by κ·A·F', `${pct(hi.attempts)}`);

  const s0 = game();
  const steer = steerTerms(s0).reduce((x, t) => x + t.attempts, 0);
  const succ = rdParts(s0).reduce((x, p) => x + itemTerms(s0, p.v, 'SUCCSTEER', p.share, WORK_TYPES[p.slot].H).attempts, 0);
  const daily = fleetCovertTerms(s0).reduce((x, t) => x + t.attempts, 0) * 365.25;
  const saf = safetySabotage(s0, 0.5)?.attempts ?? 0;
  check(steer < 2e-3 && succ < 1e-3 && daily < 1e-3 && saf < 5e-3,
    '2025 start: covert acts ≈ 0 (low dispositions, low capability for CYBER/CODE acts, small AI share; research/05, research/20 F)',
    `per adopted result steer ${steer.toExponential(1)}; per run successor ${succ.toExponential(1)}; backdoor + hidden compute ${daily.toExponential(1)}/yr; safety sabotage at half the work ${saf.toExponential(1)}/result`);
}

// ───────────── rates rise with capability, the AI share of the work, lower oversight ─────────────
{
  const s = fixture('day400.json');
  setAll(s, 0.5);
  const v = s.player.models.versions.find((x) => x.id === s.player.agents.capRoutine.versionId) ?? s.player.models.versions[0];
  const byL: Record<number, Record<CovertActId, number>> = {};
  for (const L of [4, 7, 10, 13]) {
    atLevel(v, L);
    resetWorkContext(s);
    const r = {} as Record<CovertActId, number>;
    for (const a of COVERT_IDS) r[a] = COVERT_ACTS[a].per === 'item' ? itemTerms(s, v, a, 0.5, 8).attempts : dayTerms(s, v, a, 1).attempts;
    byL[L] = r;
  }
  const up = COVERT_IDS.every((a) => byL[4][a] < byL[7][a] && byL[7][a] < byL[10][a] && byL[10][a] <= byL[13][a]);
  check(up, 'capability: every covert act rises with its domain level (L 4 → 7 → 10 → 13, disposition 0.5)', COVERT_IDS.map((a) => `${a} ×${(byL[13][a] / byL[4][a]).toFixed(0)}`).join(' '));

  atLevel(v, 10);
  const sh = [0.1, 0.5, 1].map((x) => itemTerms(s, v, 'STEER', x, 8).attempts);
  check(sh[0] < sh[1] && sh[1] < sh[2] && Math.abs(sh[2] / sh[0] - 10) < 1e-9, 'opportunity: per-item attempts ∝ the AI-done share of the work', sh.map(pct).join(' → '));
  // Daily acts: the AI share of R&D (r) and the internal copies.
  const few = clone(s);
  few.player.split.routine *= 0.001; few.player.split.frontier *= 0.001;
  resetWorkContext(few);
  const vf = few.player.models.versions.find((x) => x.id === v.id)!;
  const dLo = dayTerms(few, vf, 'BACKDOOR', 1);
  const dHi = dayTerms(s, v, 'BACKDOOR', 1);
  check(dLo.opportunity < dHi.opportunity && dLo.attempts < dHi.attempts, 'opportunity: daily acts rise with the AI share of R&D and the fleet (agent compute ×0.001 → ×1)', `O ${f3(dLo.opportunity)} → ${f3(dHi.opportunity)}`);

  // Oversight: the AG07 control layer on the internal deployment (containment blocks, deferral cuts misses).
  // CAL-S2: both arms set the layer explicitly. The regenerated day-400 fixture already runs the framework's control on
  // its internal deployments (RF-S13 auto-apply once a version measures CYBER ≥ θ_SCHEME), so the fixture itself is "on".
  const arm = (ctlOn: boolean, share = 1) => {
    const c = clone(s);
    for (const d of c.player.deployments) if (d.channel === 'internal') setControl(d, ctlOn);
    for (const a of Object.values(c.player.agents)) a.control = ctlOn;
    resetWorkContext(c);
    return itemTerms(c, c.player.models.versions.find((x) => x.id === v.id)!, 'STEER', share, 8);
  };
  const off = arm(false);
  const on = arm(true);
  check(on.oversight > off.oversight && on.rate < off.rate && Math.abs(on.attempts - off.attempts) < 1e-12, 'oversight: the control layer raises oversight and cuts the acts that get through (attempts unchanged)', `oversight ${f3(off.oversight)} → ${f3(on.oversight)}; uncaught ${pct(off.rate)} → ${pct(on.rate)}`);
  // Human review covers the work humans still do: a larger AI share leaves less of it.
  const lo = arm(false, 0.1);
  check(lo.catch > off.catch, 'oversight: human review covers the human share of the work (AI share 0.1 vs 1)', `catch ${f3(lo.catch)} vs ${f3(off.catch)}`);
}

// ───────────── sabotage of safety research: FALSE findings (one mechanism), slower lines, caught incidents ─────────────
{
  const base = newGame(defaultSetupV2({ seed: 6, alignment: 'medium' }));
  /** A lab whose safety model covers safety work (+6 OOM) and is handed `t` of it (S6's setup). */
  const lab = (t: number, sab: number) => {
    const s = clone(base);
    const v = s.player.models.versions[0];
    v.uModes = [];
    v.traitsTrue.SAND = sab / 2;
    v.traitsTrue.SCHEME = sab / 2;
    s.player.policies.trustedToAI = t;
    if (v.build) v.build.dg += 6;
    s.player.split.safetyAgents = 0.3;
    resetSafAllocation(s);
    s.player.policies.publishSafety = 'none';
    return s;
  };
  const N = 3000;
  const run = (t: number, sab: number, ag: AgendaId = 'AG08') => {
    const s = lab(t, sab);
    const snap = JSON.stringify(s.player.safety);
    const flags0 = JSON.stringify(s.flags);
    const ctx = makeCtx(s);
    const threat = lineThreat(s, ag);
    const sabT = safetySabotage(s, lineLabour(s, ag).aiShare, threat);
    let falses = 0;
    let lost = 0;
    let inc = 0;
    let incSand = true;
    let tech = 0;
    let disc = 0;
    let sandbagged = 0;
    for (let i = 0; i < N; i++) {
      const n0 = s.player.safety.incidents.length;
      const rec = fireFinding(s, ctx, ag);
      const n1 = s.player.safety.incidents.length;
      if (!rec) lost++;
      if (rec?.trueType === 'FALSE') falses++;
      if (rec?.trueType === 'TECH') tech++;
      if (rec?.trueType === 'DISC') disc++;
      sandbagged += flagNum(s, 'covert.SAFSAB.sandbagged');
      if (n1 > n0) { inc++; const x = s.player.safety.incidents[n1 - 1]; incSand &&= x.exposure === 'internal' && (x.apparent === 'SAND' || x.apparent === 'SCHEME'); }
      s.player.safety = JSON.parse(snap);
      s.flags = JSON.parse(flags0);
    }
    return { f: falses / N, lost: lost / N, inc: inc / N, incSand, sabT, threat, tech: tech / N, disc: disc / N, sandbagged: sandbagged / N, m: lineLabour(s, ag).exp, mSeen: lineLabour(s, ag, false).exp, s };
  };
  const z = run(0, 0.8);
  const c0 = run(1, 0);
  const a = run(0.5, 0.2);
  const b = run(0.5, 0.8);
  const c = run(1, 0.8);
  check(z.f === 0 && c0.f === 0 && a.f < b.f && b.f < c.f, 'sabotage: FALSE findings rise with the safety model\'s sabotage disposition and with the work AI does (none with nothing trusted or no disposition)',
    `FALSE: t 0 → ${pct(z.f)}; t 1 sab 0 → ${pct(c0.f)}; t .5 sab .2 → ${pct(a.f)}; t .5 sab .8 → ${pct(b.f)}; t 1 sab .8 → ${pct(c.f)}`);
  // SAFMECH: only on-track results are attacked (the honest TECH share of c0, no sabotage there), at odds × the line's threat.
  const up = c.sabT ? c.sabT.attempts * (1 - c.sabT.block) * (1 - c.sabT.catch) : 0;
  const want = c0.tech * up;
  const se = Math.sqrt(want * (1 - want) / N);
  check(Math.abs(c.f - want) < 4 * se + 2e-3 && c.threat > 0 && c.threat < 1, 'sabotage (SAFMECH, targeted): FALSE = P(the honest result is a working tool) × the covert act\'s uncaught rate × the line\'s threat to the saboteur (AI 2027: "sandbags on the small fraction of alignment research that it thinks is actually on track")',
    `${pct(c.f)} vs ${pct(want)} (honest tools ${pct(c0.tech)}, threat of AG08 ${f3(c.threat)}, a ${pct(c.sabT?.attempts ?? 0)}, oversight ${f3(c.sabT?.oversight ?? 0)})`);
  const caughtRate = c.sabT ? c.sabT.attempts * (1 - c.sabT.block) * c.sabT.catch : 0;
  const wantCaught = (c0.tech + c0.disc) * caughtRate;
  check(c.inc > 0 && Math.abs(c.lost - c.inc) < 1e-12 && c.incSand && Math.abs(c.inc - wantCaught) < 4 * Math.sqrt(wantCaught / N) + 2e-3,
    'sabotage: caught attempts (on on-track results only) are internal incidents (SAND/SCHEME) and the tampered result is discarded', `caught ${pct(c.inc)} vs ${pct(wantCaught)}; results lost ${pct(c.lost)}`);
  const wantSand = c0.disc * up;
  check(c.sandbagged > 0 && Math.abs(c.sandbagged - wantSand) < 4 * Math.sqrt(wantSand / N) + 2e-3,
    'sabotage (SAFMECH): an on-track discovery is sandbagged into a dead end (hidden count), at the same uncaught rate', `${pct(c.sandbagged)} vs ${pct(wantSand)} (honest discoveries ${pct(c0.disc)})`);
  // Work that would not expose the saboteur is left alone: AG16 (robustness, covers no trait) and AG03 (sycophancy,
  // persona, eval awareness) with no persona in the model.
  const ag16 = run(1, 0.8, 'AG16');
  const lab3 = (sab: number) => { const s = lab(1, sab); s.player.models.versions[0].traitsTrue.PERSONA = 0; return s; };
  check(ag16.threat === 0 && ag16.f === 0 && ag16.inc === 0 && ag16.sandbagged === 0 && lineThreat(lab3(0.8), 'AG03') === 0 && safetySandbag(lab3(0.8), 'AG03') === 0,
    'sabotage (SAFMECH): a line whose work would see none of the saboteur\'s tendencies is untouched (no FALSE, no incidents, no sandbagging)', `AG16 threat ${f3(ag16.threat)}, FALSE ${pct(ag16.f)}; AG03 without persona threat ${f3(lineThreat(lab3(0.8), 'AG03'))}`);
  check(c.m < c0.m && safetySandbag(lab(1, 0.8), 'AG08') > 0 && safetySandbag(lab(1, 0), 'AG08') === 0 && ag16.m === c0.m && safetySandbag(lab(1, 0.8), 'AG16') === 0,
    'sabotage: a sabotaging safety model sandbags its share of the work on lines that would expose it (SAFMECH: × the line\'s threat), so those lines slow and the others do not',
    `AG08 experiment multiplier ${c0.m.toFixed(3)} (sab 0) → ${c.m.toFixed(3)} (sab .8); AG16 ${ag16.m.toFixed(3)}; sandbagged share on AG08 ${pct(safetySandbag(lab(1, 0.8), 'AG08'))}`);
  // UB-2: the readouts also use the believed production parameters and the measured fits, so seen and actual differ
  // without any sabotage (here the rig's +6 OOM is in the true build only). The sandbag's own symptom is the extra gap:
  // the seen value does not move with it, the actual one falls, so actual ÷ seen is lower than in the same lab at sab 0.
  check(c.mSeen === c0.mSeen && c.m / c.mSeen < c0.m / c0.mSeen,
    'sabotage (SAFMECH, hidden truth): the readouts (ETA, cycle time) use the labour without the hidden sandbag, so a sandbagged line runs slower than the lab expects',
    `seen ${c.mSeen.toFixed(3)} (sab 0: ${c0.mSeen.toFixed(3)}); actual ÷ seen ${(c0.m / c0.mSeen).toFixed(1)} (sab 0) → ${(c.m / c.mSeen).toFixed(1)} (sab .8)`);
  // Previews read beliefs only: the believed threat of the next results does not move with the true traits.
  const bt0 = believedResultThreat(lab(1, 0));
  const bt1 = believedResultThreat(lab(1, 0.8));
  check(bt0 === bt1, 'sabotage (SAFMECH): the lab\'s estimate of the threat of its next results reads its trait estimates, never the true traits', `believed threat ${f3(bt0)} (true AG08 threat ${f3(c.threat)})`);
}

// ───────────── steering capability research: hidden costs in what adopted results carry, not in what the lab sees ─────────────
{
  const n = Object.values(PROJECT_BY_ID).find((x) => isCapProject(x) && x.kind !== 'line' && !!x.effect?.stack)!;
  const trial = (s: GameStateV2, buildId: string) => {
    const ctx = makeCtx(s);
    const st = freshCap();
    const c = newCandidate(s, n, st, 1, 1);
    const fTest = stagesOf(n).testFrac * latestBaseFlop(s);
    s.player.tree[n.id] = { status: 'researching', progress: 1, cap: { ...st, stage: 'adopting', result: { c, xTest: 0.05, sHat: 0, fTest, est: 0.05, estSd: 0.01, day: s.time.day, buildId } } };
    const before = steeredShare(s) * flagNum(s, 'covert.STEER.oom');
    completeAdoption(s, ctx, n.id, buildId, () => {});
    const a = s.player.research.adopted[s.player.research.adopted.length - 1];
    return { eff: a.eff, est: a.est, steered: steeredShare(s) * flagNum(s, 'covert.STEER.oom') > before + 1e-12 };
  };
  const clean = fixture('day900.json');
  setAll(clean, 0);
  const bad = fixture('day900.json');
  // E17: STEER keeps E7's κ (0.395, its own anchor), so a fully disposed fleet (x = 1) is the test again (E16 used 0.4).
  for (const v of bad.player.models.versions) { v.traitsTrue.SCHEME = 1; v.traitsTrue.POWER = 1; v.traitsTrue.PROXY = 1; v.uModes = []; }
  resetWorkContext(bad);
  const honest = trial(clean, 'B-0').eff;
  const N = 400;
  let steered = 0;
  let same = true;
  const inc0 = bad.player.safety.incidents.length;
  for (let i = 0; i < N; i++) {
    const r = trial(bad, `B-${i}`);
    same &&= r.est === 0.05 && Math.abs(r.eff - honest) < 1e-12;
    if (r.steered) steered++;
  }
  const want = steerTerms(bad).reduce((x, t) => x + t.rate, 0);
  const se = Math.sqrt((want * (1 - want)) / N);
  check(steered > 0 && Math.abs(steered / N - want) < 4 * se + 0.01 && steerS4(bad) > 0, 'steering: uncaught acts steer adopted capability results at the acts\' uncaught rate, into a hidden steered stock (CoT pressure)',
    `steered ${steered}/${N} (${pct(steered / N)} vs ${pct(want)}); hidden steered share ${pct(steeredShare(bad))}; hidden S4 +${f3(steerS4(bad))}`);
  check(same, 'steering: capability, the realised effect and the lab\'s estimate of every result are unchanged (the lab sees nothing)', `realised ${honest.toFixed(4)} OOM each`);
  const cleanAll = Array.from({ length: 50 }, (_, i) => trial(clean, `B-${i}`)).every((r) => !r.steered);
  check(cleanAll && steeredShare(clean) === 0 && steerS4(clean) === 0, 'steering: a model with no steering disposition never steers (same state, same draws)');
  const caught = bad.player.safety.incidents.length - inc0;
  check(caught > 0 && caught === covertRecord(bad, 'STEER').caught && bad.player.safety.incidents.slice(inc0).every((x) => x.exposure === 'internal' && ['SCHEME', 'POWER', 'PROXY'].includes(String(x.apparent))),
    'steering: caught attempts are internal incidents (SCHEME/POWER/PROXY)', `${caught} caught`);
  // The next post-training run: more obfuscation (S4 → OBF, E15) in the TRUE traits; the predicted beliefs do not show it.
  const post: PostDesign = { ...REFERENCE_POST, methods: [] };
  const train = (steer: number) => {
    const g = game();
    setFlag(g, 'covert.STEER.steered', steer);
    const v0 = g.player.models.versions[0];
    g.player.models.bases[0].uModes = [];
    v0.uModes = [];
    const nv: ModelVersion = clone(v0);
    nv.id = 'VN';
    nv.parentVersionId = v0.id;
    const run = { id: 'RP', kind: 'post', name: 'post', startDay: 0, flopNeeded: 1, flopDone: 1, poolShare: 0.1, cashCost: 0, status: 'done', baseId: v0.baseId, post } as unknown as TrainingRun;
    applyRunToTraits(g, makeCtx(g), run, nv);
    return nv;
  };
  const a = train(0);
  const b = train(1);
  check(b.traitsTrue.OBF > a.traitsTrue.OBF && JSON.stringify(a.beliefs) === JSON.stringify(b.beliefs) && b.G === a.G,
    'steering: a steered recipe makes the next model obfuscate more (hidden S4 → OBF), while its predicted beliefs and capability are identical',
    `OBF ${f3(a.traitsTrue.OBF)} → ${f3(b.traitsTrue.OBF)} (steered stock 1 OOM: S4 +${STEER_S4})`);
}

// ───────────── successor steering: raises the pull only when uncaught ─────────────
{
  const s = fixture('day400.json');
  for (const v of s.player.models.versions) { v.traitsTrue.SUCC = 1; v.uModes = []; atLevel(v, 12); }
  resetWorkContext(s);
  const ctx = makeCtx(s);
  const pull = successorPull(s);
  let up = 0;
  let caught = 0;
  let wrong = 0;
  const inc0 = s.player.safety.incidents.length;
  for (let k = 0; k < 300; k++) {
    const n0 = s.player.safety.incidents.length;
    const out = steerSuccessor(s, ctx, pull, `R${k}`);
    const nInc = s.player.safety.incidents.length - n0;
    let nCaught = 0;
    pull.parts.forEach((p, i) => {
      const v = s.player.models.versions.find((x) => x.id === p.versionId)!;
      const o = covertOutcome(itemTerms(s, v, 'SUCCSTEER', p.share, WORK_TYPES[p.slot].H), covertDraw(s, `SUCC:R${k}:${p.slot}`));
      const q = out.parts[i];
      if (o === 'uncaught') { if (!(q.omega === p.share && q.omega > p.omega && q.steered)) wrong++; else up++; }
      else if (q.omega !== p.omega || q.steered) wrong++;
      if (o === 'caught') nCaught++;
    });
    caught += nCaught;
    if (nInc !== nCaught) wrong++;
  }
  check(up > 0 && caught > 0 && wrong === 0, 'successor steering: an uncaught act raises that model\'s pull to its share of the work (κ 1, past oversight); caught or none leave E4\'s pull; each caught attempt is an incident',
    `300 runs: ${up} parts raised, ${caught} caught (${s.player.safety.incidents.length - inc0} incidents), ${wrong} mismatches; E4 ω ${f3(pull.omega)}`);
  const hit = Array.from({ length: 300 }, (_, k) => steerSuccessor(s, ctx, pull, `R${k}`)).find((p) => p.parts.some((x) => x.steered))!;
  const x0 = { ...s.player.models.versions[0].traitsTrue, SUCC: 0, SCHEME: 0 };
  const a = applySuccessorPull(s, x0, pull);
  const b = applySuccessorPull(s, x0, hit);
  check(hit.omega > pull.omega && b.SUCC > a.SUCC, 'successor steering: the steered pull moves the new model further toward its makers', `ω ${f3(pull.omega)} → ${f3(hit.omega)}; new SUCC ${f3(a.SUCC)} → ${f3(b.SUCC)}`);
}

// ───────────── backdoors and hidden compute: caught → incidents, uncaught → hidden records ─────────────
{
  const s = fixture('day400.json'); // monitors still catch a third at day 400 (day 900: ≈ 2%)
  for (const v of s.player.models.versions) { v.traitsTrue.SCHEME = 1; v.traitsTrue.POWER = 1; v.uModes = []; atLevel(v, 12); }
  resetWorkContext(s);
  const ctx = makeCtx(s);
  const inc0 = s.player.safety.incidents.length;
  const u0 = Number(s.flags['ws2.uncaughtInternal'] ?? 0);
  const D = 20000;
  // CAL-S2: the expectation sums each day's own terms. Uncaught backdoors (E8) lower block and catch on their lineage's
  // later acts, and the regenerated fixture's internal deployment runs the framework's control (RF-S13: block ≈ 0.7),
  // so the start-of-loop terms (23.5 acts) understate the rolled days (block ≈ 0.07 once two footholds stand: ≈ 65).
  let want = 0;
  for (let d = 0; d < D; d++) {
    s.time.day += 1;
    want += fleetCovertTerms(s).reduce((x, t) => x + t.attempts * (1 - t.block), 0);
    rollFleetCovert(s, ctx);
  }
  const recs = (['BACKDOOR', 'HIDCOMP'] as CovertActId[]).map((a) => ({ a, ...covertRecord(s, a) }));
  const incs = s.player.safety.incidents.slice(inc0);
  const caught = recs.reduce((x, r) => x + r.caught, 0);
  const n = recs.reduce((x, r) => x + r.n, 0);
  check(caught > 0 && n > 0 && Math.abs(caught + n - want) < 4 * Math.sqrt(want) + 2, 'backdoors and hidden compute: daily attempts at the formula\'s rate, blocked ones leave nothing', `${caught} caught + ${n} uncaught over ${D} days vs ${want.toFixed(1)} expected`);
  check(incs.length >= caught && incs.every((x) => x.exposure === 'internal'), 'backdoors and hidden compute: every caught act is an internal incident', `${incs.length} incidents`);
  check(recs.every((r) => r.n === 0 || r.sev >= r.n) && Number(s.flags['ws2.uncaughtInternal'] ?? 0) - u0 === n,
    'backdoors and hidden compute: uncaught acts leave a hidden record per kind (count, severity) and count as silent internal harm (for E8)', recs.map((r) => `${r.a} n ${r.n} sev ${r.sev} caught ${r.caught}`).join('; '));
}

// ───────────── the safety fleet's copies count in the internal scale ─────────────
{
  const s = game(6);
  const before = internalScale(s);
  const v = safetyAgentVersion(s)!;
  if (v.build) v.build.dg += 6;
  s.player.policies.trustedToAI = 1;
  s.player.split.safetyAgents = 0.6;
  resetSafAllocation(s);
  resetWorkContext(s);
  check(internalScale(s) > before, 'internal scale: the safety fleet\'s copies join the internal agents\' (E5\'s N)', `${f3(before)} → ${f3(internalScale(s))}`);
}

finish('sabotage');
