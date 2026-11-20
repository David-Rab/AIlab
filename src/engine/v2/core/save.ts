// Save format, migrations, state hash (V2-SPEC §2.5). Owner: WS1.
import { ensureWs3 } from '../finance/ext';
import { START_CREDIBILITY, typicalRound } from '../finance/promises';
import { dMax } from '../finance/equity';
import { keyOf, staffOf, teamsFromStaff } from '../departments/teams';
import type { AgendaId, GameStateV2, PlayerLab, StaffByRole, TeamHiring } from '../types';
import { hash32 } from './rng';
import { initialResearch, initialTree, nextLineProject } from '../models/tree';
import { LEADER_FEATURES, PRICE_TIERS, tierOfIndex } from '../../../data/v2/features';
import { TRUSTED_MAX_P27 } from '../../../data/v2/agents';
import { partnerDef, PARTNER_TERMS } from '../../../data/v2/deals';
import { initialAgents } from '../departments/agents';
import { divisionOf } from '../finance/parent';
import { sectorValue, seedLabRevenue } from '../finance/story';

/** Bump on any breaking change to types.ts and add a migration from the previous rev. */
export const SCHEMA_REV = 19;
export const AUTOSAVE_KEY = 'ai27.v2.autosave';
export const SLOT_KEYS = ['ai27.v2.slot1', 'ai27.v2.slot2', 'ai27.v2.slot3'] as const;
/** v1 save key: the start screen offers "v1 save found: start new" (no migration). */
export const V1_SAVE_KEY = 'ai27.save.v1';
export const SAVE_BUDGET_BYTES = 1.5 * 1024 * 1024;

