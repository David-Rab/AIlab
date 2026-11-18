// Incidents: hazards, detection, public timers, exfiltration (V2-SPEC §3.5.10). Owner: WS2.
//
// Daily hazard per (live deployment or internal fleet, trait or U-mode): h = κ_j · x_j^1.5 · exposure_c · usage ·
// (1 − mitigation). Incidents are the main visible proxy of hidden traits and U-modes: the player sees `apparent`
// ('unexplained' for undiscovered U-modes) and severity; `trueSource` stays hidden.
import { CHANNEL_EXPOSURE, INCIDENT_KAPPA } from '../../../data/v2/traits';
import { UMODE_BY_ID } from '../../../data/v2/umodes';
import { bestPlayerVersion, internalVersion } from '../models/labs';
import type { CounterpartyId, Deployment, EngineSystem, GameStateV2, Incident, ModelVersion, RngLike, SystemCtx, TraitId, TraitVector, UModeId } from '../types';
import { clamp01, flagNum, setFlag, versionById, versionM } from './common';
import { monitoringCatch } from './detection';
import { containment, strengthTrue } from './techniques';
import { isDiscovered, uModeContainMult } from './umodes';
import { productCatch, productHazardMult } from '../models/products';
import { internalFleets } from '../departments/agents';

/** Hazard intensity of an undiscovered/discovered U-mode (it borrows the κ of its mapped trait) [D]. */
export const UMODE_X = 0.25;

/** Open (unresolved) incidents of the player, for WS4 events and WS5 headlines. */
export function openIncidents(s: GameStateV2): Incident[] {
  return s.player.safety.incidents.filter((i) => i.status === 'open' || i.status === 'investigating');
}

export interface HazardRow { source: TraitId | UModeId | 'misuse'; apparent: TraitId | 'unexplained' | 'misuse'; h: number; severity: [number, number]; domain?: 'BIO' | 'CYBER' }

/**
 * Per-source daily hazards for one model in one context (§3.5.10). Exported for WS4 (rival incidents use the same
 * hazard with their own exposure). `discovered(u)` decides the apparent label of U-mode incidents.
 */
export function modelHazards(
  traits: TraitVector, uModes: readonly UModeId[], exposure: number, usage: number, mitigation: number, internal: boolean,
  discovered: (u: UModeId) => boolean = () => false,
): HazardRow[] {
  const out: HazardRow[] = [];
  const k0 = exposure * usage * (1 - mitigation);
  if (k0 <= 0) return out;
  for (const [t, row] of Object.entries(INCIDENT_KAPPA) as [TraitId, NonNullable<(typeof INCIDENT_KAPPA)[TraitId]>][]) {
    if (row.internalOnly && !internal) continue;
    const h = row.kappa * Math.pow(traits[t], 1.5) * k0;
    if (h > 0) out.push({ source: t, apparent: t, h, severity: row.severity });
  }
  for (const u of uModes) {
    const def = UMODE_BY_ID[u];
    const row = INCIDENT_KAPPA[def.mapsTo] ?? { kappa: 3e-4, severity: [2, 3] as [number, number] };
    out.push({ source: u, apparent: discovered(u) ? def.mapsTo : 'unexplained', h: row.kappa * Math.pow(UMODE_X, 1.5) * k0, severity: row.severity });
  }
  return out;
}

const SAFEGUARD: Record<Deployment['safeguards'], number> = { minimal: 0, standard: 0.3, classifiers: 0.6, hardened: 0.85 };

