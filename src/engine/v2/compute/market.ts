// Chip market: supply pipelines, clearing, prices, rationing, deliveries, geo shocks (V2-SPEC §3.8; research/15 §1.2).
// Owner: WS3. Quarterly. Units: H100e, prices $K per H100e, money $B.
import { COMPONENTS, EXPORT_POLICY, MARKET } from '../../../data/v2/deals';
import { refCapCompute } from '../../../data/world';
import { asV1World } from '../world/calibration';
import { decimalYear } from '../core/time';
import type { BaselineId, ChipMarket, EngineSystem, GameStateV2, LabId, SystemCtx } from '../types';
import { defaultMarketWS3, ensureWs3, type LabOrder } from '../finance/ext';
import { qOf, yearStats, bookCash } from '../finance/ledger';
import { LEADER_ID } from '../models/labs';

type Comp = keyof typeof COMPONENTS;
const COMPS: Comp[] = ['pkg', 'hbm', 'wafer'];

/** Pre-ordered capacity at the start: arrivals that keep each component on its recent growth path [D]. */
const START_GROWTH: Record<Comp, number> = { pkg: 2.2, hbm: 2.0, wafer: 1.35 };
/** Base cost c_t at Q3 2025 ($K / H100e) and supplier markup μ (Nvidia GM 72–75%) [R15]. */
export const C0 = 6.0;
export const MU = 3.8;
/** Forward-booking share of the exogenous buyers' next-4-quarter demand (LTAs, supply obligations) [fit]. */
const FWD_SHARE = 0.95;
/** Exogenous demand price elasticity on (1+π) [D]. */
const EXO_ELASTICITY = 1.5;

/** Market at Q3 2025 (§3.8 start table, back-cast from R15 Q4-2026 at ≈2.2×/yr). */
export function initialMarket(baseline: BaselineId): ChipMarket {
  const K = { pkg: 3.0e6, hbm: 3.2e6, wafer: 8.6e6 };
  const pipe = {} as ChipMarket['pipe'];
  for (const c of COMPS) {
    const L = COMPONENTS[c].L;
    const r = Math.pow(START_GROWTH[c], 0.25);
    pipe[c] = Array.from({ length: L }, (_, k) => K[c] * (Math.pow(r, k + 1) - Math.pow(r, k)));
  }
  const cost = C0;
  const listPrice = 23;
  const premium = listPrice / (cost * MU) - 1;
  const m: ChipMarket = {
    Kpkg: K.pkg, Khbm: K.hbm, Kwafer: K.wafer,
    pipe,
    supplyQ: Math.min(K.pkg, K.hbm, K.wafer),
    binding: 'packaging',
    cost, markup: MU, premium, listPrice,
    rental: 0,
    backlog: 1.5,
    cumOrders8q: Array(8).fill(3.0e6),
    geoTW: 0.93, disruptTW: 0, disruptKR: 0,
    exportPolicy: baseline === 'classic' ? 'strict' : 'caseByCase',
    demandQ: 3.0e6,
    exoDemandQ: 2.2e6,
    ws3: defaultMarketWS3(),
  };
  m.ws3.supply8q = Array(8).fill(3.0e6);
  m.ws3.stock = baseline === 'reality' ? 14e6 : 13e6; // v1 BASELINES globalCompute (R11 #18)
  m.rental = spotRental(rentalBase(listPrice, 0.93), 1);
  return m;
}

// ───────────────────────────── Prices ─────────────────────────────

