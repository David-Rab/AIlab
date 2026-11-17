// Products (BUILD-PLAN R6; design/ux/mockups-v3/v3-products*.png + v3-products-IA.md). Replaces Deploy.
// L1: one card per live product (package: model + mini free tier, monitor with catch rate, run cost; revenue hero with
// its 6-month line; customers; share of segment spend vs the best rival product; binding cause with the best lever),
// the Launch card (Agents with its time-horizon gate, then the other products), and the serving card (Auto split by
// product, what Auto cuts, budget link). L2: features (built once lab-wide, switched on here; build / building /
// locked by an idea) and settings (price tier, safeguards, KYC, effort), all editable live: an edit opens a before →
// after preview anchored to the card (Apply / Cancel, "stays live", effective date). L3: tooltips (catch-rate
// breakdown, capacity breakdown → Auto rule, feature effects, price elasticity, safeguard and KYC costs).
// One home per datum: total revenue lives in the top strip; the serving budget on Company › Split.
import { useMemo, useState, type ReactNode } from 'react';
import {
  Bot, Briefcase, Building2, Check, Hammer, Layers, Lock, MessageCircle, Pencil, Shield, ShieldCheck, SquareTerminal, Tag, Unlock, Users, X,
  type LucideIcon,
} from 'lucide-react';
import { AGENT_TASK_HOURS, FEATURES, PRICE_TIER_IDS, PRICE_TIERS, PRODUCT_DEFS, PRODUCT_ORDER, type FeatureDef } from '../../../data/v2/features';
import { TREE_BY_ID } from '../../../data/v2/tree';
import {
  CHANNEL_VARIANTS, agentsGate, buildEtas, catchRate, dateOf, deployGate, editBlock, editedProduct, effortLock, fmtDate, isProduct, measuredHorizonH,
  demandModifiers, measuredLOf, nodeKnown, PENALTY_MAX, previewEdit, productReadouts, revenueSpeedCap, servingPool, versionById,
} from '../../../engine/v2';
import type { Channel, Deployment, GameStateV2, ModelVersion, PriceTier, ProductChanges, ProductRead } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, Limit, Seg, Term, Tip, TipCard, type Params } from '../ui';
import { Card, PanelHead, Spark2 } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';
import './products.css';
import { CatchX, PkgChip } from './chips';

const P_ICON: Partial<Record<Channel, LucideIcon>> = { consumer: MessageCircle, api: SquareTerminal, enterprise: Building2, agents: Bot, gov: Briefcase, trusted: ShieldCheck, open: Unlock };
const SAFEGUARDS: Deployment['safeguards'][] = ['minimal', 'standard', 'classifiers', 'hardened'];
const SG_LABEL: Record<Deployment['safeguards'], string> = { minimal: 'Minimal', standard: 'Standard', classifiers: 'Classifiers', hardened: 'Hardened' };
const TIER_LABEL: Record<PriceTier, string> = { budget: 'Budget', standard: 'Standard', premium: 'Premium' };
const BOUND: Record<string, string> = { capacity: 'capacity-bound', quality: 'quality-bound', price: 'price-bound', demand: 'no demand' };
/** What binds, in words (jank PR5: shown when no lever gains anything). */
const BOUND_WHY: Record<string, string> = { capacity: 'serving compute is short', quality: 'rivals\' models win share', price: 'price limits demand', demand: 'no buyers in this segment yet' };
/** Product hue: serving compute is a Products-sphere pool. */
const PROD = '#b08e1a';
const usable = (v: ModelVersion) => v.status === 'ready' || v.status === 'deployed';
const nameOf = (s: GameStateV2, id?: string) => (id ? versionById(s, id)?.name ?? id : '—');
const mL = (s: GameStateV2, v?: ModelVersion) => measuredLOf(s, v).L;
/** Revenue per serving H100e-year, e.g. "$43K/H100e-yr". */
const rate = (x: number) => `$${F.count(x)}/H100e-yr`;

/** Action params of a draft edit. */
function editParams(id: string, c: ProductChanges): Params {
  const p: Params = { id };
  if (c.versionId) p.versionId = c.versionId;
  if (c.miniVersionId !== undefined) p.miniVersionId = c.miniVersionId ?? '';
  if (c.monitorId !== undefined) p.monitorId = c.monitorId ?? '';
  if (c.price) p.price = c.price;
  if (c.safeguards) p.safeguards = c.safeguards;
  if (c.kyc !== undefined) p.kyc = c.kyc;
  if (c.effort) p.effort = c.effort;
  if (c.features) p.features = c.features.join(',');
  return p;
}

