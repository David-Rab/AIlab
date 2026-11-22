// Save format, migrations, state hash (V2-SPEC §2.5). Owner: WS1.
import { ensureWs3 } from '../finance/ext';
import { START_CREDIBILITY, typicalRound } from '../finance/promises';
import { dMax } from '../finance/equity';
import type { GameStateV2, SectorId } from '../types';
import { MONITOR_STD_POOL_SHARE } from '../../../data/v2/agents';
import { partnerDef, PARTNER_TERMS } from '../../../data/v2/deals';
import { divisionOf } from '../finance/parent';
import { privateRivals, sectorValue, seedLabRevenue } from '../finance/story';
import { FIN } from '../actors/rivals';
import { fillRecipe } from '../models/runs';
import { domainsOf } from '../models/capability';
import { adopted } from '../models/paradigms';
import { keepUnlockedSuite, unbuiltSuiteFamilies } from '../models/suites';

/** Bump on any breaking change to types.ts and add a migration from the previous rev.
 *  Saves below MIN_SCHEMA_REV (33) do not load (designer decision DD-20, RD-C03): v1, v2 and model v3 V1–V3 saves
 *  (≤ 14) never carried over, and the model v3 migrations 15 → 16 … 32 → 33 were deleted with their helpers (their
 *  history is in git before RD-C03 and in V3-BUILD). deserialize refuses them with OLD_SAVE_MESSAGE.
 *  33 (model v3 F3): the progress coordinate pm and the know-how readout pa are gone — ModelVersion.G and SimpleModel.G
 *  (required) replace pm, KnowledgeState.openWeightsG replaces openWeightsFrontier; LabCore.pa, RivalPhys.paSync,
 *  VersionBuild.paIn, BaseModel / TrainingRun.paAtStart and the stream's paTrack are removed.
 *  34–42 (finance v3, merge FINM): the finance rebuild's nine migrations, built on finance-v3 as 11 → 12 … 19 → 20 and
 *  renumbered after model v3's 33 (finance rev r = merged rev r + 22): 33 → 34 FIN1 (debt, leases, partner templates),
 *  34 → 35 FIN2 (credibility, promises), 35 → 36 FIN3a (approvals list), 36 → 37 FIN3b (E37 freeze, reinstatement),
 *  37 → 38 FIN4a (partner records), 38 → 39 FIN5c (division budget), 39 → 40 FIN4r (typical round, lease ids), 40 → 41
 *  FIN5a (story mark, lab revenue history), 41 → 42 FIN5b (rivals' marks, pool, raised). Each one only touches what is
 *  missing or still in its old form, so a state already at 42 labelled 33 loads unchanged (hygiene checks it). Saves
 *  written by the finance-v3 branch itself (its revs 12–20) collide with model v3's numbers and do not load.
 *  43 (SAFMECH): PlayerLab.policies.monitorBudget (the monitoring budget, a share of the safety pool, which sets the
 *  monitors' coverage). Migration 42 → 43 gives a save the old standard package's 20% (idempotent).
 *  44 (RD-C01): v2's knot production function is gone — TimelineWorld.prod.knots and the dead readout fields of every
 *  lab's prodCache (Ddata, parts.base, elast.train / data, ratios.d) are removed. Migration 43 → 44 drops them (the
 *  cache is rebuilt the next day anyway); RD-C02, in the same bump, also drops TimelineWorld.calShift, and RD-C07
 *  the cut paradigm P26 (player.paradigms.P26, hidden.paradigmSuccess.P26) and RD-C04 the unread fields
 *  TimelineWorld.prod.kappa / etaSC, BaseModel.scale and VersionBuild.misuseMult (every lab).
 *  45 (RD-B02): TrainingRun.recipe is the run's whole launch snapshot (RunRecipe: + the base's DataDraw and P24 bonus, a
 *  continue run's draw, a post-train's domainG, P07 flag and serving FLOP part); completion and the trait hook read
 *  only it. Migration 44 → 45 fills what a run in flight lacks from the save's own day (the best available). RD-B03,
 *  same bump: a family unlocked later (computer use) has no suite until its first build; a save that knows its idea
 *  but never stored its suite (it read as a free start-quality one) keeps it, stored, before the runs are filled.
 *  46 (RD-B12): sector packs live on their product (DeploymentV2.packs: {sector, certDay}[]); world.fx.certDay and
 *  the product's sectorFocus are gone. Migration 45 → 46 moves each pack onto its product with the world's certification
 *  day and drops a certified sector no product carries.
 *  47 (RD-U01): one capability currency. VersionBuild.offL (design offsets in levels) and the derived VersionBuild.off
 *  become VersionBuild.dgD (domain ΔG, OOM, part of gOfDomain); BaseModel.off (never written) is gone. Migration
 *  46 → 47 converts every stored build's offL at the 1.2 L per OOM the fit applied (so the fit is unchanged) and
 *  recomputes the player's version domain levels as λ(G_d). */
