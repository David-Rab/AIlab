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
import { PRODUCT_DEFS } from '../../../data/v2/features';
import { SAFEGUARD_NEED_LABEL } from '../../../data/v2/framework';
import { agentCompute, agentVersion, monitorBudget, monitorVersion, syncInternalControl } from '../departments/agents';
import { hypothetical, previewDeployments } from '../worldfx/productView';
import { actTable, type ActTarget } from './actTable';
import { refreshFramework, requiredSafeguards, type FrameworkCandidate } from './framework';
import { safeguardFte } from './investigations';
import { useControl } from './oversight';
import { CONTROL_SETTINGS, addSafeguard, controlOn, reviewOn, setControl } from './safeguards';
import type { Channel, Deployment, EngineSystem, FrameworkRule, GameStateV2, ModelVersion, SystemCtx } from '../types';

export const PACKAGE_LABEL = 'Framework safeguards';

const isInternal = (d: Deployment) => d.channel === 'internal';
const MISUSE_RANK: Record<Deployment['safeguards'], number> = { minimal: 0, standard: 1, classifiers: 2, hardened: 3 };

type Need = FrameworkRule['safeguards'][number];
type Step = { label: string; need: Need; run: (s: GameStateV2, d: Deployment) => void };
/** The package's parts as ordered steps: only what the framework asks of `d` and `d` lacks (each sets one part). */
function steps(s: GameStateV2, d: Deployment): Step[] {
  const need = requiredSafeguards(s, d);
  const out: Step[] = [];
  if (!isInternal(d)) {
    const want: 'classifiers' | 'hardened' | undefined = need.has('hardened') ? 'hardened' : need.has('classifiers') ? 'classifiers' : undefined;
    if (want && MISUSE_RANK[want] > MISUSE_RANK[d.safeguards]) out.push({ label: `Misuse safeguards: ${want}`, need: want, run: (_s, x) => { x.safeguards = want; } });
  }
  if (need.has('review') && !reviewOn(d)) out.push({ label: 'Human review', need: 'review', run: (st, x) => { addSafeguard(st, x, 'review'); } });
  if (need.has('control') && !controlOn(d)) out.push({
    label: `Control protocol: ${CONTROL_SETTINGS.defer10.label}`,
    need: 'control',
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

/** RF-S13 (DECISIONS, follow-ups to the review fixes): the framework applies its package itself. On every live
 *  deployment a triggered rule asks safeguards of, the parts it lacks are added, once per version and safeguard (the
 *  record `Deployment.frameworkApplied`): the player can still change them, and a part removed afterwards is not put
 *  back (the rule then holds, or the player overrides it). Its costs are the engine's own charges for those parts (the
 *  package preview's totals, stated in the log). Returns the deployments it changed. */
export function autoApplyPackages(s: GameStateV2, ctx?: SystemCtx): Deployment[] {
  return s.player.deployments.filter((d) => d.status === 'live' && applyFrameworkParts(s, d, ctx));
}

/** The package's parts the framework still adds to `d` (not yet applied for this version). */
const pendingParts = (s: GameStateV2, d: Deployment) => {
  const done = new Set(d.frameworkApplied ?? []);
  return steps(s, d).filter((st) => !done.has(`${d.versionId}:${st.need}`));
};

/** One deployment of autoApplyPackages (also a launch or swap as it goes live, RF-S13b): add the pending parts, record
 *  them, log what they cost. True when it changed something. */
export function applyFrameworkParts(s: GameStateV2, d: Deployment, ctx?: SystemCtx): boolean {
  if (d.status !== 'live' || d.channel === 'open' || d.channel === 'vetted') return false; // MK-2: Trusted's exemption on Vetted
  const todo = pendingParts(s, d);
  if (!todo.length) return false;
  const t = ctx && todo.length === steps(s, d).length ? previewPackage(s, d).total : undefined;
  const done = new Set(d.frameworkApplied ?? []);
  for (const st of todo) { st.run(s, d); done.add(`${d.versionId}:${st.need}`); }
  d.frameworkApplied = [...done];
  if (!ctx) return true;
  const cost = t ? [
    t.computeH100e > 1e-6 ? `${Math.round(t.computeH100e * 10) / 10} H100e control compute` : '',
    t.people > 1e-6 ? `${Math.round(t.people)} safety engineers reviewing` : '',
    t.slowdown > 1e-6 ? `slowdown ${Math.round(t.slowdown * 1000) / 10}% of AI staff work` : '',
    Math.abs(t.revenue) > 1e-4 ? `revenue ${t.revenue > 0 ? '+' : '−'}$${Math.abs(Math.round(t.revenue * 100) / 100)}B/yr` : '',
    t.servingH100e > 0.5 ? `serving need +${Math.round(t.servingH100e)} H100e` : '',
  ].filter(Boolean) : [];
  ctx.log('company', `Your Safety framework applied "${PACKAGE_LABEL}" to ${isInternal(d) ? 'AI staff' : PRODUCT_DEFS[d.channel]?.name ?? 'a product'}: ${todo.map((x) => x.label).join(', ')}${cost.length ? ` (${cost.join(', ')})` : ''}. You can change it; a part you remove is not put back, and the rule then holds.`, 1, d.versionId);
  return true;
}

/** RF-S13c: an edited product `n` (a copy, models/productOps editedProduct; main model and lineup) with the parts the
 *  framework will add when the edit goes live (applyEdit / cheap tier → applyFrameworkParts). Mutates only `n`;
 *  returns the parts' labels. The edit's gate and preview read this copy. */
export function withFrameworkParts(s: GameStateV2, n: Deployment): string[] {
  if (n.channel === 'open' || n.channel === 'internal' || n.channel === 'vetted') return []; // MK-2: Trusted's exemption on Vetted
  n.guards = (n.guards ?? []).map((g) => ({ ...g }));
  const todo = pendingParts(s, n);
  for (const st of todo) st.run(s, n);
  return todo.map((st) => st.label);
}

/** RF-S13b: a launch / swap candidate of `v` on a product channel with the parts the framework will add when it goes
 *  live (applyFrameworkParts; `record` = the deployment's frameworkApplied on a swap). Pure: works on a copy. The gate
 *  (models/deployments.ts deployGate) judges this candidate, so a deploy rule refuses only what the package cannot meet;
 *  the launch preview prices it. */
export function frameworkCandidate(s: GameStateV2, v: ModelVersion, channel: Channel, cand: FrameworkCandidate, record?: string[]): FrameworkCandidate & { parts: string[] } {
  if (channel === 'open' || channel === 'internal' || channel === 'vetted') return { ...cand, parts: [] }; // MK-2: Trusted's exemption on Vetted
  const d = { id: '__candidate', channel, versionId: v.id, status: 'live', safeguards: cand.safeguards, guards: (cand.guards ?? []).map((g) => ({ ...g })), frameworkApplied: record } as unknown as Deployment;
  const todo = pendingParts(s, d);
  for (const st of todo) st.run(s, d);
  return { safeguards: d.safeguards, guards: d.guards, parts: todo.map((st) => st.label) };
}

/** frameworkSystem (39, daily, before runs): the framework applies its package where a rule asks (RF-S13), then the
 *  holds are refreshed: what is still held is what the package cannot meet (evidence: an eval suite, an external
 *  evaluation) or a part the player removed. */
export const frameworkSystem: EngineSystem = {
  id: 'safetyFramework', owner: 'WS2', cadence: 'daily', order: 39, system: 'safety',
  run(s: GameStateV2, ctx: SystemCtx) {
    if (s.player.status !== 'active') return;
    autoApplyPackages(s, ctx);
    refreshFramework(s, ctx);
  },
};
