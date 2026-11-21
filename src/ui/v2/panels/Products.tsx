// Products (BUILD-PLAN R6; design/ux/mockups-v3/v3-products*.png + v3-products-IA.md). Replaces Deploy.
// L1: one card per live product (package: model + mini free tier, monitor with catch rate, run cost; revenue hero with
// its 6-month line; customers: the stock vs its target share, speed and days to converge, the best rival product (B2);
// binding cause with the best lever),
// the Launch card (Agents with its time-horizon gate, then the other products), and the serving card (Auto split by
// product, what Auto cuts, budget link). L2: features (built once lab-wide, switched on here; build / building /
// locked by an idea; each with its type and typed effect, B2) and settings (price tier, safeguards, KYC, effort), all editable live: an edit opens a before →
// after preview anchored to the card (Apply / Cancel, "stays live", effective date). L3: tooltips (catch-rate
// breakdown, capacity breakdown → Auto rule, feature effects, price elasticity, safeguard and KYC costs).
// One home per datum: total revenue lives in the top strip; the serving budget on Company › Split.
import { useMemo, useState, type ReactNode } from 'react';
import {
  Blocks, Bot, BrainCog, Briefcase, Building2, Check, Clock3, DoorOpen, Hammer, Layers, Lock, MessageCircle, Pencil, Ruler, Shield, ShieldCheck, SquareTerminal, Tag, Unlock, Users, X,
  type LucideIcon,
} from 'lucide-react';
import { AGENT_TASK_HOURS, FEATURES, PRICE_TIER_IDS, PRODUCT_DEFS, PRODUCT_ORDER, type FeatureDef } from '../../../data/v2/features';
import { EFFORT_OOM_PER_10X, EFFORT_TOKENS, MARKUP, consumerPlanPrice } from '../../../data/v2/serving';
import { SECTORS } from '../../../data/v2/sectors';
import { TREE_BY_ID } from '../../../data/v2/tree';
import {
  CHANNEL_VARIANTS, agentsGate, dangerView, buildEtas, catchRate, dateOf, deployGate, editBlock, editedProduct, effortLock, fmtDate, isProduct, measuredHorizonH,
  demandModifiers, featureView, measuredLOf, nodeKnown, PENALTY_MAX, previewEdit, productReadouts, servingPool, versionById, CONVERGED,
  LAUNCH_TW, LENT_RECOVERY, pendingLaunch, spareServing, spareServingToResearch, charterHolds,
} from '../../../engine/v2';
import type { Channel, CustomerView, DangerRead, Deployment, FeatureKind, GameStateV2, LineupRow, ModelVersion, PriceTier, ProductChanges, ProductRead } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, Limit, Seg, Term, Tip, TipCard, type Params } from '../ui';
import { Card, PanelHead, Ref, Spark2 } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';
import './products.css';
import { CatchX, PkgChip } from './chips';
import { DangerChip } from './Danger';

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
  // Model v3 E11: believed danger per product (beliefs and measured levels only).
  const danger = useMemo(() => dangerView(s).products, [s, s.time.day, s.player.deployments]);
  const live = s.player.deployments.filter((d) => isProduct(d) && d.status !== 'withdrawn')
    .sort((a, b) => PRODUCT_ORDER.indexOf(a.channel) - PRODUCT_ORDER.indexOf(b.channel));
  const pol = s.player.policies;
  const side = live.length > 0 && live.length <= 3;
  const held = charterHolds(s).length;
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
          {/* D8: auto-evaluate lives on the eval policy (Models › Evals). */}
          <Ref id="autoEvaluate" to={{ panel: 'models', tab: 'evals' }}>Auto-evaluate</Ref>
          {/* FIN3b: models the charter holds back; the list's home is the Board card. */}
          {held > 0 && <Ref id="charterHolds" to={{ panel: 'finance', tab: 'owners', anchor: 'board' }}><Lock size={11} /> Safety committee holds {held} model{held > 1 ? 's' : ''}</Ref>}
        </span>} />

      {/* B4: with three products or fewer, the launch card and the serving split share a column beside the cards (the
          launch card no longer stretches to the cards' height, and the serving split is above the fold). */}
      <div className={`prod-grid ${side ? 'side' : ''}`} style={side ? { gridTemplateColumns: `repeat(${live.length}, minmax(250px, 300px)) minmax(360px, 1fr)` } : undefined}>
        {live.map((d) => (
          <ProductCard key={d.id} s={s} d={d} r={reads.get(d.id)} danger={danger[d.id]} draft={edit?.id === d.id ? edit.c : undefined}
            setDraft={(c) => setEdit(c && Object.keys(c).length ? { id: d.id, c } : null)} />
        ))}
        {side ? (
          <div className="prod-side">
            <LaunchCard s={s} live={live} />
            <ServingCard s={s} live={live} reads={reads} />
          </div>
        ) : <LaunchCard s={s} live={live} />}
      </div>
      {!side && <ServingCard s={s} live={live} reads={reads} />}
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
function ProductCard({ s, d, r, danger, draft, setDraft }: { s: GameStateV2; d: Deployment; r?: ProductRead; danger?: DangerRead; draft?: ProductChanges; setDraft: (c: ProductChanges | null) => void }) {
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
          <Tip content={() => <TipCard title={d.channel === 'consumer' ? <Term id="freeTier">Mini free tier</Term> : <Term id="cheapTier">Mini cheap tier</Term>}>{d.channel === 'consumer' ? 'The free tier serves every user without a subscription. By default it is a distilled student of the main model, a year of frontier progress below it and far cheaper to serve, as every lab\'s is; users choose an app on it. A mini of your own replaces it and weighs 60% in Chat\'s quality.' : 'A mini of your own is an extra tier in the product\'s [[lineup]]: buyers take it on the tasks it does as well, at its lower price. Its share of the hours follows from the market, not a setting.'}</TipCard>}>
            <select className="msel sub" data-test={`prod-mini.${d.id}`} value={n.miniVersionId ?? ''} onChange={(e) => set({ miniVersionId: e.target.value || null })}>
              <option value="">{d.channel === 'consumer' ? 'student free tier' : 'lineup only'}</option>
              {minis.map((x) => <option key={x.id} value={x.id}>+ {x.name} {d.channel === 'consumer' ? 'free' : 'cheap'} tier</option>)}
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
      ] : []} footer="Price, cost and margin per unit: the Price row below.">Serving compute at the rental-equivalent price of an H100e.</TipCard>}>
        <div className="pc-cost"><ICON.cash size={12} /><b>{r ? F.money(r.runCost, { perYear: true }) : '—'}</b><span className="dim">to run</span><span className="sp" />{d.monitorId && r && <span className="dim">monitor +{F.pct(r.monitorOverhead)}</span>}</div>
      </Tip>
      <div className="pc-danger"><DangerChip r={danger} where={def?.name ?? d.channel} testId={`prod-danger.${d.id}`} /></div>

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

      {r && <Econ d={d} r={r} />}
      {r?.lineup && r.lineup.length > 1 && <Lineup d={d} r={r} rows={r.lineup} />}
      {r && <Customers s={s} d={d} r={r} />}
      {r && <Binding s={s} d={d} r={r} set={set} />}

      <Features s={s} d={d} />

      {/* Settings: live */}
      <div className="pc-set">
        <div className="pc-cap"><span>Settings</span><span className="dim"><Pencil size={10} /> live</span><span className="sp" /><ActBtn id="product.retire" testId={`product.retire.${d.id}`} params={{ id: d.id }} label="Retire" /></div>
        <div className="pc-row">
          <Tip content={() => d.channel === 'consumer'
            ? <TipCard title={<Term id="priceTier">Price tier</Term>} rows={PRICE_TIER_IDS.map((t) => ({ label: TIER_LABEL[t], value: `plan ${usd(consumerPlanPrice(MARKUP[t]))}/mo` }))}>Chat sells flat monthly plans at the market's price, not a markup over serving cost: Standard and Premium at the willingness to pay, Budget below it (more of your users subscribe). A plan never sells below a paying user's serving cost.</TipCard>
            : <TipCard title={<Term id="priceTier">Price tier</Term>} rows={PRICE_TIER_IDS.map((t) => ({ label: TIER_LABEL[t], value: `price = cost ×${MARKUP[t].toFixed(2)} (margin ${F.pct(1 - 1 / MARKUP[t])})` }))}>Price is a markup over this product's own serving cost, never above the value cap. On work a cheaper offer also does, buyers take the cheaper one; on work only your model does, price matters little.</TipCard>}><span className="pc-k"><Tag size={11} />Price</span></Tip>
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
        </div>
        {(d.channel === 'api' || d.channel === 'agents') && <div className="pc-row">
            <Tip content={() => <TipCard title={<Term id="kyc">KYC</Term>}>Each level cuts distillation access by a quarter and this product's demand by 2%.</TipCard>}><span className="pc-k">KYC</span></Tip>
            <Seg testId={`prod-kyc.${d.id}`} value={n.kyc} options={[0, 1, 2, 3].map((k) => ({ v: k as Deployment['kyc'], label: String(k) }))} onChange={(k) => set({ kyc: k })} />
        </div>}
        <div className="pc-row">
          <Tip content={() => <TipCard title={<Term id="effort">Effort</Term>} rows={(['low', 'max', 'deep'] as const).map((e) => ({ label: e === 'deep' ? 'deep think' : e, value: `tokens ×${EFFORT_TOKENS[e]} · fit ${F.num(EFFORT_OOM_PER_10X * Math.log10(EFFORT_TOKENS[e]), 2, true)} OOM` }))}>Reasoning tokens per answer. Price follows cost, so the margin stays; the hours an H100e serves change. Deep think is a feature.</TipCard>}><span className="pc-k">Effort</span></Tip>
          <Seg testId={`prod-effort.${d.id}`} value={n.effort} options={(['low', 'max', 'deep'] as const).map((e) => ({
            v: e, label: e === 'deep' ? 'deep think' : e,
            locked: e === 'deep' ? (effortLock(s, 'deep') ?? (!s.player.features.includes('deepThink') ? 'Build the Deep think feature first' : !FEATURES.find((f) => f.id === 'deepThink')!.products.includes(d.channel) ? 'Not offered on this product' : undefined)) : undefined,
          }))} onChange={(e) => set({ effort: e })} />
        </div>
      </div>

      {editing && draft && <EditPop s={s} d={d} c={draft} close={() => setDraft(null)} />}
    </section>
  );
}

