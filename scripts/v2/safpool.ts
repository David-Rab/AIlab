// L6 (design/bal/LABOUR-ROUND.md §3.2): pooled safety research engineers, the capability pool's rule (scripts/v2/repool.ts).
// The pool is the people the needs list gives line experiments x the safety slot's m (effective heads); each programme's
// base need is SAF_RE_ASK x min(LINE_MULT_MAX, staffing) labour units, served in priority order, the last one partial; the
// surplus is spread evenly over the programmes in experiments; m enters once (a line's l = expLabour(lam, its line m over
// the slot's, effective heads), i.e. the people it holds x the line's own m, as before the pool).
//   npx tsx scripts/v2/safpool.ts
import { AGENDA_IDS, LINE_MULT_MAX, SAF_RE_ASK, SERIOUS_CAP } from '../../src/data/v2/agendas';
import { lineNodeId } from '../../src/data/v2/tree';
import { RE_LABOUR_UNIT } from '../../src/data/v2/workTypes';
import { RE_UNIT_HEADS } from '../../src/data/v2/workTypes';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { safetyLabour } from '../../src/engine/v2/departments/workfit';
import { expLabour } from '../../src/engine/v2/models/research';
import { evalM } from '../../src/engine/v2/models/evals';
import { safetyAgentVersion } from '../../src/engine/v2/safety/agents';
import { lineLabourMult, lineRates, resetSafAllocation, safAllocation, safSciOn, type SafAlloc } from '../../src/engine/v2/safety/lineProjects';
import type { GameStateV2, ModelVersion, Team } from '../../src/engine/v2/types';
import { check, finish } from './lib';

const UNIT = RE_LABOUR_UNIT * RE_UNIT_HEADS; // heads x quality in one experiment-labour unit
const N = 6; // programmes in experiments
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps * Math.max(1, Math.abs(a), Math.abs(b));

/** A lab with `n` programmes in experiments (queue order = priority), each with one Strong science team of capacity
 *  SERIOUS_CAP (base need SAF_RE_ASK units), and `hx` people (heads x quality) for line experiments on top of every other
 *  need in the list, at the safety slot's m = `m` (set on the memoised safety labour: the one value the allocation reads;
 *  with `ai` the real AI labour stands in instead and m is what it gives). */
function lab(hx: number, m: number, n: number, ai = false): { s: GameStateV2; ids: string[] } {
  const s = newGame(defaultSetupV2({ seed: 11, world: 'tl-central', alignment: 'medium', tutorial: false }));
  const p = s.player;
  const ids = AGENDA_IDS.slice(0, n + 1).map(lineNodeId); // the last one stays in ideation (no science team)
  const sci = p.teams.find((t) => t.role === 'sci' && t.dept === 'saf') as Team;
  const re = p.teams.find((t) => t.role === 're' && t.dept === 'saf') as Team;
  p.teams = p.teams.filter((t) => !(t.dept === 'saf' && t.role === 'sci'));
  ids.slice(0, n).forEach((id, i) => {
    p.teams.push({ ...sci, id: `${sci.id}-l6-${i}`, heads: 40 * SERIOUS_CAP, projectId: id, manual: true, specialty: undefined } as Team);
    p.tree[id] = { status: 'researching', progress: 0, attempts: 1 };
  });
  p.research.queue = ids;
  p.split.safetyAgents = ai ? 0.3 : 0;
  p.computeOnline = 1e6;
  if (ai) {
    const v = safetyAgentVersion(s) as ModelVersion;
    if (v.build) v.build.dg += 6;
    p.policies.trustedToAI = 1;
  }
  const setM = () => {
    resetSafAllocation(s);
    if (!ai) safetyLabour(s).exp.m = m;
  };
  // Two passes: the other needs (human review, eval suites) depend on m, so find them at this m, then staff on top.
  re.heads = 1;
  setM();
  let other = 0;
  for (const [k, v] of Object.entries(safAllocation(s).demand)) if (k !== 'safExp') other += v;
  re.heads = (other + hx);
  setM();
  return { s, ids };
}
/** The base need of a programme (effective heads), from the rule: SAF_RE_ASK x min(LINE_MULT_MAX, staffing) units. */
const base = (s: GameStateV2, id: string) => SAF_RE_ASK * Math.min(LINE_MULT_MAX, safSciOn(s, id).cap / SERIOUS_CAP) * UNIT;
const per = (ids: string[], a: SafAlloc) => ids.slice(0, N).map((id) => a.re.get(id) ?? 0);
const fmt = (x: number[]) => x.map((v) => v.toFixed(2)).join(' ');

