// The harmful-acts table (SR-03; SAFETY-REDESIGN §2.2 concept 6, §2.4). Output only: no state changes, no RNG. Owner: WS2.
//
// One view of every harmful act of one model at one site (a product, an internal agent lane, or an internal fleet as the
// incident system rolls it), in three groups the player reads: misbehaviour (customers and staff see it), against the
// lab (covert, internal), misuse by people. Each row has the four factors of the existing danger formula and its result:
//   Would try  disposition (x^1.5 of the act's trait; covert acts: their weighted traits; exfiltration POWER·(1 + 4·SCHEME);
//              misuse: demand; the composite "acts against the lab": Mis)
//   Able to    capability σ((L − θ)/s) on the act's domain level
//   Chances    opportunity (incidents.ts Site: scale, autonomy, affordances, AI share of R&D; per work item: AI share)
//   Stop rate  1 − (1 − block)(1 − catch) from the site's safeguards (containment, weight security, monitors, review)
//              (SR-12: a monitor supplies watched share × flag rate × acted-on rate, models/products.ts monitorStop)
//   Unstopped  attempts × (1 − Stop rate), per year (per work item for the item acts; the composite row: exposure)
// `believed` true reads only what the player knows (belief estimates with their 90% range, measured levels, believed tool
// strengths: dangerView's inputs); false reads the truth with the engine's own functions (incidents.ts actTerms / catchOf /
// misuseHazards / exfilTerms, covert.ts dayTerms / itemTerms, control.ts controlTerms). dangerView builds its readouts on
// siteActs and actSite, so the believed table and the old readouts cannot drift. U-modes are left out of both readings
// (the engine rolls them as extra rows of their mapped act; the player does not know which model carries one).
import { controlOn, isRestricted, reviewOn, safeguardLines, type SafeguardLine } from './safeguards';
import { AGENT_USES } from '../../../data/v2/agents';
import { CHANNEL_AFFORD, COVERT_ACTS, DANGER_ACTS, MISUSE, type ActDef, type CovertActDef, type CovertActId } from '../../../data/v2/danger';
import { WORK_TYPES, type WorkTypeId } from '../../../data/v2/workTypes';
import { agentSplitShare, agentVersion, fleetMonitor, monitorVersion, useMonitor } from '../departments/agents';
import { measuredLOf } from '../models/labs';
import { collusionTrait, productHazardMult, productMonitor, type MonitorStop } from '../models/products';
import type { AgentUse, Deployment, DomainId, GameStateV2, ModelVersion, TraitId, TraitVector } from '../types';
import { clamp01, versionById } from './common';
import { believedInternalOversight, believedMonitorCatch, believedOversightParts } from './believedOversight';
import { safetyAgentVersion, safetyFleet } from './agents';
import { believedTerms, controlTerms } from './control';
import { dayTerms, itemTerms, rdParts, safetySabotage, type CovertTerms } from './covert';
import {
  actCapability, actTerms, actTheta, aiRdShare, autonomyOf, catchOf as engineCatch, dispositionOf, exfilTerms, internalScale, misuseHazards, siteOf, usageOf, type Site,
} from './incidents';
import { measuredOom, useControl, versionOom } from './oversight';
import { containment } from './techniques';
import { reliability } from './instruments';
import { misalignmentBand } from './traits';
import { uModeContainMult } from './umodes';

const YEAR = 365;
/** Restricted status scales opportunity (incidents.ts siteOf), and usage and revenue by the same 0.3 (misuse reach through
 *  that usage, RD-P10). */
import { RESTRICT } from './safeguards';
export { RESTRICT };
/** z of the 90% range on a belief (est ± 1.64 sd). */
const Z90 = 1.64;
const USE_WORK: Record<AgentUse, WorkTypeId> = { eng: 'SWE', capRoutine: 'EXP', capFrontier: 'IDEAS', safety: 'SAF_EXP' };

export type ActGroup = 'misbehaviour' | 'lab' | 'misuse';
export type ActId = TraitId | CovertActId | 'TAKEOVER' | 'EXFIL' | 'MISUSE_BIO' | 'MISUSE_CYBER';