/** Misuse hazards (§3.5.10): h = 1e-4 · max(0, L_d − 7) · reach · (1 − safeguards), BIO and CYBER. */
export function misuseHazards(s: GameStateV2, v: ModelVersion, d: Deployment): HazardRow[] {
  if (d.channel === 'internal') return [];
  const reach = (d.channel === 'open' ? 1 : d.servingShare) * CHANNEL_EXPOSURE[d.channel];
  const cls = s.player.safety.techniques['T-CCLASS'];
  const clsBoost = cls?.unlocked && d.safeguards !== 'minimal' ? 0.5 + 0.5 * Math.min(1, strengthTrue(s, cls, versionM(s, v)) / 0.4) : 1;
  let sg = d.channel === 'open' ? 0 : SAFEGUARD[d.safeguards] * clsBoost;
  if (d.channel === 'open' && v.design.techniques.includes('T-FILTER')) sg = 0.5; // only the hazard filter survives fine-tuning
  let mult = v.design.safety === 'minimal' ? 2 : 1;
  const jb = flagNum(s, 'jailbreak', -1e9);
  if (s.time.day - jb < 90) mult *= 3;
  if (d.status === 'restricted') mult *= 0.3;
  const out: HazardRow[] = [];
  for (const dom of ['BIO', 'CYBER'] as const) {
    const h = 1e-4 * Math.max(0, v.domains[dom] - 7) * reach * (1 - clamp01(sg)) * mult;
    if (h > 0) out.push({ source: 'misuse', apparent: 'misuse', h, severity: [3, 5], domain: dom });
  }
  return out;
}

/** Contain(M) on the fleet running this deployment (control layer × best AG07 tool), U19 lowers it. */
function deploymentContain(s: GameStateV2, v: ModelVersion, d: Deployment): number {
  return containment(s, versionM(s, v), d.controlLayer, false, uModeContainMult(v.uModes));
}

function usageOf(s: GameStateV2, d: Deployment): number {
  if (d.channel === 'internal') return s.player.split.agents > 0 ? 1 : 0;
  return d.servingShare;
}

export function outsidersWithAccess(s: GameStateV2): CounterpartyId[] {
  return (['evalGov', 'evalIndep', 'academia', 'exec'] as CounterpartyId[]).filter((cp) => (s.relations.stocks[cp]?.access ?? 0) >= 2);
}

/** Days until a customer incident goes public (§3.5.10): 14–60 d; SB 53 ≤ 15 d, RAISE ≤ 3 d; fewer with outsiders. */
function publicTimer(s: GameStateV2, rng: RngLike): number {
  let t = Math.round(rng.range(14, 60));
  if (s.gov.statutes.sb53) t = Math.min(t, 15);
  if (s.gov.statutes.raise) t = Math.min(t, 3);
  t = Math.round(t * (1 - 0.1 * outsidersWithAccess(s).length));
  return Math.max(2, t);
}

/** Trust/approval hit when an incident becomes public (§3.9.1: losses scale up with trust). */
function publicPenalty(s: GameStateV2, ctx: SystemCtx, inc: Incident, mult: number, why: string) {
  const sev = inc.severity;
  ctx.bump('pub.approval', -sev * mult, 'incident', why);
  ctx.bump('pub.concern', (sev * mult) / 2, 'incident', why);
  ctx.bump('relations.scrutiny', 2 * sev * mult, 'incident', why);
  for (const cp of ['exec', 'evalGov'] as CounterpartyId[]) {
    const T = s.relations.stocks[cp]?.trust ?? 50;
    ctx.bump(`trust:${cp}`, -0.5 * sev * mult * (1 + T / 100), 'incident', why);
  }
}

function newIncidentId(s: GameStateV2): string {
  const base = `I${s.time.day}-`;
  let n = 1;
  while (s.player.safety.incidents.some((i) => i.id === `${base}${n}`)) n++;
  return `${base}${n}`;
}

