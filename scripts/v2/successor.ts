// Model v3 E4 successor pull (design/MODEL-V3.md §11.2; src/engine/v2/safety/traits.ts). Owner: WS2.
//   When AI does a share r of the R&D that trains the next model (V3 work types SWE, EXP, IDEAS), the new model's
//   dispositions (the B-layer traits and PERSONA) are pulled toward the models doing that work, each weighted by its
//   share: ω_k = κ_succ(SUCC_k) · r_k · (1 − oversight_k), κ_succ = 0.4 + 0.6·SUCC (research/04 T23: a hijacking
//   successor-trainer passes its traits on in full), oversight = E5's internal terms (containment, monitors on SUCC,
//   human review of the human share). Checks: AI share, oversight and SUCC move the pull the right way; no AI share, no
//   pull; the pull touches dispositions only, never capability; the reference fixtures' numbers.
import { setControl } from '../../src/engine/v2/safety/safeguards';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REFERENCE_POST } from '../../src/data/v2/runDesign';
import { TRAIT_IDS } from '../../src/data/v2/traits';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { deserialize } from '../../src/engine/v2/core/save';
import { resetWorkContext } from '../../src/engine/v2/departments/workfit';
import { aiRdShare } from '../../src/engine/v2/safety/incidents';
import {
  applyRunToTraits, applySuccessorPull, K_SUCC_0, kappaSucc, misalignment, SUCCESSOR_TRAITS, successorOversight, successorPull,
} from '../../src/engine/v2/safety/traits';
import type { GameStateV2, ModelVersion, PostDesign, TraitId, TraitVector, TrainingRun } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish } from './lib';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const game = () => newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, tutorial: false }));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const misTraits = (): Partial<TraitVector> => ({ PERSONA: 0.8, CONCEAL: 0.6, POWER: 0.6, AF: 0.6, SAND: 0.5, SCHEME: 0.6, COLLUDE: 0.5, SUCC: 0.3 });

/** A game whose R&D agents (engineering, routine and frontier research) run VF: a copy of V0 with misaligned
 *  dispositions (capability identical), so the pull has somewhere to go. */
function withFleet(o: Partial<TraitVector> = misTraits(), mut?: (s: GameStateV2) => void): GameStateV2 {
  const s = game();
  const vf: ModelVersion = clone(s.player.models.versions[0]);
  vf.id = 'VF';
  Object.assign(vf.traitsTrue, o);
  s.player.models.versions.push(vf);
  s.player.agents.capRoutine.versionId = 'VF';
  s.player.agents.eng.versionId = 'VF';
  s.player.agents.capFrontier.versionId = 'VF';
  for (const d of s.player.deployments) if (d.channel === 'internal') d.versionId = 'VF';
  mut?.(s);
  resetWorkContext(s);
  return s;
}
/** Scale the capabilities agent pool: at the start the agents are coverage-bound, so only a scarce pool lowers r. */
const agentsTimes = (k: number) => (s: GameStateV2) => { s.player.split.routine *= k; s.player.split.frontier *= k; };
const fmtPull = (s: GameStateV2) => { const p = successorPull(s); return `r ${p.r.toFixed(3)}, ω ${p.omega.toFixed(3)}`; };

// ---------- the rule: Σ shares = aiRdShare; ω_k = κ(SUCC_k)·share_k·(1 − oversight_k) ----------
{
  const s = withFleet();
  const p = successorPull(s);
  const sum = p.parts.reduce((a, x) => a + x.share, 0);
  const vf = s.player.models.versions.find((v) => v.id === 'VF')!;
  check(near(sum, aiRdShare(s), 1e-9) && near(p.r, aiRdShare(s), 1e-12), 'the work types\' AI shares (SWE, EXP, IDEAS) sum to E5\'s AI share of R&D', `Σ ${sum.toFixed(4)} = r ${p.r.toFixed(4)}`);
  check(p.parts.every((x) => near(x.omega, kappaSucc(vf.traitsTrue.SUCC) * x.share * (1 - successorOversight(s, vf)), 1e-12)) && near(p.omega, p.parts.reduce((a, x) => a + x.omega, 0), 1e-12),
    'ω_k = κ_succ(SUCC) × AI share_k × (1 − oversight_k), ω = Σ ω_k', p.parts.map((x) => `${x.slot} ${x.share.toFixed(3)} → ${x.omega.toFixed(4)}`).join(', '));
}

