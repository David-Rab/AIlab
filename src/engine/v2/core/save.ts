// Save format, migrations, state hash (V2-SPEC §2.5). Owner: WS1.
import { ensureWs3 } from '../finance/ext';
import { keyOf, staffOf, teamsFromStaff } from '../departments/teams';
import type { AgendaId, GameStateV2, PlayerLab, StaffByRole, TeamHiring } from '../types';
import { hash32 } from './rng';
import { initialResearch, initialTree, nextLineProject } from '../models/tree';
import { LEADER_FEATURES, PRICE_TIERS, tierOfIndex } from '../../../data/v2/features';
import { initialAgents } from '../departments/agents';
import { fptOfBuild } from '../departments/workfit';
import { REGIONS, SECTORS } from '../../../data/v2/sectors';
import { workerTarget } from '../worldfx/use';
import { CONSUMER_MKT, SEATS } from '../../../data/v2/serving';
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { PROJECT_BY_ID, isLineNode } from '../../../data/v2/tree';
import { safFromProgress } from '../safety/lineProjects';

/** Bump on any breaking change to types.ts and add a migration from the previous rev. */
/** 12 (model v3 V1): models are built from physical quantities (BaseModel, VersionBuild, BaseDesign, PostDesign changed).
 *  No migration from 11: v2 saves do not carry over (MODEL-V3 §16), deserialize rejects them ("no migration from
 *  schemaRev 11").
 *  13 (model v3 V2): research as ideas (ResearchState stacks, allocations, capability project states; BuildState.alloc;
 *  TrainingRun.recipe). No migration from 12 either ("no migration from schemaRev 12").
 *  14 (model v3 V3): work types and project-level research (TimelineWorld.v3, line pools, candidate pool positions,
 *  research.gRate; the milestone definitions changed). No migration from 13 ("no migration from schemaRev 13").
 *  15 (model v3 V3b): TimelineWorld.v3.sdSC, the derived calShift / simpleCredit and the λ(G) level scale. No migration
 *  from 14 ("no migration from schemaRev 14").
 *  16 (model v3 V4a): serving, products and sectors on work types — WorldFxState.cust (customer stocks), ModelVersion.fpt
 *  (serving FLOP per token), typed features, price tiers as markups over cost. Migration 15 → 16 adds empty customer
 *  stocks (they start at the market's logit shares on the next tick) and fills fpt from each version's base.
 *  17 (model v3 A2a): SectorState.W, the share of a sector's workers who use AI at work (hours of use = A + h·(W − A)).
 *  Migration 16 → 17 starts it at its ceiling W* from the saved sector state.
 *  18 (model v3 A2b): consumer demand from measured anchors — WorldFxState.reach (weekly reach per region, replaces
 *  consumerReach) and WorldFxState.paid (paid-share stocks per region and provider). Migration 17 → 18.
 *  19 (model v3 A2c): SectorState.seat, the paid-seat share of the workers who use AI (who pays for work use). Migration
 *  18 → 19 starts it at the region's start share (SEATS.start).
 *  20 (model v3 B4): ResearchState.wantAuto, the capability projects on "auto" teams wanted. Migration 19 → 20 starts it
 *  empty (every earlier project keeps its number).
 *  21 (model v3 E1): safety research-line projects on the project mechanism (TreeNodeState.saf: stage, candidates with
 *  beliefs, the test in flight). Migration 20 → 21 converts a line project in progress at the same share of its stages. */
export const SCHEMA_REV = 21;
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
    p.build ??= { queue: [], nextId: 1 } as unknown as PlayerLab['build'];
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
    p.policies.trustedToAI = Math.min(1, t);
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
  /** 15 → 16 (model v3 V4a): customer stocks and the versions' serving FLOP per token. */
  15: (raw) => {
    const s = raw as unknown as GameStateV2;
    s.world.fx.cust ??= { US: {}, CN: {}, ROW: {} };
    for (const v of s.player.models.versions) v.fpt ??= fptOfBuild(s, v);
  },
  /** 16 → 17 (model v3 A2a): the workers' AI use stock W per sector, at its ceiling W* = max(A, W_b + (1 − W_b)·F). */
  16: (raw) => {
    const s = raw as unknown as GameStateV2;
    for (const r of REGIONS) for (const def of SECTORS) {
      const st = s.world.sectors[r]?.[def.id];
      if (st && st.W === undefined) st.W = workerTarget(def, r, st.F, st.A);
    }
  },
  /** 17 → 18 (model v3 A2b): weekly reach per region (the old single US-based reach, rescaled from its 0.40 start to the
   *  new 0.46; ROW × 0.85) and paid-share stocks (empty: they start at their targets on the next tick). */
  17: (raw) => {
    const fx = (raw as unknown as GameStateV2).world.fx as GameStateV2['world']['fx'] & { consumerReach?: number };
    if (!fx.reach) {
      const R = CONSUMER_MKT.reach;
      const us = Math.min(R.max, (fx.consumerReach ?? 0.4) * (R.startUS / 0.4));
      fx.reach = { US: us, CN: us * R.row, ROW: us * R.row };
    }
    fx.paid ??= { US: {}, CN: {}, ROW: {} };
    delete fx.consumerReach;
  },
  /** 18 → 19 (model v3 A2c): the paid-seat share of each sector's workers who use AI, at the region's start share. */
  18: (raw) => {
    const s = raw as unknown as GameStateV2;
    for (const r of REGIONS) for (const def of SECTORS) {
      const st = s.world.sectors[r]?.[def.id];
      if (st && st.seat === undefined) st.seat = SEATS.start[r];
    }
  },
  /** 19 → 20 (model v3 B4): no project is on auto teams wanted. */
  19: (raw) => {
    const r = (raw as unknown as GameStateV2).player.research;
    r.wantAuto ??= [];
  },
  /** 20 → 21 (model v3 E1): safety research-line projects run stages (TreeNodeState.saf). A line project in progress
   *  keeps its work: the same share of the stage chain (safety/lineProjects.ts safFromProgress). */
  20: (raw) => {
    const s = raw as unknown as GameStateV2;
    for (const [id, st] of Object.entries(s.player.tree)) {
      const n = PROJECT_BY_ID[id];
      if (!n || !isLineNode(n) || st.status !== 'researching' || st.saf) continue;
      const ag = n.agenda as AgendaId;
      st.saf = safFromProgress(AGENDA_BY_ID[ag].T1, st.progress, s.player.safety.agendas[ag].posterior);
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