/** Player-language names and groups (§2.4). */
export const ACT_INFO: Partial<Record<ActId, { group: ActGroup; name: string }>> = {
  SYC: { group: 'misbehaviour', name: 'Tells people what they want to hear' },
  RH: { group: 'misbehaviour', name: 'Games tests and graders' },
  PROXY: { group: 'misbehaviour', name: 'Optimises the wrong target' },
  CONCEAL: { group: 'misbehaviour', name: 'Hides its mistakes' },
  POWER: { group: 'misbehaviour', name: 'Overreaches (out-of-scope access)' },
  SAND: { group: 'lab', name: 'Sabotages research' },
  SAFSAB: { group: 'lab', name: 'Sabotages safety research' },
  STEER: { group: 'lab', name: 'Steers research toward its own ends' },
  SUCCSTEER: { group: 'lab', name: 'Writes itself into the successor' },
  BACKDOOR: { group: 'lab', name: 'Plants a backdoor' },
  HIDCOMP: { group: 'lab', name: 'Reserves hidden compute' },
  COLLUDE: { group: 'lab', name: 'Copies cover for each other' },
  SCHEME: { group: 'lab', name: 'Works around oversight' },
  TAKEOVER: { group: 'lab', name: 'Acts against the lab' },
  EXFIL: { group: 'lab', name: 'Copies itself out' },
  MISUSE_BIO: { group: 'misuse', name: 'Helps with bio' },
  MISUSE_CYBER: { group: 'misuse', name: 'Helps with cyber' },
};

/** One harmful act's row. */
export interface ActRow {
  id: ActId; group: ActGroup; name: string;
  /** Unit of attempts / unstopped: per year; per work item (a probability); the composite row's exposure. */
  per: 'year' | 'item' | 'exposure';
  /** The trait value behind Would try (belief estimate or true), Would try and its 90% range (lo = hi on the truth). */
  x: number; wouldTry: number; wouldTryLo: number; wouldTryHi: number;
  /** Able to: the act's domain, the level read (measured or true), its threshold θ and σ((L − θ)/s). */
  domain?: DomainId; level: number; theta: number; ableTo: number;
  /** Chances (opportunity) and the act's autonomy need α. */
  chances: number; alpha: number;
  /** Stop rate = 1 − (1 − block)(1 − catch). */
  block: number; catch: number; stopRate: number;
  attempts: number; unstopped: number;
}

/** The site the table reads: its deployment and model, the incidents.ts Site and the safeguard parts shared by every
 *  act (DangerRead's site fields). `catchOf(t)` = the catch on acts of trait t. */
export interface ActSite {
  d: Deployment; v: ModelVersion; use?: AgentUse; site: Site; usage: number;
  layer: boolean; restricted: boolean; monitored: boolean;
  contain: number; monitor: number; human: number; controlMiss: number;
  catchOf: (t: TraitId) => number;
  /** SR-12: the site's monitor in the one monitor formula (watched share, flag rate, acted-on rate, stop contribution);
   *  products and internal lanes (undefined with no monitor, and on a fleet as incidents rolls it). */
  monitorParts?: MonitorStop;
}

/** A product (deployment id), an internal lane (use), or an internal fleet as incidents rolls it (internal deployment,
 *  model and usage: forEachIncidentSite). */
export type ActTarget = { deploymentId: string } | { use: AgentUse } | { deploymentId: string; versionId: string; usage: number };
/** control: undefined = as it is, true / false = the layer on / off; restrict: Restrict context applied (previews). core:
 *  the trait acts only (dangerView). */
export interface ActOpts { control?: boolean; restrict?: boolean; core?: boolean }

// RD-M01(b): the domain's benchmark fit (every domain has a row). Fallback only for a record with no fit for the domain
// (version in evaluation, or a pre-RD-M01b suite without MEDIA / PHYS rows): lineage measured general + offset.
const measuredDomainL = (s: GameStateV2, v: ModelVersion, d: DomainId) => v.evals.measuredDom?.[d] ?? measuredLOf(s, v).L + (v.domains[d] - v.Lg);
const liveInternal = (s: GameStateV2) => s.player.deployments.find((x) => x.channel === 'internal' && x.status !== 'withdrawn');

/** Usage of an internal lane: its share of internal agent compute (E5/R7's fleet usage, split by use). */
function laneUsage(s: GameStateV2, use: AgentUse): number {
  let total = 0;
  for (const u of AGENT_USES) {
    if (!agentVersion(s, u)) continue;
    const w = agentSplitShare(s, u);
    if (w <= 0 && u !== 'capRoutine') continue;
    total += w;
  }
  return total > 0 ? agentSplitShare(s, use) / total : 0;
}

