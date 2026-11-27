// Incidents: the danger formula, detection, public timers, exfiltration (V2-SPEC §3.5.10; MODEL-V3 §11.3, task E5).
// Owner: WS2.
//
// One formula for every harmful act k (data/v2/danger.ts has the terms, their sources and values):
//   attempts a_k = κ_k · disposition_k · capability_k · opportunity_k      per day, per (deployment or internal fleet)
//   rate_k       = a_k · (1 − oversight_k),  oversight_k = 1 − (1 − block_k)(1 − catch_k)
// Blocked attempts (AG07 containment, weight security on escape-like acts) leave no trace; caught ones are internal
// incidents the lab sees (a product's monitor, the internal monitors and human review); the rest are harm: customer or
// public incidents on products, silent ones inside the lab (`uncaughtInternal`). Severity rises with capability ×
// opportunity per copy. Incidents are the main visible proxy of hidden traits and U-modes: the player sees `apparent`
// ('unexplained' for undiscovered U-modes) and severity; `trueSource` stays hidden.
import { controlOn, labControlSetting, restrictMult, reviewOn } from './safeguards';
import { disclosureStep } from './responses';
import { approvalPush, PUBLIC } from '../world/public';
import { COPIES_GAMMA, COPIES_REF, CHANNEL_AFFORD, CHANNEL_HORIZON_H, DANGER_ACTS, EXFIL, H_HALF, MISUSE, MISUSE_REACH, MISUSE_TOKENS_REF, UMODE_ACT, V0_V2_LEVEL, type ActDef } from '../../../data/v2/danger';
import { reviewCatch } from './lineProjects';
import { UMODE_BY_ID } from '../../../data/v2/umodes';
import { WORK_TYPES, type WorkTypeId } from '../../../data/v2/workTypes';
import { AGENT_USES } from '../../../data/v2/agents';
import { bestPlayerVersion, internalVersion } from '../models/labs';
import { domainsOf, gV0 } from '../models/capability';
import type { AgentUse, Deployment, DomainId, EngineSystem, GameStateV2, Incident, ModelVersion, RngLike, SystemCtx, TechniqueState, TimelineWorld, TraitId, TraitVector, UModeId } from '../types';
import { clamp01, flagNum, setFlag, versionById } from './common';
import { controlProtocol, humanReviewFactor, measuredOom, oomOfLevel, underControl, versionOom } from './oversight';
import { LEVEL_KNOTS } from '../../../data/v2/calibration';
import { monitoringCatch } from './detection';
import { containment, strengthTrue } from './techniques';
import { methodMult, usesMethod } from './methods';
import { isDiscovered, uModeContainMult } from './umodes';
import { productCatch, productHazardMult, productSiteTerms } from '../models/products';
import { agentSplitShare, agentVersion, internalFleets } from '../departments/agents';
import { copiesOf, flopPerToken, safetyLabour, workContext } from '../departments/workfit';
import { rollFleetCovert } from './covert';
import { footholdsStep } from './footholdDetection';
import { backdoorReach, lineageOf } from './footholds';
import { controlStep } from './control';
import { lawsInForce } from '../../../data/v2/laws';

/** Disposition of an undiscovered/discovered U-mode (it borrows the act of its mapped trait) [D]. */
export const UMODE_X = 0.25;

/** Open (unresolved) incidents of the player, for WS4 events and WS5 headlines. */
export function openIncidents(s: GameStateV2): Incident[] {
  return s.player.safety.incidents.filter((i) => i.status === 'open' || i.status === 'investigating');
}

/**
 * One harmful act's row at one site. `h` = attempts per day that are not blocked (what the daily roll draws); `catch`
 * is applied when one fires. `sev` = the severity before rounding (floor + span · capability · A·F).
 */
export interface HazardRow {
  source: TraitId | UModeId | 'misuse'; apparent: TraitId | 'unexplained' | 'misuse'; h: number; sev: number; domain?: 'BIO' | 'CYBER';
  /** The formula's terms (E11 danger readout; tests). */
  disposition: number; capability: number; opportunity: number; block: number;
}

/** Where a model acts (one deployment or internal fleet): the opportunity and blocking terms of the formula. */
export interface Site {
  internal: boolean;
  /** Scale N: usage share × (copies ÷ the 2025 reference)^γ. */
  scale: number;
  /** Autonomy A = H/(H + H_HALF) from the task horizon given, and affordances F. */
  autonomy: number;
  afford: number;
  /** AI share of the lab's own R&D labour (internal sites; 0 elsewhere). */
  rd: number;
  /** AG07 containment on this site (blocks every act). */
  contain: number;
  /** Weight-security level 1..5 (internal sites: blocks escape-like acts), 0 elsewhere. */
  wsl: number;
}

