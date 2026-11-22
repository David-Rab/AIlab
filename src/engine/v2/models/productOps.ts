// Product verbs (STRUCTURE §1 R2 "Launch / update a product", R4 live edit; BUILD-PLAN R6). Owner: WS1.
//
// product.launch, product.update (model, mini free tier, monitor, price tier, safeguards, KYC, effort, features — the
// product stays live; the change applies at the next tick, D7, with a before → after preview), product.retire,
// product.serving (a hand-set share: turns the Auto serving policy off), feature.build (engineers' build queue + cash),
// feature.toggle, and the product policies (Auto serving, upgrade to newest, auto-evaluate).
import { FEATURE_BY_ID, MINI_CHANNELS, PRICE_TIERS, PRICE_TIER_IDS, PRODUCT_DEFS, type FeatureId } from '../../../data/v2/features';
import { buildWaitNew, LAUNCH_TW, pendingLaunch, queueBuild } from '../departments/build';
import { bookCash } from '../finance/ledger';
import type { ActionDef, Channel, CostLine, Deployment, EngineSystem, GameStateV2, ModelVersion, PriceTier, SystemCtx } from '../types';
import { previewDeployments, type EditPreview } from '../worldfx/productView';
import { spareServing } from '../worldfx/revenue';
import { CHANNEL_VARIANTS, deploy, deployGate, effortLock, setServing, withdraw } from './deployments';
import { versionById } from './labs';
import { autoEvaluate, featureBuildBlock, featureToggleBlock, isProduct, launchEffortBlock, launchFeatures, newestCleared, priceIndexOf, relaunchPacks } from './products';
import { evalPolicyView } from './evals';

type Params = Record<string, number | string | boolean>;
const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);
const fail = (why: string | undefined) => {
  if (why) throw new Error(why);
};
const usable = (v: ModelVersion | undefined) => !!v && (v.status === 'ready' || v.status === 'deployed');
const round2 = (x: number) => Math.round(x * 100) / 100;

/** A live edit: unset fields stay; `null` removes the mini free tier or the monitor. */
export interface ProductChanges {
  versionId?: string;
  miniVersionId?: string | null;
  monitorId?: string | null;
  price?: PriceTier;
  safeguards?: Deployment['safeguards'];
  kyc?: Deployment['kyc'];
  effort?: Deployment['effort'];
  features?: string[];
}

/** Changes from action params ('' or 'none' removes the mini / monitor; features as a comma list). */
export function changesFromParams(p: Params): ProductChanges {
  const c: ProductChanges = {};
  if (typeof p.versionId === 'string' && p.versionId) c.versionId = p.versionId;
  if (typeof p.miniVersionId === 'string') c.miniVersionId = p.miniVersionId && p.miniVersionId !== 'none' ? p.miniVersionId : null;
  if (typeof p.monitorId === 'string') c.monitorId = p.monitorId && p.monitorId !== 'none' ? p.monitorId : null;
  if (typeof p.price === 'string' && (PRICE_TIER_IDS as string[]).includes(p.price)) c.price = p.price as PriceTier;
  if (typeof p.safeguards === 'string') c.safeguards = p.safeguards as Deployment['safeguards'];
  if (typeof p.kyc === 'number') c.kyc = Math.max(0, Math.min(3, Math.round(p.kyc))) as Deployment['kyc'];
  if (typeof p.effort === 'string') c.effort = p.effort as Deployment['effort'];
  if (typeof p.features === 'string') c.features = p.features.split(',').map((x) => x.trim()).filter(Boolean);
  return c;
}

