// RF-S11 check (npx tsx scripts/v2/_rfs11/check.ts): human review stops acts at the staffing it gets (the 'review'
// need's served share), in the engine and in the believed readout alike.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { internalOversight } from '../../../src/engine/v2/safety/incidents';
import { believedOversightParts } from '../../../src/engine/v2/safety/believedOversight';
import { needServed, resetSafAllocation, reviewCatch } from '../../../src/engine/v2/safety/lineProjects';
import { addSafeguard, labReviewOn } from '../../../src/engine/v2/safety/safeguards';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { HUMAN_REVIEW } from '../../../src/data/v2/danger';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s: GameStateV2 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const v = internalVersion(s)!;
if (!labReviewOn(s)) for (const d of s.player.deployments) if (d.channel === 'internal' && d.status !== 'withdrawn') addSafeguard(s, d, 'review');
resetSafAllocation(s);
const full = internalOversight(s, v).human;
const bel = believedOversightParts(s, v, false, 0.5).human;
check(labReviewOn(s) && needServed(s, 'review') === 1 && reviewCatch(s) === HUMAN_REVIEW && full > 0, 'review fully staffed: full catch', `served ${needServed(s, 'review')}, human ${full.toFixed(3)}`);
const sr = s.player.research.safRe!;
sr.max = { ...sr.max, review: 0 };
resetSafAllocation(s);
const none = internalOversight(s, v).human;
const belNone = believedOversightParts(s, v, false, 0.5).human;
check(needServed(s, 'review') === 0 && none === 0 && belNone === 0 && bel > 0, 'review unstaffed: stops nothing (engine and readout)', `human ${none}, believed ${bel.toFixed(3)} -> ${belNone}`);
console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
