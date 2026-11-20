// Temporary FIN1 diagnostic (not committed): RefBot finance numbers at end-2026 / end-2027.
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { resolve, tick } from '../../../src/engine/v2/core/loop';
import { dayOfDate } from '../../../src/engine/v2/core/time';
import { financeAutopilot, REF_AUTOPILOT } from '../../../src/engine/v2/finance/plan';
import { refDecide, refPlay } from '../../../src/engine/v2/bots/ref';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { engine } from '../../../src/engine/v2/index';
import { commitmentsRemaining, commitmentsPerYear } from '../../../src/engine/v2/finance/ledger';
import { runwayOf } from '../../../src/engine/v2/finance/runway';
import type { GameStateV2 } from '../../../src/engine/v2/types';
const START = '2025-07-01';
const D26 = dayOfDate(START, '2027-01-01') - 1;
const D27 = dayOfDate(START, '2028-01-01') - 1;
const med = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
const snap = (s: GameStateV2) => {
  const f = s.player.finance;
  const by: Record<string, number> = {};
  for (const d of f.debts) by[d.kind] = (by[d.kind] ?? 0) + d.drawn;
  const led: Record<string, number> = {};
  for (const c of f.ledger) if (c.endDay > s.time.day) led[c.kind] = (led[c.kind] ?? 0) + (c.perQuarter * (c.endDay - Math.max(s.time.day, c.startDay ?? -Infinity))) / 91.25;
  return { rating: f.rating, cash: f.cash, debt: f.debts.reduce((a, d) => a + d.drawn, 0), by, rvLine: f.debts.find((d) => d.kind === 'revolver')?.principal ?? 0, commitRem: commitmentsRemaining(s), commitYr: commitmentsPerYear(s), led, runway: runwayOf(s).q, rounds: f.rounds.length, V: f.valuation, rev: f.revenueRun, state: f.state };
};
const seeds = (process.argv[2] ?? '1,2,3,4,5,6').split(',').map(Number);
const out: { a: ReturnType<typeof snap>; b: ReturnType<typeof snap>; ratings: string[]; distress: boolean }[] = [];
for (const seed of seeds) {
  const s = newGame(defaultSetupV2({ seed }));
  let a: ReturnType<typeof snap> | undefined;
  const ratings: string[] = [];
  let distress = false;
  while (s.time.day < D27) {
    for (const p of [...s.events.pending]) { const c = refDecide(s, p); if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0); }
    refPlay(s, engine);
    financeAutopilot(s, REF_AUTOPILOT);
    const r0 = s.player.finance.rating;
    tick(s, { skip: ['endings'] });
    if (s.player.finance.rating !== r0 || !ratings.length) ratings.push(`${s.time.day}:${s.player.finance.rating}`);
    if (s.player.finance.state === 'distress' || s.player.finance.state === 'insolvent') distress = true;
    if (s.time.day === D26) a = snap(s);
  }
  out.push({ a: a!, b: snap(s), ratings, distress });
  console.log(`seed ${seed}: ratings ${ratings.join(' ')} | 2026 ${JSON.stringify(a)} | 2027 ${JSON.stringify(snap(s))}`);
}
for (const k of ['a', 'b'] as const) {
  const xs = out.map((o) => o[k]);
  console.log(`${k === 'a' ? 'end-2026' : 'end-2027'}: ratings ${xs.map((x) => x.rating).join(',')} · median cash ${med(xs.map((x) => x.cash)).toFixed(1)} debt ${med(xs.map((x) => x.debt)).toFixed(1)} line ${med(xs.map((x) => x.rvLine)).toFixed(1)} commitRem ${med(xs.map((x) => x.commitRem)).toFixed(0)} commit/yr ${med(xs.map((x) => x.commitYr)).toFixed(0)} runway ${med(xs.map((x) => x.runway)).toFixed(1)} rounds ${med(xs.map((x) => x.rounds))} V ${med(xs.map((x) => x.V)).toFixed(0)} rev ${med(xs.map((x) => x.rev)).toFixed(0)}`);
}
console.log(`ever distress: ${out.filter((o) => o.distress).length}/${out.length}`);
