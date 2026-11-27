// RD-R02b targeted check: a safety node's project yields only its own technique / finding or a dead end; no candidate
// pool; one stepper (models/research.ts stepProject) serves both departments. Run: npx tsx scripts/v2/_r02b/check.ts
import { readFileSync } from 'node:fs';
import { TREE, PROJECT_BY_ID } from '../../../src/data/v2/tree';
import { FINDINGS } from '../../../src/data/v2/findings';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { nodeTestResult, ownRow } from '../../../src/engine/v2/safety/findings';
import { stepProject } from '../../../src/engine/v2/models/research';
import { freshSaf, lineRates, resetSafAllocation, safAllocation } from '../../../src/engine/v2/safety/lineProjects';
import type { AgendaId, GameStateV2 } from '../../../src/engine/v2/types';
import { check, finish } from '../lib';

const src = (f: string) => readFileSync(new URL(`../../../src/${f}`, import.meta.url), 'utf8');

// 1. No candidate pool, no beliefs, no lineSpeed, no line stepper.
{
  const lp = src('engine/v2/safety/lineProjects.ts');
  const ty = src('engine/v2/types.ts');
  const ag = src('data/v2/agendas.ts');
  const gone = ['cands', 'SafCandidate', 'newSafCandidate', 'lineSpeed', 'stepLineProject', 'SAF_BELIEF', 'SAF_POOL_MAX', 'SAF_PICK_AT'];
  const hits = gone.filter((k) => new RegExp(`\\b${k}\\b`).test(lp) || new RegExp(`\\b${k}\\b`).test(ag) || (k === 'SafCandidate' && /\bSafCandidate\b/.test(ty)));
  check(hits.length === 0, 'no candidate pool, beliefs, lineSpeed or line stepper left', hits.join(', ') || 'clean');
}

// 2. One stepper for both departments.
{
  const rs = src('engine/v2/models/research.ts');
  const tr = src('engine/v2/models/tree.ts');
  const defs = (rs.match(/export function stepProject\(/g) ?? []).length;
  check(defs === 1 && /stepProject\(s, ctx, n, \{ dept: 'cap'/.test(rs) && /stepProject\(s, ctx, n, \{\s*dept: 'saf'/.test(tr), 'one stepProject serves capability (dept cap) and safety (dept saf) projects');
}

const safetyNodes = TREE.filter((n) => n.agenda && !n.followUp && !n.star && !n.soon);
const fresh = (seed = 7) => newGame(defaultSetupV2({ seed, world: 'tl-central', alignment: 'medium', tutorial: false }));
const known = (s: GameStateV2) => new Set(Object.entries(s.player.tree).filter(([, t]) => t.status === 'known').map(([k]) => k));
const unlocked = (s: GameStateV2) => new Set(Object.values(s.player.safety.techniques).filter((t) => t.unlocked).map((t) => t.id));

// 3. Each safety node's result: works → only its own row / technique (or itself); doesn't → a dead end, posterior b + 1.
{
  const bad: string[] = [];
  let worksN = 0;
  let deadN = 0;
  for (const n of safetyNodes) {
    for (const works of [true, false]) {
      const s = fresh();
      const ctx = makeCtx(s);
      const ag = n.agenda as AgendaId;
      const k0 = known(s);
      const u0 = unlocked(s);
      const f0 = s.player.safety.findings.length;
      const post0 = { ...s.player.safety.agendas[ag].posterior };
      const rec = nodeTestResult(s, ctx, n, works);
      const newF = s.player.safety.findings.slice(f0);
      const newK = [...known(s)].filter((x) => !k0.has(x) && x !== n.id);
      const newU = [...unlocked(s)].filter((x) => !u0.has(x) && x !== n.technique && !x.startsWith('T-F49'));
      const own = ownRow(n);
      const ownUnlocks = new Set((own?.effects ?? []).filter((e) => e.startsWith('unlock:')).map((e) => e.slice(7)));
      const foreignU = newU.filter((x) => !ownUnlocks.has(x));
      const otherRows = newF.filter((f) => FINDINGS.some((r) => r.id === f.id) && f.id !== own?.id);
      if (newF.length > 1 || foreignU.length || otherRows.length || newK.some((x) => PROJECT_BY_ID[x]?.agenda)) bad.push(`${n.id}/${works}: ${newF.map((f) => f.id)} ${foreignU} ${newK}`);
      if (!rec) continue;
      if (rec.nodeId !== n.id) bad.push(`${n.id}: record of ${rec.nodeId}`);
      if (rec.trueType === 'DEAD') {
        deadN++;
        if (s.player.safety.agendas[ag].posterior.b !== post0.b + 1 || s.player.tree[n.id]?.status === 'known') bad.push(`${n.id}: dead end did not move b by 1 or made the node known`);
      } else {
        worksN++;
        if (!works) bad.push(`${n.id}: a failed draw produced ${rec.trueType}`);
        if (s.player.safety.agendas[ag].posterior.a !== post0.a + 1) bad.push(`${n.id}: works did not move a by 1`);
      }
    }
  }
  check(bad.length === 0 && worksN > 0 && deadN >= safetyNodes.length, `every safety node (${safetyNodes.length}): works → only its own technique / finding; doesn't → a dead end (b + 1)`, bad.slice(0, 4).join('; ') || `${worksN} works, ${deadN} dead ends`);
}

// 4. The real stepper on a node: its test ends in the node's own result or a dead end, then retries.
{
  const n = safetyNodes.find((x) => !x.needs.length) ?? safetyNodes[0];
  const s = fresh(3);
  const p = s.player;
  const sci = p.teams.find((t) => t.role === 'sci' && t.dept === 'saf');
  if (sci) {
    sci.projectId = n.id;
    sci.manual = true;
  }
  p.research.queue = [n.id];
  const ts = (p.tree[n.id] = { status: 'researching', progress: 0, attempts: 1 });
  const ctx = makeCtx(s);
  const recs: string[] = [];
  for (let d = 0; d < 3000 && recs.length < 3 && ts.status === 'researching'; d++) {
    resetSafAllocation(s);
    const r = lineRates(s, n.id, safAllocation(s));
    stepProject(s, ctx, n, {
      dept: 'saf', trial: (ts.saf ??= freshSaf(n)), sciRate: r.sci, expRate: r.exp, flopDay: r.flop,
      onResult: (works) => {
        const rec = works === undefined ? undefined : nodeTestResult(s, ctx, n, works);
        if (rec) recs.push(`${rec.trueType}:${rec.id}`);
        ts.saf = freshSaf(n);
        ts.attempts = (ts.attempts ?? 1) + 1;
      },
    });
    s.time.day++;
  }
  const own = ownRow(n)?.id;
  const okRecs = recs.every((x) => x.startsWith('DEAD:') || (own ? x.endsWith(`:${own}`) : true));
  check(recs.length > 0 && okRecs, `${n.id}: the shared stepper's tests end in its own result or a dead end`, recs.join(', ') || 'no result');
}

finish('rd-r02b');
