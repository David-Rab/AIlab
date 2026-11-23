// Safeguards (SAFETY-REDESIGN §2.2 concept 7, §3.3; SR-13): owned items attached to one deployment (a product or the
// internal agent package). Each item lists its stop-rate contribution per act, its Slowdown (% of the deployment's useful
// work lost) and its cost (compute, people). Kinds:
//   control   trusted monitoring with defer-to-trusted (10% or 20% of actions) or Ctrl-Z resampling [S: research/20 F4]
//   review    human review of the work humans still do (stops acts below expert-human capability)
//   restrict  scoped context / no internet / no code execution: cuts Chances (usage ×RESTRICT); two-way (can be lifted)
//   lockdown  comms lockdown (AI 2027 Slowdown: lock the shared memory bank): halves the collusion / successor penalty
// One combine rule (actTable's Stop rate): stop = 1 − Π (1 − stop_i) over the deployment's items and its monitor.
// The engine formulas (incidents.ts catchOf / internalOversight, believedOversight.ts) are this product written out:
// 1 − (1 − block)(1 − monitor)(1 − human)·miss, with the control item's own stop 1 − (1 − block)·miss.
// AG07 research improves the control item (its "contain" tools are the item's block at their strength; T-RESAMPLE
// unlocks the resample setting; T-LOCK unlocks the lockdown item); it is no longer a separate tool or a layer flag.

import type { ControlSetting, Deployment, GameStateV2, SafeguardItem, SafeguardKind } from '../types';

/** Greenblatt et al. 2023 trusted-monitoring table rows (research/20 F4) and Ctrl-Z (Bhatt et al. 2025) by setting.
 *  safety0 / safety = the protocol's safety without / with the setting; usefulness = share of useful work kept at the
 *  full trusted-model gap (≈ 1 OOM: GPT-3.5 trusted for GPT-4). */
export const CONTROL_SETTINGS: Record<ControlSetting, { label: string; safety0: number; safety: number; usefulness: number; deferShare: number; src: string }> = {
  // [S] 62% safe at 97% usefulness (no deferral) → 83% at 93% with 10% deferred.
  defer10: { label: 'Defer 10% to trusted', safety0: 0.62, safety: 0.83, usefulness: 0.93, deferShare: 0.1, src: 'S: Greenblatt F4' },
  // [S] 92% at 83% with 20% deferred.
  defer20: { label: 'Defer 20% to trusted', safety0: 0.62, safety: 0.92, usefulness: 0.83, deferShare: 0.2, src: 'S: Greenblatt F4' },
  // [S] Ctrl-Z resampling: attack success 58% → 7% at 5% usefulness cost; [D] its attack success read as "acts slipping
  // past" (safety = 1 − 0.07 against 1 − 0.58), its bash setting mapped onto every internal act.
  resample: { label: 'Resample suspicious actions', safety0: 0.42, safety: 0.93, usefulness: 0.95, deferShare: 0.05, src: 'S: Ctrl-Z F4; D: mapping' },
};
/** Greenblatt's no-deferral usefulness (audits and false alarms on 2% of actions) [S: F4]. */
export const CONTROL_U0 = 0.97;
/** Usage kept under a restriction (revenue, misuse reach, incident chances) [D, unchanged from restrictContext]. */
export const RESTRICT = 0.3;
/** Comms lockdown: × on the same-lineage collusion penalty [proxy: Greenblatt et al. 2023/24 arXiv 2312.06942 Table 6,
 *  input and output redaction or paraphrase cut the worst-signal loss 0.41 → 0.18 (≈ ×0.45); lockdown stands in for
 *  redaction / no shared scheme (Zolkowski et al. 2025 arXiv 2507.02737); research/RD-SR24-safety-params.md §2 K2, K6;
 *  SR-24b], and its Slowdown on the
 *  deployment's work [D: agents lose the shared memory bank; no source quantifies it]. */
export const LOCKDOWN_COLLUSION_MULT = 0.5;
export const LOCKDOWN_SLOWDOWN = 0.03;
/** Human-review staff: safety engineers per 10% of the lab's R&D work humans still review [D]. */
export const REVIEW_STAFF = 5;
/** Control-protocol compute: the trusted model reruns the deferred / resampled share of actions at its cost ratio [D:
 *  trusted model ≈ 1/10 of the watched model's FLOP per token]. */
export const CONTROL_TRUSTED_COST = 0.1;

