// v2 component kit (DESIGN-SYSTEM §4): cards, tabs, gauges, cause chains, go buttons, pills, option tiles and the
// action card with before→after bars. Presentational: data comes in through props (plus read-only selectors for
// meterOf). IA markers: `home` sets data-home (one home per datum), `Ref` sets data-ref (a link, never the value).
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ActionView, CostLine, GameStateV2 } from '../../engine/v2';
import { activeRivals, leadDays } from '../../engine/v2';
import { C } from './theme';
import * as F from './fmt';
import { ICON } from './icons';
import { store } from './store';
import { Rich, Term, termEntry, Tip, TipCard, pctAmt, unitAmt } from './ui';

// ───────── layout ─────────
export function Card({ title, sub, right, children, home, id, className, term }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children?: ReactNode; home?: string; id?: string; className?: string; term?: string }) {
  return (
    <section className={`card2 ${className ?? ''}`} data-home={home} id={id}>
      {(title || right) && (
        <div className="card2-hd">
          {title && <span className="card2-ttl">{term ? <Term id={term}>{title}</Term> : title}</span>}
          {sub && <span className="card2-sub">{sub}</span>}
          <span className="sp" />
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
export function PanelHead({ icon: Icon, title, sub, right, tabs }: { icon: LucideIcon; title: string; sub?: ReactNode; right?: ReactNode; tabs?: ReactNode }) {
  return (
    <div className="phead">
      <Icon size={20} className="phead-ic" />
      <h1>{title}</h1>
      {sub && <span className="phead-sub">{sub}</span>}
      {tabs}
      <span className="sp" />
      {right}
    </div>
  );
}
export interface TabDef { id: string; label: string; icon?: LucideIcon; badge?: ReactNode }
/** Tabs bound to store.tab[panel]. */
export function Tabs({ panel, tabs, def }: { panel: string; tabs: TabDef[]; def?: string }) {
  const cur = store.tab[panel] ?? def ?? tabs[0].id;
  return (
    <div className="tabs2" data-tabs={panel}>
      {tabs.map((t) => (
        <button key={t.id} className={`tab2 ${cur === t.id ? 'on' : ''}`} data-tab={t.id} onClick={() => store.setTab(panel, t.id)}>
          {t.icon && <t.icon size={14} />}{t.label}{t.badge !== undefined && t.badge !== 0 && t.badge !== '' && <span className="tab2-badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}
export const tabOf = (panel: string, def: string) => store.tab[panel] ?? def;

// ───────── links ─────────
export interface GoTarget { panel: string; tab?: string; anchor?: string }
export function GoBtn({ to, label, testId }: { to: GoTarget; label: ReactNode; testId?: string }) {
  return (
    <button className="btn btn-sm go-btn" data-go={testId ?? `${to.panel}${to.tab ? `.${to.tab}` : ''}${to.anchor ? `#${to.anchor}` : ''}`} onClick={() => store.goto(to.panel, to)}>
      {label} <ICON.go size={12} />
    </button>
  );
}
/** A reference to a datum whose home is elsewhere: names it, never repeats the value; click jumps home. */
export function Ref({ id, to, children }: { id: string; to: GoTarget; children: ReactNode }) {
  return (
    <button className="ref-chip" data-ref={id} onClick={() => store.goto(to.panel, to)}>
      {children} <ICON.go size={11} />
    </button>
  );
}

// ───────── chips and pills ─────────
export function Pill({ kind = 'neu', children, title }: { kind?: 'cost' | 'gain' | 'exp' | 'neu' | 'warn' | 'bad' | 'good'; children: ReactNode; title?: string }) {
  // Jank O1: the explanation is a real tooltip (it was a native title the tooltip coverage could not see).
  const pill = <span className={`pill2 ${kind}`}>{children}</span>;
  return title ? <Tip content={() => <TipCard title={children}>{title}</TipCard>}>{pill}</Tip> : pill;
}
export interface ChainLink { label: ReactNode; icon?: LucideIcon; kind?: 'root' | 'bad' | 'mid'; to?: GoTarget; tip?: () => ReactNode }
/** Cause chain: root (amber, actionable) ▸ … ▸ symptom (red). Each link may jump or explain. */
export function CauseChain({ links }: { links: ChainLink[] }) {
  return (
    <span className="chain2">
      {links.map((l, i) => {
        const body = (
          <span className={`lk ${l.kind ?? 'mid'} ${l.to ? 'click' : ''}`} onClick={l.to ? () => store.goto(l.to!.panel, l.to) : undefined}>
            {l.icon && <l.icon size={12} />}{l.label}
          </span>
        );
        return (
          <span key={i} className="chain2-it">
            {i > 0 && <span className="ar">›</span>}
            {l.tip ? <Tip content={l.tip}>{body}</Tip> : body}
          </span>
        );
      })}
    </span>
  );
}

// ───────── gauges and bars ─────────
/** Half-circle gauge with status zones, an optional band arc, and a needle or fill. */
export function Gauge({ value, max, zones, band, w = 52, h = 32, fill, stroke = 5 }: { value: number; max: number; zones?: { to: number; color: string }[]; band?: [number, number]; w?: number; h?: number; fill?: string; stroke?: number }) {
  const cx = w / 2;
  const cy = h - 4;
  const r = Math.min(cx - stroke, cy - 2);
  const ang = (x: number) => Math.PI * (1 - Math.max(0, Math.min(max, x)) / max);
  const pt = (x: number) => [cx + r * Math.cos(ang(x)), cy - r * Math.sin(ang(x))];
  const arc = (a: number, b: number, col: string, sw = stroke, op = 1) => {
    const [x0, y0] = pt(a);
    const [x1, y1] = pt(b);
    return <path d={`M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`} stroke={col} strokeWidth={sw} fill="none" opacity={op} strokeLinecap={zones ? 'butt' : 'round'} />;
  };
  let lo = 0;
  return (
    <svg width={w} height={h} className="gauge">
      {arc(0, max, C.line)}
      {zones?.map((z, i) => { const a = lo; lo = z.to; return <g key={i}>{arc(a, Math.min(max, z.to), z.color, stroke, 0.55)}</g>; })}
      {band && arc(band[0], band[1], fill ?? C.watch, stroke, 0.35)}
      {fill && arc(0, value, fill)}
      {!fill && (() => { const [x, y] = pt(value); return <><line x1={cx} y1={cy} x2={cx + (x - cx) * 0.85} y2={cy + (y - cy) * 0.85} stroke="#fff" strokeWidth={2} strokeLinecap="round" /><circle cx={cx} cy={cy} r={2.5} fill="#fff" /></>; })()}
    </svg>
  );
}
/** Simple horizontal bar 0..max with optional colour and marker. */
export function HBar({ v, max = 1, color = C.und, w = 120, h = 6, mark }: { v: number; max?: number; color?: string; w?: number | string; h?: number; mark?: number }) {
  const f = (x: number) => `${Math.max(0, Math.min(1, x / Math.max(1e-9, max))) * 100}%`;
  return (
    <span className="hbar" style={{ width: w, height: h }}>
      <i style={{ width: f(v), background: color }} />
      {mark !== undefined && <b style={{ left: f(mark) }} />}
    </span>
  );
}
/** Sparkline over a series. */
export function Spark2({ data, w = 80, h = 20, color = C.und }: { data: number[]; w?: number; h?: number; color?: string }) {
  if (data.length < 2) return <svg width={w} height={h} />;
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - ((v - mn) / Math.max(1e-9, mx - mn)) * (h - 4)}`).join(' ');
  return <svg width={w} height={h} className="spark2"><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} /></svg>;
}

// ───────── option tiles (run designer, gates) ─────────
export function OptionTile({ label, icon: Icon, glyphs, active, locked, onClick, tip, testId }: { label: ReactNode; icon?: LucideIcon; glyphs?: ReactNode; active?: boolean; locked?: string; onClick?: () => void; tip?: () => ReactNode; testId?: string }) {
  const body = (
    <button className={`otile ${active ? 'on' : ''} ${locked ? 'locked' : ''}`} disabled={!!locked} onClick={onClick} data-opt={testId}>
      <span className="otile-top">{Icon && <Icon size={13} />}<span>{label}</span></span>
      <span className="otile-gl">{locked ? <span className="dim">{locked}</span> : glyphs}</span>
    </button>
  );
  return tip ? <Tip content={tip}>{body}</Tip> : body;
}

// ───────── action card: before → after on the meters a choice touches ─────────
interface Meter { label: string; term?: string; icon: LucideIcon; get: (s: GameStateV2, target?: string) => number; lo: number; hi: (v: number, d: number) => number; fmt: (x: number) => string; upGood: boolean }
const bestLead = (s: GameStateV2) => Math.min(...activeRivals(s).map((r) => leadDays(s, r.core.id).est), leadDays(s, 'china').est);
const TRUST_OF = (s: GameStateV2, t?: string) => {
  const st = s.relations.stocks as Record<string, { trust: number }>;
  if (t && st[t]) return st[t].trust;
  return st.exec?.trust ?? 50;
};
export const METERS: Partial<Record<CostLine['currency'], Meter>> = {
  cash: { label: 'Cash', term: 'cash', icon: ICON.cash, get: (s) => s.player.finance.cash, lo: 0, hi: (v, d) => Math.max(v, v + d) * 1.25 + 1, fmt: (x) => F.money(x), upGood: true },
  revenue: { label: 'Revenue', term: 'revenueRun', icon: ICON.revenue, get: (s) => s.player.finance.revenueRun, lo: 0, hi: (v, d) => Math.max(v, v + d) * 1.25 + 1, fmt: (x) => F.money(x, { perYear: true }), upGood: true },
  trust: { label: 'Trust', term: 'trust', icon: ICON.trust, get: TRUST_OF, lo: 0, hi: () => 100, fmt: F.idx, upGood: true },
  credibility: { label: 'Credibility', term: 'credibility', icon: ICON.credibility, get: (s) => s.relations.credibility, lo: 0, hi: () => 100, fmt: F.idx, upGood: true },
  scrutiny: { label: 'Scrutiny', term: 'scrutiny', icon: ICON.scrutiny, get: (s) => s.relations.scrutiny, lo: 0, hi: () => 100, fmt: F.idx, upGood: false },
  approval: { label: 'Approval', term: 'approval', icon: ICON.approval, get: (s) => s.pub.approval, lo: -100, hi: () => 100, fmt: (x) => F.num(x, 0, true), upGood: true },
  boardConf: { label: 'Board', term: 'boardConf', icon: ICON.board, get: (s) => s.player.board.confidence, lo: 0, hi: () => 100, fmt: F.idx, upGood: true },
  morale: { label: 'Morale', term: 'morale', icon: ICON.morale, get: (s) => s.player.morale.overall, lo: 0, hi: () => 100, fmt: F.idx, upGood: true },
  talent: { label: 'Talent pull', term: 'talentPull', icon: ICON.taste, get: (s) => s.relations.talentPull, lo: 0, hi: () => 100, fmt: F.idx, upGood: true },
  leadDays: { label: 'Lead', term: 'lead', icon: ICON.lead, get: bestLead, lo: -365, hi: () => 365, fmt: F.lead, upGood: true },
  security: { label: 'WSL', term: 'wsl', icon: ICON.wsl, get: (s) => s.player.security.wsl, lo: 0, hi: () => 5, fmt: (x) => x.toFixed(1), upGood: true },
};
/** Net effect per currency of a view: gains − costs (exposure kept apart as probabilistic). */
/** Currencies where a higher meter is worse: a cost RAISES them, a gain lowers them. */
export const BAD_UP = new Set<CostLine['currency']>(['scrutiny', 'chinaTension', 'dilution']);
export function netByCurrency(v: Pick<ActionView, 'costs' | 'gains'>) {
  const m = new Map<CostLine['currency'], { d: number; target?: string }>();
  for (const c of v.gains) { const e = m.get(c.currency) ?? { d: 0, target: c.target }; e.d += (BAD_UP.has(c.currency) ? -1 : 1) * c.amount; m.set(c.currency, e); }
  for (const c of v.costs) { const e = m.get(c.currency) ?? { d: 0, target: c.target }; e.d -= (BAD_UP.has(c.currency) ? -1 : 1) * Math.abs(c.amount); m.set(c.currency, e); }
  return m;
}
/** Before→after bar for one meter (hypothetical; the "before" tick is an unlabeled reference mark). */
export function BeforeAfter({ s, cur, d, target }: { s: GameStateV2; cur: CostLine['currency']; d: number; target?: string }) {
  const m = METERS[cur];
  if (!m) return null;
  const v = m.get(s, target);
  const hi = m.hi(v, d);
  const f = (x: number) => `${Math.max(0, Math.min(1, (x - m.lo) / Math.max(1e-9, hi - m.lo))) * 100}%`;
  const after = v + d;
  const good = m.upGood ? d > 0 : d < 0;
  return (
    <div className="ba">
      <span className="ba-lbl"><m.icon size={12} />{m.term ? <Term id={m.term}>{m.label}</Term> : m.label}</span>
      <span className="ba-track">
        <i className="ba-fill" style={{ width: f(Math.min(v, after)) }} />
        {d !== 0 && <i className={`ba-delta ${good ? 'good' : 'bad'}`} style={{ left: f(Math.min(v, after)), width: `calc(${f(Math.max(v, after))} - ${f(Math.min(v, after))})` }} />}
        <b style={{ left: f(v) }} />
      </span>
      <span className={`ba-val num ${d === 0 ? 'dim' : good ? 'tone-pos' : 'tone-neg'}`}>{d === 0 ? '—' : `${d > 0 ? '+' : '−'}${m.fmt(Math.abs(d)).replace(/^[+−]/, '')}`}</span>
    </div>
  );
}
const lineAmt = (c: CostLine) => {
  const m = METERS[c.currency];
  const a = Math.abs(c.amount);
  if (c.unit === '%') return `${pctAmt(a)}%`;
  if (c.unit) return `${unitAmt(a)} ${c.unit}`;
  if (c.currency === 'cash') return F.money(a);
  if (c.currency === 'revenue') return F.money(a, { perYear: true });
  if (c.currency === 'valuation') return `${F.money(a)} valuation`;
  if (c.currency === 'leadDays') return `${Math.round(a)} d lead`;
  if (c.currency === 'compute') return a <= 1 ? `${F.pct(a)} compute` : `${F.count(a)} H100e`;
  // Dilution lines are in percent (finance actions, E32); a fraction reading turned 0.5% into 50%.
  if (c.currency === 'dilution') return `${a.toFixed(1)}% stake`;
  // RD-B19 (MEA-19): a 'progress' line carries its unit (lint-tradeoffs); a bare one is not a level.
  if (c.currency === 'progress') return `${unitAmt(a)} progress`;
  if (c.currency === 'staffTime' && a >= 10) return `${F.count(a)} staff`; // heads (E32, E22); small amounts are percent
  return `${a < 1 && a > 0 ? a.toFixed(2) : a.toFixed(a < 10 ? 1 : 0)} ${m?.label.toLowerCase() ?? F.words(c.currency)}`;
};
export function CostPills({ v }: { v: Pick<ActionView, 'costs' | 'gains' | 'exposure'> }) {
  const meta = (c: CostLine) => [c.condition, c.target, c.probability !== undefined && c.probability < 1 ? `p ${Math.round(c.probability * 100)}%` : '', c.lagDays ? `in ${Math.round(c.lagDays)} d` : ''].filter(Boolean).join(' · ');
  return (
    <span className="pills">
      {v.costs.filter((c) => c.amount !== 0).map((c, i) => <Pill key={`c${i}`} kind="cost" title={meta(c)}>{BAD_UP.has(c.currency) ? '+' : '−'}{lineAmt(c)}</Pill>)}
      {v.gains.filter((c) => c.amount !== 0).map((c, i) => <Pill key={`g${i}`} kind="gain" title={meta(c)}>{BAD_UP.has(c.currency) ? '−' : '+'}{lineAmt(c)}</Pill>)}
      {v.exposure.filter((c) => c.amount !== 0).map((c, i) => <Pill key={`e${i}`} kind="exp" title={meta(c)}>{c.amount < 0 ? '−' : '+'}{lineAmt(c)}{c.probability !== undefined && c.probability < 1 ? ` · p ${Math.round(c.probability * 100)}%` : ''}</Pill>)}
    </span>
  );
}
/** Decision / relation action card: icon · verb · pills · before→after bars · key hint. */
export function ActionCard({ s, v, keyHint, isDefault, disabled, onClick, note, testAttr }: { s: GameStateV2; v: Pick<ActionView, 'title' | 'costs' | 'gains' | 'exposure'>; keyHint?: string; isDefault?: boolean; disabled?: string; onClick: () => void; note?: ReactNode; testAttr?: Record<string, string | number> }) {
  const net = [...netByCurrency(v).entries()].filter(([c]) => METERS[c]).slice(0, 4);
  return (
    <button className={`acard ${disabled ? 'off' : ''}`} disabled={!!disabled} onClick={onClick} {...Object.fromEntries(Object.entries(testAttr ?? {}).map(([k, x]) => [`data-${k}`, x]))}>
      <div className="acard-top">
        <b>{v.title}</b>
        {isDefault && <span className="tag2">default</span>}
        <span className="sp" />
        {keyHint && <span className="kbd">{keyHint}</span>}
      </div>
      <CostPills v={v} />
      {net.length > 0 && <div className="acard-bars">{net.map(([c, e]) => <BeforeAfter key={c} s={s} cur={c} d={e.d} target={e.target} />)}</div>}
      {disabled && <div className="act-reason">{disabled}</div>}
      {note && <div className="acard-note">{note}</div>}
    </button>
  );
}

/** A labelled value whose label is a glossary term (for card rows). */
export function KV({ k, term, children, home, tip }: { k: ReactNode; term?: string; children: ReactNode; home?: string; tip?: () => ReactNode }) {
  const v = <span className="kv-v num" data-home={home}>{children}</span>;
  // Jank O1: every value opens a tooltip; without a breakdown of its own it explains the term it measures.
  const g = term ? termEntry(term) : undefined;
  const dflt = () => <TipCard title={term ? <Term id={term}>{k}</Term> : k} value={children}>{g ? <Rich text={g.body} /> : undefined}</TipCard>;
  return (
    <div className="kv">
      <span className="kv-k">{term ? <Term id={term}>{k}</Term> : k}</span>
      <Tip content={tip ?? dflt}>{v}</Tip>
    </div>
  );
}
export { TipCard };

/** UB-4 (VOCAB §1, OQ-1): an effective-compute change given in orders of magnitude, in player units: "+10%",
 *  "−9%", "×2.5", "÷2.5". OOM never reaches the player. */
export function effX(dOom: number): string {
  const m = Math.pow(10, dOom);
  if (Math.abs(dOom) < 0.0005) return '±0%';
  if (m >= 2) return `×${m >= 10 ? m.toFixed(0) : m.toFixed(1)}`;
  if (m <= 0.5) return `÷${1 / m >= 10 ? (1 / m).toFixed(0) : (1 / m).toFixed(1)}`;
  const p = (m - 1) * 100;
  return `${p >= 0 ? '+' : '−'}${Math.abs(p) >= 10 ? Math.abs(p).toFixed(0) : Math.abs(p).toFixed(1)}%`;
}
/** A multiplier given in orders of magnitude, as "×2.5" (know-how and effective-compute totals). */
export const effMult = (oom: number) => { const m = Math.pow(10, oom); return `×${m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(1) : m.toFixed(2)}`; };
/** UB-4 (VOCAB §3 MODELS): skill-domain display names. Domain codes never reach the player. */
export const DOMAIN_WORD: Record<string, string> = { CODE: 'Code', RSCH: 'AI research', REASON: 'Math & reasoning', AGENCY: 'Long tasks', SOCIAL: 'Social', MEDIA: 'Media', CYBER: 'Cyber', BIO: 'Bio', PHYS: 'Physical' };
export const domainWord = (d?: string) => (d ? DOMAIN_WORD[d] ?? d : '');
/** UB-4: model states in player words. */
export const STATUS_WORD: Record<string, string> = { evaluating: 'Testing', ready: 'Ready', deployed: 'In use', retired: 'Retired', rolledBack: 'Rolled back' };
/** UB-4: model kinds (variant) in player words. */
export const VARIANT_WORD: Record<string, string> = { full: 'full size', mini: 'smaller size', imported: 'imported' };
