// SR-11 check: the sight limit rises with instrument reliability and falls with the capability gap since validation.
import { newGame, defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { sightLimit } from '../../../src/engine/v2/safety/sightLimit';
import type { GameStateV2 } from '../../../src/engine/v2/types';

const s = newGame(defaultSetupV2()) as GameStateV2;
const clone = (x: GameStateV2) => JSON.parse(JSON.stringify(x)) as GameStateV2;
let fail = 0;
const check = (ok: boolean, msg: string, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg} ${d}`); if (!ok) fail++; };
const base = sightLimit(s);
// More reliable instruments: every line's posterior shifted towards working (believed efficacy up).
const hi = clone(s);
for (const a of Object.values(hi.player.safety.agendas)) a.posterior = { ...a.posterior, a: a.posterior.a * 3 };
const up = sightLimit(hi);
check(up.L >= base.L && up.L > base.L - 1e-9 && (up.L > base.L || base.L === 15), 'reliability up -> sight limit up', `${base.L} -> ${up.L}`);
// Instruments validated on a weaker model: the capability gap since validation is larger.
const old = clone(s);
for (const t of Object.values(old.player.safety.techniques)) t.validatedOom = (t.validatedOom ?? 0) - 3;
const down = sightLimit(old);
check(down.L < base.L || base.L === 0, 'validated 3 OOM further back -> sight limit down', `${base.L} -> ${down.L}`);
check(base.lo <= base.L && base.L <= base.hi, 'range brackets the point', `${base.lo}-${base.hi}`);
process.exit(fail ? 1 : 0);