function fireIncident(s: GameStateV2, ctx: SystemCtx, rng: RngLike, v: ModelVersion, d: Deployment, row: HazardRow): void {
  const internal = d.channel === 'internal';
  const severity = Math.round(rng.range(row.severity[0], row.severity[1] + 0.999)) as Incident['severity'];
  const sev = Math.max(1, Math.min(5, severity)) as Incident['severity'];
  if (internal && row.source !== 'misuse') {
    // Internal incidents are caught with P = monitoring strength on that fleet (§3.5.10).
    const trait = typeof row.source === 'string' && row.source.startsWith('U') ? UMODE_BY_ID[row.source as UModeId].mapsTo : (row.source as TraitId);
    const p = monitoringCatch(s, v, trait) * (row.apparent === 'unexplained' ? 0.5 : 1);
    if (!rng.chance(p)) {
      setFlag(s, 'uncaughtInternal', flagNum(s, 'uncaughtInternal') + 1);
      return;
    }
  }
  // R6: a product's monitor catches model-behaviour incidents before customers see them (catch rate, D7); caught ones
  // stay internal. No monitor → no roll (the pre-R6 behaviour).
  // J2 AG1: a same-lineage monitor catches collusion-relevant incidents less often.
  const src = typeof row.source === 'string' && row.source.startsWith('U') ? UMODE_BY_ID[row.source as UModeId].mapsTo : row.source === 'misuse' ? undefined : (row.source as TraitId);
  const caught = !internal && row.source !== 'misuse' && !!d.monitorId && d.channel !== 'open' && rng.chance(productCatch(s, d, src));
  const exposure: Incident['exposure'] = internal || caught ? 'internal' : d.channel === 'consumer' || d.channel === 'open' ? 'public' : 'customer';
  const inc: Incident = {
    id: newIncidentId(s), day: ctx.day, labId: 'player', versionId: v.id, deploymentId: d.id,
    trueSource: row.source, apparent: row.apparent, severity: sev, exposure, status: 'open', responses: [],
  };
  if (exposure === 'customer') inc.publicTimerDays = publicTimer(s, rng);
  s.player.safety.incidents.push(inc);
  if (s.player.safety.incidents.length > 200) {
    const drop = s.player.safety.incidents.findIndex((i) => i.status !== 'open' && i.status !== 'investigating');
    if (drop >= 0) s.player.safety.incidents.splice(drop, 1);
  }
  const label = row.apparent === 'unexplained' ? 'Unexplained behaviour' : row.apparent === 'misuse' ? `${row.domain === 'BIO' ? 'Bio' : 'Cyber'} misuse` : `${row.apparent} incident`;
  ctx.log('incident', `${label} (severity ${sev}) on ${v.name}, ${d.channel}${caught ? ': caught by its monitor before customers saw it' : ''}.`, sev, inc.id);
  if (exposure === 'public') publicPenalty(s, ctx, inc, 1, inc.id);
  if (row.source === 'misuse' && sev === 5) {
    setFlag(s, 'sev5MisuseDay', ctx.day);
    setFlag(s, 'sev5MisuseKind', row.domain === 'BIO' ? 'bio' : 'cyber');
  }
}

/** Discovery odds of a covered-up incident (§3.9.3): 1 − Π(1 − p_k), p_k = 0.05 + 0.25·publishPressure. */
export function coverUpDiscovery(s: GameStateV2): number {
  let miss = 1;
  for (const cp of outsidersWithAccess(s)) {
    const pp = cp === 'evalGov' ? s.researchBodies.evalGov.publishPressure : cp === 'evalIndep' ? s.researchBodies.evalIndep.publishPressure : 0.3;
    miss *= 1 - clamp01(0.05 + 0.25 * pp);
  }
  miss *= s.player.policies.whistleblowerChannel ? 0.95 : 0.9; // insiders
  return 1 - miss;
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
        publicPenalty(s, ctx, inc, 3, `cover-up ${inc.id}`);
        ctx.bump('relations.credibility', -15, 'cover-up', inc.id);
        ctx.log('alert', `Cover-up exposed: incident ${inc.id} leaks.`, 4, inc.id);
      } else inc.status = 'resolved';
    } else {
      inc.status = 'leaked';
      publicPenalty(s, ctx, inc, 1.5, `leak ${inc.id}`);
      ctx.log('alert', `Incident ${inc.id} goes public.`, Math.min(5, inc.severity + 1) as 1 | 2 | 3 | 4 | 5, inc.id);
    }
  }
}

