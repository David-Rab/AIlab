// L2 test: labourMargins per job (departments/workfit.ts; design/bal/LABOUR-ROUND.md §2.1).
// Run: npx tsx scripts/v2/margins.ts   (prints PASS/FAIL lines; exit code 1 on any failure)
// For every slot at the committed day 0 / 400 / 900 fixtures: plusCompute and plusTeam equal finite differences of the
// believed labour computed here independently (capabilities slots through labourOf's own scale.k / scale.h paths; every
// slot through handedLabour on the believed fit), doingNow <= canDo, the bottleneck matches the regime, all finite.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../src/engine/v2/core/save';
import { agentsView, workTypeViews } from '../../src/engine/v2';
import { WORK_TYPES } from '../../src/data/v2/workTypes';
import { believedProd } from '../../src/engine/v2/production/believed';
import { handedLabour, labourMargins, labourOf, measuredLabour, resetSafetyLabour, resetWorkContext, safetyLabour, workContext, type CapSlot, type LabourSlot } from '../../src/engine/v2/departments/workfit';
import { FIXTURE_DIR } from './lib';

let fails = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) fails++;
};
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const SLOTS: LabourSlot[] = ['SWE', 'EXP', 'IDEAS', 'SAF_EXP', 'SAF_IDEAS'];
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

for (const day of [0, 400, 900]) {
  const s = deserialize(readFileSync(join(FIXTURE_DIR, `day${day}.json`), 'utf8'));
  // Run each day twice: as built, and with half the safety work handed to the agents (so the safety slots are live).
  for (const trusted of [undefined, 0.5]) {
    if (trusted !== undefined) s.player.policies.trustedToAI = trusted;
    resetWorkContext(s);
    resetSafetyLabour(s);
    const tag = `day ${day}${trusted !== undefined ? `, trusted ${trusted}` : ''}`;
    const P = believedProd(s).mid;
    for (const slot of SLOTS) {
      const m = labourMargins(s, slot);
      const sl = slot === 'SAF_EXP' ? safetyLabour(s).exp : slot === 'SAF_IDEAS' ? safetyLabour(s).ideas : workContext(s).slots[slot];
      const ml = measuredLabour(s, sl);
      const f = ml.fit;
      // Independent believed labour: handedLabour on the believed fit and the scaled inputs (what measuredLabour reads).
      const Lof = (H: number, AI: number) => handedLabour(P, f.a, sl.t, H, AI, f.assist);
      const base = Lof(sl.H, sl.AI);
      const rel = (L: number) => (base.L > 1e-12 ? L / base.L - 1 : 0);
      const dC = rel(Lof(sl.H, sl.AI * 1.1).L);
      const dT = rel(Lof(sl.H + 1, sl.AI).L);
      check(near(m.plusCompute, dC, 1e-9), `${tag} ${slot}: +10% compute ${pct(m.plusCompute)} = finite difference ${pct(dC)}`);
      check(near(m.plusTeam, dT, 1e-9), `${tag} ${slot}: +1 team ${pct(m.plusTeam)} = finite difference ${pct(dT)}`);
      if (slot === 'SWE' || slot === 'EXP' || slot === 'IDEAS') {
        // The capabilities slots through labourOf's own scale paths (k scales the agents' compute, h the humans).
        const cs = slot as CapSlot;
        const lk = measuredLabour(s, labourOf(s, cs, { k: 1.1 })).L;
        const lh = measuredLabour(s, labourOf(s, cs, { h: sl.H > 1e-12 ? (sl.H + 1) / sl.H : 1 })).L;
        check(near(m.plusCompute, base.L > 1e-12 ? lk / base.L - 1 : 0, 1e-9), `${tag} ${slot}: +10% compute equals labourOf(scale.k = 1.1)`);
        if (sl.H > 1e-12) check(near(m.plusTeam, lh / base.L - 1, 1e-9), `${tag} ${slot}: +1 team equals labourOf(scale.h = (H + 1) / H)`);
      }
      const shareOf = Math.min(ml.A, sl.AI / (sl.H * (base.assist) + sl.AI));
      check(m.doingNow <= m.canDo + 1e-12, `${tag} ${slot}: doing now ${pct(m.doingNow)} <= can do ${pct(m.canDo)}`);
      check(sl.H <= 1e-12 || near(m.doingNow, shareOf, 1e-9), `${tag} ${slot}: doing now = min(A, ai / (h + ai)) = ${pct(shareOf)}`);
      check(m.bottleneck === (base.regime === 'shared' ? 'ai' : 'people'), `${tag} ${slot}: bottleneck '${m.bottleneck}' matches regime '${base.regime}'`);
      check([m.canDo, m.doingNow, m.plusCompute, m.plusTeam].every(Number.isFinite), `${tag} ${slot}: values finite`);
      check(m.plusCompute >= -1e-12 && m.plusTeam >= -1e-12 && m.canDo >= 0 && m.canDo <= 1 + 1e-12 && m.doingNow >= 0, `${tag} ${slot}: margins non-negative, can do in [0, 1]`);
      console.log(`      ${tag} ${slot}: can do ${pct(m.canDo)}, doing ${pct(m.doingNow)}, bottleneck ${m.bottleneck}, +10% compute ${pct(m.plusCompute)}, +1 team ${pct(m.plusTeam)} (H ${sl.H.toFixed(2)}, AI ${sl.AI.toFixed(3)}, wt heads ${WORK_TYPES[slot].heads})`);
    }
    // The views carry the same numbers.
    const wv = workTypeViews(s);
    const av = agentsView(s);
    check(SLOTS.every((k) => { const a = wv.find((x) => x.slot === k)?.margins; const b = labourMargins(s, k); return !!a && JSON.stringify(a) === JSON.stringify(b); }), `${tag}: workTypeViews carries labourMargins for every slot`);
    const laneOf = { SWE: 'eng', EXP: 'capRoutine', IDEAS: 'capFrontier', SAF_EXP: 'safety', SAF_IDEAS: 'safety' } as const;
    check(SLOTS.every((k) => JSON.stringify(av.lanes[laneOf[k]].margins?.[k]) === JSON.stringify(labourMargins(s, k))), `${tag}: agentsView lanes carry labourMargins for each job`);
  }
}

if (fails) {
  console.log(`\n${fails} FAILED`);
  process.exit(1);
}
console.log('\nall passed');