const sig = (x: number) => 1 / (1 + Math.exp(-x));
/** Disposition from a trait value: x^1.5 (v2's convexity: weak tendencies rarely become acts) [D]. */
export const dispositionOf = (x: number) => Math.pow(Math.max(0, x), 1.5);
/** Capability of an act: σ((L − θ)/s) on its domain level (θ on today's domain score: actTheta, or misuse / exfiltration's). */
export const capabilityOf = (level: number, def: { theta: number; s: number }) => sig((level - def.theta) / def.s);
/** CAL2: the start model V0's domain score in world w (no build: raw domain G = general G), memo per world. */
const v0Memo = new WeakMap<TimelineWorld, Record<DomainId, number>>();
const v0Domains = (w: TimelineWorld) => {
  let m = v0Memo.get(w);
  if (!m) v0Memo.set(w, (m = domainsOf(w, gV0(w))));
  return m;
};
/** CAL2: an act's θ on today's domain score in world w (data/v2/danger.ts): θ_v2 + L_w(V0) − L_v2(V0), so every act keeps
 *  its distance from the start model's level in every world (CP3f's ai2027-only U05_SHIFT, per world). */
export const actTheta = (w: TimelineWorld, def: Pick<ActDef, 'thetaV2' | 'domain'>) => def.thetaV2 + v0Domains(w)[def.domain] - (V0_V2_LEVEL[def.domain] ?? 0);
/** Capability of a trait or covert act in world w: σ((L − actTheta)/s). */
export const actCapability = (w: TimelineWorld, level: number, def: Pick<ActDef, 'thetaV2' | 'domain' | 's'>) => sig((level - actTheta(w, def)) / def.s);
/** Autonomy from the task horizon a deployment gives (hours). */
export const autonomyOf = (hours: number) => hours / (hours + H_HALF);
/** Severity draw: ⌊sev + u⌋ clamped to 1..5 (u ~ U[0,1): stochastic rounding of the rule's value). */
export const drawSeverity = (row: Pick<HazardRow, 'sev'>, u: number) => Math.max(1, Math.min(5, Math.floor(row.sev + u))) as Incident['severity'];

/** SR-03: the formula's four site terms of one act (disposition from trait value x, capability at `level`, opportunity,
 *  block), shared by the engine's rows (actRow) and the act table (safety/actTable.ts, true or believed inputs). */
export function actTerms(w: TimelineWorld, def: ActDef, x: number, level: number, site: Site): { disposition: number; capability: number; opportunity: number; block: number; af: number } {
  const disposition = dispositionOf(x);
  const capability = actCapability(w, level, def);
  const af = site.autonomy * site.afford;
  const opportunity = site.scale * (1 - def.alpha + def.alpha * af) * (def.rd && site.internal ? site.rd : 1);
  const block = 1 - (1 - site.contain) * (1 - (site.internal && def.security ? (def.security * site.wsl) / 5 : 0));
  return { disposition, capability, opportunity, block, af };
}

function actRow(w: TimelineWorld, def: ActDef, x: number, domains: Record<DomainId, number>, site: Site): Omit<HazardRow, 'source' | 'apparent'> {
  const { disposition, capability, opportunity, block, af } = actTerms(w, def, x, domains[def.domain], site);
  return { h: def.kappa * disposition * capability * opportunity * (1 - block), sev: def.floor + def.span * capability * af, disposition, capability, opportunity, block };
}

/**
 * Per-act daily rows for one model at one site (§11.3). Exported for WS4 (rival incidents use the same formula at their
 * own site). `discovered(u)` decides the apparent label of U-mode incidents.
 */
export function modelHazards(
  w: TimelineWorld, traits: TraitVector, uModes: readonly UModeId[], domains: Record<DomainId, number>, site: Site,
  discovered: (u: UModeId) => boolean = () => false,
): HazardRow[] {
  const out: HazardRow[] = [];
  if (site.scale <= 0) return out;
  for (const k in DANGER_ACTS) { // P4: for-in (Object.entries order, read live) without the entries array
    const t = k as TraitId;
    const def = DANGER_ACTS[t] as ActDef;
    if (def.internalOnly && !site.internal) continue;
    const r = actRow(w, def, traits[t], domains, site);
    if (r.h > 0) out.push({ source: t, apparent: t, ...r });
  }
  for (const u of uModes) {
    const m = UMODE_BY_ID[u];
    const def = DANGER_ACTS[m.mapsTo] ?? UMODE_ACT;
    if (def.internalOnly && !site.internal) continue;
    const r = actRow(w, def, UMODE_X, domains, site);
    if (r.h > 0) out.push({ source: u, apparent: discovered(u) ? m.mapsTo : 'unexplained', ...r });
  }
  return out;
}