// (a) Pool short: programmes in priority order at their base need, the last one partial, the rest none.
{
  const m = 4;
  const b = base(lab(1, 1, N).s, lineNodeId(AGENDA_IDS[0]));
  const k = 2; // full programmes, then one at half
  const hx = ((k + 0.5) * b) / m;
  const { s, ids } = lab(hx, m, N);
  const a = safAllocation(s);
  const got = per(ids, a);
  const want = got.map((_, i) => (i < k ? b : i === k ? b / 2 : 0));
  check(near(evalM(s), m) && near(a.got.safExp, hx) && got.every((x, i) => near(x, want[i])) && near(a.idle, 0),
    '(a) pool short: programmes by priority at their base need, the last one partial, the rest none',
    `pool = m ${m} x ${hx.toFixed(2)} people = ${(m * hx).toFixed(2)}; base ${b.toFixed(2)}; per programme ${fmt(got)}`);
}

// (b) Pool long: every programme gets its base need plus an equal share of the surplus; nobody idle; ideation gets none.
{
  const m = 4;
  const b = base(lab(1, 1, N).s, lineNodeId(AGENDA_IDS[0]));
  const hx = (N * b * 3) / m; // the pool is three times the base needs
  const { s, ids } = lab(hx, m, N);
  const a = safAllocation(s);
  const got = per(ids, a);
  const each = b + (m * hx - N * b) / N;
  check(each > b && got.every((x) => near(x, each)) && near(a.got.safExp, hx) && near(a.idle, 0) && !a.re.has(ids[N]),
    '(b) pool long: base need + an equal surplus share each; nothing idle; a programme in ideation gets none',
    `pool ${(m * hx).toFixed(2)} over ${N}: each ${each.toFixed(3)} (base ${b.toFixed(2)}); got ${fmt(got)}; idle ${a.idle.toFixed(3)}`);
  const none = safAllocation(lab(hx, m, 0).s);
  check(none.re.size === 0 && near(none.idle, hx), '(b) people are idle only when no programme is in experiments', `no programme: idle ${none.idle.toFixed(3)} of ${hx.toFixed(3)}`);
}

// (c) Equal people: m = 10 runs 5x the programmes at full base need that m = 2 does.
{
  const b = base(lab(1, 1, N).s, lineNodeId(AGENDA_IDS[0]));
  const hx = b; // m = 2: two full programmes
  const full = (m: number) => {
    const { s, ids } = lab(hx, m, 12);
    return AGENDA_IDS.slice(0, 12).map(lineNodeId).filter((id) => (safAllocation(s).re.get(id) ?? 0) >= b - 1e-9).length + 0 * ids.length;
  };
  const f2 = full(2);
  const f10 = full(10);
  check(f2 > 0 && f10 === 5 * f2, '(c) at equal people, m = 10 runs 5x the programmes at full base need that m = 2 does', `${hx.toFixed(2)} people: m = 2 -> ${f2} full programmes, m = 10 -> ${f10}`);
}

// (d) No double m: with real AI safety labour (m > 1) the pool is m x people, and a programme's l is the pre-pool formula
//     at the people it holds (its share of the pool / the slot's m) with its own line m: expLabour(lam, line m, people).
{
  const { s, ids } = lab(150, 1, 1, true); // one programme, three times its base need in people: it takes the whole pool
  const mSlot = evalM(s);
  const a = safAllocation(s);
  const id = ids[0];
  const lineM = lineLabourMult(s, AGENDA_IDS[0], true).exp;
  const r = lineRates(s, id, a, undefined, true);
  const people = (a.re.get(id) ?? 0) / mSlot;
  const lOld = expLabour(s.hidden.timeline.prod.lam, lineM, people, UNIT);
  check(mSlot > 1.5 && near(a.re.get(id) ?? 0, a.got.safExp * mSlot) && near(r.l, lOld),
    '(d) no double m: pool = people x slot m; l = expLabour(lam, line m, people held), the slot m entering once',
    `slot m ${mSlot.toFixed(3)}, line m ${lineM.toFixed(3)}; pool ${(a.re.get(id) ?? 0).toExponential(3)} = ${a.got.safExp.toExponential(3)} people x m; l ${r.l.toExponential(4)} vs ${lOld.toExponential(4)}`);
  // Without AI (m = 1) the pool is the people and l = (people / unit)^lam.
  const { s: s1, ids: i1 } = lab(150, 1, 1, false);
  const a1 = safAllocation(s1);
  const r1 = lineRates(s1, i1[0], a1, undefined, true);
  check(near(a1.re.get(i1[0]) ?? 0, a1.got.safExp) && near(r1.l, Math.pow(a1.got.safExp / UNIT, s1.hidden.timeline.prod.lam)),
    '(d) at m = 1 the pool is the people: l = (people / unit)^lam', `l ${r1.l.toExponential(4)}`);
}

finish('safpool');