export const SCHEMA_REV = 47;
/** The oldest save that loads (DD-20): a save below it is refused with OLD_SAVE_MESSAGE. */
export const MIN_SCHEMA_REV = 33;
/** What the player is told when a save is older than MIN_SCHEMA_REV. */
export const OLD_SAVE_MESSAGE = 'This save is from an older version of the game and can no longer be loaded.';
export const AUTOSAVE_KEY = 'ai27.v2.autosave';
export const SLOT_KEYS = ['ai27.v2.slot1', 'ai27.v2.slot2', 'ai27.v2.slot3'] as const;
/** v1 save key: the start screen offers "v1 save found: start new" (no migration). */
export const V1_SAVE_KEY = 'ai27.save.v1';
export const SAVE_BUDGET_BYTES = 1.5 * 1024 * 1024;

/** migrations[rev] upgrades a state at schemaRev = rev to rev + 1 (from MIN_SCHEMA_REV up). */
export const migrations: Record<number, (s: Record<string, unknown>) => void> = {
  /** 33 → 34 (finance v3 FIN1): SPV leasebacks become financing leases (kind finLease; the old 12%/4-year entries keep
   *  their payments); SPV- or JV-funded sites still being built get a lease at 9% (BB) on what was funded; the spv,
   *  neocloud and mega-JV deal templates and the JV are removed; LTA orders are firm tranches; the trailing operating
   *  cash flow starts from last quarter's; board blocks on removed action ids move to Buy chips / Rent compute. */
  33: (raw) => {
    const s = raw as unknown as GameStateV2;
    const f = s.player.finance;
    const fx = f.ws3 as unknown as Record<string, unknown> & GameStateV2['player']['finance']['ws3'];
    // The SPV's leaseback paid 12% (Keystone Capital), the mega-JV's 10% (FIN4r L12: it read 12% for both).
    for (const c of f.ledger as unknown as { kind: string; rate?: number; payee: string }[]) if (c.kind === 'spvRVG') { c.kind = 'finLease'; c.rate = c.payee === 'Keystone Capital' ? 0.12 : 0.1; }
    for (const x of s.player.sites) {
      const w = x.ws3 as unknown as Record<string, unknown> & typeof x.ws3;
      // FINM: a site already on a FIN1 lease keeps it (the migration is idempotent on a state at 42 labelled 33).
      if (w.lease) continue;
      if (x.spvFunded > 0 && x.stage !== 'live' && x.stage !== 'blocked') w.lease = { rate: 0.09, funded: x.capexPaid * x.spvFunded };
      else if (x.stage !== 'live') x.spvFunded = 0;
      delete w.financedBy;
    }
    const gone = new Set(['spv', 'neocloud', 'megaJV']);
    f.deals = (f.deals as unknown as { template?: string }[]).filter((d) => !gone.has(d.template as string)) as unknown as typeof f.deals;
    const offers = ((fx.offers ?? []) as Record<string, unknown>[]).filter((o) => !gone.has(o.template as string));
    for (const o of offers) delete o.siteShare;
    fx.offers = offers;
    delete fx.jv;
    delete fx.spvBcQ;
    fx.opCash4q ??= fx.opCashQ ? [fx.opCashQ] : [];
    for (const o of s.player.orders) if (o.kind === 'lta') { o.ltaStartQ ??= o.dueQ; o.firm = true; }
    const anchors = s.capital.ws3?.anchors as Record<string, string> | undefined;
    if (anchors) for (const k of ['Keystone Capital', 'Meridian Group', 'Vantage Neocloud']) delete anchors[k];
    const bu = ((fx as unknown as { blockedUntil?: Record<string, number> }).blockedUntil ?? {}) as Record<string, number>;
    const move: Record<string, string> = { 'cmp.orderStandard': 'cmp.buyChips', 'cmp.orderLTA': 'cmp.buyChips', 'cmp.orderSpot': 'cmp.buyChips', 'cmp.cloudContract': 'cmp.rentCompute' };
    for (const [from, to] of Object.entries(move)) if (bu[from] !== undefined) { bu[to] = Math.max(bu[to] ?? 0, bu[from]); delete bu[from]; }
  },
  /** 34 → 35 (finance v3 FIN2): investor credibility (start value by start type) and an empty promise list (rounds
   *  raised before FIN2 promised nothing); the revenue plan, the trailing raised tally and the patientQ start mod are
   *  gone; the milestone histories start empty (the raise card falls back to the pipeline and market pace). A pending
   *  or repriced round from before FIN2 closes without a thesis. */
  34: (raw) => {
    const s = raw as unknown as GameStateV2;
    const f = s.player.finance as GameStateV2['player']['finance'] & { raisedLast4q?: number };
    const start = s.setup.start ?? 'leader';
    f.credibility ??= START_CREDIBILITY[start];
    f.promises ??= [];
    delete f.raisedLast4q;
    delete (f.ws3 as unknown as Record<string, unknown>).revenuePlan;
  },
  /** 35 → 36 (finance v3 FIN3a): board votes are deterministic and never block, so the never-filled pending-approvals
   *  list goes and the 90-day blocks old rejections left on raises, deals, borrowing and cloud contracts are lifted
   *  (E37's capex freeze on sites and chips stays). */
  35: (raw) => {
    const s = raw as unknown as GameStateV2;
    delete (s.player.board as unknown as Record<string, unknown>).pendingApprovals;
    const bu = (s.player.finance.ws3 as unknown as { blockedUntil?: Record<string, number> } | undefined)?.blockedUntil;
    if (bu) for (const k of Object.keys(bu)) if (['fin.raise', 'fin.acceptDeal', 'fin.drawDebt', 'cmp.rentCompute'].includes(k) || k.startsWith('deal:')) delete bu[k];
  },
  /** 36 → 37 (finance v3 FIN3b): E37 is gone, so its capex freeze (the last board block) and the block list go; the
   *  ouster is a deterministic vote with no staff-revolt reinstatement, so the reinstatement day goes. An E37 decision
   *  still pending is dropped. */
  36: (raw) => {
    const s = raw as unknown as GameStateV2;
    const fx = s.player.finance.ws3 as unknown as Record<string, unknown> | undefined;
    if (fx) {
      delete fx.blockedUntil;
      delete fx.reinstatedDay;
    }
    const ev = s.events as unknown as { pending?: { id: string }[] };
    if (Array.isArray(ev.pending)) ev.pending = ev.pending.filter((d) => d.id !== 'E37');
  },
  /** 37 → 38 (finance v3 FIN4a): one partner offer flow. Deal records move from templates to partner kinds: a
   *  hyperscaler (old hyperscaler equity and custom-ASIC deals), a chip vendor, a sovereign; vendor-financing deals go
   *  (a vendor note stays as a bond-like loan with its spread and maturity). Stakes from before the start become legacy
   *  holders. The strings that did nothing go (observer, IP rights, in-country site); exclusivity and the revenue share
   *  stay, a deal running as before (the revenue share to six years after signing; custom chips and chip vendors keep
   *  their rationing priority for the supply term). Open offers go (terms are now computed live), and so do partner
   *  observer seats (hyperscalers hold no seats). Signed contracts, orders and tranches are kept as signed. */
  37: (raw) => {
    const s = raw as unknown as GameStateV2;
    const f = s.player.finance;
    const old = f.deals as unknown as { id: string; template?: string; partner: string; day: number; strings?: Record<string, unknown> }[];
    const KIND: Record<string, 'hyperscaler' | 'chipVendor' | 'sovereign'> = { hyperscalerEquity: 'hyperscaler', customASIC: 'hyperscaler', chipVendorEquity: 'chipVendor', sovereign: 'sovereign' };
    f.deals = old.filter((d) => d.template !== 'vendorFinance').map((d) => {
      if (!d.template && 'kind' in d) return d as unknown as GameStateV2['player']['finance']['deals'][number]; // already a partner record
      const kind = partnerDef(d.partner)?.kind ?? KIND[d.template ?? ''] ?? 'hyperscaler';
      const st = d.strings ?? {};
      const rescue = !!st.boardSeat;
      const legacy = d.day < 0;
      const chips = d.template === 'customASIC' || d.template === 'chipVendorEquity';
      const until = legacy ? d.day : d.template === 'hyperscalerEquity' && !rescue ? d.day + PARTNER_TERMS.hyperscaler.years * 365 : chips ? d.day + 10 * 91 : d.day;
      return {
        id: d.id, partner: d.partner, kind, day: d.day, equityNow: 0, equityLater: 0,
        ...(chips ? { supply: { kind: d.template === 'customASIC' ? 'asic' as const : 'chips' as const, h100e: 0, quarters: 8, first: 0, last: 0, firmDiscount: 0, partnerDiscount: 0, total: 0, endDay: until } } : {}),
        strings: { ...(st.exclusivity ? { exclusivity: true } : {}), ...(typeof st.revenueShare === 'number' && st.revenueShare > 0 ? { revenueShare: st.revenueShare } : {}), ...(rescue ? { boardVotes: PARTNER_TERMS.rescue.seats } : {}) },
        until, ...(rescue ? { rescue: true } : {}), ...(legacy ? { legacy: true } : {}),
      };
    });
    const fx = f.ws3 as unknown as Record<string, unknown>;
    delete fx.offers;
    for (const d of f.debts as unknown as { kind: string; covenant?: string }[]) if (d.kind === 'vendorNote') { d.kind = 'bond'; d.covenant = 'incurrence'; }
    for (const c of f.ledger as unknown as { kind: string }[]) if (c.kind === 'vendor') c.kind = 'lta';
    for (const y of Object.values((f.ws3?.years ?? {}) as unknown as Record<string, Record<string, unknown>>)) delete y.vendorNotes;
    s.player.board.seats = s.player.board.seats.filter((x) => !(x.kind === 'strategic' && x.weight <= 0));
  },
  /** 38 → 39 (finance v3 FIN5c): a big-tech division gets its budget year: this year's budget at the plan (as it was
   *  paid), savings carried in estimated as cash above what this year has paid so far; the parent sets goals and the
   *  next budget at the next review. A division never stays in distress (no runway verdict). */
  38: (raw) => {
    const s = raw as unknown as GameStateV2;
    if (divisionOf(s) && s.player.finance.state !== 'insolvent') s.player.finance.state = 'healthy';
  },
  /** 39 → 40 (finance v3 FIN4r review fixes): a live promise stores a typical round at its close (the dilution limit
   *  at its round's pre-money, the floor of its weight), read from its round; a partner deal's supply drops the inert
   *  order id; leases migrated from the old SPV and mega-JV are keyed like any lease (L-fin-<site>, so What we owe names
   *  the site) and the JV's keeps its 10% rate. Round tranches from before keep no shares to cancel (as signed). */
  39: (raw) => {
    const s = raw as unknown as GameStateV2;
    const f = s.player.finance;
    for (const p of f.promises ?? []) {
      if (p.result || p.by === 'parent' || p.typical !== undefined) continue;
      const r = f.rounds.find((x) => x.day === p.closeDay && !x.ipo);
      if (r) p.typical = typicalRound(r.postMoney - r.amount, dMax(!!r.anchor, false));
    }
    for (const d of f.deals) if (d.supply) delete (d.supply as unknown as Record<string, unknown>).ref;
    for (const c of f.ledger) {
      if (c.kind !== 'finLease' || !c.id.startsWith('L-spv-')) continue;
      if (c.payee !== 'Keystone Capital' && c.rate === 0.12) c.rate = 0.1;
      c.id = `L-fin-${c.id.slice('L-spv-'.length)}`;
    }
  },
  /** 40 → 41 (finance v3 FIN5a): the valuation is the story split (sector value × share). The narrative premium N is
   *  gone; private rivals get a revenue history (the last four quarters at the sector's ×3 a year, as at a new start);
   *  the last mark is read off the saved valuation (share = valuation ÷ today's sector value), so the first mark after
   *  loading moves half-way from it to the story like any other. */
  40: (raw) => {
    const s = raw as unknown as GameStateV2;
    const f = s.player.finance;
    delete (f as unknown as Record<string, unknown>).narrative;
    ensureWs3(s);
    seedLabRevenue(s);
    const S = sectorValue(s).S;
    if (!f.ws3.mark && f.valuation > 0 && S > 0) f.ws3.mark = { S, share: Math.min(1, f.valuation / S) }; // FINM: idempotent
  },
  /** 41 → 42 (finance v3 FIN5b): private rivals' valuations are marked from the story split like the player's. Each
   *  private rival's last mark is read off its saved valuation (share = valuation ÷ today's sector value), its part of
   *  the pool starts empty (filled at the next quarter's mark) and the equity its investors put in starts at its kind's
   *  start figure (no history was kept). A pending bust names no pushed rival. */
  41: (raw) => {
    const s = raw as unknown as GameStateV2;
    const S = sectorValue(s).S;
    for (const r of privateRivals(s)) {
      const f = r.finance;
      if (f.mark === undefined && S > 0) f.mark = Math.min(1, f.valuation / S);
      f.poolQ ??= 0;
      f.raised ??= FIN[r.archetype]?.raised ?? 0;
    }
  },
  /** 42 → 43 (SAFMECH): the monitoring budget becomes the player's setting (policies.monitorBudget, a share of the safety
   *  pool). A save gets the old standard package's share (MONITOR_STD_POOL_SHARE); its coverage now follows from that
   *  budget, the monitors' cost ratios and the watched compute. Only where missing (idempotent). */
  42: (raw) => {
    const p = (raw as unknown as GameStateV2).player;
    if (p?.policies && typeof p.policies.monitorBudget !== 'number') p.policies.monitorBudget = MONITOR_STD_POOL_SHARE;
  },
  /** 43 → 44 (RD-C01): drop the v2 knot table and the dead production-readout fields (idempotent). */
  43: (raw) => {
    const s = raw as unknown as GameStateV2;
    const prod = s.hidden?.timeline?.prod as unknown as Record<string, unknown> | undefined;
    if (prod) {
      delete prod.knots;
      // RD-C04 (same bump): kappa / etaSC had no reader once the knots went.
      delete prod.kappa;
      delete prod.etaSC;
    }
    // RD-C02 (same unreleased bump): the derived calShift bridge is gone.
    if (s.hidden?.timeline) delete (s.hidden.timeline as unknown as Record<string, unknown>).calShift;
    // RD-C07 (same bump): the cut paradigm P26 leaves the paradigm data (its state and hidden draw are dropped).
    if (s.player?.paradigms) delete s.player.paradigms.P26;
    if (s.hidden?.paradigmSuccess) delete s.hidden.paradigmSuccess.P26;
    const cores = [s.player, s.china?.lab?.core, ...(s.rivals ?? []).map((r) => r.core)];
    for (const c of cores) {
      // RD-C04 (same bump): BaseModel.scale and VersionBuild.misuseMult had no reader.
      const m = (c as { models?: { bases?: Record<string, unknown>[]; versions?: { build?: Record<string, unknown> }[] } } | undefined)?.models;
      for (const b of m?.bases ?? []) delete b.scale;
      for (const v of m?.versions ?? []) if (v.build) delete v.build.misuseMult;
      const pc = c?.prodCache as unknown as { Ddata?: unknown; parts?: Record<string, unknown>; elast?: Record<string, unknown>; ratios?: Record<string, unknown> } | undefined;
      if (!pc) continue;
      delete pc.Ddata;
      delete pc.parts?.base;
      delete pc.elast?.train;
      delete pc.elast?.data;
      delete pc.ratios?.d;
    }
  },
  /** 44 → 45 (RD-B02): a run in flight (running or paused) gets the launch-snapshot fields it lacks (a base's draw and P24
   *  bonus, a continue run's draw, a post-train's domainG, P07 flag and serving FLOP part; R0's suites), computed on the save's day:
   *  its true launch values are gone, and today's are what completion read until now. Fields it has are kept
   *  (idempotent). Finished runs are left as they are (nothing reads their snapshot). */
  44: (raw) => {
    const s = raw as unknown as GameStateV2;
    // RD-B03: keep the environments the save had (idempotent: a stored suite is left as it is).
    if (s.player) for (const f of unbuiltSuiteFamilies(s)) keepUnlockedSuite(s, f);
    for (const r of s.player?.models?.runs ?? []) {
      if (r.status !== 'running' && r.status !== 'paused') continue;
      fillRecipe(s, r);
    }
  },
  /** 45 → 46 (RD-B12): sector packs live on their product. Each product's sectorFocus becomes packs with the world's
   *  certification day for the sector (world.fx.certDay is removed); a certified sector no product carries is dropped
   *  (its pack was already lost; the sector can be packed again). Idempotent. */
  45: (raw) => {
    const s = raw as unknown as GameStateV2;
    const fx = s.world?.fx as unknown as { certDay?: Partial<Record<string, number>> } | undefined;
    const cert = fx?.certDay ?? {};
    const day = s.time?.day ?? 0;
    for (const d of s.player?.deployments ?? []) {
      const o = d as unknown as { sectorFocus?: string[]; packs?: unknown };
      if (!Array.isArray(o.packs)) d.packs = (o.sectorFocus ?? []).map((sec) => ({ sector: sec as SectorId, certDay: cert[sec] ?? day }));
      delete o.sectorFocus;
    }
    if (fx) delete fx.certDay;
  },
  /** 46 → 47 (RD-U01): every stored VersionBuild (versions, runs, rivals: found by shape) gets dgD = offL ÷ 1.2 (the
   *  fit's old conversion) and loses offL and off; player bases lose off; the player's version domain levels are
   *  recomputed as λ(G_d). Idempotent. */
  46: (raw) => {
    const s = raw as unknown as GameStateV2;
    const seen = new Set<object>();
    const walk = (x: unknown) => {
      if (!x || typeof x !== 'object' || seen.has(x)) return;
      seen.add(x);
      if (Array.isArray(x)) { for (const y of x) walk(y); return; }
      const o = x as Record<string, unknown>;
      if ('gPre' in o && 'dgRL' in o && 'sD' in o) {
        if (!o.dgD) {
          const dgD: Record<string, number> = {};
          for (const [d, v] of Object.entries((o.offL ?? {}) as Record<string, number>)) if (v) dgD[d] = v / 1.2;
          o.dgD = dgD;
        }
        delete o.offL;
        delete o.off;
      }
      for (const y of Object.values(o)) walk(y);
    };
    walk(s.player);
    walk(s.rivals);
    walk(s.hidden);
    for (const b of s.player?.models?.bases ?? []) delete (b as unknown as { off?: unknown }).off;
    const w = s.hidden?.timeline;
    if (w && s.player) {
      const p19 = adopted(s, 'P19');
      for (const v of s.player.models?.versions ?? []) if (v.build) v.domains = domainsOf(w, v.G, v.build, p19);
    }
  },
};

export function serialize(s: GameStateV2): string {
  return JSON.stringify(s);
}

export function deserialize(json: string): GameStateV2 {
  const raw = JSON.parse(json) as Record<string, unknown>;
  if (raw.version !== 2) throw new Error(`not a v2 save (version ${String(raw.version)})`);
  let rev = Number(raw.schemaRev ?? 0);
  if (!(rev >= MIN_SCHEMA_REV)) throw new Error(OLD_SAVE_MESSAGE);
  if (rev > SCHEMA_REV) throw new Error(`save is from a newer build (schemaRev ${rev} > ${SCHEMA_REV})`);
  while (rev < SCHEMA_REV) {
    const m = migrations[rev];
    if (!m) throw new Error(`no migration from schemaRev ${rev}`);
    m(raw);
    rev++;
    raw.schemaRev = rev;
  }
  return raw as unknown as GameStateV2;
}

/** 64-bit (two FNV-1a 32 lanes) hex hash of the serialised state. Determinism tests compare these. */
export function hashString(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) ^ (h2 >>> 15);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function stateHash(s: GameStateV2): string {
  return hashString(serialize(s));
}
