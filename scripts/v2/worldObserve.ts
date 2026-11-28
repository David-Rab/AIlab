// W2 test: the shared outside-world inputs (src/engine/v2/world/observe.ts) on constructed cases over the fixture states.
//   npx tsx scripts/v2/worldObserve.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, stateHash } from '../../src/engine/v2/core/save';
import { attention, frontier, govMilestones, incidentHeat, incidentHeatOf, publicMilestones, usLeadOverChinaMonths } from '../../src/engine/v2/world/observe';
import { worldReadout } from '../../src/engine/v2/world/readout';
import { FIXTURE_DIR, check, finish } from './lib';
import type { GameStateV2, Incident } from '../../src/engine/v2/types';

const load = (n: string): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, n), 'utf8'));
const FILES = ['day0.json', 'day400.json', 'day900.json', 'start-spinout-day400.json'];
const f2 = (x: number) => x.toFixed(2);

// Attention in every fixture (printed for the record).
const att: Record<string, Record<string, number>> = {};
for (const f of FILES) {
  const s = load(f);
  const fr = frontier(s);
  const ids = ['player', ...s.rivals.map((r) => r.core.id), ...(s.china.lab.core.status === 'active' ? ['china'] : [])];
  att[f] = Object.fromEntries(ids.map((id) => [id, attention(s, id, fr)]));
  console.log(`${f} day ${s.time.day}: frontier ${fr.lab} | ` + ids.map((id) => `${id} ${f2(att[f][id])} (behind ${fr.behindMonths[id] === undefined ? '-' : f2(fr.behindMonths[id]!)})`).join(', '));
}

// 1. Day 0 leader start: the player holds the frontier, so its attention is 1.
check(frontier(load('day0.json')).lab === 'player' && att['day0.json'].player === 1, 'day 0: the player holds the public frontier, attention 1', `${frontier(load('day0.json')).lab} ${att['day0.json'].player}`);

// 2. Spin-out start: the player is far behind (attention < 0.5) and some NPC lab has attention 1.
const sp = att['start-spinout-day400.json'];
check(sp.player < 0.5, 'spinout day 400: the player attention < 0.5', f2(sp.player));
check(Object.entries(sp).some(([id, a]) => id !== 'player' && a === 1), 'spinout day 400: some NPC lab has attention 1', JSON.stringify(sp));

// 3. Government milestones follow the briefing: an internal milestone not yet deployed.
{
  const s = load('day400.json');
  const pub = publicMilestones(s);
  const i = [0, 1, 2, 3, 4, 5, 6].find((k) => pub[k] === undefined)!;
  s.player.milestoneDays[i as 0] = s.time.day - 200;
  s.player.policies.govBriefing = 0;
  check(govMilestones(s)[i] === undefined, `briefing 0: internal milestone ${i} not seen by the government`);
  s.player.policies.govBriefing = 1;
  check(govMilestones(s)[i]?.day === s.time.day - 110, 'briefing 1: seen 90 days after reached', JSON.stringify(govMilestones(s)[i]));
  s.player.milestoneDays[i as 0] = s.time.day - 30;
  check(govMilestones(s)[i] === undefined, 'briefing 1: not yet seen 30 days after reached');
  s.player.policies.govBriefing = 2;
  check(govMilestones(s)[i]?.day === s.time.day - 30 && govMilestones(s)[i]?.lab === 'player', 'briefing 2: seen from the day reached', JSON.stringify(govMilestones(s)[i]));
  s.player.policies.govBriefing = 0;
  check(govMilestones(s)[i] === undefined, 'briefing 0 again: not seen');
  s.commitments.push({ id: 'Ctest', kind: 'external', title: 'test', condition: { predicate: 'preDeployTesting', params: {} }, signedDay: 0, status: 'live', amendments: 0 } as unknown as GameStateV2['commitments'][number]);
  check(govMilestones(s)[i]?.day === s.time.day - 30, 'a live pre-deploy-testing commitment: seen from the day reached');
  check(publicMilestones(s)[i] === undefined, 'the public milestones never include the internal one');
}

// 4. An incident 182 days old weighs half a new one.
{
  const s = load('day400.json');
  const base = incidentHeatOf(s, 'player');
  const mk = (day: number, id: string): Incident => ({ id, day, labId: 'player', versionId: 'x', trueSource: 'misuse', apparent: 'misuse', severity: 4, exposure: 'public', status: 'disclosed', responses: [] });
  s.player.safety.incidents.push(mk(s.time.day, 'Inew'));
  const fresh = incidentHeatOf(s, 'player') - base;
  s.player.safety.incidents.pop();
  s.player.safety.incidents.push(mk(s.time.day - 182, 'Iold'));
  const old = incidentHeatOf(s, 'player') - base;
  check(Math.abs(fresh - 4) < 1e-9 && Math.abs(old / fresh - 0.5) < 1e-9, 'an incident 182 days old weighs half a new one', `${fresh} ${old}`);
  s.player.safety.incidents[s.player.safety.incidents.length - 1].status = 'open';
  check(Math.abs(incidentHeatOf(s, 'player') - base) < 1e-9, 'an undisclosed incident does not count');
  s.rivalIncidents = [{ lab: s.rivals[0].core.id, day: s.time.day, severity: 3, misuse: false }];
  check(Math.abs(incidentHeatOf(s, s.rivals[0].core.id) - 3) < 1e-9 && Math.abs(incidentHeat(s) - incidentHeatOf(s, 'player') - 3) < 1e-9, 'an NPC lab incident counts for its lab and the world');
}

// 5. Purity: the same value twice, and the state unchanged.
for (const f of FILES) {
  const s = load(f);
  const h0 = stateHash(s);
  const run = () => JSON.stringify([publicMilestones(s), govMilestones(s), frontier(s), usLeadOverChinaMonths(s), incidentHeat(s), incidentHeatOf(s, 'player'), s.rivals.map((r) => attention(s, r.core.id)), attention(s, 'player'), attention(s, 'china'), worldReadout(s)]);
  const a = run();
  const b = run();
  check(a === b, `${f}: every selector returns the same value twice`);
  check(stateHash(s) === h0, `${f}: the selectors leave the state unchanged`);
  const w = worldReadout(s);
  console.log(`${f}: public milestones ${JSON.stringify(w.observe.publicMilestones)}; gov ${Object.keys(w.observe.govMilestones).length}; heat ${w.observe.incidentHeat}; US lead over China ${w.observe.usLeadOverChinaMonths}`);
}
finish('worldObserve');
