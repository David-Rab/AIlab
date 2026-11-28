// The story (FINANCE-V3 §1; FIN5a): what investors pay for all private frontier labs together (the sector value) and
// each lab's share of it, read from four observables anyone can see. The valuation is the sector value × your share,
// marked every quarter; the investor pool (§2.1) is a fixed part of the sector value, split by the same share; and
// suppliers ask a lab with little access to equity, or a short runway, to prepay more (§5). Finance reads the labs only
// through observe.ts (FINANCE-BUILD rule 4). Owner: WS3.
//
// FIN5b: private rivals are in the same split with their own position, momentum and capacity, the sector's typical
// margin, a credibility rung from their revenue growth and a governance factor by kind; their valuations are marked from
// it (finance/rivalFinance.ts), at most their cap (team value + a multiple of run-rate).
import { DEBT_SIZING } from '../../../data/v2/deals';
import { startOf } from '../../../data/v2/starts';
import { investorAppeal, ownerFunded } from './control';
import { PLAYER_ID } from '../models/labs';
import type { GameStateV2, LabId, Money } from '../types';
import { computeSecured, publicFrontier, publicLevel, revenueRun, servingEconomics } from './observe';
import { credRung } from './promises';
import { markRivals, rivalCred, rivalGov, valueCap } from './rivalFinance';

/** Every number of the story (spec §1, §2.1, §5). */
export const STORY = {
  /** Sector value S = κ_S · R_sector^α · Φ(L) · mood, $B (R in $B/yr). Fitted on the RefBot's reference path (FIN5a
   *  notes, 12 seeds): ≈ $0.63T at the Jul 2025 start (R_sector ≈ $18B, public frontier L 5.2, mood 1) and ≈ $2.9T
   *  between the Oct 2026 and Jan 2027 marks (R ≈ $80–90B, L 7.3–8.2, hype 1.15–1.35): the OpenAI + Anthropic + xAI +
   *  others marks, $0.6–0.7T mid-2025 and $2.5–3T late 2026 [R15 §2.9] [fit]. α < 1: value grows slower than revenue,
   *  so the leader's multiple falls from ≈ 30× toward ≈ 20× as revenue scales unless the frontier or the mood rise. */
  kappa: 83,
  alpha: 0.7,
  /** Φ(L) = (L / L_ref)^φ: the prize looks bigger as the public frontier rises (×1.35 from L 5 to 7.5) [fit]. */
  phi: 0.75,
  phiRef: 5,
  /** Mood = hype H × rate factor M × bust factor [R15 §1.4, kept]: M = exp(−0.12·(y10 − 4.5)); ×0.7 in a bust [fit,
   *  FIN6a; was ×0.4]. The bust's hype shock (−0.6 over a 4-quarter half-life) already cuts S by about half at hype
   *  1–1.3; R15 put the ×0.4 on the pool, not on valuations, and stacked on the shock it left a lab at 15–30% of its
   *  mark in one quarter. ×0.7 leaves about 30–40% (late-stage private marks fell 50–85% in the 2022 downturn); the
   *  pool (π · S) falls the same way. */
  rateK: 0.12,
  rateRef: 4.5,
  bust: 0.7,
  /** Share: softmax of z = Σ w_k·x_k over the private labs, temperature τ, × credibility × governance [D, fit]. Fitted
   *  to the start shares (leader ≈ 45%: $0.32T of $0.63T, OpenAI $300B in Mar 2025; challenger ≈ 12%, Anthropic $61.5B;
   *  spinout ≈ 7%, SSI $32B [R15 §2.9, R21 A8]). Position weighs most: what the market sees first. */
  tau: 1.25,
  /** FIN6a refit (was position 0.45, capacity 0.2): capacity (compute secured, steady quarter to quarter) weighs more
   *  and position (which swings in Q4 2025–Q1 2026, when the rivals' start models catch up) less, so the reference
   *  lab's late-2026 mark reaches OpenAI's $1.25T (Nov 2026) without a deeper Q1 2026 markdown [fit]. */
  weights: { position: 0.4, momentum: 0.25, economics: 0.1, capacity: 0.25 },
  /** Normalisation: position per 2 levels of the public scale (≈ a year of frontier progress), economics per 20 points
   *  of margin, momentum and capacity in doublings against the rival field; each driver clamped to ±3 [D]. */
  posScale: 2,
  econScale: 0.2,
  clamp: 3,
  /** Revenue growth over 4 quarters, clamped to ×0.5–×8 as R15's g [R15 §1.5]. */
  growth: [0.5, 8] as const,
  /** A lab with revenue under $0.1B/yr is pre-revenue: momentum ×1 (spec §1) and economics at the field's [D]. */
  preRevenue: 0.1,
  /** Rivals' serving margins are not public: they count at the sector's typical 50% (spec §12 "sector average") [D]. */
  rivalMargin: 0.5,
  /** Rivals' revenue a year before the start: the sector's ×3 a year (R15 hype norm g = 3) [D]. */
  priorGrowth: 3,
  /** Investor pool = π · S a year × the IPO window's bump, split by share; the player's unused part carries 50% [fit,
   *  R15]: π fitted so the reference bot raises what it did before FIN5a (median $15B in 2025 H2, $90B in 2026; OpenAI
   *  $40B in 2025, $122B in 2026), a sector pool of ≈ $100B a year in 2025 and ≈ $300–400B in 2026 (R15 §2.9: ≈ $75B
   *  and $350B+). */
  pi: 0.15,
  /** Share of the gap to today's story share each quarterly mark closes [D] (FIN5a deviation: the spec marks the story
   *  outright; a half-way update keeps one stale release or one hot rival quarter from halving a lab's mark, which
   *  private marks never did in 2025–26). */
  blend: 0.5,
  ipoBump: 0.5,
  carry: 0.5,
} as const;

