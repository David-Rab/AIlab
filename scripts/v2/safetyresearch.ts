// Safety research lines on the project mechanism (model v3 E1; design/notes/E1.md). Owner: WS2.
// Reference inputs reproduce research/14's T₁ pacing; engineers, compute and AI labour speed the stages through the
// capability projects' experiment CES; taste lowers the belief noise; result types still follow the hidden efficacy.
// Model v3 E2 (§5b): AI labour from the SAF_EXP / SAF_IDEAS work types through the capabilities labour function, the
// Trusted-to-AI share, parity with capability work, sabotage ∝ the work AI does (design/notes/E2.md).
import { AGENDA_BY_ID, AGENDA_IDS, SAF_RE_UNIT, SAF_STAGES, SERIOUS_CAP } from '../../src/data/v2/agendas';
import { PROJECT_BY_ID, lineNodeId } from '../../src/data/v2/tree';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { deserialize, serialize } from '../../src/engine/v2/core/save';
import { fireFinding } from '../../src/engine/v2/safety/findings';
import { trueEfficacy } from '../../src/engine/v2/safety/common';
import {
  freshSaf, resetSafAllocation, lineCycleDays, lineEtaDays, lineLabour, lineLabourMult, linePoolH100e, lineRates, newSafCandidate, safAllocation, safSciOn, stepLineProject,
} from '../../src/engine/v2/safety/lineProjects';
import { safetyRe } from '../../src/engine/v2/safety/agendas';
import { safetyAgentVersion, safetyFleet } from '../../src/engine/v2/safety/agents';
import { WORK_TYPES } from '../../src/data/v2/workTypes';
import { labourOf, resetWorkContext, safetyLabour, workContext } from '../../src/engine/v2/departments/workfit';
import type { AgendaId, FindingType, GameStateV2, ModelVersion, Team } from '../../src/engine/v2/types';
import { check, finish } from './lib';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/** A leader-start lab with one research line staffed: science capacity `cap` (× SERIOUS_CAP) on the line's follow-up
 *  project, `re` research-engineer units on experiments, the line pool at `c` × the agenda's reference compute share of
 *  the leader's day-0 compute. Nothing else runs (no tick): only the line project's stages. */
function lab(ag: AgendaId, o: { seed?: number; cap?: number; re?: number; c?: number; quality?: Team['quality'] } = {}): { s: GameStateV2; id: string } {
  const s = newGame(defaultSetupV2({ seed: o.seed ?? 11, world: 'ai2027', alignment: 'medium', tutorial: false }));
  const p = s.player;
  const id = lineNodeId(ag);
  const sci = p.teams.find((t) => t.role === 'sci' && t.dept === 'saf') as Team;
  const re = p.teams.find((t) => t.role === 're' && t.dept === 'saf') as Team;
  for (const t of p.teams) if (t.dept === 'saf' && t.role === 'sci' && t !== sci) delete t.projectId;
  sci.quality = o.quality ?? 'strong';
  delete sci.specialty;
  // Capacity = heads/40 × quality (no specialty bonus): SERIOUS_CAP × cap at a Strong team.
  sci.heads = 40 * SERIOUS_CAP * (o.cap ?? 1);
  sci.projectId = id;
  sci.manual = true;
  re.quality = 'strong';
  re.heads = SAF_RE_UNIT * (o.re ?? 1) * 2; // twice the ask (pre-RD-A04: the ask at SAF_EXP_SHARE 0.5); the rest re-validates or idles
  p.research.queue = [id];
  p.split.safetyAgents = 0;
  p.computeOnline = 1e6;
  // Line pool = c × computeRef × 1e6 H100e (fixed point: the monitors' share does not depend on the safety split).
  const want = (o.c ?? 1) * AGENDA_BY_ID[ag].computeRef * 1e6;
  p.split.safety = 0.05;
  for (let i = 0; i < 4; i++) p.split.safety *= want / Math.max(1e-9, linePoolH100e(s));
  return { s, id };
}

