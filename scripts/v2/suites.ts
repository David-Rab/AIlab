// Model v3 D5 environment suites (design/MODEL-V3.md §4.3, §11.2; src/engine/v2/models/suites.ts). Owner: WS1.
//   One suite per RL family: fidelity scales that family's RL ceiling A_f, exploitability feeds S2 for the RL compute
//   spent on the family. The start suites reproduce V1's reference RL gain and S2 (leader = the old hardened graders,
//   the spinout = cheap); higher fidelity raises that family's gain (others only via transfer); higher exploitability
//   raises S2; building and hardening cost team-weeks and cash (hardening with diminishing returns); a family with no
//   suite cannot be focused; a run freezes its suites at launch.
// Model v3 D9: P12 (long-horizon human demos) delivers expert data into the long-tasks suite at the expert-data price;
//   its fidelity raises that family's RL gain, AGENCY and the horizon; the old flat flags are gone.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RL_BUDGET, REFERENCE_POST, RL_REF_GAIN } from '../../src/data/v2/runDesign';
import { EXPERT_PRICE_B_PER_T, EXPERT_START_T, EXPLOIT_CHEAP, EXPLOIT_START, P12_DEMO_T, SUITE_BUILD, SUITE_HARDEN } from '../../src/data/v2/suites';
import { H50_PER_OOM } from '../../src/data/v2/workTypes';
import { TREE_BY_ID } from '../../src/data/v2/tree';
import { candidateTruth, completeAdoption, freshCap } from '../../src/engine/v2/models/research';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { act, makeCtx } from '../../src/engine/v2/core/loop';
import { deserialize, serialize } from '../../src/engine/v2/core/save';
import { refPlay } from '../../src/engine/v2/bots/ref';
import { engine } from '../../src/engine/v2';
import { unbuiltSuites } from '../../src/engine/v2/models/suitesPreview';
import { upkeepLines } from '../../src/engine/v2/departments/build';
import { rlFamiliesAvailable, rlGains, rlWeights } from '../../src/engine/v2/models/effective';
import { planRun, playerRlWeights } from '../../src/engine/v2/models/runs';
import {
  S2_PER_EXPLOIT, completeSuiteWork, expertAssetId, fidelityOf, suiteExploitMap, suiteFamilies, suiteFidMap, suiteFidelity, suiteOf, suiteWorkCost, unbuiltSuiteFamilies,
} from '../../src/engine/v2/models/suites';
import { postSignals } from '../../src/engine/v2/safety/traits';
import type { Candidate, GameStateV2, OwnedDataAsset, PostDesign, RLFamily } from '../../src/engine/v2/types';
import { FIXTURE_DIR, HERE, check, finish, runTo } from './lib';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const game = (start: 'leader' | 'challenger' | 'bigtech' | 'spinout' = 'leader') => newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, start, tutorial: false }));
const post = (o: Partial<PostDesign> = {}): PostDesign => ({ ...REFERENCE_POST, techniques: [], trainAgainst: [], ...o });
const expert = (s: GameStateV2, f: RLFamily) => s.player.dataPortfolio.assets.find((a): a is OwnedDataAsset => a.id === expertAssetId(f));
const F0 = 3e26;
const START_FAMS = rlFamiliesAvailable(() => false);
const wBroad = rlWeights('broad', START_FAMS);

// ---------- start suites ----------
const s0 = game();
check(suiteFamilies(s0).join(',') === START_FAMS.join(',') && !suiteOf(s0, 'computerUse'),
  'start: one suite per start RL family (computer use has none until P06)', suiteFamilies(s0).join(', '));
check(START_FAMS.every((f) => near(suiteFidelity(s0, f), 1, 1e-12) && near(expert(s0, f)?.tokensT ?? 0, EXPERT_START_T, 1e-15)),
  'start: every suite holds the start expert data (D1\'s expert asset, q 3) at fidelity 1', `${EXPERT_START_T}T per family`);
check(START_FAMS.every((f) => suiteOf(s0, f)!.exploit === EXPLOIT_START[f]), 'start: the leader\'s suites are hardened (0.4 × cheap)',
  START_FAMS.map((f) => `${f} ${(EXPLOIT_START[f] * 100).toFixed(1)}%`).join(', '));