// ───────── serving economics (B1): price vs cost, revenue by source, capacity ─────────
/** Dollars per unit: $0.42, $2.65, $22. */
const usd = (x: number) => `$${x >= 10 ? x.toFixed(0) : x.toFixed(2)}`;
/** Revenue sources of a sector product (fixed colours, colour-blind safe: gold / teal / grey). */
const SRC_COL = { work: '#c9a227', agent: '#3bb3a0', seat: '#8d99a6' } as const;

function Econ({ d, r }: { d: Deployment; r: ProductRead }) {
  return (
    <div className="pc-econ" data-test={`prod-econ.${d.id}`}>
      <PriceRow d={d} r={r} />
      {r.econ.kind === 'chat' ? <PaidRow d={d} r={r} /> : <SourcesRow d={d} r={r} />}
      <CapacityRow d={d} r={r} />
    </div>
  );
}

function PriceRow({ d, r }: { d: Deployment; r: ProductRead }) {
  const e = r.econ;
  const chat = e.kind === 'chat';
  const unit = chat ? '/mo' : '/h';
  const capped = r.valueCapped > 0.05;
  const max = Math.max(1e-9, chat ? Math.max(r.price, e.wtp) : r.price);
  const asked = r.cost * r.markup;
  const none = !(r.price > 0);
  return (
    <Tip as="div" content={() => <TipCard title={<Term id={chat ? 'wtp' : 'markup'}>{chat ? 'Price per subscriber-month' : 'Price per hour of use'}</Term>} value={none ? 'no sales' : `${usd(r.price)}${unit}`} rows={[
      { label: chat ? 'Serving cost of a subscriber-month' : 'Serving cost per hour', value: `${usd(r.cost)}${unit}` },
      chat
        ? { label: <><Term id="priceTier">{TIER_LABEL[d.price]}</Term> plan</>, value: `${usd(consumerPlanPrice(r.markup))}/mo` }
        : { label: <><Term id="priceTier">{TIER_LABEL[d.price]}</Term> <Term id="markup">markup</Term></>, value: `×${r.markup.toFixed(2)} → asks ${usd(asked)}${unit}` },
      { label: 'Margin', value: F.pct(r.margin), tone: r.margin > 0 ? 'pos' : 'neutral' },
      ...(chat ? [
        { label: <Term id="wtp">Willingness to pay</Term>, value: `${usd(e.wtp)}/mo${capped ? ' · binds' : ''}`, tone: (capped ? 'neg' : 'neutral') as 'neg' | 'neutral' },
        { label: <Term id="goingPrice">Going price</Term>, value: `${usd(e.going)}/mo` },
      ] : [
        ...(e.adoptedHours > 0 ? [{ label: <Term id="adoptedHour">Adopted task-hour</Term>, value: `${usd(e.adoptedPrice)}/h` }] : []),
        ...(e.agentHours > 0 ? [{ label: <Term id="agentHour">Agent-hour</Term>, value: `${usd(e.agentPrice)}/h` }] : []),
        { label: <Term id="valueCap">Sold at the value cap</Term>, value: F.pct(r.valueCapped), tone: (capped ? 'neg' : 'neutral') as 'neg' | 'neutral' },
      ]),
      { label: 'Rule', value: <Limit id="price.valueCap" tone={capped ? 'warn' : 'quiet'}>price ≤ value</Limit> },
    ]} footer={chat ? 'Per-seat and per-hour pricing: API, Agents, Enterprise.' : 'Blended over adopted task-hours and agent-hours; seats are priced per seat-month (Sources).'}>
      {chat ? 'A flat monthly plan at the market\'s price: the willingness to pay on Standard and Premium, less on Budget; never below a paying user\'s serving cost. Margin = price − serving cost.' :'The tokens an hour of use takes × their serving cost × the tier\'s markup, never above the value of the hour.'}
    </TipCard>}>
      <div className="ec-row" data-test={`prod-price-row.${d.id}`}>
        <span className="ec-k">Price</span>
        <b className="ec-v">{none ? '—' : `${usd(r.price)}${unit}`}</b>
        <span className="ec-bar">
          <i style={{ width: `${(Math.min(r.cost, r.price) / max) * 100}%`, background: 'var(--line-2)' }} />
          <i style={{ width: `${(Math.max(0, r.price - r.cost) / max) * 100}%`, background: capped ? C.watch : C.good }} />
          {chat && <em style={{ left: `${(e.wtp / max) * 100}%` }} />}
        </span>
        <span className="ec-n">{none ? '' : F.pct(r.margin)}</span>
      </div>
      {capped && <Limit id="price.valueCap" tone="warn">{chat ? `at the ${usd(e.wtp)} cap` : `${F.pct(r.valueCapped)} sold at the value cap`}</Limit>}
    </Tip>
  );
}

