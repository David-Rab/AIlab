// Product verbs (STRUCTURE §1 R2 "Launch / update a product", R4 live edit; BUILD-PLAN R6). Owner: WS1.
//
// product.launch, product.update (model, mini free tier, monitor, price tier, safeguards, KYC, effort, features — the
// product stays live; the change applies at the next tick, D7, with a before → after preview), product.retire,
// product.serving (a hand-set share: turns the Auto serving policy off), feature.build (engineers' build queue + cash),
// feature.toggle, and the product policies (Auto serving, upgrade to newest, auto-evaluate).
import { FEATURE_BY_ID, PRICE_TIER_IDS, PRODUCT_DEFS, type FeatureId } from '../../../data/v2/features';
import { buildWaitNew, LAUNCH_TW, pendingLaunch, queueBuild } from '../departments/build';
import { bookCash } from '../finance/ledger';
import type { ActionDef, Channel, CostLine, Deployment, EngineSystem, GameStateV2, ModelVersion, PriceTier, SystemCtx } from '../types';
import { hypothetical, previewDeployments, type EditPreview } from '../worldfx/productView';
import { frontierGPerYear, PACE_WINDOW_DAYS } from './capability';
import { openAbsorbG, ownProgressDays, releaseRecG } from '../actors/rivals';
import { CHANNEL_VARIANTS, deployGate, distillationLeak, effortLock, releaseOpen, setServing, withdraw } from './deployments';
import { activeRivals, versionById } from './labs';
import { autoEvaluate, featureBuildBlock, featureToggleBlock, isProduct, launchFeatures, newestCleared, priceIndexOf } from './products';
import { relaunchAdaptations } from './adaptations';
import { evalPolicyView } from './evals';
import { autoCheapTiers, cheapTierPreview } from './cheapTier';

type Params = Record<string, number | string | boolean>;
const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);
const fail = (why: string | undefined) => {
  if (why) throw new Error(why);
};
const usable = (v: ModelVersion | undefined) => !!v && (v.status === 'ready' || v.status === 'deployed');
const round2 = (x: number) => Math.round(x * 100) / 100;

/** A live edit: unset fields stay; `null` removes the free-tier choice or the monitor. */
export interface ProductChanges {
  versionId?: string;
  /** RD-P01a: the lineup after the main model (version ids, in order; [] empties it). */
  lineup?: string[];
  /** RD-P01a: Chat's free-tier slot (a lineup model; null: the lineup's cheapest). */
  freeTierId?: string | null;
  monitorId?: string | null;
  price?: PriceTier;
  safeguards?: Deployment['safeguards'];
  kyc?: Deployment['kyc'];
  effort?: Deployment['effort'];
  features?: string[];
}

/** Changes from action params ('' or 'none' removes the free-tier choice / monitor; features and lineup as comma lists). */
export function changesFromParams(p: Params): ProductChanges {
  const c: ProductChanges = {};
  if (typeof p.versionId === 'string' && p.versionId) c.versionId = p.versionId;
  if (typeof p.lineup === 'string') c.lineup = p.lineup.split(',').map((x) => x.trim()).filter((x) => x && x !== 'none');
  if (typeof p.freeTierId === 'string') c.freeTierId = p.freeTierId && p.freeTierId !== 'none' ? p.freeTierId : null;
  if (typeof p.monitorId === 'string') c.monitorId = p.monitorId && p.monitorId !== 'none' ? p.monitorId : null;
  if (typeof p.price === 'string' && (PRICE_TIER_IDS as string[]).includes(p.price)) c.price = p.price as PriceTier;
  if (typeof p.safeguards === 'string') c.safeguards = p.safeguards as Deployment['safeguards'];
  if (typeof p.kyc === 'number') c.kyc = Math.max(0, Math.min(3, Math.round(p.kyc))) as Deployment['kyc'];
  if (typeof p.effort === 'string') c.effort = p.effort as Deployment['effort'];
  if (typeof p.features === 'string') c.features = p.features.split(',').map((x) => x.trim()).filter(Boolean);
  return c;
}

