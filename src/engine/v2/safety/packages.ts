// SR-20 / RF-S2 (SAFETY-REDESIGN §3.3 Defaults, §3.8; review safety #4, decision 9): ONE safeguard package, "Meet my
// framework", on one product or on the internal agent deployment in one act. Its parts are computed from your Safety
// framework (safety/framework.ts requiredSafeguards): the safeguards your triggered, not overridden rules ask of this
// deployment that it does not have yet. It only adds (a part you already run stays as it is):
//   products   misuse safeguards up to the level a rule asks (classifiers / hardened); control protocol and human review
//              when a deploy rule asks for them;
//   internal   control protocol and human review when a training rule asks for them (they are asked of every live
//              internal deployment).
// A control protocol it turns on uses the default setting (defer 10%, safeguards.ts setControl). The three fixed
// bundles (Standard / High / Critical) are gone: editing a rule changes the package.
// Nothing here is a new cost: the preview runs the engine's own charging functions on the deployment before and after
// each part (revenue and serving need of the product: worldfx/productView previewDeployments; internal: the control
// protocol's compute on the monitors' line, departments/agents.ts monitorBudget; the review staff, safety/investigations
// safeguardFte; the Slowdown on the agents' work, safety/oversight.ts useControl). Part lines are increments, applied
// in order, so they sum to the package's total. Stop rates are the act table's (believed), before → after.
// Parts stay editable after (product.update safeguards, the control / review / lockdown verbs).
import { AGENT_USES } from '../../../data/v2/agents';
import { SAFEGUARD_NEED_LABEL } from '../../../data/v2/framework';
import { agentCompute, agentVersion, monitorBudget, monitorVersion, syncInternalControl } from '../departments/agents';
import { hypothetical, previewDeployments } from '../worldfx/productView';
import { actTable, type ActTarget } from './actTable';
import { requiredSafeguards } from './framework';
import { safeguardFte } from './investigations';
import { useControl } from './oversight';
import { CONTROL_SETTINGS, addSafeguard, controlOn, reviewOn, setControl } from './safeguards';
import type { Deployment, GameStateV2 } from '../types';

export const PACKAGE_LABEL = 'Meet my framework';

const isInternal = (d: Deployment) => d.channel === 'internal';
const MISUSE_RANK: Record<Deployment['safeguards'], number> = { minimal: 0, standard: 1, classifiers: 2, hardened: 3 };

type Step = { label: string; run: (s: GameStateV2, d: Deployment) => void };
/** The package's parts as ordered steps: only what the framework asks of `d` and `d` lacks (each sets one part). */
function steps(s: GameStateV2, d: Deployment): Step[] {
  const need = requiredSafeguards(s, d);
  const out: Step[] = [];
  if (!isInternal(d)) {
    const want: Deployment['safeguards'] | undefined = need.has('hardened') ? 'hardened' : need.has('classifiers') ? 'classifiers' : undefined;
    if (want && MISUSE_RANK[want] > MISUSE_RANK[d.safeguards]) out.push({ label: `Misuse safeguards: ${want}`, run: (_s, x) => { x.safeguards = want; } });
  }
  if (need.has('review') && !reviewOn(d)) out.push({ label: 'Human review', run: (st, x) => { addSafeguard(st, x, 'review'); } });
  if (need.has('control') && !controlOn(d)) out.push({
    label: `Control protocol: ${CONTROL_SETTINGS.defer10.label}`,
    run: (st, x) => {
      setControl(x, true, 'defer10', st.time.day);
      if (!isInternal(x)) return;
      // The internal control item follows the packages running its model (RD-A06): set them, then sync.
      for (const u of AGENT_USES) if (agentVersion(st, u)?.id === x.versionId) st.player.agents[u].control = true;
      syncInternalControl(st);
    },
  });
  return out;
}

/** What the framework asks of `d`, in player language (the package's "meets" line). */
export function packageMeets(s: GameStateV2, d: Deployment): string {
  const need = [...requiredSafeguards(s, d)];
  return need.length ? `your Safety framework's rules for this deployment: ${need.map((g) => SAFEGUARD_NEED_LABEL[g]).join(', ')}` : 'nothing: no rule of your Safety framework is triggered here';
}

/** Why the package cannot be applied (undefined = it can); the preview and apply share it. */
export function packageBlock(s: GameStateV2, d: Deployment | undefined): string | undefined {
  if (!d) return 'Unknown deployment';
  if (d.status === 'withdrawn') return 'Deployment is withdrawn';
  if (d.channel === 'open') return 'Open weights carry no safeguards';
  if (!steps(s, d).length) return 'Already meets your Safety framework';
  return undefined;
}

/** Apply the package (adds the missing parts). */
export function applyPackage(s: GameStateV2, d: Deployment): string | undefined {
  const why = packageBlock(s, d);
  if (why) return why;
  for (const st of steps(s, d)) st.run(s, d);
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
    lost += h * (1 - useControl(s, agentVersion(s, u), monitorVersion(s, u), !!s.player.agents[u].control, true).usefulness);
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

/** Before → after of applying the package (pure: runs on copies). */
export function previewPackage(s: GameStateV2, d: Deployment): PackagePreview {
  const parts: PackagePartLine[] = [];
  const zero = { computeH100e: 0, people: 0, slowdown: 0, revenue: 0, servingH100e: 0 };
  let cur: GameStateV2 = structuredClone(s);
  for (const st of steps(s, d)) {
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
  return { label: PACKAGE_LABEL, meets: packageMeets(s, d), parts, total, stops };
}