/** Owned TCO per H100e-year ($K): chips+network over 4 y, facility over 14 y, power, O&M 3%, cost of capital [R15 §1.2]. */
export function tcoPerYear(listPrice: number, kW: number): number {
  const chips = listPrice * (1 + MARKET.networkShare);
  const facility = 10 * kW; // $10B per GW facility = $10K per kW
  const power = (kW * 8760 * 0.083) / 1000;
  return chips / MARKET.chipLifeY + facility / MARKET.facilityLifeY + power + 0.03 * (chips + facility) + (MARKET.wacc * (chips + facility)) / 2;
}
/** r_base: rental $/H100e-hour = owned TCO × 1.6 / 8760 [R15]. */
export const rentalBase = (listPrice: number, kW: number) => (tcoPerYear(listPrice, kW) * MARKET.cloudMult * 1000) / 8760;
/** Spot rental r_t = r_base · (D/S)^0.8 [R15]. */
export const spotRental = (rBase: number, ds: number) => rBase * Math.pow(Math.max(0.05, ds), MARKET.spotElasticity);
/** Cloud contract price, $K per H100e-year (1.6 × owned TCO) [R15]. */
export const cloudPricePerYear = (s: GameStateV2) => tcoPerYear(s.market.listPrice, s.power.kWPerH100e) * MARKET.cloudMult;
/** Spot order price $K: P_t × (1 + 0.5π) [R15]. */
export const spotPrice = (m: ChipMarket) => m.listPrice * (1 + MARKET.spotPremiumShare * Math.max(0, m.premium));
/** Implied supplier gross margin 1 − c/P (test F6). */
export const impliedMargin = (m: ChipMarket) => 1 - m.cost / m.listPrice;
/** π update [R15]: π' = clamp(π + 0.5(D/S − 1) − 0.25π, −0.25, 1.5). */
export const nextPremium = (pi: number, ds: number) => Math.min(MARKET.premiumHi, Math.max(MARKET.premiumLo, pi + 0.5 * (ds - 1) - 0.25 * pi));

// ───────────────────────────── Demand ─────────────────────────────

/** Reference compute path of the leading lab (refTotal = refCapCompute / 0.68, §3.1.1). */
export function refTotalAt(s: GameStateV2, years: number): number {
  return refCapCompute(asV1World(s.hidden.timeline), years) / 0.68;
}

/** Reference global production per quarter (H100e): Epoch 2.2×/yr through 2026, ~1.95× in 2027 as HBM caps growth at
 *  ≤ 2×/yr, then 1.5×/yr as leading-edge wafers bind (R15 'wafers bind around 2028'; world.ts globalCompute 1.5×)
 *  [R15 §1.2 targets, R11 #18]. q = quarters since Q3 2025. */
export function globalRefQ(q: number): number {
  const a = Math.min(q, 6);
  const b = Math.max(0, Math.min(q, 10) - 6);
  const c = Math.max(0, q - 10);
  return 3.0e6 * Math.pow(2.2, a / 4) * Math.pow(1.95, b / 4) * Math.pow(1.5, c / 4);
}

/** Default (reference) demand per quarter of a non-player lab that WS4 does not manage [D]: fleet grows at the global
 *  pace (2.25×/yr, AI 2027 compute forecast). */
/** Default quarterly compute growth of a US rival (2.25×/yr); WS4 scales its chip orders from it. */
export const RIVAL_GROWTH_Q = Math.pow(2.25, 0.25) - 1;

/** Exogenous demand (hyperscalers, enterprise, sovereign buyers not modelled as labs) for quarter q (§3.8). The
 *  reference player and default rivals are netted out, so with reference labs total demand ≈ globalRefQ.
 *  With the leader lab (setup.leaderLab, R2) active, the reference lab's growth is the leader's: it stays in the
 *  exogenous demand (the leader places no orders) and the player's orders are extra demand. */
export function exoRefQ(s: GameStateV2, q: number): number {
  const y = q / 4;
  const leaderActive = s.rivals.some((r) => r.core.id === LEADER_ID && r.core.status === 'active');
  const playerRef = leaderActive ? 0 : Math.max(0, refTotalAt(s, y + 0.25) - refTotalAt(s, y));
  let rivals = 0;
  for (const r of s.rivals) if (r.core.status === 'active' && r.core.id !== LEADER_ID) rivals += r.core.computeOnline * RIVAL_GROWTH_Q;
  return Math.max(0.2 * globalRefQ(q), globalRefQ(q) - playerRef - rivals);
}

function exoDemand(s: GameStateV2, q: number): number {
  const m = s.market;
  const hype = 0.85 + 0.15 * s.capital.hype; // demand scales (mildly) with hype [D]
  const bust = s.capital.busted && s.capital.busted.recoverDay > s.time.day ? 0.6 : 1; // bust: −40% (§3.8)
  return exoRefQ(s, q) * m.ws3.exoMult * hype * bust * Math.pow(1 + Math.max(0, m.premium), -EXO_ELASTICITY);
}

// ───────────────────────────── Hooks for other workstreams ─────────────────────────────

/** WS4: place a chip order for a non-player lab (rivals, China). Marks the lab as managed (default demand off). */
export function placeLabOrder(s: GameStateV2, lab: LabId, qty: number, quartersAhead = 2, weight = 1): void {
  ensureWs3(s);
  const w = s.market.ws3;
  if (!w.managedLabs.includes(lab)) w.managedLabs.push(lab);
  w.labOrders.push({ id: `LO${s.time.day}-${w.labOrders.length}`, lab, qty, dueQ: qOf(s) + quartersAhead, weight, delivered: 0 });
}

