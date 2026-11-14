// Shared v2 UI pieces (WS6): action buttons with engine previews, "why" tooltips from the cause ledger, glossary
// terms, unlock rules (§1.5, §6.8), small charts. Selectors only — never hidden truth.
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { actionView, causeStrip, choiceView } from '../../engine/v2';
import type { ActionView, CostLine, GameStateV2 } from '../../engine/v2';
import { GLOSSARY_V2 } from '../../data/v2/glossary';
import { Tip, TipCard as BaseTipCard } from '../Tooltip';
import { fmtNum } from '../components';
import { store, useV2 } from './store';

export { fmtB, fmtNum, fmtPct, fmtMult, fmtSigned, fmtDays, Meter, Bipolar, Spark, Slider, Seg, Toggle, Section, Row, Soon } from '../components';
export { Tip } from '../Tooltip';

/** TipCard whose string children render [[glossary]] links as nested tooltips. */
export function TipCard(p: Parameters<typeof BaseTipCard>[0]) {
  return <BaseTipCard {...p}>{typeof p.children === 'string' ? <Rich text={p.children} /> : p.children}</BaseTipCard>;
}

export type Params = Record<string, number | string | boolean>;

// ───────────────────────── acts and unlocks ─────────────────────────
export const ACT_NAMES = ['', 'Startup', 'Frontier race', 'Automation', 'Takeoff'] as const;
/** Act at which a panel or panel section unlocks (§1.5); tutorial off = all. */
export const UNLOCK_ACT: Record<string, 1 | 2 | 3 | 4> = {
  map: 1, finance: 1, departments: 1, models: 1, rundesigner: 1, deployments: 1, relations: 1, safety: 1, codex: 1,
  compute: 2, risk: 2, world: 3,
  baseRuns: 2, deals: 2, rivalIntel: 2, researchBodies: 2, commitments: 2, agendas: 2, index: 2, paradigms: 2,
  aiLabour: 3, paradigmT3: 3, chinaLadder: 3, theftMap: 3, statutes: 3, govLadder: 3,
  oversight: 4, treaty: 4,
};
export function unlocked(s: GameStateV2, key: string): boolean {
  if (!s.setup.tutorial || s.tutorial.unlocked.includes('*')) return true;
  return s.tutorial.act >= (UNLOCK_ACT[key] ?? 1);
}
export function LockedNote({ k }: { k: string }) {
  const act = UNLOCK_ACT[k] ?? 1;
  return (
    <div className="locked-note">
      <Lock size={12} /> Act {act} · {ACT_NAMES[act]}
    </div>
  );
}
/** Renders children only once `k` is unlocked; otherwise a lock line. */
export function Gate({ s, k, children }: { s: GameStateV2; k: string; children: ReactNode }) {
  return unlocked(s, k) ? <>{children}</> : <LockedNote k={k} />;
}

