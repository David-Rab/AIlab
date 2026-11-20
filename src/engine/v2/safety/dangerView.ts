// The player's danger and control readouts (model v3 E11; output only: no state changes, no RNG). Owner: WS2.
//
// Danger per deployment: E5's formula (incidents.ts) rebuilt on what the player knows, the way E12's successor-pull view
// reads beliefs instead of true traits:
//   attempts a_k = κ_k · D_k · C_k · O_k      harmful rate = a_k · (1 − block_k)(1 − catch_k)
//   D_k  disposition  = x̂_k^1.5, x̂ the belief estimate of the act's trait (not the true trait)
//   C_k  capability   = σ((L̂_d − θ_k)/s), L̂_d the measured domain level (measured general level + the domain offset)
//   O_k  opportunity  = the deployment's site (usage, copies, autonomy, affordances, AI share of R&D: all visible)
//   block            = AG07 containment at the BELIEVED tool strength on the measured capability (+ weight security for
//                      escape-like acts inside the lab)
//   catch            internal: believed CoT/white-box detection on the measured level × (½ + ½ × the fleet's monitor
//                      strength, from measured levels), human review on the measured gap above expert humans, control
//                      deferral; product: its monitor's catch rate (already from measured levels)
// U-modes are left out (the player does not know which model carries one) and so is misuse (it is not a disposition:
// Products › Safeguards). An internal lane reads its own use's work-type horizon and compute share, so the lanes of one
// model add up to E5's fleet row.
// Control: E9's controlView (stored believed control) with its believed parts (believedTerms), the oversight gap of the
// model that sets it, the footholds the lab knows of, and the control layer's tax (E6).
import { AGENT_USES } from '../../../data/v2/agents';
import { CHANNEL_AFFORD, DANGER_ACTS, type ActDef } from '../../../data/v2/danger';
import { HUMAN_REVIEW_L } from '../../../data/v2/oversight';
import { WORK_TYPES, type WorkTypeId } from '../../../data/v2/workTypes';
import { agentSplitShare, agentVersion, fleetMonitor, monitorVersion } from '../departments/agents';
import { measuredLOf } from '../models/labs';
import { catchRate, collusionTrait, productHazardMult } from '../models/products';
import type { AgentUse, Deployment, DomainId, GameStateV2, ModelVersion, TraitId, TraitVector } from '../types';
import { versionById } from './common';
import { believedMonitorCatch, believedOversightParts } from './believedOversight';
import { believedLowest, believedTerms, controlView } from './control';
import { footholdView } from './footholdDetection';
import { aiRdShare, autonomyOf, capabilityOf, dispositionOf, internalScale, siteOf, type Site } from './incidents';
import { controlProtocol, measuredOom, oversightGap, underControl, type ControlReadout } from './oversight';
import { containment } from './techniques';

const YEAR = 365;
const USE_WORK: Record<AgentUse, WorkTypeId> = { eng: 'SWE', capRoutine: 'EXP', capFrontier: 'IDEAS', safety: 'SAF_EXP' };
/** Restricted status scales opportunity (incidents.ts siteOf). */
const RESTRICT = 0.3;

/** One act at one site, as the player estimates it. */
export interface DangerActRead {
  trait: TraitId; act: string;
  /** Belief estimate of the trait and its disposition x̂^1.5. */
  est: number; disposition: number;
  /** Capability: the act's domain, its measured level, the act's threshold θ and σ((L − θ)/s). */
  domain: DomainId; level: number; theta: number; capability: number;
  /** Opportunity N·[(1 − α) + α·A·F]·(r) and the act's autonomy need α. */
  opportunity: number; alpha: number;
  /** Oversight 1 − (1 − block)(1 − catch) and its parts. */
  block: number; catch: number; oversight: number;
  /** Attempts and harmful (not blocked, not caught) acts per year. */
  attempts: number; harmful: number;
}

export interface DangerLever { id: 'control' | 'restrict' | 'monitor' | 'train'; label: string; /** Harmful acts per year after it (undefined = no estimate). */ after?: number; note: string }