/** Demand shock: multiply exogenous demand by `mult` from now, decaying back toward 1 by `decay` per quarter (tests F4/F5,
 *  events such as a sector boom). */
export function demandShock(s: GameStateV2, mult: number, decay = 0): void {
  ensureWs3(s);
  s.market.ws3.exoMult *= mult;
  s.market.ws3.exoMultDecay = decay;
}

/** Taiwan quarantine/blockade: disrupt_TW = severity for `quarters`; list premium jumps to the cap; chips in transit
 *  are lost (§3.8, R15). WS4 may call this for scenario-driven blockades (China ladder). */
export function taiwanShock(s: GameStateV2, ctx: SystemCtx, severity = 0.9, quarters = 6): void {
  ensureWs3(s);
  const m = s.market;
  m.disruptTW = Math.max(m.disruptTW, severity);
  m.ws3.twQ = Math.max(m.ws3.twQ, quarters);
  m.premium = MARKET.premiumHi;
  const inv = s.player.finance.ws3.inventory;
  if (inv.transit > 0) {
    const lost = inv.transit;
    const bookLost = inv.book * (lost / Math.max(1, inv.transit + inv.ready));
    inv.transit = 0;
    inv.book -= bookLost;
    ctx.log('alert', `Taiwan crisis: ${(lost / 1e6).toFixed(2)}M H100e in transit lost.`, 5);
  }
  ctx.headline('tw-shock', 'Taiwan Strait closed to shipping; chip prices spike');
}

/** Korea (HBM) disruption: hits K_hbm only. */
export function koreaShock(s: GameStateV2, ctx: SystemCtx, severity = 0.5, quarters = 3): void {
  ensureWs3(s);
  s.market.disruptKR = Math.max(s.market.disruptKR, severity);
  s.market.ws3.krQ = Math.max(s.market.ws3.krQ, quarters);
  ctx.headline('kr-shock', 'Korean memory fabs disrupted; HBM supply falls');
}

/** Export-control state (R15 §1.2). WS4 (gov ladder) calls this. */
export function setExportPolicy(s: GameStateV2, policy: ChipMarket['exportPolicy']): void {
  s.market.exportPolicy = policy;
}

/** Quarterly Taiwan quarantine probability: 0.25% × (1 + 4·tension) × (1 + 2·salience), cap 3% [R15 Design]. */
export function taiwanHazardQ(s: GameStateV2): number {
  const tension = s.china.meters.taiwanTension / 100;
  const salience = Math.min(1, Math.max(0, (s.pub.salience - 1) / 2));
  return Math.min(0.03, 0.0025 * (1 + 4 * tension) * (1 + 2 * salience));
}
/** Korea HBM disruption probability 0.1%/q [R15 Design]. */
export const KOREA_HAZARD_Q = 0.001;

/** geo_TW falls linearly 0.93 (2026) → 0.85 (2028) → 0.75 (2030) [R15]. */
export function geoTWAt(year: number): number {
  if (year <= 2026) return 0.93;
  if (year <= 2028) return 0.93 - (0.08 * (year - 2026)) / 2;
  if (year <= 2030) return 0.85 - (0.1 * (year - 2028)) / 2;
  return 0.75;
}

// ───────────────────────────── Quarterly clearing ─────────────────────────────

interface Claim { kind: 'exo' | 'player' | 'lab'; ref?: string; qty: number; weight: number; got: number }

/** Weighted rationing with caps (water-filling): each claim gets ≤ qty, shares ∝ weight·qty [R15]. */
export function ration(supply: number, claims: Claim[]): void {
  let left = supply;
  let open = claims.filter((c) => c.qty > c.got);
  for (let iter = 0; iter < 6 && left > 1 && open.length; iter++) {
    const W = open.reduce((a, c) => a + c.weight * (c.qty - c.got), 0);
    if (W <= 0) break;
    let used = 0;
    for (const c of open) {
      const want = c.qty - c.got;
      const give = Math.min(want, (left * c.weight * want) / W);
      c.got += give;
      used += give;
    }
    left -= used;
    open = open.filter((c) => c.qty - c.got > 1);
  }
}

