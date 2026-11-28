// N5 test: endings read the NPC lab's m (endings/epilogue.ts, endings.ts rule 7). Direct calls on a fresh state; no simulation.
// Run: npx tsx scripts/v2/npcEndings.ts
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { gOfLevel } from '../../src/engine/v2/models/capability';
import { LEVEL_KNOTS } from '../../src/data/v2/calibration';
import { persOf } from '../../src/engine/v2/npc/lab';
import { mWorld } from '../../src/engine/v2/npc/misalignment';
import { npcM } from '../../src/engine/v2/npc/risk';
import { postureOf } from '../../src/engine/v2/actors/rivals';
import { lossThreshold } from '../../src/engine/v2/safety/control';
import { misOf, otherContain, projectedMisAtAsi, resolveAsi } from '../../src/engine/v2/endings/epilogue';
import { endingView } from '../../src/engine/v2/endings/view';
import { check, finish } from './lib';


const s = newGame(defaultSetupV2({ world: 'tl-central', labKind: 'safety', seed: 7, tutorial: false }));
const r = s.rivals.find((x) => x.npc)!;
const id = r.core.id;
const th = lossThreshold(s);

// rule 7 reads m: above the tolerance -> takeover, below -> aligned
r.npc!.m = th + 0.05;
check(misOf(s, id) === r.npc!.m, 'misOf reads npc.m');
let res = resolveAsi(s, id);
check(res.misaligned && res.mis === r.npc!.m && res.exposure === r.npc!.m, 'm above theta: control lost', res.id);
check(res.id === 'rivalTakeover' || res.id === 'asiContested', 'ending is a takeover or contested', res.id);
r.npc!.m = Math.max(0, th - 0.05);
res = resolveAsi(s, id);
check(!res.misaligned && res.id === 'rivalAligned', 'm below theta: aligned', res.id);

// projectedMisAtAsi = m at the ASI capability with the lab's safety and today's race pressure
const asiG = gOfLevel(s.hidden.timeline, LEVEL_KNOTS[6]);
r.internal.G = asiG;
r.npc!.p = 0.4;
const p = postureOf(s, id);
const want = npcM(s, asiG, p.safetyInvestment, p.raceRelaxation, 0.4);
const got = projectedMisAtAsi(s, id).mis;
check(Math.abs(got - want) < 1e-12, 'projectedMisAtAsi equals npcM at ASI G', `${got.toFixed(4)} vs ${want.toFixed(4)}`);
check(got <= mWorld(s, asiG) + 1e-12, 'm at ASI is at most mWorld', `${got.toFixed(4)} <= ${mWorld(s, asiG).toFixed(4)}`);
check(projectedMisAtAsi(s, 'player').mis === misOf(s, 'player'), 'player projection is its own Mis');

// otherContain reads safety emphasis
check(Math.abs(otherContain(s, id) - 0.2 * persOf(r.npc!).safetyEmphasis) < 1e-12, 'otherContain = 0.2 x safety emphasis');

// end-screen view builds
r.core.milestoneDays[6] = 10;
const e = resolveAsi(s, id);
s.ending = { id: e.id, power: e.power, day: 10, title: 't', text: 'x', scores: { total: 0 } as never, verdict: 'v' as never, epilogue: { asiDay: 10, asiLab: id, misAtAsi: e.mis } } as never;
try { const v = endingView(s); check(!!v, 'endingView builds'); } catch (x) { check(false, 'endingView builds', String(x)); }

finish('npcEndings');
