// NPC labs' daily behaviour: race pressure, releases, incidents, and the quarterly money display and chip orders
// (V2-SPEC §3.10.3; design/npc/NPC-LABS.md). Owner: WS4. An NPC lab's capability is its lag behind the reference
// frontier (npc/lab.ts); this file owns the daily step around it.
//
// Bug fixes from v1 (§3.10.3): labs with status !== 'active' are never chosen as subjects or named (activeRivals).
import type { NpcKindId } from '../../../data/v2/npcLabs';
import { clamp } from '../../rng';
import { frontierGPerYear, gV0, lagDays, PACE_WINDOW_DAYS } from '../models/capability';
import { CHINA_ID, activeRivals } from '../models/labs';
import { drawSeverity, type HazardRow } from '../safety/incidents';
import { placeLabOrder, RIVAL_GROWTH_Q } from '../compute/market';
import { labMarketRevenue } from '../worldfx/revenue';
import { worldMix, type WorldMix } from '../worldfx/mix';
import { rivalMoneyQ } from '../finance/rivalFinance';
import type { EngineSystem, GameStateV2, LabId, RivalLab, SafetyPosture, SystemCtx } from '../types';
import * as shock from '../npc/shocks';
import { rivalLineupStep, rivalToolStep } from '../npc/market';
import { chinaAccessDaily } from '../npc/china';
import { chinaSafetyConcern } from '../world/chinagov';
import { reportingLaw } from '../../../data/v2/laws';
import { cPlanQ, growLabStaff, labReferenceSplit, npcCapabilityDay, persOf } from '../npc/lab';
import { npcM, npcMisOf, npcModelRow, npcRacePressure } from '../npc/risk';

export { activeRivals } from '../models/labs';

/** Start finance by kind (the cast has no cash: cash, and revenue / valuation / raised when it has none). `valuation` > 0 marks a
 *  private lab (FIN5b: marked from the story split at the start, finance/rivalFinance.ts); `raised` = equity its investors had put
 *  in by mid-2025 (Anthropic ≈ $15B, xAI ≈ $22B, SSI $3B, OpenAI ≈ $60B with SoftBank's first close) [R21, approx.]. */
export const FIN: Partial<Record<NpcKindId, { cash: number; revenueRun: number; valuation: number; raised: number }>> = {
  safety: { cash: 15, revenueRun: 5, valuation: 180, raised: 15 },
  bigtech: { cash: 60, revenueRun: 8, valuation: 0, raised: 0 }, // in-house lab funded by the parent's capex
  racer: { cash: 12, revenueRun: 1, valuation: 120, raised: 22 },
  openweights: { cash: 40, revenueRun: 0.5, valuation: 0, raised: 0 },
  upstart: { cash: 4, revenueRun: 0.2, valuation: 30, raised: 3 },
  leader: { cash: 40, revenueRun: 12, valuation: 300, raised: 60 }, // the frontier leader at the start (STRUCTURE §4.8 table)
};

/** Rival misuse hazard grows from MISUSE_FROM_OOM above V0 at MISUSE_PER_OOM per OOM per day (RD-L05: was 1e-4 per display
 *  level from L 7: L 7 = 1.0 OOM on ai2027, 2.0 levels per OOM there). */
const MISUSE_FROM_OOM = 1.0;
const MISUSE_PER_OOM = 2e-4;

/** Non-player lab by id (rival or China), any status. */
export function labOf(s: GameStateV2, id: LabId): RivalLab | undefined {
  return id === 'china' ? s.china.lab : s.rivals.find((r) => r.core.id === id);
}

/** Effective (dynamic) posture = hidden posture + the lab's deltas (moving goalposts, joint evals); China's safety
 *  investment follows its safety concern (§3.10.4; world/chinagov.ts chinaSafetyConcern). Hidden: engine use only. */
export function postureOf(s: GameStateV2, lab: LabId): SafetyPosture {
  const base = lab === 'china' ? { ...s.hidden.chinaPosture, safetyInvestment: 0.1 + (0.4 * chinaSafetyConcern(s)) / 100 } : s.hidden.rivalPostures[lab];
  const d = labOf(s, lab)?.npc.postureDelta;
  if (!base) return { safetyInvestment: 0.3, evalRigor: 0.3, externalAccess: 0.3, disclosureRate: 0.3, raceRelaxation: 0.5, bindingness: 0.3 };
  if (!d) return base;
  const out = { ...base };
  for (const k of Object.keys(d) as (keyof SafetyPosture)[]) out[k] = clamp(out[k] + (d[k] ?? 0), 0, 1);
  return out;
}

