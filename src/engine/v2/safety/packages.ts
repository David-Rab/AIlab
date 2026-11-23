// SR-20 (SAFETY-REDESIGN §3.3 Defaults, §3.8): default safeguard PACKAGES. A package is a named bundle of the existing
// safeguard parts the player applies to one product or to the internal agent deployment in one act; it sets exactly its
// parts (a part not in the package is turned off). Each package meets the Safety framework rules of its tier
// (data/v2/framework.ts DEFAULT_FRAMEWORK_RULES):
//   Standard   products: standard misuse safeguards        internal: human review
//   High       products: classifier misuse safeguards       internal: human review + control (defer 10%)
//              (Bio / Cyber High: classifiers)                        (Misalignment signs: control)
//   Critical   products: hardened misuse safeguards         internal: human review + control (defer 20%)
//              + control (defer 10%) (Bio / Cyber Critical)           (AI R&D Critical: control + review)
// Nothing here is a new cost: the preview runs the engine's own charging functions on the deployment before and after
// each part (revenue and serving need of the product: worldfx/productView previewDeployments; internal: the control
// protocol's compute on the monitors' line, departments/agents.ts monitorBudget; the review staff, safety/investigations
// safeguardFte; the Slowdown on the agents' work, safety/oversight.ts useControl). Part lines are increments, applied
// in order, so they sum to the package's total. Stop rates are the act table's (believed), before → after.
// Parts stay editable after (product.update safeguards, the control / review / lockdown verbs).
import { AGENT_USES } from '../../../data/v2/agents';
import { agentCompute, agentVersion, monitorBudget, monitorVersion, syncInternalControl } from '../departments/agents';
import { hypothetical, previewDeployments } from '../worldfx/productView';
import { actTable, type ActTarget } from './actTable';
import { safeguardFte } from './investigations';
import { useControl } from './oversight';
import { CONTROL_SETTINGS, addSafeguard, removeSafeguard, setControl } from './safeguards';
import type { ControlSetting, Deployment, GameStateV2 } from '../types';

export type SafeguardPackageId = 'standard' | 'high' | 'critical';
export const SAFEGUARD_PACKAGE_IDS: SafeguardPackageId[] = ['standard', 'high', 'critical'];

export interface PackageParts {
  /** Products: the misuse-safeguard level. */
  misuse?: Deployment['safeguards'];
  /** Control protocol setting (absent = off). */
  control?: ControlSetting;
  /** Internal: human review. */
  review?: boolean;
}

export const SAFEGUARD_PACKAGES: Record<SafeguardPackageId, { label: string; meets: string; product: PackageParts; internal: PackageParts }> = {
  standard: { label: 'Standard', meets: 'the base rule (capability assessment)', product: { misuse: 'standard' }, internal: { review: true } },
  high: { label: 'High', meets: 'Bio / Cyber High (classifiers); Misalignment signs (control)', product: { misuse: 'classifiers' }, internal: { review: true, control: 'defer10' } },
  critical: { label: 'Critical', meets: 'Bio / Cyber Critical (hardened); AI R&D Critical (control + review)', product: { misuse: 'hardened', control: 'defer10' }, internal: { review: true, control: 'defer20' } },
};

const isInternal = (d: Deployment) => d.channel === 'internal';
export const packageParts = (d: Deployment, id: SafeguardPackageId): PackageParts => (isInternal(d) ? SAFEGUARD_PACKAGES[id].internal : SAFEGUARD_PACKAGES[id].product);

type Step = { label: string; run: (s: GameStateV2, d: Deployment) => void };
/** The package's parts as ordered steps (each sets one part on `d` in `s`). */
function steps(d: Deployment, id: SafeguardPackageId): Step[] {
  const p = packageParts(d, id);
  const out: Step[] = [];
  if (!isInternal(d)) out.push({ label: `Misuse safeguards: ${p.misuse ?? 'standard'}`, run: (_s, x) => { x.safeguards = p.misuse ?? 'standard'; } });
  if (isInternal(d)) out.push({
    label: p.review ? 'Human review' : 'No human review',
    run: (s, x) => { if (p.review) addSafeguard(s, x, 'review'); else removeSafeguard(x, 'review'); },
  });
  out.push({
    label: p.control ? `Control protocol: ${CONTROL_SETTINGS[p.control].label}` : 'No control protocol',
    run: (s, x) => {
      setControl(x, !!p.control, p.control ?? 'defer10', s.time.day);
      if (!isInternal(x)) return;
      // The internal control item follows the packages running its model (RD-A06): set them, then sync.
      for (const u of AGENT_USES) if (agentVersion(s, u)?.id === x.versionId) s.player.agents[u].control = !!p.control;
      syncInternalControl(s);
    },
  });
  return out;
}

