// SR-16 targeted check (run alone: npx tsx scripts/v2/_sr16/check.ts): an environment fix is an owned item per RL
// family, made once by the patch response and reused by every later run on that family.
//  1. day 400 migrates (72 → 73): envFixes present, no per-edge signal-patch flags left;
//  2. after a fix on SWE, a run launched on SWE learns less hacking (lower hack rate h and S2) than the identical run
//     launched before the fix; a focus elsewhere loses only its SWE share; a run without SWE is unchanged; a run
//     launched before the fix keeps its frozen suites;
//  3. the plan's prediction (default map) equals the launched run's engine numbers (frozen recipe), and the predicted
//     beliefs (runTraitPressure) move with the fix;
//  4. a second fix on the family multiplies down, floor PATCH_FLOOR; the old trait-edge path writes nothing.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { runTraitPressure } from '../../../src/engine/v2/core/selectors';
import { rlRecipeNow } from '../../../src/engine/v2/models/runs';
import { applyResponse, PATCH_FLOOR } from '../../../src/engine/v2/safety/responses';
import { hackRates, postHack, postSignals } from '../../../src/engine/v2/safety/traits';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { REFERENCE_POST } from '../../../src/data/v2/runDesign';
import { rlWeights } from '../../../src/engine/v2/models/effective';
import type { GameStateV2, PostDesign, RLFamily } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s: GameStateV2 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const f4 = (x: number) => x.toFixed(4);

// 1. migration
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV === 78 && !!s.player.safety.envFixes && !Object.keys(s.flags).some((k) => k.startsWith('ws2.patch.') && k !== 'ws2.patch.lab.E04'),
  'save migrates to 78 (SR-16; 73 before the merge into rd): envFixes present, no per-edge signal patches', `rev ${s.schemaRev}`);

// 2. runs on SWE vs not
const onF: PostDesign = { ...REFERENCE_POST, rlFocus: ['swe', 'math'] };
const offF: PostDesign = { ...REFERENCE_POST, rlFocus: ['math', 'cyber'] };
const before = rlRecipeNow(s); // a run launched before the fix freezes this
const hOn0 = postHack(s, onF, before.exploit).h, hOff0 = postHack(s, offF, before.exploit).h;
const s2On0 = postSignals(s, onF, before.exploit).S2, s2Off0 = postSignals(s, offF, before.exploit).S2;
const v = internalVersion(s)!;
const flags0 = JSON.stringify(Object.keys(s.flags).filter((k) => k.startsWith('ws2.patch.')).sort());
const err = applyResponse(s, makeCtx(s), 'patchSignal', v.id, undefined, { trait: 'RH', family: 'swe' });
const fix = s.player.safety.envFixes?.swe;
check(!err && !!fix && fix.mult >= 0.3 - 1e-9 && fix.mult <= 0.6 + 1e-9 && fix.n === 1 && Object.keys(s.player.safety.envFixes!).length === 1,
  'patch response makes one owned SWE environment fix ×0.3–0.6', `${err ?? ''} mult ${fix?.mult}`);
check(JSON.stringify(Object.keys(s.flags).filter((k) => k.startsWith('ws2.patch.')).sort()) === flags0, 'no trait-edge patch flags written (old path gone)');
const after = rlRecipeNow(s);
const hOn1 = postHack(s, onF, after.exploit).h, hOff1 = postHack(s, offF, after.exploit).h;
const s2On1 = postSignals(s, onF, after.exploit).S2, s2Off1 = postSignals(s, offF, after.exploit).S2;
check(hOn1 < hOn0 - 1e-6 && s2On1 < s2On0 - 1e-6, 'a later run on SWE learns less hacking than the identical run without the fix',
  `h ${f4(hOn0)} → ${f4(hOn1)}, S2 ${f4(s2On0)} → ${f4(s2On1)}, λ ${f4(postHack(s, onF, before.exploit).lambda)} → ${f4(postHack(s, onF, after.exploit).lambda)}`);
// Every post run trains a little on every suite (focus 80%, the rest shared), so a math / cyber focus still has SWE in
// it: its SWE part falls, its other families' hack rates do not. A run with no SWE at all = frozen suites without SWE
// (the start suites always exist, so this is the launch snapshot minus the family).
const hrOther = (rec: typeof before) => { const r = hackRates(rlWeights(offF.rlFocus, Object.keys(rec.exploit!) as RLFamily[]), rec.exploit!, 0.1); delete r.swe; return JSON.stringify(r); };
check(hOff1 < hOff0 && hrOther(before) === hrOther(after), 'a math / cyber run: only its SWE share learns less; other families’ hack rates unchanged', `h ${f4(hOff0)} → ${f4(hOff1)}`);
const noSwe = (rec: typeof before) => { const x = { ...rec.exploit! }; delete x.swe; return x; };
const hN0 = postHack(s, onF, noSwe(before)).h, hN1 = postHack(s, onF, noSwe(after)).h;
const sN0 = postSignals(s, onF, noSwe(before)).S2, sN1 = postSignals(s, onF, noSwe(after)).S2;
check(Math.abs(hN1 - hN0) < 1e-12 && Math.abs(sN1 - sN0) < 1e-12, 'a run that does not use SWE is unchanged by the fix (hack rate, S2)', `h ${f4(hN0)}`);
check(Math.abs(after.exploit!.swe! - before.exploit!.swe! * fix!.mult) < 1e-12 && Math.abs(after.exploit!.math! - before.exploit!.math!) < 1e-12,
  'the frozen SWE exploitability is the suite × the fix; other families as before');
check(Math.abs(postHack(s, onF, before.exploit).h - hOn0) < 1e-12, 'a run launched before the fix keeps its frozen suites');

// 3. prediction = engine
const hPred = postHack(s, onF).h;
const s2Pred = postSignals(s, onF).S2;
check(Math.abs(hPred - hOn1) < 1e-12 && Math.abs(s2Pred - s2On1) < 1e-12, 'plan prediction equals the launched run (hack rate, S2)', `h ${f4(hPred)} / ${f4(hOn1)}`);
const base = s.player.models.bases.find((b) => b.id === v.baseId)!;
const pOn1 = runTraitPressure(s, { kind: 'post', baseId: base.id, post: onF });
const saved = s.player.safety.envFixes;
s.player.safety.envFixes = {};
const pOn0 = runTraitPressure(s, { kind: 'post', baseId: base.id, post: onF });
s.player.safety.envFixes = saved;
check((pOn1.RH ?? 0) < (pOn0.RH ?? 0) - 1e-9, 'predicted RH change of a SWE run is lower with the fix', `${f4(pOn0.RH ?? 0)} → ${f4(pOn1.RH ?? 0)}`);

// 4. repeated fixes, floor
const m1 = fix!.mult;
for (let i = 0; i < 6; i++) applyResponse(s, makeCtx(s), 'patchSignal', v.id, undefined, { family: 'swe' });
const fx = s.player.safety.envFixes!.swe!;
check(fx.n === 7 && fx.mult < m1 && Math.abs(fx.mult - PATCH_FLOOR) < 1e-9, 'repeated fixes on one family multiply down to the floor', `${m1} → ${fx.mult}, n ${fx.n}`);

console.log(fails ? `\n${fails} FAIL` : '\nall ok');
process.exit(fails ? 1 : 0);