/** The product after an edit (a copy). RD-P06: effort is a plain setting (locked only by the model's capability, effortLock). */
export function editedProduct(d: Deployment, c: ProductChanges): Deployment {
  const n: Deployment = { ...d, features: [...(c.features ?? d.features)], adaptations: d.adaptations.map((x) => ({ ...x })), usagePolicy: { ...d.usagePolicy } };
  if (c.versionId) n.versionId = c.versionId;
  if (c.lineup !== undefined) {
    if (c.lineup.length) n.lineup = [...c.lineup];
    else delete n.lineup;
  }
  if (c.freeTierId !== undefined) {
    if (c.freeTierId) n.freeTierId = c.freeTierId;
    else delete n.freeTierId;
  }
  if (c.monitorId !== undefined) {
    if (c.monitorId) n.monitorId = c.monitorId;
    else delete n.monitorId;
  }
  if (c.price) {
    n.price = c.price;
    n.priceIndex = priceIndexOf(c.price);
  }
  if (c.safeguards) n.safeguards = c.safeguards;
  if (c.kyc !== undefined) n.kyc = c.kyc;
  if (c.effort) n.effort = c.effort;
  return n;
}

/** Why an edit is not allowed, or undefined. */
export function editBlock(s: GameStateV2, d: Deployment, c: ProductChanges): string | undefined {
  if (!isProduct(d) || d.status === 'withdrawn') return 'Not a live product';
  const n = editedProduct(d, c);
  if (c.versionId && c.versionId !== d.versionId) {
    const v = versionById(s, c.versionId);
    if (!v) return 'Unknown version';
    const g = deployGate(s, v, d.channel, { safeguards: n.safeguards, usagePolicy: n.usagePolicy });
    if (g !== true) return g;
  }
  if (c.safeguards && c.safeguards !== d.safeguards) {
    const v = versionById(s, n.versionId);
    if (v) {
      const g = deployGate(s, v, d.channel, { safeguards: n.safeguards, usagePolicy: n.usagePolicy });
      if (g !== true && g.startsWith('Blocked')) return g;
    }
  }
  if (c.lineup !== undefined) {
    const allowed = CHANNEL_VARIANTS[d.channel] ?? [];
    const seen = new Set<string>();
    for (const id of c.lineup) {
      if (id === n.versionId || seen.has(id)) return 'A model is in the lineup twice';
      seen.add(id);
      if ((d.lineup ?? []).includes(id)) continue;
      const m = versionById(s, id);
      if (!m) return 'Unknown version';
      if (!usable(m)) return `${m.name} is not ready`;
      if (s.player.safety.evalGate !== 'none' && m.evals.suiteDay === undefined) return `${m.name} is not evaluated yet`;
      if (!allowed.includes(m.variant) && !(m.variant === 'mini' && allowed.includes('full'))) return `${PRODUCT_DEFS[d.channel]?.name ?? d.channel} cannot sell a ${m.variant} model`;
    }
  }
  if (n.freeTierId && n.freeTierId !== d.freeTierId) {
    if (d.channel !== 'consumer') return `${PRODUCT_DEFS[d.channel]?.name ?? d.channel} has no free tier`;
    if (n.freeTierId !== n.versionId && !(n.lineup ?? []).includes(n.freeTierId)) return 'The free tier runs a model of the lineup';
  }
  if (n.monitorId && n.monitorId !== d.monitorId) {
    const m = versionById(s, n.monitorId);
    if (!usable(m)) return 'The monitor must be a ready model';
  }
  if (n.effort !== d.effort) {
    const lock = effortLock(s, n.effort);
    if (lock) return lock;
  }
  for (const f of n.features) if (!d.features.includes(f)) {
    const why = featureToggleBlock(s, d, f);
    if (why) return why;
  }
  return undefined;
}

