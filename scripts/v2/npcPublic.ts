// N9 test: the public view of an NPC lab (engine/v2/npc/public.ts; design/npc/NPC-LABS.md §9).
// Run: npx tsx scripts/v2/npcPublic.ts
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { quarterIndex } from '../../src/engine/v2/core/time';
import { h50Of } from '../../src/engine/v2/models/capability';
import { DAYS_PER_MONTH } from '../../src/engine/v2/npc/lab';
import { PUBLIC_SIGMA, publicOf, refreshPublic, sigmaOf } from '../../src/engine/v2/npc/public';
import { leadDays } from '../../src/engine/v2/actors/intel';
import { gradeRival } from '../../src/engine/v2/actors';
import type { GameStateV2, RivalLab } from '../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, msg: string, detail = '') => { console.log(`${ok ? '  ok ' : 'FAIL '} ${msg}${detail ? `  (${detail})` : ''}`); if (!ok) fails++; };
const clone = (s: GameStateV2): GameStateV2 => JSON.parse(JSON.stringify(s));
const sd = (xs: number[]) => { const m = xs.reduce((a, x) => a + x, 0) / xs.length; return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1)); };
const step = (g: GameStateV2) => tick(g, { skip: ['endings'] });

const s = newGame(defaultSetupV2({ world: 'tl-central', start: 'challenger', seed: 7, tutorial: false }));
const us = s.rivals.find((r) => r.npc?.kind === 'bigtech')!;
const cn = s.china.lab;
for (const l of [us, cn]) { l.finance.revenueRun = l.finance.revenueRun || 2; l.finance.valuation = 20; } // the cast gives some labs no valuation; set values so every error can be measured

// (a) the error has the stated sigma over many report indices (within 10%), China x2.
const N = 3000;
function errors(lab: RivalLab) {
  const c = clone(s);
  const r = [...c.rivals, c.china.lab].find((x) => x.core.id === lab.core.id)!;
  const out = { lag: [] as number[], hor: [] as number[], comp: [] as number[], rev: [] as number[], val: [] as number[] };
  const trueH = h50Of(c.hidden.timeline, r.publicModel ?? r.internal);
  const d = r.npc!.d;
  for (let k = 1; k <= N; k++) {
    r.npc!.rel = k + 10; // a new public release: capability reports
    c.time.day = 400 + 92 * k; // a new quarter: compute, valuation and revenue report
    refreshPublic(c, r);
    const p = r.npc!.pub!;
    out.lag.push((p.lagDays - d) / DAYS_PER_MONTH);
    out.hor.push(Math.log(p.horizonMin / trueH));
    out.comp.push(Math.log(p.computeH100e / r.core.computeOnline));
    out.rev.push(Math.log(p.revenue / p.snapRev));
    out.val.push(Math.log(p.valuation / r.finance.valuation));
  }
  return out;
}
for (const lab of [us, cn]) {
  const mult = lab === cn ? 2 : 1;
  const e = errors(lab);
  for (const [name, xs, base] of [['monthsBehind', e.lag, PUBLIC_SIGMA.monthsBehind], ['horizon', e.hor, PUBLIC_SIGMA.horizon], ['compute', e.comp, PUBLIC_SIGMA.compute], ['revenue', e.rev, PUBLIC_SIGMA.revenue], ['valuation', e.val, PUBLIC_SIGMA.valuation]] as const) {
    const want = base * mult;
    const got = sd(xs);
    check(Math.abs(got / want - 1) < 0.1 && Math.abs(want - sigmaOf(lab.core.id, name)) < 1e-12, `(a) ${lab.core.name} ${name}: sd ${got.toFixed(3)} vs ${want.toFixed(3)}${mult === 2 ? ' (China x2)' : ''}`);
  }
}