export const SAFEGUARD_LABEL: Record<SafeguardKind, string> = {
  control: 'Control protocol', review: 'Human review', restrict: 'Restriction', lockdown: 'Comms lockdown',
};

export const guardOf = (d: Deployment | undefined, kind: SafeguardKind): SafeguardItem | undefined => d?.guards?.find((g) => g.kind === kind);
export const controlOn = (d: Deployment | undefined) => !!guardOf(d, 'control');
export const reviewOn = (d: Deployment | undefined) => !!guardOf(d, 'review');
export const isRestricted = (d: Deployment | undefined) => !!guardOf(d, 'restrict');
export const lockdownOnDep = (d: Deployment | undefined) => !!guardOf(d, 'lockdown');
/** Usage multiplier of a deployment's restriction (1 when unrestricted). */
export const restrictMult = (d: Deployment | undefined) => (isRestricted(d) ? RESTRICT : 1);

const liveInternal = (s: GameStateV2) => s.player.deployments.filter((d) => d.channel === 'internal' && d.status === 'live');
/** Comms lockdown on the lab's internal agents. */
export const lockdownOn = (s: GameStateV2) => liveInternal(s).some(lockdownOnDep);
/** Setting of the lab's internal control protocol (the first live internal deployment with one; defer 10% else). */
export function labControlSetting(s: GameStateV2): ControlSetting {
  for (const d of liveInternal(s)) {
    const g = guardOf(d, 'control');
    if (g) return g.setting ?? 'defer10';
  }
  return 'defer10';
}

const unlocked = (s: GameStateV2, id: string) => !!s.player.safety.techniques[id]?.unlocked;
/** Why an item cannot be added (undefined = it can). AG07 research unlocks resampling and the lockdown. */
export function cannotAdd(s: GameStateV2, d: Deployment, kind: SafeguardKind, setting?: ControlSetting): string | undefined {
  if (d.status === 'withdrawn') return 'Deployment is withdrawn';
  if (kind === 'control' && setting === 'resample' && !unlocked(s, 'T-RESAMPLE')) return 'Needs Resample protocols (AI control research)';
  if (kind === 'lockdown' && !unlocked(s, 'T-LOCK')) return 'Needs Comms lockdown (AI control research)';
  if (kind === 'lockdown' && d.channel !== 'internal') return 'Comms lockdown is for internal agents';
  if (kind === 'review' && d.channel !== 'internal') return 'Human review is for internal work';
  return undefined;
}

/** Add (or re-set) an item; returns an error string when it cannot be added. */
export function addSafeguard(s: GameStateV2, d: Deployment, kind: SafeguardKind, setting?: ControlSetting): string | undefined {
  const why = cannotAdd(s, d, kind, setting);
  if (why) return why;
  d.guards = (d.guards ?? []).filter((g) => g.kind !== kind);
  d.guards.push(kind === 'control' ? { kind, setting: setting ?? 'defer10', since: s.time.day } : { kind, since: s.time.day });
  return undefined;
}
/** Remove an item (lifting a restriction, turning control off); false when it was not there. */
export function removeSafeguard(d: Deployment, kind: SafeguardKind): boolean {
  const n = d.guards?.length ?? 0;
  d.guards = (d.guards ?? []).filter((g) => g.kind !== kind);
  return d.guards.length < n;
}
/** Set / clear the control protocol without the unlock checks (events, scripts). */
export function setControl(d: Deployment, on: boolean, setting: ControlSetting = 'defer10', day = 0) {
  d.guards = (d.guards ?? []).filter((g) => g.kind !== 'control');
  if (on) d.guards.push({ kind: 'control', setting, since: day });
}

/** The one combine rule: stop = 1 − Π (1 − stop_i). */
export const combineStop = (stops: readonly number[]) => 1 - stops.reduce((m, x) => m * (1 - Math.max(0, Math.min(1, x))), 1);

/** Control protocol at a setting and trusted-model gap (OOM; undefined = no trusted model, the full loss):
 *  usefulness = U0 − (U0 − U(setting))·min(1, gap ÷ 1 OOM); acts slipping past × (1 − safety) ÷ (1 − safety0). */
export function controlTerms(setting: ControlSetting, gapOom: number | undefined, gapFull = 1) {
  const c = CONTROL_SETTINGS[setting];
  const f = gapOom === undefined ? 1 : Math.min(1, Math.max(0, gapOom) / gapFull);
  const usefulness = CONTROL_U0 - (CONTROL_U0 - c.usefulness) * f;
  return { usefulness, slowdown: 1 - usefulness, missMult: (1 - c.safety) / (1 - c.safety0), deferShare: c.deferShare };
}