/** Apply an edit to a live product (it stays live; daily systems see it from the next tick). */
export function applyEdit(s: GameStateV2, ctx: SystemCtx | undefined, d: Deployment, c: ProductChanges): string | undefined {
  const why = editBlock(s, d, c);
  if (why) return why;
  const n = editedProduct(d, c);
  const swapped = n.versionId !== d.versionId;
  Object.assign(d, n);
  if (!n.lineup?.length) delete d.lineup;
  if (!n.freeTierId) delete d.freeTierId;
  if (!n.monitorId) delete d.monitorId;
  if (swapped) {
    d.versionSince = s.time.day;
    const v = versionById(s, d.versionId);
    if (v && v.status !== 'deployed') v.status = 'deployed';
  }
  for (const id of [...(d.lineup ?? []), d.monitorId]) {
    const v = versionById(s, id);
    if (v && v.status === 'ready') v.status = 'deployed';
  }
  ctx?.log('company', `${PRODUCT_DEFS[d.channel]?.name ?? d.channel} updated (live).`, 1, d.id);
  return undefined;
}

/** Before → after of an edit (pure). */
export function previewEdit(s: GameStateV2, d: Deployment, c: ProductChanges): EditPreview {
  const n = editedProduct(d, c);
  return previewDeployments(s, s.player.deployments.map((x) => (x.id === d.id ? n : x)), d.id);
}

/** Upgrade policy (R6): each product moves to the newest cleared version of the same variant that measures better. */
export function upgradeProducts(s: GameStateV2, ctx: SystemCtx) {
  if (!s.player.policies.upgradeToNewest) return;
  for (const d of s.player.deployments) {
    if (!isProduct(d) || d.status !== 'live') continue;
    const v = newestCleared(s, d, (x) => deployGate(s, x, d.channel, { safeguards: d.safeguards, usagePolicy: d.usagePolicy }));
    if (v) applyEdit(s, ctx, d, { versionId: v.id });
  }
}

/** products (155, daily, after endings): the product policies at the close of the day, so tomorrow starts with them
 *  applied: auto-evaluate (refresh the internal model's and the stream's eval suites every 30 days; stamped with
 *  tomorrow's date, as a lab's morning eval run) and upgrade to the newest cleared model. */
export const productsSystem: EngineSystem = {
  id: 'products', owner: 'WS1', cadence: 'daily', order: 155, system: 'products',
  run(s, ctx) {
    if (s.player.status !== 'active') return;
    autoEvaluate(s);
    upgradeProducts(s, ctx);
    autoCheapTiers(s, ctx); // RD-P01b: after the upgrade policy, so a model it just deployed gets its cheap tier today
  },
};

const productOf = (s: GameStateV2, id: string) => s.player.deployments.find((d) => d.id === id && isProduct(d) && d.status !== 'withdrawn');
const firstProduct = (s: GameStateV2) => s.player.deployments.find((d) => isProduct(d) && d.status !== 'withdrawn');

/** Preview cost lines of a before → after (revenue, serving compute). */
function deltaLines(pv: EditPreview): { costs: CostLine[]; gains: CostLine[] } {
  const costs: CostLine[] = [];
  const gains: CostLine[] = [];
  const dRev = round2(pv.totalAfter - pv.totalBefore);
  if (dRev > 0) gains.push({ currency: 'revenue', amount: dRev });
  else if (dRev < 0) costs.push({ currency: 'revenue', amount: dRev });
  const dNeed = Math.round((pv.after?.needH100e ?? 0) - (pv.before?.needH100e ?? 0));
  if (dNeed > 0) costs.push({ currency: 'compute', amount: -dNeed, target: 'serving need (H100e)' });
  else if (dNeed < 0) gains.push({ currency: 'compute', amount: -dNeed, target: 'serving need (H100e)' });
  return { costs, gains };
}

/** RD-B20 / RD-X04: days of progress the strongest distiller gains at its next post-training from the player's live
 *  products (distillationLeak: rule B's lift ÷ the distiller's own frontier-G slope, RD-L03). */
export function distillDaysPerYear(s: GameStateV2): number {
  let days = 0;
  for (const lab of [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])]) {
    const dG = distillationLeak(s, lab.core.id).dG;
    if (dG > 0) days = Math.max(days, (dG / frontierGPerYear(s, lab.core.id, PACE_WINDOW_DAYS)) * 365);
  }
  return days;
}