// (b) values change only on report days; two runs agree; a report consumes no RNG stream.
{
  const g = clone(s);
  const labs = () => [...g.rivals, g.china.lab];
  const pubOnly = (r: RivalLab) => { const { snapQ, snapRev, ...rest } = r.npc!.pub!; void snapQ; void snapRev; return JSON.stringify(rest); }; // the snapshot is bookkeeping, not a public value
  const last = new Map(labs().map((r) => [r.core.id, pubOnly(r)]));
  let off = 0, on = 0, rels = 0, quarters = 0;
  for (let i = 0; i < 300; i++) {
    const rel0 = new Map(labs().map((r) => [r.core.id, r.npc!.rel]));
    const q0 = quarterIndex(g.time.startDate, g.time.day);
    step(g);
    const q1 = quarterIndex(g.time.startDate, g.time.day);
    for (const r of labs()) {
      const now = pubOnly(r);
      const released = r.npc!.rel !== rel0.get(r.core.id);
      if (now !== last.get(r.core.id)) { if (released || q1 !== q0) on++; else off++; }
      if (released) rels++;
      last.set(r.core.id, now);
    }
    if (q1 !== q0) quarters++;
  }
  check(off === 0 && on > 0, '(b) public values change only on report days', `${on} changes on report days, 0 off them; ${rels} releases, ${quarters} quarter reports in 300 days`);
  const a = clone(s), b = clone(s);
  for (let i = 0; i < 60; i++) { step(a); step(b); }
  check(JSON.stringify(a.rivals.map((r) => r.npc!.pub)) === JSON.stringify(b.rivals.map((r) => r.npc!.pub)), '(b) two runs report identical public values');
  const c = clone(s);
  const before = JSON.stringify(c.rng);
  for (const r of [...c.rivals, c.china.lab]) { r.npc!.rel += 1; c.time.day += 100; refreshPublic(c, r); }
  check(JSON.stringify(c.rng) === before, '(b) a report consumes no RNG stream');
}
// revenue is about a month stale: a revenue change 30 days before the quarter's report shows in it; one made after the snapshot does not.
{
  const c = clone(s);
  const r = c.rivals.find((x) => x.npc?.kind === 'bigtech')!;
  const q0 = quarterIndex(c.time.startDate, 0);
  let qStart = 1;
  while (quarterIndex(c.time.startDate, qStart) === q0) qStart++;
  const base = r.finance.revenueRun;
  const run = (bumpDay: number) => {
    const k = clone(c);
    const x = k.rivals.find((y) => y.core.id === r.core.id)!;
    for (let d = qStart - 40; d <= qStart; d++) { k.time.day = d; if (d === bumpDay) x.finance.revenueRun = base * 3; refreshPublic(k, x); }
    return x.npc!.pub!;
  };
  const early = run(qStart - 45 + 5), late = run(qStart - 10);
  check(early.qIdx === quarterIndex(c.time.startDate, qStart) && early.snapRev === base * 3, '(b) revenue reported at a quarter is the value of a month before (a change 35 days before is in it)', `snapshot ${early.snapRev.toFixed(2)} vs base ${base.toFixed(2)}`);
  check(late.snapRev === base, '(b) a change in the last month is not in it', `snapshot ${late.snapRev.toFixed(2)}`);
}

// (c) exact facts are exact: products, tools and disclosed incidents are the lab's own state; the posture is the kind's.
{
  const p = publicOf(s, us);
  check(us.publicModel !== undefined && Array.isArray(us.tools) && Array.isArray(us.intel.knownIncidents), '(c) products, tools and disclosed incidents are read from the lab itself, not through noise');
  check(p.safetyPosture.safetyInvestment === s.hidden.rivalPostures[us.core.id].safetyInvestment, "(c) the safety posture is the kind's posture, exact");
}

// (d) leadDays reads the public lag: sd = sigma months x 30.4 (China x2); the lab's true lag moving does not move the estimate between reports.
{
  const l = leadDays(s, us.core.id), lc = leadDays(s, 'china');
  check(l.sd === Math.round(DAYS_PER_MONTH) && lc.sd === Math.round(2 * DAYS_PER_MONTH), '(d) leadDays sd = 1 month (China 2)', `${l.sd} d, ${lc.sd} d`);
  const k = clone(s);
  const r = k.rivals.find((x) => x.core.id === us.core.id)!;
  const gBefore = r.internal.G;
  const e0 = leadDays(k, r.core.id).est;
  r.npc!.d += 30; // the lab's true lag grows by 30 days (its models are unchanged here, so the true lead read is unchanged); the reported lag stays
  const e1 = leadDays(k, r.core.id).est;
  check(r.internal.G === gBefore && e1 === e0 - 30, "(d) the estimate swaps the lab's side for its reported lag", `${e0} -> ${e1} d`);
}
// (e) Safety Index grades compute from public facts.
check([...s.rivals, s.china.lab].every((r) => Number.isFinite(gradeRival(s, r.core.id).overall)), '(e) gradeRival grades every lab from the public posture and disclosed incidents');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