// ---------- higher AI share raises the pull ----------
{
  const lo = withFleet(undefined, agentsTimes(0.001));
  const mid = withFleet(undefined, agentsTimes(0.01));
  const hi = withFleet();
  const [pl, pm, ph] = [lo, mid, hi].map((s) => successorPull(s));
  check(pl.r < pm.r && pm.r < ph.r && pl.omega < pm.omega && pm.omega < ph.omega,
    'a higher AI share of the lab\'s R&D raises the pull (agent compute ×0.001, ×0.01, ×1 at the start)', `${fmtPull(lo)} < ${fmtPull(mid)} < ${fmtPull(hi)}`);
}

// ---------- zero AI share: no pull ----------
{
  // RD-A02: engineering agents have their own split line (they no longer draw on routine / frontier), so "no agent
  // compute" zeroes it too.
  const s = withFleet(undefined, (x) => { x.player.split.routine = 0; x.player.split.frontier = 0; x.player.split.engineering = 0; });
  const p = successorPull(s);
  const x0 = clone(game().player.models.versions[0].traitsTrue);
  const x1 = applySuccessorPull(s, x0);
  check(p.r === 0 && p.omega === 0 && TRAIT_IDS.every((t) => x1[t] === x0[t]), 'no AI share of R&D (no agent compute): no pull, the new model starts from its own prior', fmtPull(s));
}

// ---------- stronger oversight lowers the pull ----------
{
  const off = withFleet();
  const on = withFleet(undefined, (s) => { for (const d of s.player.deployments) if (d.channel === 'internal') setControl(d, true); for (const a of Object.values(s.player.agents)) a.control = true; });
  const vOff = off.player.models.versions.find((v) => v.id === 'VF')!;
  const vOn = on.player.models.versions.find((v) => v.id === 'VF')!;
  const oOff = successorOversight(off, vOff);
  const oOn = successorOversight(on, vOn);
  check(oOn > oOff && successorPull(on).omega < successorPull(off).omega,
    'stronger oversight (the AG07 control layer on the internal fleet) lowers the pull', `oversight ${oOff.toFixed(3)} → ${oOn.toFixed(3)}, ${fmtPull(off)} → ${fmtPull(on)}`);
  // Human review covers the human share (1 − r): a scarce agent pool (lower r) leaves more of the work reviewed.
  const hi = withFleet(undefined, agentsTimes(0.001));
  const oHi = successorOversight(hi, hi.player.models.versions.find((v) => v.id === 'VF')!);
  check(oHi > oOff, 'human review covers only the work humans still do: less AI share, more oversight', `oversight at r ${successorPull(hi).r.toFixed(2)} ${oHi.toFixed(3)}, at r ${successorPull(off).r.toFixed(2)} ${oOff.toFixed(3)}`);
}

// ---------- SUCC raises the pull ----------
{
  const lo = withFleet({ ...misTraits(), SUCC: 0 });
  const hi = withFleet({ ...misTraits(), SUCC: 0.9 });
  const x0 = clone(game().player.models.versions[0].traitsTrue);
  const xl = applySuccessorPull(lo, x0);
  const xh = applySuccessorPull(hi, x0);
  check(successorPull(hi).omega > successorPull(lo).omega && xh.SCHEME > xl.SCHEME && kappaSucc(0) === K_SUCC_0 && kappaSucc(1) === 1,
    'a fleet that wants its successor aligned to itself (SUCC) pulls harder (κ 0.4 at SUCC 0 → 1 at SUCC 1, research/04 T23)',
    `ω ${successorPull(lo).omega.toFixed(3)} → ${successorPull(hi).omega.toFixed(3)}; new SCHEME ${xl.SCHEME.toFixed(3)} → ${xh.SCHEME.toFixed(3)} (prior ${x0.SCHEME.toFixed(3)})`);
}