// ---------- reference RL gain (fidelity 1 = V1) ----------
const refNoFid = rlGains(F0, RL_BUDGET.standard * F0, wBroad, 0);
const refFid = rlGains(F0, RL_BUDGET.standard * F0, wBroad, 0, 0, suiteFidMap(s0));
check(refFid.general === refNoFid.general && near(refFid.general, RL_REF_GAIN, 0.005), 'start suites reproduce V1\'s reference RL gain (standard, broad) exactly',
  `${refFid.general.toFixed(4)} OOM (V1 ${refNoFid.general.toFixed(4)})`);
const vb = s0.player.models.versions[0].build!;
const v0NoFid = rlGains(vb.flopPre, vb.rlFlop, vb.rlW, vb.eRL, vb.aRL ?? 0).general;
const plan0 = planRun(s0, { kind: 'post', baseId: 'B0', post: post() }).g.rl!;
const vbP = planRun(s0, { kind: 'post', baseId: 'B0', post: post() });
check(Object.values(vb.rlFid ?? {}).every((x) => x === 1) && vb.dgRL === v0NoFid && !!vbP.g.rl,
  'start: V0 is built on fidelity-1 suites (its RL gain is V1\'s)', `V0 ΔG_RL ${vb.dgRL.toFixed(4)} OOM; a reference post-train today ${plan0.general.toFixed(4)} OOM`);

// ---------- reference S2 (exploitability at the start = V1's hardened graders) ----------
const s2 = (s: GameStateV2, o: Partial<PostDesign> = {}) => postSignals(s, post(o)).S2;
check(near(s2(s0), 0.36, 1e-9), 'start suites reproduce V1\'s reference S2 (standard, broad, hardened graders: 0.6 × 0.6 = 0.36)', s2(s0).toFixed(4));
const starts = { challenger: game('challenger'), bigtech: game('bigtech'), spinout: game('spinout') };
check(near(s2(starts.challenger), 0.36, 1e-9) && near(s2(starts.bigtech), 0.36, 1e-9) && near(s2(starts.spinout), 0.9, 1e-9),
  'follower starts by their start tables: challenger and big tech hardened (0.36), the spinout cheap (0.9 = V1\'s cheap graders)',
  `${s2(starts.challenger).toFixed(3)} / ${s2(starts.bigtech).toFixed(3)} / ${s2(starts.spinout).toFixed(3)}`);
check(near(s2(s0, { rlBudget: 'light' }), 0.18, 0.002) && near(s2(s0, { rlBudget: 'heavy' }), 0.468, 0.002), 'the RL budget\'s optimisation pressure (model v3 E3: Gao\'s log form in ρ) keeps V1\'s light ×0.5, heavy ×1.3 within 1%',
  `${s2(s0, { rlBudget: 'light' }).toFixed(3)} / ${s2(s0, { rlBudget: 'heavy' }).toFixed(3)}`);
const wSwe = rlWeights(['swe'], START_FAMS);
const wantSwe = S2_PER_EXPLOIT * START_FAMS.reduce((a, f) => a + (wSwe[f] ?? 0) * EXPLOIT_START[f], 0);
check(near(s2(s0, { rlFocus: ['swe'] }), wantSwe, 1e-9), 'S2 = S2_PER_EXPLOIT × Σ_f RL share_f × exploitability_f (a SWE focus: 70% of the RL compute on the most hackable suite)',
  `${s2(s0, { rlFocus: ['swe'] }).toFixed(3)} (κ ${S2_PER_EXPLOIT.toFixed(3)}; V1 gave 0.36 for any SWE focus)`);

// ---------- fidelity: that family's gain, others only via transfer ----------
const fidSwe = { ...suiteFidMap(s0), swe: 1.25 };
const hi = rlGains(F0, RL_BUDGET.standard * F0, wBroad, 0, 0, fidSwe);
const dCode = hi.perDomain.CODE - refFid.perDomain.CODE;
const dRsch = hi.perDomain.RSCH - refFid.perDomain.RSCH;
const dBio = hi.perDomain.BIO - refFid.perDomain.BIO;
check((hi.perFamily.swe ?? 0) > (refFid.perFamily.swe ?? 0) && START_FAMS.filter((f) => f !== 'swe').every((f) => hi.perFamily[f] === refFid.perFamily[f]),
  'fidelity: a better SWE suite raises the SWE family\'s gain and no other family\'s', `swe ${refFid.perFamily.swe!.toFixed(3)} → ${hi.perFamily.swe!.toFixed(3)} OOM`);