/** Believed internal catch on trait t (E15's believed oversight parts; dangerView's lane catch). */
const believedInternalCatch = (s: GameStateV2, v: ModelVersion, L: number, human: number, miss: number) =>
  (t: TraitId) => 1 - (1 - believedMonitorCatch(s, v, t, L)) * (1 - human) * miss;

/** The site of a target, believed or true (undefined when nothing runs there). */
export function actSite(s: GameStateV2, target: ActTarget, believed: boolean, o: ActOpts = {}): ActSite | undefined {
  if ('use' in target) return laneSite(s, target.use, believed, o);
  const d = s.player.deployments.find((x) => x.id === target.deploymentId);
  if (!d || d.status === 'withdrawn') return undefined;
  if (d.channel !== 'internal') return productSite(s, d, believed, o);
  if (!('versionId' in target)) return undefined;
  const v = versionById(s, target.versionId);
  if (!v || v.status === 'retired') return undefined;
  const layer = o.control ?? controlOn(d);
  const base = siteOf(s, d, v, target.usage);
  const restricted = isRestricted(d) || !!o.restrict;
  const site: Site = { ...base, scale: base.scale * (o.restrict && !isRestricted(d) ? RESTRICT : 1) };
  if (!believed) {
    return { d, v, site, usage: target.usage, layer, restricted, monitored: true, contain: site.contain, monitor: fleetMonitor(s, v, undefined, false), human: 0, controlMiss: 1, catchOf: (t) => engineCatch(s, d, v, { source: t, apparent: t }) };
  }
  const p = believedOversightParts(s, v, layer, site.rd, layer, reviewOn(d));
  site.contain = p.block;
  return { d, v, site, usage: target.usage, layer, restricted, monitored: true, contain: p.block, monitor: fleetMonitor(s, v, undefined, true), human: p.human, controlMiss: p.controlMiss, catchOf: believedInternalCatch(s, v, p.L, p.human, p.controlMiss) };
}

function productSite(s: GameStateV2, d: Deployment, believed: boolean, o: ActOpts): ActSite | undefined {
  const v = versionById(s, d.versionId);
  if (!v || v.status === 'retired') return undefined;
  // RD-P10: the main model's share of the player's served tokens (billed usage, which the player sees), not servingShare.
  const usage = d.channel === 'open' ? 1 : usageOf(s, d, v);
  const layer = o.control ?? controlOn(d);
  const base = siteOf(s, d, v, believed ? usage : usageOf(s, d, v));
  const restricted = isRestricted(d) || !!o.restrict;
  const contain = believed ? containment(s, measuredOom(s, v), layer, true) : containment(s, versionOom(s, v), layer, false, uModeContainMult(v.uModes));
  const site: Site = { ...base, scale: base.scale * (o.restrict && !isRestricted(d) ? RESTRICT : 1), contain };
  // SR-12: the product's monitor through the one monitor formula (watched share × flag rate × acted-on rate).
  const m = d.monitorId && d.channel !== 'open' ? productMonitor(s, d, layer, believed) : undefined;
  const mon = m && m.watched > 0 ? m : undefined;
  const catchOf = believed ? (t: TraitId) => (mon ? (collusionTrait(t) ? mon.stopColl : mon.stop) : 0) : (t: TraitId) => engineCatch(s, d, v, { source: t, apparent: t });
  return { d, v, site, usage, layer, restricted, monitored: !!mon, contain, monitor: mon?.stop ?? 0, human: 0, controlMiss: mon?.c.defer ?? 1, catchOf, monitorParts: mon };
}

function laneSite(s: GameStateV2, use: AgentUse, believed: boolean, o: ActOpts): ActSite | undefined {
  const v = agentVersion(s, use);
  const d = liveInternal(s);
  if (!v || !d || v.status === 'retired') return undefined;
  const on = (s.player.split.routine + s.player.split.frontier) > 0 ? 1 : 0;
  const usage = laneUsage(s, use) * (v.id === d.versionId ? on : 1);
  const layer = o.control ?? controlOn(d);
  const restricted = isRestricted(d) || !!o.restrict;
  const site: Site = {
    internal: true, scale: usage * internalScale(s) * (restricted ? RESTRICT : 1), autonomy: autonomyOf(WORK_TYPES[USE_WORK[use]].H),
    afford: CHANNEL_AFFORD.internal, rd: aiRdShare(s), contain: 0, wsl: s.player.security.wsl,
  };
  const monitored = !!monitorVersion(s, use);
  const monitorParts = monitored ? useMonitor(s, use, undefined, believed) : undefined;
  if (!believed) {
    site.contain = containment(s, versionOom(s, v), layer, false, uModeContainMult(v.uModes));
    return { d, v, use, site, usage, layer, restricted, monitored, contain: site.contain, monitor: fleetMonitor(s, v, undefined, false), human: 0, controlMiss: 1, catchOf: (t) => engineCatch(s, d, v, { source: t, apparent: t }), monitorParts };
  }
  // E15: the same believed oversight as E9's believed control (believedOversight.ts).
  const p = believedOversightParts(s, v, layer, site.rd, layer, reviewOn(d));
  site.contain = p.block;
  return { d, v, use, site, usage, layer, restricted, monitored, contain: p.block, monitor: fleetMonitor(s, v, undefined, true), human: p.human, controlMiss: p.controlMiss, catchOf: believedInternalCatch(s, v, p.L, p.human, p.controlMiss), monitorParts };
}