/** migrations[rev] upgrades a state at schemaRev = rev to rev + 1. */
export const migrations: Record<number, (s: Record<string, unknown>) => void> = {
  /** 1 → 2 (M2): WS3 `ws3` blocks became required fields of FinanceState, ChipMarket, PowerGrid, CapitalMarkets and
   *  Site; `GameStateV2.ws4` is optional and created lazily, so it needs nothing. */
  1: (raw) => ensureWs3(raw as unknown as GameStateV2),
  /** 2 → 3: the security compute pool is gone (its share moves to data generation); security, product and ops staff are gone. */
  2: (raw) => {
    const s = raw as unknown as GameStateV2;
    const cores = [s.player, s.china?.lab?.core, ...(s.rivals ?? []).map((r) => r.core)].filter(Boolean) as unknown as { split: Record<string, number>; staff: Record<string, number> }[];
    const fix = (o: Record<string, number> | undefined, drop: string[]) => { if (o) for (const k of drop) delete o[k]; };
    for (const c of cores) {
      c.split.synthetic = (c.split.synthetic ?? 0) + (c.split.security ?? 0);
      fix(c.split, ['security']);
      fix(c.staff, ['sec', 'prod', 'ops']);
    }
    const hiring = (s.player as unknown as { hiring?: { target?: Record<string, number>; pipeline?: { role: string }[] } }).hiring;
    fix(hiring?.target, ['sec', 'prod', 'ops']);
    if (hiring?.pipeline) hiring.pipeline = hiring.pipeline.filter((p) => p.role === 'cap' || p.role === 'saf');
  },
  /** 3 → 4 (restructure R1): setup gains the start type (every earlier game is the frontier-leader start) and the
   *  leader-lab flag (off). Later restructure milestones may reject pre-restructure saves instead (BUILD-PLAN D8). */
  3: (raw) => {
    const setup = (raw as { setup?: Record<string, unknown> }).setup;
    if (setup) {
      setup.start ??= 'leader';
      setup.leaderLab ??= false;
    }
  },
  /** 4 → 5 (restructure R3): staff become teams. Headcounts (plus people still in the old hiring pipeline) are cut into
   *  whole Strong teams in the reference split; keep-hiring targets come from the old headcount targets; star hires
   *  come from τ_h. The candidate list starts empty (the weekly tick fills it). */
  4: (raw) => {
    const s = raw as unknown as GameStateV2;
    s.rng.company ??= hash32(s.setup.seed, 'company');
    const p = s.player as unknown as Omit<PlayerLab, 'hiring'> & { hiring?: { target?: StaffByRole; pipeline?: { role: keyof StaffByRole; n: number }[] } | TeamHiring };
    if (Array.isArray(p.teams)) return;
    const old = (p.hiring ?? {}) as { target?: StaffByRole; pipeline?: { role: keyof StaffByRole; n: number }[] };
    const staff: StaffByRole = { cap: p.staff?.cap ?? 0, saf: p.staff?.saf ?? 0 };
    for (const e of old.pipeline ?? []) if (e.role === 'cap' || e.role === 'saf') staff[e.role] += e.n;
    const hiring: TeamHiring = { targets: { eng: 0, 're.cap': 0, 'sci.cap': 0, 're.saf': 0, 'sci.saf': 0 }, candidates: [], filling: [], nextId: 1 };
    p.teams = teamsFromStaff(hiring, staff);
    const tgt = teamsFromStaff({ nextId: 0 }, { cap: Math.max(staff.cap, old.target?.cap ?? 0), saf: Math.max(staff.saf, old.target?.saf ?? 0) });
    for (const t of tgt) hiring.targets[keyOf(t)]++;
    p.hiring = hiring;
    p.stars = Math.max(0, Math.round(((p.tasteHire ?? 1) - 1) / 0.05));
    p.staff = staffOf(p.teams);
  },
  /** 5 → 6 (restructure R4): paradigm projects become tech-tree nodes. Adopted (or succeeded) paradigms are known
   *  nodes; a running project keeps its progress (queued, teams assign tomorrow); a failed one keeps its retry date
   *  and odds; ★ nodes are known. Paradigm FTE and experiment shares are dropped. */
  5: (raw) => {
    const s = raw as unknown as GameStateV2;
    const p = s.player as PlayerLab;
    if (p.tree && p.research) return;
    p.tree = initialTree(s.setup);
    p.research = initialResearch();
    type Old = { status: string; progress?: number; revealedDay?: number; retryDay?: number; attempts?: number; priorMult?: number; fte?: number; expShare?: number };
    for (const [id, o] of Object.entries((p.paradigms ?? {}) as unknown as Record<string, Old>)) {
      const day = o.revealedDay ?? 0;
      if (o.status === 'adopted' || o.status === 'succeeded') {
        p.tree[id] = { status: 'known', progress: 1, day };
        p.paradigms[id] = { status: 'adopted', progress: 1, revealedDay: day };
      } else if (o.status === 'researching') {
        p.tree[id] = { status: 'researching', progress: o.progress ?? 0, attempts: o.attempts ?? 1, ...(o.priorMult !== undefined ? { priorMult: o.priorMult } : {}) };
        p.research.queue.push(id);
        p.paradigms[id] = { status: 'researching', progress: o.progress ?? 0 };
      } else if (o.status === 'failed') {
        p.tree[id] = { status: 'failed', progress: 0, day, attempts: o.attempts ?? 1, priorMult: o.priorMult ?? 0.5, retryDay: o.retryDay ?? day + 180 };
        p.paradigms[id] = { status: 'failed', progress: 0, revealedDay: day };
      } else p.paradigms[id] = { status: 'available', progress: 0 };
    }
  },
  /** 6 → 7 (restructure R5): a base's scale becomes its size (compact 0.1, frontier 1, stretch 3 × the frontier run);
   *  the engineers' build queue starts empty, so runs already in flight are set up. */
  6: (raw) => {
    const s = raw as unknown as GameStateV2;
    const p = s.player as PlayerLab;
    const SIZE: Record<string, number> = { compact: 0.1, frontier: 1, stretch: 3, continue: 0.3 };
    const fix = (d?: { scale?: string; size?: number }) => {
      if (!d || d.size !== undefined) return;
      d.size = SIZE[d.scale ?? 'frontier'] ?? 1;
      delete d.scale;
    };
    for (const b of p.models.bases) fix(b.design as unknown as { scale?: string });
    for (const r of p.models.runs) fix(r.base as unknown as { scale?: string } | undefined);
    p.build ??= { queue: [], nextId: 1 };
    p.policies.spareTraining ??= 'research';
  },
  /** 7 → 8 (restructure R6): deployments become products (kind, price tier from the nearest price index, no features,
   *  no mini or monitor); the lab has the leader start's features (sector packs); policies Auto serving on, upgrade
   *  off, auto-evaluate on. The spare-training choice of the saved game is kept. */
  7: (raw) => {
    const s = raw as unknown as GameStateV2;
    const p = s.player as PlayerLab;
    for (const d of p.deployments) {
      d.kind ??= d.channel === 'internal' ? 'internal' : d.channel === 'open' ? 'open' : 'product';
      if (!d.price) {
        d.price = tierOfIndex(d.priceIndex ?? 1);
        d.priceIndex = PRICE_TIERS[d.price];
      }
      d.features ??= [];
    }
    p.features ??= [...LEADER_FEATURES];
    p.policies.servingAuto ??= true;
    p.policies.upgradeToNewest ??= false;
    p.policies.autoEvaluate ??= true;
  },
  /** 8 → 9 (restructure R7): internal agent packages. The internal agent becomes routine research's model; the safety
   *  agent model and share become the safety package; the monitoring share becomes monitors on routine and frontier
   *  research (a copy of the watched model) when it was on; per-agenda and per-case AI labour become one Trusted-to-AI
   *  share (the largest one in use). */
  8: (raw) => {
    const s = raw as unknown as GameStateV2;
    const p = s.player as PlayerLab;
    if (p.agents) return;
    const m = p.models as unknown as { internalAgent?: string };
    const sd = p.safety as unknown as { agentVersion?: string; agentShare?: number; monitoringShare?: number; agendas: Record<string, { aiLabour?: number }>; investigations: { aiLabour?: number }[] };
    p.agents = initialAgents(m.internalAgent ?? p.models.versions[0]?.id ?? 'V0');
    if (sd.agentVersion) p.agents.safety.versionId = sd.agentVersion;
    p.agents.safety.compute = sd.agentShare ?? 0;
    if ((sd.monitoringShare ?? 0.2) <= 0.01) {
      delete p.agents.capRoutine.monitorId;
      delete p.agents.capFrontier.monitorId;
    }
    let t = 0;
    for (const a of Object.values(sd.agendas)) {
      t = Math.max(t, a.aiLabour ?? 0);
      delete a.aiLabour;
    }
    for (const i of sd.investigations) {
      t = Math.max(t, i.aiLabour ?? 0);
      delete i.aiLabour;
    }
    p.policies.trustedToAI = Math.min(TRUSTED_MAX_P27, t);
    delete m.internalAgent;
    delete sd.agentVersion;
    delete sd.agentShare;
    delete sd.monitoringShare;
  },
  /** 9 → 10 (restructure R8): research lines are tree projects. Funding levels, hazards and refresh projects go; each
   *  safety science team without a project joins a line, the most-funded lines first (its next idea, else its
   *  follow-up). Tools keep their M½ (upkeep by safety research engineers takes over). */
  9: (raw) => {
    const s = raw as unknown as GameStateV2;
    const p = s.player as PlayerLab;
    const ags = p.safety.agendas as unknown as Record<string, { fte?: number; hazardAcc?: number; refresh?: unknown; deadEndTM?: number }>;
    const byFte = Object.entries(ags).filter(([, a]) => (a.fte ?? 0) > 0).sort((x, y) => (y[1].fte ?? 0) - (x[1].fte ?? 0)).map(([id]) => id);
    for (const a of Object.values(ags)) {
      delete a.fte;
      delete a.hazardAcc;
      delete a.refresh;
      a.deadEndTM ??= 0;
    }
    const idle = p.teams.filter((t) => t.role === 'sci' && t.dept === 'saf' && !t.projectId);
    for (const [i, t] of idle.entries()) {
      const ag = byFte[i % Math.max(1, byFte.length)] as AgendaId | undefined;
      const id = ag ? nextLineProject(s, ag) : undefined;
      if (!id) continue;
      t.projectId = id;
      if (!p.research.queue.includes(id)) p.research.queue.push(id);
    }
  },
  /** 10 → 11 (jank J2): spare serving compute policy (research agents by default; PR1). Build-queue rates, the
   *  utilisation average and the team `manual` flag are optional and start empty. */
  10: (raw) => {
    const p = (raw as unknown as GameStateV2).player;
    p.policies.spareServing ??= 'research';
  },
  /** 11 → 12 (finance v3 FIN1): SPV leasebacks become financing leases (kind finLease; the old 12%/4-year entries keep
   *  their payments); SPV- or JV-funded sites still being built get a lease at 9% (BB) on what was funded; the spv,
   *  neocloud and mega-JV deal templates and the JV are removed; LTA orders are firm tranches; the trailing operating
   *  cash flow starts from last quarter's; board blocks on removed action ids move to Buy chips / Rent compute. */
  11: (raw) => {
    const s = raw as unknown as GameStateV2;
    const f = s.player.finance;
    const fx = f.ws3 as unknown as Record<string, unknown> & GameStateV2['player']['finance']['ws3'];
    // The SPV's leaseback paid 12% (Keystone Capital), the mega-JV's 10% (FIN4r L12: it read 12% for both).
    for (const c of f.ledger as unknown as { kind: string; rate?: number; payee: string }[]) if (c.kind === 'spvRVG') { c.kind = 'finLease'; c.rate = c.payee === 'Keystone Capital' ? 0.12 : 0.1; }
    for (const x of s.player.sites) {
      const w = x.ws3 as unknown as Record<string, unknown> & typeof x.ws3;
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
  /** 12 → 13 (finance v3 FIN2): investor credibility (start value by start type) and an empty promise list (rounds
   *  raised before FIN2 promised nothing); the revenue plan, the trailing raised tally and the patientQ start mod are
   *  gone; the milestone histories start empty (the raise card falls back to the pipeline and market pace). A pending
   *  or repriced round from before FIN2 closes without a thesis. */
  12: (raw) => {
    const s = raw as unknown as GameStateV2;
    const f = s.player.finance as GameStateV2['player']['finance'] & { raisedLast4q?: number };
    const start = s.setup.start ?? 'leader';
    f.credibility ??= START_CREDIBILITY[start];
    f.promises ??= [];
    delete f.raisedLast4q;
    delete (f.ws3 as unknown as Record<string, unknown>).revenuePlan;
  },
  /** 13 → 14 (finance v3 FIN3a): board votes are deterministic and never block, so the never-filled pending-approvals
   *  list goes and the 90-day blocks old rejections left on raises, deals, borrowing and cloud contracts are lifted
   *  (E37's capex freeze on sites and chips stays). */
  13: (raw) => {
    const s = raw as unknown as GameStateV2;
    delete (s.player.board as unknown as Record<string, unknown>).pendingApprovals;
    const bu = (s.player.finance.ws3 as unknown as { blockedUntil?: Record<string, number> } | undefined)?.blockedUntil;
    if (bu) for (const k of Object.keys(bu)) if (['fin.raise', 'fin.acceptDeal', 'fin.drawDebt', 'cmp.rentCompute'].includes(k) || k.startsWith('deal:')) delete bu[k];
  },
  /** 14 → 15 (finance v3 FIN3b): E37 is gone, so its capex freeze (the last board block) and the block list go; the
   *  ouster is a deterministic vote with no staff-revolt reinstatement, so the reinstatement day goes. An E37 decision
   *  still pending is dropped. */
  14: (raw) => {
    const s = raw as unknown as GameStateV2;
    const fx = s.player.finance.ws3 as unknown as Record<string, unknown> | undefined;
    if (fx) {
      delete fx.blockedUntil;
      delete fx.reinstatedDay;
    }
    const ev = s.events as unknown as { pending?: { id: string }[] };
    if (Array.isArray(ev.pending)) ev.pending = ev.pending.filter((d) => d.id !== 'E37');
  },
  /** 15 → 16 (finance v3 FIN4a): one partner offer flow. Deal records move from templates to partner kinds: a
   *  hyperscaler (old hyperscaler equity and custom-ASIC deals), a chip vendor, a sovereign; vendor-financing deals go
   *  (a vendor note stays as a bond-like loan with its spread and maturity). Stakes from before the start become legacy
   *  holders. The strings that did nothing go (observer, IP rights, in-country site); exclusivity and the revenue share
   *  stay, a deal running as before (the revenue share to six years after signing; custom chips and chip vendors keep
   *  their rationing priority for the supply term). Open offers go (terms are now computed live), and so do partner
   *  observer seats (hyperscalers hold no seats). Signed contracts, orders and tranches are kept as signed. */
  15: (raw) => {
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
  /** 16 → 17 (finance v3 FIN5c): a big-tech division gets its budget year: this year's budget at the plan (as it was
   *  paid), savings carried in estimated as cash above what this year has paid so far; the parent sets goals and the
   *  next budget at the next review. A division never stays in distress (no runway verdict). */
  16: (raw) => {
    const s = raw as unknown as GameStateV2;
    if (divisionOf(s) && s.player.finance.state !== 'insolvent') s.player.finance.state = 'healthy';
  },
  /** 17 → 18 (finance v3 FIN4r review fixes): a live promise stores a typical round at its close (the dilution limit
   *  at its round's pre-money, the floor of its weight), read from its round; a partner deal's supply drops the inert
   *  order id; leases migrated from the old SPV and mega-JV are keyed like any lease (L-fin-<site>, so What we owe names
   *  the site) and the JV's keeps its 10% rate. Round tranches from before keep no shares to cancel (as signed). */
  17: (raw) => {
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
  /** 18 → 19 (finance v3 FIN5a): the valuation is the story split (sector value × share). The narrative premium N is
   *  gone; private rivals get a revenue history (the last four quarters at the sector's ×3 a year, as at a new start);
   *  the last mark is read off the saved valuation (share = valuation ÷ today's sector value), so the first mark after
   *  loading moves half-way from it to the story like any other. */
  18: (raw) => {
    const s = raw as unknown as GameStateV2;
    const f = s.player.finance;
    delete (f as unknown as Record<string, unknown>).narrative;
    ensureWs3(s);
    seedLabRevenue(s);
    const S = sectorValue(s).S;
    if (f.valuation > 0 && S > 0) f.ws3.mark = { S, share: Math.min(1, f.valuation / S) };
  },
};

export function serialize(s: GameStateV2): string {
  return JSON.stringify(s);
}

export function deserialize(json: string): GameStateV2 {
  const raw = JSON.parse(json) as Record<string, unknown>;
  if (raw.version !== 2) throw new Error(`not a v2 save (version ${String(raw.version)})`);
  let rev = Number(raw.schemaRev ?? 0);
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