check(dCode > dRsch && dRsch > dBio && dBio > 0, 'fidelity: domains gain through transfer only (CODE same > RSCH adjacent > BIO far > 0)',
  `ΔCODE ${dCode.toFixed(4)}, ΔRSCH ${dRsch.toFixed(4)}, ΔBIO ${dBio.toFixed(4)} OOM`);
const focus = rlWeights(['swe'], START_FAMS);
const capHi = rlGains(F0, 100 * F0, focus, 0, 0.3, fidSwe);
check(capHi.perDomain.CODE <= 1.25 * capHi.ceiling + 1e-9 && capHi.perDomain.CODE > rlGains(F0, 100 * F0, focus, 0, 0.3).perDomain.CODE,
  'fidelity scales the ceiling with the RL-ceiling stack: A_f = fid_f · (A_base + a_RL), bounded', `CODE at 100× ρ ${capHi.perDomain.CODE.toFixed(3)} ≤ 1.25 × ${capHi.ceiling.toFixed(2)}`);

// ---------- exploitability raises S2 on that family's compute ----------
const sx = game();
const before = { broad: s2(sx), swe: s2(sx, { rlFocus: ['swe'] }), math: s2(sx, { rlFocus: ['math'] }) };
sx.player.suites.swe!.exploit = EXPLOIT_CHEAP.swe;
const after = { broad: s2(sx), swe: s2(sx, { rlFocus: ['swe'] }), math: s2(sx, { rlFocus: ['math'] }) };
check(after.broad > before.broad && after.swe - before.swe > after.math - before.math && after.math - before.math > 0,
  'exploitability: a more hackable SWE suite raises S2, most when the RL compute goes to SWE',
  `broad ${before.broad.toFixed(3)} → ${after.broad.toFixed(3)}, SWE focus ${before.swe.toFixed(3)} → ${after.swe.toFixed(3)}, math focus ${before.math.toFixed(3)} → ${after.math.toFixed(3)}`);

// ---------- hardening: team-weeks and cash, diminishing returns ----------
const sh = game();
const cost = suiteWorkCost(sh, 'swe', 'harden');
const cash0 = sh.player.finance.cash;
const x0 = sh.player.suites.swe!.exploit;
const e1 = act(sh, 'suite.harden', { family: 'swe' });
const item = sh.player.build.queue.find((it) => it.kind === 'suite');
check(!e1 && !!item && near(item.needTW, SUITE_HARDEN.tw, 1e-9) && near(cash0 - sh.player.finance.cash, cost.cashB, 1e-9) && sh.player.suites.swe!.exploit === x0,
  'hardening: queues engineers\' team-weeks and pays cash for red-teamers; nothing changes until it is built', `${cost.tw} team-weeks, $${(cost.cashB * 1000).toFixed(0)}M ${e1 ?? ''}`);
check(act(sh, 'suite.harden', { family: 'swe' }) !== undefined, 'hardening: one pass per suite at a time');
runTo(sh, sh.time.day + 60);
const x1 = sh.player.suites.swe!.exploit;
check(!sh.player.build.queue.some((it) => it.kind === 'suite') && x1 < x0 && sh.player.suites.swe!.hardenings === 1, 'hardening: once built, exploitability falls',
  `${(x0 * 100).toFixed(2)}% → ${(x1 * 100).toFixed(2)}%`);
act(sh, 'suite.harden', { family: 'swe' });
runTo(sh, sh.time.day + 60);
const x2 = sh.player.suites.swe!.exploit;
check(x2 < x1 && x0 - x1 > x1 - x2 && x2 > SUITE_HARDEN.floorFrac * EXPLOIT_START.swe, 'hardening: diminishing returns (each pass removes less, never below the floor)',
  `Δ ${((x0 - x1) * 100).toFixed(2)} then ${((x1 - x2) * 100).toFixed(2)} pp; floor ${(SUITE_HARDEN.floorFrac * EXPLOIT_START.swe * 100).toFixed(2)}%`);
check(sh.player.suites.math!.exploit === EXPLOIT_START.math, 'hardening one suite leaves the others');

