import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { resolve, tick } from '../../../src/engine/v2/core/loop';
import { financeAutopilot, REF_AUTOPILOT } from '../../../src/engine/v2/finance/plan';
import { refDecide, refPlay } from '../../../src/engine/v2/bots/ref';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { engine } from '../../../src/engine/v2/index';
import { runwayOf } from '../../../src/engine/v2/finance/runway';
const seed = Number(process.argv[2] ?? 1);
const s = newGame(defaultSetupV2({ seed }));
const show = (tag: string) => {
  const r = runwayOf(s);
  const f = s.player.finance;
  console.log(`${tag} day ${s.time.day} state ${f.state} rating ${f.rating} cash ${f.cash.toFixed(1)} rw ${r.q.toFixed(2)} liq ${r.liquidity.toFixed(1)} floor ${r.floor.toFixed(1)} low ${r.low.day}:${r.low.liquidity.toFixed(1)} pend ${f.ws3.pendingRound?.ask.toFixed(1) ?? '-'}`);
  console.log('   path ' + r.path.map((p) => `${p.day}:${p.liquidity.toFixed(0)}`).join(' '));
  console.log('   sites ' + s.player.sites.map((x) => `${x.name}/${x.stage}/${x.mw}/${x.spvFunded}/${(x.capex - x.capexPaid).toFixed(1)}/${x.stageEndDay}`).join(' | '));
};
while (s.time.day < 186) {
  for (const p of [...s.events.pending]) { const c = refDecide(s, p); if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0); }
  refPlay(s, engine);
  if (s.time.day >= 182) show('pre-auto');
  financeAutopilot(s, REF_AUTOPILOT);
  if (s.time.day >= 182) show('post-auto');
  tick(s, { skip: ['endings'] });
}
show('end');
{
  // sensitivity at the end state: runway without the projected lease payments of sites still being built
  const c = structuredClone(s);
  for (const x of c.player.sites) delete x.ws3.lease;
  console.log(`no-lease-projection rw ${runwayOf(c).q.toFixed(2)} vs ${runwayOf(s).q.toFixed(2)}`);
}