/** Supplier terms (spec §5: "prepayment share = f(share_i, runway)") [D]: a batch's deposit is at least 30% plus up to
 *  35 points for a small share of investor money (full at no share, none from 25%) and up to 35 points for a short
 *  runway (full at none, none from 6 quarters); supply contracts prepay the same premium on their first delivery. */
export const SUPPLIER = { base: 0.3, shareFull: 0.25, sharePremium: 0.35, runwayFull: 6, runwayPremium: 0.35 } as const;

export type Driver = keyof typeof STORY.weights;
export const DRIVERS: Driver[] = ['position', 'momentum', 'economics', 'capacity'];

/** What investors see of one lab: its best public level (`level`, or the open-weight floor `floored`), revenue and
 *  4-quarter growth, serving margin (`null`: pre-revenue), compute secured. */
export interface LabStory {
  id: LabId;
  name: string;
  revenue: Money;
  level: number;
  floored: boolean;
  growth: number;
  margin: number | null;
  secured: number;
  /** Drivers after normalisation against the rival field (x_k, clamped), and z = Σ w_k·x_k. */
  x: Record<Driver, number>;
  z: number;
  cred: number;
  /** The credibility rung's name (you: your score's rung; a rival: its revenue-growth rule). */
  rung: string;
  gov: number;
  weight: number;
  share: number;
  /** Valuation at the last mark (rivals: S × marked share, at most `cap`; you: your valuation). */
  valuation: Money;
  /** The lab's valuation cap (FIN6a: every private lab, you too): team value or the growth-scaled multiple × run-rate. */
  cap?: Money;
}

export interface SectorValue { S: Money; R: Money; L: number; phi: number; H: number; M: number; bust: number; mood: number }

/** Private frontier labs the sector counts: the player (unless a big-tech division) and active rivals with a private
 *  valuation (big-tech in-house and parent-funded open-weight labs excluded, as the pool always did). */
export const privateRivals = (s: GameStateV2) => s.rivals.filter((r) => r.core.status === 'active' && r.finance.valuation > 0);

/** Private frontier-lab revenue run-rate (player + private rivals). */
export function sectorRunRate(s: GameStateV2): Money {
  return s.player.finance.revenueRun + privateRivals(s).reduce((a, r) => a + r.finance.revenueRun, 0);
}

/** Rate factor M = exp(−0.12·(y10 − 4.5)) [R15]. */
export const rateFactor = (y10: number) => Math.exp(-STORY.rateK * (y10 - STORY.rateRef));

/** Sector value now with its terms (spec §1). */
export function sectorValue(s: GameStateV2): SectorValue {
  const c = s.capital;
  const R = sectorRunRate(s);
  const L = publicFrontier(s);
  const phi = Math.pow(Math.max(1, L) / STORY.phiRef, STORY.phi);
  const H = c.hype;
  const M = rateFactor(c.y10);
  const bust = c.busted && c.busted.recoverDay > s.time.day ? STORY.bust : 1;
  const mood = H * M * bust;
  return { S: STORY.kappa * Math.pow(Math.max(1, R), STORY.alpha) * phi * mood, R, L, phi, H, M, bust, mood };
}

/** 4-quarter revenue growth from a quarterly history (oldest first, last = last quarter's run-rate), R15's clamp; 1 for
 *  a pre-revenue lab. */
export function growthOf(R: Money, hist: Money[] | undefined): number {
  if (R < STORY.preRevenue) return 1;
  const h = hist ?? [];
  const back = h.length >= 4 ? h[h.length - 4] : h[0] ?? R;
  return Math.max(STORY.growth[0], Math.min(STORY.growth[1], R / Math.max(STORY.preRevenue, back)));
}

