// L1 test: the optimal human/AI task split (production/ces.ts optimalLabour; design/bal/LABOUR-ROUND.md §1).
// Run: npx tsx scripts/v2/optsplit.ts   (prints PASS/FAIL lines; exit code 1 on any failure)
import { Lrel, optimalLabour } from '../../src/engine/v2/production/ces';
import { effLabour, handedLabour, labourSplit } from '../../src/engine/v2/departments/workfit';

let fails = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) fails++;
};
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const lrel = (rc: number, a: number, h: number, ai: number) => Lrel({ rc } as never, a, h, ai);

// §1.1 worked cases (rho_c = -2, h = 1)
{
  const rc = -2;
  const r1 = optimalLabour(rc, 0.3, 1, 0.05);
  check(near(r1.L, 1.05) && r1.regime === 'shared', `a=0.3, ai=0.05: L = ${r1.L.toFixed(4)} (1.05, shared)`);
  check(near(lrel(rc, 0.3, 1, 0.05), 0.3, 5e-3), `a=0.3, ai=0.05: Lrel = ${lrel(rc, 0.3, 1, 0.05).toFixed(4)} (0.30, the old stopgap case)`);
  const r2 = optimalLabour(rc, 0.6, 1, 5);
  check(Math.abs(r2.L - 3.71) < 0.005 && r2.regime === 'boundary', `a=0.6, ai=5: L = ${r2.L.toFixed(4)} (3.71, boundary)`);
  check(Math.abs(lrel(rc, 0.6, 1, 5) - 3.71) < 0.005 && near(r2.L, lrel(rc, 0.6, 1, 5)), `a=0.6, ai=5: Lrel = ${lrel(rc, 0.6, 1, 5).toFixed(4)}, same as optimal`);
}

// Edge cases
{
  check(near(optimalLabour(-2, 0, 1, 7).L, 1) && near(optimalLabour(-2, -0.2, 1, 7).L, 1), 'a <= 0: L = h');
  const r = optimalLabour(-2, 1, 1, 7);
  check(near(r.L, 8) && r.regime === 'shared' && near(r.aiTaskShare, 7 / 8), `a = 1: L = h + ai = ${r.L} (shared)`);
  check(near(optimalLabour(-2, 1.5, 1, 7).L, 8), 'a > 1: L = h + ai');
}

// Continuity at the switch ai = a(h + ai)  <=>  ai = a h / (1 - a); across rc and a
{
  let worst = 0;
  for (const rc of [-0.5, -1, -2, -4, -8]) {
    for (const a of [0.05, 0.2, 0.5, 0.8, 0.95]) {
      for (const h of [0.1, 1, 30]) {
        const sw = (a * h) / (1 - a);
        const lo = optimalLabour(rc, a, h, sw * (1 - 1e-9));
        const hi = optimalLabour(rc, a, h, sw * (1 + 1e-9));
        const atSw = h + sw;
        worst = Math.max(worst, Math.abs(lo.L - atSw) / atSw, Math.abs(hi.L - atSw) / atSw, Math.abs(lrel(rc, a, h, sw) - atSw) / atSw);
        if (lo.regime !== 'shared' || hi.regime !== 'boundary') worst = Infinity;
      }
    }
  }
  check(worst < 1e-6, `continuous at the switch: worst relative gap ${worst.toExponential(2)}, shared below / boundary above`);
}

// L >= max(h, Lrel) and aiTaskShare = min(a, ai/(h+ai)) on a grid
{
  let bad = 0, n = 0, badShare = 0;
  for (const rc of [-0.5, -1, -2, -4, -8]) {
    for (const a of [0.01, 0.1, 0.3, 0.6, 0.9, 0.99]) {
      for (const h of [0.05, 1, 40]) {
        for (let k = -6; k <= 6; k += 0.5) {
          const ai = Math.pow(10, k);
          const r = optimalLabour(rc, a, h, ai);
          const lr = lrel(rc, a, h, ai);
          n++;
          if (!(r.L >= Math.max(h, lr) * (1 - 1e-12))) bad++;
          if (Math.abs(r.aiTaskShare - Math.min(a, ai / (h + ai))) > 1e-12) badShare++;
        }
      }
    }
  }
  check(bad === 0, `L >= max(h, Lrel) on ${n} grid points (${bad} violations)`);
  check(badShare === 0, `aiTaskShare = min(a, ai/(h+ai)) on ${n} grid points (${badShare} violations)`);
}

// workfit wrappers: wH is the margin share, effLabour == labourSplit.L, safety at t = 1 equals capabilities
{
  const P = { rc: -2 };
  const sh = labourSplit(P, 0.3, 1, 0.05, 1);
  check(near(sh.wH, 1 / 1.05), `shared: wH = h / L = ${sh.wH.toFixed(4)}`);
  const bd = labourSplit(P, 0.6, 1, 5, 1);
  const cesW = (Math.pow(0.4, 3) * 1) / Math.pow(bd.L, -2);
  check(near(bd.wH, cesW), `boundary: wH = CES weight = ${bd.wH.toFixed(4)}`);
  // numerical margin: dL/dh * h / L equals wH in both regimes
  for (const [a, h, ai] of [[0.3, 1, 0.05], [0.6, 1, 5], [0.9, 2, 0.4]] as const) {
    const e = 1e-6;
    const L0 = effLabour(P, a, h, ai), L1 = effLabour(P, a, h * (1 + e), ai);
    const num = (L1 / L0 - 1) / e;
    check(Math.abs(num - labourSplit(P, a, h, ai).wH) < 1e-4, `wH is the human elasticity of L at a=${a}, h=${h}, ai=${ai}`);
  }
  let bad = 0, n = 0;
  for (const a of [0, 0.2, 0.6, 0.95, 1]) {
    for (const H of [1, 12]) {
      for (const AI of [0.01, 1, 80]) {
        for (const as of [1, 1.8]) {
          const c = effLabour(P, a, H, AI, as);
          const s = handedLabour(P, a, 1, H, AI, as);
          n++;
          if (!near(s.L, c) || !near(s.A, a)) bad++;
        }
      }
    }
  }
  check(bad === 0, `safety A = t*a at t = 1 equals capabilities (effLabour) on ${n} points (${bad} differ)`);
  const t0 = handedLabour(P, 0.6, 0, 3, 5, 1.5);
  check(near(t0.L, 3) && t0.wH === 1, 'safety at t = 0: humans alone');
  check(effLabour(P, 0.4, 5, 1e-12, 1.2) >= 5 * 1.2 * (1 - 1e-12), 'no AI staff: labour is not below the humans alone (the old stopgap case)');
}

if (fails) {
  console.log(`\n${fails} FAILED`);
  process.exit(1);
}
console.log('\nall passed');