/** The believed danger of one product or internal lane. */
export interface DangerRead {
  site: 'product' | 'internal';
  deploymentId: string; versionId: string; use?: AgentUse;
  /** The site's visible terms: usage share, scale N, autonomy A, affordances F, AI share of R&D r. */
  usage: number; scale: number; autonomy: number; afford: number; rd: number;
  /** Oversight parts shared by every act: containment, monitor (product: catch rate; internal: monitor strength), human
   *  review factor (internal), control deferral's miss multiplier, whether the control layer is on. */
  contain: number; monitor: number; human: number; controlMiss: number; controlLayer: boolean;
  /** Acts sorted by harmful rate (largest first); `top` is acts[0]. */
  acts: DangerActRead[]; top?: DangerActRead;
  attempts: number; harmful: number; caught: number;
  levers: DangerLever[];
}

/** Belief estimates as a trait vector (0 where the lab holds no belief). */
function estTraits(v: ModelVersion): TraitVector {
  const out = {} as TraitVector;
  for (const t of Object.keys(DANGER_ACTS) as TraitId[]) out[t] = v.beliefs[t]?.est ?? 0;
  return out;
}

/** Measured level of an act's domain: the measured general level plus the version's domain offset. */
const measuredDomainL = (s: GameStateV2, v: ModelVersion, d: DomainId) => measuredLOf(s, v).L + (v.domains[d] - v.Lg);

interface Opts { control?: boolean; restrict?: boolean }

/** One site's believed acts. `opp(def)` = the act's opportunity; `catchOf(trait)` = the believed catch. */
function readActs(s: GameStateV2, v: ModelVersion, site: Site, d: Deployment, catchOf: (t: TraitId) => number): DangerActRead[] {
  const est = estTraits(v);
  const af = site.autonomy * site.afford;
  const out: DangerActRead[] = [];
  for (const [t, def] of Object.entries(DANGER_ACTS) as [TraitId, ActDef][]) {
    if (def.internalOnly && !site.internal) continue;
    const disposition = dispositionOf(est[t]);
    const level = measuredDomainL(s, v, def.domain);
    const capability = capabilityOf(level, def);
    const feat = site.internal || !d.features.length ? 1 : productHazardMult(s, d, t);
    const opportunity = site.scale * (1 - def.alpha + def.alpha * af) * (def.rd && site.internal ? site.rd : 1) * feat;
    const block = 1 - (1 - site.contain) * (1 - (site.internal && def.security ? (def.security * site.wsl) / 5 : 0));
    const c = catchOf(t);
    const attempts = def.kappa * disposition * capability * opportunity * YEAR;
    const oversight = 1 - (1 - block) * (1 - c);
    out.push({ trait: t, act: def.act, est: est[t], disposition, domain: def.domain, level, theta: def.theta, capability, opportunity, alpha: def.alpha, block, catch: c, oversight, attempts, harmful: attempts * (1 - oversight) });
  }
  return out.sort((a, b) => b.harmful - a.harmful);
}

function summed(acts: DangerActRead[]) {
  let attempts = 0;
  let harmful = 0;
  let caught = 0;
  for (const a of acts) {
    attempts += a.attempts;
    harmful += a.harmful;
    caught += a.attempts * (1 - a.block) * a.catch;
  }
  return { attempts, harmful, caught };
}

/** Believed danger of a product (a live external deployment). */
function productDanger(s: GameStateV2, d: Deployment, o: Opts = {}): DangerRead | undefined {
  const v = versionById(s, d.versionId);
  if (!v || v.status === 'retired' || d.status === 'withdrawn') return undefined;
  const usage = d.channel === 'open' ? 1 : d.servingShare;
  const layer = !!o.control || d.controlLayer;
  const base = siteOf(s, d, v, usage);
  const restricted = d.status === 'restricted' || !!o.restrict;
  const site: Site = { ...base, scale: base.scale * (o.restrict && d.status !== 'restricted' ? RESTRICT : 1), contain: containment(s, measuredOom(s, v), layer, true) };
  const mon = d.monitorId && d.channel !== 'open' ? versionById(s, d.monitorId) : undefined;
  const cr = mon ? catchRate(s, v, mon, layer) : undefined;
  const acts = readActs(s, v, site, d, (t) => (cr ? (collusionTrait(t) ? cr.collusion : cr.rate) : 0));
  return {
    site: 'product', deploymentId: d.id, versionId: v.id, usage, scale: site.scale, autonomy: site.autonomy, afford: site.afford, rd: 0,
    contain: site.contain, monitor: cr?.rate ?? 0, human: 0, controlMiss: cr?.defer ?? 1, controlLayer: layer, acts, top: acts[0], ...summed(acts),
    levers: o.control || o.restrict ? [] : levers(s, d, acts, !!mon, restricted, (x) => productDanger(s, d, x)?.harmful),
  };
}

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