/** Best open-weight public model level (a lab with no public model of its own is placed there: what it can build on). */
export function openWeightFloor(s: GameStateV2): number {
  let L = 0;
  for (const r of [...s.rivals, s.china.lab]) if (r.publicModel?.openWeights) L = Math.max(L, r.publicModel.Lg);
  return L;
}

/** Player governance factor: the charter's investor appeal (control.ts, CORPORATE.md §2.4). */
export const playerGov = (s: GameStateV2) => investorAppeal(s);

const clampX = (x: number) => Math.max(-STORY.clamp, Math.min(STORY.clamp, x));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Every private lab's story and share (spec §1): z_i = Σ w_k·x_ik, share_i = cred_i·gov_i·exp(z_i/τ) / Σ_j (…). Each
 *  driver is normalised against the rival field (the other private labs; position against the best public model of
 *  any other lab, big tech included). The player is the first entry unless it is a big-tech division. */
export function storyShares(s: GameStateV2): LabStory[] {
  const floor = openWeightFloor(s);
  const labs: Omit<LabStory, 'x' | 'z' | 'weight' | 'share'>[] = [];
  const hist = s.capital.ws3?.labRev ?? {};
  if (!ownerFunded(s)) {
    const f = s.player.finance;
    const L = publicLevel(s, PLAYER_ID);
    const R = f.revenueRun;
    labs.push({
      id: PLAYER_ID, name: s.player.name, revenue: R, level: L > 0 ? L : floor, floored: !(L > 0),
      growth: growthOf(R, f.revenueHistory), margin: R < STORY.preRevenue ? null : Math.max(-1, Math.min(1, servingEconomics(s).margin)),
      secured: computeSecured(s), cred: credRung(f.credibility ?? 50).mult, rung: credRung(f.credibility ?? 50).id, gov: playerGov(s), valuation: f.valuation, cap: valueCap(R, growthOf(R, f.revenueHistory)),
    });
  }
  for (const r of privateRivals(s)) {
    const L = publicLevel(s, r.core.id);
    const R = revenueRun(s, r.core.id);
    const cr = rivalCred(s, r);
    labs.push({
      id: r.core.id, name: r.core.name, revenue: R, level: L > 0 ? L : floor, floored: !(L > 0),
      growth: growthOf(R, hist[r.core.id]), margin: R < STORY.preRevenue ? null : STORY.rivalMargin,
      secured: computeSecured(s, r.core.id), cred: cr.mult, rung: cr.id, gov: rivalGov(r), valuation: r.finance.valuation, cap: valueCap(R, growthOf(R, hist[r.core.id])),
    });
  }
  // Public levels of every lab for the position comparison (big-tech and open-weight models count: markets see them).
  const levels: { id: LabId; L: number }[] = [{ id: PLAYER_ID, L: publicLevel(s, PLAYER_ID) }, ...s.rivals.filter((r) => r.core.status === 'active').map((r) => ({ id: r.core.id, L: publicLevel(s, r.core.id) }))];
  const out: LabStory[] = labs.map((a) => {
    const others = labs.filter((b) => b.id !== a.id);
    const best = Math.max(0, ...levels.filter((b) => b.id !== a.id).map((b) => b.L));
    const margins = others.flatMap((b) => (b.margin === null ? [] : [b.margin]));
    const x: Record<Driver, number> = {
      position: clampX((a.level - best) / STORY.posScale),
      momentum: others.length ? clampX(Math.log2(a.growth) - mean(others.map((b) => Math.log2(b.growth)))) : 0,
      economics: a.margin === null ? 0 : clampX((a.margin - (margins.length ? mean(margins) : STORY.rivalMargin)) / STORY.econScale),
      capacity: others.length ? clampX(Math.log2(Math.max(1, a.secured) / Math.max(1, mean(others.map((b) => b.secured))))) : 0,
    };
    const z = DRIVERS.reduce((t, k) => t + STORY.weights[k] * x[k], 0);
    return { ...a, x, z, weight: a.cred * a.gov * Math.exp(z / STORY.tau), share: 0 };
  });
  const tot = out.reduce((t, a) => t + a.weight, 0);
  for (const a of out) a.share = tot > 0 ? a.weight / tot : 0;
  return out;
}

/** The player's story now: sector value, its share with the drivers, the valuation it marks, and each factor's effect
 *  on its weight (× against a lab level with the field on that driver: exp(w_k·x_k/τ)). A division has none. */
export interface StoryNow {
  sector: SectorValue;
  me?: LabStory;
  labs: LabStory[];
  share: number;
  V: Money;
  effect: Record<Driver, number>;
  /** Best public level of any other lab, the field's mean growth, margin and compute secured (what each driver is
   *  measured against). */
  field: { bestLevel: number; growth: number; margin: number; secured: number; n: number };
}

