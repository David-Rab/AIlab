// PRODUCTS (MK-13; design/MARKET.md M12, M13, M15; approved mockups design/ux/mockups/market/products.png,
// lineup-swap.png, DATA.md). Readouts and previews come from worldfx/marketView.ts (MK-12): the screen only lays them out.
// L1 #1: the totals strip (profit from products; serving compute served vs needed, short by, buyers turned away; your
// share of business buyers' AI spend, where it is heading and the top rival). L1 #2: one card per product in ladder order
// (Chat, API, Enterprise, Vetted): profit and margin, revenue bar on one shared scale (profit / serving cost), Users or
// Work sold and Price tiles, serving compute with its rationing consequence, the price-stance switch, the lineup (click a
// model to swap or remove it, "+ Add a model"), tools with certification marks, footer links; a launch card in the place
// of a product not launched. L2: the lineup popover (M13), the tools editor, the customers drawer. L3: tooltips.
// One home per datum: the business-buyer share lives on the strip only; safeguards on SAFETY › Safeguards; the serving
// split on LAB (the strip's Compute link).
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import {
  BadgeCheck, Blocks, Bot, Brain, BrainCircuit, Briefcase, Building2, CalendarClock, Check, ChevronRight, CircleCheck, Clock, Code, DoorOpen, DoorClosed, Eye, Gauge,
  Hammer, Lock, MessageCircle, MousePointer2, Palette, Plus, Rocket, Ruler, Server, Shield, ShieldCheck, SlidersHorizontal, SquareTerminal, Stethoscope,
  Telescope, Timer, Trash2, TrendingUp, TriangleAlert, Users, X,
  type LucideIcon,
} from 'lucide-react';
import { PRODUCT_DEFS } from '../../../data/v2/features';
import { PRODUCT_TOOLS, type ProductToolDef, type ProductToolId } from '../../../data/v2/tools';
import { CONSUMER_MKT, WIN_SHARE_FRACTION } from '../../../data/v2/serving';
import { SECTORS } from '../../../data/v2/sectors';
import { TREE_BY_ID } from '../../../data/v2/tree';
import {
  CHANNEL_VARIANTS, buildEtas, deployGate, dateOf, editBlock, fmtDate, isProduct,
  featureView, toolRivalsView, measuredLOf, nodeKnown, previewEdit, versionById,
  pendingLaunch, charterHolds, CERT_CASH, CERT_DAYS, CERT_FRICTION_CUT, CERT_SECTORS, AGENT_TASK_HOURS, agentsGate,
  limitReason, demandModifiers, agentsReady, winBack, marketBase, productCards, productsStrip, lineupSwapOptions, lineupAddOptions, lineupRemovePreview, stancePreview,
} from '../../../engine/v2';
import type {
  Channel, Deployment, FeatureKind, GameStateV2, ModelVersion, PriceStance, ProductChanges, ProductRead,
  ProductCard, ProductsStrip, EditDelta, LineupOption, LineupCardRow, ToolOnProduct, MarketNumbers,
} from '../../../engine/v2';
import { store, useV2 } from '../store';
import { ActBtn, Limit, Term, Tip, TipCard, type Params } from '../ui';
import { PanelHead, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import './products.css';

type MarketBase = ReturnType<typeof marketBase>;
type Ch4 = ProductCard['channel'];
const P_ICON: Partial<Record<Channel, LucideIcon>> = { consumer: MessageCircle, api: SquareTerminal, enterprise: Building2, vetted: ShieldCheck };
const STANCE_LABEL: Record<PriceStance, string> = { profit: 'Best profit', share: 'Win share' };
const BOUND_WORD: Record<string, string> = { capacity: 'serving compute', quality: 'quality', price: 'price', demand: 'demand' };
const TOOL_ICON: Record<ProductToolId, LucideIcon> = {
  coding: Code, research: Telescope, backOffice: Briefcase, clinical: Stethoscope, operations: CalendarClock, defence: Shield, creative: Palette,
  agentMode: Bot, computerUse: MousePointer2, memory: BrainCircuit, voiceVision: Eye, companion: MessageCircle,
};
const toolName = (f: ProductToolDef) => f.name;
const SECTOR_NAME = Object.fromEntries(SECTORS.map((x) => [x.id, x.name])) as Record<string, string>;
const CERT_SECTOR_IDS: readonly string[] = CERT_SECTORS;
const usable = (v: ModelVersion) => v.status === 'ready' || v.status === 'deployed';
const mL = (s: GameStateV2, v?: ModelVersion) => measuredLOf(s, v).L;
const pname = (ch: Channel) => PRODUCT_DEFS[ch]?.name ?? ch;
/** Dollars per unit: $0.21, $2.63, $22. */
const usd = (x: number) => `$${x >= 10 ? x.toFixed(0) : x.toFixed(2)}`;
/** Time to target in words ("~2 yr", "~8 mo"). */
const about = (d: number) => (d >= 330 ? `~${Math.round(d / 365)} yr` : d >= 45 ? `~${Math.round(d / 30.4)} mo` : `~${Math.max(1, Math.round(d / 7))} wk`);
const weeks = (w: number) => (!Number.isFinite(w) ? 'no engineers spare' : w < 1.5 ? '~1 wk' : `~${Math.round(w)} wk`);
const DRAWER = 'products.drawer';
const LADDER: Ch4[] = ['consumer', 'api', 'enterprise', 'vetted'];

/** Action params of an edit (product.update). */
function editParams(id: string, c: ProductChanges): Params {
  const p: Params = { id };
  if (c.versionId) p.versionId = c.versionId;
  if (c.lineup !== undefined) p.lineup = c.lineup.join(',');
  if (c.freeTierId !== undefined) p.freeTierId = c.freeTierId ?? '';
  if (c.monitorId !== undefined) p.monitorId = c.monitorId ?? '';
  if (c.stance) p.stance = c.stance;
  if (c.safeguards) p.safeguards = c.safeguards;
  if (c.kyc !== undefined) p.kyc = c.kyc;
  if (c.features) p.features = c.features.join(',');
  return p;
}

/** What the readouts depend on besides the day: the products as edited (so an edit re-reads the market at once). */
const depKey = (s: GameStateV2) => JSON.stringify([s.player.policies.servingAuto, s.player.features, s.player.deployments.map((d) => [d.id, d.status, d.versionId, d.lineup, d.freeTierId, d.stance, d.features, d.servingShare, d.safeguards, d.monitorId, (d.certs ?? []).length])]);

/** The lineup popover: swap a slot, or add a model (anchored beside the clicked row). */
interface PopAt { id: string; mode: 'swap' | 'add'; slot?: string; x: number; y: number; arrowY: number; side: 'left' | 'right' }
const POP_W = 690;

export function Products({ s }: { s: GameStateV2 }) {
  useV2();
  const key = depKey(s);
  const base = useMemo(() => marketBase(s), [s, s.time.day, key]);
  const cards = useMemo(() => productCards(s, base), [base]);
  const strip = useMemo(() => productsStrip(s, base), [base]);
  const [pop, setPop] = useState<PopAt | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const live = s.player.deployments.filter((d) => isProduct(d) && d.status !== 'withdrawn');
  const held = charterHolds(s).length;
  const scale = Math.max(1e-9, ...cards.map((c) => Math.max(c.money.revenue, c.money.servingCost)));

  /** Open the popover beside a lineup row (left of it when there is room, else right of its card). */
  const open = (id: string, mode: PopAt['mode'], slot: string | undefined, e: ReactMouseEvent<HTMLElement>) => {
    const c = root.current?.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    const card = e.currentTarget.closest('.pcard')?.getBoundingClientRect() ?? r;
    if (!c) return;
    const left = r.left - c.left - POP_W - 16 >= 0;
    const x = left ? r.left - c.left - POP_W - 16 : card.right - c.left + 14;
    const y = Math.max(0, r.top - c.top - 60);
    setPop({ id, mode, slot, x, y, arrowY: r.top - c.top + r.height / 2 - y, side: left ? 'left' : 'right' });
  };
  const toggle = (id: string, mode: PopAt['mode'], slot: string | undefined, e: ReactMouseEvent<HTMLElement>) => {
    if (pop && pop.id === id && pop.mode === mode && pop.slot === slot) setPop(null);
    else open(id, mode, slot, e);
  };
  useEffect(() => {
    if (!pop) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.tip.locked')) setPop(null); };
    const onDown = (e: globalThis.MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && !t.closest('[data-test=lu-pop]') && !t.closest('[data-lu]') && !t.closest('.tip')) setPop(null);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [pop]);

  return (
    <div className="panel-v2 prod" data-panel="products" ref={root}>
      <PanelHead icon={ICON.deploy} title="Products"
        right={<span className="row-i prod-pol">
          {held > 0 && <Ref id="charterHolds" to={{ panel: 'finance', tab: 'owners', anchor: 'board' }}><Lock size={11} /> Safety committee holds {held} model{held > 1 ? 's' : ''}</Ref>}
          <Policies s={s} live={live} />
        </span>} />
      <Strip strip={strip} cards={cards} />
      <div className="prd-cards">
        {LADDER.map((ch) => {
          const c = cards.find((x) => x.channel === ch);
          const d = c && s.player.deployments.find((x) => x.id === c.id);
          return c && d
            ? <PCard key={ch} s={s} d={d} c={c} base={base} scale={scale} pop={pop} toggle={toggle} />
            : <LaunchCard key={ch} s={s} ch={ch} />;
        })}
      </div>
      {pop && <LineupPop key={`${pop.id}:${pop.mode}:${pop.slot ?? ''}`} s={s} at={pop} base={base} close={() => setPop(null)} />}
      <ProductDrawer s={s} base={base} openSwap={(id, slot) => {
        const row = root.current?.querySelector<HTMLElement>(`[data-lu="${id}:${slot}"]`);
        if (row) open(id, 'swap', slot, { currentTarget: row } as unknown as ReactMouseEvent<HTMLElement>);
      }} />
    </div>
  );
}

// ───────── header: policies ─────────
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

// ───────── L1 #1: the totals strip ─────────
function Strip({ strip, cards }: { strip: ProductsStrip; cards: ProductCard[] }) {
  const m = strip.money;
  const cp = strip.compute;
  const b = strip.business;
  const shortBy = cp.short > 0.5;
  const pct = cp.need > 0 ? Math.min(1, (cp.need - cp.short) / cp.need) : 1;
  const spare = Math.max(0, cp.pool - (cp.need - cp.short));
  const spareShown = !shortBy && spare > Math.max(1000, cp.pool * 0.02);
  const top = Math.max(b.share, b.target, b.rival?.share ?? 0) > 0.46 ? 1 : 0.5;
  const X = (v: number) => `${(Math.min(v, top) / top) * 100}%`;
  const moving = Math.abs(b.target - b.share) > 0.005;
  const lose = b.target < b.share;
  const profitTip = () => <TipCard title={<Term id="profit">Profit from products</Term>} value={F.money(m.profit, { perYear: true })}
    rows={[...cards.map((c) => ({ label: c.name, value: F.money(c.money.profit, { perYear: true }), tone: (c.money.profit < 0 ? 'neg' : 'neutral') as 'neg' | 'neutral' })),
      { label: 'Revenue', value: F.money(m.revenue, { perYear: true }) }, { label: <Term id="runCost">Serving cost</Term>, value: F.money(m.servingCost, { perYear: true }) }, { label: <Term id="profitMargin">Margin</Term>, value: F.pct(m.margin) }]}>
    {'Every live product\'s revenue minus its [[runCost|serving cost]], a year at today\'s buyers and prices. Engineering upkeep, research and training are paid elsewhere (FINANCE).'}</TipCard>;
  const computeTip = () => <TipCard title={<Term id="servingCompute">Serving compute</Term>} value={`${F.h100e(cp.need - cp.short)} of ${F.h100e(cp.need)} H100e`}
    rows={[{ label: 'Products\' compute', value: `${F.h100e(cp.pool)} H100e` }, { label: 'Needed by your buyers', value: `${F.h100e(cp.need)} H100e` }, { label: 'Short by', value: `${F.h100e(cp.short)} H100e`, tone: shortBy ? 'neg' : 'neutral' },
      ...cards.filter((c) => c.compute.short > 0.5).map((c) => ({ label: `${c.name} short by`, value: `${F.h100e(c.compute.short)} H100e` }))]}>
    {'What your products\' buyers need against the compute the products get (your [[split|compute allocation]] on LAB). A product short of it keeps its price and serves only what it can: the rest of its buyers are [[turnedAway|turned away]].'}</TipCard>;
  const awayTip = () => <TipCard title={<Term id="turnedAway">Buyers turned away</Term>} value={F.money(strip.turnedAway.dollars, { perYear: true })}
    rows={[...cards.filter((c) => c.turnedAway.dollars > 0.0005).map((c) => ({ label: c.name, value: F.money(c.turnedAway.dollars, { perYear: true }) })),
      { label: 'Taken by your other products', value: F.money(strip.turnedAway.keptByYou, { perYear: true }) }]}>
    At each product&apos;s list price, a year: buyers it could not serve for want of serving compute. They buy from their next choice: a rival, another product of yours, or no AI.</TipCard>;
  const shareTip = () => <TipCard title={<Term id="segmentShare">Your share of business buyers&apos; AI spend</Term>} value={`${F.pct(b.share, 1)} → ${F.pct(b.target, 1)}`}
    rows={[{ label: 'Now', value: F.pct(b.share, 1) }, { label: <Term id="targetShare">Where buyers are heading</Term>, value: F.pct(b.target, 1), tone: moving ? (lose ? 'neg' : 'pos') : 'neutral' },
      { label: 'Time to get there', value: !moving ? 'there now' : Number.isFinite(b.days) ? about(b.days) : 'more than 3 yr' },
      ...(b.rival ? [{ label: `Top rival: ${b.rival.name}`, value: F.pct(b.rival.share, 1) }] : [])]}
    footer="API, Enterprise and Vetted together, all sectors and regions, weighted by spend. The rival's share is your estimate.">
    {'Your lab holds its [[customerStock|customers]]; they move toward where buyers are heading over weeks to months, so a release or a price change pays off gradually. Chat users are counted on the Chat card.'}</TipCard>;
  return (
    <section className="card2 mk-strip" data-test="prod-strip">
      <div className="blk" data-home="productProfit">
        <div className="cap"><Term id="profit">Profit</Term> from products</div>
        <Tip content={profitTip}><div className="big" data-test="prod-profit-total">{F.money(m.profit)}<span className="u">/yr</span></div></Tip>
        <Tip content={profitTip}><div className="t3 sm">revenue <b className="n t2">{F.money(m.revenue)}</b> − <Term id="runCost">serving cost</Term> <b className="n t2">{F.money(m.servingCost)}</b></div></Tip>
      </div>
      <div className="blk" data-home="productServing">
        <div className="row-i"><span className="cap"><Term id="servingCompute">Serving compute</Term></span><span className="sp" />
          <button className="ref-chip prd-srv" data-test="prod-serving-link" data-ref="servingLab" onClick={() => store.goto('lab', { anchor: 'split' })}><Server size={12} /> Compute <ChevronRight size={12} /></button></div>
        <Tip as="div" content={computeTip}>
          <div className="row-i srv-n"><b className="n w">{F.h100e(cp.need - cp.short)}</b><span className="t2">of {F.h100e(cp.need)} <Term id="h100e">H100e</Term> needed</span><span className="sp" />
            {shortBy ? <span className="chip2 warn" data-test="prod-short"><TriangleAlert size={12} /> short {F.h100e(cp.short)}</span> : spareShown ? <span className="chip2" data-test="prod-spare"><Check size={12} /> spare {F.h100e(spare)}</span> : <span className="chip2 good"><Check size={12} /> all served</span>}</div>
          <div className="cbar big2"><i style={{ width: `${pct * 100}%` }} /></div>
        </Tip>
        <Tip content={awayTip}><div className="t3 sm" data-test="prod-away-total">Buyers <Term id="turnedAway">turned away</Term> <b className="n t2">{F.money(strip.turnedAway.dollars)}/yr</b></div></Tip>
      </div>
      <div className="blk" data-home="businessShare">
        <div className="row-i"><span className="cap">Business buyers</span><span className="sp" /><span className="t3 sm">your <Term id="segmentShare">share</Term> of their AI spend</span></div>
        <Tip as="div" content={shareTip}>
          <div className="trk" data-test="prod-share">
            <div className="ax" />
            {moving && <div className={`arr ${lose ? 'lose' : 'gain'}`} style={{ left: X(Math.min(b.share, b.target)), width: `${(Math.abs(b.target - b.share) / top) * 100}%` }} />}
            {moving && <div className="tgt" style={{ left: X(b.target) }} />}
            {b.rival && <div className="rv" style={{ left: X(b.rival.share) }} />}
            <div className="now" style={{ left: X(b.share) }} />
            {[0, top / 2, top].map((t) => <span key={t} className="tl2" style={{ left: X(t) }}>{F.pct(t)}</span>)}
          </div>
          <div className="row-i sh-v"><b className="n w">{F.pct(b.share)}</b>{moving ? <><span className={lose ? 'dn' : 'up'}>→ {F.pct(b.target)}</span><span className="t3">{Number.isFinite(b.days) ? `in ${about(b.days)}` : 'in over 3 yr'}</span></> : <span className="t3">holding</span>}
            <span className="sp" />{b.rival && <><span className="rvm">▼</span><span className="t2">{b.rival.name} {F.pct(b.rival.share)}</span></>}</div>
        </Tip>
      </div>
    </section>
  );
}

// ───────── L1 #2: the product card ─────────
function PCard({ s, d, c, base, scale, pop, toggle }: { s: GameStateV2; d: Deployment; c: ProductCard; base: MarketBase; scale: number; pop: PopAt | null; toggle: (id: string, mode: PopAt['mode'], slot: string | undefined, e: ReactMouseEvent<HTMLElement>) => void }) {
  const Icon = P_ICON[c.channel] ?? ICON.product;
  const chat = c.channel === 'consumer';
  const m = c.money;
  const w = (v: number) => (Math.max(0, v) / scale) * 100;
  const drawerOpen = store.tab[DRAWER] === d.id;
  const focus = pop?.id === d.id;
  const moneyTip = () => <TipCard title={<><Term id="profit">Profit</Term> · {c.name}</>} value={F.money(m.profit, { perYear: true })}
    rows={[{ label: 'Revenue', value: F.money(m.revenue, { perYear: true }) }, { label: <Term id="runCost">Serving cost</Term>, value: F.money(m.servingCost, { perYear: true }) }, { label: <Term id="profitMargin">Margin</Term>, value: F.pct(m.margin) }]}
    footer="The bar is on one scale for all four products.">
    {'Revenue − [[runCost|serving cost]] a year at today\'s buyers and prices.'}</TipCard>;
  return (
    <section className={`card2 pcard ${focus ? 'focus' : ''} ${drawerOpen ? 'sel' : ''}`} data-product={d.id} data-channel={d.channel}>
      <div className="ph2">
        <span className="pi"><Icon size={18} /></span>
        <div className="pnw">
          <div className="pn"><Term id={chat ? 'product' : c.channel === 'vetted' ? 'vetted' : 'product'}>{c.name}</Term>{d.held && <span className="chip2 warn xs">held</span>}</div>
          <Tip content={() => <TipCard title={<Term id="buyerGroups">{chat ? 'Who buys Chat' : 'Buyer groups'}</Term>} value={c.buyers.label}>{c.buyers.tip}</TipCard>}>
            <div className="who"><Users size={12} /> {c.buyers.label}</div>
          </Tip>
        </div>
      </div>

      <div className="pf">
        <div className="row-i"><span className="cap"><Term id="profit">Profit</Term></span><span className="sp" />
          <Tip content={moneyTip}><span className="t3 sm"><Term id="profitMargin">margin</Term> <b className="n t2" data-test={`prod-margin.${d.id}`}>{F.pct(m.margin)}</b></span></Tip></div>
        <Tip as="div" content={moneyTip}><div className={`pbig ${m.profit < 0 ? 'neg' : ''}`} data-test={`prod-profit.${d.id}`}>{F.money(m.profit)}<span className="u">/yr</span></div></Tip>
        <Tip as="div" content={moneyTip}>
          <div className="rbar"><i className="pr" style={{ width: `${w(m.profit)}%` }} /><i className="co" style={{ left: `${w(m.profit)}%`, width: `${Math.min(100 - w(m.profit), w(m.servingCost))}%` }} /></div>
          <div className="rlbl"><span><i className="sw pr" />revenue <b className="n t2">{F.money(m.revenue)}</b></span><span><i className="sw co" /><Term id="runCost">serving cost</Term> <b className="n t2">{F.money(m.servingCost)}</b></span></div>
        </Tip>
      </div>

      <Tiles c={c} />
      <ServingSec c={c} />
      <StanceSwitch s={s} d={d} base={base} />
      <LineupSec c={c} pop={pop} toggle={toggle} />
      <ToolsSec s={s} d={d} c={c} />

      <div className="pfoot">
        <button className="ref-chip" data-test={`prod-open.${d.id}`} onClick={() => store.setTab(DRAWER, drawerOpen ? '' : d.id)}><Users size={12} /> {chat ? 'Users' : 'Customers by sector'} <ChevronRight size={12} /></button>
        <Ref id="productSafeguards" to={{ panel: 'safety', tab: 'safeguards' }}><Shield size={12} /> Safeguards</Ref>
      </div>
    </section>
  );
}

/** Users (Chat) or Work sold (business), and the price. */
function Tiles({ c }: { c: ProductCard }) {
  if (c.chat) {
    const ch = c.chat;
    return (
      <div className="kv3">
        <Tip as="div" content={() => <TipCard title={<Term id="weeklyReach">Users</Term>} value={F.count(ch.users)} rows={[{ label: 'Weekly users', value: F.count(ch.users) }, { label: <Term id="paidShare">Paying users</Term>, value: `${F.count(ch.paying)} · ${F.pct(ch.users > 0 ? ch.paying / ch.users : 0, 1)}` }]}>People who use Chat at least once a week; most are on the free plan. Paying users bring its revenue.</TipCard>}>
          <div className="k">Users</div><div className="v" data-test={`prod-users.${c.id}`}>{F.count(ch.users)}</div><div className="s">weekly users · {F.count(ch.paying)} pay</div>
        </Tip>
        <Tip as="div" content={() => <TipCard title={<Term id="hourPrice">Plan price</Term>} value={`${usd(ch.price)} a month`} rows={[{ label: <Term id="wtp">What people pay at most</Term>, value: `${usd(ch.cap)} a month` }]}>{`A paying user's serving cost plus a margin set by competition among paid chat plans: the more of the paying users your lab holds, the higher the margin they accept. Never above what people pay for a plan (${usd(CONSUMER_MKT.wtpMonth)} a month), never below a paying user's serving cost.`}</TipCard>}>
          <div className="k">Price</div><div className="v" data-test={`prod-price.${c.id}`}>{usd(ch.price)}</div><div className="s">per month{ch.atCap ? ' · at the cap' : ''}</div>
        </Tip>
      </div>
    );
  }
  const wk = c.work!;
  return (
    <div className="kv3">
      <Tip as="div" content={() => <TipCard title={<Term id="workSold">Work sold</Term>} value={`${F.count(wk.hours)} h a year`} rows={[
        ...(wk.seats ? [{ label: <Term id="paidSeat">Seats</Term>, value: `${F.count(wk.seats.seats)} at ${usd(wk.seats.price)} a month` }] : []),
        ...(wk.fromOwn > 0.5 ? [{ label: 'Taken from your other products', value: `${F.count(wk.fromOwn)} h` }] : []),
      ]}>{'Hours of work a year its buyers get done with it and pay for, served: tasks firms hand over, [[agentHour|agent-hours]] and the hours of paid seats.'}</TipCard>}>
        <div className="k">Work sold</div><div className="v" data-test={`prod-hours.${c.id}`}>{F.count(wk.hours)}</div><div className="s">hours of work a year</div>
      </Tip>
      <Tip as="div" content={() => <TipCard title={<Term id="hourPrice">Price per hour</Term>} value={`${usd(wk.avgPrice)}/h`} rows={[
        ...wk.perModel.map((x) => ({ label: x.name, value: `${usd(x.price)}/h` })),
        ...(wk.agentHour ? [{ label: <Term id="agentHour">Agent-hour</Term>, value: `${usd(wk.agentHour)}/h` }] : []),
        ...(wk.seats ? [{ label: <Term id="paidSeat">Seat</Term>, value: `${usd(wk.seats.price)} a month` }] : []),
      ]}>{'Revenue ÷ work sold. Each model sells at its own serving cost plus a margin set by competition ([[priceTier|price stance]]), never above what the work is worth to the buyer.'}</TipCard>}>
        <div className="k">Price</div><div className="v" data-test={`prod-price.${c.id}`}>{usd(wk.avgPrice)}</div><div className="s">per hour</div>
      </Tip>
    </div>
  );
}

/** Serving compute served vs needed, and the one-line consequence of rationing. */
function ServingSec({ c }: { c: ProductCard }) {
  const cp = c.compute;
  const ta = c.turnedAway;
  const chat = c.channel === 'consumer';
  const short = cp.short > 0.5;
  const pct = cp.need > 0 ? Math.min(1, cp.served / cp.need) : 1;
  const tip = () => <TipCard title={<Term id="servingCompute">Serving compute</Term>} value={`${F.h100e(Math.min(cp.served, cp.need))} of ${F.h100e(cp.need)} H100e`}
    rows={[{ label: 'Needed by its buyers', value: `${F.h100e(cp.need)} H100e` }, { label: 'Served', value: `${F.h100e(cp.served)} H100e` },
      ...(short ? [{ label: 'Short by', value: `${F.h100e(cp.short)} H100e`, tone: 'neg' as const }] : cp.spare > 0.5 ? [{ label: 'Spare', value: `${F.h100e(cp.spare)} H100e` }] : [])]}>
    {chat ? 'Paying users are served first; free users get fewer messages when compute is short (rate-limited), and they do not leave for it.' : 'A product short of serving compute keeps its price and serves the same share of every buyer\'s work; the rest buy from their next choice.'}</TipCard>;
  const awayTip = () => <TipCard title={<Term id="turnedAway">Buyers turned away</Term>} value={chat ? `${F.count(ta.subs)} paying users` : `${F.money(ta.dollars, { perYear: true })}`}
    rows={[...(chat ? [] : [{ label: 'Work', value: `${F.count(ta.hours)} h a year` }]),
      ...ta.to.slice(0, 6).map((x) => ({ label: x.kind === 'none' ? 'Buy no AI' : `To ${x.name}`, value: chat ? `${F.count(x.subs)} users` : `${F.count(x.hours)} h` }))]}>
    At its list price, a year. It rations rather than raise its price: each buyer gets the same share of its work served.</TipCard>;
  let line: ReactNode = null;
  if (chat && (cp.freeLimited || cp.payingShort)) {
    line = cp.payingShort
      ? <Tip content={awayTip}><div className="away" data-test={`prod-away.${c.id}`}><DoorOpen size={14} /> <b className="n">{F.count(ta.subs)}</b> paying users <Term id="turnedAway">turned away</Term></div></Tip>
      : <Tip content={tip}><div className="away" data-test={`prod-away.${c.id}`}><Timer size={14} /> <Term id="freeTier">Free users</Term> rate-limited <span className="t3">· paying users all served</span></div></Tip>;
  } else if (short && ta.dollars > 0.0005) {
    line = <Tip content={awayTip}><div className="away" data-test={`prod-away.${c.id}`}><DoorOpen size={14} /> <b className="n">{F.money(ta.dollars)}/yr</b> of buyers <Term id="turnedAway">turned away</Term></div></Tip>;
  } else if (short) {
    line = <Tip content={tip}><div className="away" data-test={`prod-away.${c.id}`}><DoorClosed size={14} /> short by {F.h100e(cp.short)} H100e</div></Tip>;
  } else {
    line = <Tip content={tip}><div className="away ok"><CircleCheck size={14} /> all buyers served</div></Tip>;
  }
  return (
    <div className="sec2" data-test={`prod-serving.${c.id}`}>
      <Tip as="div" content={tip}>
        <div className="sh"><span className="cap"><Term id="servingCompute">Serving compute</Term></span><span className="sp" /><span className="t3 sm"><b className="n t2">{F.h100e(Math.min(cp.served, cp.need))}</b> of {F.h100e(cp.need)} needed</span></div>
        <div className="cbar"><i style={{ width: `${pct * 100}%` }} /></div>
      </Tip>
      {line}
    </div>
  );
}

/** Price stance: Best profit / Win share, through product.update (stance). The tooltip previews tomorrow's change. */
function StanceSwitch({ s, d, base }: { s: GameStateV2; d: Deployment; base: MarketBase }) {
  const chat = d.channel === 'consumer';
  const later = chat
    ? 'Buyers move over the following weeks: your [[customerStock|share of users]] and the [[paidShare|paid share]] adjust gradually, so what the stance does to them comes later than this.'
    : 'Buyers move over the following weeks: your [[customerStock|customer share]] adjusts gradually, so what the stance does to it comes later than this.';
  const optTip = (t: PriceStance) => () => {
    if (t === d.stance) return <TipCard title={<Term id={t === 'profit' ? 'bestProfit' : 'winShare'}>{STANCE_LABEL[t]}</Term>} value="current">{t === 'profit' ? 'Each model at its serving cost plus its full margin, set by competition.' : `Each model at its serving cost plus ${F.pct(WIN_SHARE_FRACTION)} of that margin.`}</TipCard>;
    const pv = stancePreview(s, d.id, base);
    const dl = pv?.delta;
    return <TipCard title={<><Term id={t === 'profit' ? 'bestProfit' : 'winShare'}>{STANCE_LABEL[t]}</Term> from {fmtDate(dateOf(s, s.time.day + 1))}</>} value={dl && !dl.blocked ? <span className={dl.all.profit < 0 ? 'tone-neg' : 'tone-pos'}>{F.money(dl.all.profit, { signed: true, perYear: true })}</span> : undefined}
      rows={dl && !dl.blocked ? [{ label: 'Profit a year, from tomorrow', value: F.money(dl.all.profit, { signed: true, perYear: true }), tone: dl.all.profit < 0 ? 'neg' : 'pos' }] : dl?.blocked ? [{ label: 'Blocked', value: dl.blocked, tone: 'neg' }] : []}
      footer="At today's buyers.">{`${t === 'share' ? `Prices drop to ${F.pct(WIN_SHARE_FRACTION)} of the margin over serving cost.` : 'Prices go back to the full margin over serving cost.'} ${later}`}</TipCard>;
  };
  return (
    <div className="setrow" data-test={`prod-stance.${d.id}`}>
      <span className="k"><Term id="priceTier">Price stance</Term></span>
      <span className="seg3">
        {(['profit', 'share'] as PriceStance[]).map((t) => {
          const I = t === 'profit' ? TrendingUp : Users;
          return (
            <Tip key={t} content={optTip(t)}>
              <button className={d.stance === t ? 'on' : ''} data-opt={t} data-test={`prod-stance-opt.${d.id}.${t}`}
                onClick={() => { if (d.stance !== t) store.act('product.update', { id: d.id, stance: t }); }}><I size={12} /> {STANCE_LABEL[t]}</button>
            </Tip>
          );
        })}
      </span>
    </div>
  );
}

/** Lineup rows: measured skill, share of hours or "sells nothing" (Chat: whom each serves); click to swap; add row. */
function LineupSec({ c, pop, toggle }: { c: ProductCard; pop: PopAt | null; toggle: (id: string, mode: PopAt['mode'], slot: string | undefined, e: ReactMouseEvent<HTMLElement>) => void }) {
  const chat = c.channel === 'consumer';
  const SERVES: Record<NonNullable<LineupCardRow['serves']>, string> = { paying: 'paying users', free: 'free users', 'paying and free': 'all users', nobody: 'serves nobody' };
  return (
    <div className="sec2" data-test={`prod-lineup.${c.id}`}>
      <div className="sh"><span className="cap"><Term id="lineup">Lineup</Term></span><span className="sp" />{!chat && <span className="t3 xs">buyers pick per task</span>}</div>
      <div className="lu hd2"><span /><span>model</span><span><Term id="L">skill</Term></span><span>{chat ? 'serves' : <Term id="workSold">hours sold</Term>}</span></div>
      {c.lineup.map((r, k) => {
        const sel = pop?.id === c.id && pop.mode === 'swap' && pop.slot === r.id;
        const rowTip = (x: LineupCardRow) => () => <TipCard title={x.name} value={x.main ? 'main model' : `lineup model ${k + 1}`} rows={[
          { label: <Term id="L">Skill on tests</Term>, value: F.level(x.skill) },
          ...(chat ? [{ label: 'Serves', value: SERVES[x.serves ?? 'nobody'] }] : x.sellsNothing ? [{ label: 'Hours sold', value: 'none' }] : [{ label: 'Share of hours', value: F.pct(x.share, 1) }, { label: <Term id="hourPrice">Price per hour</Term>, value: `${usd(x.price)}/h` }]),
        ]} footer={x.main ? 'Click to replace it (the main model cannot be removed).' : 'Click to replace it or remove it.'} />;
        const dead = chat ? r.serves === 'nobody' : r.sellsNothing;
        return (
          <div key={r.id} className={`lu row-m ${sel ? 'sel' : ''} ${dead ? 'dead' : ''}`} data-lu={`${c.id}:${r.id}`} data-test={`prod-tier.${c.id}.${k}`} role="button"
            onClick={(e) => toggle(c.id, 'swap', r.id, e)}>
            <Tip content={rowTip(r)}><span className="ro">{k + 1}</span></Tip>
            <Tip className="mn-w" content={rowTip(r)}><span className="mn">{r.name}{r.main && <span className="mtag">main</span>}</span></Tip>
            <Tip content={() => <TipCard title={<Term id="L">Skill on tests</Term>} value={F.level(r.skill)}>{`${r.name}'s measured skill${r.evaluating ? ' (its parent\'s reading: its own tests are running)' : ''}. The bar runs from your weakest to your strongest model.`}</TipCard>}>
              <span className="sk"><i style={{ width: `${Math.max(3, r.skillPos * 100)}%` }} /></span>
            </Tip>
            {chat
              ? <span className={`t2 sm ${dead ? 't3' : ''}`}>{SERVES[r.serves ?? 'nobody']}</span>
              : dead
                ? <Tip content={() => <TipCard title={`${r.name} sells nothing`}>In every band of tasks, buyers find a better offer for the price: another model in this lineup or a rival&apos;s.</TipCard>}><span className="t3 sm">sells nothing</span></Tip>
                : <Tip content={() => <TipCard title={r.name} value={`${F.pct(r.share, 1)} of hours`} rows={[{ label: 'Hours sold a year', value: `${F.count(r.hours)} h` }, { label: <Term id="hourPrice">Price per hour</Term>, value: `${usd(r.price)}/h` }]}>{r.main ? 'Does the hardest tasks the product sells.' : 'Sells where buyers find it the best offer for the price.'}</TipCard>}>
                  <span className="hbw"><span className="hb"><i style={{ width: `${Math.min(1, r.share) * 100}%` }} /></span><span className="pc">{F.pct(r.share)}</span></span>
                </Tip>}
          </div>
        );
      })}
      <Tip content={() => <TipCard title="Add a model" value={`${c.canAdd} you could add`}>{c.canAdd ? 'Ready models of yours this product can sell. Each row previews the change a year in profit, work sold and serving compute.' : 'No ready model of yours that this product can sell is left out of it.'}</TipCard>}>
        <button className={`addm ${pop?.id === c.id && pop.mode === 'add' ? 'sel' : ''}`} data-lu={`${c.id}:add`} data-test={`prod-lineup-add.${c.id}`} disabled={!c.canAdd} onClick={(e) => toggle(c.id, 'add', undefined, e)}>
          <Plus size={14} /> Add a model <span className="t3">· {c.canAdd} you could add</span>
        </button>
      </Tip>
    </div>
  );
}

/** Tools as chips (with certification marks) and "+ Add a tool" (the tools editor). */
function ToolsSec({ s, d, c }: { s: GameStateV2; d: Deployment; c: ProductCard }) {
  const [add, setAdd] = useState(false);
  const fits = PRODUCT_TOOLS.filter((f) => (f.products as Channel[]).includes(d.channel));
  const etas = buildEtas(s).etas;
  const more = c.tools.more.length;
  return (
    <div className="sec2" data-test={`prod-feats.${d.id}`}>
      <div className="sh"><span className="cap"><Term id="feature">Tools</Term></span></div>
      <div className="tools">
        {c.tools.on.map((t) => <ToolChip key={t.id} s={s} d={d} t={t} />)}
        <Tip content={() => <TipCard title="Tools that fit" value={`${more} more`} rows={c.tools.more.map((x) => ({ label: x.name, value: x.built ? 'built: switch on' : 'build first' }))}>{'Tools this product could carry. Engineers build a tool once for the whole lab; then switch it on per product.'}</TipCard>}>
          <button className={`tool add ${add ? 'on' : ''}`} data-test={`prod-tool-add.${d.id}`} onClick={() => setAdd(!add)}>{add ? <X size={14} /> : <Plus size={14} />} {add ? 'Close' : more ? 'Add a tool' : 'Tools'} {!add && more > 0 && <span className="t3">· {more} more fit</span>}</button>
        </Tip>
      </div>
      {add && <div className="prd-edit pc-feat">{fits.map((f) => <FeatureRow key={f.id} s={s} d={d} f={f} eta={etas.get(s.player.build.queue.find((it) => it.kind === 'feature' && it.ref === f.id)?.id ?? '')} />)}</div>}
    </div>
  );
}

function ToolChip({ s, d, t }: { s: GameStateV2; d: Deployment; t: ToolOnProduct }) {
  const f = PRODUCT_TOOLS.find((x) => x.id === t.id)!;
  const I = TOOL_ICON[t.id] ?? Blocks;
  return (
    <Tip content={() => <FeatureTip s={s} d={d} f={f} certs={t} />}>
      <span className="tool" data-tool={t.id}><I size={14} /><span>{t.name}</span>
        {t.certs.map((x) => (
          <span key={x.sector} className={`cert ${x.state}`} data-cert={x.sector}>
            {x.state === 'certified' ? <BadgeCheck size={12} /> : <Clock size={12} />}{x.name}{x.state === 'certifying' ? ` ${F.days(x.daysLeft)}` : ''}
          </span>
        ))}
      </span>
    </Tip>
  );
}

// ───────── a product not launched: the launch card in its place ─────────
function LaunchCard({ s, ch }: { s: GameStateV2; ch: Ch4 }) {
  const ready = useMemo(() => agentsReady(s), [s, s.time.day]);
  const vs = s.player.models.versions.filter((v) => usable(v) && CHANNEL_VARIANTS[ch].includes(v.variant)).sort((a, b) => mL(s, b) - mL(s, a));
  const v = vs[0];
  // The launch gate (safety committee holds, missing variant): the button is blocked with its reason.
  const gate = v ? deployGate(s, v, ch) : `${pname(ch)} needs a ${CHANNEL_VARIANTS[ch].join(' or ')} model: train one on Next run`;
  const Icon = P_ICON[ch] ?? ICON.product;
  const pend = pendingLaunch(s, ch);
  const eta = pend ? buildEtas(s).etas.get(pend.id) : undefined;
  return (
    <section className="card2 pcard agents" data-test="prod-launch" data-launch={ch}>
      <div className="ph2">
        <span className="pi"><Icon size={18} /></span>
        <div className="pnw"><div className="pn">{pname(ch)}</div><div className="who"><Users size={12} /> {ch === 'consumer' ? 'the public' : ch === 'api' ? 'small firms & developers' : ch === 'enterprise' ? 'large firms' : 'government, military, critical infrastructure, regulated firms'}</div></div>
        <span className="sp" />
        {pend
          ? <Tip content={() => <TipCard title="Being built" rows={[{ label: 'Work left', value: `${(pend.needTW - pend.doneTW).toFixed(1)} of ${pend.needTW.toFixed(0)} team-weeks` }]}>Engineers build the launch; it goes live when built.</TipCard>}><span className="chip2" data-test="prod-launch-building"><Hammer size={11} /> {eta !== undefined && Number.isFinite(eta) ? `live in ${F.days(eta)}` : 'waits for engineers'}</span></Tip>
          : <span className="chip2">not launched</span>}
      </div>
      <div className="dim">{PRODUCT_DEFS[ch]?.blurb}</div>
      <div className="lfoot">
        {pend
          ? <ActBtn id="build.cancel" testId={`product.launch.cancel.${ch}`} params={{ id: pend.id }} label="Cancel launch" />
          : <ActBtn id="product.launch" testId={`product.launch.${ch}`} params={{ channel: ch, ...(v ? { versionId: v.id } : {}) }} primary icon={Rocket} label={<>Launch {pname(ch)}</>} block={gate === true ? undefined : gate} reason />}
        {!pend && <Tip content={() => <TipCard title="Time to launch" value={weeks(ready.weeks)}>Engineers build the launch: the time at today's spare engineering capacity. It goes live when built.</TipCard>}><span className="dim small">{weeks(ready.weeks)} of engineering</span></Tip>}
      </div>
    </section>
  );
}

// ───────── L2: the lineup popover (M13) ─────────
function LineupPop({ s, at, base, close }: { s: GameStateV2; at: PopAt; base: MarketBase; close: () => void }) {
  const d = s.player.deployments.find((x) => x.id === at.id);
  const chat = d?.channel === 'consumer';
  const opts = useMemo<LineupOption[]>(() => (at.mode === 'swap' && at.slot ? lineupSwapOptions(s, at.id, at.slot, base) : lineupAddOptions(s, at.id, base)), [base, at.id, at.mode, at.slot]);
  const rm = useMemo(() => (at.mode === 'swap' && at.slot ? lineupRemovePreview(s, at.id, at.slot, base) : undefined), [base, at.id, at.mode, at.slot]);
  // The white tick on each skill bar: the model being replaced (add mode: the main model).
  // `short`: the product turns buyers away today, so "all buyers served" after an option is news worth a line.
  const { tick, short } = useMemo(() => {
    const c = productCards(s, base).find((x) => x.id === at.id);
    return { tick: c?.lineup.find((r) => r.id === (at.slot ?? d?.versionId))?.skillPos, short: !!c && (c.compute.short > 0.5 || c.turnedAway.hours + c.turnedAway.subs > 1) };
  }, [base, at.id, at.slot]);
  if (!d) return null;
  const slotName = at.slot ? versionById(s, at.slot)?.name ?? at.slot : '';
  const apply = (c: ProductChanges) => { if (!store.act('product.update', editParams(d.id, c))) close(); };
  const signed = (x: number, f: (v: number) => string) => (Math.abs(x) < 1e-9 ? '0' : f(x));
  const cells = (dl: EditDelta) => {
    const a = dl.all;
    const tn = (x: number, goodUp = true) => (Math.abs(x) < 1e-6 ? 't2' : (x > 0) === goodUp ? 'good' : 'bad');
    return <>
      <span className={`n ${tn(a.profit)}`}>{signed(a.profit, (x) => F.money(x, { signed: true }))}</span>
      <span className={`n ${tn(chat ? a.paying : a.hours)}`}>{chat ? signed(a.paying, (x) => F.count(x, true)) : `${signed(a.hours, (x) => F.count(x, true))} h`}</span>
      <span className={`n ${tn(a.need, false)}`}>{signed(a.need, (x) => F.count(x, true))}</span>
    </>;
  };
  const rowTip = (title: ReactNode, dl: EditDelta) => () => {
    if (dl.blocked) return <TipCard title={title} value={<span className="tone-neg">not allowed</span>}>{dl.blocked}</TipCard>;
    const r = (label: ReactNode, x: (n: MarketNumbers) => number, f: (v: number) => string, goodUp = true) => {
      const v = x(dl.all);
      return { label, value: `${f(x(dl.product))} here · ${f(v)} all products`, tone: (Math.abs(v) < 1e-6 ? 'neutral' : (v > 0) === goodUp ? 'pos' : 'neg') as 'pos' | 'neg' | 'neutral' };
    };
    return <TipCard title={title} value="change a year" rows={[
      r(<Term id="profit">Profit</Term>, (n) => n.profit, (v) => F.money(v, { signed: true })),
      r('Revenue', (n) => n.revenue, (v) => F.money(v, { signed: true })),
      chat ? r(<Term id="paidShare">Paying users</Term>, (n) => n.paying, (v) => F.count(v, true)) : r(<Term id="workSold">Work sold</Term>, (n) => n.hours, (v) => `${F.count(v, true)} h`),
      r(<Term id="servingCompute">Serving compute need</Term>, (n) => n.need, (v) => `${F.count(v, true)} H100e`, false),
      r(<Term id="turnedAway">Buyers turned away</Term>, (n) => n.turnedAway, (v) => F.money(v, { signed: true }), false),
    ]} footer={`From ${fmtDate(dateOf(s, dl.fromDay))}, at today's buyers. Buyers then move over the following weeks.`}>
      {'Your other products gain or lose buyers and serving compute too: "all products" is the change to your lab.'}</TipCard>;
  };
  return (
    <div className={`lu-pop ${at.side}`} data-test="lu-pop" data-mode={at.mode} style={{ left: at.x, top: at.y, width: POP_W, ['--ay' as string]: `${at.arrowY}px` }}>
      <div className="phd">
        <span className="w">{at.mode === 'swap' ? <>Replace {slotName}</> : <>Add a model to {pname(d.channel)}</>}</span><span className="sp" />
        <span className="t3 xs">change per year</span>
        <button className="x" aria-label="Close" data-test="lu-pop-close" onClick={close}><X size={14} /></button>
      </div>
      <div className="po hd3"><span>model</span><span><Term id="L">skill</Term></span><span><Term id="servingFlop">cost to serve</Term></span><span><Term id="profit">profit</Term></span><span>{chat ? <Term id="paidShare">paying users</Term> : <Term id="workSold">hours sold</Term>}</span><span><Term id="servingCompute">compute need</Term></span></div>
      {opts.length === 0 && <div className="t3 sm pempty">No other ready model of yours can go here.</div>}
      {opts.map((o) => (
        <Tip key={o.id} as="div" content={rowTip(<>{at.mode === 'swap' ? `${slotName} → ${o.name}` : `Add ${o.name}`}</>, o.delta)}>
          <button className={`po ${o.delta.blocked ? 'off' : ''}`} data-opt={o.id} disabled={!!o.delta.blocked} onClick={() => apply(o.delta.changes)}>
            <span className="mn">{o.name}{o.isNew && <span className="chip2 good xs">new</span>}</span>
            <span className="sk"><i style={{ width: `${Math.max(3, o.skillPos * 100)}%` }} />{tick !== undefined && <b style={{ left: `${tick * 100}%` }} />}</span>
            <span className="n t2">×{o.costRatio >= 10 ? o.costRatio.toFixed(1) : o.costRatio.toFixed(2)}</span>
            {o.delta.blocked ? <span className="n bad span3">{o.delta.blocked}</span> : cells(o.delta)}
          </button>
          {short && o.delta.allServed && !o.delta.blocked && <div className="pnote"><CircleCheck size={12} /> all buyers served</div>}
        </Tip>
      ))}
      {rm && (
        <Tip as="div" content={rowTip(`Remove ${slotName}`, rm)}>
          <button className="po rm" data-opt="remove" data-test="lu-pop-remove" disabled={!!rm.blocked} onClick={() => apply(rm.changes)}>
            <span className="mn"><Trash2 size={14} /> Remove from lineup</span><span /><span />
            {rm.blocked ? <span className="n bad span3">{rm.blocked}</span> : cells(rm)}
          </button>
        </Tip>
      )}
      {at.mode === 'swap' && at.slot === d.versionId && <div className="t3 xs pfoot2">The main model cannot be removed: replace it.</div>}
    </div>
  );
}

// ───────── L2: product drawer ─────────
function ProductDrawer({ s, base, openSwap }: { s: GameStateV2; base: MarketBase; openSwap: (id: string, slot: string) => void }) {
  const id = store.tab[DRAWER] ?? '';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.tip')) store.setTab(DRAWER, ''); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const d = s.player.deployments.find((x) => x.id === id && x.status !== 'withdrawn');
  const r = d ? base.reads.get(d.id) : undefined;
  if (!d || !r) return null;
  const close = () => store.setTab(DRAWER, '');
  const Icon = P_ICON[d.channel] ?? ICON.product;
  return (
    <>
      <div className="pf-scrim" onClick={close} />
      <aside className="pf-drawer prd-drawer" data-test="prod-drawer" data-card={d.id}>
        <div className="pf-dh"><Icon size={20} className="dim" /><h2>{pname(d.channel)} · {d.channel === 'consumer' ? 'Users' : 'Customers'}</h2><span className="sp" /><button className="btn btn-sm btn-ghost" aria-label="Close" data-test="prod-drawer-close" onClick={close}><X size={16} /></button></div>
        <SectorShares s={s} d={d} r={r} />
        <div className="prd-limit" data-test="prod-limit">
          <div className="row-i"><Gauge size={17} /><b><Term id="bindingCause">Limited by</Term> {BOUND_WORD[r.bound]}</b></div>
          <div>{limitReason(r)}</div>
          <div className="lim-rows" data-test="prod-limits">
            <Limit id="price.valueCap" tone={r.valueCapped > 0.05 ? 'warn' : 'quiet'}>{F.pct(r.valueCapped)} of sales at what the work is worth</Limit>
            <Limit id="product.rationed" tone={r.turnedAway.dollars > 0.005 ? 'warn' : 'quiet'}>{r.turnedAway.dollars > 0.005 ? `${F.money(r.turnedAway.dollars)}/yr of buyers turned away` : 'no buyers turned away'}</Limit>
            <Limit id="product.demandMods" tone="quiet">{(() => { const m = demandModifiers(s, d); return m.length ? m.map((x) => (Number.isNaN(x.mult) ? x.label : `${x.label} ×${x.mult.toFixed(2)}`)).join(' · ') : 'no demand modifiers'; })()}</Limit>
          </div>
        </div>
        <WinBackSec s={s} d={d} close={close} openSwap={openSwap} />
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

function WinBackSec({ s, d, close, openSwap }: { s: GameStateV2; d: Deployment; close: () => void; openSwap: (id: string, slot: string) => void }) {
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
              : <button className="btn btn-sm" data-test="prod-winback-model" onClick={() => { close(); openSwap(d.id, d.versionId); }}>Preview</button>}
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
            <div><div className="ot">Certify {pname(d.channel)} for {o.name.split(/[ ,]/)[0]} with {o.toolName}</div><Tip as="div" className="os" content={() => <TipCard title="Certification" rows={[{ label: 'Harness', value: o.built ? `${o.toolName} (built)` : `build ${o.toolName}` }, { label: 'Then', value: `${CERT_DAYS} days · ${F.money(CERT_CASH)}` }, { label: 'Buyers there', value: `adoption friction −${CERT_FRICTION_CUT}` }]} />}>{o.built ? 'Switch it on' : `${weeks(o.weeks)} of engineering`}, then {CERT_DAYS} days and {F.money(CERT_CASH)} · your {o.name.split(/[ ,]/)[0]} buyers adopt more easily</Tip></div>
            {o.built
              ? <ActBtn id="feature.toggle" testId={`prod-winback-cert.${d.id}`} params={{ product: d.id, feature: o.tool, on: true }} label="Switch on" />
              : <ActBtn id="feature.build" testId={`prod-winback-cert.${d.id}`} params={{ id: o.tool }} label="Build" />}
          </div>
        );
      })}
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
function FeatureTip({ s, d, f, certs }: { s: GameStateV2; d: Deployment; f: ProductToolDef; certs?: ToolOnProduct }) {
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
    ...(f.agentGateH !== undefined ? [agentGateRow(s, d)] : []),
    ...(f.risk ? [{ label: 'Cost / risk', value: f.risk }] : []),
    ...(certs?.certs ?? []).map((x) => ({ label: <Term id="certification">{`Certified: ${x.name}`}</Term>, value: x.state === 'certified' ? 'certified' : x.state === 'certifying' ? `in ${F.days(x.daysLeft)}` : `starts tomorrow: ${CERT_DAYS} days, ${F.money(CERT_CASH)}`, tone: (x.state === 'certified' ? 'pos' : 'neutral') as 'pos' | 'neutral' })),
  ]} footer={certs?.certs.length ? `Certified, this product's buyers in the sector adopt more easily (friction −${CERT_FRICTION_CUT}) while the harness stays on.` : undefined}>{f.effect}</TipCard>;
}

/** The feature's type chips (icon + word). */
function FeatureKinds({ f, ch }: { f: ProductToolDef; ch: Channel }) {
  const ks = featureView(f, ch).kinds;
  return <>{ks.map((k) => { const I = FT_ICON[k]; return <span key={k} className="ft-k" data-kind={k}><I size={10} />{ks.length === 1 && FT_LABEL[k]}</span>; })}</>;
}

/** Type chips and the short typed effect (second line of a feature row). */
function FeatureFxLine({ f, ch, right }: { f: ProductToolDef; ch: Channel; right?: ReactNode }) {
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

/** Agent mode's gate on this product's model (the tooltip row): its measured time horizon against the tasks it sells. */
function agentGateRow(s: GameStateV2, d: Deployment) {
  const g = agentsGate(versionById(s, d.versionId));
  return { label: 'Needs', value: g === true ? `a time horizon of ${AGENT_TASK_HOURS} h: this product's model has it` : g, tone: (g === true ? 'pos' : 'neg') as 'pos' | 'neg' };
}

function FeatureRow({ s, d, f, eta }: { s: GameStateV2; d: Deployment; f: ProductToolDef; eta?: number }) {
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