// ---------- building: expert data and fidelity ----------
const sb = game();
const bc = suiteWorkCost(sb, 'math', 'build');
const cashB0 = sb.player.finance.cash;
check(!act(sb, 'suite.build', { family: 'math' }) && near(cashB0 - sb.player.finance.cash, bc.cashB, 1e-9) && bc.tw > 0,
  'building: pays cash for expert data and queues team-weeks', `$${(bc.cashB * 1000).toFixed(0)}M for ${bc.tokensT}T, ${bc.tw} team-weeks`);
runTo(sb, sb.time.day + 60);
const fid1 = suiteFidelity(sb, 'math');
check(near(expert(sb, 'math')!.tokensT, EXPERT_START_T + SUITE_BUILD.tokensT, 1e-15) && fid1 > 1 && suiteFidelity(sb, 'swe') === 1,
  'building: the expert data joins the family\'s expert asset and its fidelity rises (that suite only)', `math fidelity 1 → ${fid1.toFixed(3)}`);
check(fidelityOf(3 * EXPERT_START_T) - fidelityOf(2 * EXPERT_START_T) < fid1 - 1 && fidelityOf(1e6) <= 1.5, 'building: fidelity has diminishing returns in expert data and a ceiling');
const rlMath = planRun(sb, { kind: 'post', baseId: 'B0', post: post({ rlFocus: ['math'] }) }).g.rl!;
const rlMath0 = planRun(game(), { kind: 'post', baseId: 'B0', post: post({ rlFocus: ['math'] }) }).g.rl!;
check(rlMath.perDomain.REASON > rlMath0.perDomain.REASON, 'building: a post-train reads the better math suite (REASON gain up)', `${rlMath0.perDomain.REASON.toFixed(3)} → ${rlMath.perDomain.REASON.toFixed(3)} OOM`);

// ---------- upkeep ----------
const up = upkeepLines(s0).filter((l) => l.kind === 'suite');
check(up.length === START_FAMS.length && near(up.reduce((a, l) => a + l.tw, 0), 0.18, 1e-9), 'upkeep: every suite keeps engineers busy (6 × 0.03 team-weeks a week at the start)');

// ---------- a family with no suite cannot be focused ----------
const pc = planRun(s0, { kind: 'post', baseId: 'B0', post: post({ rlFocus: ['computerUse'] }) });
check(!!pc.reason && /environment/i.test(pc.reason), 'a family with no suite cannot be focused (computer use before P06)', pc.reason ?? '');
check(act(s0, 'suite.harden', { family: 'computerUse' }) !== undefined, 'no suite, no work on it');
check(act(s0, 'suite.build', { family: 'computerUse' }) !== undefined, 'no suite can be built before its idea (computer use needs P06)');

