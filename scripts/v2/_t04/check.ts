// RD-T04 targeted check (the RL curve called directly, no simulation): the RL midpoint is absolute RL FLOP
// (C_mid = c0 / 10^e_RL), calibrated so the reference base (B0, FLOP_RL_REF) on the standard budget keeps today's gain.
// 1. V0's gain unchanged: B0 + standard budget + V0's RL recipe gives the same gain as the old base-relative midpoint
//    (old C_mid = c0' · FLOP_pre / 10^e_RL with c0' = c0 / FLOP_RL_REF), and the reference run gains RL_REF_GAIN.
// 2. At a fixed budget share the gain now depends on the base's size (a bigger base gets more RL FLOP at the same share).
// 3. A bigger base reaches the reference gain at a smaller share.
// 4. Saturation of a 10x smaller base: the share and the RL FLOP at which each base reaches 95% of its ceiling.
// Run alone: npx tsx scripts/v2/_t04/check.ts
import { RL_C0, flopOfDesign, rlFamiliesAvailable, rlGains, rlWeights } from '../../../src/engine/v2/models/effective';
import { FLOP_RL_REF, REFERENCE_BASE, RL_BUDGET, RL_REF_GAIN } from '../../../src/data/v2/runDesign';
import { START_STATE } from '../../../src/data/v2/calibration';

const w = rlWeights('broad', rlFamiliesAvailable(() => false));
const rho = RL_BUDGET.standard;
const F0 = flopOfDesign(REFERENCE_BASE);
const checks: [string, boolean, string][] = [];
const g = (F: number, share: number, eRL = 0) => rlGains(F, share * F, w, eRL);
// The old base-relative midpoint at base F equals the new absolute one at e_RL − log10(F ÷ FLOP_RL_REF).
const gOld = (F: number, share: number, eRL = 0) => rlGains(F, share * F, w, eRL - Math.log10(F / FLOP_RL_REF));

const eV0 = START_STATE.sampled.v0;
const vNew = g(F0, rho, eV0).general;
const vOld = gOld(F0, rho, eV0).general;
checks.push(['V0 gain unchanged (B0, standard, V0 recipe)', Math.abs(vNew - vOld) < 1e-9, `new ${vNew.toFixed(6)} old ${vOld.toFixed(6)}`]);
checks.push(['reference run gains RL_REF_GAIN', Math.abs(g(FLOP_RL_REF, rho).general - RL_REF_GAIN) < 1e-6, `${g(FLOP_RL_REF, rho).general.toFixed(6)}; c0 ${RL_C0.toExponential(3)} FLOP`]);

const small = F0 / 10;
const big = F0 * 10;
const gs = g(small, rho).general;
const gb = g(big, rho).general;
const gsOld = gOld(small, rho).general;
checks.push(['gain depends on base size at a fixed share', gs < vNew - 0.05 && gb > vNew + 0.05, `0.1x ${gs.toFixed(3)} (was ${gsOld.toFixed(3)}), 1x ${g(F0, rho).general.toFixed(3)}, 10x ${gb.toFixed(3)}`]);

/** Smallest share (log bisection) at which base F's general gain reaches `target(F)`. */
const shareFor = (F: number, target: number) => {
  let lo = 1e-6;
  let hi = 1e6;
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi);
    if (g(F, mid).general >= target) hi = mid;
    else lo = mid;
  }
  return hi;
};
const refG = g(F0, rho).general;
const sBig = shareFor(big, refG);
checks.push(['bigger base reaches the reference gain at a smaller share', sBig < rho, `10x base: ${sBig.toFixed(4)} vs ${rho}`]);

const sat = (F: number) => shareFor(F, 0.95 * g(F, 1e6).ceiling);
const satS = sat(small);
const sat0 = sat(F0);
console.log(`95%-of-ceiling: 0.1x base at share ${satS.toFixed(3)} (${(satS * small).toExponential(2)} RL FLOP, ceiling ${g(small, 1).ceiling.toFixed(2)}); ` +
  `1x base at share ${sat0.toFixed(3)} (${(sat0 * F0).toExponential(2)} RL FLOP, ceiling ${g(F0, 1).ceiling.toFixed(2)})`);
checks.push(['10x smaller base saturates at the same absolute RL FLOP (not a fixed share)', Math.abs(Math.log10((satS * small) / (sat0 * F0))) < 0.01, `ratio ${((satS * small) / (sat0 * F0)).toFixed(3)}`]);

let fail = 0;
for (const [name, ok, info] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${info})`);
  if (!ok) fail++;
}
process.exit(fail ? 1 : 0);
