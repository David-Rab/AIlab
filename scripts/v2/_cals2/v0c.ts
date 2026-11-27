// CAL-S2 probe: V0's RSCH under the pre-CP3j ai2027 fit (30.15, Δ_bm 2.9, sd 1.25) vs now.
import { V3_CAL } from '../../../src/data/v2/workTypes';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
const run = () => newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, tutorial: false })).player.models.versions[0].domains.RSCH.toFixed(3);
console.log('now', run());
Object.assign((V3_CAL as any)['tl-central'], { dBM: 2.9, sdSC: 1.25 });
console.log('pre-CP3j', run());