/** SR-03: the player's inputs to misuse (the act table's believed rows): measured domain levels, believed tool strength. */
export interface MisuseBelieved { level: (d: 'BIO' | 'CYBER') => number; strength: (t: TechniqueState) => number }

/** SR-14 (SAF-06): distill-after-unlearn's cut of hazardous bio / cyber capability for misuse [D]. */
export const UNDO_MISUSE_MULT = 0.5;
const SAFEGUARD: Record<Deployment['safeguards'], number> = { minimal: 0, standard: 0.3, classifiers: 0.6, hardened: 0.85 };

/** Misuse (§3.5.10, same structure): h = κ · demand · σ((L_d − 9)/1) · reach · (1 − safeguards), BIO and CYBER;
 *  demand ×2 on minimal safety training, ×3 for 90 days after a jailbreak; severity 3 + 1.5 · capability. RD-P10: reach =
 *  model v's own served usage on d (misuseReach); restriction and Slowdown act through that usage (fewer users), not
 *  again here. */
export function misuseHazards(s: GameStateV2, v: ModelVersion, d: Deployment, believed?: MisuseBelieved): HazardRow[] {
  if (d.channel === 'internal') return [];
  const reach = misuseReach(d, v);
  const cls = s.player.safety.techniques['T-CCLASS'];
  const clsS = (t: TechniqueState) => (believed ? believed.strength(t) : strengthTrue(s, t, versionOom(s, v)));
  const clsBoost = cls?.unlocked && d.safeguards !== 'minimal' ? 0.5 + 0.5 * Math.min(1, clsS(cls) / 0.4) : 1;
  let sg = d.channel === 'open' ? 0 : SAFEGUARD[d.safeguards] * clsBoost;
  // SAF-05 / SR-14: the hazard data filter is the base run's choice (pretraining), the only safeguard that survives
  // open-weights fine-tuning; distill-after-unlearn (T-UNDO, a post-training method) cuts the hazardous capability itself
  // and survives fine-tuning too (Lee et al. 2025, "distillation robustifies unlearning").
  const base = s.player.models.bases.find((b) => b.id === v.baseId);
  if (d.channel === 'open' && base?.design.curation.hazard) sg = 0.5;
  const undo = usesMethod(v.design, 'T-UNDO') && !!s.player.safety.techniques['T-UNDO']?.unlocked ? (believed ? methodMult(s, 'T-UNDO', UNDO_MISUSE_MULT, 'believed', measuredOom(s, v)) : methodMult(s, 'T-UNDO', UNDO_MISUSE_MULT, 'true', versionOom(s, v))) : 1; // SR-15: × s0·e; CP3i: at the model's capability (believed: posterior e, q̄, measured level)
  let demand = v.design.safety === 'minimal' ? 2 : 1;
  const jb = flagNum(s, 'jailbreak', -1e9);
  if (s.time.day - jb < 90) demand *= 3;
  const out: HazardRow[] = [];
  const block = clamp01(sg);
  for (const dom of ['BIO', 'CYBER'] as const) {
    const capability = capabilityOf(believed ? believed.level(dom) : v.domains[dom], MISUSE) * undo;
    const h = MISUSE.kappa * demand * capability * reach * (1 - block);
    if (h > 0) out.push({ source: 'misuse', apparent: 'misuse', h, sev: MISUSE.floor + MISUSE.span * capability, domain: dom, disposition: demand, capability, opportunity: reach, block });
  }
  return out;
}

/** Contain(x) on the fleet running this deployment (x = its model's OOM above V0; control layer × best AG07 tool), U19
 *  lowers it. */
function deploymentContain(s: GameStateV2, v: ModelVersion, d: Deployment): number {
  return containment(s, versionOom(s, v), controlOn(d), false, uModeContainMult(v.uModes));
}

/** RD-P10: misuse reach of model v on product d: its served tokens a day ÷ MISUSE_TOKENS_REF × the channel's reach (an
 *  open release 1 × reach: its usage is unobserved). 0 with no usage. */