export function storyNow(s: GameStateV2): StoryNow {
  const sector = sectorValue(s);
  const labs = storyShares(s);
  const me = labs.find((a) => a.id === PLAYER_ID);
  const others = labs.filter((a) => a.id !== PLAYER_ID);
  const margins = others.flatMap((b) => (b.margin === null ? [] : [b.margin]));
  const bestLevel = Math.max(0, ...s.rivals.filter((r) => r.core.status === 'active').map((r) => publicLevel(s, r.core.id)));
  const effect = Object.fromEntries(DRIVERS.map((k) => [k, me ? Math.exp((STORY.weights[k] * me.x[k]) / STORY.tau) : 1])) as Record<Driver, number>;
  return {
    sector, me, labs, share: me?.share ?? 0, V: me ? Math.min(sector.S * me.share, me.cap ?? Infinity) : 0, effect,
    field: {
      bestLevel,
      growth: others.length ? Math.pow(2, mean(others.map((b) => Math.log2(b.growth)))) : 1,
      margin: margins.length ? mean(margins) : STORY.rivalMargin,
      secured: mean(others.map((b) => b.secured)),
      n: others.length,
    },
  };
}

/** The share a quarterly mark uses: the last mark's share moved `blend` of the way to today's story share. */
export function markShare(s: GameStateV2, story: number): number {
  const last = s.player.finance.ws3.mark;
  return last ? last.share + STORY.blend * (story - last.share) : story;
}

/** Investor pool a year (spec §2.1): π · S × the IPO window's bump (S carries the mood). */
export const poolAnnualOf = (s: GameStateV2, S: Money) => STORY.pi * S * (1 + (s.capital.ipoWindow ? STORY.ipoBump : 0));

/** Record each private rival's run-rate at a quarter mark (momentum history, last 8 quarters). */
export function recordLabRevenue(s: GameStateV2): void {
  const w = s.capital.ws3;
  const h = (w.labRev ??= {});
  for (const r of privateRivals(s)) {
    const x = (h[r.core.id] ??= []);
    x.push(r.finance.revenueRun);
    if (x.length > 8) x.shift();
  }
}

/** Seed a rival's revenue history at the start (or for a save made before FIN5a): the last four quarters at the
 *  sector's ×3 a year. */
export function seedLabRevenue(s: GameStateV2): void {
  const w = s.capital.ws3;
  const h = (w.labRev ??= {});
  for (const r of privateRivals(s)) h[r.core.id] ??= [4, 3, 2, 1].map((k) => r.finance.revenueRun / Math.pow(STORY.priorGrowth, k / 4));
}

/** Day 0 (newGame): rival histories, the first mark of the player's valuation, the investor pool and the player's
 *  part of it. A non-leader start's credit line is sized as banks size it (3% of that valuation, cap $15B); the leader
 *  keeps its historical $4B line (FIN1). */
export function startStory(s: GameStateV2): void {
  seedLabRevenue(s);
  const st = storyNow(s);
  const f = s.player.finance;
  const c = s.capital;
  if (st.me) {
    f.valuation = st.V;
    f.ws3.mark = { S: st.sector.S, share: st.share };
    if (startOf(s).id !== 'leader') for (const d of f.debts) if (d.kind === 'revolver') d.principal = Math.min(DEBT_SIZING.lineCap, DEBT_SIZING.lineShareOfV * st.V);
  }
  c.poolAnnual = poolAnnualOf(s, st.sector.S);
  c.ws3.playerShare = st.share;
  c.ws3.playerPoolQ = st.share * (c.poolAnnual / 4);
  markRivals(s, st); // FIN5b: rivals' start valuations from the same split
}

/** Supplier terms (spec §5) [D]: the deposit share of a batch order and the prepaid share of a supply contract's first
 *  delivery, from the player's share of investor money and its runway. A division pays on the parent's credit. */
export interface SupplierTerms { batch: number; firstDelivery: number; shareAdd: number; runwayAdd: number; share: number; runwayQ: number }
export function supplierTerms(s: GameStateV2): SupplierTerms {
  const f = s.player.finance;
  const division = ownerFunded(s);
  const share = division ? 1 : s.capital.ws3?.playerShare ?? 0.3;
  const runwayQ = division ? SUPPLIER.runwayFull : f.runwayQ;
  const shareAdd = SUPPLIER.sharePremium * Math.max(0, Math.min(1, 1 - share / SUPPLIER.shareFull));
  const runwayAdd = SUPPLIER.runwayPremium * Math.max(0, Math.min(1, 1 - runwayQ / SUPPLIER.runwayFull));
  return { batch: Math.min(1, SUPPLIER.base + shareAdd + runwayAdd), firstDelivery: Math.min(1, shareAdd + runwayAdd), shareAdd, runwayAdd, share, runwayQ };
}
