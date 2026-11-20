// Temporary FIN1 diagnostic: first distress of RefBot seeds through 2026 and what caused it.
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { resolve, tick } from '../../../src/engine/v2/core/loop';
import { dayOfDate } from '../../../src/engine/v2/core/time';
import { financeAutopilot, REF_AUTOPILOT } from '../../../src/engine/v2/finance/plan';
import { refDecide, refPlay } from '../../../src/engine/v2/bots/ref';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { engine } from '../../../src/engine/v2/index';
import { runwayOf } from '../../../src/engine/v2/finance/runway';
import { commitmentsPerYear } from '../../../src/engine/v2/finance/ledger';
const END = dayOfDate('2025-07-01', '2027-01-01');
for (const seed of (process.argv[2] ?? '1,2,3,4,5,6,7,8,9,10,11,12').split(',').map(Number)) {
  const s = newGame(defaultSetupV2({ seed }));
  let msg = 'none';
  let prev = '';
  while (s.time.day < END) {
    for (const p of [...s.events.pending]) { const c = refDecide(s, p); if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0); }
    refPlay(s, engine);
    financeAutopilot(s, REF_AUTOPILOT);
    const before = { cash: s.player.finance.cash, rw: runwayOf(s), rating: s.player.finance.rating };
    tick(s, { skip: ['endings'] });
    const f = s.player.finance;
    if ((f.state === 'distress' || f.state === 'insolvent') && msg === 'none') {
      const rv = f.debts.find((d) => d.kind === 'revolver');
      const rw = runwayOf(s);
      msg = `day ${s.time.day}: ${f.state} breach=${f.covenantBreachDay !== undefined} runway ${rw.q.toFixed(2)} (before ${before.rw.q.toFixed(2)}) cash ${f.cash.toFixed(1)} line ${rv?.principal.toFixed(1)}/${rv?.drawn.toFixed(1)} rating ${f.rating} burnQ ${rw.burnQ.toFixed(1)} parts ${Object.entries(rw.parts).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' ')} commit/yr ${commitmentsPerYear(s).toFixed(0)} V ${f.valuation.toFixed(0)} rounds ${f.rounds.length} prevRatings ${prev}`;
    }
    if (!prev.endsWith(f.rating)) prev += `${s.time.day}:${f.rating} `;
  }
  console.log(`seed ${seed}: ${msg}`);
}