/** Give the safety model (the routine-research model the safety package follows) +dg OOM of effective compute in every
 *  domain, so its SAF_* fit and horizon cover the work (E2 stubs). */
function strong(s: GameStateV2, dg = 6) {
  const v = safetyAgentVersion(s) as ModelVersion;
  if (v.build) v.build.dg += dg;
  resetSafAllocation(s);
  return v;
}

/** Run a line project day by day (stages only) and return the days of its first `n` results. */
function results(s: GameStateV2, id: string, n: number, maxDays = 4000, onResult?: () => void): number[] {
  const ts = (s.player.tree[id] ??= { status: 'researching', progress: 0, attempts: 1 });
  ts.saf ??= freshSaf();
  const out: number[] = [];
  for (let d = 1; d <= maxDays && out.length < n; d++) {
    resetSafAllocation(s);
    stepLineProject(s, id, ts, safAllocation(s), () => {
      out.push(d);
      onResult?.();
      return out.length < n;
    });
  }
  return out;
}

// ───────────────────────────── 1. reference inputs reproduce T₁ ─────────────────────────────
{
  const rows: string[] = [];
  let worst = 0;
  for (const ag of AGENDA_IDS) {
    const { s, id } = lab(ag);
    const r = lineRates(s, id, safAllocation(s, id));
    const days = results(s, id, 2);
    const T = 30 * AGENDA_BY_ID[ag].T1;
    worst = Math.max(worst, Math.abs(days[0] / T - 1));
    if (['AG18', 'AG02', 'AG01', 'AG12'].includes(ag)) rows.push(`${ag} T₁ ${AGENDA_BY_ID[ag].T1} mo: first ${days[0]} d, next +${days[1] - days[0]} d (c ${r.c.toFixed(2)}, ℓ ${r.l.toFixed(2)}, X ${r.X.toFixed(2)})`);
  }
  console.log(`      ${rows.join('\n      ')}`);
  check(worst <= 0.02, 'E1 reference inputs (serious staffing, SAF_RE_UNIT engineers, reference compute at day-0 compute): first result after T₁ (±2%), every line', `worst ${(worst * 100).toFixed(1)}%`);
  const { s, id } = lab('AG08');
  const d = results(s, id, 3);
  const steady = (d[2] - d[1]) / (30 * AGENDA_BY_ID.AG08.T1);
  check(Math.abs(steady - (SAF_STAGES.small + SAF_STAGES.val)) < 0.03, 'E1 once the pipeline is full a result follows every (small + validation) × T₁ (scientists ideate while engineers test)', `${steady.toFixed(3)} T₁`);
  const { s: s2, id: id2 } = lab('AG08');
  check(Math.abs(lineEtaDays(s2, id2) - 30 * AGENDA_BY_ID.AG08.T1) < 1 && Math.abs(lineCycleDays(s2, id2) - 30 * 0.8 * AGENDA_BY_ID.AG08.T1) < 1, 'E1 readouts: ETA of a fresh project = T₁, steady cycle = 0.8 T₁ at reference', `${lineEtaDays(s2, id2).toFixed(1)} d, ${lineCycleDays(s2, id2).toFixed(1)} d`);
}

