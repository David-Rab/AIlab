// Model v3 D5 environment suites (design/MODEL-V3.md §4.3, §11.2; src/engine/v2/models/suites.ts). Owner: WS1.
//   One suite per RL family: fidelity scales that family's RL ceiling A_f, exploitability feeds S2 for the RL compute
//   spent on the family. The start suites reproduce V1's reference RL gain and S2 (leader = the old hardened graders,
//   the spinout = cheap); higher fidelity raises that family's gain (others only via transfer); higher exploitability
//   raises S2; building and hardening cost team-weeks and cash (hardening with diminishing returns); a family with no
//   suite cannot be focused; a run freezes its suites at launch; saves at schemaRev 22 migrate (graders → suites; 22 → 23 after M2).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RL_BUDGET, REFERENCE_POST, RL_REF_GAIN } from '../../src/data/v2/runDesign';
import { EXPERT_START_T, EXPLOIT_CHEAP, EXPLOIT_START, SUITE_BUILD, SUITE_HARDEN } from '../../src/data/v2/suites';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { act } from '../../src/engine/v2/core/loop';
import { deserialize, migrations } from '../../src/engine/v2/core/save';
import { upkeepLines } from '../../src/engine/v2/departments/build';
import { rlFamiliesAvailable, rlGains, rlWeights } from '../../src/engine/v2/models/effective';
import { planRun } from '../../src/engine/v2/models/runs';
import {
  S2_PER_EXPLOIT, expertAssetId, fidelityOf, suiteExploitMap, suiteFamilies, suiteFidMap, suiteFidelity, suiteOf, suiteWorkCost,
} from '../../src/engine/v2/models/suites';
import { postSignals } from '../../src/engine/v2/safety/traits';
import type { GameStateV2, OwnedDataAsset, PostDesign, RLFamily } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish, runTo } from './lib';

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
check(near(s2(s0, { rlBudget: 'light' }), 0.18, 1e-9) && near(s2(s0, { rlBudget: 'heavy' }), 0.468, 1e-9), 'the RL budget\'s optimisation pressure is kept (light ×0.5, heavy ×1.3)',
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

// ---------- a run freezes its suites at launch ----------
const sr = game();
sr.player.finance.cash = 1e3;
act(sr, 'launchPost', { baseId: 'B0', poolShare: 0.5 });
const run = sr.player.models.runs[sr.player.models.runs.length - 1];
const frozen = postSignals(sr, run.post!, run.recipe?.exploit).S2;
sr.player.suites.swe!.exploit = EXPLOIT_CHEAP.swe;
check(!!run.recipe?.fid && !!run.recipe?.exploit && near(postSignals(sr, run.post!, run.recipe.exploit).S2, frozen, 1e-12) && postSignals(sr, run.post!).S2 > frozen,
  'a post-training run freezes its suites\' fidelity and exploitability at launch', `S2 frozen ${frozen.toFixed(3)} vs today ${postSignals(sr, run.post!).S2.toFixed(3)}`);

// ---------- save migration 22 → 23 (D5; built as 21 → 22, renumbered in M2) ----------
const day400 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
check(suiteFamilies(day400).length >= START_FAMS.length && START_FAMS.every((f) => !!expert(day400, f)) && near(suiteExploitMap(day400).swe ?? 0, EXPLOIT_START.swe, 1e-12),
  'migration: an old save gets start suites and their expert data (hardened graders → start exploitability)', suiteFamilies(day400).join(', '));
const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8')) as Record<string, unknown>;
if (Number(raw.schemaRev) <= 22) {
  const st = raw as unknown as GameStateV2;
  for (let r = Number(raw.schemaRev); r < 22; r++) migrations[r](raw);
  delete (st.player as Partial<GameStateV2['player']>).suites;
  for (const v of st.player.models.versions) v.design.graders = 'cheap';
  for (const r of st.player.models.runs) if (r.post) r.post.graders = 'cheap';
  migrations[22](raw);
  check(near(st.player.suites.swe!.exploit, EXPLOIT_CHEAP.swe, 1e-12), 'migration: a save whose latest post-train used cheap graders gets cheap suites', `${(st.player.suites.swe!.exploit * 100).toFixed(1)}%`);
}

finish('suites');
