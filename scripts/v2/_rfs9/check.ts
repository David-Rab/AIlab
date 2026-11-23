// RF-S9 check (npx tsx scripts/v2/_rfs9/check.ts): one hack-saturation rule on the player's runs. Every player env
// (runEnv) carries a hack target (0 unless the run rewards hacks), so E02's open-ended accumulation never fires on a
// player run; rivals' safety path is unchanged (designer, 2026-11-23: rival physics stays as is for now).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { hackSaturation, playerEnv, stepTraits, zeroSignals } from '../../../src/engine/v2/safety/traits';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s: GameStateV2 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const v = s.player.models.versions[s.player.models.versions.length - 1];
const sg = { ...zeroSignals(), S2: 0.5 };
const x0 = { ...v.traitsTrue, RH: 0.01, SYC: 0 };
const env = playerEnv(s, x0, sg, 0.6, undefined, 'L-test', [], undefined);
check(env.hackTarget === 0, 'a player env carries hack target 0 by default', `${env.hackTarget}`);
const e0 = { ...env, signals: sg, amp: {}, removal: {}, growthBy: undefined };
const n0 = stepTraits(x0, e0);
check(Math.abs(n0.RH - x0.RH) < 1e-12, 'player run with S2 0.5 and no rewarded hacks: RH does not grow (no E02 accumulation)', `${x0.RH} -> ${n0.RH.toFixed(4)}`);
const t = stepTraits(x0, { ...e0, hackTarget: 0.3 });
check(Math.abs(t.RH - (0.01 + 0.29 * hackSaturation(0.6))) < 1e-9, 'target 0.3: one reference run closes 99% of the gap', `${t.RH.toFixed(4)}`);
const r = stepTraits(x0, { ...e0, hackTarget: undefined });
check(r.RH > x0.RH, 'an env without a target (the rival path) still grows RH through E02', `${x0.RH} -> ${r.RH.toFixed(4)}`);
console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
