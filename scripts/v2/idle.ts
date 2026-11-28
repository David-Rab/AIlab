// Idle stocks (STRUCTURE §8, rule R5): a resource the player owns must not sit unused without an alert.
// Guards: every stock kind the engine lists (core/limitsView.ts idleStocks: dark chips, science teams with no project,
// serving compute no product needs) has its alert, an item in the Watch list or a nav badge (ui/v2/shell/watch.ts
// IDLE_ALERT); the alert shows the day the stock is idle (the engine keeps no timer, so it is always inside the 30-day
// bound), keeps showing while the stock stays idle, and goes when the stock is used. Stocks with a default use are checked
// to flow there: spare training compute stays idle unless the lend policy is on, then it goes to experiments; safety
// research engineers are never silently lost (on a need, on line experiments, or listed idle).
// Constructed cases from the day-400 fixture, one clone per case: set the state, read the selectors. 30 days are ticked
// with no bot only to see that an idle stock stays idle and keeps its alert. No bot games.
// Cost: 4 x 30 ticks of a day-400 state, ~10 CPU-s. Tiers: quick, full.
//   npx tsx scripts/v2/idle.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chipFit } from '../../src/engine/v2/compute/forecast';
import { poolsOf } from '../../src/engine/v2/compute/power';
import { IDLE_STOCK_IDS, idleStocks, type IdleStockId } from '../../src/engine/v2/core/limitsView';
import { tick } from '../../src/engine/v2/core/loop';
import { deserialize } from '../../src/engine/v2/core/save';
import { expPoolH100e } from '../../src/engine/v2/models/research';
import { safReAllocView } from '../../src/engine/v2/models/researchView';
import { idleTrainingShare, lentTrainingH100e } from '../../src/engine/v2/models/runs';
import { projectTeams } from '../../src/engine/v2/models/tree';
import { resetSafAllocation } from '../../src/engine/v2/safety/lineProjects';
import { revenueReadout } from '../../src/engine/v2/worldfx/revenue';
import { IDLE_ALERT, navBadges, watchItems } from '../../src/ui/v2/shell/watch';
import type { GameStateV2 } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish } from './lib';

const RAW = readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8');
/** A fresh clone of the day-400 state (the fixture is a serialized state, so deserialize is the clone). */
const fresh = (): GameStateV2 => deserialize(RAW);
const IDLE_DAYS = 30;

/** Is the stock's alert showing (its Watch item or its nav badge)? */
function alerting(s: GameStateV2, id: IdleStockId): boolean {
  const a = IDLE_ALERT[id];
  return !!((a.watch && watchItems(s).some((w) => w.id === a.watch)) || (a.badge && navBadges(s)[a.badge]));
}
const listed = (s: GameStateV2, id: IdleStockId) => idleStocks(s).some((x) => x.id === id);

check(IDLE_STOCK_IDS.length === 3 && IDLE_STOCK_IDS.every((id) => !!(IDLE_ALERT[id]?.watch || IDLE_ALERT[id]?.badge)), 'every idle stock kind has an alert (Watch item or nav badge)', IDLE_STOCK_IDS.join(', '));

// Per stock kind: how to make it idle and how to make it used, set directly on a clone.
const cases: Record<IdleStockId, { label: string; idle: (s: GameStateV2) => void; used: (s: GameStateV2) => void }> = {
  chips: {
    label: 'dark chips (delivered, no free rack)',
    idle: (s) => {
      const inv = s.player.finance.ws3.inventory;
      inv.transit = 0;
      inv.ready = chipFit(s).free + 0.3 * s.player.computeOnline; // more than the racks take, well over 5% of the fleet
    },
    used: (s) => {
      s.player.finance.ws3.inventory.transit = 0;
      s.player.finance.ws3.inventory.ready = 0;
    },
  },
  scienceTeams: {
    label: 'science teams with no project',
    idle: (s) => { for (const t of projectTeams(s)) delete t.projectId; },
    used: (s) => { for (const t of projectTeams(s)) t.projectId = t.projectId ?? 'x'; },
  },
  serving: {
    label: 'serving compute no product needs',
    idle: (s) => { s.player.split.serving = Math.min(0.95, Math.max(s.player.split.serving, 0.4) * 2.5); },
    used: (s) => {
      const need = revenueReadout(s).deps.reduce((a, d) => a + d.needH100e, 0);
      s.player.split.serving = need / s.player.computeOnline; // the pool is what the products need: nothing spare
    },
  },
};

