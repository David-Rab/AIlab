// RD-L02 targeted check: the "how far ahead" readers in theft, rivals (open weights, release lag, rival-vs-rival
// lead, recipe-leak previews) and endings (epilogue days to ASI, survival weights, geopolitics lead) read G gaps, the
// one lead clock lagDays and a lab's own frontier-G slope (frontierGPerYear over PACE_WINDOW_DAYS), not a
// progress-year pace. Synthetic frontier-G series on a fresh game.
// Run alone: npx tsx scripts/v2/leadreaders.ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openAbsorbMonths, ownProgressDays, poachLeakG, publishLeakG } from '../../src/engine/v2/actors/rivals';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { frontierGAt, frontierGPerYear, gOfLevel, lagDays, PACE_WINDOW_DAYS } from '../../src/engine/v2/models/capability';
import { bestG } from '../../src/engine/v2/models/labs';
import { projectedMisAtAsi } from '../../src/engine/v2/endings/epilogue';
import { executeTheft } from '../../src/engine/v2/security/theft';
import { LEVEL_KNOTS } from '../../src/data/v2/calibration';
import type { GameStateV2 } from '../../src/engine/v2/types';
import { check, finish } from './lib';

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;
const s: GameStateV2 = newGame(defaultSetupV2({ seed: 7, tutorial: false }));
const act = s.rivals.filter((x) => x.core.status === 'active');
const [r, q] = act;
const R = r.core.id;
const Q = q.core.id;
const setPlayerG = (g: number) => { for (const v of s.player.models.versions) v.G = g; };
const setG = (x: typeof r, g: number) => { x.internal = { ...x.internal, G: g }; x.publicModel = undefined; };

// 400 days of weekly samples: R accelerates (0.2 OOM/yr for 200 d, then 1.0 OOM/yr); Q steady 0.5 OOM/yr; China
// steady 0.4 OOM/yr; the player a staircase.
const days: number[] = [];
for (let d = 0; d <= 399; d += 7) days.push(d);
s.time.day = 400;
s.series.day = days;
const rAt = (d: number) => (d <= 200 ? 10 + (0.2 * d) / 365 : 10 + (0.2 * 200) / 365 + ((d - 200) * 1.0) / 365);
const qAt = (d: number) => 9.8 + (0.5 * d) / 365;
const cAt = (d: number) => 9 + (0.4 * d) / 365;
s.series.G = { player: days.map((d) => (d < 150 ? 10 : d < 300 ? 10.4 : 10.8)), [R]: days.map(rAt), [Q]: days.map(qAt), china: days.map(cAt) };
setG(r, rAt(400));
setG(q, qAt(400));
s.china.lab.internal = { ...s.china.lab.internal, G: cAt(400) };
s.china.lab.publicModel = undefined;
setPlayerG(10.8);

// 1. frontierGAt: interpolated on a continuous line; undefined before the history.
check(near(frontierGAt(s, Q, 100)!, qAt(100), 1e-9) && frontierGAt(s, Q, -1) === undefined, 'frontierGAt: the recorded line on a day', `${frontierGAt(s, Q, 100)}`);
// 2. Windowed pace: R's slope over the last PACE_WINDOW_DAYS is its recent 1.0 OOM/yr, the whole history is slower.
const rWin = frontierGPerYear(s, R, PACE_WINDOW_DAYS);
check(near(rWin, 1.0, 1e-6) && frontierGPerYear(s, R) < 0.7, 'frontierGPerYear over the window = the recent slope', `${rWin.toFixed(4)} vs whole ${frontierGPerYear(s, R).toFixed(4)}`);
// 3. Rival-vs-rival lead is the lead clock (no rate conversion; RD-L03 deleted the leadBetween alias).
check(lagDays(s, Q, R) === -lagDays(s, R, Q), 'lead clock antisymmetric (rival vs rival)');
// 4. Recipe-leak previews: days of the recipient's own slope; leak sizes from the player's own slope.
const pW = frontierGPerYear(s, 'player', PACE_WINDOW_DAYS);
check(near(ownProgressDays(s, Q, 0.05), (0.05 * 365) / 0.5, 1e-6) && near(publishLeakG(s), (9 / 365) * pW * 0.3) && near(poachLeakG(s), 0.1 * pW), 'ownProgressDays / publishLeakG / poachLeakG on frontier-G slopes', `${ownProgressDays(s, Q, 0.05).toFixed(2)} d`);
// 5. Open weights: half the G gap over China, in months of China's own slope, at most 2.
const cnG = bestG(s, 'china');
check(near(openAbsorbMonths(s, cnG + 0.02), ((0.5 * 0.02) / 0.4) * 12, 1e-6) && openAbsorbMonths(s, cnG + 5) === 2 && openAbsorbMonths(s, cnG - 1) === 0, 'openAbsorbMonths: half the G gap at China’s slope, ≤ 2 months', `${openAbsorbMonths(s, cnG + 0.02).toFixed(3)}`);
// 6. Epilogue: days to ASI = G gap ÷ the lab's own windowed slope (no × 0.7, no player pace).
const asiG = gOfLevel(s.hidden.timeline, LEVEL_KNOTS[6]);
const pj = projectedMisAtAsi(s, Q);
check(pj.days === Math.round(((asiG - bestG(s, Q)) / 0.5) * 365), 'projectedMisAtAsi days = G gap ÷ own frontier-G slope', `${pj.days} d`);
// 7. Theft of a rival: China's copy is the victim's recorded line 60 d ago.
if (s.china.lab.core.status === 'active') {
  const ctx = makeCtx(s);
  executeTheft(s, ctx, Q);
  check(near(s.china.lab.internal.G, qAt(340), 1e-6), 'stolen copy = the victim’s frontier line 60 d ago', `${s.china.lab.internal.G.toFixed(4)} vs ${qAt(340).toFixed(4)}`);
} else check(false, 'China active for the theft check');

// 8. Source: no progress-year lead reader left in the RD-L02 files or rivals.ts.
const root = join(fileURLToPath(new URL('.', import.meta.url)), '../../src/engine/v2');
const src = (p: string) => readFileSync(join(root, p), 'utf8');
const pat = /leadBetween|paceOf|modelRate|rateOf/;
const files = ['security/theft.ts', ...readdirSync(join(root, 'endings')).filter((f) => f.endsWith('.ts')).map((f) => `endings/${f}`)];
const bad = files.filter((f) => pat.test(src(f)));
check(!bad.length, 'theft.ts and endings/*.ts read no leadBetween / paceOf / modelRate / rateOf', bad.join(', '));
const rv = src('actors/rivals.ts').split('\n').filter((l) => pat.test(l) && !/^\s*(\/\/|\*|\/\*\*)/.test(l));
const defs = rv.length === 0;
check(defs, 'rivals.ts: no progress-year pace or leadBetween left (RD-L03)', rv.join(' | '));
finish('leadreaders');
