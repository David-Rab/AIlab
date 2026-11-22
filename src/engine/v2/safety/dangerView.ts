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
// SR-03: both danger readouts are the believed act table's trait rows (actTable.ts actSite + siteActs), so this view and
// the SAFETY act table cannot drift.
import { controlOn, labControlSetting } from './safeguards';
import { AGENT_USES } from '../../../data/v2/agents';
import { DANGER_ACTS } from '../../../data/v2/danger';
import { HUMAN_REVIEW_L } from '../../../data/v2/oversight';
import { agentSplitShare, agentVersion, monitorVersion } from '../departments/agents';
import { measuredLOf } from '../models/labs';
import type { AgentUse, Deployment, DomainId, GameStateV2, TraitId } from '../types';
import { versionById } from './common';
import { actSite, siteActs, type ActOpts, type ActRow, type ActSite } from './actTable';
import { believedLowest, believedTerms, controlView } from './control';
import { footholdView } from './footholdDetection';
import { lossOfControlRisk, unstoppedHarmPerYear, type LossRisk } from './lossRisk';
import { controlProtocol, oversightGap, underControl, type ControlReadout } from './oversight';

/** Restricted status scales opportunity (incidents.ts siteOf), and usage, revenue and misuse reach (revenue.ts,
 *  incidents.ts misuseHazards) by the same 0.3; F6e: the Restrict context preview reads it. */
export { RESTRICT } from './actTable';

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

/** control: undefined = as it is, true = the layer on, false = off (model v3 F6: the remove-control preview). */
type Opts = Pick<ActOpts, 'control' | 'restrict'>;

/** One site's believed acts: the believed act table's trait rows (SR-03), largest harmful rate first. */
function readActs(s: GameStateV2, a: ActSite): DangerActRead[] {
  return siteActs(s, a, true).map((r: ActRow) => ({
    trait: r.id as TraitId, act: DANGER_ACTS[r.id as TraitId]!.act, est: r.x, disposition: r.wouldTry, domain: r.domain as DomainId, level: r.level, theta: r.theta,
    capability: r.ableTo, opportunity: r.chances, alpha: r.alpha, block: r.block, catch: r.catch, oversight: r.stopRate, attempts: r.attempts, harmful: r.unstopped,
  })).sort((a, b) => b.harmful - a.harmful);
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
  const a = d.channel === 'internal' ? undefined : actSite(s, { deploymentId: d.id }, true, o);
  if (!a) return undefined;
  const { site } = a;
  const acts = readActs(s, a);
  return {
    site: 'product', deploymentId: d.id, versionId: a.v.id, usage: a.usage, scale: site.scale, autonomy: site.autonomy, afford: site.afford, rd: 0,
    contain: a.contain, monitor: a.monitor, human: 0, controlMiss: a.controlMiss, controlLayer: a.layer, acts, top: acts[0], ...summed(acts),
    levers: o.control !== undefined || o.restrict ? [] : levers(s, d, acts, a.monitored, a.restricted, (x) => productDanger(s, d, x)?.harmful),
  };
}

/** Believed danger of one internal agent lane (its model at its use's horizon and compute share). */
function laneDanger(s: GameStateV2, use: AgentUse, o: Opts = {}): DangerRead | undefined {
  const a = actSite(s, { use }, true, o);
  if (!a) return undefined;
  const { site, d } = a;
  const acts = readActs(s, a);
  return {
    site: 'internal', deploymentId: d.id, versionId: a.v.id, use, usage: a.usage, scale: site.scale, autonomy: site.autonomy, afford: site.afford, rd: site.rd,
    contain: a.contain, monitor: a.monitor, human: a.human, controlMiss: a.controlMiss, controlLayer: a.layer, acts, top: acts[0], ...summed(acts),
    levers: o.control !== undefined || o.restrict ? [] : levers(s, d, acts, a.monitored, a.restricted, (x) => laneDanger(s, use, x)?.harmful),
  };
}

/** What lowers a site's danger, with the same selector's estimate after each lever where it has one. */
function levers(s: GameStateV2, d: Deployment, acts: DangerActRead[], monitored: boolean, restricted: boolean, what: (o: Opts) => number | undefined): DangerLever[] {
  const out: DangerLever[] = [];
  if (!controlOn(d)) out.push({ id: 'control', label: 'Control layer', after: what({ control: true }), note: 'AI-control containment and deferral (Safety › Overview › Control)' });
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

/** Believed harmful acts per year at the sites a version's control layer covers (its products, and every internal lane
 *  when it is the internal deployment's model), now and with the layer `on` (model v3 F6: the add / remove-control
 *  previews; the same estimate as dangerView). */
export function controlDangerDelta(s: GameStateV2, versionId: string, on: boolean): { now: number; after: number; sites: number } {
  let now = 0;
  let after = 0;
  let sites = 0;
  for (const d of s.player.deployments) {
    if (d.versionId !== versionId || d.status === 'withdrawn') continue;
    if (d.channel === 'internal') {
      for (const u of AGENT_USES) {
        const a = laneDanger(s, u);
        const b = laneDanger(s, u, { control: on });
        if (!a || !b) continue;
        now += a.harmful;
        after += b.harmful;
        sites++;
      }
      continue;
    }
    const a = productDanger(s, d);
    const b = productDanger(s, d, { control: on });
    if (!a || !b) continue;
    now += a.harmful;
    after += b.harmful;
    sites++;
  }
  return { now, after, sites };
}

/** F6e: believed harmful acts a year at the given products now and restricted (Restrict context's preview). */
export function restrictDangerDelta(s: GameStateV2, deps: readonly Deployment[]): { now: number; after: number; sites: number } {
  let now = 0;
  let after = 0;
  let sites = 0;
  for (const d of deps) {
    const a = productDanger(s, d);
    const b = productDanger(s, d, { restrict: true });
    if (!a || !b) continue;
    now += a.harmful;
    after += b.harmful;
    sites++;
  }
  return { now, after, sites };
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
  /** The model whose internal deployment carries the layer (the Remove control response's target; model v3 F6). */
  layerVersionId?: string;
  /** SR-04 headline: Loss-of-control risk of the riskiest model the lab runs ("if it could act now") and the
   *  companion Unstopped harm / yr (severity-weighted) with the unweighted unstopped acts / yr. */
  risk?: LossRisk; harm: number; harmActs: number;
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
    const c = controlProtocol(mu ? oversightGap(w, measuredLOf(s, m).L, measuredLOf(s, mu).L).oom : undefined, labControlSetting(s));
    if (!best || c.tax > best.tax) { best = c; bestUse = u; }
  }
  const p = best ?? controlProtocol(undefined, labControlSetting(s));
  const risk = lossOfControlRisk(s);
  const h = unstoppedHarmPerYear(s);
  return {
    believed: cv.believed, band: controlBand(cv.believed), versionId: v?.id, name: v?.name,
    mis: t.mis, oversight: t.oversight, F: t.F, exposure: t.exposure,
    monitorGapOom: g?.oom, monitorGapL: g?.levels, monitorName: mon ? (mon.id === v?.id ? `copy of ${mon.name}` : mon.name) : undefined,
    humanGapOom: oversightGap(w, L, HUMAN_REVIEW_L).oom,
    suspected: fv.suspected, located: fv.located, removed: fv.removed,
    layer, tax: p.tax, missMult: p.missMult, taxUse: bestUse,
    layerVersionId: s.player.deployments.find((d) => d.channel === 'internal' && d.status === 'live' && controlOn(d))?.versionId,
    risk, harm: h.harm, harmActs: h.acts,
  };
}
