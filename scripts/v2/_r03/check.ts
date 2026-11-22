// RD-R03 targeted check: safety science teams follow the priority list and teams wanted (the capability planner); with
// nothing queued they stay idle and the readout flags them; no auto-assign left. Run: npx tsx scripts/v2/_r03/check.ts
import { readFileSync } from 'node:fs';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { assignSafTeams, nextLineProject, nodeDept, researchDay, safIdleFlag, safReady } from '../../../src/engine/v2/models/tree';
import { AGENDAS } from '../../../src/data/v2/agendas';
import { PROJECT_BY_ID } from '../../../src/data/v2/tree';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { check, finish } from '../lib';

const src = (f: string) => readFileSync(new URL(`../../../src/${f}`, import.meta.url), 'utf8');
{
  const tr = src('engine/v2/models/tree.ts') + src('engine/v2/models/treeActions.ts') + src('engine/v2/types.ts');
  const hits = ['autoAssignDept', 'lineForTeam', 'continueLine', "'research.autoAssign'", 'autoAssign:'].filter((k) => tr.includes(k));
  check(hits.length === 0, 'auto-assign policy, its toggle and line auto-continue gone', hits.join(', ') || 'clean');
}

const fresh = () => newGame(defaultSetupV2({ seed: 7, world: 'ai2027', alignment: 'medium', tutorial: false }));
const saf = (s: GameStateV2) => s.player.teams.filter((t) => t.role === 'sci' && t.dept === 'saf');
const clearSaf = (s: GameStateV2) => {
  const q = s.player.research.queue;
  for (let i = q.length - 1; i >= 0; i--) { const n = PROJECT_BY_ID[q[i]]; if (n && nodeDept(n) === 'saf') q.splice(i, 1); }
  for (const t of saf(s)) { delete t.projectId; delete t.manual; }
};

// 1. Nothing queued: every safety team idle after a research day, flagged in player language.
{
  const s = fresh();
  clearSaf(s);
  const n = saf(s).length;
  researchDay(s, makeCtx(s));
  const placed = saf(s).filter((t) => t.projectId).length;
  const flag = safIdleFlag(s) ?? '';
  check(n > 0 && placed === 0 && safReady(s).length === 0, 'no safety project queued: no safety team is placed (none silently queued)', `${n} teams, ${placed} placed, ${safReady(s).length} queued`);
  check(flag === `${n} safety team${n === 1 ? '' : 's'} idle — add projects to the priority list`, 'idle safety teams are flagged', flag);
}

// 2. Priority list + teams wanted: the first project gets its teams wanted, the second the next; spares go by value.
{
  const s = fresh();
  clearSaf(s);
  const n = saf(s).length;
  const ids = AGENDAS.map((a) => nextLineProject(s, a.id)).filter((x): x is string => !!x).slice(0, 2);
  const [a, b] = ids;
  s.player.research.queue.push(a, b);
  const wantA = Math.max(1, Math.min(n - 1, 2));
  s.player.research.want[a] = wantA;
  s.player.research.want[b] = 1;
  assignSafTeams(s);
  const on = (id: string) => saf(s).filter((t) => t.projectId === id).length;
  const why = saf(s).find((t) => t.projectId === a)?.why ?? '';
  check(on(a) >= wantA && on(b) >= 1 && on(a) + on(b) === Math.min(n, 12), 'safety teams follow the priority list and teams wanted (spares placed by value)', `${n} teams: ${a} ${on(a)} (wants ${wantA}), ${b} ${on(b)} (wants 1); why "${why}"`);
  check(/^(Priority 1:|Swapped onto)/.test(why), 'the why names the priority or the swap', why);
  // Teams wanted is honoured in priority order: the first project wants every team, the second gets none.
  const c = structuredClone(s);
  for (const t of saf(c)) { delete t.projectId; delete t.manual; }
  c.player.research.want[a] = n;
  assignSafTeams(c);
  const onC = (id: string) => saf(c).filter((t) => t.projectId === id).length;
  check(onC(a) === Math.min(n, 6) && onC(b) === n - Math.min(n, 6), 'priority 1 wanting every team takes them all first', `${a} ${onC(a)}, ${b} ${onC(b)}`);
  researchDay(s, makeCtx(s));
  check(saf(s).every((t) => !t.projectId || t.projectId === a || t.projectId === b), 'after a research day the teams are only on queued projects', saf(s).map((t) => t.projectId ?? '-').join(','));
}
finish();
