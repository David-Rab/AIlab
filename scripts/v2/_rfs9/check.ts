// RF-S9 check (npx tsx scripts/v2/_rfs9/check.ts): one hack-saturation rule. E02's open-ended accumulation is gone for
// every lab and run kind: RH saturates within a run toward its rewarded hack share (0 for a run that rewards none), and a
// rival's post run saturates toward the hack share its S2 implies.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { hackSaturation, labPosture, rivalHackShare, rivalSignals, rivalTraitStep, stepTraits, zeroSignals, type TraitEnv } from '../../../src/engine/v2/safety/traits';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s: GameStateV2 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const v = s.player.models.versions[s.player.models.versions.length - 1];
const sg = { ...zeroSignals(), S2: 0.5 };
const env = (hackTarget?: number): TraitEnv => ({
  signals: sg, omega: 0.6, D: 1, w: s.hidden.edgeWeights, mods: {}, amp: {}, removal: {}, removalMult: 1, crystalAt: 1, tierF: 0, memory: false, growthMult: 1,
  bracket: { constitution: false, heavy: false, persuasion: false, cast: false }, eaMult: 1, ...(hackTarget !== undefined ? { hackTarget } : {}),
});
const x0 = { ...v.traitsTrue, RH: 0.01, SYC: 0 };
const noTarget = stepTraits(x0, env());
check(Math.abs(noTarget.RH - x0.RH) < 1e-12, 'S2 0.5 with no rewarded hacks: RH does not grow (no E02 accumulation)', `${x0.RH} -> ${noTarget.RH.toFixed(4)}`);
const t = stepTraits(x0, env(0.3));
check(Math.abs(t.RH - (0.01 + 0.29 * hackSaturation(0.6))) < 1e-9, 'target 0.3: one reference run closes 99% of the gap', `${t.RH.toFixed(4)}`);
const t2 = stepTraits(t, env(0.3));
check(t2.RH <= 0.3 + 1e-12, 'a second run does not accumulate past the target', `${t2.RH.toFixed(4)}`);

const lab = s.rivals[0];
const rsg = rivalSignals(s, lab, labPosture(s, lab), false);
const h = rivalHackShare(rsg);
lab.internal.traitsTrue = { ...lab.internal.traitsTrue, RH: 0 };
const ctx = makeCtx(s);
for (let i = 0; i < 4; i++) rivalTraitStep(s, ctx.rng('rivals'), lab, 'post');
const rh = lab.internal.traitsTrue.RH;
check(h > 0 && rh >= 0.9 * h, 'rival post runs reach the hack share its S2 implies (other RH edges, e.g. E03 SYC, add on top)', `S2 ${rsg.S2.toFixed(3)} -> h ${h.toFixed(3)}, RH after 4 runs ${rh.toFixed(3)}`);
console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