// ───────────────────────── glossary ─────────────────────────
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const g = GLOSSARY_V2[id];
  if (!g) return <>{children ?? id}</>;
  return (
    <Tip className="term" content={() => <TipCard title={g.title} footer={g.src}><Rich text={g.body} /></TipCard>}>
      {children ?? g.title}
    </Tip>
  );
}
/** Text with [[id]] / [[id|label]] glossary links as nested tooltips. */
export function Rich({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\[\[([a-zA-Z0-9_.:-]+)(?:\|([^\]]+))?\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<Term key={k++} id={m[1]}>{m[2] ?? GLOSSARY_V2[m[1]]?.title ?? m[1]}</Term>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// ───────────────────────── cost lines ─────────────────────────
const CUR_LABEL: Record<CostLine['currency'], string> = {
  cash: '$', revenue: 'rev', compute: 'compute', staffTime: 'staff', progress: 'L', leadDays: 'lead', trust: 'trust',
  credibility: 'cred', scrutiny: 'scrutiny', talent: 'talent', morale: 'morale', boardConf: 'board', approval: 'approval',
  security: 'security', monitorability: 'monitor', alignment: 'align', freedom: 'freedom', chinaTension: 'CN tension', dilution: 'dilution',
};
function amt(c: CostLine): string {
  const a = Math.abs(c.amount);
  switch (c.currency) {
    case 'cash': return a >= 1000 ? `$${(a / 1000).toFixed(1)}T` : `$${a >= 10 ? a.toFixed(0) : a >= 0.1 ? a.toFixed(1) : a.toFixed(2)}B`;
    case 'revenue': return `$${a >= 10 ? a.toFixed(0) : a.toFixed(1)}B/yr`;
    case 'compute': return a <= 1 && a > 0 ? `${(a * 100).toFixed(a < 0.1 ? 1 : 0)}%` : fmtNum(a);
    case 'leadDays': return `${Math.round(a)}d`;
    case 'progress': return `${a.toFixed(2)}`;
    case 'monitorability': case 'alignment': return a < 1 ? a.toFixed(2) : a.toFixed(0);
    case 'dilution': return a < 1 ? `${(a * 100).toFixed(1)}%` : `${a.toFixed(1)}%`;
    default: return a < 1 && a > 0 ? a.toFixed(2) : a.toFixed(a < 10 ? 1 : 0);
  }
}
export function lineText(c: CostLine, sign = true): string {
  const sg = sign ? (c.amount < 0 ? '−' : '+') : '';
  const label = c.currency === 'cash' ? '' : ` ${CUR_LABEL[c.currency]}`;
  return `${sg}${amt(c)}${label}`;
}
function lineMeta(c: CostLine): string {
  const bits: string[] = [];
  if (c.target) bits.push(String(c.target));
  if (c.probability !== undefined && c.probability < 1) bits.push(`p ${Math.round(c.probability * 100)}%`);
  if (c.lagDays) bits.push(`in ${Math.round(c.lagDays)}d`);
  return bits.join(' · ');
}
/** Full preview rows for tooltips. */
export function PreviewRows({ v }: { v: Pick<ActionView, 'costs' | 'gains' | 'exposure'> }) {
  const sect = (title: string, xs: CostLine[], tone: string, sign: boolean) =>
    xs.length ? (
      <div className="pv-sect">
        <div className={`pv-title ${tone}`}>{title}</div>
        {xs.map((c, i) => (
          <div className="pv-row" key={i}>
            <span className={tone}>{sign ? lineText(c) : lineText(c, false)}</span>
            <span className="dim">{lineMeta(c)}</span>
          </div>
        ))}
      </div>
    ) : null;
  return (
    <div className="pv">
      {sect('Cost', v.costs, 'tone-neg', false)}
      {sect('Gain', v.gains, 'tone-pos', false)}
      {sect('Exposure', v.exposure, 'tone-warn', true)}
    </div>
  );
}
/** One-line summary: first cost and first gain. */
export function PreviewInline({ v }: { v: Pick<ActionView, 'costs' | 'gains' | 'exposure'> }) {
  const c = v.costs.find((x) => x.amount !== 0) ?? v.costs[0];
  const g = v.gains.find((x) => x.amount !== 0) ?? v.gains[0];
  return (
    <span className="pv-inline num">
      {c && <span className="tone-neg">{lineText(c, false)}</span>}
      {g && <span className="tone-pos">{lineText(g, false)}</span>}
      {v.exposure.length > 0 && <span className="tone-warn">⚠{v.exposure.length}</span>}
    </span>
  );
}

/** Action button: label, inline cost/gain preview, full preview + unavailable reason on hover. */
export function ActBtn({
  id, params = {}, label, primary, small = true, onDone, inline = true, testId, block,
}: { id: string; params?: Params; label?: ReactNode; primary?: boolean; small?: boolean; onDone?: () => void; inline?: boolean; testId?: string; /** Extra UI-side blocker (e.g. the run plan's reason). */ block?: string }) {
  const st = useV2();
  const s = st.state;
  if (!s) return null;
  const v = actionView(s, id, params);
  if (v.ok === true && block) v.ok = block;
  const off = v.ok !== true;
  return (
    <Tip
      className="act-wrap"
      content={() => (
        <TipCard title={v.title} value={off ? <span className="tone-neg">{v.ok}</span> : undefined}>
          <PreviewRows v={actionView(s, id, params)} />
        </TipCard>
      )}
    >
      <button
        className={`btn ${small ? 'btn-sm' : ''} ${primary ? 'btn-primary' : ''} act-btn`}
        disabled={off}
        data-act={testId ?? id}
        onClick={() => {
          const err = store.act(id, params);
          if (!err) onDone?.();
        }}
      >
        <span>{label ?? v.title}</span>
        {inline && <PreviewInline v={v} />}
      </button>
    </Tip>
  );
}

/** Decision-choice button with its preview. */
export function ChoiceBtn({ s, eventId, instance, idx, isDefault }: { s: GameStateV2; eventId: string; instance: string; idx: number; isDefault?: boolean }) {
  const v = choiceView(s, eventId, idx);
  const off = v.ok !== true;
  return (
    <button className="choice" disabled={off} data-choice={idx} onClick={() => store.resolve(instance, idx)}>
      <div className="choice-top">
        <span className="choice-label">{v.title}</span>
        {isDefault && <span className="chip-mini dim">default</span>}
        {off && <span className="tone-neg small">{v.ok}</span>}
      </div>
      <PreviewRows v={v} />
    </button>
  );
}

// ───────────────────────── why tooltips ─────────────────────────
export function causeRows(s: GameStateV2, key: string, fmt: (x: number) => string = (x) => x.toFixed(1)) {
  return causeStrip(s, key, 30, 5).map((r) => ({
    label: <span>{r.source}{r.n > 1 ? <span className="dim"> ×{r.n}</span> : null}</span>,
    value: `${r.delta >= 0 ? '+' : '−'}${fmt(Math.abs(r.delta))}`,
    tone: (r.delta >= 0 ? 'pos' : 'neg') as 'pos' | 'neg',
  }));
}
/** Tooltip card listing the cause strip for a meter key (§2.6), plus optional extra rows/body. */
export function WhyCard({ s, k, title, value, body, rows, fmt }: { s: GameStateV2; k: string; title: ReactNode; value?: ReactNode; body?: ReactNode; rows?: { label: ReactNode; value: ReactNode; tone?: 'pos' | 'neg' | 'neutral' }[]; fmt?: (x: number) => string }) {
  const why = causeRows(s, k, fmt);
  return (
    <TipCard title={title} value={value} rows={[...(rows ?? []), ...(why.length ? [{ label: <b className="dim">Why · 30 d</b>, value: '' }, ...why] : [{ label: <span className="dim">No recorded change in 30 d</span>, value: '' }])]}>
      {body}
    </TipCard>
  );
}
/** Wrap a meter so it shows its "why" on hover. */
export function Why({ k, title, value, body, rows, fmt, children, className }: { k: string; title: ReactNode; value?: ReactNode; body?: ReactNode; rows?: { label: ReactNode; value: ReactNode; tone?: 'pos' | 'neg' | 'neutral' }[]; fmt?: (x: number) => string; children: ReactNode; className?: string }) {
  return (
    <Tip className={`has-tip ${className ?? ''}`} content={() => (store.state ? <WhyCard s={store.state} k={k} title={title} value={value} body={body} rows={rows} fmt={fmt} /> : null)}>
      {children}
    </Tip>
  );
}

// ───────────────────────── small visuals ─────────────────────────
export function Stack({ parts, h = 8 }: { parts: { v: number; color: string; label?: string }[]; h?: number }) {
  const tot = parts.reduce((a, p) => a + Math.max(0, p.v), 0) || 1;
  return (
    <div className="stack" style={{ height: h }}>
      {parts.map((p, i) => (
        <div key={i} title={p.label} style={{ width: `${(Math.max(0, p.v) / tot) * 100}%`, background: p.color }} />
      ))}
    </div>
  );
}
export function Band({ lo, hi, mid, max = 1, color = 'var(--accent)', width = 90 }: { lo: number; hi: number; mid?: number; max?: number; color?: string; width?: number }) {
  const f = (x: number) => `${Math.max(0, Math.min(1, x / max)) * 100}%`;
  return (
    <div className="bandbar" style={{ width }}>
      <div className="bandbar-fill" style={{ left: f(lo), width: `calc(${f(hi)} - ${f(lo)})`, background: color }} />
      {mid !== undefined && <div className="bandbar-mid" style={{ left: f(mid) }} />}
    </div>
  );
}
/** Domain radar with error bars (model card). */
export function Radar({ values, err = 0.4, max = 15, size = 170, compare }: { values: Record<string, number>; err?: number; max?: number; size?: number; compare?: Record<string, number> }) {
  const keys = Object.keys(values);
  const c = size / 2;
  const R = size / 2 - 18;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
    const r = (Math.max(0, Math.min(max, v)) / max) * R;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  };
  const poly = (vals: Record<string, number>) => keys.map((k, i) => pt(i, vals[k]).join(',')).join(' ');
  return (
    <svg width={size} height={size} className="radar">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={keys.map((_, i) => pt(i, max * f).join(',')).join(' ')} className="radar-grid" />
      ))}
      {compare && <polygon points={poly(compare)} className="radar-cmp" />}
      <polygon points={poly(values)} className="radar-val" />
      {keys.map((k, i) => {
        const [x1, y1] = pt(i, values[k] - err);
        const [x2, y2] = pt(i, values[k] + err);
        const [lx, ly] = pt(i, max * 1.13);
        return (
          <g key={k}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} className="radar-err" />
            <text x={lx} y={ly + 3} className="radar-lbl" textAnchor="middle">{k}</text>
          </g>
        );
      })}
    </svg>
  );
}
export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
export const sgn = (x: number, d = 0) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`;
export const days = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d))}d`;
export function tone(x: number, good = 0) {
  return x > good ? 'tone-pos' : x < good ? 'tone-neg' : 'tone-neutral';
}
export function Kpi({ label, value, sub, tip }: { label: string; value: ReactNode; sub?: ReactNode; tip?: () => ReactNode }) {
  const body = (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value num">{value}</div>
      {sub && <div className="small dim">{sub}</div>}
    </div>
  );
  return tip ? <Tip as="div" content={tip}>{body}</Tip> : body;
}