// ───────────────────────────── 2. engineers and compute speed the experiments ─────────────────────────────
{
  const X = (o: { re: number; c: number }) => {
    const { s, id } = lab('AG02', o);
    return lineRates(s, id, safAllocation(s, id)).X;
  };
  const x0 = X({ re: 0.5, c: 1 });
  const gRe = X({ re: 1, c: 1 }) / x0;
  const gC = X({ re: 0.5, c: 2 }) / x0;
  check(gRe > 1.05 && gC > 1.05, 'E1 doubling safety research engineers or line compute speeds the experiments', `×${gRe.toFixed(2)} (engineers), ×${gC.toFixed(2)} (compute)`);
  // Compute-bound (little compute per engineer) vs labour-bound (plenty of compute, few engineers). AIFM's experiment CES
  // is close to Cobb-Douglas (worktypes.ts), so the bound input shows only far from balance.
  const cb0 = X({ re: 0.5, c: 1e-6 });
  const cbC = X({ re: 0.5, c: 2e-6 }) / cb0;
  const cbL = X({ re: 1, c: 1e-6 }) / cb0;
  const lb0 = X({ re: 1e-6, c: 1e6 });
  const lbL = X({ re: 2e-6, c: 1e6 }) / lb0;
  const lbC = X({ re: 1e-6, c: 2e6 }) / lb0;
  check(cbC > 1.3 && cbL < 1.1 && lbL > 1.25 && lbC < 1.1, 'E1 a compute-bound line gains from compute and not from engineers, a labour-bound one the reverse', `compute-bound ×${cbC.toFixed(3)} compute vs ×${cbL.toFixed(3)} engineers; labour-bound ×${lbL.toFixed(3)} engineers vs ×${lbC.toFixed(3)} compute`);
  // In days: twice the engineers and twice the compute bring the first result forward.
  const { s, id } = lab('AG18', { re: 0.5, c: 0.5 });
  const slow = results(s, id, 1)[0];
  const { s: f, id: fid } = lab('AG18', { re: 1, c: 1 });
  const fast = results(f, fid, 1)[0];
  check(fast < slow, 'E1 the first result comes sooner with twice the engineers and compute', `${slow} → ${fast} d`);
  // Engineers on experiments come out of tool upkeep.
  const { s: u, id: uid } = lab('AG18');
  resetSafAllocation(u);
  const before = safetyRe(u);
  results(u, uid, 0, 1);
  const st = u.player.tree[uid].saf;
  if (st && !st.test) st.test = { c: { k: 99, q: 1, mu: 0.5, sd: 0.2 }, work: 0, workNeed: 1 };
  resetSafAllocation(u);
  const after = safetyRe(u);
  check(before.experiments === 0 && Math.abs(after.experiments - SAF_RE_UNIT) < 1e-9 && Math.abs(after.upkeep - (before.upkeep - SAF_RE_UNIT)) < 1e-9, 'E1 a project in experiments takes SAF_RE_UNIT engineers from tool upkeep (none while it ideates)', `upkeep ${before.upkeep} → ${after.upkeep}`);
  // Science capacity speeds ideation as √capacity (λ = 0.5 in ai2027).
  const { s: a, id: aid } = lab('AG07', { cap: 1 });
  const { s: b, id: bid } = lab('AG07', { cap: 4 });
  const ri = lineRates(b, bid, safAllocation(b, bid)).idea / lineRates(a, aid, safAllocation(a, aid)).idea;
  check(Math.abs(ri - Math.pow(4, a.hidden.timeline.prod.lam)) < 1e-6, 'E1 ideation runs at (capacity ÷ SERIOUS_CAP)^λ × taste, as capability projects', `×${ri.toFixed(3)} for 4× capacity`);
}

// ───────────────────────────── 3. taste lowers the belief noise ─────────────────────────────
{
  const err = (quality: Team['quality']) => {
    const e: number[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      const { s, id } = lab('AG02', { seed, quality });
      const st = freshSaf();
      const q = lineRates(s, id, safAllocation(s, id)).q;
      const tru = trueEfficacy(s, 'AG02');
      for (let k = 0; k < 10; k++) e.push(Math.abs(newSafCandidate(s, PROJECT_BY_ID[id], st, q).mu - tru));
    }
    return mean(e);
  };
  const solid = err('solid');
  const strong = err('strong');
  const elite = err('elite');
  check(elite < strong && strong < solid, 'E1 better taste lowers the belief error of a new candidate (Solid > Strong > Elite)', `mean |belief − truth| ${solid.toFixed(3)} / ${strong.toFixed(3)} / ${elite.toFixed(3)}`);
  // Experiments narrow it further.
  const { s, id } = lab('AG02', { seed: 5 });
  const ts = (s.player.tree[id] ??= { status: 'researching', progress: 0, attempts: 1 });
  ts.saf = freshSaf();
  let sd0 = 0;
  let sd1 = 0;
  for (let d = 0; d < 400; d++) {
    resetSafAllocation(s);
    stepLineProject(s, id, ts, safAllocation(s), () => false);
    const t = ts.saf.test;
    if (t && t.work === 0 && ts.saf.stage === 'small' && !sd0) sd0 = t.c.sd;
    if (t && ts.saf.stage === 'validation') { sd1 = t.c.sd; break; }
  }
  check(sd0 > 0 && sd1 > 0 && sd1 < sd0, 'E1 small experiments narrow the belief', `sd ${sd0.toFixed(3)} → ${sd1.toFixed(3)}`);
}