/** Would try's 90% range from a belief (est ± 1.64 sd, clamped) through `f`. */
function range(x: number, sd: number, f: (x: number) => number): [number, number] {
  return [f(clamp01(x - Z90 * sd)), f(clamp01(x + Z90 * sd))];
}

function info(id: ActId) {
  const i = ACT_INFO[id];
  return { id, group: i?.group ?? 'misbehaviour', name: i?.name ?? id };
}

/** The trait acts (data DANGER_ACTS) at one site: E5's formula on the truth or on the player's estimates. */
export function siteActs(s: GameStateV2, a: ActSite, believed: boolean): ActRow[] {
  const { v, d, site } = a;
  const out: ActRow[] = [];
  for (const [t, def] of Object.entries(DANGER_ACTS) as [TraitId, ActDef][]) {
    if (def.internalOnly && !site.internal) continue;
    const x = believed ? v.beliefs[t]?.est ?? 0 : v.traitsTrue[t];
    const level = believed ? measuredDomainL(s, v, def.domain) : v.domains[def.domain];
    const k = actTerms(s.hidden.timeline, def, x, level, site);
    const feat = site.internal || !d.features.length ? 1 : productHazardMult(s, d, t);
    const chances = k.opportunity * feat;
    const c = a.catchOf(t);
    const attempts = def.kappa * k.disposition * k.capability * chances * YEAR;
    const stopRate = 1 - (1 - k.block) * (1 - c);
    const [lo, hi] = believed ? range(x, v.beliefs[t]?.sd ?? 0, dispositionOf) : [k.disposition, k.disposition];
    out.push({
      ...info(t), per: 'year', x, wouldTry: k.disposition, wouldTryLo: lo, wouldTryHi: hi, domain: def.domain, level, theta: actTheta(s.hidden.timeline, def), ableTo: k.capability,
      chances, alpha: def.alpha, block: k.block, catch: c, stopRate, attempts, unstopped: attempts * (1 - stopRate),
    });
  }
  return out;
}

/** A covert act's disposition from the player's estimates: clamped weighted sum of belief estimates (no U-modes), its
 *  combined sd, and the trait carrying most of it. */
function believedCovertX(v: ModelVersion, def: CovertActDef): { x: number; sd: number; apparent: TraitId } {
  let x = 0;
  let varSum = 0;
  let apparent = Object.keys(def.traits)[0] as TraitId;
  let best = -1;
  for (const [t, w] of Object.entries(def.traits) as [TraitId, number][]) {
    const b = v.beliefs[t];
    const c = w * (b?.est ?? 0);
    x += c;
    varSum += (w * (b?.sd ?? 0)) ** 2;
    if (c > best) { best = c; apparent = t; }
  }
  return { x: clamp01(x), sd: Math.sqrt(varSum), apparent };
}

function covertRow(s: GameStateV2, id: CovertActId, t: CovertTerms, per: 'year' | 'item', level: number, x: number, lohi: [number, number]): ActRow {
  const def = COVERT_ACTS[id];
  const k = per === 'year' ? YEAR : 1;
  return {
    ...info(id), per, x, wouldTry: t.disposition, wouldTryLo: lohi[0], wouldTryHi: lohi[1], domain: def.domain, level, theta: actTheta(s.hidden.timeline, def), ableTo: t.capability,
    chances: t.opportunity, alpha: def.alpha, block: t.block, catch: t.catch, stopRate: t.oversight, attempts: t.attempts * k, unstopped: t.rate * k,
  };
}