/** The product after an edit (a copy; deep think and the effort setting kept consistent). */
export function editedProduct(d: Deployment, c: ProductChanges): Deployment {
  const n: Deployment = { ...d, features: [...(c.features ?? d.features)], packs: d.packs.map((x) => ({ ...x })), usagePolicy: { ...d.usagePolicy } };
  if (c.versionId) n.versionId = c.versionId;
  if (c.miniVersionId !== undefined) {
    if (c.miniVersionId) n.miniVersionId = c.miniVersionId;
    else delete n.miniVersionId;
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
  // Deep think is a feature: effort 'deep' ⇔ the feature on.
  if (c.effort) {
    n.effort = c.effort;
    if (c.effort === 'deep' && !n.features.includes('deepThink')) n.features.push('deepThink');
    if (c.effort !== 'deep') n.features = n.features.filter((f) => f !== 'deepThink');
  } else if (c.features) {
    if (n.features.includes('deepThink')) n.effort = 'deep';
    else if (n.effort === 'deep') n.effort = 'max';
  }
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
  if (n.miniVersionId && n.miniVersionId !== d.miniVersionId) {
    if (!MINI_CHANNELS.includes(d.channel)) return `${PRODUCT_DEFS[d.channel]?.name ?? d.channel} has no free tier`;
    const m = versionById(s, n.miniVersionId);
    if (!m || m.variant !== 'mini') return 'The free tier runs a mini (distilled) model';
    if (!usable(m)) return 'That mini is not ready';
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
  if (!n.miniVersionId) delete d.miniVersionId;
  if (!n.monitorId) delete d.monitorId;
  if (swapped) {
    d.versionSince = s.time.day;
    const v = versionById(s, d.versionId);
    if (v && v.status !== 'deployed') v.status = 'deployed';
  }
  for (const id of [d.miniVersionId, d.monitorId]) {
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
      if (ch === 'open') costs.push({ currency: 'leadDays', amount: -60, target: 'rivals and China absorb the weights' });
      if (v && ch !== 'open' && ch !== 'internal') {
        const tmp: Deployment = {
          id: '__new', kind: 'product', versionId: v.id, channel: ch, startDay: s.time.day, price: 'standard', priceIndex: 1, effort: 'max', servingShare: 0,
          // RD-B12: the launch as it goes live (built features on for the channel, a relaunch's packs).
          safeguards: 'classifiers', controlLayer: false, packs: relaunchPacks(s, ch).packs, features: launchFeatures(s, ch, 'max'), kyc: ch === 'api' || ch === 'agents' ? 1 : 0, status: 'live',
          usagePolicy: { noDropInReplacement: false, noSurveillance: false, noAutonomousWeapons: false, minorsProtections: false },
        };
        const pv = previewDeployments(s, [...s.player.deployments, tmp], tmp.id);
        const dl = deltaLines(pv);
        costs.push(...dl.costs);
        gains.push(...dl.gains);
      }
      // J2 P1: engineers build the launch first (team-weeks on the build queue); the product goes live when it is built.
      if (ch !== 'open' && ch !== 'internal') costs.push({ currency: 'staffTime', amount: -LAUNCH_TW, target: `engineer team-weeks · live in ${launchWaitText(s)}` });
      if (ch === 'api' || ch === 'agents' || ch === 'consumer') exposure.push({ currency: 'leadDays', amount: -10, lagDays: 30, probability: 0.6 });
      exposure.push({ currency: 'approval', amount: -2, probability: 0.2, lagDays: 60 });
      if (!costs.length) costs.push({ currency: 'compute', amount: 0, target: 'serving pool' });
      return { costs, gains: ch === 'open' ? [{ currency: 'trust', amount: 3, target: 'academia' }] : gains, exposure };
    },
    apply: (s, ctx, p) => {
      const ch = str(p, 'channel', 'api') as Channel;
      if (ch === 'internal') return fail('Internal use is set on Company (internal agents)');
      const v = versionById(s, str(p, 'versionId', '')) ?? launchVersion(s, ch);
      if (!v) return fail('No version for this product');
      if (s.player.deployments.some((d) => d.channel === ch && d.status !== 'withdrawn' && ch !== 'open')) return fail(`${PRODUCT_DEFS[ch]?.name ?? ch} is already live: update it instead`);
      if (pendingLaunch(s, ch)) return fail(`${PRODUCT_DEFS[ch]?.name ?? ch} is already being built`);
      const price = (PRICE_TIER_IDS as string[]).includes(str(p, 'price', '')) ? (str(p, 'price', 'standard') as PriceTier) : 'standard';
      if (ch !== 'open') {
        // J2 P1: the engineers build a product launch first (gates checked now and again at release).
        const gate = deployGate(s, v, ch, { safeguards: 'classifiers', usagePolicy: { noDropInReplacement: false, noSurveillance: false, noAutonomousWeapons: false, minorsProtections: ch === 'consumer' } });
        if (gate !== true) return fail(gate);
        const effort = typeof p.effort === 'string' ? (p.effort as Deployment['effort']) : undefined;
        const lock = effortLock(s, effort ?? 'max') ?? launchEffortBlock(s, ch, effort);
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
        return;
      }
      const r = deploy(s, ctx, {
        versionId: v.id, channel: ch, price, priceIndex: PRICE_TIERS[price],
        ...(typeof p.kyc === 'number' ? { kyc: Math.max(0, Math.min(3, Math.round(p.kyc))) as Deployment['kyc'] } : {}),
        ...(typeof p.effort === 'string' ? { effort: p.effort as Deployment['effort'] } : {}),
        ...(typeof p.monitorId === 'string' && p.monitorId ? { monitorId: p.monitorId } : {}),
      });
      if (typeof r === 'string') fail(r);
    },
  },
  {
    id: 'product.update', verb: 'launch', system: 'products', sphere: 'models', owner: 'WS1', title: 'Update product',
    available: (s) => (firstProduct(s) ? true : 'No live product'),
    preview: (s, p) => {
      const d = productOf(s, str(p, 'id', '')) ?? firstProduct(s);
      const costs: CostLine[] = [{ currency: 'staffTime', amount: -2, target: 'product team' }];
      const gains: CostLine[] = [];
      const exposure: CostLine[] = [];
      if (d) {
        const c = changesFromParams(p);
        if (Object.keys(c).length && !editBlock(s, d, c)) {
          const dl = deltaLines(previewEdit(s, d, c));
          costs.push(...dl.costs);
          gains.push(...dl.gains);
          if (c.versionId && (d.channel === 'api' || d.channel === 'consumer')) exposure.push({ currency: 'leadDays', amount: -5, lagDays: 30, probability: 0.5 });
        }
      }
      return { costs, gains, exposure };
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
      const d = productOf(s, str(p, 'id', '')) ?? firstProduct(s);
      return {
        costs: [{ currency: 'revenue', amount: -round2(d?.revenueRate ?? 1) }],
        gains: [{ currency: 'compute', amount: Math.round(d?.servedH100e ?? 0), target: 'serving pool (H100e)' }],
        exposure: [{ currency: 'trust', amount: -1, probability: 0.3 }],
      };
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
      return { costs: [...dl.costs, { currency: 'staffTime', amount: -1, target: 'Auto serving off' }], gains: dl.gains, exposure: [] };
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
        const deps = s.player.deployments.map((d) => (isProduct(d) && d.status !== 'withdrawn' && f.products.includes(d.channel) ? { ...d, features: [...d.features, f.id], effort: f.effortDeep ? 'deep' as const : d.effort } : d));
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
      const costs: CostLine[] = [{ currency: 'staffTime', amount: -1, target: 'product team' }];
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
    // J2 PR1: where serving compute no product needs goes (research agents by default; or headroom on the products).
    id: 'serving.spare', verb: 'policy', system: 'products', sphere: 'models', owner: 'WS1', title: 'Spare serving compute',
    available: () => true,
    preview: (s, p) => {
      const use = str(p, 'use', s.player.policies.spareServing === 'headroom' ? 'research' : 'headroom');
      const spare = Math.round(spareServing(s));
      const agents = Math.max(1, s.player.computeOnline * s.player.split.agents);
      const el = s.player.prodCache?.elast.agents ?? 0.3;
      const research = { currency: 'progress' as const, amount: Math.round(el * Math.log1p(spare / agents) * 1e4) / 100, unit: '%', target: 'research speed' };
      const headroom = { currency: 'compute' as const, amount: spare, target: 'serving headroom (eroded share recovers 2× faster)' };
      return use === 'headroom' ? { costs: [research], gains: [headroom], exposure: [] } : { costs: [headroom], gains: [research], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const use = str(p, 'use', '');
      if (use !== 'research' && use !== 'headroom') return fail('Use research or headroom');
      s.player.policies.spareServing = use;
    },
  },
  {
    // Product policies: Auto serving split, upgrade to the newest cleared model, auto-evaluate.
    id: 'products.policy', verb: 'policy', system: 'products', sphere: 'models', owner: 'WS1', title: 'Product policy',
    available: () => true,
    preview: (s, p) => {
      const costs: CostLine[] = [{ currency: 'staffTime', amount: -1 }];
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
      if (p.upgradeToNewest === true) exposure.push({ currency: 'leadDays', amount: -5, lagDays: 30, probability: 0.5, target: 'newer models leak to distillers' });
      if (p.autoEvaluate === false) exposure.push({ currency: 'monitorability', amount: -0.05, target: 'stale trait estimates on the internal model' });
      // Model v3 D7: what a re-run costs (one suite at the policy depth on the internal model; models/evals.ts).
      if (p.autoEvaluate === true) {
        const pv = evalPolicyView(s);
        if (pv.perSuite) {
          costs.push({ currency: 'staffTime', amount: Math.round(pv.perSuite.reTW * 100) / 100, target: `research-engineer team-weeks per ${pv.depth} re-run (changed ≥ ${pv.reevalDL} L or every ${pv.reevalDays} days)` });
          costs.push({ currency: 'compute', amount: Math.round(pv.perSuite.h100eDays), target: 'H100e-days per re-run, from experiments' });
        }
      }
      return { costs, gains, exposure };
    },
    apply: (s, ctx, p) => {
      const pol = s.player.policies;
      for (const k of ['servingAuto', 'upgradeToNewest', 'autoEvaluate'] as const) if (typeof p[k] === 'boolean') pol[k] = p[k] as boolean;
      ctx.log('company', 'Product policies updated.', 1);
    },
  },
];