/** The distillation line of a change to the products: the change in rivals' yearly catch-up (lead days). */
function distillLine(s: GameStateV2, deps: Deployment[]): CostLine[] {
  const d = Math.round(distillDaysPerYear(hypothetical(s, deps)) - distillDaysPerYear(s));
  if (d > 0) return [{ currency: 'leadDays', amount: -d, target: 'per year live: rivals distil it' }];
  if (d < 0) return [{ currency: 'leadDays', amount: -d, target: 'per year: less for rivals to distil' }];
  return [];
}

/** When a launch queued now would go live (the build queue wait). */
function launchWaitText(s: GameStateV2): string {
  const d = buildWaitNew(s, LAUNCH_TW, 'launch');
  return Number.isFinite(d) ? `${d} d` : 'never at today\'s engineering (upkeep takes it all)';
}

/** Default model for a launch on a channel: the newest usable version of an accepted variant. */
function launchVersion(s: GameStateV2, ch: Channel): ModelVersion | undefined {
  return [...s.player.models.versions].reverse().find((v) => usable(v) && CHANNEL_VARIANTS[ch].includes(v.variant));
}

export const PRODUCT_ACTIONS: ActionDef[] = [
  {
    id: 'product.launch', verb: 'launch', system: 'products', sphere: 'models', owner: 'WS1', title: 'Launch product',
    available: (s) => (s.player.models.versions.some(usable) ? true : 'No evaluated version'),
    preview: (s, p) => {
      const ch = str(p, 'channel', 'agents') as Channel;
      const v = versionById(s, str(p, 'versionId', '')) ?? launchVersion(s, ch);
      const costs: CostLine[] = [];
      const gains: CostLine[] = [];
      const exposure: CostLine[] = [];
      if (v && ch !== 'open' && ch !== 'internal') {
        const tmp: Deployment = {
          id: '__new', kind: 'product', versionId: v.id, channel: ch, startDay: s.time.day, price: 'standard', priceIndex: 1, effort: 'max', servingShare: 0,
          // RD-B12: the launch as it goes live (built features on for the channel, a relaunch's adaptations).
          safeguards: 'classifiers', guards: [], adaptations: relaunchAdaptations(s, ch).adaptations, features: launchFeatures(s, ch), kyc: ch === 'api' || ch === 'agents' ? 1 : 0, status: 'live',
          usagePolicy: { noDropInReplacement: false, noSurveillance: false, noAutonomousWeapons: false, minorsProtections: false },
        };
        const pv = previewDeployments(s, [...s.player.deployments, tmp], tmp.id);
        const dl = deltaLines(pv);
        costs.push(...dl.costs);
        gains.push(...dl.gains);
        costs.push(...distillLine(s, [...s.player.deployments, tmp]));
      }
      // J2 P1: engineers build the launch first (team-weeks on the build queue); the product goes live when it is built.
      if (ch !== 'open' && ch !== 'internal') costs.push({ currency: 'staffTime', amount: -LAUNCH_TW, target: `engineer team-weeks · live in ${launchWaitText(s)}` });
      if (!costs.length) costs.push({ currency: 'compute', amount: 0, target: 'serving pool' });
      return { costs, gains, exposure };
    },
    apply: (s, ctx, p) => {
      const ch = str(p, 'channel', 'api') as Channel;
      if (ch === 'internal') return fail('Internal use is set on Company (internal agents)');
      if (ch === 'open') return fail('Open weights are a release act on a model: Models › Release open weights');
      const v = versionById(s, str(p, 'versionId', '')) ?? launchVersion(s, ch);
      if (!v) return fail('No version for this product');
      if (s.player.deployments.some((d) => d.channel === ch && d.status !== 'withdrawn')) return fail(`${PRODUCT_DEFS[ch]?.name ?? ch} is already live: update it instead`);
      if (pendingLaunch(s, ch)) return fail(`${PRODUCT_DEFS[ch]?.name ?? ch} is already being built`);
      const price = (PRICE_TIER_IDS as string[]).includes(str(p, 'price', '')) ? (str(p, 'price', 'standard') as PriceTier) : 'standard';
      {
        // J2 P1: the engineers build a product launch first (gates checked now and again at release).
        const gate = deployGate(s, v, ch, { safeguards: 'classifiers', usagePolicy: { noDropInReplacement: false, noSurveillance: false, noAutonomousWeapons: false, minorsProtections: ch === 'consumer' } });
        if (gate !== true) return fail(gate);
        const effort = typeof p.effort === 'string' ? (p.effort as Deployment['effort']) : undefined;
        const lock = effortLock(s, effort ?? 'max');
        if (lock) return fail(lock);
        const wait = launchWaitText(s);
        queueBuild(s, 'launch', ch, LAUNCH_TW, {
          launch: {
            channel: ch, versionId: v.id, price,
            ...(typeof p.kyc === 'number' ? { kyc: Math.max(0, Math.min(3, Math.round(p.kyc))) as Deployment['kyc'] } : {}),
            ...(effort ? { effort } : {}),
            ...(typeof p.monitorId === 'string' && p.monitorId ? { monitorId: p.monitorId } : {}),
          },
        });
        ctx.log('company', `Engineers start building the ${PRODUCT_DEFS[ch]?.name ?? ch} launch (live in ${wait}).`, 1);
      }
    },
  },
  {
    // RD-P05 (DD-02 a): open weights are a release act on a model (deployments.ts releaseOpen), not a variant copy.
    // The preview lists what follows from the release: China's absorbed recipe gap (security.ts → openWeightsReleased,
    // only above the open frontier), rivals distilling it at full access (their lift at the next post-training) and the
    // one-way release itself (misuse safeguards reduce to the hazard filter: incidents.ts).
    id: 'releaseOpen', verb: 'launch', system: 'products', sphere: 'models', owner: 'WS1', title: 'Release open weights',
    available: () => true,
    preview: (s, p) => {
      const v = versionById(s, str(p, 'versionId', ''));
      const costs: CostLine[] = [];
      if (!v) return { costs, gains: [], exposure: [] };
      if (v.G > s.knowledge.openWeightsG) {
        const days = Math.round(ownProgressDays(s, s.china.lab.core.id, openAbsorbG(s, v.recG ?? releaseRecG(s, 'player', v.G))));
        if (days > 0) costs.push({ currency: 'leadDays', amount: -days, target: `days of China's own progress: it absorbs the weights` });
      }
      const tmp: Deployment = {
        id: '__open', kind: 'product', versionId: v.id, channel: 'open', startDay: s.time.day, price: 'standard', priceIndex: 1, effort: 'max', servingShare: 0,
        safeguards: 'classifiers', guards: [], adaptations: [], features: [], kyc: 0, status: 'live',
        usagePolicy: { noDropInReplacement: false, noSurveillance: false, noAutonomousWeapons: false, minorsProtections: false },
      };
      // Rivals' lift at their next post-training (distillationLeak with the open deployment), in OOM: the per-year days
      // of distillLine divide by a lab's recent pace, which is ~0 early in a game.
      const h = hypothetical(s, [...s.player.deployments, tmp]);
      const lift = Math.max(0, ...[...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])].map((l) => distillationLeak(h, l.core.id).dG - distillationLeak(s, l.core.id).dG));
      if (lift > 0) costs.push({ currency: 'progress', amount: -Math.round(lift * 1000) / 1000, unit: 'OOM', target: 'effective compute the best-placed rival takes at its next post-training: it distils the weights' });
      costs.push({ currency: 'progress', amount: 1, unit: 'release', target: `${v.name}'s weights are public for good: anyone runs and fine-tunes them; misuse safeguards reduce to the hazard filter` });
      return { costs, gains: [], exposure: [] };
    },
    apply: (s, ctx, p) => {
      const r = releaseOpen(s, ctx, str(p, 'versionId', ''));
      if (typeof r === 'string') fail(r);
    },
  },
  {
    id: 'product.update', verb: 'launch', system: 'products', sphere: 'models', owner: 'WS1', title: 'Update product',
    available: (s) => (firstProduct(s) ? true : 'No live product'),
    preview: (s, p) => {
      const d = productOf(s, str(p, 'id', '')) ?? firstProduct(s);
      const costs: CostLine[] = [];
      const gains: CostLine[] = [];
      if (d) {
        const c = changesFromParams(p);
        if (Object.keys(c).length && !editBlock(s, d, c)) {
          const dl = deltaLines(previewEdit(s, d, c));
          costs.push(...dl.costs);
          gains.push(...dl.gains);
          const n = editedProduct(d, c);
          for (const l of distillLine(s, s.player.deployments.map((x) => (x.id === d.id ? n : x)))) (l.amount < 0 ? costs : gains).push(l);
        }
      }
      return { costs, gains, exposure: [] };
    },
    apply: (s, ctx, p) => {
      const d = productOf(s, str(p, 'id', ''));
      if (!d) return fail('Unknown product');
      fail(applyEdit(s, ctx, d, changesFromParams(p)));
    },
  },
  {
    id: 'product.retire', verb: 'launch', system: 'products', sphere: 'models', owner: 'WS1', title: 'Retire product',
    available: (s) => (firstProduct(s) ? true : 'No live product'),
    preview: (s, p) => {
      // RD-B20: the market run without the product (its serving goes to the other products; its adaptations end).
      const d = productOf(s, str(p, 'id', '')) ?? firstProduct(s);
      if (!d) return { costs: [], gains: [], exposure: [] };
      const deps = s.player.deployments.map((x) => (x.id === d.id ? { ...x, status: 'withdrawn' as const } : x));
      const dl = deltaLines(previewDeployments(s, deps, d.id));
      const costs = [...dl.costs];
      const gains = [...dl.gains];
      for (const l of distillLine(s, deps)) (l.amount < 0 ? costs : gains).push(l);
      return { costs, gains, exposure: [] };
    },
    apply: (s, ctx, p) => {
      const d = productOf(s, str(p, 'id', ''));
      if (!d) return fail('Unknown product');
      fail(withdraw(s, d.id));
      ctx.log('company', `${PRODUCT_DEFS[d.channel]?.name ?? d.channel} retired.`, 1, d.id);
    },
  },
  {
    // Manual serving share for one product: switches the Auto policy off (the override).
    id: 'product.serving', verb: 'policy', system: 'products', sphere: 'models', owner: 'WS1', title: 'Serving share',
    available: (s) => (firstProduct(s) ? true : 'No live product'),
    preview: (s, p) => {
      const d = productOf(s, str(p, 'id', '')) ?? firstProduct(s);
      const share = typeof p.share === 'number' ? p.share : d?.servingShare ?? 0.2;
      if (!d) return { costs: [{ currency: 'compute', amount: 0 }], gains: [], exposure: [] };
      const n = { ...d, servingShare: Math.max(0, Math.min(1, share)) };
      const pv = previewDeployments(s, s.player.deployments.map((x) => (x.id === d.id ? n : x)), d.id, { policies: { servingAuto: false } });
      const dl = deltaLines(pv);
      return { costs: dl.costs, gains: dl.gains, exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const d = productOf(s, str(p, 'id', ''));
      if (!d) return fail('Unknown product');
      s.player.policies.servingAuto = false;
      fail(setServing(s, d.id, typeof p.share === 'number' ? p.share : d.servingShare));
    },
  },
  {
    id: 'feature.build', verb: 'launch', system: 'products', sphere: 'models', owner: 'WS1', title: 'Build feature',
    available: () => true,
    preview: (s, p) => {
      const f = FEATURE_BY_ID[str(p, 'id', 'memory') as FeatureId];
      const costs: CostLine[] = [{ currency: 'cash', amount: -(f?.cash ?? 0) }, { currency: 'staffTime', amount: -(f?.buildTW ?? 0), target: 'engineer team-weeks' }];
      const gains: CostLine[] = [];
      if (f && !s.player.features.includes(f.id)) {
        // Expected return: every product that offers it, with it on.
        const deps = s.player.deployments.map((d) => (isProduct(d) && d.status !== 'withdrawn' && f.products.includes(d.channel) ? { ...d, features: [...d.features, f.id] } : d));
        const anyId = deps.find((d) => isProduct(d) && f.products.includes(d.channel))?.id;
        if (anyId) {
          const pv = previewDeployments(s, deps, anyId, { features: [...s.player.features, f.id] });
          const dRev = round2(pv.totalAfter - pv.totalBefore);
          if (dRev > 0) gains.push({ currency: 'revenue', amount: dRev, target: `with ${f.name} on everywhere` });
          else if (dRev < 0) costs.push({ currency: 'revenue', amount: dRev, target: `with ${f.name} on everywhere` });
        }
      }
      return { costs, gains, exposure: [] };
    },
    apply: (s, ctx, p) => {
      const id = str(p, 'id', '');
      fail(featureBuildBlock(s, id));
      const f = FEATURE_BY_ID[id as FeatureId];
      queueBuild(s, 'feature', id, f.buildTW);
      if (f.cash > 0) bookCash(s, ctx, -f.cash, 'opex', 'feature build', f.name);
      ctx.log('company', `Engineers start building ${f.name}.`, 1, id);
    },
  },
  {
    id: 'feature.toggle', verb: 'launch', system: 'products', sphere: 'models', owner: 'WS1', title: 'Feature on/off',
    available: (s) => (firstProduct(s) ? true : 'No live product'),
    preview: (s, p) => {
      const d = productOf(s, str(p, 'product', '')) ?? firstProduct(s);
      const id = str(p, 'feature', '');
      const costs: CostLine[] = [];
      const gains: CostLine[] = [];
      if (d && id) {
        const on = p.on !== false;
        const feats = on ? [...new Set([...d.features, id])] : d.features.filter((x) => x !== id);
        if (!editBlock(s, d, { features: feats })) {
          const dl = deltaLines(previewEdit(s, d, { features: feats }));
          costs.push(...dl.costs);
          gains.push(...dl.gains);
        }
      }
      return { costs, gains, exposure: [] };
    },
    apply: (s, ctx, p) => {
      const d = productOf(s, str(p, 'product', ''));
      if (!d) return fail('Unknown product');
      const id = str(p, 'feature', '');
      const on = p.on !== false;
      const feats = on ? [...new Set([...d.features, id])] : d.features.filter((x) => x !== id);
      fail(applyEdit(s, ctx, d, { features: feats }));
    },
  },
  {
    // Product policies: Auto serving split, upgrade to the newest cleared model, auto-evaluate.
    id: 'products.policy', verb: 'policy', system: 'products', sphere: 'models', owner: 'WS1', title: 'Product policy',
    available: () => true,
    preview: (s, p) => {
      const costs: CostLine[] = [];
      const gains: CostLine[] = [];
      const exposure: CostLine[] = [];
      if (typeof p.servingAuto === 'boolean' && p.servingAuto !== s.player.policies.servingAuto) {
        const d = firstProduct(s);
        if (d) {
          const pv = previewDeployments(s, s.player.deployments, d.id, { policies: { servingAuto: p.servingAuto } });
          const dRev = round2(pv.totalAfter - pv.totalBefore);
          if (dRev > 0) gains.push({ currency: 'revenue', amount: dRev });
          else if (dRev < 0) costs.push({ currency: 'revenue', amount: dRev });
        }
      }
      // Model v3 D7: what a re-run costs (one suite at the policy depth on the internal model; models/evals.ts).
      if (p.autoEvaluate === true) {
        const pv = evalPolicyView(s);
        if (pv.perSuite) {
          costs.push({ currency: 'staffTime', amount: Math.round(pv.perSuite.reTW * 100) / 100, target: `research-engineer team-weeks per ${pv.depth} re-run (changed ≥ ${pv.reevalDG} OOM or every ${pv.reevalDays} days)` });
          costs.push({ currency: 'compute', amount: Math.round(pv.perSuite.h100eDays), target: 'H100e-days per re-run, from experiments' });
        }
      }
      // RD-P01b: the distillation runs turning "Auto-make cheap tiers" on starts today (real FLOP, pool share, time).
      if (p.autoCheapTier === true && !s.player.policies.autoCheapTier) costs.push(...cheapTierPreview(s));
      return { costs, gains, exposure };
    },
    apply: (s, ctx, p) => {
      const pol = s.player.policies;
      for (const k of ['servingAuto', 'upgradeToNewest', 'autoEvaluate', 'autoCheapTier'] as const) if (typeof p[k] === 'boolean') pol[k] = p[k] as boolean;
      ctx.log('company', 'Product policies updated.', 1);
    },
  },
];