/** What a draft changes, as "label: before → after" lines. */
function changeLines(s: GameStateV2, d: Deployment, c: ProductChanges): { k: string; from: string; to: string }[] {
  const n = editedProduct(d, c);
  const out: { k: string; from: string; to: string }[] = [];
  if (n.versionId !== d.versionId) out.push({ k: 'Model', from: nameOf(s, d.versionId), to: nameOf(s, n.versionId) });
  if (n.miniVersionId !== d.miniVersionId) out.push({ k: 'Free tier', from: d.miniVersionId ? nameOf(s, d.miniVersionId) : 'none', to: n.miniVersionId ? nameOf(s, n.miniVersionId) : 'none' });
  if (n.monitorId !== d.monitorId) out.push({ k: 'Monitor', from: d.monitorId ? nameOf(s, d.monitorId) : 'none', to: n.monitorId ? nameOf(s, n.monitorId) : 'none' });
  if (n.price !== d.price) out.push({ k: 'Price', from: TIER_LABEL[d.price], to: TIER_LABEL[n.price] });
  if (n.safeguards !== d.safeguards) out.push({ k: 'Safeguards', from: SG_LABEL[d.safeguards], to: SG_LABEL[n.safeguards] });
  if (n.kyc !== d.kyc) out.push({ k: 'KYC', from: String(d.kyc), to: String(n.kyc) });
  if (n.effort !== d.effort) out.push({ k: 'Effort', from: d.effort, to: n.effort });
  const fOn = n.features.filter((f) => !d.features.includes(f));
  const fOff = d.features.filter((f) => !n.features.includes(f));
  for (const f of fOn) out.push({ k: 'Feature', from: 'off', to: `${FEATURES.find((x) => x.id === f)?.name ?? f} on` });
  for (const f of fOff) out.push({ k: 'Feature', from: `${FEATURES.find((x) => x.id === f)?.name ?? f} on`, to: 'off' });
  return out;
}

export function Products({ s }: { s: GameStateV2 }) {
  const [edit, setEdit] = useState<{ id: string; c: ProductChanges } | null>(null);
  const reads = useMemo(() => productReadouts(s), [s, s.time.day, s.player.deployments, s.player.policies.servingAuto]);
  const live = s.player.deployments.filter((d) => isProduct(d) && d.status !== 'withdrawn')
    .sort((a, b) => PRODUCT_ORDER.indexOf(a.channel) - PRODUCT_ORDER.indexOf(b.channel));
  const pol = s.player.policies;
  // Products on an older model than the newest cleared one of their kind (the upgrade policy's readout).
  const behind = live.filter((d) => {
    const v = versionById(s, d.versionId);
    return v && s.player.models.versions.some((x) => x.variant === v.variant && usable(x) && x.day > v.day && mL(s, x) > mL(s, v) && deployGate(s, x, d.channel, { safeguards: d.safeguards, usagePolicy: d.usagePolicy }) === true);
  });
  return (
    <div className="panel-v2 prod" data-panel="products">
      <PanelHead icon={ICON.deploy} title="Products" sub="what customers buy · edit anything live"
        right={<span className="row-i prod-pol">
          <PolicySwitch on={pol.upgradeToNewest} k="upgradeToNewest" term="upgradePolicy" label="Upgrade to newest cleared model" />
          {behind.length > 0 && !pol.upgradeToNewest && <Tip content={() => <TipCard title="Behind the newest cleared model" rows={behind.map((d) => ({ label: PRODUCT_DEFS[d.channel]?.name ?? d.channel, value: nameOf(s, d.versionId) }))}>A newer version of the same kind has cleared the eval gate and measures better.</TipCard>}>
            <span className="tag2 warn" data-test="prod-behind">{behind.length} on an older model</span>
          </Tip>}
          <PolicySwitch on={pol.autoEvaluate} k="autoEvaluate" term="autoEvaluate" label="Auto-evaluate" />
        </span>} />

      <div className="prod-grid">
        {live.map((d) => (
          <ProductCard key={d.id} s={s} d={d} r={reads.get(d.id)} draft={edit?.id === d.id ? edit.c : undefined}
            setDraft={(c) => setEdit(c && Object.keys(c).length ? { id: d.id, c } : null)} />
        ))}
        <LaunchCard s={s} live={live} />
      </div>
      <ServingCard s={s} live={live} reads={reads} />
    </div>
  );
}

function PolicySwitch({ on, k, label, term }: { on: boolean; k: string; label: string; term: string }) {
  return (
    <ActBtn id="products.policy" testId={`products.policy.${k}`} params={{ [k]: !on }}
      label={<span className="psw"><span className={`sw ${on ? 'on' : ''}`}><i /></span><Term id={term}>{label}</Term></span>} />
  );
}