function SourcesRow({ d, r }: { d: Deployment; r: ProductRead }) {
  const e = r.econ;
  const parts = [
    { k: 'work' as const, v: e.adoptedDemand, term: 'adoptedHour', label: 'work' },
    { k: 'agent' as const, v: e.agentDemand, term: 'agentHour', label: 'agents' },
    { k: 'seat' as const, v: e.seatDemand, term: 'paidSeat', label: 'seats' },
  ].filter((x) => x.v > 1e-6);
  const tot = parts.reduce((a, x) => a + x.v, 0);
  return (
    <Tip as="div" content={() => <TipCard title="Revenue by source" value={F.money(tot, { perYear: true })} rows={[
      { label: <Term id="adoptedHour">Adopted task-hours</Term>, value: e.adoptedHours > 0 ? `${F.count(e.adoptedHours)} h × ${usd(e.adoptedPrice)} = ${F.money(e.adoptedDemand)}` : 'none' },
      { label: <Term id="agentHour">Agent-hours</Term>, value: e.agentHours > 0 ? `${F.count(e.agentHours)} h × ${usd(e.agentPrice)} = ${F.money(e.agentDemand)}` : 'none' },
      { label: <Term id="paidSeat">Paid seats</Term>, value: e.seats >= 1 ? `${F.count(e.seats)} × ${usd(e.seatPrice)}/mo = ${F.money(e.seatDemand)}` : 'none' },
      ...(e.seats >= 1 ? [{ label: 'Serving cost per seat-month', value: usd(e.seatCost) }] : []),
    ]} footer="Demand a year, before the serving cut.">
      {d.channel === 'enterprise' || d.channel === 'gov'
        ? 'Seats: workers on a paid plan, a flat price per month. [[unseatedUse|Unseated use]] pays nothing. Agent-hours: [[supervisingHour|supervising hours]] × coverage × [[agentLeverage|agent leverage]].'
        : 'Work billed per hour. Agent-hours: [[supervisingHour|supervising hours]] × coverage × [[agentLeverage|agent leverage]]; they add spend and serving need, never human hours. Seats are sold by Enterprise and Gov.'}
    </TipCard>}>
      <div className="ec-row" data-test={`prod-sources.${d.id}`}>
        <span className="ec-k">Sources</span>
        <span className="ec-bar wide">
          {parts.map((x) => <i key={x.k} data-src={x.k} style={{ width: `${(x.v / Math.max(1e-9, tot)) * 100}%`, background: SRC_COL[x.k] }} />)}
        </span>
      </div>
      <div className="ec-leg">
        {parts.length ? parts.map((x) => <span key={x.k}><i style={{ background: SRC_COL[x.k] }} /><Term id={x.term}>{x.label}</Term> {F.pct(x.v / tot)}</span>) : <span className="dim">no sales yet</span>}
      </div>
    </Tip>
  );
}

function PaidRow({ d, r }: { d: Deployment; r: ProductRead }) {
  const e = r.econ;
  const max = Math.max(0.08, e.paidShare, e.paidTarget) * 1.15;
  const up = e.paidTarget > e.paidShare + 0.0005;
  const dn = e.paidTarget < e.paidShare - 0.0005;
  return (
    <Tip as="div" content={() => <TipCard title={<Term id="paidShare">Paid share</Term>} value={F.pct(e.paidShare, 1)} rows={[
      { label: 'Target (≈ 8 weeks)', value: F.pct(e.paidTarget, 1), tone: up ? 'pos' : dn ? 'neg' : 'neutral' },
      { label: 'Subscribers', value: F.count(r.subs ?? 0) },
      { label: 'Your price vs the going price', value: `${usd(r.price)} vs ${usd(e.going)}/mo` },
      { label: 'Subscriptions', value: F.money(r.demand, { perYear: true }) },
    ]}>{'Subscribers × price × 12 is Chat\'s only revenue. The target rises with your model\'s coverage of chat and with a price below the [[goingPrice|going price]]; above the [[wtp|willingness to pay]] nobody subscribes.'}</TipCard>}>
      <div className="ec-row" data-test={`prod-paid.${d.id}`}>
        <span className="ec-k">Paid</span>
        <b className="ec-v">{F.pct(e.paidShare, 1)}</b>
        <span className="ec-bar">
          <i style={{ width: `${(e.paidShare / max) * 100}%`, background: SRC_COL.work }} />
          <em style={{ left: `${(e.paidTarget / max) * 100}%` }} />
        </span>
        <span className={`ec-n ${up ? 'tone-pos' : dn ? 'tone-neg' : ''}`}>→ {F.pct(e.paidTarget, 1)}</span>
      </div>
    </Tip>
  );
}