export function addPosture(s: GameStateV2, lab: LabId, key: keyof SafetyPosture, d: number) {
  const npc = labOf(s, lab)?.npc;
  if (!npc) return;
  const pd = (npc.postureDelta ??= {});
  pd[key] = (pd[key] ?? 0) + d;
}

/** Race pressure (N2b-2, NPC-LABS §4): clamp(1 − months to the nearest competitor, ahead or behind, ÷ 3, 0, 1) (npc/risk.ts). */
export const racePressure = (s: GameStateV2, lab: LabId): number => npcRacePressure(s, lab);

/** Hidden m of a non-player lab's internal frontier (stored daily on its npc state, npc/risk.ts). */
export const rivalMis = (r: RivalLab) => npcMisOf(r);

/** One non-player lab's daily behaviour (N2b-1, design/npc/NPC-LABS.md §4): its capability day (npc/lab.ts: the lag
 *  relaxes to its target, the internal model follows the reference frontier, releases on the shared cadence), its
 *  lineup and tools, then pressure, traits and incidents as before (N2b-2 replaces those). */
export function labDaily(s: GameStateV2, ctx: SystemCtx, r: RivalLab) {
  const id = r.core.id;
  const day = ctx.day;
  const rng = ctx.rng(r.core.kind === 'china' ? 'china' : 'rivals');
  const wl = s.hidden.timeline;

  // Split and staff (readers: the chip market's pools, security, events), through WS1's lab API as before.
  labReferenceSplit(s, r);
  growLabStaff(s, r);
  shock.ipAccess(s, r); // FIN4b: a partner's IP access to the player's models (N6: npc/shocks.ts, a share of the way to the licensed model a day)

  // Pressure (§3.10.3) and its persistence (moving-goalposts trigger).
  r.pressure = racePressure(s, id);
  r.npc.p = r.pressure;
  r.pressureDays = r.pressure > 0.6 ? r.pressureDays + 1 : 0;

  // N2b-1: the capability day. On a release the public model is replaced; m is recomputed daily below (npc/risk.ts). Openness: the kind's rule
  // (npc/lab.ts opensRelease); a 'partial' lab opens the model its release replaces.
  const { released, prev } = npcCapabilityDay(s, r, day);
  if (released && r.publicModel) {
    const pub = r.publicModel;
    if (pub.openWeights) openWeightsReleased(s, ctx, id, pub.G);
    if (prev && r.npc && persOf(r.npc).openness.mode === 'partial' && !prev.openWeights) {
      prev.openWeights = true;
      openWeightsReleased(s, ctx, id, prev.G);
    }
    if (id === CHINA_ID) shock.distill(s); // N6: China's distillation of the player's products, a pull once per release
    rivalLineupStep(wl, r, day, true, prev);
  } else rivalLineupStep(wl, r, day, false);
  // N4: tools by the public model's horizon, focus and build time (npc/market.ts).
  rivalToolStep(s, r, day);

  // N2b-2 (NPC-LABS §4, §7): m = M_world(G) x (1 - 0.5 x safety emphasis x (1 - race response x p)), then the incidents:
  // model incidents at H0 x (m / M_world(G(V0))) x (1 - 0.8 x safety emphasis) a year on one generic row, plus a misuse
  // hazard like the player's (standard safeguards; safety emphasis where eval rigor stood); visibility = disclosure +
  // 0.5 x access + leak, statutory floor (research/17 §1.6.5 #4).
  const p = postureOf(s, id);
  r.npc.m = npcM(s, r.internal.G, p.safetyInvestment, p.raceRelaxation, r.npc.p);
  const dep = r.publicModel ?? r.internal;
  const rows: HazardRow[] = [npcModelRow(s, r.internal.G, r.npc.m, p.safetyInvestment)];
  const misuseH = MISUSE_PER_OOM * Math.max(0, dep.G - gV0(s.hidden.timeline) - MISUSE_FROM_OOM) * (dep.openWeights ? 1 : 0.5) * (1 - 0.3) * (1 - 0.6 * p.safetyInvestment);
  if (misuseH > 0) rows.push({ source: 'misuse', apparent: 'misuse', h: misuseH, sev: 3, disposition: 1, capability: 1, opportunity: 1, block: 0 });
  const H = rows.reduce((a, x) => a + x.h, 0);
  if (H > 0 && rng.chance(Math.min(0.5, H))) {
    const row = rng.weighted(rows.map((x) => ({ item: x, weight: x.h })));
    const misuse = row.source === 'misuse';
    const sev = misuse ? clamp(3 + Math.floor(rng.float() * 3), 1, 5) : drawSeverity(row, rng.float()); // misuse: v2's 3–5
    const floor = r.core.kind === 'rival' && reportingLaw(s) && sev >= 3 ? 0.6 : 0;
    const vis = Math.max(floor, clamp(p.disclosureRate + 0.5 * p.externalAccess + 0.1, 0, 1) * (sev >= 4 ? 1 : 0.6));
    if (rng.chance(vis)) {
      s.rivalIncidents.push({ lab: id, day, severity: sev, misuse });
      if (s.rivalIncidents.length > 60) s.rivalIncidents.shift();
      r.intel.knownIncidents.push(`${day}:${sev}${misuse ? 'm' : ''}`);
      if (r.intel.knownIncidents.length > 20) r.intel.knownIncidents.shift();
      ctx.log(r.core.kind === 'china' ? 'china' : 'rival', `${r.core.name}: ${misuse ? 'misuse' : 'model'} incident (severity ${sev}) made public.`, sev >= 3 ? 3 : 2, id);
    }
  }
}

