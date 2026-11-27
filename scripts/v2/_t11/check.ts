// RD-T11 targeted check: scrutiny reads the run's FLOP over the largest rival run. (CP4: the rev-63 migration check
// (no `scale` on runs) is gone with the UB-3 save break.)
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';

import { rivalRunFlop, runScrutiny } from '../../../src/engine/v2/models/runs';

let ok = true;
const check = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); ok &&= c; };
const s = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 1, tutorial: false }));
const F = rivalRunFlop(s);
check(F > 1e25 && F < 1e29, `rival reference run ${F.toExponential(2)} FLOP`);
check(runScrutiny(s, F) === 0 && runScrutiny(s, F / 2) === 0, 'no scrutiny at or below the largest rival run');
check(Math.abs(runScrutiny(s, 3 * F) - 5) < 1e-9, '+5 at ×3 the largest rival run');
process.exit(ok ? 0 : 1);