// ---------- RD-B03: a family unlocked later has no suite until the lab builds its first one ----------
{
  const known = (s: GameStateV2) => {
    s.player.tree.P06 = { ...(s.player.tree.P06 ?? {}), status: 'known', progress: 1 } as never;
    return s;
  };
  const su = known(game());
  const upCU = (s: GameStateV2) => upkeepLines(s).some((l) => l.kind === 'suite' && l.ref === 'computerUse');
  const focusCU = (s: GameStateV2) => planRun(s, { kind: 'post', baseId: 'B0', post: post({ rlFocus: ['computerUse'] }) }).reason;
  const wCU = (s: GameStateV2) => playerRlWeights(s, 'broad').computerUse ?? 0;
  check(!suiteOf(su, 'computerUse') && unbuiltSuiteFamilies(su).join(',') === 'computerUse' && suiteFamilies(su).join(',') === START_FAMS.join(',')
    && suiteFidelity(su, 'computerUse') === 0 && wCU(su) === 0 && !upCU(su) && !!focusCU(su) && act(su, 'suite.harden', { family: 'computerUse' }) !== undefined
    && planRun(su, { kind: 'post', baseId: 'B0', post: post() }).g.rl!.general === plan0.general,
    'RD-B03: with P06 known, computer use has no suite (fidelity 0): not in broad RL, cannot be a focus or hardened, no upkeep, a broad post-train unchanged',
    `focus: ${focusCU(su) ?? 'allowed'}`);
  const pv = unbuiltSuites(su, { kind: 'post', baseId: 'B0', post: post() });
  const done = deserialize(serialize(su));
  completeSuiteWork(done, makeCtx(done), 'computerUse:build');
  const rlDone = planRun(done, { kind: 'post', baseId: 'B0', post: post() }).g.rl!;
  check(near(pv[0].build.after.rl!.general, rlDone.general, 1e-12) && rlDone.general !== plan0.general,
    'RD-B03: the first build\'s preview equals the planned run with the suite built today', `${plan0.general.toFixed(4)} → ${rlDone.general.toFixed(4)} OOM`);
  const cash0 = su.player.finance.cash;
  const bc = suiteWorkCost(su, 'computerUse', 'build');
  const e = act(su, 'suite.build', { family: 'computerUse' });
  check(!e && pv.length === 1 && !pv[0].build.block && pv[0].build.effect.fid[0] === 0 && near(pv[0].build.effect.fid[1], 1, 1e-12)
    && near(cash0 - su.player.finance.cash, bc.cashB, 1e-9) && su.player.build.queue.some((it) => it.kind === 'suite' && it.ref === 'computerUse:build')
    && !suiteOf(su, 'computerUse') && wCU(su) === 0 && !upCU(su),
    'RD-B03: "Build suite" on computer use is paid when queued (fidelity none → 1.00); until it is built there is still no suite',
    `${e ?? ''} $${(bc.cashB * 1000).toFixed(0)}M, ${bc.tw} team-weeks; preview RL ΔG ${pv[0].build.before.rl?.general.toFixed(3)} → ${pv[0].build.after.rl?.general.toFixed(3)} OOM`);
  runTo(su, su.time.day + 60);
  const x = suiteOf(su, 'computerUse');
  const rl1 = planRun(su, { kind: 'post', baseId: 'B0', post: post() }).g.rl!;
  check(!!x && x.builds === 1 && x.exploit === EXPLOIT_START.computerUse && near(expert(su, 'computerUse')?.tokensT ?? 0, SUITE_BUILD.tokensT, 1e-15)
    && near(suiteFidelity(su, 'computerUse'), 1, 1e-12) && near(wCU(su), 1 / (START_FAMS.length + 1), 1e-12) && upCU(su) && !focusCU(su)
    && (rl1.perFamily.computerUse ?? 0) > 0 && (pv[0].build.after.rl!.perFamily.computerUse ?? 0) > 0 && !pv[0].build.before.rl!.perFamily.computerUse,
    'RD-B03: once built, computer use has a fidelity-1 suite (start exploitability): in broad RL, a focus, on upkeep (as the build preview showed)',
    `broad share ${(wCU(su) * 100).toFixed(1)}%, RL ΔG ${plan0.general.toFixed(3)} → ${rl1.general.toFixed(3)} OOM`);
  // RefBot builds it as soon as the idea is known, once.
  const sr = known(game());
  refPlay(sr, engine);
  refPlay(sr, engine);
  check(sr.player.build.queue.filter((it) => it.kind === 'suite' && it.ref === 'computerUse:build').length === 1,
    'RD-B03: RefBot queues the first computer-use suite build when P06 is known (once)');
  // Migration 44 → 45: a save from before the fix (P06 known, no stored suite: it read as a free start suite) keeps it.
  const old = JSON.parse(serialize(known(game()))) as GameStateV2;
  old.schemaRev = 44;
  const ld = deserialize(JSON.stringify(old));
  check(!!ld.player.suites.computerUse && near(suiteFidelity(ld, 'computerUse'), 1, 1e-12) && wCU(ld) > 0,
    'RD-B03: a rev-44 save that knows P06 keeps its computer-use suite (stored at fidelity 1)');
}

// ---------- a run freezes its suites at launch ----------
const sr = game();
sr.player.finance.cash = 1e3;
act(sr, 'launchPost', { baseId: 'B0', poolShare: 0.5 });
const run = sr.player.models.runs[sr.player.models.runs.length - 1];
const frozen = postSignals(sr, run.post!, run.recipe?.exploit).S2;
sr.player.suites.swe!.exploit = EXPLOIT_CHEAP.swe;
check(!!run.recipe?.fid && !!run.recipe?.exploit && near(postSignals(sr, run.post!, run.recipe.exploit).S2, frozen, 1e-12) && postSignals(sr, run.post!).S2 > frozen,
  'a post-training run freezes its suites\' fidelity and exploitability at launch', `S2 frozen ${frozen.toFixed(3)} vs today ${postSignals(sr, run.post!).S2.toFixed(3)}`);