// ───────── product card ─────────
function ProductCard({ s, d, r, draft, setDraft }: { s: GameStateV2; d: Deployment; r?: ProductRead; draft?: ProductChanges; setDraft: (c: ProductChanges | null) => void }) {
  const def = PRODUCT_DEFS[d.channel];
  const Icon = P_ICON[d.channel] ?? ICON.product;
  const n = draft ? editedProduct(d, draft) : d;
  const set = (c: ProductChanges) => setDraft({ ...(draft ?? {}), ...c });
  const v = versionById(s, n.versionId);
  const mon = versionById(s, n.monitorId);
  const editing = !!draft && changeLines(s, d, draft).length > 0;
  const models = s.player.models.versions.filter((x) => usable(x) && CHANNEL_VARIANTS[d.channel].includes(x.variant));
  const minis = s.player.models.versions.filter((x) => usable(x) && x.variant === 'mini');
  const monitors = s.player.models.versions.filter((x) => usable(x) && x.variant !== 'open');
  const hist = [...(d.hist ?? []), d.revenueRate ?? 0];
  const last = d.hist?.length ? d.hist[d.hist.length - 1] : undefined;
  const trend = last && last > 0 ? (r?.revenue ?? d.revenueRate ?? 0) / last - 1 : undefined;
  return (
    <section className={`pc ${editing ? 'editing' : ''}`} data-product={d.id} data-channel={d.channel}>
      <div className="pc-h">
        <span className="pc-ic"><Icon size={16} /></span>
        <Tip content={() => <TipCard title={def?.name ?? d.channel}>{def?.blurb}</TipCard>}><span className="pc-nm"><Term id="product">{def?.name ?? d.channel}</Term></span></Tip>
        <span className="sp" />
        <span className="pc-st"><i />Live</span>
      </div>

      {/* Package: model (+ mini free tier), monitor, run cost */}
      <PkgChip kind="model" testId={`prod-model.${d.id}`} value={n.versionId} changed={n.versionId !== d.versionId || n.miniVersionId !== d.miniVersionId}
        options={models.map((x) => ({ value: x.id, label: `${x.name} · L ${F.level(mL(s, x))}` }))} onPick={(x) => set({ versionId: x })}
        sub={def && (d.channel === 'consumer' || d.channel === 'api') && (
          <Tip content={() => <TipCard title={<Term id="freeTier">Mini free tier</Term>}>{`A mini serves ${d.channel === 'consumer' ? '60%' : '30%'} of use (free and low-price users): far cheaper to serve, but the product's quality is the usage-weighted blend.`}</TipCard>}>
            <select className="msel sub" data-test={`prod-mini.${d.id}`} value={n.miniVersionId ?? ''} onChange={(e) => set({ miniVersionId: e.target.value || null })}>
              <option value="">no free tier</option>
              {minis.map((x) => <option key={x.id} value={x.id}>+ {x.name} free tier</option>)}
            </select>
          </Tip>
        )} />
      <PkgChip kind="monitor" testId={`prod-monitor.${d.id}`} value={n.monitorId ?? ''} changed={n.monitorId !== d.monitorId}
        options={[{ value: '', label: 'no monitor' }, ...monitors.map((x) => ({ value: x.id, label: `monitor ${x.name}` }))]} onPick={(x) => set({ monitorId: x || null })}
        extra={mon && <CatchX {...catchRate(s, v, mon)} testId={`prod-catch.${d.id}`} note="Model-behaviour incidents it catches stay internal: customers never see them." />} />
      <Tip content={() => <TipCard title={<Term id="runCost">Run cost</Term>} value={r ? F.money(r.runCost, { perYear: true }) : '—'} rows={r ? [
        { label: 'Serving it uses', value: `${F.h100e(Math.min(r.servedH100e, r.needH100e))} H100e` },
        { label: <Term id="monitor">Monitor overhead</Term>, value: d.monitorId ? `+${F.pct(r.monitorOverhead, 1)} of serving` : 'no monitor' },
        { label: <Term id="revPerH100e">Revenue per H100e</Term>, value: rate(r.rpH) },
        { label: 'Model research speed', value: (() => { const c = revenueSpeedCap(s, v); return <Limit id="revenue.speedCap" tone={c.capped ? 'warn' : 'quiet'}>{F.mult(c.M)}{c.capped ? ` → counts as ${c.cap}×` : ` · counts up to ${c.cap}×`}</Limit>; })() },
      ] : []}>Serving compute at the rental-equivalent price of an H100e.</TipCard>}>
        <div className="pc-cost"><ICON.cash size={12} /><b>{r ? F.money(r.runCost, { perYear: true }) : '—'}</b><span className="dim">to run</span><span className="sp" />{d.monitorId && r && <span className="dim">monitor +{F.pct(r.monitorOverhead)}</span>}</div>
      </Tip>

      {/* Revenue hero */}
      <Tip as="div" content={() => <TipCard title={<Term id="revenueNow">Revenue now</Term>} value={F.money(r?.revenue ?? d.revenueRate ?? 0, { perYear: true })} rows={[
        ...(r ? [{ label: 'Demand', value: F.money(r.demand, { perYear: true }) }, { label: <Term id="servingCut">Unserved</Term>, value: F.money(r.unserved, { perYear: true }), tone: (r.unserved > 0.005 ? 'neg' : 'neutral') as 'neg' | 'neutral' }] : []),
        ...(last !== undefined ? [{ label: '30 days ago', value: F.money(last, { perYear: true }) }] : []),
      ]} footer="The top strip shows all products as a 30-day average.">This product's revenue today, annualised.</TipCard>}>
      <div className="pc-rev">
        <span className="v" data-home={`revenue.${d.id}`}>{F.money(r?.revenue ?? d.revenueRate ?? 0)}</span><span className="u">/yr now</span>
        <span className="sp" />
        {trend !== undefined && <span className={`pc-tr ${trend >= 0 ? 'up' : 'dn'}`}>{trend >= 0 ? '▲' : '▼'} {F.pct(Math.abs(trend))} <span className="dim">30 d</span></span>}
      </div>
      </Tip>
      {hist.length >= 3 && <Tip content={() => <TipCard title="Revenue, last months" rows={hist.map((x, i) => ({ label: i === hist.length - 1 ? 'now' : `${(hist.length - 1 - i) * 30} d ago`, value: F.money(x, { perYear: true }) }))} />}><span className="pc-spark"><Spark2 data={hist} w={230} h={30} color={PROD} /></span></Tip>}

      {r && def && def.arpu > 0 && (
        <Tip content={() => <TipCard title={def.customers} value={F.count(r.customers)}>{`Revenue ÷ about $${F.count(def.arpu)} a year per customer.`}</TipCard>}>
          <div className="pc-cust"><Users size={12} /><b>{F.count(r.customers)}</b> {def.customers}</div>
        </Tip>
      )}

      {r && <Share s={s} d={d} r={r} />}
      {r && <Binding s={s} d={d} r={r} set={set} />}

      <Features s={s} d={d} />

      {/* Settings: live */}
      <div className="pc-set">
        <div className="pc-cap"><span>Settings</span><span className="sp" /><span className="dim"><Pencil size={10} /> live</span></div>
        <div className="pc-row">
          <Tip content={() => <TipCard title={<Term id="priceTier">Price tier</Term>} rows={PRICE_TIER_IDS.map((t) => ({ label: TIER_LABEL[t], value: `price ×${PRICE_TIERS[t]} · demand ×${(PRICE_TIERS[t] ** -1.5).toFixed(2)}` }))}>Demand falls with price^−1.5.</TipCard>}><span className="pc-k"><Tag size={11} />Price</span></Tip>
          <Seg testId={`prod-price.${d.id}`} value={n.price} options={PRICE_TIER_IDS.map((t) => ({ v: t, label: TIER_LABEL[t] }))} onChange={(t) => set({ price: t })} />
        </div>
        <div className="pc-row">
          <Tip content={() => <TipCard title={<Term id="safeguards">Safeguards</Term>} rows={[
            { label: 'Misuse hazard', value: 'minimal ×1 · standard ×0.7 · classifiers ×0.4 · hardened ×0.15' },
            { label: 'Quality', value: 'classifiers −0.05 L · hardened −0.2 L' },
            { label: <Term id="usagePolicy">Usage policy</Term>, value: Object.entries(d.usagePolicy).filter(([, x]) => x).map(([k]) => F.words(k)).join(', ') || 'none' },
          ]} />}><span className="pc-k"><Shield size={11} />Safeguards</span></Tip>
          <select className="msel small" data-test={`prod-sg.${d.id}`} value={n.safeguards} onChange={(e) => set({ safeguards: e.target.value as Deployment['safeguards'] })}>
            {SAFEGUARDS.map((g) => <option key={g} value={g}>{SG_LABEL[g]}</option>)}
          </select>
          {(d.channel === 'api' || d.channel === 'agents') && <>
            <Tip content={() => <TipCard title={<Term id="kyc">KYC</Term>}>Each level cuts distillation access by a quarter and this product's demand by 2%.</TipCard>}><span className="pc-k">KYC</span></Tip>
            <Seg testId={`prod-kyc.${d.id}`} value={n.kyc} options={[0, 1, 2, 3].map((k) => ({ v: k as Deployment['kyc'], label: String(k) }))} onChange={(k) => set({ kyc: k })} />
          </>}
        </div>
        <div className="pc-row">
          <Tip content={() => <TipCard title={<Term id="effort">Effort</Term>}>Low: −0.4 L, 1.6× revenue per H100e. Max: the reference. Deep think is a feature.</TipCard>}><span className="pc-k">Effort</span></Tip>
          <Seg testId={`prod-effort.${d.id}`} value={n.effort} options={(['low', 'max', 'deep'] as const).map((e) => ({
            v: e, label: e === 'deep' ? 'deep think' : e,
            locked: e === 'deep' ? (effortLock(s, 'deep') ?? (!s.player.features.includes('deepThink') ? 'Build the Deep think feature first' : !FEATURES.find((f) => f.id === 'deepThink')!.products.includes(d.channel) ? 'Not offered on this product' : undefined)) : undefined,
          }))} onChange={(e) => set({ effort: e })} />
          <span className="sp" />
          <ActBtn id="product.retire" testId={`product.retire.${d.id}`} params={{ id: d.id }} label="Retire" />
        </div>
      </div>

      {editing && draft && <EditPop s={s} d={d} c={draft} close={() => setDraft(null)} />}
    </section>
  );
}

function Share({ s, d, r }: { s: GameStateV2; d: Deployment; r: ProductRead }) {
  const erosion = s.world.fx.capPenalty[d.channel === 'consumer' ? 'consumer' : 'sector'];
  const max = Math.max(r.share, r.rival?.share ?? 0, 0.01);
  const def = PRODUCT_DEFS[d.channel];
  return (
    <Tip content={() => <TipCard title={<Term id="segmentShare">Share of {def?.segment}</Term>} rows={[
      { label: 'You (all your products here)', value: F.pct(r.share) },
      ...(r.rival ? [{ label: `Best rival: ${r.rival.name}`, value: F.pct(r.rival.share) }] : []),
      { label: 'This product\'s demand', value: F.money(r.demand, { perYear: true }) },
    ]}>{d.channel === 'consumer' ? 'Consumer spend by region, share by quality, appeal and price.' : 'Sector spend, share by your best product in each sector; this product takes its channel\'s part.'}</TipCard>}>
      <div className="pc-share">
        <div className="pc-cap"><Term id="segmentShare">Share</Term><span className="dim">· {def?.segment}</span></div>
        <div className="sh"><span className="who">You</span><span className="b"><i style={{ width: `${(r.share / max) * 100}%`, background: C.you }} /></span><span className="n">{F.pct(r.share)}</span></div>
        {r.rival && <div className="sh"><span className="who">{r.rival.name}</span><span className="b"><i style={{ width: `${(r.rival.share / max) * 100}%`, background: C.rival }} /></span><span className="n">{F.pct(r.rival.share)}</span></div>}
        {erosion > 0.005 && <Limit id="product.erosion" tone={erosion >= PENALTY_MAX - 1e-6 ? 'bind' : 'warn'}>capacity-bound: share −{F.pct(erosion)} (max {F.pct(PENALTY_MAX)})</Limit>}
      </div>
    </Tip>
  );
}

/** Binding cause and its best lever (a preview; click sets the draft or opens the control). */
function Binding({ s, d, r, set }: { s: GameStateV2; d: Deployment; r: ProductRead; set: (c: ProductChanges) => void }) {
  const lever = useMemo((): { label: ReactNode; gain: number; act: () => void } | undefined => {
    if (r.bound === 'capacity') return r.cutH100e >= 1 && r.unserved >= 0.005 ? { label: <>+{F.h100e(r.cutH100e)} H100e serving</>, gain: r.unserved, act: () => store.goto('compute', { tab: 'split', anchor: 'split-serving' }) } : undefined;
    if (r.bound === 'price') {
      const i = PRICE_TIER_IDS.indexOf(d.price);
      if (i <= 0) return undefined;
      const t = PRICE_TIER_IDS[i - 1];
      const pv = previewEdit(s, d, { price: t });
      return pv.totalAfter - pv.totalBefore >= 0.005 ? { label: <>{TIER_LABEL[t]} tier</>, gain: pv.totalAfter - pv.totalBefore, act: () => set({ price: t }) } : undefined;
    }
    if (r.bound === 'quality') {
      const cur = versionById(s, d.versionId);
      const better = s.player.models.versions.filter((x) => usable(x) && CHANNEL_VARIANTS[d.channel].includes(x.variant) && mL(s, x) > mL(s, cur) && deployGate(s, x, d.channel, { safeguards: d.safeguards, usagePolicy: d.usagePolicy }) === true)
        .sort((a, b) => mL(s, b) - mL(s, a))[0];
      if (!better) return undefined;
      const pv = previewEdit(s, d, { versionId: better.id });
      return pv.totalAfter - pv.totalBefore >= 0.005 ? { label: <>{better.name}</>, gain: pv.totalAfter - pv.totalBefore, act: () => set({ versionId: better.id }) } : undefined;
    }
    return undefined;
  }, [s, s.time.day, d, r.bound]);
  return (
    <Tip content={() => <TipCard title={<Term id="bindingCause">{BOUND[r.bound]}</Term>} rows={[
      { label: 'Demand', value: `${F.h100e(r.needH100e)} H100e · ${F.money(r.demand, { perYear: true })}` },
      { label: <Term id="monitor">incl. monitor</Term>, value: `+${F.pct(r.monitorOverhead)}` },
      { label: <><Term id="servingShare">Served</Term> (<Term id="autoServing">{s.player.policies.servingAuto ? 'Auto rule' : 'your share'}</Term>)</>, value: `${F.h100e(r.servedH100e)} H100e` },
      { label: <Term id="servingCut">Unserved</Term>, value: r.cutH100e > 0 ? `${F.h100e(r.cutH100e)} H100e · ${F.money(r.unserved, { perYear: true })}` : 'none', tone: r.cutH100e > 0 ? 'neg' : 'neutral' },
      { label: <Term id="revPerH100e">Revenue per H100e</Term>, value: rate(r.rpH) },
      { label: 'Demand modifiers', value: (() => { const m = demandModifiers(d); return <Limit id="product.demandMods">{m.length ? m.map((x) => Number.isNaN(x.mult) ? x.label : `${x.label} ×${x.mult.toFixed(2)}`).join(' · ') : 'none'}</Limit>; })() },
    ]} footer={lever ? 'Click the lever to preview it.' : undefined} />}>
      <button className={`pc-bind ${r.bound}`} data-test={`prod-bind.${d.id}`} onClick={() => lever?.act()}>
        <span className="bt"><Term id={r.bound === 'capacity' ? 'capacityBound' : r.bound === 'quality' ? 'qualityBound' : r.bound === 'price' ? 'priceBound' : 'bindingCause'}>{BOUND[r.bound]}</Term></span>
        {lever ? <span className="lvr">→ {lever.label} <b>{F.money(lever.gain, { signed: true, perYear: true })}</b></span> : <span className="lvr dim">{BOUND_WHY[r.bound]}</span>}
      </button>
    </Tip>
  );
}

function Features({ s, d }: { s: GameStateV2; d: Deployment }) {
  const feats = FEATURES.filter((f) => f.products.includes(d.channel));
  const etas = buildEtas(s).etas;
  return (
    <div className="pc-feat">
      <div className="pc-cap"><Term id="feature">Features</Term><span className="sp" /><Tip content={() => <TipCard title="Built once, on here">Engineers build a feature once for the whole lab; switch it on for each product that offers it.</TipCard>}><span className="dim">built once · on here</span></Tip></div>
      {feats.map((f) => <FeatureRow key={f.id} s={s} d={d} f={f} eta={etas.get(s.player.build.queue.find((it) => it.kind === 'feature' && it.ref === f.id)?.id ?? '')} />)}
    </div>
  );
}

function FeatureRow({ s, d, f, eta }: { s: GameStateV2; d: Deployment; f: FeatureDef; eta?: number }) {
  const tip = () => <TipCard title={f.name} rows={[
    { label: 'Effect', value: f.effect },
    ...(f.risk ? [{ label: 'Cost / risk', value: f.risk }] : []),
    ...(f.buildTW ? [{ label: 'Build', value: `${f.buildTW} team-weeks · ${F.money(f.cash)}` }] : []),
    { label: 'Idea', value: TREE_BY_ID[f.node]?.name ?? f.node },
  ]} />;
  if (f.id === 'sectorPacks') {
    const secs = d.sectorFocus;
    return (
      <Tip content={() => <TipCard title={<Term id="sectorPack">Sector packs</Term>} rows={secs.map((x) => ({ label: x, value: s.world.fx.certDay[x] !== undefined && s.world.fx.certDay[x]! <= s.time.day ? 'certified' : `certified ${fmtDate(dateOf(s, s.world.fx.certDay[x] ?? s.time.day))}` }))}>{f.effect}</TipCard>}>
        <div className="ft"><Layers size={12} /><span className="ft-n">{secs.length ? secs.join(' · ') : 'Sector packs'}</span><span className="sp" />
          <ActBtn id="wfx.sectorProduct" testId={`prod-pack.${d.id}`} params={{ deploymentId: d.id }} label="+ pack" />
        </div>
      </Tip>
    );
  }
  const built = s.player.features.includes(f.id);
  const on = d.features.includes(f.id);
  const building = eta !== undefined;
  const known = nodeKnown(s, f.node);
  if (built) return (
    <Tip content={tip}>
      <div className="ft"><Check size={12} className="ok" /><span className="ft-n">{f.name}</span><span className="sp" />
        <ActBtn id="feature.toggle" testId={`feature.toggle.${d.id}.${f.id}`} params={{ product: d.id, feature: f.id, on: !on }} label={<span className={`sw ${on ? 'on' : ''}`}><i /></span>} />
      </div>
    </Tip>
  );
  if (building) return (
    <Tip content={tip}><div className="ft dim"><Hammer size={12} /><span className="ft-n">{f.name}</span><span className="sp" /><span className="ft-s">building · {F.days(eta!)}</span></div></Tip>
  );
  if (known) return (
    <Tip content={tip}><div className="ft"><ICON.product size={12} className="dim" /><span className="ft-n dim">{f.name}</span><span className="sp" /><span className="ft-s dim">{F.money(f.cash)} · {f.buildTW} t-wk</span>
      <ActBtn id="feature.build" testId={`feature.build.${f.id}`} params={{ id: f.id }} label="Build" /></div></Tip>
  );
  return (
    <Tip content={tip}>
      <button className="ft locked" data-node={f.node} onClick={() => { store.setTab('research.sel', f.node); store.goto('research'); }}>
        <Lock size={11} /><span className="ft-n">{f.name}</span><span className="sp" /><span className="ft-s"><ICON.research size={10} /> {TREE_BY_ID[f.node]?.name ?? f.node}</span>
      </button>
    </Tip>
  );
}

/** Edit preview popover: what changes, before → after, Apply / Cancel. */
function EditPop({ s, d, c, close }: { s: GameStateV2; d: Deployment; c: ProductChanges; close: () => void }) {
  const lines = changeLines(s, d, c);
  const block = editBlock(s, d, c);
  const pv = useMemo(() => (block ? undefined : previewEdit(s, d, c)), [s, s.time.day, d, JSON.stringify(c)]);
  const b = pv?.before;
  const a = pv?.after;
  const n = editedProduct(d, c);
  const catchB = d.monitorId ? catchRate(s, versionById(s, d.versionId), versionById(s, d.monitorId)).rate : 0;
  const catchA = n.monitorId ? catchRate(s, versionById(s, n.versionId), versionById(s, n.monitorId)).rate : 0;
  const def = PRODUCT_DEFS[d.channel];
  const row = (k: ReactNode, x: number | undefined, y: number | undefined, fmt: (v: number) => string, goodUp = true) => {
    if (x === undefined || y === undefined) return null;
    const dd = y - x;
    const tone = Math.abs(dd) < 1e-9 ? '' : (dd > 0) === goodUp ? 'pos' : 'neg';
    return <><span className="k">{k}</span><span className="ba"><span className="o">{fmt(x)}</span>→<b>{fmt(y)}</b>{tone && <span className={`tone-${tone}`}>{dd > 0 ? '▲' : '▼'}</span>}</span></>;
  };
  return (
    <div className="pc-pop" data-test={`prod-edit.${d.id}`}>
      <div className="pop-h"><Pencil size={12} /><b>{def?.name} · {lines.length} change{lines.length > 1 ? 's' : ''}</b><span className="sp" /><span className="tag2 good">stays live</span></div>
      <div className="pop-ch">{lines.map((l, i) => <div key={i}><span className="tag2">{l.k}</span> {l.from} → <b>{l.to}</b></div>)}</div>
      {block ? <div className="tone-neg small">{block}</div> : (
        <div className="pv">
          <span className="k dim">per year</span><span />
          {row(def?.customers ?? 'Customers', b?.customers, a?.customers, (x) => F.count(x))}
          {row(<Tip content={() => <TipCard title={<Term id="revenueNow">Revenue now</Term>}>This product's annualised revenue today, before and after the change. The top strip shows the 30-day average of all products.</TipCard>}><span>Revenue now</span></Tip>, b?.revenue, a?.revenue, (x) => F.money(x))}
          {row('All products, now', pv?.totalBefore, pv?.totalAfter, (x) => F.money(x))}
          {row('Share', b?.share, a?.share, (x) => F.pct(x))}
          {(d.monitorId || n.monitorId) && row(<Term id="catchRate">Catch</Term>, catchB, catchA, (x) => F.pct(x))}
          {b && a && <><span className="k"><Term id="bindingCause">Binding</Term></span><span className="ba"><span className="o">{b.bound}</span>→<b>{a.bound}</b></span></>}
          {row(<Term id="servingShare">Serving need</Term>, b?.needH100e, a?.needH100e, (x) => `${F.h100e(x)}`, false)}
          {row(<Term id="runCost">Run cost</Term>, b?.runCost, a?.runCost, (x) => F.money(x), false)}
        </div>
      )}
      <div className="pop-f">
        <ActBtn id="product.update" testId={`product.update.${d.id}`} params={editParams(d.id, c)} label="Apply" primary block={block} onDone={close} />
        <button className="btn btn-sm" data-test={`prod-cancel.${d.id}`} onClick={close}><X size={12} /> Cancel</button>
        <span className="sp" />
        <span className="dim small">from {fmtDate(dateOf(s, s.time.day + 1))}</span>
      </div>
    </div>
  );
}

// ───────── launch card ─────────
function LaunchCard({ s, live }: { s: GameStateV2; live: Deployment[] }) {
  const missing = PRODUCT_ORDER.filter((c) => !live.some((d) => d.channel === c));
  const [pick, setPick] = useState<Channel>(missing[0] ?? 'agents');
  const ch = missing.includes(pick) ? pick : missing[0];
  if (!ch) return null;
  const vs = s.player.models.versions.filter((v) => usable(v) && CHANNEL_VARIANTS[ch].includes(v.variant)).sort((a, b) => mL(s, b) - mL(s, a));
  const v = vs[0];
  const imported = s.player.models.versions.some((x) => x.variant === 'imported' && x.status !== 'retired');
  // Jank PR7: say the fix, not just the rule.
  const gate = v ? deployGate(s, v, ch) : `${PRODUCT_DEFS[ch]?.name} needs a ${CHANNEL_VARIANTS[ch].join(' or ')} model${imported ? ': post-train your imported model in Blueprint to sell it' : ': train one in Blueprint'}`;
  const Icon = P_ICON[ch] ?? ICON.product;
  const h = measuredHorizonH(v);
  return (
    <section className="pc off" data-test="prod-launch">
      <div className="pc-h">
        <span className="pc-ic"><Icon size={16} /></span>
        <select className="msel nm" data-test="prod-launch-pick" value={ch} onChange={(e) => setPick(e.target.value as Channel)}>
          {missing.map((c) => <option key={c} value={c}>{PRODUCT_DEFS[c]?.name ?? c}</option>)}
        </select>
        <span className="sp" /><span className="pc-st off">Not launched</span>
      </div>
      <div className="dim small">{PRODUCT_DEFS[ch]?.blurb}</div>
      {ch === 'agents' && (
        <Tip content={() => <TipCard title={<Term id="timeHorizon">Time horizon</Term>} value={h !== undefined ? F.minutes(h * 60) : 'not measured'} rows={[{ label: 'Needed', value: `${AGENT_TASK_HOURS} h (half-day tasks)` }, { label: 'Model', value: v?.name ?? '—' }]}>{String(agentsGate(v) === true ? 'Covers the tasks Agents sells.' : agentsGate(v))}</TipCard>}>
          <div className="pc-gate" data-test="agents-gate">
            <div className="pc-cap"><Lock size={10} /> Needs</div>
            <div className="gate-row"><Term id="timeHorizon">Time horizon</Term><span className="sp" /><b>{h !== undefined ? F.minutes(h * 60) : '—'}</b><span className="dim"> / {AGENT_TASK_HOURS} h</span></div>
            <div className="gate-bar"><i style={{ width: `${Math.min(100, ((h ?? 0) / (AGENT_TASK_HOURS * 1.5)) * 100)}%`, background: (h ?? 0) >= AGENT_TASK_HOURS ? C.good : C.cap }} /><em style={{ left: `${(1 / 1.5) * 100}%` }} /></div>
            <div className="dim small">{v?.name ?? 'no model'} · measured</div>
          </div>
        </Tip>
      )}
      <div className="sp-v" />
      <ActBtn id="product.launch" testId={`product.launch.${ch}`} params={{ channel: ch, ...(v ? { versionId: v.id } : {}) }} label={<>Launch {PRODUCT_DEFS[ch]?.name}</>} block={gate === true ? undefined : gate} reason />
      {!v && <button className="btn btn-sm btn-ghost" data-go="blueprint" onClick={() => store.goto('blueprint')}>Blueprint ›</button>}
    </section>
  );
}

// ───────── serving card ─────────
function ServingCard({ s, live, reads }: { s: GameStateV2; live: Deployment[]; reads: Map<string, ProductRead> }) {
  const pool = servingPool(s);
  const rows = live.map((d) => ({ d, r: reads.get(d.id) })).filter((x) => x.r) as { d: Deployment; r: ProductRead }[];
  const cut = rows.reduce((a, x) => a + x.r.cutH100e, 0);
  const total = Math.max(pool, rows.reduce((a, x) => a + x.r.servedH100e, 0)) + cut;
  const auto = s.player.policies.servingAuto;
  const order = [...rows].sort((a, b) => b.r.rpH - a.r.rpH);
  const [shares, setShares] = useState<Record<string, number>>({});
  return (
    <Card className="prod-serve" home="servingSplit" title={<Term id="poolServing">Serving compute</Term>} sub="H100e by product"
      right={<span className="row-i">
        <ActBtn id="products.policy" testId="products.policy.servingAuto" params={{ servingAuto: !auto }} label={<span className="psw"><span className={`sw ${auto ? 'on' : ''}`}><i /></span><Term id="autoServing">Auto</Term><span className="dim">most $ per H100e first</span></span>} />
        <button className="btn btn-sm" data-go="compute" onClick={() => store.goto('compute', { tab: 'split', anchor: 'split-serving' })}>Budget ›</button>
      </span>}>
      <div className="sv-bar" data-test="serving-bar">
        {rows.map(({ d, r }) => (
          <Tip key={d.id} className="sv-w" style={{ width: `${(r.servedH100e / total) * 100}%` }} content={() => <TipCard title={PRODUCT_DEFS[d.channel]?.name ?? d.channel} rows={[
            { label: 'Needs', value: `${F.h100e(r.needH100e)} H100e` }, { label: 'Gets', value: `${F.h100e(r.servedH100e)} H100e` },
            { label: <Term id="revPerH100e">Revenue per H100e</Term>, value: rate(r.rpH) },
            { label: <Term id="servingCut">Cut</Term>, value: r.cutH100e > 0 ? `${F.h100e(r.cutH100e)} H100e` : 'none', tone: r.cutH100e > 0 ? 'neg' : 'neutral' },
          ]} />}>
            <span className={`sv-seg ${r.bound === 'capacity' ? 'cap' : ''}`} data-serve={d.id}><b>{F.h100e(r.servedH100e)}</b></span>
          </Tip>
        ))}
        {cut > 0 && <Tip className="sv-w" style={{ width: `${(cut / total) * 100}%` }} content={() => <TipCard title={<Term id="servingCut">Cut by Auto</Term>} value={`${F.h100e(cut)} H100e`} rows={rows.filter((x) => x.r.cutH100e > 0).map((x) => ({ label: PRODUCT_DEFS[x.d.channel]?.name ?? x.d.channel, value: `${F.h100e(x.r.cutH100e)} H100e · ${F.money(x.r.unserved, { perYear: true })}`, tone: 'neg' as const }))}>Demand the serving pool cannot meet. {auto ? 'Auto cut the products earning least per H100e.' : 'Your shares leave it unserved.'}</TipCard>}>
          <span className="sv-cut" data-test="serving-cut">+{F.h100e(cut)}</span>
        </Tip>}
      </div>
      <div className="sv-leg">
        {rows.map(({ d, r }) => <span key={d.id} className="sv-l" style={{ width: `${(r.servedH100e / total) * 100}%` }}>{PRODUCT_DEFS[d.channel]?.name}{r.bound === 'capacity' && <span className="tone-neg"> · capacity-bound</span>}</span>)}
        {cut > 0 && <span className="sv-l cut" style={{ width: `${(cut / total) * 100}%` }}>{auto ? 'cut by Auto' : 'unserved'}</span>}
      </div>
      <div className="sv-foot dim small">
        <Tip content={() => <TipCard title={<Term id="poolServing">Serving pool</Term>} value={`${F.h100e(pool)} H100e`} rows={[{ label: "Share of compute", value: F.pct(s.player.split.serving) }]}>Set on Compute › Split.</TipCard>}><span>Pool {F.h100e(pool)} H100e ({F.pct(s.player.split.serving)} of compute)</span></Tip>
        {auto && order.length > 1 && <span> · Auto order: {order.map((x) => `${PRODUCT_DEFS[x.d.channel]?.name} ${rate(x.r.rpH)}`).join(' › ')}</span>}
      </div>
      {!auto && (
        <div className="sv-man" data-test="serving-manual">
          {live.map((d) => {
            const sh = shares[d.id] ?? d.servingShare;
            return (
              <span key={d.id} className="sv-m">
                <span>{PRODUCT_DEFS[d.channel]?.name}</span>
                <input className="slider" type="range" min={0} max={1} step={0.01} value={sh} onChange={(e) => setShares({ ...shares, [d.id]: Number(e.target.value) })} />
                <Tip content={() => <TipCard title="Serving share" value={F.pct(sh)}>Share of the serving pool for this product (manual split).</TipCard>}><b className="num">{F.pct(sh)}</b></Tip>
                <ActBtn id="product.serving" testId={`product.serving.${d.id}`} params={{ id: d.id, share: sh }} label="Set" />
              </span>
            );
          })}
        </div>
      )}
    </Card>
  );
}
