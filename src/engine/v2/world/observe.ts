// W2: the shared inputs every outside actor reads (design/world/OUTSIDE-WORLD.md §2 R1-R2, §3). Pure selectors: no state,
// no RNG, no mutation, deterministic; each is cheap enough to call daily (attention builds the market mix once unless a
// mix is passed in). Outsiders read public facts, never private evaluation flags (R1).
//   Public milestones: the player's are the days its deployed (external, not internal-only) versions meet the one milestone
//   predicate (versionMilestones). An NPC lab's public view (npc/public.ts) has no milestone notion, so its milestone counts
//   as public on its first release day on or after (day reached + the lab's release lag): its public model carries the
//   level from the next release on (npc/lab.ts). China's opacity is already in its public view; nothing is added here.
//   Frontier: months behind the reference leader, as outsiders see it (player: its deployed models' best G read against the
//   leader's recorded line; NPC: the public view's reported lag), so the two sit on one axis.
import { hasCommitment } from '../actors/commitments';
import { ws4r } from '../actors/state';
import { versionMilestones } from '../departments/workfit';
import { lagDays } from '../models/capability';
import { CHINA_ID, otherLabs, PLAYER_ID, versionById } from '../models/labs';
import { DAYS_PER_MONTH, persOf } from '../npc/lab';
import { publicOf } from '../npc/public';
import { RELEASE_CADENCE_DAYS } from '../../../data/v2/npcLabs';
import { consumerUsers } from '../worldfx/revenue';
import { worldMix, type WorldMix } from '../worldfx/mix';
import type { GameStateV2, LabId, RivalLab } from '../types';

/** [D] The shared-input constants (registered in balance/params/worldfx.ts). */
export const OBSERVE = {
  /** A lab this close to the government frontier (months) has full frontier attention (spec §3.2). */
  nearFrontierMonths: 3,
  /** Further months behind that halve the frontier attention. */
  attentionHalvingMonths: 3,
  /** Half-life of a public incident's weight (days; about 6 months, spec §3.3). */
  incidentHalfLifeDays: 182,
  /** The US government's view of the player's internal milestones under briefing level 1 trails by this many days. */
  briefing1DelayDays: 90,
} as const;

export interface PublicMilestone { day: number; lab: LabId }
/** Milestone index (0..6) → the first day any lab showed it publicly and which lab. */
export type MilestoneBoard = Partial<Record<number, PublicMilestone>>;

const NMS = 7;

function offer(board: MilestoneBoard, i: number, day: number, lab: LabId) {
  const cur = board[i];
  if (!cur || day < cur.day) board[i] = { day, lab };
}

/** The first day each milestone shows on a player external deployment (its current version, from the day it went in). */
function playerPublicDays(s: GameStateV2): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(NMS).fill(undefined);
  for (const d of s.player.deployments) {
    if (d.channel === 'internal' || d.kind === 'internal') continue;
    const v = versionById(s, d.versionId);
    if (!v) continue;
    const day = d.versionSince ?? d.startDay;
    if (day > s.time.day) continue;
    const m = versionMilestones(s, v);
    for (let i = 0; i < NMS; i++) if (m[i] && (out[i] === undefined || day < out[i]!)) out[i] = day;
  }
  return out;
}

/** The first release day of an NPC lab on or after `t` (its releases are phase + k × cadence). */
const releaseOnOrAfter = (phase: number, t: number) => phase + Math.max(0, Math.ceil((t - phase) / RELEASE_CADENCE_DAYS)) * RELEASE_CADENCE_DAYS;

/** The day an NPC lab's milestone is public (its first release on or after reached + release lag), if it is by today. */
function npcPublicDay(s: GameStateV2, r: RivalLab, reached: number): number | undefined {
  const n = r.npc;
  const day = n ? releaseOnOrAfter(n.phase, reached + persOf(n).releaseLagDays) : reached;
  return day <= s.time.day ? day : undefined;
}

/** For each milestone, the first day any lab showed it publicly, and which lab. */
export function publicMilestones(s: GameStateV2): MilestoneBoard {
  const board: MilestoneBoard = {};
  const pd = playerPublicDays(s);
  for (let i = 0; i < NMS; i++) if (pd[i] !== undefined) offer(board, i, pd[i]!, PLAYER_ID);
  for (const r of otherLabs(s)) {
    for (let i = 0; i < NMS; i++) {
      const reached = r.core.milestoneDays[i as 0];
      if (reached === undefined) continue;
      const day = npcPublicDay(s, r, reached);
      if (day !== undefined) offer(board, i, day, r.core.id);
    }
  }
  return board;
}

