// RD-L01 targeted check: the one lead clock lagDays on synthetic frontier-G series (corners, staircase, follower
// ahead, short history, G value above the leader, a lab recorded later), and LeadTrack / RiskMap / China readouts
// all reading it (intel estimate = lagDays + noise; RiskMap and LeadTrack read the same intel estimate).
// Run alone: npx tsx scripts/v2/lagdays.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leadDays, riskSources, updateIntel } from '../../src/engine/v2/actors/intel';
import { usGapMonths } from '../../src/engine/v2/actors/china';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { frontierGPerYear, lagDays, trueLeadDays } from '../../src/engine/v2/models/capability';
import type { GameStateV2, SystemCtx } from '../../src/engine/v2/types';
import { check, finish } from './lib';

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;
const s: GameStateV2 = newGame(defaultSetupV2({ seed: 7, tutorial: false }));
const r = s.rivals.find((x) => x.core.status === 'active')!;
const R = r.core.id;
const setPlayerG = (g: number) => { for (const v of s.player.models.versions) v.G = g; };
const setRivalG = (g: number) => { r.internal = { ...r.internal, G: g }; r.publicModel = undefined; };

s.time.day = 28;
s.series.day = [0, 7, 14, 21, 28];
s.series.G = { player: [10, 10, 10, 11, 11], [R]: [10, 10.1, 10.2, 10.3, 10.4] };
setRivalG(10.4);
setPlayerG(12); // a version newer than the last weekly sample: today's G closes the staircase line

// 1. Continuous leader, interpolated between samples: 10.15 was reached on day 10.5.
check(near(lagDays(s, 10.15, R), 17.5), 'continuous series: interpolated lag', `${lagDays(s, 10.15, R)}`);
// 2. Staircase leader: corners (0,10) (21,11), then today (28,12).
check(near(lagDays(s, 10.5, 'player'), 17.5) && near(lagDays(s, 11.5, 'player'), 3.5), 'staircase series: lag along the corners and today', `${lagDays(s, 10.5, 'player')}, ${lagDays(s, 11.5, 'player')}`);
// 3. Follower ahead: antisymmetric. Lab vs lab: R at 10.4 is behind the player (12); player reached 10.4 on day 8.4.
check(near(lagDays(s, R, 'player'), 19.6) && near(lagDays(s, 'player', R), -lagDays(s, R, 'player')) && lagDays(s, R, R) === 0, 'follower ahead: lagDays(f, l) = −lagDays(l, f); self 0', `${lagDays(s, R, 'player')} / ${lagDays(s, 'player', R)}`);
// 4. History too short: below the leader's first sample, days since it plus the gap at one fixed pre-history rate.
const l9 = lagDays(s, 9, R);
const l8 = lagDays(s, 8, R);
check(l9 > 28 && near(l9 - 28, l8 - l9, 1e-6), 'short history: days since the first sample + gap at the pre-history rate (linear)', `${l9.toFixed(1)}, ${l8.toFixed(1)}`);
// 5. A G value above the leader: negative, the gap at the leader's own frontier-G slope (0.4 OOM in 28 d).
check(near(frontierGPerYear(s, R), (0.4 / 28) * 365) && near(lagDays(s, 10.6, R), -14), 'G value above the leader: −gap ÷ own frontier slope', `${lagDays(s, 10.6, R)}`);
// 6. A lab recorded later than day 0 aligns at the end: [10.2, 10.3, 10.4] on days 14, 21, 28.
s.series.G[R] = [10.2, 10.3, 10.4];
check(near(lagDays(s, 10.25, R), 10.5), 'series shorter than day: aligned from the end', `${lagDays(s, 10.25, R)}`);
s.series.G[R] = [10, 10.1, 10.2, 10.3, 10.4];
// 7. trueLeadDays is lagDays(other, player).
check(trueLeadDays(s, R) === lagDays(s, R, 'player'), 'trueLeadDays = lagDays(other, player)');

// 8. Intel (LeadTrack's and RiskMap's input) reads lagDays: with full evaluator access and zero noise the estimate
// converges on lagDays exactly.
s.hidden.rivalPostures[R] = { ...s.hidden.rivalPostures[R], externalAccess: 1 };
const base = makeCtx(s);
const ctx = new Proxy(base, { get: (t, k) => (k === 'rng' ? () => ({ normal: () => 0, next: () => 0.5, chance: () => false, range: (a: number) => a }) : Reflect.get(t, k)) }) as SystemCtx;
const truth = lagDays(s, R, 'player');
r.intel.leadDaysEst = Math.round(truth);
updateIntel(s, ctx, r);
check(Math.abs(leadDays(s, R).est - truth) <= 1, 'intel estimate = lagDays + noise (noise 0, access 1)', `${leadDays(s, R).est} vs ${truth.toFixed(1)}`);
// RiskMap reads the same estimate LeadTrack does: shifting the stored estimate equals RiskMap's lead what-if.
// (The what-if applies to every lab, so every lab's stored estimate is shifted.)
const labs = [...s.rivals, s.china.lab];
const shifted = JSON.stringify(riskSources(s, { leadDays: 60 }));
for (const x of labs) x.intel.leadDaysEst += 60;
check(JSON.stringify(riskSources(s)) === shifted, 'RiskMap reads the intel estimate LeadTrack shows (leadDays)');
for (const x of labs) x.intel.leadDaysEst -= 60;
// China's readout: the US lead over China in months is the max lagDays over US labs.
const cnExpect = (Math.max(lagDays(s, 'china', 'player'), ...s.rivals.filter((x) => x.core.status === 'active').map((x) => lagDays(s, 'china', x.core.id))) / 365) * 12;
check(near(usGapMonths(s), cnExpect), 'China usGapMonths = max lagDays(china, US lab)', `${usGapMonths(s).toFixed(2)} mo`);

// 9. Source: one function behind the readouts (no rate-based lead conversion left in them).
const root = join(fileURLToPath(new URL('.', import.meta.url)), '../../src');
const src = (p: string) => readFileSync(join(root, p), 'utf8');
const intel = src('engine/v2/actors/intel.ts');
const china = src('engine/v2/actors/china.ts');
const ov = src('ui/v2/panels/Overview.tsx');
check(/lagDays\(/.test(intel) && !/leadBetween|rateOf|B_G_PER_Y/.test(intel), 'intel.ts reads lagDays (no leadBetween / rateOf / B)');
check(/lagDays\(/.test(china) && !/leadBetween/.test(china), 'china.ts readouts read lagDays (no leadBetween)');
check(/leadDays\(s, r\.core\.id\)/.test(ov) && /r\.intel\.leadDaysEst/.test(intel.slice(intel.indexOf('export function riskSources'))), 'LeadTrack (leadDays) and RiskMap (riskSources) read the same intel estimate');
finish('lagdays');
