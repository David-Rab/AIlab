// UB-3 targeted check (save break): a new game round-trips and continues identically; a pre-break save (the day-400
// fixture as committed at rd 306d4c4, schemaRev 102) is refused with the player-facing message.
//   npx tsx scripts/v2/_ub3/check.ts
import { execSync } from 'node:child_process';
import { MIN_SCHEMA_REV, OLD_SAVE_MESSAGE, SCHEMA_REV, deserialize, serialize, stateHash } from '../../../src/engine/v2/core/save';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { tick } from '../../../src/engine/v2/core/loop';
import { check, finish } from '../lib';

check(MIN_SCHEMA_REV === SCHEMA_REV, `the save floor is the current rev (${SCHEMA_REV})`);
const s = newGame(defaultSetupV2({ seed: 7, world: 'tl-central', alignment: 'medium', tutorial: false }));
for (let i = 0; i < 40; i++) tick(s);
const back = deserialize(serialize(s));
check(back.schemaRev === SCHEMA_REV && stateHash(back) === stateHash(s), 'a new game saves and loads unchanged');
for (let i = 0; i < 20; i++) { tick(s); tick(back); }
check(stateHash(back) === stateHash(s), 'the loaded game continues identically (20 days)');
const old = execSync('git show 306d4c4:scripts/v2/fixtures/day400.json', { encoding: 'utf8', maxBuffer: 64 << 20 });
let msg = '';
try {
  deserialize(old);
} catch (e) {
  msg = (e as Error).message;
}
check(msg === OLD_SAVE_MESSAGE, `a pre-break save (rev ${JSON.parse(old).schemaRev}) is refused: "${OLD_SAVE_MESSAGE}"`, msg || 'loaded');
finish('ub3');