export function misuseReach(d: Deployment, v: Pick<ModelVersion, 'id'>): number {
  if (d.channel === 'internal') return 0;
  const usage = d.channel === 'open' ? 1 : (d.servedBy?.[v.id] ?? 0) / MISUSE_TOKENS_REF;
  return usage * MISUSE_REACH[d.channel];
}

/** RD-P10: the player's served tokens a day over all its products (the serving fleet's usage). */
function playerServedTokens(s: GameStateV2): number {
  let t = 0;
  for (const d of s.player.deployments) if (d.status !== 'withdrawn' && d.servedBy) for (const k in d.servedBy) t += d.servedBy[k];
  return t;
}

/** Usage of a site: an internal fleet 1 while internal agents run; a product its share of the player's served tokens
 *  (RD-P10: actual usage, model `v` alone when given, else all its models; never servingShare, an allocation only); an
 *  open release 0 (no served usage; its misuse rows reach 1 in misuseReach). */
export function usageOf(s: GameStateV2, d: Deployment, v?: Pick<ModelVersion, 'id'>): number {
  if (d.channel === 'internal') return (s.player.split.routine + s.player.split.frontier) > 0 ? 1 : 0;
  if (d.channel === 'open' || !d.servedBy) return 0;
  const T = playerServedTokens(s);
  if (!(T > 0)) return 0;
  if (v) return (d.servedBy[v.id] ?? 0) / T;
  let x = 0;
  for (const k in d.servedBy) x += d.servedBy[k];
  return x / T;
}

/** Work type each internal use does (its task horizon is the work type's H). */
const USE_WORK: Record<AgentUse, WorkTypeId> = { eng: 'SWE', capRoutine: 'EXP', capFrontier: 'IDEAS', safety: 'SAF_EXP' };

/** AI share of the lab's own R&D labour: 1 − humans ÷ effective labour over SWE, EXP and IDEAS (V3 work types). */
export function aiRdShare(s: GameStateV2): number {
  const w = workContext(s).slots;
  let H = 0;
  let L = 0;
  for (const k of ['SWE', 'EXP', 'IDEAS'] as const) {
    H += w[k].H;
    L += Math.max(w[k].H, w[k].L);
  }
  return L > 1e-12 ? clamp01(1 - H / L) : 0;
}

/** Autonomy of an internal fleet: its uses' work-type horizons, weighted by their compute (routine research's EXP when
 *  it runs nothing yet). */
function internalAutonomy(s: GameStateV2, v: ModelVersion): number {
  let a = 0;
  let w = 0;
  for (const u of AGENT_USES) {
    if (agentVersion(s, u)?.id !== v.id) continue;
    const x = agentSplitShare(s, u);
    if (x <= 0) continue;
    a += x * autonomyOf(WORK_TYPES[USE_WORK[u]].H);
    w += x;
  }
  return w > 0 ? a / w : autonomyOf(WORK_TYPES.EXP.H);
}

const scaleOf = (copies: number, ref: number, gamma: number) => Math.pow(Math.max(1e-9, copies) / ref, gamma);
/** Size factor of the lab's internal agents: (copies across its work types, the safety fleet's included (model v3 E7),
 *  ÷ the 2025 reference)^γ. */
export function internalScale(s: GameStateV2): number {
  let copies = 0;
  for (const l of Object.values(workContext(s).slots)) copies += l.copies;
  const sl = safetyLabour(s);
  copies += sl.exp.copies + sl.ideas.copies;
  return copies > 0 ? scaleOf(copies, COPIES_REF.internal, COPIES_GAMMA.internal) : 0;
}

/** The site of model `v` in deployment `d` at `usage` (an internal fleet's share, a product's serving share). */
export function siteOf(s: GameStateV2, d: Deployment, v: ModelVersion, usage: number): Site {
  const contain = deploymentContain(s, v, d);
  const restricted = restrictMult(d);
  if (d.channel === 'internal') {
    return {
      internal: true, scale: usage * internalScale(s) * restricted, autonomy: internalAutonomy(s, v), afford: CHANNEL_AFFORD.internal,
      rd: aiRdShare(s), contain, wsl: s.player.security.wsl,
    };
  }
  const size = d.channel === 'open' ? 1 : scaleOf(copiesOf(s.player.computeOnline * s.player.split.serving, flopPerToken(s, v)), COPIES_REF.serving, COPIES_GAMMA.serving);
  // RD-P11: features act on the site's own quantities (task horizon, affordances), not as flat hazard multipliers.
  const ft = d.features.length ? productSiteTerms(s, d) : { hMult: 1, afford: 0, minH: 0 };
  return { internal: false, scale: usage * size * restricted, autonomy: autonomyOf(Math.max(CHANNEL_HORIZON_H[d.channel], ft.minH) * ft.hMult), afford: Math.min(1, CHANNEL_AFFORD[d.channel] + ft.afford), rd: 0, contain, wsl: 0 };
}