// ───────────────────────────── 4. result types follow the hidden efficacy ─────────────────────────────
{
  // The stages decide when a result comes, never its type: at the same state and day the result is the draw fireFinding
  // makes without the stages (as before E1), so the distribution at reference inputs is unchanged.
  let same = 0;
  const N = 150;
  const byE: { e: number; tech: number; dead: number }[] = [];
  const counts: Partial<Record<FindingType, number>> = {};
  for (let seed = 1; seed <= N; seed++) {
    const { s, id } = lab('AG08', { seed });
    const snap = serialize(s);
    const copy = deserialize(snap);
    const direct = fireFinding(copy, makeCtx(copy), 'AG08', id)?.trueType;
    const staged: (FindingType | undefined)[] = [];
    const ctx = makeCtx(s);
    results(s, id, 5, 4000, () => { staged.push(fireFinding(s, ctx, 'AG08', id)?.trueType); });
    if (staged[0] === direct) same++;
    for (const t of staged) if (t) counts[t] = (counts[t] ?? 0) + 1;
    byE.push({ e: trueEfficacy(s, 'AG08'), tech: staged.filter((t) => t === 'TECH').length, dead: staged.filter((t) => t === 'DEAD').length });
  }
  check(same === N, 'E1 the staged result is the type fireFinding draws at the same state (types unchanged by the stages)', `${same}/${N}; first five results: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  byE.sort((a, b) => a.e - b.e);
  const odds = (xs: typeof byE) => { const t = xs.reduce((a, x) => a + x.tech, 0); const d = xs.reduce((a, x) => a + x.dead, 0); return t / Math.max(1, t + d); };
  const lo = odds(byE.slice(0, N / 3));
  const hi = odds(byE.slice((2 * N) / 3));
  check(hi > lo + 0.2, 'E1 working results outnumber dead ends more on lines with higher hidden efficacy', `working ÷ (working + dead end) ${(lo * 100).toFixed(0)}% (low-e third) vs ${(hi * 100).toFixed(0)}% (high-e third)`);
}

// ───────────────────────────── 5. AI labour enters through the same effective-labour input ─────────────────────────────
{
  const { s, id } = lab('AG08', { re: 0.5, cap: 0.5 });
  const r0 = lineRates(s, id, safAllocation(s, id));
  // Stub (E2): a safety model with high SAF coverage, Trusted to AI 0.5 and a fleet.
  strong(s);
  s.player.policies.trustedToAI = 0.5;
  s.player.split.safetyAgents = 0.3;
  for (let i = 0; i < 4; i++) { resetSafAllocation(s); s.player.split.safety *= (AGENDA_BY_ID.AG08.computeRef * 1e6) / Math.max(1e-9, linePoolH100e(s)); }
  resetSafAllocation(s);
  const m = lineLabourMult(s, 'AG08');
  const r1 = lineRates(s, id, safAllocation(s, id));
  // The same lab without AI but with m × the engineers and m × the science capacity.
  // (Engineers on a project follow its science staffing, so ℓ is compared at m_exp × both and ideation at m_ideas ×
  // capacity: since E2 the two work types have their own multipliers.)
  const { s: h, id: hid } = lab('AG08', { re: 0.5 * m.exp, cap: 0.5 * m.exp });
  const { s: hi, id: hiid } = lab('AG08', { re: 0.5, cap: 0.5 * m.ideas });
  const ri = lineRates(hi, hiid, safAllocation(hi, hiid));
  const rh = { l: lineRates(h, hid, safAllocation(h, hid)).l, idea: ri.idea, q: ri.q };
  check(m.exp > 1 && r1.idea > r0.idea && r1.X > r0.X, 'E1 AI labour (stub: a covering safety model) speeds ideation and experiments', `m ${m.exp.toFixed(2)}: ideation ×${(r1.idea / r0.idea).toFixed(2)}, X ×${(r1.X / r0.X).toFixed(2)}`);
  // Ideation also gets the safety model's AI taste (E2), so compare it with the taste divided out.
  check(Math.abs(r1.l - rh.l) < 1e-9 && Math.abs(r1.idea / r1.q / (rh.idea / rh.q) - 1) < 1e-6, 'E1 AI labour is the same input as human labour (m × engineers in ℓ, m × capacity in ideation)', `ℓ ${r1.l.toFixed(4)} vs ${rh.l.toFixed(4)}`);
}

// ───────────────────────────── 5b. E2: AI labour from the safety work types ─────────────────────────────
/** A lab with the safety agents on: Trusted to AI t, the package at `pkg` of the safety pool, the line pool kept at the
 *  agenda's reference compute. */
function aiLab(ag: AgendaId, o: { t: number; pkg?: number; dg?: number; seed?: number; re?: number; cap?: number }) {
  const { s, id } = lab(ag, { seed: o.seed, re: o.re ?? 0.5, cap: o.cap ?? 0.5 });
  if (o.dg) strong(s, o.dg);
  s.player.policies.trustedToAI = o.t;
  s.player.split.safetyAgents = o.pkg ?? 0.3;
  for (let i = 0; i < 4; i++) { resetSafAllocation(s); s.player.split.safety *= (AGENDA_BY_ID[ag].computeRef * 1e6) / Math.max(1e-9, linePoolH100e(s)); }
  resetSafAllocation(s);
  return { s, id };
}
{
  // Start pacing: the default lab hands nothing to AI (no multiplier, no AI taste); with the start model handed half the
  // work the lines barely move (its SAF coverage is a few per cent).
  const { s, id } = lab('AG08');
  const l0 = lineLabour(s, 'AG08');
  const q0 = safSciOn(s, id).q;
  const d0 = results(s, id, 1)[0];
  const { s: a, id: aid } = aiLab('AG08', { t: 0.5, pkg: 0.2, re: 1, cap: 1 });
  const la = lineLabour(a, 'AG08');
  const sl = safetyLabour(a);
  const da = results(a, aid, 1)[0];
  check(l0.exp === 1 && l0.ideas === 1 && l0.aiShare === 0 && Math.abs(q0 - 1) < 1e-12, "E2 start: Trusted to AI 0 (the default) gives no AI labour and no AI taste, so E1's T₁ pacing is unchanged", `m ${l0.exp}/${l0.ideas}, taste ${q0.toFixed(4)}`);
  // "Adds little" thresholds m_exp < 1.2, m_ideas < 1.05 [D] (M9 re-baseline, lead decision; were 1.1 / 1.01): F4's
  // ai2027 refit raised sd_SC (AI research taste at SC) 0.5 → 1.25 and sdAIOf is anchored at sd_SC, so the start model's
  // AI taste is 0.75 SD higher and its (still few per cent) SAF coverage counts for a little more: m 1.133 / 1.028 on
  // the merged head. The first result still moves by under 4%.
  check(la.exp < 1.2 && la.ideas < 1.05 && Math.abs(da / d0 - 1) < 0.04,'E2 start: the start model handed half the work adds little (SAF coverage a few per cent)', `SAF_EXP a ${(sl.exp.fit.a * 100).toFixed(1)}%, SAF_IDEAS a ${(sl.ideas.fit.a * 100).toFixed(2)}%; m ${la.exp.toFixed(3)} / ${la.ideas.toFixed(4)}; first result ${d0} → ${da} d`);
}
{
  // Coverage and copies drive it; no √M cap. A covering model (fit +6 OOM) fully trusted gets far more than v2's
  // ceiling 1 + t·Auto·min(10, √M) = 11.
  const { s } = aiLab('AG08', { t: 1, dg: 6 });
  const hi = lineLabour(s, 'AG08');
  const { s: s2 } = aiLab('AG08', { t: 1, dg: 6, pkg: 0.6 });
  const hi2 = lineLabour(s2, 'AG08');
  const { s: s3 } = aiLab('AG08', { t: 1, dg: 2 });
  const mid = lineLabour(s3, 'AG08');
  const a = safetyLabour(s).exp.fit.a;
  check(hi.exp > 11 && hi2.exp > hi.exp * 1.5, "E2 AI labour on safety experiments grows with the package's copies and has no √M cap", `m_exp ${hi.exp.toFixed(1)} → ${hi2.exp.toFixed(1)} at ${safetyFleet(s).copies.toFixed(0)} → ${safetyFleet(s2).copies.toFixed(0)} copies (SAF_EXP a ${a.toFixed(3)})`);
  check(mid.exp < hi.exp && mid.ideas < hi.ideas, 'E2 more SAF coverage (a stronger safety model) gives more AI labour', `fit +2 OOM: m ${mid.exp.toFixed(2)} / ${mid.ideas.toFixed(2)}; +6 OOM: ${hi.exp.toFixed(1)} / ${hi.ideas.toFixed(1)}`);
  // Low coverage adds little even with lots of compute and full trust.
  const { s: w } = aiLab('AG08', { t: 1, pkg: 0.6 });
  const lo = lineLabour(w, 'AG08');
  // Thresholds m_exp < 1.4, m_ideas < 1.1 [D] (M9 re-baseline, same channel as the start check above; were 1.25 /
  // 1.02): the start model's AI taste is 0.75 SD higher since F4's sd_SC 1.25, m 1.303 / 1.058 on the merged head; the
  // work AI does stays under 6%.
  check(lo.exp < 1.4 && lo.ideas < 1.1 && lo.aiShare < 0.06,'E2 a safety model with low SAF coverage adds little (start model, full trust, 60% of the safety pool)', `m ${lo.exp.toFixed(3)} / ${lo.ideas.toFixed(4)}, work AI does ${(lo.aiShare * 100).toFixed(1)}%`);
  // The share handed is the player's lever: at t = 0.5 the humans keep half the work, so the CES caps the gain.
  const { s: h } = aiLab('AG08', { t: 0.5, dg: 6 });
  const half = lineLabour(h, 'AG08');
  check(half.exp > 1.5 && half.exp < hi.exp && Math.abs(half.aiShare - 0.5 * hi.aiShare) < 1e-6, 'E2 Trusted to AI is the share handed: half of it halves the work AI does and caps the gain (humans keep the rest)', `t 0.5: m ${half.exp.toFixed(2)} (t 1: ${hi.exp.toFixed(1)}), work AI does ${(half.aiShare * 100).toFixed(0)}% vs ${(hi.aiShare * 100).toFixed(0)}%`);
  // A line's automation factor (research/14 Auto) scales its share of covered work: agent foundations barely automates.
  const ag12 = lineLabour(s, 'AG12');
  check(ag12.exp < hi.exp && ag12.aiShare < hi.aiShare, "E2 a line's automation factor scales the covered share (AG12 Auto 0.2 vs AG08 1.0)", `AG12 m ${ag12.exp.toFixed(2)}, work AI does ${(ag12.aiShare * 100).toFixed(0)}% vs AG08 ${(hi.aiShare * 100).toFixed(0)}%`);
  // Taste: the covering model's SAF_IDEAS taste lifts ideation's taste like capability IDEAS.
  const { s: tq, id: tid } = aiLab('AG08', { t: 1, dg: 6 });
  const { s: t0, id: t0id } = aiLab('AG08', { t: 0, dg: 6 });
  const qa = safSciOn(tq, tid).q;
  const qh = safSciOn(t0, t0id).q;
  check(qa > 2 * qh && Math.abs(qh - 1) < 1e-12, "E2 AI taste from the safety model's SAF_IDEAS fit lifts the scientists' taste (weight: AI's share of the SAF_IDEAS labour, DD-13)", `taste ${qh.toFixed(3)} → ${qa.toFixed(2)} (sd_AI ${safetyLabour(tq).sdAI.toFixed(1)})`);
}
{
  // Trusted to AI 0 → no AI labour, even with a covering model and a fleet.
  const { s, id } = aiLab('AG08', { t: 0, dg: 6 });
  const l = lineLabour(s, 'AG08');
  const r = lineRates(s, id, safAllocation(s, id));
  const { s: b, id: bid } = aiLab('AG08', { t: 0 });
  const rb = lineRates(b, bid, safAllocation(b, bid));
  check(l.exp === 1 && l.ideas === 1 && l.aiShare === 0 && safetyLabour(s).exp.m === 1 && Math.abs(r.idea / rb.idea - 1) < 1e-9 && Math.abs(r.X / rb.X - 1) < 1e-9, 'E2 Trusted to AI 0: no AI labour on lines, cases or upkeep (a covering model and a fleet notwithstanding)', `m ${l.exp}/${l.ideas}, SAF_EXP m ${safetyLabour(s).exp.m}`);
  // No fleet (no compute) → nothing is handed.
  const { s: n } = aiLab('AG08', { t: 1, dg: 6, pkg: 0 });
  check(safetyLabour(n).t === 0 && lineLabour(n, 'AG08').exp === 1, 'E2 no safety agents running (no compute): nothing is handed, whatever the policy');
}
{
  // Parity: at equal fit and verifiability (safety work types set to the capability ones' domains, H and v) and equal
  // humans and agent compute, safety work gets exactly the capability multiplier at Trusted to AI 1.
  const keep = { e: { ...WORK_TYPES.SAF_EXP }, i: { ...WORK_TYPES.SAF_IDEAS } };
  const rows: string[] = [];
  let worst = 0;
  for (const [saf, cap, dg] of [['SAF_EXP', 'EXP', 2], ['SAF_IDEAS', 'IDEAS', 2], ['SAF_EXP', 'EXP', 4], ['SAF_IDEAS', 'IDEAS', 4]] as const) {
    const { s } = aiLab('AG08', { t: 1, dg });
    s.player.features = [];
    const def = WORK_TYPES[cap];
    Object.assign(WORK_TYPES[saf], { w: def.w, H: def.H, v: def.v, horizon: def.horizon });
    // All the package's compute on this work type: the other safety role has no people.
    for (const t of s.player.teams) {
      const onSaf = (t.role === 're' && t.dept === 'saf') || (t.role === 'sci' && t.projectId === lineNodeId('AG08'));
      if (onSaf && (saf === 'SAF_EXP') !== (t.role === 're')) t.heads = 0;
    }
    resetSafAllocation(s);
    resetWorkContext(s);
    const sl = safetyLabour(s);
    const x = saf === 'SAF_EXP' ? sl.exp : sl.ideas;
    const c0 = workContext(s).slots[cap];
    const c = labourOf(s, cap, { h: x.H / c0.H, k: x.h100e / c0.h100e });
    worst = Math.max(worst, Math.abs(x.m / c.m - 1));
    rows.push(`${saf} vs ${cap} (+${dg} OOM): a ${x.fit.a.toFixed(3)} / ${c.fit.a.toFixed(3)}, m ${x.m.toFixed(3)} / ${c.m.toFixed(3)}`);
    Object.assign(WORK_TYPES.SAF_EXP, keep.e);
    Object.assign(WORK_TYPES.SAF_IDEAS, keep.i);
  }
  console.log(`      ${rows.join('\n      ')}`);
  check(worst < 1e-9, 'E2 parity: at equal fit and verifiability, equal people and agent compute, safety work gets the capability multiplier exactly (Trusted to AI 1)', `worst ${worst.toExponential(1)}`);
  // With the real data safety automates later only through its work types: lower verifiability, longer ideas tasks.
  const { s } = aiLab('AG08', { t: 1, dg: 2 });
  resetWorkContext(s);
  const sl = safetyLabour(s);
  const wc = workContext(s);
  check(sl.exp.fit.a < wc.slots.EXP.fit.a && sl.ideas.fit.a < wc.slots.IDEAS.fit.a, 'E2 with the V3 data safety work is covered later than capability work (lower verifiability v, 80 h ideas tasks)', `same model +2 OOM: SAF_EXP ${sl.exp.fit.a.toFixed(3)} vs EXP ${wc.slots.EXP.fit.a.toFixed(3)}; SAF_IDEAS ${sl.ideas.fit.a.toFixed(3)} vs IDEAS ${wc.slots.IDEAS.fit.a.toFixed(3)}`);
}
{
  // Sabotage (F49): FALSE results ∝ the share of the line's work AI does × the safety model's hidden SAND + SCHEME.
  const rate = (t: number, sand: number) => {
    const { s } = aiLab('AG08', { t, dg: 6, seed: 6 });
    const v = safetyAgentVersion(s) as ModelVersion;
    v.uModes = [];
    v.traitsTrue.SAND = sand;
    v.traitsTrue.SCHEME = 0;
    s.player.policies.publishSafety = 'none';
    const share = lineLabour(s, 'AG08').aiShare;
    const snap = JSON.stringify(s.player.safety);
    const ctx = makeCtx(s);
    let f = 0;
    const N = 1200;
    for (let i = 0; i < N; i++) {
      if (fireFinding(s, ctx, 'AG08')?.trueType === 'FALSE') f++;
      s.player.safety = JSON.parse(snap);
    }
    return { f: f / N, share };
  };
  const z = rate(0, 0.8);
  const a = rate(0.5, 0.2);
  const b = rate(0.5, 0.8);
  const c = rate(1, 0.8);
  check(z.f === 0 && a.f < b.f && b.f < c.f, "E2 sabotage: FALSE results rise with the safety model's hidden SAND and with the work AI does (none with nothing trusted)", `FALSE share: t 0 → ${(z.f * 100).toFixed(1)}%; t .5 SAND .2 → ${(a.f * 100).toFixed(1)}%; t .5 SAND .8 → ${(b.f * 100).toFixed(1)}%; t 1 SAND .8 → ${(c.f * 100).toFixed(1)}% (work AI does ${(b.share * 100).toFixed(0)}% / ${(c.share * 100).toFixed(0)}%)`);
  // A weak (low-coverage) model sabotages little even fully trusted: it does little of the work.
  const { s } = aiLab('AG08', { t: 1 });
  check(lineLabour(s, 'AG08').aiShare < 0.06, 'E2 a low-coverage safety model does little of the work, so its sabotage weight is small', `${(lineLabour(s, 'AG08').aiShare * 100).toFixed(1)}%`);
}

// ───────────────────────────── 6. state ─────────────────────────────
{
  const { s, id } = lab('AG18');
  results(s, id, 1);
  const back = deserialize(serialize(s));
  check(JSON.stringify(back.player.tree[id].saf) === JSON.stringify(s.player.tree[id].saf), 'E1 line project state round-trips through save');
}

finish('safetyresearch');