// ---------- weighted by each model's share of the work ----------
{
  // Engineering on V0 (its own traits), routine and frontier research on VF: only those parts pull toward VF.
  const s = withFleet(undefined, (x) => { x.player.agents.eng.versionId = 'V0'; });
  const p = successorPull(s);
  const v0 = s.player.models.versions[0];
  const vf = s.player.models.versions.find((v) => v.id === 'VF')!;
  const x0 = clone(v0.traitsTrue);
  x0.SCHEME = 0.05;
  const x1 = applySuccessorPull(s, x0, p);
  const want = x0.SCHEME + p.parts.reduce((a, q) => a + q.omega * ((q.versionId === 'VF' ? vf : v0).traitsTrue.SCHEME - x0.SCHEME), 0);
  check(p.parts.some((q) => q.slot === 'SWE' && q.versionId === 'V0') && p.parts.some((q) => q.versionId === 'VF') && near(x1.SCHEME, want, 1e-12),
    'each model doing R&D pulls with its own share of the work (engineering on V0, research on VF)', p.parts.map((q) => `${q.slot}:${q.versionId} ω ${q.omega.toFixed(4)}`).join(', '));
}

// ---------- AF2: across initialisations the unintended part passes only what the work shows (Cloud 2025) ----------
{
  const s = withFleet();
  const p = successorPull(s);
  const x0 = clone(game().player.models.versions[0].traitsTrue);
  const vf = s.player.models.versions.find((v) => v.id === 'VF')!;
  const b0 = s.player.models.bases[0];
  const full = applySuccessorPull(s, x0, p, b0); // VF is on B0: shared initialisation
  const fresh = applySuccessorPull(s, x0, p, 'new'); // a new base or a distilled student
  const un = p.parts.reduce((a, q) => a + K_SUCC_0 * q.share * (1 - q.oversight), 0);
  const want = (t: TraitId, vis: number) => x0[t] + (p.omega - un * (1 - vis)) * (vf.traitsTrue[t] - x0[t]);
  const steered = { ...p, parts: p.parts.map((q) => ({ ...q, kappa: 1, omega: q.share, steered: true })) };
  const stFresh = applySuccessorPull(s, x0, steered, 'new');
  const stFull = applySuccessorPull(s, x0, steered, b0);
  check(near(full.AF, applySuccessorPull(s, x0, p).AF, 1e-12) && near(fresh.AF, want('AF', 0.1), 1e-12) && near(fresh.PERSONA, full.PERSONA, 1e-12) && fresh.AF < full.AF && near(stFresh.AF, stFull.AF, 1e-12),
    'into a new initialisation the unintended pull passes visible dispositions in full and hidden ones (AF, SCHEME, SAND) at OC_VIS; within the base family, and a steered successor, in full (Cloud et al. 2025; E7)',
    `AF prior ${x0.AF.toFixed(3)}: same base ${full.AF.toFixed(4)}, new base ${fresh.AF.toFixed(4)}; PERSONA ${full.PERSONA.toFixed(3)} both; steered ${stFresh.AF.toFixed(4)} both`);
}

