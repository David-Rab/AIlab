// RD-R04 targeted check: the rolled tree path and the paradigm mirror are gone; kyc is not a node; P27 is a safety
// project of line AG17 (known = adopted). (CP4: the rev-57 migration check is gone with the UB-3 save break.) Run: npx tsx scripts/v2/_r04/check.ts
import { readFileSync } from 'node:fs';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { deserialize } from '../../../src/engine/v2/core/save';
import { adopted } from '../../../src/engine/v2/models/paradigms';
import { nodeTestResult } from '../../../src/engine/v2/safety/findings';
import { AGENDA_BY_ID } from '../../../src/data/v2/agendas';
import { PROJECT_BY_ID, TREE_BY_ID, isLineNode } from '../../../src/data/v2/tree';
import { check, finish } from '../lib';

const src = (f: string) => readFileSync(new URL(`../../../src/${f}`, import.meta.url), 'utf8');
{
  const tr = src('engine/v2/models/tree.ts') + src('engine/v2/types.ts') + src('data/v2/tree.ts');
  const hits = ['function roll(', 'researchSpeed', 'syncParadigm', 'priorMult', 'retryDay', 'TREE_RETRY_DAYS', 'ParadigmState'].filter((k) => tr.includes(k));
  check(hits.length === 0, 'rolled path, research speed, paradigm mirror and retry fields gone', hits.join(', ') || 'clean');
}
const p27 = PROJECT_BY_ID.P27;
check(!TREE_BY_ID.kyc && !!p27 && isLineNode(p27) && p27.agenda === 'AG17' && !p27.paradigm, 'kyc node gone; P27 is a project of line AG17', JSON.stringify({ agenda: p27?.agenda, paradigm: p27?.paradigm }));

const fresh = () => newGame(defaultSetupV2({ seed: 7, world: 'ai2027', alignment: 'medium', tutorial: false }));
{
  const s = fresh();
  check(!('paradigms' in s.player) && adopted(s, 'P01') && adopted(s, 'P04') && !adopted(s, 'P27') && !('P27' in s.hidden.paradigmSuccess),
    'new game: no paradigm mirror; ★ paradigms adopted from the tree; P27 not adopted, no paradigm draw');
  // P27's test works (the stepper's onResult path): the node becomes known, and that is adoption.
  const rec = nodeTestResult(s, makeCtx(s), p27, true);
  check(s.player.tree.P27?.status === 'known' && adopted(s, 'P27'), 'P27 works on the safety stepper → known = adopted', rec?.trueType);
  const s2 = fresh();
  const b0 = s2.player.safety.agendas.AG17.posterior.b;
  nodeTestResult(s2, makeCtx(s2), p27, false);
  check(!adopted(s2, 'P27') && s2.player.safety.agendas.AG17.posterior.b === b0 + 1, 'P27 does not work → AG17 dead end (b + 1), not adopted');
}
finish();