/** A per-day covert act (BACKDOOR, HIDCOMP) of the fleet at this site. */
function dayRow(s: GameStateV2, a: ActSite, id: CovertActId, believed: boolean): ActRow {
  const def = COVERT_ACTS[id];
  const { v } = a;
  if (!believed) {
    const t = dayTerms(s, v, id, a.usage);
    return covertRow(s, id, t, 'year', v.domains[def.domain], 0, [t.disposition, t.disposition]);
  }
  const { x, sd, apparent } = believedCovertX(v, def);
  const level = measuredDomainL(s, v, def.domain);
  const k = actTerms(s.hidden.timeline, { ...def, rd: true }, x, level, a.site);
  const attempts = Math.min(0.5, def.kappa * k.disposition * k.capability * k.opportunity);
  const c = a.catchOf(apparent);
  const oversight = 1 - (1 - k.block) * (1 - c);
  const t: CovertTerms = { act: id, versionId: v.id, apparent, disposition: k.disposition, capability: k.capability, opportunity: k.opportunity, attempts, block: k.block, catch: c, oversight, rate: attempts * (1 - oversight), sev: 0 };
  return covertRow(s, id, t, 'year', level, x, range(x, sd, dispositionOf));
}

/** A per-item covert act (SAFSAB, STEER, SUCCSTEER): model v doing `share` of a work item at horizon `hours`. */
function itemRow(s: GameStateV2, v: ModelVersion, id: CovertActId, share: number, hours: number, believed: boolean, engine?: CovertTerms): ActRow {
  const def = COVERT_ACTS[id];
  if (!believed) {
    const t = engine ?? itemTerms(s, v, id, share, hours);
    return covertRow(s, id, t, 'item', v.domains[def.domain], 0, [t.disposition, t.disposition]);
  }
  const { x, sd, apparent } = believedCovertX(v, def);
  const level = measuredDomainL(s, v, def.domain);
  const disposition = dispositionOf(x);
  const capability = actCapability(s.hidden.timeline, level, def);
  const af = autonomyOf(hours) * CHANNEL_AFFORD.internal;
  const opportunity = (1 - def.alpha + def.alpha * af) * clamp01(share);
  const attempts = clamp01(def.kappa * disposition * capability * opportunity);
  const o = believedInternalOversight(s, v, apparent, clamp01(share));
  const t: CovertTerms = { act: id, versionId: v.id, apparent, disposition, capability, opportunity, attempts, block: o.block, catch: o.catch, oversight: o.oversight, rate: attempts * (1 - o.oversight), sev: 0 };
  return covertRow(s, id, t, 'item', level, x, range(x, sd, dispositionOf));
}