export interface SafeguardLine {
  kind: SafeguardKind;
  label: string;
  setting?: ControlSetting;
  /** Stop-rate contribution on every act at this site (0..1; restrictions and lockdown cut Chances instead). */
  stop: number;
  /** Chances × (restriction, lockdown on collusion acts). */
  chancesMult: number;
  /** Share of the deployment's useful work (internal) or usage (product) lost. */
  slowdown: number;
  /** Compute: share of the deployment's compute added; people: safety engineers. */
  compute: number;
  people: number;
}

/** One deployment's items in player terms; `block` = the AG07 containment strength under its control item, `human` the
 *  review catch, `gapOom` the trusted-model gap (both from the caller: oversight.ts / incidents.ts own the formulas). */
export function safeguardLines(d: Deployment, o: { block: number; human: number; gapOom?: number; humanShare?: number }): SafeguardLine[] {
  const out: SafeguardLine[] = [];
  for (const g of d.guards ?? []) {
    if (g.kind === 'control') {
      const t = controlTerms(g.setting ?? 'defer10', o.gapOom);
      out.push({ kind: 'control', label: `${SAFEGUARD_LABEL.control}: ${CONTROL_SETTINGS[g.setting ?? 'defer10'].label}`, setting: g.setting, stop: 1 - (1 - o.block) * t.missMult, chancesMult: 1, slowdown: t.slowdown, compute: controlComputeShare(g.setting), people: 0 });
    } else if (g.kind === 'review') {
      out.push({ kind: 'review', label: SAFEGUARD_LABEL.review, stop: o.human, chancesMult: 1, slowdown: 0, compute: 0, people: reviewStaff(o.humanShare ?? 0) });
    } else if (g.kind === 'restrict') {
      out.push({ kind: 'restrict', label: SAFEGUARD_LABEL.restrict, stop: 0, chancesMult: RESTRICT, slowdown: 1 - RESTRICT, compute: 0, people: 0 });
    } else {
      out.push({ kind: 'lockdown', label: SAFEGUARD_LABEL.lockdown, stop: 0, chancesMult: LOCKDOWN_COLLUSION_MULT, slowdown: LOCKDOWN_SLOWDOWN, compute: 0, people: 0 });
    }
  }
  return out;
}
/** Total Slowdown of a deployment's items: 1 − Π (1 − slowdown_i). */
export const totalSlowdown = (lines: readonly SafeguardLine[]) => combineStop(lines.map((l) => l.slowdown));
/** Human review on the lab's internal work (any non-withdrawn internal deployment carrying the item). */
export const labReviewOn = (s: GameStateV2) => s.player.deployments.some((d) => d.channel === 'internal' && d.status !== 'withdrawn' && reviewOn(d));

// ───────── SR-13b: the costs each line shows are charged ─────────

/** Control protocol compute as a share of the watched deployment's compute: the deferred / resampled share × the trusted
 *  model's cost ratio (safeguardLines' `compute`). Internal: billed to the monitors' line of the flat allocation
 *  (departments/agents.ts monitorBudget); products: to the product's serving (worldfx/revenue.ts). */
export const controlComputeShare = (setting: ControlSetting = 'defer10') => CONTROL_SETTINGS[setting].deferShare * CONTROL_TRUSTED_COST;
/** A product's serving overhead from its safeguards (share of its serving need): the control protocol's compute. */
export function productSafeguardOverhead(d: Deployment): number {
  const g = guardOf(d, 'control');
  return g ? controlComputeShare(g.setting) : 0;
}
/** Usage kept on a product by its safeguards: restriction × RESTRICT and the control protocol's Slowdown at the full
 *  trusted gap (products defer to the trusted model with no measured gap: actTable's product line). */
export function productUsageMult(d: Deployment): number {
  if (d.held) return 0; // SR-19: held by the Safety framework (serves nobody until released or overridden)
  const g = guardOf(d, 'control');
  return restrictMult(d) * (g ? 1 - controlTerms(g.setting ?? 'defer10', undefined).slowdown : 1);
}
/** Human-review staff (safety research engineers) at a human share of the lab's R&D work (safeguardLines' `people`). */
export const reviewStaff = (humanShare: number) => Math.round(REVIEW_STAFF * 10 * Math.max(0, Math.min(1, humanShare)));