/** Rationing weight of a player order: 1 + 0.5·LTA(≥4q old) + 0.5·prepay + 0.5·strategic + 0.3·track [R15]. */
export function orderWeight(s: GameStateV2, kind: 'spot' | 'standard' | 'lta', prepayFrac: number, ltaAgeQ = 0): number {
  const strategic = s.player.finance.deals.some((d) => d.template === 'chipVendorEquity' || d.template === 'customASIC') ? 1 : 0;
  const track = Math.min(1, s.player.computeOnline / 5e6);
  return 1 + MARKET.rationW.lta * (kind === 'lta' && ltaAgeQ >= 4 ? 1 : 0) + MARKET.rationW.prepay * prepayFrac + MARKET.rationW.strategic * strategic + MARKET.rationW.track * track;
}

function supplyNow(m: ChipMarket): { S: number; nonTW: number } {
  const raw = Math.min(m.Kpkg, m.Khbm * (1 - m.disruptKR * 0.9), m.Kwafer);
  const S = raw * (1 - m.geoTW * m.disruptTW);
  return { S, nonTW: raw * (1 - m.geoTW) };
}

function stepPipelines(s: GameStateV2, B: number, ctx: SystemCtx) {
  const m = s.market;
  const w = m.ws3;
  const cum = m.cumOrders8q.reduce((a, b) => a + b, 0);
  const cumS = w.supply8q.reduce((a, b) => a + b, 0);
  const trust = Math.min(1, cum / Math.max(1, cumS)); // cumulative-demand memory (TSMC capex lag) [R15]
  const K: Record<Comp, number> = { pkg: m.Kpkg, hbm: m.Khbm, wafer: m.Kwafer };
  for (const c of COMPS) {
    const p = COMPONENTS[c];
    const pipe = m.pipe[c];
    while (pipe.length < p.L) pipe.push(0);
    const future = K[c] + pipe.reduce((a, b) => a + b, 0);
    const g = Math.min(p.gmax, Math.max(p.gmin, p.g0 + p.beta * trust * (B - 1)));
    pipe[p.L - 1] += future * (Math.pow(g, 0.25) - 1);
  }
  // Fast lever: wafer node conversion adds up to +10% K_wafer with L = 3, once per 4 quarters, when wafers bind [R15].
  const q = w.q;
  if (m.binding === 'wafer' && B > 1.1 && q - w.lastConversionQ >= 4) {
    m.pipe.wafer[2] += 0.1 * m.Kwafer;
    w.lastConversionQ = q;
    ctx.log('news', 'Foundry converts older lines to the leading node to meet AI demand.');
  }
}

function arrive(m: ChipMarket) {
  const take = (arr: number[]) => {
    const v = arr.shift() ?? 0;
    arr.push(0);
    return v;
  };
  m.Kpkg += take(m.pipe.pkg);
  m.Khbm += take(m.pipe.hbm);
  m.Kwafer += take(m.pipe.wafer);
}

/** Player share of a quarter's reserved supplier capacity (funded expansions). */
function reservedFor(s: GameStateV2, q: number): number {
  return s.player.finance.ws3.reserved.reduce((a, r) => a + (r.fromQ <= q && q < r.toQ ? r.perQ : 0), 0);
}

/** LTA orders carry their signing quarter in the id: `LTA<q>-<n>` (rationing weight +0.5 once ≥ 4 quarters old). */
export const ltaSignedQ = (id: string) => {
  const m = /^LTA(-?\d+)-/.exec(id);
  return m ? Number(m[1]) : 0;
};