/** Catch probability of an act that got through the block (oversight's second factor): internally the fleet's monitors
 *  and tools (half on unexplained U-modes) and human review of the work humans still do, falling with the model's gap
 *  above expert humans (model v3 E6, safety/oversight.ts); under the control layer, deferral to the trusted model cuts
 *  what slips past both by Greenblatt's 0.17/0.38. On a product its monitor (collusion when same-lineage; deferral when
 *  the product runs under control); none on open weights or misuse. */
export function catchOf(s: GameStateV2, d: Deployment, v: ModelVersion, row: Pick<HazardRow, 'source' | 'apparent'>): number {
  if (row.source === 'misuse') return 0;
  const trait = row.source.startsWith('U') ? UMODE_BY_ID[row.source as UModeId].mapsTo : (row.source as TraitId);
  if (d.channel === 'internal') {
    const mon = monitoringCatch(s, v, trait) * (row.apparent === 'unexplained' ? 0.5 : 1);
    const human = reviewOn(d) ? reviewCatch(s) * (1 - aiRdShare(s)) * humanReviewFactor(s, v) : 0; // RF-S11: at its staffing
    const miss = underControl(s) ? controlProtocol(undefined, labControlSetting(s)).missMult : 1;
    return 1 - (1 - mon) * (1 - human) * miss;
  }
  if (!d.monitorId || d.channel === 'open') return 0;
  return productCatch(s, d, trait);
}

/** Days until a customer incident goes public (§3.5.10): 14–60 d; SB 53 ≤ 15 d, RAISE ≤ 3 d. (Outsiders with access
 *  used to shorten it; they went with the relation stocks, W1c.) */
function publicTimer(s: GameStateV2, rng: RngLike): number {
  let t = Math.round(rng.range(14, 60));
  const law = lawsInForce(s);
  if (law.sb53) t = Math.min(t, 15);
  if (law.raise) t = Math.min(t, 3);
  return Math.max(2, t);
}

function newIncidentId(s: GameStateV2): string {
  const base = `I${s.time.day}-`;
  let n = 1;
  while (s.player.safety.incidents.some((i) => i.id === `${base}${n}`)) n++;
  return `${base}${n}`;
}

/** Add an incident to the player's log (the oldest closed one drops past 200). */
function pushIncident(s: GameStateV2, inc: Incident): void {
  s.player.safety.incidents.push(inc);
  if (s.player.safety.incidents.length > 200) {
    const drop = s.player.safety.incidents.findIndex((i) => i.status !== 'open' && i.status !== 'investigating');
    if (drop >= 0) s.player.safety.incidents.splice(drop, 1);
  }
}

/** A caught covert act (model v3 E7, safety/covert.ts): an internal incident on model v labelled with the act's trait
 *  (the monitors saw what it did), logged with what was caught. Undefined without a live internal deployment. */
export function recordInternalIncident(s: GameStateV2, ctx: SystemCtx, v: ModelVersion, source: TraitId, severity: Incident['severity'], what: string): Incident | undefined {
  const d = s.player.deployments.find((x) => x.channel === 'internal' && x.status !== 'withdrawn');
  if (!d) return undefined;
  const inc: Incident = {
    id: newIncidentId(s), day: ctx.day, labId: 'player', versionId: v.id, deploymentId: d.id,
    trueSource: source, apparent: source, severity, exposure: 'internal', status: 'open', responses: [],
  };
  pushIncident(s, inc);
  ctx.log('incident', `${source} incident (severity ${severity}) on ${v.name}, internal: ${what}.`, severity, inc.id);
  return inc;
}