/** What the US government sees: the public milestones plus the player's internal ones it is briefed on (briefing >= 2 or a
 *  live pre-deploy-testing commitment: from the day reached; briefing 1: 90 days later [D]). NPC labs: as public. */
export function govMilestones(s: GameStateV2): MilestoneBoard {
  const board = publicMilestones(s);
  const brief = s.player.policies.govBriefing;
  const full = brief >= 2 || hasCommitment(s, 'preDeployTesting');
  if (full || brief === 1) {
    const delay = full ? 0 : OBSERVE.briefing1DelayDays;
    for (let i = 0; i < NMS; i++) {
      const reached = s.player.milestoneDays[i as 0];
      if (reached !== undefined && reached + delay <= s.time.day) offer(board, i, reached + delay, PLAYER_ID);
    }
  }
  return board;
}

export interface Frontier {
  /** The lab with the best public capability, null when no lab shows a model. */
  lab: LabId | null;
  /** Its public model's G (OOM, the engine's effective-compute measure). */
  G: number | null;
  /** Months behind the frontier holder, as outsiders see it (0 for the holder); a lab with no public model is absent. */
  behindMonths: Partial<Record<LabId, number>>;
  /** The same public lags relative to the reference leader (negative: ahead of it); the axis behindMonths is built on. */
  lagMonths: Partial<Record<LabId, number>>;
}

/** The reference leader the lags are read against: the leader-kind NPC lab, else the NPC lab with the best G. */
function referenceLeader(s: GameStateV2): LabId | undefined {
  const act = s.rivals.filter((r) => r.core.status === 'active');
  const lead = act.find((r) => r.npc?.kind === 'leader');
  if (lead) return lead.core.id;
  let best: RivalLab | undefined;
  for (const r of act) if (!best || r.internal.G > best.internal.G) best = r;
  return best?.core.id;
}

/** The best capability shown publicly and every lab's months behind it. */
export function frontier(s: GameStateV2): Frontier {
  const lag: Partial<Record<LabId, number>> = {};
  const gOf: Partial<Record<LabId, number>> = {};
  const ref = referenceLeader(s);
  // The player: the best G among its live external deployments' versions, against the reference leader's recorded line.
  let gDep = -Infinity;
  for (const d of s.player.deployments) {
    if (d.channel === 'internal' || d.kind === 'internal' || d.status === 'withdrawn') continue;
    const v = versionById(s, d.versionId);
    if (v && v.G > gDep) gDep = v.G;
  }
  if (Number.isFinite(gDep)) {
    gOf[PLAYER_ID] = gDep;
    lag[PLAYER_ID] = ref ? lagDays(s, gDep, ref) / DAYS_PER_MONTH : 0;
  }
  for (const r of otherLabs(s)) {
    const m = r.publicModel;
    if (r.core.status !== 'active' || !m) continue;
    gOf[r.core.id] = m.G;
    lag[r.core.id] = publicOf(s, r).lagDays / DAYS_PER_MONTH;
  }
  let lab: LabId | null = null;
  let best = Infinity;
  for (const id of Object.keys(lag)) if (lag[id]! < best) { best = lag[id]!; lab = id; }
  const behindMonths: Partial<Record<LabId, number>> = {};
  for (const id of Object.keys(lag)) behindMonths[id] = lag[id]! - best;
  return { lab, G: lab ? gOf[lab] ?? null : null, behindMonths, lagMonths: lag };
}

/** The best US public level over China's, in months (positive: the US leads); null if either shows no public model. */
export function usLeadOverChinaMonths(s: GameStateV2, f: Frontier = frontier(s)): number | null {
  const c = f.lagMonths[CHINA_ID];
  if (c === undefined) return null;
  let us = Infinity;
  for (const id of Object.keys(f.lagMonths)) if (id !== CHINA_ID && f.lagMonths[id]! < us) us = f.lagMonths[id]!;
  return Number.isFinite(us) ? c - us : null;
}

/** The lab's share of AI users: the mean of its consumer user share (US and ROW by users) and its enterprise customer share
 *  (the mean over region × sector cells of its customer stock), summed over the lab's providers. 0 when it sells nothing. */