/** One quarterly market step (R15 §1.1 steps 3–7). Exported for headless market tests. */
export function clearMarket(s: GameStateV2, ctx: SystemCtx): void {
  ensureWs3(s);
  const m = s.market;
  const w = m.ws3;
  const fx = s.player.finance.ws3;
  const q = qOf(s);
  w.q = q;

  // 1. Geo: decay disruptions, geo_TW path, demand-shock decay. New Taiwan/Korea disruptions are rolled by WS4's
  //    geoQ (spec §2.2 order 440) through taiwanShock / koreaShock with taiwanHazardQ / KOREA_HAZARD_Q.
  if (w.twQ > 0 && --w.twQ === 0) m.disruptTW = 0;
  if (w.krQ > 0 && --w.krQ === 0) m.disruptKR = 0;
  m.geoTW = geoTWAt(decimalYear(s));
  if (w.exoMultDecay > 0) w.exoMult = 1 + (w.exoMult - 1) * (1 - w.exoMultDecay);

  // 2. Inventory ages: last quarter's deliveries become installable; idle chips lose 6% book value.
  fx.inventory.ready += fx.inventory.transit;
  fx.inventory.transit = 0;
  fx.inventory.book *= 1 - MARKET.inventoryDecayQ;

  // 3–4. Capacity arrives; supply S_t = min(components) × geo factors.
  arrive(m);
  const { S: S0, nonTW: nonTWPool } = supplyNow(m);
  const hbmEff = m.Khbm * (1 - m.disruptKR * 0.9);
  m.binding = m.Kpkg <= hbmEff && m.Kpkg <= m.Kwafer ? 'packaging' : hbmEff <= m.Kwafer ? 'hbm' : 'wafer';
  m.supplyQ = S0;

  // China's policy-set share (licensed exports + ~1% smuggling) comes off the top [R15 export controls].
  const pol = EXPORT_POLICY[m.exportPolicy];
  const toChina = S0 * (pol.xCN + 0.01);
  const S = Math.max(1, S0 - toChina);

  // 5. Orders due this quarter. Non-Taiwan allocations and reserved (funded) capacity are served outside rationing.
  const claims: Claim[] = [];
  const exo = exoDemand(s, q);
  m.exoDemandQ = exo;
  claims.push({ kind: 'exo', qty: exo, weight: MARKET.exoWeight, got: 0 });
  let D = exo;
  let reserved = reservedFor(s, q);
  let outside = 0; // supply used outside rationing
  let nonTWLeft = nonTWPool;
  const playerDue = s.player.orders.filter((o) => o.dueQ <= q && o.qty - o.delivered > 1);
  let playerWant = 0;
  let playerGot = 0;
  for (const o of playerDue) {
    let want = o.qty - o.delivered;
    D += want;
    playerWant += want;
    if (o.nonTW) {
      const give = Math.min(want, nonTWLeft);
      nonTWLeft -= give;
      outside += give;
      playerGot += give;
      deliver(s, ctx, o.id, give);
      continue;
    }
    if (reserved > 0) {
      const give = Math.min(want, reserved);
      reserved -= give;
      outside += give;
      playerGot += give;
      deliver(s, ctx, o.id, give);
      want -= give;
    }
    if (want > 1) claims.push({ kind: 'player', ref: o.id, qty: want, weight: orderWeight(s, o.kind, o.prepayFrac, o.kind === 'lta' ? q - ltaSignedQ(o.id) : 0), got: 0 });
  }
  // Default demand of rivals WS4 does not manage; WS4-managed labs place explicit orders (placeLabOrder).
  for (const r of s.rivals) {
    if (r.core.status !== 'active' || w.managedLabs.includes(r.core.id) || r.core.id === LEADER_ID) continue; // leader: in exo demand
    const qty = r.core.computeOnline * RIVAL_GROWTH_Q;
    claims.push({ kind: 'lab', ref: r.core.id, qty, weight: 1.2, got: 0 });
    D += qty;
  }
  for (const o of w.labOrders) {
    if (o.dueQ > q || o.qty - o.delivered <= 1) continue;
    claims.push({ kind: 'lab', ref: o.id, qty: o.qty - o.delivered, weight: o.weight, got: 0 });
    D += o.qty - o.delivered;
  }
  // New cloud capacity starting this quarter is bought by its provider in the same market (served first).
  for (const c of s.player.cloud) {
    if (c.startDay < s.time.day || c.startDay >= s.time.day + 91) continue;
    D += c.h100e;
    outside += Math.min(c.h100e, Math.max(0, S - outside));
  }

  const ds = D / S;
  w.ds = ds;
  m.demandQ = D;

  // 6. Prices: list (sticky, contract-based), spot rental (volatile).
  m.cost = C0 * Math.pow(MARKET.costDeclineQ, q);
  m.premium = nextPremium(m.premium, ds);
  m.listPrice = m.markup * m.cost * (1 + m.premium);
  m.rental = spotRental(rentalBase(m.listPrice, s.power.kWPerH100e), ds);

  // Rationing of the rest: S·w_i·q_i / Σ w_j·q_j, capped at q_i [R15].
  ration(Math.max(0, S - outside), claims);
  for (const c of claims) {
    if (c.kind === 'player' && c.ref) {
      playerGot += c.got;
      deliver(s, ctx, c.ref, c.got);
    } else if (c.kind === 'lab' && c.ref) {
      const lo = w.labOrders.find((o) => o.id === c.ref);
      if (lo) lo.delivered += c.got;
      deliverToLab(s, lo ? lo.lab : c.ref, c.got);
    }
  }
  w.playerFill = playerWant > 0 ? playerGot / playerWant : 1;
  w.playerWeight = orderWeight(s, 'standard', 0.3);
  w.labOrders = w.labOrders.filter((o) => o.qty - o.delivered > 1);
  // China's compute is WS4's (china.meters.computeAbs, §3.10.4); exports to China only reduce the supply here.

  // 7. Bookkeeping: global production and stock, backlog signal, supplier expansion.
  const shipped = Math.min(S, outside + claims.reduce((a, c) => a + c.got, 0)) + toChina;
  w.shipped = shipped;
  w.stock += shipped;
  const unfilled = Math.max(0, D - S);
  m.cumOrders8q.push(D);
  if (m.cumOrders8q.length > 8) m.cumOrders8q.shift();
  w.supply8q.push(S0);
  if (w.supply8q.length > 8) w.supply8q.shift();
  // Forward book: exogenous buyers' contracted next-4q demand (× shock multiplier) plus labs at their reference path;
  // labs' demand above reference shows up through the unfilled term.
  let fwd = 0;
  for (let k = 1; k <= 4; k++) {
    const exoK = exoRefQ(s, q + k);
    fwd += exoK * w.exoMult + (globalRefQ(q + k) - exoK);
  }
  fwd = (FWD_SHARE * fwd) / 4 + playerLtaPerQ(s, q);
  m.backlog = 0.5 * m.backlog + 0.5 * ((unfilled + fwd) / Math.max(1, S0));
  stepPipelines(s, m.backlog, ctx);
}