// ---------- dispositions only, never capability ----------
{
  const x0 = clone(game().player.models.versions[0].traitsTrue);
  const s = withFleet({ ...misTraits(), SA: 0.95, EA: 0.95, OBF: 0.9, RH: 0.9, SYC: 0.9, HONEST: 0.05, CORRIG: 0.05 }, undefined);
  const x1 = applySuccessorPull(s, x0);
  const moved = TRAIT_IDS.filter((t) => x1[t] !== x0[t]);
  check(moved.length > 0 && moved.every((t) => SUCCESSOR_TRAITS.includes(t)),
    'the pull acts only on dispositions (B-layer and PERSONA): awareness, learned behaviours and the protective traits keep the prior',
    `moved: ${moved.join(' ')}`);
  // A full post-training run: same capability with a clean or a misaligned fleet, different dispositions.
  const post: PostDesign = { ...REFERENCE_POST, methods: [] };
  const train = (fleet: Partial<TraitVector>) => {
    const g = withFleet(fleet, undefined);
    const v0 = g.player.models.versions[0];
    const nv: ModelVersion = clone(v0);
    nv.id = 'VN';
    nv.parentVersionId = 'V0';
    g.player.models.bases[0].uModes = [];
    v0.uModes = [];
    const run = { id: 'RP', kind: 'post', name: 'post', startDay: 0, flopNeeded: 1, flopDone: 1, poolShare: 0.1, cashCost: 0, status: 'done', baseId: 'B0', post } as unknown as TrainingRun;
    const cap = JSON.stringify({ G: nv.G, domains: nv.domains, build: nv.build, params: nv.params });
    applyRunToTraits(g, makeCtx(g), run, nv);
    return { nv, capSame: cap === JSON.stringify({ G: nv.G, domains: nv.domains, build: nv.build, params: nv.params }) };
  };
  const clean = train(Object.fromEntries(SUCCESSOR_TRAITS.map((t) => [t, x0[t]])) as Partial<TraitVector>);
  const bad = train(misTraits());
  const dispDiff = (SUCCESSOR_TRAITS as TraitId[]).filter((t) => bad.nv.traitsTrue[t] > clean.nv.traitsTrue[t] + 1e-6);
  check(clean.capSame && bad.capSame && JSON.stringify(clean.nv.domains) === JSON.stringify(bad.nv.domains) && clean.nv.G === bad.nv.G && dispDiff.length >= 6,
    'a post-training run on a misaligned fleet: identical capability (G, domains, build), more misaligned dispositions',
    `Mis ${misalignment(clean.nv.traitsTrue).toFixed(3)} → ${misalignment(bad.nv.traitsTrue).toFixed(3)}; higher: ${dispDiff.join(' ')}`);
}

// ---------- reference numbers (start, ai2027 RefBot fixtures day 400 and 900) ----------
{
  const s0 = game();
  const p0 = successorPull(s0);
  const f = (n: string) => deserialize(readFileSync(join(FIXTURE_DIR, n), 'utf8'));
  const p4 = successorPull(f('day400.json'));
  const p9 = successorPull(f('day900.json'));
  const ov = (p: ReturnType<typeof successorPull>) => (p.parts[0]?.oversight ?? 0).toFixed(2);
  // Start ω 0.070 ± 0.015 (M9 re-baseline, lead decision; was 0.049 ± 0.01): F4's ai2027 refit raised sd_SC (AI
  // research taste at SC) 0.5 → 1.25, and sdAIOf is anchored at sd_SC, so the start model's AI taste is 0.75 SD higher
  // and its share of the lab's R&D (r 0.30 at the start) counts for more. Same relative tolerance (≈ 20%) as before.
  check(near(p0.omega, 0.070, 0.015) && p4.omega > p0.omega && p9.omega > p4.omega && p9.omega < 1,
    'reference: the pull grows with the lab\'s automation (start ≈ 0.07; RefBot fixtures day 400 and 900)',
    `start r ${p0.r.toFixed(2)} oversight ${ov(p0)} ω ${p0.omega.toFixed(3)}; day 400 r ${p4.r.toFixed(2)} oversight ${ov(p4)} ω ${p4.omega.toFixed(3)}; day 900 r ${p9.r.toFixed(3)} oversight ${ov(p9)} ω ${p9.omega.toFixed(3)}`);
}

finish('successor');