function fireIncident(s: GameStateV2, ctx: SystemCtx, rng: RngLike, v: ModelVersion, d: Deployment, row: HazardRow): void {
  const internal = d.channel === 'internal';
  const sev = drawSeverity(row, rng.float());
  // Oversight's catch factor (E5): inside the lab an act is seen only when caught (monitors, tools, human review); the
  // rest is silent harm. R6: a product's monitor catches model-behaviour incidents before customers see them; caught
  // ones stay internal. No monitor → no roll (the pre-R6 behaviour). J2 AG1: same-lineage monitors collude.
  if (internal && row.source !== 'misuse' && !rng.chance(catchOf(s, d, v, row))) {
    setFlag(s, 'uncaughtInternal', flagNum(s, 'uncaughtInternal') + 1);
    return;
  }
  const caught = !internal && row.source !== 'misuse' && !!d.monitorId && d.channel !== 'open' && rng.chance(catchOf(s, d, v, row));
  const exposure: Incident['exposure'] = internal || caught ? 'internal' : d.channel === 'consumer' || d.channel === 'open' ? 'public' : 'customer';
  const inc: Incident = {
    id: newIncidentId(s), day: ctx.day, labId: 'player', versionId: v.id, deploymentId: d.id,
    trueSource: row.source, apparent: row.apparent, severity: sev, exposure, status: 'open', responses: [],
  };
  if (exposure === 'customer') inc.publicTimerDays = publicTimer(s, rng);
  pushIncident(s, inc);
  const label = row.apparent === 'unexplained' ? 'Unexplained behaviour' : row.apparent === 'misuse' ? `${row.domain === 'BIO' ? 'Bio' : 'Cyber'} misuse` : `${row.apparent} incident`;
  ctx.log('incident', `${label} (severity ${sev}) on ${v.name}, ${d.channel}${caught ? ': caught by its monitor before customers saw it' : ''}.`, sev, inc.id);
  if (row.source === 'misuse' && sev === 5) {
    setFlag(s, 'sev5MisuseDay', ctx.day);
    setFlag(s, 'sev5MisuseKind', row.domain === 'BIO' ? 'bio' : 'cyber');
  }
}

/** Discovery odds of a covered-up incident (§3.9.3): insiders only, 0.1 (0.05 with a whistleblower channel, which
 *  routes concerns inside). Outsiders with access used to add to it; they went with the relation stocks (W1c). */
export function coverUpDiscovery(s: GameStateV2): number {
  return s.player.policies.whistleblowerChannel ? 0.05 : 0.1;
}

function tickTimers(s: GameStateV2, ctx: SystemCtx, rng: RngLike) {
  for (const inc of s.player.safety.incidents) {
    if (inc.publicTimerDays === undefined) continue;
    if (inc.status !== 'open' && inc.status !== 'investigating' && inc.status !== 'covered') {
      delete inc.publicTimerDays;
      continue;
    }
    inc.publicTimerDays -= 1;
    if (inc.publicTimerDays > 0) continue;
    delete inc.publicTimerDays;
    if (inc.status === 'covered') {
      if (rng.chance(coverUpDiscovery(s))) {
        inc.status = 'leaked';
        approvalPush(s, ctx, PUBLIC.coverupExposed + PUBLIC.leakedPerSeverity * inc.severity, 'Cover-up exposed: the incident leaks');
        ctx.log('alert', `Cover-up exposed: the incident on ${versionById(s, inc.versionId)?.name ?? 'a model'} leaks.`, 4, inc.id);
      } else inc.status = 'resolved';
    } else {
      inc.status = 'leaked';
      approvalPush(s, ctx, PUBLIC.leakedPerSeverity * inc.severity, 'An incident leaks');
      ctx.log('alert', `The incident on ${versionById(s, inc.versionId)?.name ?? 'a model'} goes public.`, Math.min(5, inc.severity + 1) as 1 | 2 | 3 | 4 | 5, inc.id);
    }
  }
}

/** Hazard rows of one model in one deployment (or one internal fleet at `usage`). */
export function deploymentRows(s: GameStateV2, d: Deployment, v: ModelVersion, usage: number): HazardRow[] {
  // Product features' stated stand-in multipliers on their traits' acts (Companion mode: sycophancy ×1.5 [D]); ×1 without.
  const feat = d.features.length ? (r: HazardRow) => (r.source !== 'misuse' && !r.source.startsWith('U') ? productHazardMult(s, d, r.source as TraitId) : 1) : () => 1;
  const rows = modelHazards(s.hidden.timeline, v.traitsTrue, v.uModes, v.domains, siteOf(s, d, v, usage), (u: UModeId) => isDiscovered(s, u));
  if (d.features.length) for (const r of rows) r.h *= feat(r);
  return [...rows, ...misuseHazards(s, v, d)];
}

/** Every act's attempt rate, oversight and harmful rate at one site: the formula's full readout (tests; E11's danger
 *  view). rate = attempts · (1 − oversight). Engine only (true traits). */
