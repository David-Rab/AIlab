// Safety research lines on the project mechanism (model v3 E1; design/notes/E1.md). Owner: WS2.
// Reference inputs reproduce research/14's T₁ pacing; engineers, compute and AI labour speed the stages through the
// capability projects' experiment CES; taste lowers the belief noise; result types still follow the hidden efficacy.
import { AGENDA_BY_ID, AGENDA_IDS, SAF_EXP_SHARE, SAF_RE_UNIT, SAF_STAGES, SERIOUS_CAP } from '../../src/data/v2/agendas';
import { PROJECT_BY_ID, lineNodeId } from '../../src/data/v2/tree';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { deserialize, serialize } from '../../src/engine/v2/core/save';
import { fireFinding } from '../../src/engine/v2/safety/findings';
import { trueEfficacy } from '../../src/engine/v2/safety/common';
import {
  freshSaf, resetSafAllocation, lineCycleDays, lineEtaDays, lineLabourMult, linePoolH100e, lineRates, newSafCandidate, safAllocation, stepLineProject,
} from '../../src/engine/v2/safety/lineProjects';
import { safetyRe } from '../../src/engine/v2/safety/agendas';
import type { AgendaId, FindingType, GameStateV2, Team } from '../../src/engine/v2/types';
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
  re.heads = (SAF_RE_UNIT * (o.re ?? 1)) / SAF_EXP_SHARE;
  p.research.queue = [id];
  p.agents.safety.compute = 0;
  p.computeOnline = 1e6;
  // Line pool = c × computeRef × 1e6 H100e (fixed point: the monitors' share does not depend on the safety split).
  const want = (o.c ?? 1) * AGENDA_BY_ID[ag].computeRef * 1e6;
  p.split.safety = 0.05;
  for (let i = 0; i < 4; i++) p.split.safety *= want / Math.max(1e-9, linePoolH100e(s));
  return { s, id };
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
  // Stub: a safety model above the AI-labour gate, Trusted to AI 0.5 and a fleet.
  const v = s.player.models.versions[0];
  v.evals.measuredL = 9;
  s.player.policies.trustedToAI = 0.5;
  s.player.agents.safety.compute = 0.3;
  for (let i = 0; i < 4; i++) s.player.split.safety *= (AGENDA_BY_ID.AG08.computeRef * 1e6) / Math.max(1e-9, linePoolH100e(s));
  const m = lineLabourMult(s, 'AG08');
  const r1 = lineRates(s, id, safAllocation(s, id));
  // The same lab without AI but with m × the engineers and m × the science capacity.
  const { s: h, id: hid } = lab('AG08', { re: 0.5 * m.exp, cap: 0.5 * m.ideas });
  const rh = lineRates(h, hid, safAllocation(h, hid));
  check(m.exp > 1 && r1.idea > r0.idea && r1.X > r0.X, 'E1 AI labour (stub: the safety fleet) speeds ideation and experiments', `m ${m.exp.toFixed(2)}: ideation ×${(r1.idea / r0.idea).toFixed(2)}, X ×${(r1.X / r0.X).toFixed(2)}`);
  check(Math.abs(r1.l - rh.l) < 1e-9 && Math.abs(r1.idea / rh.idea - 1) < 1e-6, 'E1 AI labour is the same input as human labour (m × engineers in ℓ, m × capacity in ideation)', `ℓ ${r1.l.toFixed(4)} vs ${rh.l.toFixed(4)}`);
}

// ───────────────────────────── 6. state ─────────────────────────────
{
  const { s, id } = lab('AG18');
  results(s, id, 1);
  const back = deserialize(serialize(s));
  check(JSON.stringify(back.player.tree[id].saf) === JSON.stringify(s.player.tree[id].saf), 'E1 line project state round-trips through save');
  // Migration 20 → 21: a pre-E1 project at progress 0.5 keeps its work (half of T₁ of the stage chain done).
  const { s: o, id: oid } = lab('AG02');
  o.player.tree[oid] = { status: 'researching', progress: 0.5, attempts: 1 };
  const raw = JSON.parse(serialize(o));
  raw.schemaRev = 20;
  const m = deserialize(JSON.stringify(raw));
  const st = m.player.tree[oid].saf;
  const T1 = AGENDA_BY_ID.AG02.T1;
  check(st?.stage === 'small' && Math.abs((st.test?.work ?? 0) - (0.5 - SAF_STAGES.idea) * T1) < 1e-9 && Math.abs(lineEtaDays(m, oid) - 15 * T1) < 1, 'E1 migration 20 → 21: a line project half done keeps its work (ETA ½ T₁ at reference)', `${st?.stage}, ETA ${lineEtaDays(m, oid).toFixed(1)} d`);
}

finish('safetyresearch');