/** Why the package cannot be applied (undefined = it can). */
export function packageBlock(_s: GameStateV2, d: Deployment | undefined): string | undefined {
  if (!d) return 'Unknown deployment';
  if (d.status === 'withdrawn') return 'Deployment is withdrawn';
  if (d.channel === 'open') return 'Open weights carry no safeguards';
  return undefined;
}

/** Apply a package (sets exactly its parts). */
export function applyPackage(s: GameStateV2, d: Deployment, id: SafeguardPackageId): string | undefined {
  const why = packageBlock(s, d);
  if (why) return why;
  for (const st of steps(d, id)) st.run(s, d);
  return undefined;
}

/** What the engine charges for a deployment's safeguards in a state. Internal: control compute (H100e, the monitors'
 *  line), review staff (safety engineers), Slowdown (share of the agents' work lost, compute-weighted). Product: its
 *  revenue and serving need are read by previewDeployments (deltas only). */
function internalCharges(s: GameStateV2) {
  let c = 0, lost = 0;
  for (const u of AGENT_USES) {
    const h = agentCompute(s, u);
    c += h;
    lost += h * (1 - useControl(s, agentVersion(s, u), monitorVersion(s, u), !!s.player.agents[u].control).usefulness);
  }
  return { computeH100e: monitorBudget(s).control * s.player.computeOnline, people: safeguardFte(s), slowdown: c > 0 ? lost / c : 0 };
}

export interface PackagePartLine {
  label: string;
  /** Increments of this part (after the earlier parts): internal compute (H100e), people (safety engineers), Slowdown
   *  (share of agent work); product revenue ($B/yr) and serving need (H100e). */
  computeH100e: number;
  people: number;
  slowdown: number;
  revenue: number;
  servingH100e: number;
}
export interface PackagePreview {
  id: SafeguardPackageId;
  label: string;
  meets: string;
  parts: PackagePartLine[];
  total: Omit<PackagePartLine, 'label'>;
  /** Believed stop rate per act at the site, before → after. */
  stops: { act: string; before: number; after: number }[];
}

const siteOf = (s: GameStateV2, d: Deployment): ActTarget | undefined => {
  if (!isInternal(d)) return { deploymentId: d.id };
  const u = AGENT_USES.find((x) => agentVersion(s, x)?.id === d.versionId && agentCompute(s, x) > 0);
  return u ? { use: u } : undefined;
};

/** Before → after of applying a package (pure: runs on copies). */
export function previewPackage(s: GameStateV2, d: Deployment, id: SafeguardPackageId): PackagePreview {
  const def = SAFEGUARD_PACKAGES[id];
  const parts: PackagePartLine[] = [];
  const zero = { computeH100e: 0, people: 0, slowdown: 0, revenue: 0, servingH100e: 0 };
  let cur: GameStateV2 = structuredClone(s);
  for (const st of steps(d, id)) {
    const next: GameStateV2 = structuredClone(cur);
    const nd = next.player.deployments.find((x) => x.id === d.id)!;
    st.run(next, nd);
    const line: PackagePartLine = { label: st.label, ...zero };
    if (isInternal(d)) {
      const a = internalCharges(cur), b = internalCharges(next);
      line.computeH100e = b.computeH100e - a.computeH100e;
      line.people = b.people - a.people;
      line.slowdown = b.slowdown - a.slowdown;
    } else {
      const pv = previewDeployments(cur, next.player.deployments, d.id);
      line.revenue = pv.totalAfter - pv.totalBefore;
      line.servingH100e = (pv.after?.needH100e ?? 0) - (pv.before?.needH100e ?? 0);
    }
    parts.push(line);
    cur = isInternal(d) ? next : hypothetical(cur, next.player.deployments);
  }
  const total = { ...zero };
  for (const l of parts) for (const k of Object.keys(zero) as (keyof typeof zero)[]) total[k] += l[k];
  const stops: PackagePreview['stops'] = [];
  const site = siteOf(s, d);
  if (site) {
    const t0 = actTable(s, site, true);
    const t1 = actTable(cur, site, true);
    for (const r of t0?.rows ?? []) {
      const r1 = t1?.rows.find((x) => x.id === r.id);
      if (r1) stops.push({ act: r.name, before: r.stopRate, after: r1.stopRate });
    }
  }
  return { id, label: def.label, meets: def.meets, parts, total, stops };
}