/** A recipe increment `dG` (OOM) in days of lab `id`'s own progress at its frontier-G slope (PACE_WINDOW_DAYS): the
 *  previews' unit (the player's own progress; NPC labs' shocks are in days of lag, npc/shocks.ts). */
export const ownProgressDays = (s: GameStateV2, id: LabId, dG: number) => (dG * 365) / frontierGPerYear(s, id, PACE_WINDOW_DAYS);

/** Open weights released by lab `id` at effective compute G: the world's open frontier rises and China (only China absorbs
 *  open weights, never its own) closes part of its know-how gap to them (N6: npc/shocks.ts openWeights; C6 previews the same move). */
export function openWeightsReleased(s: GameStateV2, ctx: SystemCtx, id: LabId, G: number) {
  const k = s.knowledge;
  if (G <= k.openWeightsG) return;
  for (const m of shock.openWeightsMoves(s, id, G)) {
    m.lab.npc.d -= m.days;
    ctx.cause('china.lag', -m.days, 'open weights absorbed', id);
  }
  k.openWeightsG = G;
  ctx.log('world', `New open-weights frontier model released (${id === 'player' ? 'by you' : (labOf(s, id)?.core.name ?? id)}).`, 2);
}

/** Merge or retire a rival (never referenced again once inactive, §3.10.3). `text` replaces the default log line. */
export function deactivateRival(s: GameStateV2, ctx: SystemCtx, lab: LabId, status: 'merged' | 'bankrupt' | 'nationalized' | 'shutdown', into?: LabId, text?: string) {
  const r = s.rivals.find((x) => x.core.id === lab);
  if (!r || r.core.status !== 'active') return;
  r.core.status = status;
  if (into) r.core.mergedInto = into;
  // Drop any pending decision or request about this lab (E2: never name inactive labs).
  s.events.pending = s.events.pending.filter((p) => p.data.lab !== lab);
  s.events.requests = s.events.requests.filter((q) => q.data.lab !== lab);
  ctx.log('rival', text ?? (status === 'merged' ? `${r.core.name} is absorbed${into ? ` into ${into === 'player' ? s.player.name : (labOf(s, into)?.core.name ?? 'another lab')}` : ''}.` : `${r.core.name} shuts down its frontier program.`), 3);
}

/** Share of the gap to market revenue a rival closes each quarter [D, M4]. */
export const RIVAL_REVENUE_TRACK = 0.5;

/** Quarterly rivals (geoQ): revenue, then money (finance/rivalFinance.ts: the bust's distress → E32 offer →
 *  license-and-hire by big tech or bankruptcy; money is otherwise display), then chip orders. */