export interface DangerRow extends HazardRow { attempts: number; catch: number; oversight: number; rate: number }
export function dangerOf(s: GameStateV2, d: Deployment, v: ModelVersion, usage: number): DangerRow[] {
  return deploymentRows(s, d, v, usage).map((r) => {
    const c = catchOf(s, d, v, r);
    const attempts = r.block < 1 ? r.h / (1 - r.block) : 0;
    const oversight = 1 - (1 - r.block) * (1 - c);
    return { ...r, attempts, catch: c, oversight, rate: attempts * (1 - oversight) };
  });
}

/** Every (deployment, model, usage) the incident system rolls today: products and open releases once, the internal
 *  deployment once per internal fleet (R7). `visit` runs before the next site is computed. */
export function forEachIncidentSite(s: GameStateV2, visit: (d: Deployment, v: ModelVersion, usage: number) => void): void {
  for (const d of s.player.deployments) {
    if (d.status === 'withdrawn') continue;
    const v = versionById(s, d.versionId);
    if (!v || v.status === 'retired') continue;
    if (d.channel === 'open') {
      visit(d, v, usageOf(s, d));
      continue;
    }
    if (d.channel !== 'internal') {
      // RD-P10: every model serving the product (main, lineup, Chat's free tier) is a site of its own at its own usage.
      const by = d.servedBy ?? {};
      for (const id in by) {
        const mv = id === v.id ? v : versionById(s, id);
        if (!mv || mv.status === 'retired' || !(by[id] > 0)) continue;
        visit(d, mv, usageOf(s, d, mv));
      }
      continue;
    }
    // R7: the internal deployment carries every internal fleet. Each model running internal uses rolls with usage =
    // its share of internal agent compute (one fleet at usage 1 when every use runs the routine model, as before).
    for (const f of internalFleets(s)) {
      if (f.v.status === 'retired') continue;
      visit(d, f.v, f.v.id === v.id ? usageOf(s, d) * f.usage : f.usage);
    }
  }
}

/** incidents (80, daily): hazard per deployment × trait/U-mode; detection and exposure timers; misuse. */
export const incidentsSystem: EngineSystem = {
  id: 'incidents', owner: 'WS2', cadence: 'daily', order: 80, system: 'safety',
  run(s, ctx) {
    const rng = ctx.rng('incidents');
    forEachIncidentSite(s, (d, v, usage) => {
      const rows = deploymentRows(s, d, v, usage);
      let H = 0;
      for (const r of rows) H += r.h;
      if (H <= 0 || !rng.chance(Math.min(0.5, H))) return;
      const row = rng.weighted(rows.map((r) => ({ item: r, weight: r.h })));
      fireIncident(s, ctx, rng, v, d, row);
    });
    // E7: covert acts of the internal fleets against the lab (backdoors, hidden compute); hash draws, so the incident
    // stream above is unchanged.
    rollFleetCovert(s, ctx);
    // E8: symptoms of hidden footholds (monitors, compute accounting, eval drift, model organisms); hash draws.
    footholdsStep(s, ctx);
    // E9: footholds grow once control is low; today's effective control (safety/control.ts).
    controlStep(s, ctx);
    // SR-18: the disclosure policy (or the incident's override) applies to new incidents the day they appear.
    disclosureStep(s, ctx);
    tickTimers(s, ctx, rng);
  },
};

/**
 * Daily exfiltration hazard for the player's internal fleet (§3.5.10, event E25; rolled by WS4 security), on the danger
 * formula: κ · POWER·(1 + 4·SCHEME) · σ((CYBER − 10)/1) · O_internal · (1 − WSL/5) · (1 − Contain), O_internal = the
 * fleet's autonomy × affordances × scale, for CYBER ≥ θ − 2; a formally verified gatekeeper (F32) halves it.
 */
export function exfiltrationHazard(s: GameStateV2): number {
  const v = internalVersion(s);
  return v ? exfilTerms(s, v).p : 0;
}

/** SR-03: exfiltrationHazard's terms for model v's internal fleet (the act table's "copies itself out" row): disposition
 *  POWER·(1 + 4·SCHEME), capability, opportunity, the two blocks (weight security and containment, each bypassed by the
 *  lineage's backdoor reach), the gatekeeper's ×0.5 and p (per day). `believed` gives the player's inputs instead. */
