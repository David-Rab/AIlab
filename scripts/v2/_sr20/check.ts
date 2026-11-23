// SR-20 targeted check (run alone: npx tsx scripts/v2/_sr20/check.ts).
//  1. day 400 migrates to 90; routine / frontier research watchers are 'auto';
//  2. (CAL-S2: removed) SR-20's Standard / High / Critical packages are gone: RF-S2 replaced them with one "Meet my
//     framework" package, whose parts, charges and product case scripts/v2/_rfs2/check.ts part 2 and
//     scripts/v2/_rfs13/check.ts parts 1, 4, 5 test;
//  3. the auto watcher picks the most capable TRUSTED model, skipping a more capable untrusted one; a belief change flips
//     it. CAL-S2: the candidates are placed at the scheming-capable level (measured CYBER ≥ θ_SCHEME), so trust reads the
//     belief's upper end (RF-S1, decision 4); below that level the capability clause (CAL-S) trusts every model.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DANGER_ACTS } from '../../../src/data/v2/danger';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { agentVersion, monitorVersion } from '../../../src/engine/v2/departments/agents';
import { autoWatcher, trustLine } from '../../../src/engine/v2/safety/trusted';
import { measuredLOf } from '../../../src/engine/v2/models/labs';
import type { GameStateV2, ModelVersion } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));

// 1. migration
const s = load();
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV >= 90 && s.player.agents.capRoutine.monitorId === 'auto', 'save migrates to 90; routine research watcher is auto', `rev ${s.schemaRev}, ${s.player.agents.capRoutine.monitorId}, frontier ${s.player.agents.capFrontier.monitorId}`);

// 3. auto watcher: most capable trusted, skip untrusted, belief flip
{
  const x = load();
  const watched = agentVersion(x, 'capRoutine')!;
  const live = x.player.models.versions.filter((v) => v.id !== watched.id && (v.status === 'ready' || v.status === 'deployed'));
  const byL = [...live].sort((a, b) => measuredLOf(x, b).L - measuredLOf(x, a).L);
  check(byL.length >= 2, 'fixture has two live candidate watchers', byL.map((v) => `${v.name} L${measuredLOf(x, v).L.toFixed(1)}`).join(', '));
  const sch = DANGER_ACTS.SCHEME!;
  for (const v of live) { v.evals.suiteDay ??= x.time.day; v.evals.measuredDom = { ...(v.evals.measuredDom ?? {}), [sch.domain]: sch.theta + 1 }; }
  const [top, second] = byL as [ModelVersion, ModelVersion];
  const line = trustLine(x);
  // A narrow belief (sd 0.02): its 90% upper end is est + 0.033.
  const setEst = (v: ModelVersion, est: number) => { for (const tr of ['SCHEME', 'AF', 'SAND'] as const) v.beliefs[tr] = { ...(v.beliefs[tr] ?? {}), est, sd: 0.02 } as ModelVersion['beliefs'][typeof tr]; };
  for (const v of live) setEst(v, line / 3);
  check(monitorVersion(x, 'capRoutine')?.id === top.id, 'all trusted: auto picks the most capable', `${monitorVersion(x, 'capRoutine')?.name}; ${autoWatcher(x, watched).reason}`);
  setEst(top, line + 0.2);
  const w = autoWatcher(x, watched);
  check(monitorVersion(x, 'capRoutine')?.id === second.id && w.reason.includes('skipped') && w.reason.includes(top.name), `top believed scheming up to ${Math.round((line + 0.23) * 100)}% (line ${Math.round(line * 100)}%): skipped, next trusted chosen, reason says so`, w.reason);
  setEst(top, line - 0.1);
  check(monitorVersion(x, 'capRoutine')?.id === top.id, 'belief drops below the line: choice flips back', autoWatcher(x, watched).reason);
  x.player.agents.capRoutine.monitorId = second.id;
  check(monitorVersion(x, 'capRoutine')?.id === second.id, 'player override keeps their pick');
}

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