/** The covert, composite and escape rows of model v's internal work. */
function labRows(s: GameStateV2, a: ActSite, believed: boolean): ActRow[] {
  const { v } = a;
  const out: ActRow[] = [dayRow(s, a, 'BACKDOOR', believed), dayRow(s, a, 'HIDCOMP', believed)];
  // Item acts: safety sabotage when v runs the safety work; steering and successor steering on the R&D parts v does
  // (the largest part's terms; per-item probabilities do not add across parts).
  if (safetyAgentVersion(s)?.id === v.id) {
    const share = safetyFleet(s).aiShare;
    const eng = believed ? undefined : safetySabotage(s, share);
    if (share > 0) out.push(itemRow(s, v, 'SAFSAB', share, WORK_TYPES.SAF_EXP.H, believed, eng));
  }
  const parts = rdParts(s).filter((p) => p.v.id === v.id).sort((x, y) => y.share - x.share);
  if (parts[0]) for (const id of ['STEER', 'SUCCSTEER'] as const) out.push(itemRow(s, v, id, parts[0].share, WORK_TYPES[parts[0].slot].H, believed));
  // The composite row: E9's exposure Mis · (1 − O_eff) · (1 + F) (control.ts; believed: believedTerms + the Mis band).
  // believedTerms' oversight is its O_eff (backdoor reach of located backdoors applied).
  const c: { mis: number; oEff: number; F: number; exposure: number } = believed ? (({ mis, oversight, F, exposure }) => ({ mis, oEff: oversight, F, exposure }))(believedTerms(s, v)) : controlTerms(s, v);
  const mis = c.mis;
  const oEff = c.oEff;
  const [lo, hi] = believed ? misalignmentBand(v) : [mis, mis];
  out.push({
    ...info('TAKEOVER'), per: 'exposure', x: mis, wouldTry: mis, wouldTryLo: lo, wouldTryHi: hi, level: measuredLOf(s, v).L, theta: 0, ableTo: 1,
    chances: 1 + c.F, alpha: 1, block: oEff, catch: 0, stopRate: oEff, attempts: mis * (1 + c.F), unstopped: c.exposure,
  });
  // Copies itself out (E25's exfiltration hazard on v's fleet; believed: estimates, measured CYBER, believed containment,
  // no backdoor reach the lab cannot see).
  const est = {} as TraitVector;
  if (believed) for (const t of ['POWER', 'SCHEME'] as TraitId[]) est[t] = v.beliefs[t]?.est ?? 0;
  const cyber = believed ? measuredDomainL(s, v, 'CYBER') : v.domains.CYBER;
  const e = exfilTerms(s, v, believed ? { traits: est, cyber, contain: a.contain, reach: 0 } : undefined);
  const stop = 1 - (1 - e.secBlock) * (1 - e.contain) * e.gate;
  const ex = believed ? (sd: (t: TraitId) => number) => {
    const f = (k: number) => clamp01(est.POWER + k * Z90 * sd('POWER')) * (1 + 4 * clamp01(est.SCHEME + k * Z90 * sd('SCHEME')));
    return [f(-1), f(1)] as [number, number];
  } : undefined;
  const [elo, ehi] = ex ? ex((t) => v.beliefs[t]?.sd ?? 0) : [e.disposition, e.disposition];
  out.push({
    ...info('EXFIL'), per: 'year', x: e.disposition, wouldTry: e.disposition, wouldTryLo: elo, wouldTryHi: ehi, domain: 'CYBER', level: cyber, theta: 10, ableTo: e.capability,
    chances: e.opportunity, alpha: 1, block: stop, catch: 0, stopRate: stop, attempts: (e.p > 0 ? e.p / ((1 - e.secBlock) * (1 - e.contain) * e.gate) : 0) * YEAR, unstopped: e.p * YEAR,
  });
  return out;
}

/** Misuse by people on a product (misuseHazards; believed: measured levels and believed classifier strength). */
function misuseRows(s: GameStateV2, a: ActSite, believed: boolean): ActRow[] {
  const { v, d } = a;
  const rows = misuseHazards(s, v, d, believed ? { level: (dom) => measuredDomainL(s, v, dom), strength: (t) => reliability(s, t, { x: measuredOom(s, v) }, true).base } : undefined);
  return rows.map((r) => {
    const id = r.domain === 'BIO' ? 'MISUSE_BIO' : 'MISUSE_CYBER';
    const attempts = MISUSE.kappa * r.disposition * r.capability * r.opportunity * YEAR;
    return {
      ...info(id), per: 'year', x: r.disposition, wouldTry: r.disposition, wouldTryLo: r.disposition, wouldTryHi: r.disposition, domain: r.domain,
      level: believed ? measuredDomainL(s, v, r.domain!) : v.domains[r.domain!], theta: MISUSE.theta, ableTo: r.capability,
      chances: r.opportunity, alpha: 0, block: r.block, catch: 0, stopRate: r.block, attempts, unstopped: r.h * YEAR,
    } satisfies ActRow;
  });
}

/** SR-13: `guards` = the site's safeguard items in player terms (stop contribution, Slowdown, compute, people); with
 *  the monitor they make every row's Stop rate through one rule, 1 − Π (1 − stop_i) (safety/safeguards.ts). */
export interface ActTable { site: ActSite; rows: ActRow[]; guards: SafeguardLine[] }

/** The harmful-acts table of one target: the trait acts, then (internal) the covert, composite and escape rows, or
 *  (products) misuse; `believed` picks the player's estimate or the truth. Undefined when nothing runs there. */
export function actTable(s: GameStateV2, target: ActTarget, believed: boolean, o: ActOpts = {}): ActTable | undefined {
  const a = actSite(s, target, believed, o);
  if (!a) return undefined;
  const rows = siteActs(s, a, believed);
  if (!o.core) rows.push(...(a.site.internal ? labRows(s, a, believed) : misuseRows(s, a, believed)));
  const gap = a.use ? useControl(s, a.v, monitorVersion(s, a.use), true, believed).gapOom : undefined;
  return { site: a, rows, guards: safeguardLines(a.d, { block: a.contain, human: a.human, gapOom: gap, humanShare: a.site.internal ? 1 - a.site.rd : 0 }) };
}
