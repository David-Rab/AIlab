// RD-R02a targeted check: in the shared units (RE_LABOUR_UNIT, C_UNIT, FLOP by need) a line project at reference inputs
// (serious science staffing, SAF_RE_ASK labour units of engineers, computeNeed × C_UNIT of FLOP) gets its first result
// after T₁ months (±5%), every agenda. Run: npx tsx scripts/v2/_r02a/check.ts
import { AGENDA_BY_ID, AGENDA_IDS, SAF_RE_ASK, SERIOUS_CAP } from '../../../src/data/v2/agendas';
import { lineNodeId } from '../../../src/data/v2/tree';
import { RE_LABOUR_UNIT } from '../../../src/data/v2/workTypes';
import { TEAM_SIZE } from '../../../src/data/v2/teams';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { freshSaf, lineRates, linePoolH100e, resetSafAllocation, safAllocation } from '../../../src/engine/v2/safety/lineProjects';
import { stepProject } from '../../../src/engine/v2/models/research';
import { PROJECT_BY_ID } from '../../../src/data/v2/tree';
import type { SystemCtx } from '../../../src/engine/v2/types';
import type { AgendaId, Team } from '../../../src/engine/v2/types';

function firstResult(ag: AgendaId): { days: number; c: number; l: number } {
  const s = newGame(defaultSetupV2({ seed: 11, world: 'ai2027', alignment: 'medium', tutorial: false }));
  const p = s.player;
  const id = lineNodeId(ag);
  const sci = p.teams.find((t) => t.role === 'sci' && t.dept === 'saf') as Team;
  const re = p.teams.find((t) => t.role === 're' && t.dept === 'saf') as Team;
  for (const t of p.teams) if (t.dept === 'saf' && t.role === 'sci' && t !== sci) delete t.projectId;
  sci.quality = 'strong';
  delete sci.specialty;
  sci.heads = 40 * SERIOUS_CAP;
  sci.projectId = id;
  sci.manual = true;
  re.quality = 'strong';
  re.heads = 2 * SAF_RE_ASK * RE_LABOUR_UNIT * TEAM_SIZE.re; // twice the ask; the rest re-validates or idles
  p.research.queue = [id];
  p.split.safetyAgents = 0;
  p.computeOnline = 1e6;
  const want = AGENDA_BY_ID[ag].computeRef * 1e6; // = computeNeed × C_UNIT ÷ PHI
  p.split.safety = 0.05;
  for (let i = 0; i < 4; i++) p.split.safety *= want / Math.max(1e-9, linePoolH100e(s));
  const ts = (s.player.tree[id] ??= { status: 'researching', progress: 0, attempts: 1 });
  const nd = PROJECT_BY_ID[id];
  const tr = (ts.saf ??= freshSaf(nd));
  let r0 = { c: 0, l: 0 };
  for (let d = 1; d <= 4000; d++) {
    resetSafAllocation(s);
    const a = safAllocation(s);
    const r = lineRates(s, id, a);
    if (r0.c === 0) r0 = r;
    let done = false;
    // RD-R02b: the shared stepper (science and experiments on one test: at reference inputs the result takes T₁ ÷ 2).
    stepProject(s, {} as SystemCtx, nd, { dept: 'saf', trial: tr, sciRate: r.sci, expRate: r.exp, flopDay: r.flop, onResult: () => { done = true; } });
    if (done) return { days: d, ...r0 };
  }
  return { days: Infinity, ...r0 };
}

let worst = 0;
for (const ag of AGENDA_IDS) {
  const r = firstResult(ag);
  const T = 30 * AGENDA_BY_ID[ag].T1;
  const e = Math.abs(r.days / T - 1);
  worst = Math.max(worst, e);
  console.log(`${ag} T₁ ${AGENDA_BY_ID[ag].T1} mo: first ${r.days} d (${((r.days / T - 1) * 100).toFixed(1)}%), c ${r.c.toFixed(3)}, ℓ ${r.l.toFixed(3)}`);
}
console.log(`${worst <= 0.05 ? 'PASS' : 'FAIL'} worst ${(worst * 100).toFixed(1)}% (±5%)`);
process.exit(worst <= 0.05 ? 0 : 1);