export function rivalFinanceQ(s: GameStateV2, ctx: SystemCtx) {
  // P2: one world mix for all labs (nothing the mix reads changes in this loop until a lab leaves the market).
  let mix: WorldMix | undefined;
  for (const r of activeRivals(s)) {
    const f = r.finance;
    const lead = lagDays(s, r.core.id, 'player');
    // Revenue (M4): half-way each quarter toward what WS5's market pays this lab's public model (demand-side share of
    // sector and consumer spend), so the private-lab sector run-rate — and with it the investor pool (R15 §1.4) —
    // tracks the market [D]. Labs without a priced public model keep the archetype growth rule.
    const mkt = labMarketRevenue(s, r.core.id, (mix ??= worldMix(s)));
    if (mkt > 0) f.revenueRun += RIVAL_REVENUE_TRACK * (mkt - f.revenueRun);
    else f.revenueRun *= 1.2 + 0.1 * clamp(-lead / 180, -1, 1);
    rivalMoneyQ(s, ctx, r); // N8b: only the bust's distress and exit (finance/rivalFinance.ts)
    if (r.core.status !== 'active') mix = undefined; // FINM: it left the market (license-and-hire or bankruptcy)
    if (r.core.status !== 'active') continue;
    // N8b: chip orders top compute up to next quarter's plan (start compute × 2.25 a year, one rate for every lab), net of
    // what is already on order, through the chip market shared with everyone. Money never limits an NPC lab's orders; a
    // supply shortfall leaves it behind the plan, and the next quarter's order is larger by the gap.
    labOrderQ(s, r, r.npc ? cPlanQ(s, r, 1) : r.core.computeOnline * (1 + RIVAL_GROWTH_Q));
  }
  // W6: China's lab orders by the same rule, its plan × its chip access (export controls, the national collective).
  const cn = s.china.lab;
  if (cn.core.status === 'active') labOrderQ(s, cn, cPlanQ(s, cn, 1) * s.china.access);
}

/** A lab's quarterly chip order: up to `plan`, net of what is online and already on order. */
function labOrderQ(s: GameStateV2, r: RivalLab, plan: number) {
  const pending = s.market.ws3.labOrders.reduce((t, o) => (o.lab === r.core.id ? t + Math.max(0, o.qty - o.delivered) : t), 0);
  placeLabOrder(s, r.core.id, Math.max(0, plan - r.core.computeOnline - pending), 1, 1.2);
}

/** Quarterly moving-goalposts roll (research/17 §1.6.5 #3): pressure > 0.6 for 90 d → P = raceRelaxation·0.3. */
export function goalpostsQ(s: GameStateV2, ctx: SystemCtx) {
  const rng = ctx.rng('rivals');
  for (const r of activeRivals(s)) {
    if (r.pressureDays < 90) continue;
    if (!rng.chance(postureOf(s, r.core.id).raceRelaxation * 0.3)) continue;
    addPosture(s, r.core.id, 'bindingness', -0.1);
    r.npc.goalposts = (r.npc.goalposts ?? 0) + 1;
    ctx.headline(`goalposts-${r.core.id}`, `${r.core.name} publishes a weaker safety framework (v${1 + r.npc.goalposts}).`);
    ctx.log('rival', `${r.core.name} relaxes its safety framework under race pressure.`, 2, r.core.id);
  }
}

/** npcQ (443, quarterly): rival revenue, money and chip orders, then the moving-goalposts roll. */
export const npcQSystem: EngineSystem = {
  id: 'npcQ', owner: 'WS4', cadence: 'quarterly', order: 443, system: 'relations',
  run(s, ctx) {
    rivalFinanceQ(s, ctx);
    goalpostsQ(s, ctx);
  },
};

/** rivalsChina (100, daily): their runs, releases, posture pressure and incidents; China's chip access. */
export const rivalsChinaSystem: EngineSystem = {
  id: 'rivalsChina', owner: 'WS4', cadence: 'daily', order: 100, system: 'relations',
  run(s, ctx) {
    for (const r of activeRivals(s)) labDaily(s, ctx, r);
    if (s.china.lab.core.status === 'active') labDaily(s, ctx, s.china.lab);
    chinaAccessDaily(s);
  },
};