function CapacityRow({ d, r }: { d: Deployment; r: ProductRead }) {
  const e = r.econ;
  const chat = e.kind === 'chat';
  const need = r.needH100e;
  if (!(need > 0)) return null;
  const cut = Math.min(need, r.cutH100e);
  const served = need - cut;
  // Segments in serve order: seats then per-hour work (sector), paying then free users (Chat); the cut comes off the end.
  const segs = chat
    ? [{ k: 'paid', v: e.needPaid - e.cutPaid, col: SRC_COL.work }, { k: 'free', v: e.needFree - e.cutFree, col: '#6b7785' }]
    : [{ k: 'seat', v: Math.min(e.needSeat, served), col: SRC_COL.seat }, { k: 'work', v: Math.max(0, served - e.needSeat), col: SRC_COL.work }];
  const fullyServed = cut < need * 0.005;
  return (
    <Tip as="div" content={() => <TipCard title={<Term id="serveOrder">Capacity</Term>} value={fullyServed ? 'all served' : `${F.pct(served / need)} served`} rows={chat ? [
      { label: 'Paying users need', value: `${F.h100e(e.needPaid)} H100e` },
      { label: <Term id="freeTier">Free users need</Term>, value: `${F.h100e(e.needFree)} H100e` },
      { label: <Term id="servingCut">Cut</Term>, value: cut > 0 ? `${F.h100e(e.cutFree)} free · ${F.h100e(e.cutPaid)} paying` : 'none', tone: cut > 0 ? 'neg' : 'neutral' },
    ] : [
      { label: 'Hours asked a year', value: `${F.count(e.askedHours)} h` },
      { label: 'Servable on its serving', value: `${F.count(r.capHours)} h`, tone: r.capHours < e.askedHours * 0.995 ? 'neg' : 'neutral' },
      ...(e.needSeat > 0 ? [{ label: <Term id="paidSeat">Seats need (first)</Term>, value: `${F.h100e(e.needSeat)} H100e` }] : []),
      { label: 'Per-hour work needs', value: `${F.h100e(e.needWork)} H100e` },
      { label: <Term id="servingCut">Cut</Term>, value: cut > 0 ? `${F.h100e(cut)} H100e` : 'none', tone: cut > 0 ? 'neg' : 'neutral' },
    ]} footer="Serving budget: Compute › Split.">
      {chat ? 'Paying users are served first. [[freeTier|Free users]] are served last; unserved users leave for rivals, which costs subscribers.' : 'Seats are served before per-hour work (a seat earns more per H100e). Unserved buyers drift to rivals.'}
    </TipCard>}>
      <div className="ec-row" data-test={`prod-capacity.${d.id}`}>
        <span className="ec-k">Served</span>
        <span className="ec-bar wide">
          {segs.map((x) => x.v > 0 && <i key={x.k} data-seg={x.k} style={{ width: `${(x.v / need) * 100}%`, background: x.col }} />)}
          {cut > 0 && <i className="cut" data-seg="cut" style={{ width: `${(cut / need) * 100}%` }} />}
        </span>
        <span className={`ec-n ${fullyServed ? '' : 'tone-neg'}`}>{fullyServed ? 'all' : F.pct(served / need)}</span>
      </div>
    </Tip>
  );
}

// ───────── lineup (TIERS): the tiers a sector product sells, one row each ─────────
/** Tier colours: the product hue, lighter for smaller tiers (order = size). */
const TIER_COL = ['#c9a227', '#a98d3a', '#8a7a52', '#6b6a66', '#8d99a6'];
/** "1/80" for a size ratio. */
const frac = (r: number) => `1/${r > 0.2 ? (1 / r).toFixed(1) : Math.round(1 / r)}`;
const paramsTxt = (n: number) => (n >= 1e12 ? `${(n / 1e12).toFixed(1)}T` : `${n >= 1e10 ? Math.round(n / 1e9) : (n / 1e9).toFixed(1)}B`);
const tierName = (x: LineupRow) => (x.kind === 'student' ? `student ${frac(x.ratio)}` : x.name);

function Lineup({ d, r, rows }: { d: Deployment; r: ProductRead; rows: LineupRow[] }) {
  const sold = rows.filter((x) => x.share > 0.005).length;
  return (
    <div className="pc-line" data-test={`prod-lineup.${d.id}`}>
      <Tip as="div" content={() => <TipCard title={<Term id="lineup">Lineup</Term>} value={`${rows.length} tiers · ${sold} selling`} rows={rows.map((x, k) => ({
        label: <span><i className="tl-sw" style={{ background: TIER_COL[k] ?? TIER_COL[4] }} />{tierName(x)}</span>, value: `${F.pct(x.share)} of hours`,
      }))} footer={`Price tier ${TIER_LABEL[d.price]}: every tier at ×${r.markup.toFixed(2)} its serving cost.`}>
        {'Your main model and distilled students of it. In each band of task difficulty buyers take the tier with the best surplus among every provider\'s tiers: cheap tiers sell on easy work, the main model keeps the work only it does. Every lab sells the same [[lineup]].'}
      </TipCard>}>
        <div className="tl-h"><span className="ec-k">Lineup</span><span className="sp" /><span><Term id="fit">fit</Term></span><span>price</span><span>sold</span></div>
      </Tip>
      {rows.map((x, k) => (
        <Tip as="div" key={k} content={() => <TipCard title={x.kind === 'student' ? <><Term id="cheapTier">Student</Term> of {rows[0].name}</> : x.kind === 'mini' ? <><Term id="cheapTier">Mini</Term> {x.name}</> : <>Main model {x.name}</>} value={`${F.pct(x.share, 1)} of hours`} rows={[
          { label: 'Active parameters', value: `${paramsTxt(x.params)}${x.kind !== 'model' ? ` (${frac(x.ratio)} of the main model)` : ''}` },
          { label: x.kind === 'student' ? <Term id="distillGap">Fit below the main model</Term> : <Term id="fit">Fit below the main model</Term>, value: x.kind === 'model' ? '—' : `${F.num(x.gap, 2)} OOM` },
          { label: 'Price per billed hour', value: `${usd(x.price)}/h${x.hours > 0 ? '' : ' (if sold)'}` },
          { label: 'Billed hours a year', value: x.hours > 0 ? `${F.count(x.hours)} h` : 'none' },
        ]} footer={x.kind === 'student' ? 'Sold under every main model by the same rule: no distil run needed.' : undefined}>
          {x.kind === 'model' ? 'Does the hardest tasks the product sells.' : x.share > 0.005 ? 'Sells where it does the task at a lower price than any tier that does more.' : 'Sells nothing now: on the work it does, another tier (yours or a rival\'s) gives buyers more surplus.'}
        </TipCard>}>
          <div className="tl-row" data-test={`prod-tier.${d.id}.${k}`}>
            <span className="tl-nm"><i className="tl-sw" style={{ background: TIER_COL[k] ?? TIER_COL[4] }} />{tierName(x)}</span>
            <span className="tl-n dim">{x.kind === 'model' ? '' : F.num(-x.gap, 2, true)}</span>
            <span className="tl-n">{usd(x.price)}</span>
            <span className="ec-bar tl-bar"><i style={{ width: `${Math.min(1, x.share) * 100}%`, background: TIER_COL[k] ?? TIER_COL[4] }} /></span>
            <span className="tl-n">{F.pct(x.share)}</span>
          </div>
        </Tip>
      ))}
    </div>
  );
}