function playerLtaPerQ(s: GameStateV2, q: number): number {
  let sum = 0;
  for (const o of s.player.orders) if (o.kind === 'lta' && (o.ltaEndQ ?? 0) > q) sum += o.qty;
  return sum;
}

/** Deliver `qty` of a player order: pay the balance, move chips into inventory (transit). */
function deliver(s: GameStateV2, ctx: SystemCtx, orderId: string, qty: number): void {
  if (qty <= 0) return;
  const o = s.player.orders.find((x) => x.id === orderId);
  if (!o) return;
  o.delivered += qty;
  const fx = s.player.finance.ws3;
  let pay = 0;
  if (o.kind === 'spot') pay = (qty * spotPrice(s.market) * (o.nonTW ? MARKET.nonTWPremium : 1)) / 1e6;
  else if (o.kind === 'standard') pay = (qty * o.price * (1 - o.prepayFrac)) / 1e6;
  // LTA chips are paid through the ledger (take-or-pay).
  fx.inventory.transit += qty;
  fx.inventory.book += (qty * (o.kind === 'spot' ? spotPrice(s.market) : o.price)) / 1e6;
  if (pay > 0) {
    bookCash(s, ctx, -pay, 'compute', 'chip delivery', `${(qty / 1e6).toFixed(2)}M H100e`);
    yearStats(s).capexChips += pay;
  }
  // LTA orders: next quarter's tranche stays open until ltaEndQ.
  if (o.kind === 'lta' && o.delivered >= o.qty - 1 && (o.ltaEndQ ?? 0) > o.dueQ + 1) {
    o.dueQ += 1;
    o.delivered = 0;
  }
}

/** Non-player labs install delivered chips directly (no site model): +online H100e next quarter. */
function deliverToLab(s: GameStateV2, lab: LabId, qty: number) {
  if (qty <= 0) return;
  const r = lab === 'china' ? s.china.lab : s.rivals.find((x) => x.core.id === lab);
  if (r) r.core.computeOnline += qty;
}

/** marketQ (400, quarterly): supply pipelines, orders, clearing, price, deliveries → inventory. Installation into
 *  sites happens in sitesQ (410) once power is ready. */
export const marketQSystem: EngineSystem = {
  id: 'marketQ', owner: 'WS3', cadence: 'quarterly', order: 400,
  run(s, ctx) {
    clearMarket(s, ctx);
    // Completed player orders leave the book. An LTA rolls to its next tranche on delivery (`deliver`), so it stays
    // open until its last tranche is in.
    s.player.orders = s.player.orders.filter((o) => o.qty - o.delivered > 1);
  },
};

export type { LabOrder };