// ---------- model v3 D9: P12 long-horizon human demos as expert data in the long-tasks suite ----------
{
  const C9: Candidate = { k: 1, gen: 1, nov: 0.5, b: 1, q: 1, mu: 1, sd: 0.2, muS: 0, sdS: 0 };
  const a = game();
  const b = game();
  b.hidden.paradigmSuccess.P12 = true;
  const x = candidateTruth(b, TREE_BY_ID.P12, freshCap(), C9).x;
  b.player.tree.P12 = { status: 'researching', progress: 0, attempts: 1, cap: { ...freshCap(), stage: 'adopting', result: { c: C9, xTest: x, sHat: 0, fTest: 1e24, est: 1, estSd: 0.1, buildId: 'd9', day: 0 } } } as never;
  const cash0 = b.player.finance.cash;
  completeAdoption(b, makeCtx(b), 'P12', 'd9');
  const tok = x * P12_DEMO_T;
  const paid = cash0 - b.player.finance.cash;
  check(x > 0 && b.player.tree.P12?.status === 'known' && near(expert(b, 'longHorizon')!.tokensT, EXPERT_START_T + tok, 1e-15) && near(paid, tok * EXPERT_PRICE_B_PER_T, 1e-9)
    && near(P12_DEMO_T * EXPERT_PRICE_B_PER_T, 1, 1e-12) && near(fidelityOf(EXPERT_START_T + P12_DEMO_T), 1.5 - 0.5 * Math.sqrt(1 / 11), 1e-12)
    && START_FAMS.every((f) => f === 'longHorizon' || suiteFidelity(b, f) === 1),
    'P12: adoption delivers x × 20B tokens of demonstrations into the long-tasks suite, paid at the expert-data price ($1B as designed); fidelity 1 → 1.35 as designed',
    `x ${x.toFixed(3)}: ${(tok * 1000).toFixed(1)}B tokens, $${paid.toFixed(2)}B, fidelity ${suiteFidelity(b, 'longHorizon').toFixed(3)}`);
  // Through the mechanism: the suite's higher fidelity raises the long-tasks family's RL ceiling, so AGENCY and the
  // time horizon (h50 ∝ 4.2^ΔG_AGENCY) rise for a post-train after adoption; no flat horizon multiplier.
  const rows: string[] = [];
  let ok = true;
  for (const focus of ['broad', ['longHorizon']] as PostDesign['rlFocus'][]) {
    const pa = planRun(a, { kind: 'post', baseId: 'B0', post: post({ rlFocus: focus }) });
    const pb = planRun(b, { kind: 'post', baseId: 'B0', post: post({ rlFocus: focus }) });
    const dA = (pb.g.gD?.AGENCY ?? 0) - (pa.g.gD?.AGENCY ?? 0);
    const ceilA = pa.g.rl!.perFamily.longHorizon ?? 0;
    const ceilB = pb.g.rl!.perFamily.longHorizon ?? 0;
    if (!(dA > 0) || !(ceilB > ceilA)) ok = false;
    rows.push(`${focus === 'broad' ? 'broad' : 'long-tasks focus'}: long-tasks gain ${ceilA.toFixed(3)} → ${ceilB.toFixed(3)}, AGENCY +${dA.toFixed(3)} OOM (horizon ×${Math.pow(H50_PER_OOM, dA).toFixed(2)})`);
  }
  check(ok, 'P12: the demos raise the long-tasks RL gain and AGENCY (and so the horizon) through the suite, not a flat multiplier', rows.join('; '));
  // Old flags: no P12 horizon constant and no paradigm level offsets.
  const runsSrc = readFileSync(join(HERE, '..', '..', 'src', 'engine', 'v2', 'models', 'runs.ts'), 'utf8');
  check(!/P12_HORIZON|adopted\(s, 'P12'\)|paradigmOff/.test(runsSrc), 'P12: the old "time horizon ×2, RSCH +0.4" flags are gone (no P12_HORIZON, no paradigm level offsets)');
}

// ---------- saves (RD-C03: saves below schemaRev 33 no longer load, so the 22 → 23 graders migration is gone) ----------
const day400 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
check(suiteFamilies(day400).length >= START_FAMS.length && START_FAMS.every((f) => !!expert(day400, f)) && near(suiteExploitMap(day400).swe ?? 0, EXPLOIT_START.swe, 1e-12),
  'save: the day-400 fixture has its start suites and their expert data (start exploitability)', suiteFamilies(day400).join(', '));

finish('suites');
