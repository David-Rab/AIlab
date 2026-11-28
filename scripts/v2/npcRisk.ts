// N2b-2 test: NPC race pressure p, misalignment m and incidents (engine/v2/npc/risk.ts; design/npc/NPC-LABS.md section 4, 7).
// One tl-central game, challenger start, 900 days, plus pure checks on copies of its day-0 state.
// Run: npx tsx scripts/v2/npcRisk.ts
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { decimalYear } from '../../src/engine/v2/core/time';
import { KINDS } from '../../src/data/v2/npcLabs';
import { gV0 } from '../../src/engine/v2/models/capability';
import { refGAt } from '../../src/engine/v2/npc/lab';
import { mWorld } from '../../src/engine/v2/npc/misalignment';
import { H0_PER_YEAR, npcM, npcModelRow, npcRacePressure } from '../../src/engine/v2/npc/risk';
import type { GameStateV2, RivalLab } from '../../src/engine/v2/types';
import { check, finish } from './lib';

const clone = (s: GameStateV2): GameStateV2 => JSON.parse(JSON.stringify(s));
const labs = (s: GameStateV2): RivalLab[] => [...s.rivals, s.china.lab];

const s = newGame(defaultSetupV2({ world: 'tl-central', labKind: 'safety', seed: 7, tutorial: false }));
const y0 = decimalYear(s);

/** A copy where lab `id` sits at G `base`, the lab `other` (if any) at G `og`, and everything else (labs and the player's
 *  versions) 6 OOM behind. */
function arrange(id: string, base: number, other?: string, og = 0): GameStateV2 {
  const c = clone(s);
  for (const r of labs(c)) {
    r.internal.G = r.core.id === id ? base : r.core.id === other ? og : base - 6;
    if (r.publicModel) r.publicModel.G = r.internal.G - 0.01;
  }
  for (const v of c.player.models.versions) v.G = base - 6;
  return c;
}

// (1) race pressure
{
  const subj = s.rivals.find((r) => r.npc?.kind === 'racer')!.core.id;
  const rival = s.rivals.find((r) => r.core.id !== subj)!.core.id;
  const base = refGAt(s, y0);
  const iso = arrange(subj, base);
  check(npcRacePressure(iso, subj) === 0, '(1) p = 0 for an isolated lab', `p ${npcRacePressure(iso, subj)}`);
  const at = (mo: number) => npcRacePressure(arrange(subj, base, rival, refGAt(s, y0 - mo / 12)), subj);
  const ps = [3, 2, 1.5, 0.5, 0.05].map(at);
  console.log('     p with a competitor 3 / 2 / 1.5 / 0.5 / 0.05 months behind:', ps.map((x) => x.toFixed(2)).join(' '));
  check(ps[0] < 0.05 && ps[4] > 0.98 && ps.every((x, i) => i === 0 || x >= ps[i - 1] - 1e-9), '(1) p is 0 at 3 months and rises to 1 as a competitor closes within days');
  const pa = npcRacePressure(arrange(subj, base, rival, refGAt(s, y0 + 1 / 12)), subj);
  check(Math.abs(pa - 2 / 3) < 0.05, '(1) a competitor one month ahead gives p = 2/3 (ahead counts as behind)', `p ${pa.toFixed(3)}`);
}

// (2) m
{
  const g0 = gV0(s.hidden.timeline);
  const gs = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6].map((d) => g0 + d);
  const m = (kind: keyof typeof KINDS, g: number, p: number) => npcM(s, g, KINDS[kind].safetyEmphasis, KINDS[kind].raceResponse, p);
  let inRange = true;
  for (const k of ['leader', 'safety', 'racer', 'china'] as const) for (const g of gs) for (const p of [0, 1]) { const x = m(k, g, p); if (!(x >= 0 && x <= 1)) inRange = false; }
  check(inRange, '(2) m in [0, 1] for every kind, G grid and p');
  check(m('racer', g0 + 5, 0) > m('racer', g0, 0) && m('leader', g0 + 5, 0) > m('leader', g0, 0), '(2) m rises with G (V0 + 5 OOM over V0)', `racer ${m('racer', g0, 0).toFixed(3)} -> ${m('racer', g0 + 5, 0).toFixed(3)}`);
  let better = true;
  for (const g of gs) for (const p of [0, 0.5, 1]) if (!(m('safety', g, p) <= m('racer', g, p))) better = false;
  check(better, '(2) the safety-first kind has m at or below the founder racer at equal G and p');
  check(m('racer', g0 + 3, 1) > m('racer', g0 + 3, 0) && m('safety', g0 + 3, 1) > m('safety', g0 + 3, 0), '(2) m rises with p for the high race-response kinds', `racer ${m('racer', g0 + 3, 0).toFixed(3)} -> ${m('racer', g0 + 3, 1).toFixed(3)}; china (race response 0) ${m('china', g0 + 3, 0).toFixed(3)} = ${m('china', g0 + 3, 1).toFixed(3)}`);
  check(m('racer', g0 + 3, 1) <= mWorld(s, g0 + 3) + 1e-12, '(2) m never above M_world(G)');
}

// (3) the game
const rec = new Map<string, { m: number[]; p: number[]; rate: number[] }>();
let err: unknown, bad = 0;
try {
  while (s.time.day < 900) {
    tick(s, { skip: ['endings'] });
    for (const r of labs(s)) {
      if (r.core.status !== 'active' || !r.npc) continue;
      const e = rec.get(r.core.id) ?? rec.set(r.core.id, { m: [], p: [], rate: [] }).get(r.core.id)!;
      e.m.push(r.npc.m); e.p.push(r.npc.p);
      if (!(r.npc.m >= 0 && r.npc.m <= 1 && r.npc.p >= 0 && r.npc.p <= 1)) bad++;
      e.rate.push(npcModelRow(s, r.internal.G, r.npc.m, KINDS[r.npc.kind].safetyEmphasis).h * 365.25);
    }
  }
} catch (e) { err = e; console.log(e); }
check(!err && s.time.day === 900, `(3) tl-central game ran ${s.time.day} days without errors`);
check(bad === 0, '(3) stored m and p in [0, 1] every day');
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
let tot = 0, n = 0;
for (const r of labs(s)) {
  const e = rec.get(r.core.id);
  if (!e) continue;
  const first = mean(e.rate.slice(0, 90)), last = mean(e.rate.slice(-90));
  tot += first; n++;
  console.log(`     ${r.core.name.padEnd(12)} safety ${KINDS[r.npc!.kind].safetyEmphasis.toFixed(2)}  m ${e.m[0].toFixed(3)} -> ${e.m[e.m.length - 1].toFixed(3)}  mean p ${mean(e.p).toFixed(2)}  model incidents/yr: first 90 d ${first.toFixed(3)}, last 90 d ${last.toFixed(3)}`);
}
const rate0 = tot / n;
console.log(`     mean model-incident rate per lab-year over the first 90 days: ${rate0.toFixed(4)} (h0 ${H0_PER_YEAR})`);
check(rate0 > H0_PER_YEAR / 2 && rate0 < H0_PER_YEAR * 2, '(3) start incident rate per lab-year within a factor of 2 of h0', `${rate0.toFixed(4)} vs ${H0_PER_YEAR}`);
console.log(`     disclosed NPC incidents over 900 days (the last 60 are kept): ${s.rivalIncidents.length}; known per lab: ${labs(s).map((r) => `${r.core.name} ${r.intel.knownIncidents.length}`).join(', ')}`);
finish('npcRisk');