export function reachShare(s: GameStateV2, lab: LabId, mix: WorldMix = worldMix(s)): number {
  const idx: number[] = [];
  mix.providers.forEach((p, i) => { if (p.lab === lab) idx.push(i); });
  if (!idx.length) return 0;
  const sum = (a: number[] | undefined) => idx.reduce((x, i) => x + (a?.[i] ?? 0), 0);
  let uTot = 0;
  let uLab = 0;
  for (const r of ['US', 'ROW'] as const) {
    const u = consumerUsers(s, r);
    uTot += u;
    uLab += u * sum(mix.consumer[r]?.share);
  }
  let cells = 0;
  let ent = 0;
  for (const reg of Object.values(mix.sec)) for (const sm of Object.values(reg)) { cells++; ent += sum(sm.share); }
  const consumer = uTot > 0 ? uLab / uTot : 0;
  const enterprise = cells ? ent / cells : 0;
  return Math.min(1, (consumer + enterprise) / 2);
}

/** Attention on a lab, 0..1 (spec §3.2): max(frontier part, reach part). */
export function attention(s: GameStateV2, lab: LabId, f: Frontier = frontier(s), mix?: WorldMix): number {
  const behind = f.behindMonths[lab];
  const front = behind === undefined ? 0 : behind <= OBSERVE.nearFrontierMonths ? 1 : Math.pow(0.5, (behind - OBSERVE.nearFrontierMonths) / OBSERVE.attentionHalvingMonths);
  return front >= 1 ? 1 : Math.max(front, reachShare(s, lab, mix));
}

const decay = (age: number) => Math.pow(0.5, age / OBSERVE.incidentHalfLifeDays);

/** Severity-weighted public incidents of one lab, each halving every OBSERVE.incidentHalfLifeDays. The player's: disclosed
 *  or leaked incident records (their day); NPC labs': ws4.rivalIncidents (already public). */
export function incidentHeatOf(s: GameStateV2, lab: LabId): number {
  let h = 0;
  if (lab === PLAYER_ID) {
    for (const i of s.player.safety.incidents) if ((i.status === 'disclosed' || i.status === 'leaked') && i.day <= s.time.day) h += i.severity * decay(s.time.day - i.day);
  } else {
    for (const i of ws4r(s).rivalIncidents) if (i.lab === lab && i.day <= s.time.day) h += i.severity * decay(s.time.day - i.day);
  }
  return h;
}

/** The world's incident heat: every lab's public incidents together. */
export function incidentHeat(s: GameStateV2): number {
  let h = incidentHeatOf(s, PLAYER_ID);
  for (const i of ws4r(s).rivalIncidents) if (i.day <= s.time.day) h += i.severity * decay(s.time.day - i.day);
  return h;
}

/** The public incidents behind `incidentHeat`, heaviest first: lab, day, severity, what each still weighs and the share of its
 *  weight left (it halves every OBSERVE.incidentHalfLifeDays). UI readout. */
export function incidentList(s: GameStateV2): { lab: LabId; day: number; severity: number; weight: number; left: number }[] {
  const out: { lab: LabId; day: number; severity: number; weight: number; left: number }[] = [];
  for (const i of s.player.safety.incidents) if ((i.status === 'disclosed' || i.status === 'leaked') && i.day <= s.time.day) out.push({ lab: PLAYER_ID, day: i.day, severity: i.severity, weight: i.severity * decay(s.time.day - i.day), left: decay(s.time.day - i.day) });
  for (const i of ws4r(s).rivalIncidents) if (i.day <= s.time.day) out.push({ lab: i.lab, day: i.day, severity: i.severity, weight: i.severity * decay(s.time.day - i.day), left: decay(s.time.day - i.day) });
  return out.sort((a, b) => b.weight - a.weight);
}

/** The two parts of attention on a lab (spec §3.2): the frontier part (1 within OBSERVE.nearFrontierMonths of the public frontier,
 *  halving every OBSERVE.attentionHalvingMonths beyond) and the reach part (share of AI users and customers). Attention is the larger. */
export function attentionParts(s: GameStateV2, lab: LabId): { frontier: number; reach: number; behindMonths: number | null; attention: number } {
  const f = frontier(s);
  const behind = f.behindMonths[lab];
  const front = behind === undefined ? 0 : behind <= OBSERVE.nearFrontierMonths ? 1 : Math.pow(0.5, (behind - OBSERVE.nearFrontierMonths) / OBSERVE.attentionHalvingMonths);
  return { frontier: front, reach: reachShare(s, lab), behindMonths: behind ?? null, attention: attention(s, lab, f) };
}