/** Believed danger of one internal agent lane (its model at its use's horizon and compute share). */
function laneDanger(s: GameStateV2, use: AgentUse, o: Opts = {}): DangerRead | undefined {
  const v = agentVersion(s, use);
  const d = s.player.deployments.find((x) => x.channel === 'internal' && x.status !== 'withdrawn');
  if (!v || !d || v.status === 'retired') return undefined;
  const on = s.player.split.agents > 0 ? 1 : 0;
  const usage = laneUsage(s, use) * (v.id === d.versionId ? on : 1);
  const layer = !!o.control || d.controlLayer;
  const restricted = d.status === 'restricted' || !!o.restrict;
  const site: Site = {
    internal: true, scale: usage * internalScale(s) * (restricted ? RESTRICT : 1), autonomy: autonomyOf(WORK_TYPES[USE_WORK[use]].H),
    afford: CHANNEL_AFFORD.internal, rd: aiRdShare(s), contain: 0, wsl: s.player.security.wsl,
  };
  // E15: the same believed oversight as E9's believed control (believedOversight.ts).
  const { L, block, human, controlMiss: miss } = believedOversightParts(s, v, layer, site.rd);
  site.contain = block;
  const acts = readActs(s, v, site, d, (t) => 1 - (1 - believedMonitorCatch(s, v, t, L)) * (1 - human) * miss);
  return {
    site: 'internal', deploymentId: d.id, versionId: v.id, use, usage, scale: site.scale, autonomy: site.autonomy, afford: site.afford, rd: site.rd,
    contain: site.contain, monitor: fleetMonitor(s, v), human, controlMiss: miss, controlLayer: layer, acts, top: acts[0], ...summed(acts),
    levers: o.control || o.restrict ? [] : levers(s, d, acts, !!monitorVersion(s, use), restricted, (x) => laneDanger(s, use, x)?.harmful),
  };
}

/** What lowers a site's danger, with the same selector's estimate after each lever where it has one. */
function levers(s: GameStateV2, d: Deployment, acts: DangerActRead[], monitored: boolean, restricted: boolean, what: (o: Opts) => number | undefined): DangerLever[] {
  const out: DangerLever[] = [];
  if (!d.controlLayer) out.push({ id: 'control', label: 'Control layer', after: what({ control: true }), note: 'AI-control containment and deferral (Safety › Overview › Control)' });
  if (!monitored) out.push({ id: 'monitor', label: 'Add a monitor', note: d.channel === 'internal' ? 'Company › Agents at work' : 'the monitor chip on this card' });
  if (!restricted) out.push({ id: 'restrict', label: 'Restrict context', after: what({ restrict: true }), note: d.channel === 'internal' ? 'opportunity ×0.3 (an incident response)' : 'opportunity ×0.3; revenue ×0.5 (an incident response)' });
  const top = acts[0];
  if (top && top.harmful > 0) out.push({ id: 'train', label: 'Train it down', note: `targeted training on ${top.trait} (est. ${top.est.toFixed(2)})` });
  void s;
  return out;
}

/** The danger readout of every product and every internal agent lane (Products cards, Company › Agents at work). */
export function dangerView(s: GameStateV2): { products: Record<string, DangerRead>; lanes: Partial<Record<AgentUse, DangerRead>> } {
  const products: Record<string, DangerRead> = {};
  for (const d of s.player.deployments) {
    if (d.channel === 'internal') continue;
    const r = productDanger(s, d);
    if (r) products[d.id] = r;
  }
  const lanes: Partial<Record<AgentUse, DangerRead>> = {};
  for (const u of AGENT_USES) {
    const r = laneDanger(s, u);
    if (r) lanes[u] = r;
  }
  return { products, lanes };
}