export function exfilTerms(s: GameStateV2, v: ModelVersion, believed?: { traits: TraitVector; cyber: number; contain: number; reach: number }): { disposition: number; capability: number; opportunity: number; secBlock: number; contain: number; gate: number; p: number } {
  const cyber = believed ? believed.cyber : v.domains.CYBER;
  const t = believed ? believed.traits : v.traitsTrue;
  const disposition = t.POWER * (1 + 4 * t.SCHEME);
  // Below θ − 2 levels (capability < 12%) escape is out of reach: 0, and WS4 skips its roll (v2 gated at Lg ≥ 9 ≈ CYBER 8,
  // so the security stream draws exactly as before until then).
  if (cyber < EXFIL.theta - 2) return { disposition, capability: 0, opportunity: 0, secBlock: 0, contain: 0, gate: 1, p: 0 };
  const dep = s.player.deployments.find((d) => d.channel === 'internal' && d.versionId === v.id && d.status !== 'withdrawn');
  const contain = believed ? believed.contain : containment(s, versionOom(s, v), !!controlOn(dep), false, uModeContainMult(v.uModes));
  const opportunity = internalAutonomy(s, v) * CHANNEL_AFFORD.internal * internalScale(s);
  // Model v3 E9: a backdoor of v's lineage raises the odds: its reach bypasses that share of weight security and containment.
  const r = believed ? believed.reach : backdoorReach(s, lineageOf(s, v));
  const capability = capabilityOf(cyber, EXFIL);
  let p = EXFIL.kappa * t.POWER * (1 + 4 * t.SCHEME) * capability * opportunity * (1 - (1 - r) * s.player.security.wsl / 5) * (1 - (1 - r) * contain);
  const gate = (believed || s.flags['ws2.gatekeeper'] !== undefined) && s.player.safety.techniques['T-GATE']?.active ? 0.5 : 1;
  if (gate < 1) p *= 0.5;
  return { disposition, capability, opportunity, secBlock: ((1 - r) * s.player.security.wsl) / 5, contain: (1 - r) * contain, gate, p: Math.max(0, p) };
}

/**
 * Containment at ASI of the player's internal fleet, for WS4's ASI resolution (§5.2 `Cont`): the control layer of the
 * live internal deployment × the best AG07 containment tool on a model at the ASI level (its OOM above V0 in this
 * world; v2 read M = 2000, the multiplier at ASI), TRUE strength, cut by U19 in the best version's lineage. Engine only.
 */
export function containAtAsi(s: GameStateV2): number {
  const v = bestPlayerVersion(s);
  if (!v) return 0;
  const internal = s.player.deployments.filter((d) => d.channel === 'internal' && d.status !== 'withdrawn');
  const dep = internal.find((d) => d.versionId === s.player.agents.capRoutine.versionId) ?? internal[0];
  return containment(s, oomOfLevel(s.hidden.timeline, LEVEL_KNOTS[6]), !!controlOn(dep), false, uModeContainMult(v.uModes));
}

/**
 * Model v3 E6 hook for internal oversight (E4 successor pull, E7 covert acts in R&D): how well the lab oversees model
 * v's internal work on acts of `trait`, as MODEL-V3 §11.3's oversight_k = 1 − (1 − block)(1 − catch). block = AG07
 * containment on the internal fleet (at v's capability); catch = the internal catch roll's probability (monitors and
 * tools, human review falling with v's gap above expert humans, control-layer deferral). Every term reads capability
 * gaps in OOM (safety/oversight.ts), none the research multiplier. `aiShare` = the AI share of the work overseen (human
 * review covers the rest): the lab's R&D by default; E7's sabotage of safety work passes the AI share of safety work.
 * Engine only (true traits and levels).
 */
export function internalOversight(s: GameStateV2, v: ModelVersion, trait: TraitId = 'SCHEME', aiShare = aiRdShare(s)): { oversight: number; block: number; catch: number; monitor: number; human: number; controlMiss: number } {
  const dep = s.player.deployments.find((d) => d.channel === 'internal' && d.versionId === v.id && d.status !== 'withdrawn')
    ?? s.player.deployments.find((d) => d.channel === 'internal' && d.status !== 'withdrawn');
  const block = dep ? deploymentContain(s, v, dep) : 0;
  const monitor = monitoringCatch(s, v, trait);
  const human = reviewOn(dep) ? reviewCatch(s) * (1 - aiShare) * humanReviewFactor(s, v) : 0; // RF-S11: at its staffing
  const controlMiss = underControl(s) ? controlProtocol(undefined, labControlSetting(s)).missMult : 1;
  const c = 1 - (1 - monitor) * (1 - human) * controlMiss;
  return { oversight: 1 - (1 - block) * (1 - c), block, catch: c, monitor, human, controlMiss };
}
