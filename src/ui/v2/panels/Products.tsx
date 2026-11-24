// PRODUCTS (UB-A; mockups design/ux/mockups/rd/products.png, products-drawer.png; DATA-a.md; UI-IA §PRODUCTS).
// L1 #1: revenue from products (total, its trend since the peak, one row per product: served vs wanted-not-served,
// Limited by and where buyers are heading). L1 #2: one card per live product: lineup (real models, skill on tests,
// hours sold, price), tools (where each helps, cost per task), customers (share now → where buyers are heading, best
// rival), sector certification, price (live edits with a before → after preview); the Agents card
// while not launched (ready to launch?). L2: the product drawer (customers by sector, Limited by in words, what could
// win buyers back, sold in a year, safeguards on the product, retire); Policies; lineup and tool editors. L3: tooltips.
// One home per datum: serving compute lives on LAB (the header link); misuse risk on SAFETY › Risks.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Blocks, Bot, Brain, BrainCircuit, Building2, Check, ChevronRight, Code, DoorOpen, Eye, Gauge, Hammer, Lock, MessageCircle,
  Minus, MousePointer2, Pencil, Plus, Rocket, Ruler, Server, Shield, ShieldCheck, SlidersHorizontal, SquareTerminal, Telescope, Users, X,
  type LucideIcon,
} from 'lucide-react';
import { CHANNEL_PRICE, FEATURES, PRICE_TIER_IDS, PRODUCT_DEFS, PRODUCT_ORDER, enablerNeed, type FeatureDef } from '../../../data/v2/features';
import { MARKUP, consumerPlanPrice } from '../../../data/v2/serving';
import { SECTORS } from '../../../data/v2/sectors';
import { TREE_BY_ID } from '../../../data/v2/tree';
import { MONITOR_AUTO } from '../../../data/v2/agents';
import { productMonitorVersion } from '../../../engine/v2/models/products';
import {
  CHANNEL_VARIANTS, buildEtas, deployGate, catchRate, dateOf, editBlock, editedProduct, fmtDate, fmtMonth, isProduct,
  featureView, toolRivalsView, measuredLOf, nodeKnown, previewEdit, productReadouts, servingPool, versionById,
  pendingLaunch, idleServing, charterHolds, freeTierVersion, ADAPT_TW, adaptationsBuilding, CERT_CASH, CERT_DAYS, CERT_FRICTION_CUT, certified,
  demandModifiers, PENALTY_MAX, revenueTrend, customerDrift, limitReason, agentsReady, winBack,
} from '../../../engine/v2';
import type { Channel, Deployment, FeatureKind, GameStateV2, ModelVersion, PriceTier, ProductChanges, ProductRead } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { ActBtn, Limit, Seg, Term, Tip, TipCard, type Params } from '../ui';
import { PanelHead, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import './products.css';
import { PkgChip } from './chips';

const P_ICON: Partial<Record<Channel, LucideIcon>> = { consumer: MessageCircle, api: SquareTerminal, enterprise: Building2, vetted: ShieldCheck };
/** Who buys, and how (the card's header line). */
const P_WHO: Partial<Record<Channel, string>> = { consumer: 'people, by subscription', api: 'developers, by task', enterprise: 'companies, by seat and by task', vetted: 'government, defence and regulated firms, by contract' };
const SG_LABEL: Record<Deployment['safeguards'], string> = { minimal: 'Minimal', standard: 'Standard', classifiers: 'Classifiers', hardened: 'Hardened' };
const TIER_LABEL: Record<PriceTier, string> = { budget: 'Low', standard: 'Standard', premium: 'Premium' };
const BOUND_WORD: Record<string, string> = { capacity: 'serving compute', quality: 'quality', price: 'price', demand: 'demand' };
/** VOCAB §PRODUCTS: player names of the tools whose engine names differ. */
const TOOL_NAME: Record<string, string> = { deepResearch: 'Research mode', codingAgent: 'Coding harness' };
const TOOL_ICON: Record<string, LucideIcon> = { memory: BrainCircuit, deepResearch: Telescope, codingAgent: Code, computerUse: MousePointer2, voiceVision: Eye, companion: MessageCircle };
const toolName = (f: FeatureDef) => TOOL_NAME[f.id] ?? f.name;
const SECTOR_NAME = Object.fromEntries(SECTORS.map((x) => [x.id, x.name])) as Record<string, string>;
const CERT_SECTOR_IDS = ['FIN', 'HEALTH', 'GOV', 'MIL'];
const usable = (v: ModelVersion) => v.status === 'ready' || v.status === 'deployed';
const nameOf = (s: GameStateV2, id?: string) => (id === MONITOR_AUTO ? 'auto (most capable trusted)' : id ? versionById(s, id)?.name ?? id : '—');
const mL = (s: GameStateV2, v?: ModelVersion) => measuredLOf(s, v).L;
const pname = (ch: Channel) => PRODUCT_DEFS[ch]?.name ?? ch;
/** Dollars per unit: $0.21, $1.61, $22. */
const usd = (x: number) => `$${x >= 10 ? x.toFixed(0) : x.toFixed(2)}`;
/** Time to target in words ("~2 yr", "~8 mo"). */
const about = (d: number) => (d >= 330 ? `~${Math.round(d / 365)} yr` : d >= 45 ? `~${Math.round(d / 30.4)} mo` : `~${Math.max(1, Math.round(d / 7))} wk`);
const weeks = (w: number) => (!Number.isFinite(w) ? 'no engineers spare' : w < 1.5 ? '~1 wk' : `~${Math.round(w)} wk`);
const DRAWER = 'products.drawer';

/** Action params of a draft edit. */
function editParams(id: string, c: ProductChanges): Params {
  const p: Params = { id };
  if (c.versionId) p.versionId = c.versionId;
  if (c.lineup !== undefined) p.lineup = c.lineup.join(',');
  if (c.freeTierId !== undefined) p.freeTierId = c.freeTierId ?? '';
  if (c.monitorId !== undefined) p.monitorId = c.monitorId ?? '';
  if (c.price) p.price = c.price;
  if (c.safeguards) p.safeguards = c.safeguards;
  if (c.kyc !== undefined) p.kyc = c.kyc;
  if (c.features) p.features = c.features.join(',');
  return p;
}

/** What a draft changes, as "label: before → after" lines. */
function changeLines(s: GameStateV2, d: Deployment, c: ProductChanges): { k: string; from: string; to: string }[] {
  const n = editedProduct(d, c);
  const out: { k: string; from: string; to: string }[] = [];
  if (n.versionId !== d.versionId) out.push({ k: 'Model', from: nameOf(s, d.versionId), to: nameOf(s, n.versionId) });
  const lineTxt = (x: Deployment) => (x.lineup?.length ? x.lineup.map((id) => nameOf(s, id)).join(', ') : 'main model only');
  if ((n.lineup ?? []).join() !== (d.lineup ?? []).join()) out.push({ k: 'Lineup', from: lineTxt(d), to: lineTxt(n) });
  if (n.freeTierId !== d.freeTierId) out.push({ k: 'Free tier', from: d.freeTierId ? nameOf(s, d.freeTierId) : 'cheapest', to: n.freeTierId ? nameOf(s, n.freeTierId) : 'cheapest' });
  if (n.monitorId !== d.monitorId) out.push({ k: 'Monitor', from: d.monitorId ? nameOf(s, d.monitorId) : 'none', to: n.monitorId ? nameOf(s, n.monitorId) : 'none' });
  if (n.price !== d.price) out.push({ k: 'Price', from: TIER_LABEL[d.price], to: TIER_LABEL[n.price] });
  if (n.safeguards !== d.safeguards) out.push({ k: 'Safeguards', from: SG_LABEL[d.safeguards], to: SG_LABEL[n.safeguards] });
  if (n.kyc !== d.kyc) out.push({ k: 'KYC', from: String(d.kyc), to: String(n.kyc) });
  const fOn = n.features.filter((f) => !d.features.includes(f));
  const fOff = d.features.filter((f) => !n.features.includes(f));
  for (const f of fOn) out.push({ k: 'Tool', from: 'off', to: `${FEATURES.find((x) => x.id === f)?.name ?? f} on` });
  for (const f of fOff) out.push({ k: 'Tool', from: `${FEATURES.find((x) => x.id === f)?.name ?? f} on`, to: 'off' });
  return out;
}

export function Products({ s }: { s: GameStateV2 }) {
  useV2();
  const [edit, setEdit] = useState<{ id: string; c: ProductChanges } | null>(null);
  const reads = useMemo(() => productReadouts(s), [s, s.time.day, s.player.deployments, s.player.policies.servingAuto]);
  const live = s.player.deployments.filter((d) => isProduct(d) && d.status !== 'withdrawn')
    .sort((a, b) => (reads.get(b.id)?.revenue ?? 0) - (reads.get(a.id)?.revenue ?? 0) || PRODUCT_ORDER.indexOf(a.channel) - PRODUCT_ORDER.indexOf(b.channel));
  const missing = PRODUCT_ORDER.filter((c) => !live.some((d) => d.channel === c));
  const held = charterHolds(s).length;
  const setDraft = (id: string) => (c: ProductChanges | null) => setEdit(c && Object.keys(c).length ? { id, c } : null);
  return (
    <div className="panel-v2 prod" data-panel="products">
      <PanelHead icon={ICON.deploy} title="Products"
        right={<span className="row-i prod-pol">
          {held > 0 && <Ref id="charterHolds" to={{ panel: 'finance', tab: 'owners', anchor: 'board' }}><Lock size={11} /> Safety committee holds {held} model{held > 1 ? 's' : ''}</Ref>}
          <ServingLink s={s} live={live} reads={reads} />
          <Policies s={s} live={live} />
        </span>} />
      <RevenueStrip s={s} live={live} reads={reads} />
      <div className="prd-cards" style={{ gridTemplateColumns: `repeat(${Math.max(1, live.length)}, minmax(0, 1fr))${missing.length ? ' minmax(280px, 330px)' : ''}` }}>
        {live.map((d) => <ProductCard key={d.id} s={s} d={d} r={reads.get(d.id)} draft={edit?.id === d.id ? edit.c : undefined} setDraft={setDraft(d.id)} />)}
        {missing.length > 0 && <LaunchCard s={s} missing={missing} />}
      </div>
      <ProductDrawer s={s} reads={reads} setDraft={(id, c) => setEdit({ id, c })} />
    </div>
  );
}

// ───────── header: serving link (number lives on LAB) and policies ─────────
function ServingLink({ s, live, reads }: { s: GameStateV2; live: Deployment[]; reads: Map<string, ProductRead> }) {
  const pool = servingPool(s);
  const spare = idleServing(s);
  const cut = live.reduce((a, d) => a + (reads.get(d.id)?.cutH100e ?? 0), 0);
  const word = cut > 0.5 ? 'short' : spare > pool * 0.02 ? 'spare' : 'all in use';
  return (
    <Tip content={() => <TipCard title={<Term id="poolServing">Serving compute</Term>} value={word}>
      {cut > 0.5 ? 'Some demand goes unserved: buyers who are not served leave for rivals.' : word === 'spare' ? 'Every product is served, with compute to spare.' : 'Every product is served; nothing spare.'} The serving share and its numbers live on LAB.
    </TipCard>}>
      <button className={`ref-chip prd-srv ${cut > 0.5 ? 'short' : ''}`} data-test="prod-serving-link" data-ref="servingLab" onClick={() => store.goto('lab', { anchor: 'split' })}>
        <Server size={13} /> Serving compute: {word} <ChevronRight size={12} />
      </button>
    </Tip>
  );
}

function PolicySwitch({ on, k, label, term }: { on: boolean; k: string; label: string; term: string }) {
  return (
    <ActBtn id="products.policy" testId={`products.policy.${k}`} params={{ [k]: !on }}
      label={<span className="psw"><span className={`sw ${on ? 'on' : ''}`}><i /></span><Term id={term}>{label}</Term></span>} />
  );
}

function Policies({ s, live }: { s: GameStateV2; live: Deployment[] }) {
  const [open, setOpen] = useState(false);
  const pol = s.player.policies;
  const n = [pol.servingAuto, pol.autoCheapTier, pol.upgradeToNewest].filter(Boolean).length;
  const [shares, setShares] = useState<Record<string, number>>({});
  return (
    <span className="prd-polw">
      <button className={`btn btn-sm ${open ? 'on' : ''}`} data-test="prod-policies" onClick={() => setOpen(!open)}><SlidersHorizontal size={13} /> Policies <span className="dim">{n} on</span></button>
      {open && (
        <div className="prd-pop" data-test="prod-policies-pop">
          <PolicySwitch on={pol.servingAuto} k="servingAuto" term="autoServing" label="Serve the most profitable first" />
          <PolicySwitch on={pol.autoCheapTier} k="autoCheapTier" term="cheapTierPolicy" label="Auto-make smaller sizes" />
          <PolicySwitch on={pol.upgradeToNewest} k="upgradeToNewest" term="upgradePolicy" label="Upgrade to the newest cleared model" />
          <Ref id="autoEvaluate" to={{ panel: 'models', tab: 'evals' }}>Re-test when</Ref>
          {!pol.servingAuto && (
            <div className="sv-man" data-test="serving-manual">
              <div className="dim small">Serving share by product (by hand)</div>
              {live.map((d) => {
                const sh = shares[d.id] ?? d.servingShare;
                return (
                  <span key={d.id} className="sv-m" data-serving={d.id}>
                    <span>{pname(d.channel)}</span>
                    <input className="slider" type="range" min={0} max={1} step={0.01} value={sh} onChange={(e) => setShares({ ...shares, [d.id]: Number(e.target.value) })} />
                    <Tip content={() => <TipCard title="Serving share" value={F.pct(sh)}>Share of the serving compute for this product.</TipCard>}><b className="num">{F.pct(sh)}</b></Tip>
                    <ActBtn id="product.serving" testId={`product.serving.${d.id}`} params={{ id: d.id, share: sh }} label="Set" />
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </span>
  );
}

// ───────── L1 #1: revenue from products ─────────
function RevSpark({ s, data }: { s: GameStateV2; data: { series: number[]; days: number[] } }) {
  const w = 258;
  const h = 54;
  const xs = data.series;
  if (xs.length < 2) return <div className="dim small" data-test="rev-spark-start">the line fills in week by week</div>;
  const mx = Math.max(...xs) * 1.05 || 1;
  const pts = xs.map((v, i) => [(i / (xs.length - 1)) * w, h - 2 - (v / mx) * (h - 4)] as const);
  const p = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={w} height={h + 16} className="prd-spark" data-test="rev-spark">
      <polyline points={`0,${h - 2} ${p} ${w},${h - 2}`} fill="rgba(176,142,26,.14)" stroke="none" />
      <polyline points={p} fill="none" stroke="#d9b638" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={3.5} fill="#fff" />
      <text x={0} y={h + 13} className="prd-ax">{fmtMonth(dateOf(s, data.days[0]))}</text>
      <text x={w} y={h + 13} className="prd-ax" textAnchor="end">now</text>
    </svg>
  );
}

function LimitChip({ s, d, r }: { s: GameStateV2; d: Deployment; r: ProductRead }) {
  const erosion = s.world.fx.capPenalty[r.channel === 'consumer' ? 'consumer' : 'sector'];
  return (
    <Tip content={() => <TipCard title={<><Term id="bindingCause">Limited by</Term> {BOUND_WORD[r.bound]}</>} rows={[
      { label: 'Sold at what the work is worth', value: <Limit id="price.valueCap" tone={r.valueCapped > 0.05 ? 'warn' : 'quiet'}>{F.pct(r.valueCapped)} of sales</Limit> },
      { label: 'Demand modifiers', value: (() => { const m = demandModifiers(s, d); return <Limit id="product.demandMods" tone="quiet">{m.length ? m.map((x) => Number.isNaN(x.mult) ? x.label : `${x.label} ×${x.mult.toFixed(2)}`).join(' · ') : 'none'}</Limit>; })() },
      ...(erosion > 0.005 ? [{ label: 'Share lost while short of serving', value: <Limit id="product.erosion" tone={erosion >= PENALTY_MAX - 1e-6 ? 'bind' : 'warn'}>−{F.pct(erosion)} (max {F.pct(PENALTY_MAX)})</Limit> }] : []),
    ]}>{limitReason(r)}</TipCard>}>
      <span className={`chip2 ${r.bound === 'demand' ? '' : 'warn'}`} data-test={`prod-bind.${r.id}`}><Gauge size={12} /> Limited by <b>{BOUND_WORD[r.bound]}</b></span>
    </Tip>
  );
}

function RevenueStrip({ s, live, reads }: { s: GameStateV2; live: Deployment[]; reads: Map<string, ProductRead> }) {
  const tr = useMemo(() => revenueTrend(s), [s, s.time.day]);
  const rows = live.map((d) => ({ d, r: reads.get(d.id) })).filter((x): x is { d: Deployment; r: ProductRead } => !!x.r);
  const total = rows.reduce((a, x) => a + x.r.revenue, 0);
  const max = Math.max(1e-9, ...rows.map((x) => x.r.revenue + x.r.unserved));
  const down = tr.change < -0.005;
  return (
    <section className="card2 prd-rev" data-home="productRevenue" data-test="prod-revenue">
      <div className="tot">
        <div className="cap">Revenue from products</div>
        <Tip content={() => <TipCard title="Revenue from products" value={F.money(total, { perYear: true })} rows={rows.map((x) => ({ label: pname(x.d.channel), value: F.money(x.r.revenue, { perYear: true }) }))}>Today's revenue of every live product, annualised.</TipCard>}>
          <div className="big" data-test="prod-rev-total">{F.money(total)}<span className="u">/yr</span></div>
        </Tip>
        <Tip content={() => <TipCard title="Revenue trend" rows={[{ label: 'Peak', value: `${F.money(tr.peak, { perYear: true })} · ${fmtDate(dateOf(s, tr.peakDay))}` }, { label: 'Now', value: F.money(tr.now, { perYear: true }) }]}>All revenue, sampled weekly.</TipCard>}>
          <div className="row-i trend">{down
            ? <><span className="dn">▼ {F.pct(-tr.change)}</span><span className="dim">since the {fmtMonth(dateOf(s, tr.peakDay))} peak</span></>
            : <span className="dim">at its peak</span>}</div>
        </Tip>
        <RevSpark s={s} data={tr} />
      </div>
      <div className="rows">
        <div className="legend2 small"><span><i style={{ background: 'var(--prod, #b08e1a)' }} />served</span><span><i className="hatch" />wanted, not served</span></div>
        {rows.map(({ d, r }) => {
          const Icon = P_ICON[d.channel] ?? ICON.product;
          const drift = customerDrift(r);
          const revTip = () => <TipCard title={`${pname(d.channel)} revenue`} value={F.money(r.revenue, { perYear: true })} rows={[{ label: 'Wanted', value: F.money(r.demand, { perYear: true }) }, { label: <Term id="servingCut">Not served</Term>, value: F.money(r.unserved, { perYear: true }), tone: r.unserved >= 0.005 ? 'neg' : 'neutral' }, { label: 'Serving need cut', value: F.pct(cutShare) }]}>What buyers pay for the work served, and what they wanted but did not get.</TipCard>;
          const cutShare = r.needH100e > 0 ? Math.min(1, r.cutH100e / r.needH100e) : 0;
          const allServed = r.unserved < 0.005 && cutShare < 0.005;
          return (
            <div className="rr" key={d.id} data-rev={d.id}>
              <span className="nm"><Icon size={17} />{pname(d.channel)}</span>
              <Tip as="div" className="bar" content={revTip}>
                <i className="sv" style={{ width: `${(r.revenue / max) * 100}%` }} />
                {!allServed && <i className="un" style={{ left: `${(r.revenue / max) * 100}%`, width: `${(r.unserved / max) * 100}%` }} />}
              </Tip>
              <Tip content={revTip}><span className="val">{F.money(r.revenue)}<span className="u">/yr</span></span></Tip>
              <Tip content={revTip}><span className={`srv ${allServed ? '' : 'tone-neg'}`}>{allServed ? <><Check size={13} /> all demand served</> : r.unserved >= 0.005 ? <>{F.money(r.unserved)} not served</> : <>{F.pct(cutShare)} of {d.channel === 'consumer' ? 'users' : 'work'} not served</>}</span></Tip>
              <span className="why"><LimitChip s={s} d={d} r={r} /><span>{drift.words}</span></span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ───────── L1 #2: product card ─────────
function ProductCard({ s, d, r, draft, setDraft }: { s: GameStateV2; d: Deployment; r?: ProductRead; draft?: ProductChanges; setDraft: (c: ProductChanges | null) => void }) {
  const def = PRODUCT_DEFS[d.channel];
  const Icon = P_ICON[d.channel] ?? ICON.product;
  const n = draft ? editedProduct(d, draft) : d;
  const set = (c: ProductChanges) => setDraft({ ...(draft ?? {}), ...c });
  const editing = !!draft && changeLines(s, d, draft).length > 0;
  const chat = d.channel === 'consumer';
  const open = store.tab[DRAWER] === d.id;
  return (
    <section className={`card2 pcard ${editing ? 'editing' : ''} ${open ? 'sel' : ''}`} data-product={d.id} data-channel={d.channel}>
      <div className="ph2">
        <span className="pi"><Icon size={18} /></span>
        <Tip content={() => <TipCard title={def?.name ?? d.channel}>{def?.blurb}</TipCard>}><span className="pn"><Term id="product">{def?.name ?? d.channel}</Term></span></Tip>
        <span className="live">{d.held ? 'Held' : 'Live'}</span>
        <span className="sp" />
        <span className="dim small">{P_WHO[d.channel]}</span>
      </div>
      {r && <LineupSec s={s} d={d} n={n} r={r} set={set} />}
      <ToolsSec s={s} d={d} />
      {r && <CustomersSec d={d} r={r} />}
      {chat ? (
        <div className="sec2"><div className="sh"><span className="cap"><Term id="adaptation">Sector certification</Term></span></div><div className="cert dim"><Minus size={14} /> Not for consumer products</div></div>
      ) : <CertSec s={s} d={d} />}
      <div className="sec2 set">
        <div className="setrow">
          <Tip content={() => chat
            ? <TipCard title={<Term id="priceTier">Price</Term>} rows={PRICE_TIER_IDS.map((t) => ({ label: TIER_LABEL[t], value: `${usd(consumerPlanPrice(MARKUP[t]))} a month` }))}>Chat sells flat monthly plans at the market's price: Standard and Premium at what users will pay, Low below it (more users subscribe). A plan never sells below a paying user's serving cost.</TipCard>
            : <TipCard title={<Term id="priceTier">Price</Term>} rows={PRICE_TIER_IDS.map((t) => ({ label: TIER_LABEL[t], value: `${(MARKUP[t] * (CHANNEL_PRICE[d.channel] ?? 1)).toFixed(1)}× serving cost (margin ${F.pct(1 - 1 / MARKUP[t])})` }))}>A markup over this product's serving cost, never above what the work is worth to the buyer. On work a cheaper offer also does, buyers take the cheaper one.</TipCard>}>
            <span className="k"><Term id="priceTier">Price</Term></span>
          </Tip>
          <Seg testId={`prod-price.${d.id}`} value={n.price} options={PRICE_TIER_IDS.map((t) => ({ v: t, label: TIER_LABEL[t] }))} onChange={(t) => set({ price: t })} />
          <Tip content={() => <TipCard title={chat ? 'Plan price' : 'Price over serving cost'} rows={r ? [{ label: 'Margin', value: F.pct(r.margin) }] : []}>{chat ? 'What a paying user pays a month.' : 'Every model in the lineup sells at this multiple of its own serving cost.'}</TipCard>}><span className="dim small">{chat ? (r ? `${usd(r.price)} a month` : '') : `${(MARKUP[n.price] * (CHANNEL_PRICE[d.channel] ?? 1)).toFixed(1)}× serving cost`}</span></Tip>
        </div>
      </div>
      <div className="pfoot">
        <button className="ref-chip" data-test={`prod-open.${d.id}`} onClick={() => store.setTab(DRAWER, open ? '' : d.id)}><Users size={12} /> {chat ? 'Customers' : 'Customers by sector'} <ChevronRight size={12} /></button>
        <Ref id="productSafeguards" to={{ panel: 'safety', tab: 'safeguards' }}><Shield size={12} /> Safeguards</Ref>
        <span className="sp" />
        <span className="dim small">live since {fmtMonth(dateOf(s, d.startDay))}</span>
      </div>
      {editing && draft && <EditPop s={s} d={d} c={draft} close={() => setDraft(null)} />}
    </section>
  );
}

/** Lineup: the models buyers pick from (skill on tests, hours sold, price per hour; Chat: who each model serves). */
function LineupSec({ s, d, n, r, set }: { s: GameStateV2; d: Deployment; n: Deployment; r: ProductRead; set: (c: ProductChanges) => void }) {
  const [more, setMore] = useState(false);
  const chat = d.channel === 'consumer';
  const skill = (id: string) => {
    const v = versionById(s, id);
    const L = mL(s, v);
    return (
      <Tip content={() => <TipCard title={<Term id="L">Skill on tests</Term>} value={F.level(L)}>{v?.name}'s measured skill (MODELS has the full card).</TipCard>}>
        <span className="sk"><i style={{ width: `${Math.min(100, (L / 10) * 100)}%` }} /></span>
      </Tip>
    );
  };
  let rows: ReactNode[];
  let foldText: string | undefined;
  if (chat) {
    const free = freeTierVersion(s, d);
    const unused = [d.versionId, ...(d.lineup ?? [])].filter((id) => id !== d.versionId && id !== free?.id);
    rows = [
      <div className="lu" key="paid" data-test={`prod-tier.${d.id}.0`}><span className="ro">1</span><span className="mn">{nameOf(s, d.versionId)}</span>{skill(d.versionId)}<span className="dim">paying users</span><span className="pr">{usd(r.price)}</span></div>,
      ...(free && free.id !== d.versionId ? [<div className="lu" key="free" data-test={`prod-tier.${d.id}.1`}><span className="ro">2</span><span className="mn">{free.name}</span>{skill(free.id)}<span className="dim"><Term id="freeTier">Free tier</Term></span><span className="pr">free</span></div>] : []),
    ];
    foldText = unused.length ? `${unused.length} more model${unused.length > 1 ? 's' : ''} in the lineup, unused by Chat` : 'Change the lineup';
  } else {
    const L = r.lineup ?? [];
    const selling = L.filter((x) => x.share > 0.005);
    const idle = L.length - selling.length;
    rows = selling.map((x, k) => (
      <Tip as="div" key={x.id} content={() => <TipCard title={x.name} value={`${F.pct(x.share, 1)} of hours`} rows={[
        { label: 'Price per hour of work', value: `${F.usd(x.price)}/h` },
        { label: 'Hours sold a year', value: `${F.count(x.hours)} h` },
      ]}>{k === 0 ? 'Does the hardest tasks the product sells.' : 'Sells where it does the task at a lower price than any model that does more.'}</TipCard>}>
        <div className="lu" data-test={`prod-tier.${d.id}.${k}`}>
          <span className="ro">{k + 1}</span><span className="mn">{x.name}</span>{skill(x.id)}
          <span className="hbw"><span className="hb"><i style={{ width: `${Math.min(1, x.share) * 100}%` }} /></span><span className="pc">{F.pct(x.share)}</span></span>
          <span className="pr">{usd(x.price)}</span>
        </div>
      </Tip>
    ));
    const cheapest = selling[selling.length - 1];
    foldText = idle > 0 ? `${idle} more model${idle > 1 ? 's' : ''} sell${idle > 1 ? '' : 's'} nothing${cheapest && selling.length > 1 ? `: ${cheapest.name} beats them on price for skill` : ''}` : 'Change the lineup';
  }
  return (
    <div className="sec2" data-test={`prod-lineup.${d.id}`}>
      <div className="sh">
        <Tip content={() => <TipCard title={<Term id="lineup">Lineup</Term>}>{chat ? 'Paying users run the main model; free users run the free-tier model, by default the cheapest one to serve.' : 'Your models this product sells. In each band of task difficulty buyers take the one with the most value for the price, across every lab\'s models: cheaper models sell on easy work.'}</TipCard>}>
          <span className="cap"><Term id="lineup">Lineup</Term></span>
        </Tip>
        <span className="dim small">buyers pick per task</span>
      </div>
      <div className="lu hd2"><span /><span>model</span><span><Term id="L">skill</Term></span><span>{chat ? 'serves' : 'hours sold'}</span><span>{chat ? 'per month' : 'per hour'}</span></div>
      {rows}
      <button className="fold" data-test={`prod-lineup-more.${d.id}`} onClick={() => setMore(!more)}><ChevronRight size={12} className={more ? 'rot' : ''} />{foldText}</button>
      {more && (
        <div className="prd-edit">
          <PkgChip kind="model" testId={`prod-model.${d.id}`} value={n.versionId} changed={n.versionId !== d.versionId}
            options={s.player.models.versions.filter((x) => usable(x) && CHANNEL_VARIANTS[d.channel].includes(x.variant)).map((x) => ({ value: x.id, label: `${x.name} · skill ${F.level(mL(s, x))}` }))}
            onPick={(x) => set({ versionId: x })} sub={<LineupPicker s={s} d={d} n={n} set={set} />} />
        </div>
      )}
    </div>
  );
}

/** One tool's effect on this product in player units: where it helps, what it gives, its cost per task. */
function toolLine(f: FeatureDef, ch: Channel): { where: string; eff: string; cost?: string } {
  const v = featureView(f, ch);
  const here = v.lines.filter((l) => l.here);
  const chat = ch === 'consumer';
  const effs: string[] = [];
  let cost: string | undefined;
  for (const fx of f.fx) {
    if (fx.kind === 'scaffold') { effs.push(`skill ×${(10 ** fx.dG).toFixed(0)} compute`); if (fx.tokens !== 1) cost = `×${fx.tokens} cost`; }
    else if (fx.kind === 'horizon') effs.push(`tasks ×${fx.mult} longer`);
    else if (fx.consumer && chat) effs.push(`appeal ×${(1 + fx.share).toFixed(2)}`);
    else if (fx.sectors?.length && !chat) effs.push(`+${Math.round(enablerNeed(fx.share) * 100)}% of tasks`);
  }
  return { where: here.map((l) => l.where).join(', ') || '—', eff: effs.join(' · '), cost };
}

function ToolsSec({ s, d }: { s: GameStateV2; d: Deployment }) {
  const [add, setAdd] = useState(false);
  const on = FEATURES.filter((f) => f.products.includes(d.channel) && d.features.includes(f.id) && s.player.features.includes(f.id));
  const feats = FEATURES.filter((f) => f.products.includes(d.channel));
  const etas = buildEtas(s).etas;
  return (
    <div className="sec2" data-test={`prod-feats.${d.id}`}>
      <div className="sh">
        <Tip content={() => <TipCard title={<Term id="feature">Tools</Term>}>Engineers build a tool once for the whole lab; switch it on for each product that offers it. A tool lets a model do work it otherwise can't, at a stated cost per task.</TipCard>}>
          <span className="cap"><Term id="feature">Tools</Term></span>
        </Tip>
        <span className="dim small">where it helps</span>
      </div>
      {on.map((f) => {
        const t = toolLine(f, d.channel);
        const I = TOOL_ICON[f.id] ?? Blocks;
        return (
          <Tip as="div" key={f.id} content={() => <FeatureTip s={s} d={d} f={f} />}>
            <div className="tl" data-tool={f.id}>
              <span className="tool"><I size={14} />{toolName(f)}</span>
              <span className="tw">{t.where}</span>
              <span className="te">{t.eff}</span>
              {t.cost && <><span /><span /><span className="tc">{t.cost} per task</span></>}
            </div>
          </Tip>
        );
      })}
      {!on.length && <div className="dim small">No tools on this product yet.</div>}
      <div><button className={`tool add ${add ? 'on' : ''}`} data-test={`prod-tool-add.${d.id}`} onClick={() => setAdd(!add)}>{add ? <X size={14} /> : <Plus size={14} />} {add ? 'Close' : 'Add a tool'}</button></div>
      {add && <div className="prd-edit pc-feat">{feats.map((f) => <FeatureRow key={f.id} s={s} d={d} f={f} eta={etas.get(s.player.build.queue.find((it) => it.kind === 'feature' && it.ref === f.id)?.id ?? '')} />)}</div>}
    </div>
  );
}

/** Customers: share now → where buyers are heading (the target share), the best rival, and who buys. */
function CustomersSec({ d, r }: { d: Deployment; r: ProductRead }) {
  const c = r.cust;
  const chat = d.channel === 'consumer';
  const top = Math.max(c.stock, c.target, r.rival?.share ?? 0) > 0.46 ? 1 : 0.5;
  const X = (v: number) => `${(v / top) * 100}%`;
  const drift = customerDrift(r);
  const moving = drift.dir !== 'hold';
  const e = r.econ;
  const foot = chat
    ? `${F.count(c.users ?? r.users ?? 0)} weekly users · ${F.pct(e.paidShare, 1)} pay`
    : `${e.seats >= 1 ? `${F.count(e.seats)} seats · ` : ''}${F.count(e.adoptedHours + e.agentHours)} hours of work a year`;
  return (
    <div className="sec2" data-test={`prod-cust.${d.id}`}>
      <div className="sh">
        <Tip content={() => <TipCard title={<Term id="customerStock">Customers</Term>}>{'Your [[segmentShare|share of the spend]] is a [[customerStock|stock]]: in each region and sector it moves toward its [[targetShare|target share]] (skill, price, brand, access), so a release or a price change pays off over weeks to months.'}</TipCard>}>
          <span className="cap"><Term id="customerStock">Customers</Term></span>
        </Tip>
        <span className="dim small">share of {chat ? 'consumer' : 'sector'} spend, now → where buyers are heading</span>
      </div>
      <Tip as="div" content={() => <TipCard title="Customers" value={`${F.pct(c.stock, 1)} → ${F.pct(c.target, 1)}`} rows={[
        { label: 'Now', value: F.pct(c.stock, 1) },
        { label: <Term id="targetShare">Where buyers are heading</Term>, value: F.pct(c.target, 1), tone: drift.dir === 'gain' ? 'pos' : drift.dir === 'lose' ? 'neg' : 'neutral' },
        { label: 'Time to get there', value: c.days === 0 ? 'there now' : Number.isFinite(c.days) ? about(c.days) : 'more than 3 yr' },
        ...(r.rival ? [{ label: `Best rival: ${r.rival.name}`, value: F.pct(r.rival.share, 1) }] : []),
      ]} footer="Weighted by each segment's spend; all your products together. The rival's share is your intel estimate.">Where buyers are heading assumes today's models and prices hold.</TipCard>}>
        <div className="ct" data-test={`prod-cust-stock.${d.id}`}>
          <div className="trk"><div className="ax" />
            {moving && <div className={`arr ${drift.dir}`} style={{ left: X(Math.min(c.stock, c.target)), width: `${(Math.abs(c.target - c.stock) / top) * 100}%` }} />}
            {moving && <div className="tgt" style={{ left: X(c.target) }} />}
            {r.rival && <div className="rv" style={{ left: X(r.rival.share) }} />}
            <div className="now" style={{ left: X(c.stock) }} />
            {[0, top / 2, top].map((t) => <span key={t} className="tl2" style={{ left: X(t) }}>{F.pct(t)}</span>)}
          </div>
          <div className="cv">
            <b className="num">{F.pct(c.stock)}</b> {moving ? <><span className={drift.dir === 'lose' ? 'dn' : 'up'}>→ {F.pct(c.target)}</span> <span className="dim">{c.days > 0 && Number.isFinite(c.days) ? `in ${about(c.days)}` : ''}</span></> : <span className="dim">holding</span>}
            {r.rival && <div className="dim small"><span className="rvm">▼</span> {r.rival.name} {F.pct(r.rival.share)}</div>}
          </div>
        </div>
      </Tip>
      <div className="dim small" data-test={chat ? `prod-users.${d.id}` : `prod-hours.${d.id}`}>{foot}</div>
    </div>
  );
}

/** Sector certification: this product's adaptations and the sectors it can still be certified for. */
function CertSec({ s, d }: { s: GameStateV2; d: Deployment }) {
  const [pick, setPick] = useState(false);
  const own = d.adaptations;
  const building = adaptationsBuilding(s, d.id);
  const etas = buildEtas(s).etas;
  const taken = new Set([...own.map((a) => a.sector as string), ...building.map((it) => it.ref)]);
  const open = CERT_SECTOR_IDS.filter((x) => !taken.has(x));
  const tip = `Each certification adapts this product to one sector: engineers build a scaffold for its workflows (${ADAPT_TW} engineer team-weeks), then certification takes ${CERT_DAYS} days and ${F.money(CERT_CASH)}. Once certified, this product's buyers there adopt more easily (friction −${CERT_FRICTION_CUT}).`;
  return (
    <div className="sec2" data-test={`prod-adapt.${d.id}`}>
      <div className="sh"><Tip content={() => <TipCard title={<Term id="adaptation">Sector certification</Term>}>{tip}</TipCard>}><span className="cap"><Term id="adaptation">Sector certification</Term></span></Tip></div>
      {own.length === 0 && building.length === 0 && <div className="cert"><ShieldCheck size={14} /><span>None yet</span><span className="dim">· {CERT_SECTOR_IDS.map((x) => SECTOR_NAME[x]?.split(/[ ,]/)[0] ?? x).join(', ')} can be certified</span></div>}
      {(own.length > 0 || building.length > 0) && (
        <div className="certs">
          {own.map((a) => <span key={a.sector} className="chip2"><ShieldCheck size={12} />{SECTOR_NAME[a.sector] ?? a.sector} <span className="dim">{a.certDone === undefined ? 'adapted' : certified(a, s.time.day) ? 'certified' : `certified ${fmtMonth(dateOf(s, a.certDone))}`}</span></span>)}
          {building.map((it) => { const eta = etas.get(it.id); return <Tip key={it.id} content={() => <TipCard title="Being built">Engineers build the sector scaffold first; certification starts when it is built.</TipCard>}><span className="chip2"><Hammer size={12} />{SECTOR_NAME[it.ref] ?? it.ref} <span className="dim">{eta !== undefined && Number.isFinite(eta) ? `built in ${F.days(eta)}` : 'waits for engineers'}</span></span></Tip>; })}
        </div>
      )}
      {open.length > 0 && <div><button className="btn btn-sm" data-test={`prod-adapt-add.${d.id}`} onClick={() => setPick(!pick)}>{pick ? <X size={14} /> : <Plus size={14} />} {pick ? 'Close' : 'Certify a sector'}</button></div>}
      {pick && <div className="prd-edit row-i wrap">{open.map((x) => <ActBtn key={x} id="product.adapt" testId={`prod-adapt.${d.id}.${x}`} params={{ deploymentId: d.id, sector: x }} label={SECTOR_NAME[x] ?? x} onDone={() => setPick(false)} />)}</div>}
    </div>
  );
}

// ───────── Agents (and any other product not launched) ─────────
function LaunchCard({ s, missing }: { s: GameStateV2; missing: Channel[] }) {
  const [pick, setPick] = useState<Channel>(missing.find((c) => pendingLaunch(s, c)) ?? missing[0]);
  const ch = missing.includes(pick) ? pick : missing[0];
  const ready = useMemo(() => agentsReady(s), [s, s.time.day]);
  const vs = s.player.models.versions.filter((v) => usable(v) && CHANNEL_VARIANTS[ch].includes(v.variant)).sort((a, b) => mL(s, b) - mL(s, a));
  const v = vs[0];
  // The launch gate (safety committee holds, missing variant): the button is blocked with its reason.
  const gate = v ? deployGate(s, v, ch) : `${pname(ch)} needs a ${CHANNEL_VARIANTS[ch].join(' or ')} model: train one on Next run`;
  const Icon = P_ICON[ch] ?? ICON.product;
  const pend = pendingLaunch(s, ch);
  const eta = pend ? buildEtas(s).etas.get(pend.id) : undefined;
  return (
    <section className="card2 pcard agents" data-test="prod-launch">
      <div className="ph2">
        <span className="pi"><Icon size={18} /></span>
        {missing.length > 1
          ? <select className="msel nm" data-test="prod-launch-pick" value={ch} onChange={(e) => setPick(e.target.value as Channel)}>{missing.map((c) => <option key={c} value={c}>{pname(c)}{pendingLaunch(s, c) ? ' · building' : ''}</option>)}</select>
          : <span className="pn">{pname(ch)}</span>}
        <span className="sp" />
        {pend
          ? <Tip content={() => <TipCard title="Being built" rows={[{ label: 'Work left', value: `${(pend.needTW - pend.doneTW).toFixed(1)} of ${pend.needTW.toFixed(0)} team-weeks` }]}>Engineers build the launch; it goes live when built.</TipCard>}><span className="chip2" data-test="prod-launch-building"><Hammer size={11} /> {eta !== undefined && Number.isFinite(eta) ? `live in ${F.days(eta)}` : 'waits for engineers'}</span></Tip>
          : <span className="chip2">not launched</span>}
      </div>
      <div className="dim">{PRODUCT_DEFS[ch]?.blurb}</div>
      {/* MK-11: the Agents launch checklist (time horizon, engineers) went with the Agents product; Agent mode becomes a tool. */}
      <div className="lfoot">
        {pend
          ? <ActBtn id="build.cancel" testId={`product.launch.cancel.${ch}`} params={{ id: pend.id }} label="Cancel launch" />
          : <ActBtn id="product.launch" testId={`product.launch.${ch}`} params={{ channel: ch, ...(v ? { versionId: v.id } : {}) }} primary icon={Rocket} label={<>Launch {pname(ch)}</>} block={gate === true ? undefined : gate} reason />}
        {!pend && <span className="dim small">{weeks(ready.weeks)} of engineering</span>}
      </div>
    </section>
  );
}

// ───────── L2: product drawer ─────────
function ProductDrawer({ s, reads, setDraft }: { s: GameStateV2; reads: Map<string, ProductRead>; setDraft: (id: string, c: ProductChanges) => void }) {
  const id = store.tab[DRAWER] ?? '';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.tip')) store.setTab(DRAWER, ''); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const d = s.player.deployments.find((x) => x.id === id && x.status !== 'withdrawn');
  const r = d ? reads.get(d.id) : undefined;
  if (!d || !r) return null;
  const close = () => store.setTab(DRAWER, '');
  const Icon = P_ICON[d.channel] ?? ICON.product;
  const chat = d.channel === 'consumer';
  return (
    <>
      <div className="pf-scrim" onClick={close} />
      <aside className="pf-drawer prd-drawer" data-test="prod-drawer" data-card={d.id}>
        <div className="pf-dh"><Icon size={20} className="dim" /><h2>{pname(d.channel)} · Customers</h2><span className="sp" /><button className="btn btn-sm btn-ghost" aria-label="Close" data-test="prod-drawer-close" onClick={close}><X size={16} /></button></div>
        <SectorShares s={s} d={d} r={r} />
        <div className="prd-limit" data-test="prod-limit">
          <div className="row-i"><Gauge size={17} /><b><Term id="bindingCause">Limited by</Term> {BOUND_WORD[r.bound]}</b></div>
          <div>{limitReason(r)}</div>
        </div>
        <WinBackSec s={s} d={d} close={close} setDraft={setDraft} />
        <SoldSec d={d} r={r} chat={chat} />
        <GuardsSec d={d} />
      </aside>
    </>
  );
}

function SectorShares({ s, d, r }: { s: GameStateV2; d: Deployment; r: ProductRead }) {
  const [all, setAll] = useState(false);
  const c = r.cust;
  const chat = d.channel === 'consumer';
  const rows = c.bySeg.filter((x) => x.w > 0);
  const shown = all ? rows : rows.slice(0, 4);
  const top = Math.max(...rows.map((x) => Math.max(x.stock, x.target)), 0) > 0.46 ? 1 : 0.5;
  const X = (v: number) => `${(v / top) * 100}%`;
  const ticks = (top > 0.5 ? [0, 0.2, 0.4, 0.6, 0.8, 1] : [0, 0.1, 0.2, 0.3, 0.4, 0.5]);
  const sib = s.player.deployments.find((x) => x.id !== d.id && x.status !== 'withdrawn' && !chat && (x.channel === 'api' || x.channel === 'enterprise' || x.channel === 'vetted') && (d.channel === 'api' || d.channel === 'enterprise' || d.channel === 'vetted'));
  const tau = c.taus[0]?.days;
  return (
    <div className="sec" data-test="prod-sectors">
      <div className="row-i"><span className="cap" style={{ flex: 1 }}>{chat ? 'Your share of consumer chat spend' : 'Your share of each sector\'s spend'}</span>
        <span className="row-i dim small" style={{ gap: 12 }}><span className="row-i"><i className="lg-now" />now</span><span className="row-i"><i className="lg-tgt" />where buyers are heading</span></span></div>
      <Tip as="div" className="psx hd" content={() => <TipCard title="Share of the spend">Your share of what buyers in each sector spend on AI work, across the regions, weighted by spend.</TipCard>}><span /><div className="trk">{ticks.map((t) => <span key={t} className="num dim" style={{ left: X(t) }}>{F.pct(t)}</span>)}</div><span /></Tip>
      {shown.map((x) => {
        const g = x.target - x.stock;
        const mv = Math.abs(g) > 0.005;
        return (
          <div className="psx" key={x.seg} data-sector={x.seg}>
            <span className="snm">{x.seg === 'consumer' ? 'Chat users' : SECTOR_NAME[x.seg] ?? x.seg}{CERT_SECTOR_IDS.includes(x.seg) && <span className="chip2 xs"><ShieldCheck size={11} />certifiable</span>}</span>
            <div className="trk"><div className="ax" />
              {mv && <div className={`arr ${g < 0 ? 'lose' : 'gain'}`} style={{ left: X(Math.min(x.stock, x.target)), width: `${(Math.abs(g) / top) * 100}%` }} />}
              {mv && <div className="tgt" style={{ left: X(x.target) }} />}
              <div className="now" style={{ left: X(x.stock) }} />
            </div>
            <Tip content={() => <TipCard title={x.seg === 'consumer' ? 'Chat users' : SECTOR_NAME[x.seg] ?? x.seg} rows={[{ label: 'Your share now', value: F.pct(x.stock, 1) }, { label: <Term id="targetShare">Where buyers are heading</Term>, value: F.pct(x.target, 1) }, { label: 'Share of the spend you sell into', value: F.pct(x.w, 1) }]} />}><span className="num v">{F.pct(x.stock)} {mv && <span className={g < 0 ? 'dn' : 'up'}>→ {F.pct(x.target)}</span>}</span></Tip>
          </div>
        );
      })}
      {rows.length > 4 && <button className="fold" data-test="prod-sectors-more" onClick={() => setAll(!all)}><ChevronRight size={12} className={all ? 'rot' : ''} />{all ? 'Fewer sectors' : `${rows.length - 4} more sectors, smaller spend`}</button>}
      <div className="dim">
        {sib && <>Shared with {pname(sib.channel)}: both sell to the same buyers. </>}
        {tau !== undefined && <>Buyers switch over <b className="w">{about(tau)}</b>{c.days > 0 && Number.isFinite(c.days) ? <>; at this pace your share reaches the target in <b className="w">{about(c.days)}</b>.</> : c.days === 0 ? '; your share is at the target.' : '; the target is more than 3 years away.'}</>}
      </div>
    </div>
  );
}

function WinBackSec({ s, d, close, setDraft }: { s: GameStateV2; d: Deployment; close: () => void; setDraft: (id: string, c: ProductChanges) => void }) {
  const opts = useMemo(() => winBack(s, d), [s, s.time.day, d]);
  // UB-F: the model fix's share preview (the edit preview on a copy: where buyers would head with it in the lineup).
  const modelPv = useMemo(() => {
    const o = opts.find((x) => x.kind === 'model');
    if (!o || o.kind !== 'model' || o.testing || editBlock(s, d, { versionId: o.version.id })) return undefined;
    const pv = previewEdit(s, d, { versionId: o.version.id });
    return pv.before && pv.after ? { a: pv.before.cust.target, b: pv.after.cust.target } : undefined;
  }, [s, s.time.day, d, opts]);

  if (!opts.length) return null;
  return (
    <div className="sec" data-test="prod-winback">
      <div className="cap">What could win buyers back</div>
      {opts.map((o) => {
        if (o.kind === 'model') return (
          <div className="opt" key="m" data-opt="model">
            <span className="oi"><Brain size={18} /></span>
            <div><div className="ot">Add {o.version.name} to the lineup</div><Tip as="div" className="os" content={() => <TipCard title={o.version.name}>{o.testing ? 'Its tests run now (MODELS).' : 'Measured skill on tests; the edit preview shows what it would do to revenue.'}</TipCard>}>{o.testing ? 'In testing now; its skill is known when the tests finish' : `Measures ${F.level(mL(s, o.version))} on tests, above the model this product sells`}</Tip>
              {modelPv && <Tip as="div" className="os" content={() => <TipCard title={<Term id="targetShare">Where buyers are heading</Term>} value={`${F.pct(modelPv.a, 1)} → ${F.pct(modelPv.b, 1)}`}>Your target share with {o.version.name} as this product&apos;s model, from the edit preview at today&apos;s demand. Customers move toward it at the sector&apos;s switching speed.</TipCard>}><span data-test="prod-winback-share">buyers head to <b className="num">{F.pct(modelPv.a, 1)} → {F.pct(modelPv.b, 1)}</b></span></Tip>}</div>
            {o.testing
              ? <Ref id="modelsTesting" to={{ panel: 'models' }}>Models</Ref>
              : <button className="btn btn-sm" data-test="prod-winback-model" onClick={() => { setDraft(d.id, { versionId: o.version.id }); close(); }}>Preview</button>}
          </div>
        );
        if (o.kind === 'knowhow') return (
          <div className="opt" key="k" data-opt="knowhow">
            <span className="oi"><Rocket size={18} /></span>
            <div><div className="ot">Train a stronger model</div><Tip as="div" className="os" content={() => <TipCard title={<Term id="trainedIn">Waiting</Term>}>Your estimate of the know-how no model of yours has yet (RESEARCH › Know-how).</TipCard>}>×{o.x.toFixed(1)} {o.area.toLowerCase()} know-how is waiting for a new base model</Tip></div>
            <Ref id="nextRun" to={{ panel: 'blueprint' }}>Next run</Ref>
          </div>
        );
        return (
          <div className="opt" key="c" data-opt="cert">
            <span className="oi"><ShieldCheck size={18} /></span>
            <div><div className="ot">Certify {pname(d.channel)} for {o.name.split(/[ ,]/)[0]}</div><Tip as="div" className="os" content={() => <TipCard title="Certification" rows={[{ label: 'Engineering', value: `${ADAPT_TW} team-weeks` }, { label: 'Then', value: `${CERT_DAYS} days · ${F.money(CERT_CASH)}` }, { label: 'Buyers there', value: `adoption friction −${CERT_FRICTION_CUT}` }]} />}>{weeks(o.weeks)} of engineering, then {CERT_DAYS} days and {F.money(CERT_CASH)} · your {o.name.split(/[ ,]/)[0]} buyers adopt more easily</Tip></div>
            <ActBtn id="product.adapt" testId={`prod-winback-cert.${d.id}`} params={{ deploymentId: d.id, sector: o.sector }} label="Start" />
          </div>
        );
      })}
    </div>
  );
}

function SoldSec({ d, r, chat }: { d: Deployment; r: ProductRead; chat: boolean }) {
  const e = r.econ;
  return (
    <div className="sec" data-test={`prod-econ.${d.id}`}>
      <div className="cap">Sold in a year</div>
      <Tip as="div" className="kv2" content={() => <TipCard title="Sold in a year" rows={[{ label: 'Revenue', value: F.money(r.revenue, { perYear: true }) }, { label: 'Serving cost', value: F.money(r.runCost, { perYear: true }) }]}>{chat ? 'Subscribers × price × 12 is Chat\x27s only revenue; free users cost serving only.' : 'Hours of work billed per hour (tasks people hand over and work done alone), plus seats.'} Serving cost: the serving compute it uses at the rental price of a chip.</TipCard>}>
        {chat ? <>
          <span><Term id="weeklyReach">Weekly users</Term></span><span className="num">{F.count(r.users ?? 0)}</span>
          <span><Term id="paidShare">Subscribers</Term></span><span className="num">{F.count(r.subs ?? 0)} · {F.pct(e.paidShare, 1)}</span>
          <span>Price</span><span className="num">{usd(r.price)} a month</span>
        </> : <>
          <span><Term id="adoptedHour">Hours of work sold</Term></span><span className="num">{F.count(e.adoptedHours + e.agentHours)} h</span>
          <span className="dim sub">tasks people hand over {F.count(e.adoptedHours)} · work done alone {F.count(e.agentHours)}</span><span />
          {e.seats >= 1 && <><span><Term id="paidSeat">Seats</Term></span><span className="num">{F.count(e.seats)} · {usd(e.seatPrice)} a month</span></>}
        </>}
        <span><Term id="runCost">Serving cost</Term></span><span className="num">{F.money(r.runCost)}</span>
        <span>Margin</span><span className="num">{F.pct(r.margin)}</span>
      </Tip>
    </div>
  );
}

/** UB-F: the product's safeguards (monitor, level, KYC) live on SAFETY › Safeguards (their one home; the card's
 *  "Safeguards ›" chip links there): the drawer keeps Retire only. */
function GuardsSec({ d }: { d: Deployment }) {
  return (
    <div className="sec" data-test={`prod-guards.${d.id}`}>
      <div className="row-i"><span className="sp" /><ActBtn id="product.retire" testId={`product.retire.${d.id}`} params={{ id: d.id }} label={`Retire ${pname(d.channel)}`} /></div>
    </div>
  );
}

// ───────── tools editor (built once lab-wide, on here), lineup editor, edit preview ─────────
/** One icon per feature type: DoorOpen enabler, Ruler horizon extender (task length), Blocks scaffold. */
const FT_ICON: Record<FeatureKind, LucideIcon> = { enabler: DoorOpen, horizon: Ruler, scaffold: Blocks };
const FT_TERM: Record<FeatureKind, string> = { enabler: 'featEnabler', horizon: 'featHorizon', scaffold: 'featScaffold' };
const FT_LABEL: Record<FeatureKind, string> = { enabler: 'enabler', horizon: 'horizon', scaffold: 'scaffold' };

/** The feature's tooltip: typed effects with units, tokens, build cost, upkeep, on here, internal use, gate, risk. */
function FeatureTip({ s, d, f }: { s: GameStateV2; d: Deployment; f: FeatureDef }) {
  const v = featureView(f, d.channel);
  const built = s.player.features.includes(f.id);
  const on = d.features.includes(f.id);
  const tok = v.lines.reduce((a, l) => Math.max(a, l.tokens), 1);
  const gate = f.node ? TREE_BY_ID[f.node]?.name ?? f.node : undefined;
  const rv = toolRivalsView(s, f.id);
  return <TipCard title={toolName(f)} value={v.kinds.map((k) => FT_LABEL[k]).join(' + ')} rows={[
    ...v.lines.map((l) => ({ label: <><Term id={FT_TERM[l.kind]}>{FT_LABEL[l.kind]}</Term> <span className="dim">· {l.where}</span></>, value: `${l.effect}${l.tokens !== 1 ? ` · tokens ×${l.tokens}` : ''}${l.here ? '' : ' (not on this product)'}` })),
    { label: 'Build', value: `${f.buildTW} engineer team-weeks · ${F.money(f.cash)}` },
    { label: <Term id="productUpkeep">Upkeep</Term>, value: [
      ...(v.upkeepTW > 0 ? [`${v.upkeepTW.toFixed(2)} engineer team-wk/wk${v.idleTW < v.upkeepTW ? ` (${v.idleTW.toFixed(2)} while off everywhere)` : ''}`] : []),
      ...(tok > 1 ? [`serving ×${tok} tokens`] : []),
    ].join(' · ') || 'none' },
    { label: 'On this product', value: !built ? 'not built yet' : on ? 'on' : 'off', tone: (built && on ? 'pos' : 'neutral') as 'pos' | 'neutral' },
    { label: <Term id="agentPackage">Internal agents</Term>, value: v.internal.length ? `${built ? '' : 'once built: '}${v.internal.join(', ')}` : 'no effect' },
    { label: <Term id="techTree">Unlocked by</Term>, value: gate ? `${gate}${f.node && nodeKnown(s, f.node) ? ' (known)' : ' (not known yet)'}` : 'nothing: buildable now', tone: (gate && f.node && !nodeKnown(s, f.node) ? 'neg' : 'neutral') as 'neg' | 'neutral' },
    ...(rv ? [{ label: 'Rivals', value: rv.have >= rv.of ? 'every rival has it' : !rv.isNew ? `${rv.have} of ${rv.of} rivals have it (the labs that had it by July 2025)` : rv.day === undefined ? `no lab sells it yet; rivals get it ${rv.lag} d after you ship it` : `${rv.have} of ${rv.of} have it; the others from ${fmtDate(dateOf(s, rv.day))}` }] : []),
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
  const built = s.player.features.includes(f.id);
  const on = d.features.includes(f.id);
  const building = eta !== undefined;
  const known = !f.node || nodeKnown(s, f.node);
  const gate = f.node ? TREE_BY_ID[f.node]?.name ?? f.node : '';
  if (built) return (
    <div className="ft2" data-feature={f.id}><Tip as="div" content={tip}>
      <div className="ft"><Check size={12} className="ok" /><span className="ft-n">{toolName(f)}</span><span className="sp" />
        <ActBtn id="feature.toggle" testId={`feature.toggle.${d.id}.${f.id}`} params={{ product: d.id, feature: f.id, on: !on }} label={<span className={`sw ${on ? 'on' : ''}`}><i /></span>} />
      </div>
      <FeatureFxLine f={f} ch={d.channel} right={<span className={on ? 'ft-on' : 'dim'}>{on ? 'on' : 'off'}</span>} />
    </Tip></div>
  );
  if (building) return (
    <div className="ft2" data-feature={f.id}><Tip as="div" content={tip}>
      <div className="ft dim"><Hammer size={12} /><span className="ft-n">{toolName(f)}</span><span className="sp" /><span className="ft-s">building · {F.days(eta!)}</span></div>
      <FeatureFxLine f={f} ch={d.channel} />
    </Tip></div>
  );
  if (known) return (
    <div className="ft2" data-feature={f.id}><Tip as="div" content={tip}>
      <div className="ft"><ICON.product size={12} className="dim" /><span className="ft-n dim">{toolName(f)}</span><span className="sp" />
        <span className="ft-s dim">{F.money(f.cash)}</span><ActBtn id="feature.build" testId={`feature.build.${f.id}`} params={{ id: f.id }} label="Build" /></div>
      <FeatureFxLine f={f} ch={d.channel} />
    </Tip></div>
  );
  return (
    <div className="ft2" data-feature={f.id}><Tip as="div" content={tip}>
      <button className="ft locked" data-node={f.node} onClick={() => { store.setTab('research.sel', f.node ?? ''); store.goto('research', { tab: 'tree' }); }}>
        <Lock size={11} /><span className="ft-n">{toolName(f)}</span><span className="sp" /><FeatureKinds f={f} ch={d.channel} />
      </button>
      <div className="ft-fx" data-test={`feature-gate.${f.id}`}><ICON.research size={10} /><span className="ft-e">needs {gate}</span></div>
    </Tip></div>
  );
}

/** RD-P01a: the product's lineup under its Model row: the other real models it sells (in order, each removable), an
 *  "add a model" picker over the lab's ready models the channel can sell, and on Chat the free-tier slot. */
function LineupPicker({ s, d, n, set }: { s: GameStateV2; d: Deployment; n: Deployment; set: (c: ProductChanges) => void }) {
  const allowed = CHANNEL_VARIANTS[d.channel];
  const line = (n.lineup ?? []).filter((id) => id !== n.versionId);
  const addable = s.player.models.versions.filter((x) => usable(x) && x.id !== n.versionId && !line.includes(x.id) && (allowed.includes(x.variant) || (x.variant === 'mini' && allowed.includes('full'))));
  const chat = d.channel === 'consumer';
  const cheapest = chat ? freeTierVersion(s, { ...n, freeTierId: undefined }) : undefined;
  const tip = chat
    ? 'Chat\'s [[lineup]]: paying users always run the main model. Free users (everyone without a subscription) run the model in the free-tier slot, by default the cheapest one here to serve; with only the main model, free users run the main model at its full serving cost. Add a distilled mini or an older model to serve them more cheaply.'
    : 'Other models of yours this product also sells, each at its own fit and serving cost and this product\'s markup. In each band of task difficulty buyers take the one with the best surplus: cheaper models sell on easy work. Their share of the hours follows from the market, not a setting.';
  return (
    <Tip content={() => <TipCard title={<Term id="lineup">Lineup</Term>} value={`${1 + line.length} model${line.length ? 's' : ''}`}>{tip}</TipCard>}>
      <div className="pc-lineup" data-test={`prod-lineup-pick.${d.id}`}>
        {line.map((id) => (
          <span key={id} className="msel sub" data-test={`prod-lineup-entry.${d.id}.${id}`}>
            + {nameOf(s, id)}
            <button type="button" className="x" aria-label={`Remove ${nameOf(s, id)} from the lineup`} data-test={`prod-lineup-rm.${d.id}.${id}`} onClick={() => set({ lineup: line.filter((x) => x !== id), ...(n.freeTierId === id ? { freeTierId: null } : {}) })}><X size={10} /></button>
          </span>
        ))}
        {addable.length > 0 && (
          <select className="msel sub" data-test={`prod-lineup-add.${d.id}`} value="" onChange={(e) => e.target.value && set({ lineup: [...line, e.target.value] })}>
            <option value="">+ add a model</option>
            {addable.map((x) => <option key={x.id} value={x.id}>{x.name} · L {F.level(mL(s, x))}</option>)}
          </select>
        )}
        {chat && (
          <select className="msel sub" data-test={`prod-free.${d.id}`} value={n.freeTierId && (n.freeTierId === n.versionId || line.includes(n.freeTierId)) ? n.freeTierId : ''} onChange={(e) => set({ freeTierId: e.target.value || null })}>
            <option value="">free tier: cheapest ({cheapest?.name ?? '—'})</option>
            {[n.versionId, ...line].map((id) => <option key={id} value={id}>free tier: {nameOf(s, id)}</option>)}
          </select>
        )}
      </div>
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
  const catchB = d.monitorId ? catchRate(s, versionById(s, d.versionId), productMonitorVersion(s, d), false, true).rate : 0;
  const catchA = n.monitorId ? catchRate(s, versionById(s, n.versionId), productMonitorVersion(s, n), false, true).rate : 0;
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
          {b && a && <><span className="k"><Term id="bindingCause">Limited by</Term></span><span className="ba"><span className="o">{BOUND_WORD[b.bound]}</span>→<b>{BOUND_WORD[a.bound]}</b></span></>}
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