for (const id of IDLE_STOCK_IDS) {
  const c = cases[id];
  const u = fresh();
  c.used(u);
  check(!listed(u, id) && !alerting(u, id), `${id}: no alert while the stock is used (${c.label})`, `listed ${listed(u, id)}, alert ${alerting(u, id)}`);
  const s = fresh();
  c.idle(s);
  const first = idleStocks(s).find((x) => x.id === id);
  check(!!first && first.amount > 0, `${id}: the constructed state is idle (${c.label})`, first ? `${first.amount.toFixed(1)} ${first.unit}` : 'not listed');
  check(alerting(s, id), `${id}: the alert shows the day the stock is idle`);
  // The alert goes the day the stock is used again.
  c.used(s);
  check(!listed(s, id) && !alerting(s, id), `${id}: the alert goes when the stock is used again`);
}

// 30 days on with no bot acting: all three stocks idle on one state stay idle and keep their alerts (the alert is a
// function of the state, so this is what "idle for 30 days" can mean: nothing in a quiet month uses the stock).
{
  const s = fresh();
  for (const id of IDLE_STOCK_IDS) cases[id].idle(s);
  const at = (d: number) => IDLE_STOCK_IDS.filter((id) => !listed(s, id) || !alerting(s, id)).map((id) => `${id} day ${d}`);
  const lost = at(0);
  for (let d = 1; d <= IDLE_DAYS; d++) {
    tick(s, { skip: ['endings'] });
    if (d === 15 || d === IDLE_DAYS) lost.push(...at(d));
  }
  check(lost.length === 0, `all three stocks stay idle with their alert across ${IDLE_DAYS} quiet days (checked on day 0, 15, ${IDLE_DAYS})`, lost.join(', '));
}

// Default use of spare training compute (RD-A05b, UB-5c): idle unless the lend policy is on; then it is experiments.
{
  const s = fresh();
  tick(s, { skip: ['endings'] }); // settle: the first tick re-derives the online fleet from the live sites
  const p = s.player;
  p.policies.autoSplit.on = false;
  p.policies.lendTraining = false;
  p.split.training = Math.max(p.split.training, 0.4);
  const spare = idleTrainingShare(s) * poolsOf(s).training;
  check(spare > 1000, 'spare training compute: the constructed state has some', `${Math.round(spare)} H100e`);
  check(lentTrainingH100e(s) === 0 && Math.abs(expPoolH100e(s) - poolsOf(s).experiments) < 1e-6, 'spare training compute: with the lend policy off it stays idle (not in the experiments pool)');
  const before = expPoolH100e(s);
  p.policies.lendTraining = true;
  const lent = lentTrainingH100e(s);
  check(Math.abs(lent - spare) < 1e-6 && Math.abs(expPoolH100e(s) - (before + spare)) < 1e-6, 'spare training compute: with the lend policy on all of it joins the experiments pool', `lent ${Math.round(lent)} of ${Math.round(spare)}`);
  const train0 = poolsOf(s).training;
  tick(s, { skip: ['endings'] });
  check(Math.abs(poolsOf(s).training - train0) / train0 < 0.05 && lentTrainingH100e(s) > 0, 'spare training compute: after a tick it is still lent and the training pool is not reduced');
}

// Default use of safety research engineers: needs, then line experiments; whoever no need takes is listed idle.
{
  const s = fresh();
  const v = safReAllocView(s);
  const used = (x: ReturnType<typeof safReAllocView>) => x.needs.reduce((a, n) => a + n.got, 0);
  check(v.cap > 0, 'safety engineers: the fixture has some', `${v.cap.toFixed(0)} people`);
  check(Math.abs(used(v) + v.idle - v.cap) < 1e-6, 'safety engineers: every person is on a need or listed idle', `used ${used(v).toFixed(1)} + idle ${v.idle.toFixed(1)} vs ${v.cap.toFixed(1)}`);
  const team = s.player.teams.find((t) => t.role === 're' && t.dept === 'saf');
  if (team) {
    for (let i = 0; i < 4; i++) s.player.teams.push({ ...team, id: `${team.id}-x${i}` });
    resetSafAllocation(s);
  }
  const v2 = safReAllocView(s);
  check(!!team && v2.cap > v.cap, 'safety engineers: 4 more engineer teams raise the pool', `${v.cap.toFixed(0)} -> ${v2.cap.toFixed(0)}`);
  check(Math.abs(used(v2) + v2.idle - v2.cap) < 1e-6 && (v2.idle > 1e-9 ? v2.programmes === 0 : v2.programmes > 0), 'safety engineers: the added people are used (line experiments run) or listed idle (none runs), never lost', `programmes ${v2.programmes}, idle ${v2.idle.toFixed(1)}, used ${used(v2).toFixed(1)}`);
}

finish('idle');