// ───────────────────────────── control ─────────────────────────────

export type ControlBand = 'firm' | 'holding' | 'slipping' | 'weak';
/** Display bands of believed control [D] (the world's tolerance is hidden: these are not its threshold). */
export const CONTROL_BANDS: { band: ControlBand; min: number }[] = [{ band: 'firm', min: 0.9 }, { band: 'holding', min: 0.75 }, { band: 'slipping', min: 0.6 }, { band: 'weak', min: 0 }];
export const controlBand = (c: number): ControlBand => CONTROL_BANDS.find((b) => c >= b.min)?.band ?? 'weak';

export interface ControlRead {
  /** Believed control (controlView, refreshed daily) and its band; the model it is lowest for. */
  believed: number; band: ControlBand; versionId?: string; name?: string;
  /** Its believed parts: exposure = mis × (1 − oversight) × (1 + F). */
  mis: number; oversight: number; F: number; exposure: number;
  /** Oversight gap of that model: to its monitor (OOM, levels; undefined = no monitor) and above expert humans (L 10). */
  monitorGapOom?: number; monitorGapL?: number; monitorName?: string; humanGapOom: number;
  /** Footholds the lab knows of (suspected, located, removed). */
  suspected: number; located: number; removed: number;
  /** The control layer (AG07 protocols on internal work) and its tax on internal AI labour: the largest lane tax today,
   *  or, while off, what it would be. */
  layer: boolean; tax: number; missMult: number; taxUse?: AgentUse;
}

/** The control readout on Safety › Overview: believed only (never effectiveControl.level, exposure or the tolerance). */
export function controlReadout(s: GameStateV2): ControlRead {
  let cv = controlView(s);
  // Not yet assessed (a save from before E9, refreshed on the next day): the lowest believed control over the same
  // candidates (the best model and the running internal fleets), from beliefs only.
  if (!cv.versionId) {
    const b = believedLowest(s);
    if (b) cv = { believed: Math.round(b.control * 1e4) / 1e4, versionId: b.versionId };
  }
  const v = versionById(s, cv.versionId);
  const t = v ? believedTerms(s, v) : { mis: 0, oversight: 0, F: 0, exposure: 0, control: 1 };
  const fv = footholdView(s);
  const w = s.hidden.timeline;
  const L = v ? measuredLOf(s, v).L : 0;
  const lane = v ? AGENT_USES.find((u) => agentVersion(s, u)?.id === v.id && monitorVersion(s, u)) : undefined;
  const mon = lane ? monitorVersion(s, lane) : undefined;
  const g = mon ? oversightGap(w, L, measuredLOf(s, mon).L) : undefined;
  const layer = underControl(s);
  let best: ControlReadout | undefined;
  let bestUse: AgentUse | undefined;
  for (const u of AGENT_USES) {
    const m = agentVersion(s, u);
    if (!m || agentSplitShare(s, u) <= 0) continue;
    const mu = monitorVersion(s, u);
    const c = controlProtocol(mu ? oversightGap(w, measuredLOf(s, m).L, measuredLOf(s, mu).L).oom : undefined);
    if (!best || c.tax > best.tax) { best = c; bestUse = u; }
  }
  const p = best ?? controlProtocol(undefined);
  return {
    believed: cv.believed, band: controlBand(cv.believed), versionId: v?.id, name: v?.name,
    mis: t.mis, oversight: t.oversight, F: t.F, exposure: t.exposure,
    monitorGapOom: g?.oom, monitorGapL: g?.levels, monitorName: mon ? (mon.id === v?.id ? `copy of ${mon.name}` : mon.name) : undefined,
    humanGapOom: oversightGap(w, L, HUMAN_REVIEW_L).oom,
    suspected: fv.suspected, located: fv.located, removed: fv.removed,
    layer, tax: p.tax, missMult: p.missMult, taxUse: bestUse,
  };
}