// ───────── customers (B2): the stock vs its target share, speed and days to converge ─────────
const REGION_NAME: Record<string, string> = { US: 'US', CN: 'China', ROW: 'Rest of world' };
const SECTOR_NAME = Object.fromEntries(SECTORS.map((x) => [x.id, x.name])) as Record<string, string>;
/** Speed class of a time constant (days): consumers weeks, sectors months, government and defence contract cycles. */
const speedOf = (days: number) => (days < 60 ? { word: 'weeks', who: 'Consumers' } : days < 255 ? { word: 'months', who: 'Sector buyers (API, Agents, Enterprise)' } : { word: 'quarters', who: 'Government & defence' });
const tauText = (days: number) => (days < 60 ? `${Math.round(days / 7)} wk` : `${Math.round(days / 30.4)} mo`);
const convText = (c: CustomerView) => (c.days === 0 ? 'at target' : Number.isFinite(c.days) ? `~${F.days(c.days)} to target` : '> 3 yr to target');

function Customers({ s, d, r }: { s: GameStateV2; d: Deployment; r: ProductRead }) {
  const c = r.cust;
  const erosion = s.world.fx.capPenalty[d.channel === 'consumer' ? 'consumer' : 'sector'];
  const max = Math.max(c.stock, c.target, r.rival?.share ?? 0, 0.01);
  const up = c.target > c.stock + 0.0005;
  const dn = c.target < c.stock - 0.0005;
  const def = PRODUCT_DEFS[d.channel];
  const spd = speedOf(c.taus[0]?.days ?? 0);
  const chat = d.channel === 'consumer';
  return (
    <div className="pc-share" data-test={`prod-cust.${d.id}`}>
      <Tip as="div" content={() => <TipCard title={<Term id="customerStock">Customers</Term>} value={`${F.pct(c.stock, 1)} of ${def?.segment ?? 'spend'}`} rows={[
        { label: <Term id="targetShare">Target share</Term>, value: F.pct(c.target, 1), tone: up ? 'pos' : dn ? 'neg' : 'neutral' },
        ...(r.rival ? [{ label: <>Best rival: {r.rival.name}</>, value: F.pct(r.rival.share, 1) }] : []),
        { label: 'This product\'s demand', value: F.money(r.demand, { perYear: true }) },
        ...c.movers.map((m) => ({ label: <span className="dim">{REGION_NAME[m.r] ?? m.r} · {m.seg === 'consumer' ? 'chat users' : SECTOR_NAME[m.seg] ?? m.seg}</span>, value: `${F.pct(m.stock, 1)} → ${F.pct(m.target, 1)}` })),
      ]} footer="Weighted by each segment's spend; all your products together.">
        {'Your [[segmentShare|share of the spend]] here is a [[customerStock|stock]]: in each region and sector it moves toward its [[targetShare|target share]] (fit, price, brand, access) at the segment\'s [[customerSpeed|speed]], so a release or a price change pays off over weeks to months.'}
      </TipCard>}>
        <div className="pc-cap"><Term id="customerStock">Customers</Term><span className="dim">· {def?.segment}</span></div>
        <div className="sh cu" data-test={`prod-cust-stock.${d.id}`}>
          <span className="who">You</span>
          <span className="b"><i style={{ width: `${(c.stock / max) * 100}%`, background: C.you }} /><em style={{ left: `${(c.target / max) * 100}%` }} /></span>
          <span className="n">{F.pct(c.stock)}<span className={up ? 'tone-pos' : dn ? 'tone-neg' : 'dim'}> → {F.pct(c.target)}</span></span>
        </div>
        {r.rival && <div className="sh cu"><span className="who">{r.rival.name}</span><span className="b"><i style={{ width: `${(r.rival.share / max) * 100}%`, background: C.rival }} /></span><span className="n">{F.pct(r.rival.share)}</span></div>}
      </Tip>
      {chat && (
        <Tip as="div" content={() => <TipCard title="Weekly users" value={F.count(c.users ?? 0)} rows={[
          { label: <Term id="targetShare">At the target share</Term>, value: F.count(c.usersTarget ?? 0), tone: (c.usersTarget ?? 0) > (c.users ?? 0) * 1.005 ? 'pos' : (c.usersTarget ?? 0) < (c.users ?? 0) * 0.995 ? 'neg' : 'neutral' },
          { label: 'Paying subscribers', value: F.count(r.subs ?? 0) },
          { label: <Term id="freeTier">Free users</Term>, value: F.count(Math.max(0, (r.users ?? 0) - (r.subs ?? 0))) },
        ]}>{'Users = online adults × [[weeklyReach|weekly reach]] × your share of chat users (the [[customerStock|customer stock]]). Subscribers = users × your [[paidShare|paid share]].'}</TipCard>}>
          <div className="pc-cust" data-test={`prod-users.${d.id}`}><Users size={12} /><b>{F.count(c.users ?? 0)}</b> weekly users<span className="dim">→ {F.count(c.usersTarget ?? 0)}</span></div>
        </Tip>
      )}
      <Tip as="div" content={() => <TipCard title={<Term id="customerSpeed">Customer speed</Term>} value={convText(c)} rows={[
        ...c.taus.map((x) => ({ label: speedOf(x.days).who, value: `τ ${tauText(x.days)}${c.taus.length > 1 ? ` · ${F.pct(x.w)} of spend` : ''}` })),
        { label: 'Now → target', value: `${F.pct(c.stock, 1)} → ${F.pct(c.target, 1)}`, tone: up ? 'pos' : dn ? 'neg' : 'neutral' },
        { label: 'Counts as reached', value: `within ${F.num(CONVERGED * 100, 1)} pp` },
      ]} footer="Assumes the target holds; your releases, rivals' releases and price changes move it.">
        {'Each day the stock closes 1/τ of its gap to the [[targetShare|target]]: consumers switch in weeks, developers and firms over months, government and defence over contract cycles.'}
      </TipCard>}>
        <div className="cu-conv" data-test={`prod-cust-conv.${d.id}`}><Clock3 size={11} /><span>moves in {spd.word}</span><span className="sp" /><span className={c.days === 0 ? 'dim' : ''}>{convText(c)}</span></div>
      </Tip>
      {erosion > 0.005 && <Limit id="product.erosion" tone={erosion >= PENALTY_MAX - 1e-6 ? 'bind' : 'warn'}>capacity-bound: share −{F.pct(erosion)} (max {F.pct(PENALTY_MAX)})</Limit>}
    </div>
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

// ───────── features (B2): type, typed effect, cost, upkeep, on here, internal use, gate ─────────
/** One icon per feature type: DoorOpen enabler, Ruler horizon extender (task length), Blocks scaffold, BrainCog effort. */
const FT_ICON: Record<FeatureKind, LucideIcon> = { enabler: DoorOpen, horizon: Ruler, scaffold: Blocks, effort: BrainCog };
const FT_TERM: Record<FeatureKind, string> = { enabler: 'featEnabler', horizon: 'featHorizon', scaffold: 'featScaffold', effort: 'featEffort' };
const FT_LABEL: Record<FeatureKind, string> = { enabler: 'enabler', horizon: 'horizon', scaffold: 'scaffold', effort: 'effort' };

function Features({ s, d }: { s: GameStateV2; d: Deployment }) {
  const feats = FEATURES.filter((f) => f.products.includes(d.channel));
  const etas = buildEtas(s).etas;
  return (
    <div className="pc-feat" data-test={`prod-feats.${d.id}`}>
      <div className="pc-cap"><Term id="feature">Features</Term><span className="sp" /><Tip content={() => <TipCard title="Built once, on here">Engineers build a feature once for the whole lab; switch it on for each product that offers it. Scaffolds and horizon extenders also help your internal agents once built.</TipCard>}><span className="dim">built once · on here</span></Tip></div>
      {feats.map((f) => <FeatureRow key={f.id} s={s} d={d} f={f} eta={etas.get(s.player.build.queue.find((it) => it.kind === 'feature' && it.ref === f.id)?.id ?? '')} />)}
    </div>
  );
}

/** The feature's tooltip: typed effects with units, tokens, build cost, upkeep, on here, internal use, gate, risk. */
function FeatureTip({ s, d, f }: { s: GameStateV2; d: Deployment; f: FeatureDef }) {
  const v = featureView(f, d.channel);
  const built = s.player.features.includes(f.id);
  const on = d.features.includes(f.id);
  const tok = v.lines.reduce((a, l) => Math.max(a, l.tokens), 1);
  const gate = f.node ? TREE_BY_ID[f.node]?.name ?? f.node : undefined;
  return <TipCard title={f.name} value={v.kinds.map((k) => FT_LABEL[k]).join(' + ')} rows={[
    ...v.lines.map((l) => ({ label: <><Term id={FT_TERM[l.kind]}>{FT_LABEL[l.kind]}</Term> <span className="dim">· {l.where}</span></>, value: `${l.effect}${l.tokens !== 1 ? ` · ${l.kind === 'effort' ? 'reasoning tokens' : 'tokens'} ×${l.tokens}` : ''}${l.here ? '' : ' (not on this product)'}` })),
    ...(f.id === 'sectorPacks' ? [{ label: 'Build', value: 'per pack: 4 engineer team-weeks + $0.4B, then 120 d certification' }] : [{ label: 'Build', value: `${f.buildTW} engineer team-weeks · ${F.money(f.cash)}` }]),
    { label: <Term id="productUpkeep">Upkeep</Term>, value: [
      ...(v.upkeepTW > 0 ? [`${v.upkeepTW.toFixed(2)} engineer team-wk/wk${v.idleTW < v.upkeepTW ? ` (${v.idleTW.toFixed(2)} while off everywhere)` : ''}`] : []),
      ...(tok > 1 ? [`serving ×${tok} tokens`] : []),
    ].join(' · ') || 'none' },
    ...(f.id === 'sectorPacks' ? [] : [{ label: 'On this product', value: !built ? 'not built yet' : on ? 'on' : 'off', tone: (built && on ? 'pos' : 'neutral') as 'pos' | 'neutral' }]),
    { label: <Term id="agentPackage">Internal agents</Term>, value: v.internal.length ? `${built ? '' : 'once built: '}${v.internal.join(', ')}` : 'no effect' },
    { label: <Term id="techTree">Unlocked by</Term>, value: gate ? `${gate}${f.node && nodeKnown(s, f.node) ? ' (known)' : ' (not known yet)'}` : 'nothing: buildable now', tone: (gate && f.node && !nodeKnown(s, f.node) ? 'neg' : 'neutral') as 'neg' | 'neutral' },
    ...(f.risk ? [{ label: 'Cost / risk', value: f.risk }] : []),
  ]}>{f.effect}</TipCard>;
}

/** The feature's type chips (icon + word). */
function FeatureKinds({ f, ch }: { f: FeatureDef; ch: Channel }) {
  const ks = featureView(f, ch).kinds;
  return <>{ks.map((k) => { const I = FT_ICON[k]; return <span key={k} className="ft-k" data-kind={k}><I size={10} />{ks.length === 1 && FT_LABEL[k]}</span>; })}</>;
}

/** Type chips and the short typed effect (second line of a feature row). */
function FeatureFxLine({ f, ch, right }: { f: FeatureDef; ch: Channel; right?: ReactNode }) {
  const v = featureView(f, ch);
  return (
    <div className="ft-fx" data-test={`feature-fx.${f.id}`}>
      <FeatureKinds f={f} ch={ch} />
      <span className="ft-e">{v.short}</span>
      {v.internal.length > 0 && <Bot size={10} className="ft-int" data-test={`feature-internal.${f.id}`} />}
      <span className="sp" />{right}
    </div>
  );
}

function FeatureRow({ s, d, f, eta }: { s: GameStateV2; d: Deployment; f: FeatureDef; eta?: number }) {
  const tip = () => <FeatureTip s={s} d={d} f={f} />;
  if (f.id === 'sectorPacks') {
    const secs = d.sectorFocus;
    // J2 P1: packs being built (build queue) before their certification starts.
    const building = s.player.build.queue.filter((it) => it.kind === 'sectorPack' && (it.host ?? d.id) === d.id);
    const etas = buildEtas(s).etas;
    return (
      <div className="ft2" data-feature={f.id}>
        <Tip content={() => <TipCard title={<Term id="sectorPack">Sector packs</Term>} rows={[...secs.map((x) => ({ label: x, value: s.world.fx.certDay[x] !== undefined && s.world.fx.certDay[x]! <= s.time.day ? 'certified' : `certified ${fmtDate(dateOf(s, s.world.fx.certDay[x] ?? s.time.day))}` })), ...building.map((it) => ({ label: it.ref, value: `engineers build it · ${Number.isFinite(etas.get(it.id) ?? Infinity) ? F.days(etas.get(it.id) ?? 0) : 'waits'}, then 120 d certification` }))]}>{f.effect}</TipCard>}>
          <div className="ft"><Layers size={12} /><span className="ft-n">{secs.length ? secs.join(' · ') : 'Sector packs'}{building.length > 0 && <span className="dim" data-test={`prod-pack-building.${d.id}`}> · {building.length} building</span>}</span><span className="sp" />
            <ActBtn id="wfx.sectorProduct" testId={`prod-pack.${d.id}`} params={{ deploymentId: d.id }} label="+ pack" />
          </div>
        </Tip>
        <Tip as="div" content={tip}><FeatureFxLine f={f} ch={d.channel} /></Tip>
      </div>
    );
  }
  const built = s.player.features.includes(f.id);
  const on = d.features.includes(f.id);
  const building = eta !== undefined;
  const known = !f.node || nodeKnown(s, f.node);
  const gate = f.node ? TREE_BY_ID[f.node]?.name ?? f.node : '';
  if (built) return (
    <div className="ft2" data-feature={f.id}><Tip as="div" content={tip}>
      <div className="ft"><Check size={12} className="ok" /><span className="ft-n">{f.name}</span><span className="sp" />
        <ActBtn id="feature.toggle" testId={`feature.toggle.${d.id}.${f.id}`} params={{ product: d.id, feature: f.id, on: !on }} label={<span className={`sw ${on ? 'on' : ''}`}><i /></span>} />
      </div>
      <FeatureFxLine f={f} ch={d.channel} right={<span className={on ? 'ft-on' : 'dim'}>{on ? 'on' : 'off'}</span>} />
    </Tip></div>
  );
  if (building) return (
    <div className="ft2" data-feature={f.id}><Tip as="div" content={tip}>
      <div className="ft dim"><Hammer size={12} /><span className="ft-n">{f.name}</span><span className="sp" /><span className="ft-s">building · {F.days(eta!)}</span></div>
      <FeatureFxLine f={f} ch={d.channel} />
    </Tip></div>
  );
  if (known) return (
    <div className="ft2" data-feature={f.id}><Tip as="div" content={tip}>
      <div className="ft"><ICON.product size={12} className="dim" /><span className="ft-n dim">{f.name}</span><span className="sp" />
        <span className="ft-s dim">{F.money(f.cash)}</span><ActBtn id="feature.build" testId={`feature.build.${f.id}`} params={{ id: f.id }} label="Build" /></div>
      <FeatureFxLine f={f} ch={d.channel} />
    </Tip></div>
  );
  return (
    <div className="ft2" data-feature={f.id}><Tip as="div" content={tip}>
      <button className="ft locked" data-node={f.node} onClick={() => { store.setTab('research.sel', f.node ?? ''); store.goto('research', { tab: 'tree' }); }}>
        <Lock size={11} /><span className="ft-n">{f.name}</span><span className="sp" /><FeatureKinds f={f} ch={d.channel} />
      </button>
      <div className="ft-fx" data-test={`feature-gate.${f.id}`}><ICON.research size={10} /><span className="ft-e">needs {gate}</span></div>
    </Tip></div>
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
          {row(<Tip content={() => <TipCard title={<Term id="targetShare">Target share</Term>}>{'The share your customers move toward. An edit moves the target at once; the [[customerStock|customer stock]] follows at the segment\'s [[customerSpeed|speed]].'}</TipCard>}><span>Target share</span></Tip>, b?.cust.target, a?.cust.target, (x) => F.pct(x, 1))}
          {d.channel === 'consumer' && row('Users at target', b?.cust.usersTarget, a?.cust.usersTarget, (x) => F.count(x))}
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
  const [pick, setPick] = useState<Channel>(missing.find((c) => pendingLaunch(s, c)) ?? missing[0] ?? 'agents');
  const ch = missing.includes(pick) ? pick : missing[0];
  if (!ch) return null;
  const vs = s.player.models.versions.filter((v) => usable(v) && CHANNEL_VARIANTS[ch].includes(v.variant)).sort((a, b) => mL(s, b) - mL(s, a));
  const v = vs[0];
  const imported = s.player.models.versions.some((x) => x.variant === 'imported' && x.status !== 'retired');
  // Jank PR7: say the fix, not just the rule.
  const gate = v ? deployGate(s, v, ch) : `${PRODUCT_DEFS[ch]?.name} needs a ${CHANNEL_VARIANTS[ch].join(' or ')} model${imported ? ': post-train your imported model in Blueprint to sell it' : ': train one in Blueprint'}`;
  const Icon = P_ICON[ch] ?? ICON.product;
  const h = measuredHorizonH(v);
  // J2 P1: a launch is built by the engineers first (build queue).
  const pend = pendingLaunch(s, ch);
  const eta = pend ? buildEtas(s).etas.get(pend.id) : undefined;
  return (
    <section className="pc off" data-test="prod-launch">
      <div className="pc-h">
        <span className="pc-ic"><Icon size={16} /></span>
        <select className="msel nm" data-test="prod-launch-pick" value={ch} onChange={(e) => setPick(e.target.value as Channel)}>
          {missing.map((c) => <option key={c} value={c}>{PRODUCT_DEFS[c]?.name ?? c}{pendingLaunch(s, c) ? ' · building' : ''}</option>)}
        </select>
        <span className="sp" />{pend
          ? <Tip content={() => <TipCard title="Being built" value={eta !== undefined && Number.isFinite(eta) ? `live in ${F.days(eta)}` : 'waits for engineers'} rows={[{ label: 'Work left', value: `${(pend.needTW - pend.doneTW).toFixed(1)} of ${pend.needTW.toFixed(0)} team-weeks` }]}>Engineers build the launch on the <Term id="buildQueue">build queue</Term>; it goes live when built. Build capacity: Company › Agents &amp; teams.</TipCard>}><span className="pc-st" data-test="prod-launch-building"><Hammer size={11} /> {eta !== undefined && Number.isFinite(eta) ? `live in ${F.days(eta)}` : 'waits for engineers'}</span></Tip>
          : <span className="pc-st off">Not launched</span>}
      </div>
      <div className="dim small">{PRODUCT_DEFS[ch]?.blurb}</div>
      {ch === 'agents' && (
        <Tip content={() => <TipCard title={<Term id="timeHorizon">Time horizon</Term>} value={h !== undefined ? F.minutes(h * 60) : 'not measured'} rows={[{ label: 'Needed', value: `${AGENT_TASK_HOURS} h (half-day tasks)` }, { label: 'Model', value: v?.name ?? '—' }]}>{String(agentsGate(v) === true ? 'Covers the tasks Agents sells.' : agentsGate(v))}</TipCard>}>
          <div className="pc-gate" data-test="agents-gate">
            <div className="pc-cap"><Lock size={10} /> Needs</div>
            <div className="gate-row"><Term id="timeHorizon">Time horizon</Term><span className="sp" /><b>{h !== undefined ? F.minutes(h * 60) : '—'}</b><span className="dim"> · needs {AGENT_TASK_HOURS} h</span></div>
            <div className="gate-bar"><i style={{ width: `${Math.min(100, ((h ?? 0) / (AGENT_TASK_HOURS * 1.5)) * 100)}%`, background: (h ?? 0) >= AGENT_TASK_HOURS ? C.good : C.cap }} /><em style={{ left: `${(1 / 1.5) * 100}%` }} /></div>
            <div className="dim small">{v?.name ?? 'no model'} · measured</div>
          </div>
        </Tip>
      )}
      <div className="sp-v" />
      {pend
        ? <ActBtn id="build.cancel" testId={`product.launch.cancel.${ch}`} params={{ id: pend.id }} label="Cancel launch" />
        : <ActBtn id="product.launch" testId={`product.launch.${ch}`} params={{ channel: ch, ...(v ? { versionId: v.id } : {}) }} label={<>Launch {PRODUCT_DEFS[ch]?.name} <span className="dim">· {LAUNCH_TW} t-wk</span></>} block={gate === true ? undefined : gate} reason />}
      {!v && <button className="btn btn-sm btn-ghost" data-go="blueprint" onClick={() => store.goto('blueprint')}>Blueprint ›</button>}
    </section>
  );
}

// ───────── serving card ─────────
function ServingCard({ s, live, reads }: { s: GameStateV2; live: Deployment[]; reads: Map<string, ProductRead> }) {
  const pool = servingPool(s);
  const rows = live.map((d) => ({ d, r: reads.get(d.id) })).filter((x) => x.r) as { d: Deployment; r: ProductRead }[];
  const cut = rows.reduce((a, x) => a + x.r.cutH100e, 0);
  // J2 PR1: each product uses up to its need; the rest of the pool is spare (research agents by default).
  const used = (r: ProductRead) => Math.min(r.servedH100e, r.needH100e);
  const spare = spareServing(s);
  const lent = spareServingToResearch(s) > 0 || s.player.policies.spareServing !== 'headroom';
  // F6b: the bar is the pool; demand it cannot meet is a line under it (inline it squeezed the products to '…' at the start).
  const total = Math.max(1, rows.reduce((a, x) => a + used(x.r), 0) + spare);
  const agentPool = s.player.computeOnline * s.player.split.agents;
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
          <Tip key={d.id} className="sv-w" style={{ width: `${(used(r) / total) * 100}%` }} content={() => <TipCard title={PRODUCT_DEFS[d.channel]?.name ?? d.channel} rows={[
            { label: 'Needs', value: `${F.h100e(r.needH100e)} H100e` }, { label: 'Uses', value: `${F.h100e(used(r))} H100e` },
            { label: <Term id="revPerH100e">Revenue per H100e</Term>, value: rate(r.rpH) },
            { label: <Term id="servingCut">Cut</Term>, value: r.cutH100e > 0 ? `${F.h100e(r.cutH100e)} H100e` : 'none', tone: r.cutH100e > 0 ? 'neg' : 'neutral' },
          ]} />}>
            <span className={`sv-seg ${r.bound === 'capacity' ? 'cap' : ''}`} data-serve={d.id}><b>{F.h100e(used(r))}</b></span>
          </Tip>
        ))}
        {spare > 0.5 && <Tip className="sv-w" style={{ width: `${(spare / total) * 100}%` }} content={() => <TipCard title={<Term id="spareServing">Spare serving</Term>} value={`${F.h100e(spare)} H100e`} rows={[
          { label: lent ? 'Runs research agents' : 'Kept as headroom', value: lent ? `+${F.pct(spare / Math.max(1, agentPool))} on the agent pool` : 'on the products' },
          { label: 'Eroded share wins back', value: lent ? `${F.pct(LENT_RECOVERY)} speed (products take it back first)` : 'full speed' },
        ]}>Serving compute no product needs today. Policy: Compute › Split; research-speed effect: Company › Flow.</TipCard>}>
          <span className="sv-seg spare" data-test="serving-spare" style={{ background: lent ? '#b28cf0' : undefined, color: lent ? '#1b2430' : undefined }}><b>{F.h100e(spare)}</b></span>
        </Tip>}
      </div>
      <div className="sv-leg">
        {rows.map(({ d, r }) => <span key={d.id} className="sv-l" style={{ width: `${(used(r) / total) * 100}%` }}>{PRODUCT_DEFS[d.channel]?.name}{r.bound === 'capacity' && <span className="tone-neg"> · capacity-bound</span>}</span>)}
        {spare > 0.5 && <span className="sv-l" style={{ width: `${(spare / total) * 100}%` }}>{lent ? 'spare → research' : 'headroom'}</span>}
      </div>
      <div className="sv-cutrow">
        {cut > 0 && <Tip content={() => <TipCard title={<Term id="servingCut">Cut by Auto</Term>} value={`${F.h100e(cut)} H100e`} rows={rows.filter((x) => x.r.cutH100e > 0).map((x) => ({ label: PRODUCT_DEFS[x.d.channel]?.name ?? x.d.channel, value: `${F.h100e(x.r.cutH100e)} H100e · ${F.money(x.r.unserved, { perYear: true })}`, tone: 'neg' as const }))}>Demand the serving pool cannot meet. {auto ? 'Auto cut the products earning least per H100e.' : 'Your shares leave it unserved.'}</TipCard>}>
          <span className="sv-cut" data-test="serving-cut">+{F.h100e(cut)} H100e of demand {auto ? 'cut by Auto' : 'unserved'} <span className="dim">(×{F.num(cut / Math.max(1, pool), 1)} the pool)</span></span>
        </Tip>}
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