/** incidents (80, daily): hazard per deployment × trait/U-mode; detection and exposure timers; misuse. */
export const incidentsSystem: EngineSystem = {
  id: 'incidents', owner: 'WS2', cadence: 'daily', order: 80, system: 'safety',
  run(s, ctx) {
    const rng = ctx.rng('incidents');
    const disc = (u: UModeId) => isDiscovered(s, u);
    const roll = (d: Deployment, v: ModelVersion, usage: number) => {
      const internal = d.channel === 'internal';
      const contain = deploymentContain(s, v, d);
      const restricted = d.status === 'restricted' ? 0.3 : 1;
      // Product features scale their traits' hazards (e.g. Companion mode: sycophancy ×1.5); ×1 without features.
      const feat = d.features.length ? (r: HazardRow) => (typeof r.source === 'string' && !r.source.startsWith('U') && r.source !== 'misuse' ? productHazardMult(s, d, r.source as TraitId) : 1) : () => 1;
      const rows = [
        ...modelHazards(v.traitsTrue, v.uModes, CHANNEL_EXPOSURE[d.channel], usage, contain, internal, disc).map((r) => ({ ...r, h: r.h * restricted * feat(r) })),
        ...misuseHazards(s, v, d),
      ];
      let H = 0;
      for (const r of rows) H += r.h;
      if (H <= 0 || !rng.chance(Math.min(0.5, H))) return;
      const row = rng.weighted(rows.map((r) => ({ item: r, weight: r.h })));
      fireIncident(s, ctx, rng, v, d, row);
    };
    for (const d of s.player.deployments) {
      if (d.status === 'withdrawn') continue;
      const v = versionById(s, d.versionId);
      if (!v || v.status === 'retired') continue;
      if (d.channel !== 'internal') {
        roll(d, v, usageOf(s, d));
        continue;
      }
      // R7: the internal deployment carries every internal fleet. Each model running internal uses rolls with usage =
      // its share of internal agent compute (one fleet at usage 1 when every use runs the routine model, as before).
      for (const f of internalFleets(s)) {
        if (f.v.status === 'retired') continue;
        roll(d, f.v, f.v.id === v.id ? usageOf(s, d) * f.usage : f.usage);
      }
    }
    tickTimers(s, ctx, rng);
  },
};

/**
 * Daily exfiltration hazard for the player's internal fleet (§3.5.10, event E25; rolled by WS4 security):
 * P = 1e-4 · POWER · (1 + 4·SCHEME) · max(0, L_AGENCY − 8) · (1 − WSL/5) · (1 − Contain), for L ≥ 9;
 * a formally verified gatekeeper (F32) halves it.
 */
export function exfiltrationHazard(s: GameStateV2): number {
  const v = internalVersion(s);
  if (!v || v.Lg < 9) return 0;
  const dep = s.player.deployments.find((d) => d.channel === 'internal' && d.versionId === v.id && d.status !== 'withdrawn');
  const contain = containment(s, versionM(s, v), !!dep?.controlLayer, false, uModeContainMult(v.uModes));
  const t = v.traitsTrue;
  let p = 1e-4 * t.POWER * (1 + 4 * t.SCHEME) * Math.max(0, v.domains.AGENCY - 8) * (1 - s.player.security.wsl / 5) * (1 - contain);
  if (s.flags['ws2.gatekeeper'] !== undefined && s.player.safety.techniques['T-GATE']?.active) p *= 0.5;
  return Math.max(0, p);
}

/**
 * Contain(M = 2000) of the player's internal fleet, for WS4's ASI resolution (§5.2 `Cont`): the control layer of the
 * live internal deployment × the best AG07 containment tool at M = 2000 (TRUE strength), cut by U19 in the best
 * version's lineage. Engine only.
 */
export function contain2000(s: GameStateV2): number {
  const v = bestPlayerVersion(s);
  if (!v) return 0;
  const internal = s.player.deployments.filter((d) => d.channel === 'internal' && d.status !== 'withdrawn');
  const dep = internal.find((d) => d.versionId === s.player.agents.capRoutine.versionId) ?? internal[0];
  return containment(s, 2000, !!dep?.controlLayer, false, uModeContainMult(v.uModes));
}

/** Hazards for a non-player lab's model (WS4 rolls them with its own stream; visibility per its posture). */
export function labModelHazards(traits: TraitVector, uModes: readonly UModeId[], exposure: number, usage: number, mitigation: number): HazardRow[] {
  return modelHazards(traits, uModes, exposure, usage, mitigation, false, () => true);
}
