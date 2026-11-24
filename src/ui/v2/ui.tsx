// Shared v2 UI pieces (WS6): action buttons with engine previews, "why" tooltips from the cause ledger, glossary
// terms, unlock rules (§1.5, §6.8), small charts. Selectors only — never hidden truth.
import type { ReactNode } from 'react';
import { Ban, Lock, type LucideIcon } from 'lucide-react';
import { actionView, actionVote, causeStrip, VOTE } from '../../engine/v2';
import type { ActionView, BoardSeat, BoardVote, CostLine, GameStateV2 } from '../../engine/v2';
import { ICON } from './icons';
import { GLOSSARY_V2 } from '../../data/v2/glossary';
import { LIMIT_BY_ID } from '../../data/v2/limits';
import { SIGNALS, TRAIT_BY_ID } from '../../data/v2/traits';
import { Tip, TipCard as BaseTipCard } from './Tooltip';
import { fmtNum } from './components';
import { store, useV2 } from './store';

export { fmtB, fmtNum, fmtPct, fmtMult, fmtSigned, fmtDays, Meter, Bipolar, Spark, Slider, Seg, Toggle, Section, Row, Soon } from './components';
export { Tip } from './Tooltip';

/** TipCard whose string children render [[glossary]] links as nested tooltips. */
export function TipCard(p: Parameters<typeof BaseTipCard>[0]) {
  return <BaseTipCard {...p}>{typeof p.children === 'string' ? <Rich text={p.children} /> : p.children}</BaseTipCard>;
}

export type Params = Record<string, number | string | boolean>;

// ───────────────────────── acts and unlocks ─────────────────────────
export const ACT_NAMES = ['', 'Startup', 'Frontier race', 'Automation', 'Takeoff'] as const;
/** Act at which a panel or panel section unlocks (§1.5); tutorial off = all. */
export const UNLOCK_ACT: Record<string, 1 | 2 | 3 | 4> = {
  overview: 1, research: 1, company: 1, lab: 1, map: 1, finance: 1, departments: 1, models: 1, blueprint: 1, products: 1, relations: 1, safety: 1, codex: 1,
  compute: 2, risk: 2, world: 2,
  baseRuns: 2, deals: 2, rivalIntel: 2, researchBodies: 2, commitments: 2, agendas: 2, index: 2,
  aiLabour: 3, chinaLadder: 3, theftMap: 3, statutes: 3, govLadder: 3,
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

// ───────────────────────── limits (R11) ─────────────────────────
/** A cap, floor or gate where the player hits it (data/v2/limits.ts). Children = the live reading; hover = the rule
 *  and its source. `data-limit` is what uitest checks. `tone` = whether it binds now. */
export function Limit({ id, children, tone, block }: { id: string; children: ReactNode; tone?: 'bind' | 'warn' | 'quiet'; block?: boolean }) {
  const d = LIMIT_BY_ID[id];
  const body = <span className={`limit ${tone ?? 'quiet'}`} data-limit={id}><Ban size={10} />{children}</span>;
  if (!d) return body;
  return (
    <Tip as={block ? 'div' : 'span'} content={() => <TipCard title={d.title} footer={playerSource(d.source) ? `Designer: ${playerSource(d.source)}` : undefined}>{d.rule}</TipCard>}>
      {body}
    </Tip>
  );
}

/** UB-4 (VOCAB DQ-2): no source reaches a player tooltip. Internal design-doc references (MODEL-V3 §5, research/20
 *  C1, "[D]", "stand-in") show only with the designer overlay on (`?designer` in the URL, or localStorage
 *  `ai27.designer` = '1'; off by default). Real paper citations appear only on the Codex "Based on" line. */
export function designerOverlay(): boolean {
  try {
    if (typeof location !== 'undefined' && /[?&]designer\b/.test(location.search)) return true;
    return typeof localStorage !== 'undefined' && localStorage.getItem('ai27.designer') === '1';
  } catch { return false; }
}
/** Internal design documents, audits and notes: never player-facing. */
const DEV_DOC = /^(design\/|research\/|review\/|V2-SPEC|V3-|MODEL-V3|FINANCE-V3|SAFETY-REDESIGN|SAFETY|RD-|STRUCTURE|TECH-TREE|BUILD-PLAN|LIMITS|IA\b|IA\.md|UI-IA|PROPOSALS|COMPUTE|DESIGN|PLAN|DECISIONS|SESSION|AUDIT|REVIEW|M\d|WS\d|SR-?\d|R\d+\b|DQ-|OQ-|v2-interfaces|engine|src\/|data\/)/i;
/** A source string's real citations (papers, official frameworks), with every internal reference dropped. */
export function paperSources(src?: string): string | undefined {
  if (!src) return undefined;
  const keep = src.split(';').map((x) => x.trim()).filter(Boolean).filter((x) => !DEV_DOC.test(x) && !/stand-in|\[D\]|design value|§/i.test(x));
  return keep.length ? keep.join('; ') : undefined;
}
/** A tooltip footer's source: the raw string with the designer overlay on, nothing otherwise. */
export function playerSource(src?: string): string | undefined {
  return src && designerOverlay() ? src : undefined;
}

// ───────────────────────── glossary ─────────────────────────
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const g = termEntry(id);
  if (!g) return <span data-term={id} data-term-missing="1">{children ?? id}</span>;
  return (
    <Tip className="term" content={() => <TipCard title={g.title} footer={playerSource(g.src) ? `Designer: ${playerSource(g.src)}` : undefined}><Rich text={g.body} /></TipCard>}>
      <span data-term={id}>{children ?? g.title}</span>
    </Tip>
  );
}
/** Glossary entry, or a generated one for trait:<ID> and sig:<ID> (from the trait data). */
export function termEntry(id: string): { title: string; body: string; src?: string } | undefined {
  if (id.startsWith('trait:')) {
    const t = TRAIT_BY_ID[id.slice(6) as keyof typeof TRAIT_BY_ID];
    return t && { title: t.name, body: `${t.desc} ${t.protective ? 'Protective: higher is better.' : 'A [[traits|hidden trait]]: you see your [[belief]] (best guess and range), never the truth.'}`, src: `research/04 ${t.r04}` };
  }
  if (id.startsWith('sig:')) {
    const x = SIGNALS.find((q) => q.id === id.slice(4));
    return x && { title: x.name, body: "A [[signal|training signal]]: how strongly this run pushes the model's tendencies this way." };
  }
  return GLOSSARY_V2[id];
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
    parts.push(<Term key={k++} id={m[1]}>{m[2] ?? termEntry(m[1])?.title ?? m[1]}</Term>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// ───────────────────────── cost lines ─────────────────────────
const CUR_LABEL: Record<CostLine['currency'], string> = {
  cash: '$', revenue: 'rev', compute: 'compute', staffTime: 'staff', progress: 'progress', leadDays: 'lead', trust: 'trust',
  credibility: 'cred', scrutiny: 'scrutiny', talent: 'talent', morale: 'morale', boardConf: 'board', approval: 'approval',
  security: 'security', monitorability: 'monitor', alignment: 'align', freedom: 'freedom', chinaTension: 'CN tension', dilution: 'dilution', valuation: 'valuation',
};
/** A line's amount in its own unit (model v3 D4): 7.5, 0.146, 2. */
/** A '%' line's amount, already in percent points: 5, 2.5, 0.31 (F6b). */
export const pctAmt = (a: number) => (a >= 10 ? a.toFixed(0) : a >= 1 ? a.toFixed(1) : a === 0 ? '0' : a.toPrecision(2));
export const unitAmt = (a: number) => (a >= 100 || Number.isInteger(a) ?a.toFixed(0) : a >= 10 ? a.toFixed(1) : a >= 1 ? a.toFixed(2) : a === 0 ? '0' : a.toPrecision(2));
function amt(c: CostLine): string {
  const a = Math.abs(c.amount);
  if (c.unit === '%') return pctAmt(a);
  if (c.unit) return unitAmt(a);
  switch (c.currency) {
    case 'cash': case 'valuation': return a >= 1000 ? `$${(a / 1000).toFixed(1)}T` : `$${a >= 10 ? a.toFixed(0) : a >= 0.1 ? a.toFixed(1) : a.toFixed(2)}B`;
    case 'revenue': return `$${a >= 10 ? a.toFixed(0) : a.toFixed(1)}B/yr`;
    case 'compute': return a <= 1 && a > 0 ? `${(a * 100).toFixed(a < 0.1 ? 1 : 0)}%` : fmtNum(a);
    case 'leadDays': return `${Math.round(a)}d`;
    case 'progress': return unitAmt(a); // RD-B19: never a level without its unit
    case 'monitorability': case 'alignment': return a < 1 ? a.toFixed(2) : a.toFixed(0);
    case 'dilution': return `${a.toFixed(1)}%`; // percent (a fraction reading turned 0.5% into 50%)
    default: return a < 1 && a > 0 ? a.toFixed(2) : a.toFixed(a < 10 ? 1 : 0);
  }
}
export function lineText(c: CostLine, sign = true): string {
  // UB-4 (VOCAB §1): engine units never reach the player. An OOM line reads as a multiplier (+0.12 OOM → ×1.32);
  // a capability-level line reads in "levels".
  if (c.unit === 'OOM') { const m = 10 ** c.amount; return `×${m >= 10 ? m.toFixed(0) : m >= 1.995 ? m.toFixed(1) : m.toFixed(m > 0.995 && m < 1.005 ? 3 : 2)}`; }
  if (c.unit === 'L') c = { ...c, unit: 'levels' };
  const sg = sign ? (c.amount < 0 ? '−' : '+') : '';
  // F6b: '%' sits on its number (+5% research speed). RD-B19: `progress` lines carry a unit (lint-tradeoffs).
  const label = c.unit === '%' ? '%' : c.unit ? ` ${c.unit}` : c.currency === 'cash' ? '' : ` ${CUR_LABEL[c.currency]}`;
  return `${sg}${amt(c)}${label}`;
}
function lineMeta(c: CostLine): string {
  const bits: string[] = [];
  if (c.condition) bits.push(c.condition);
  if (c.target) bits.push(String(c.target));
  if (c.probability !== undefined && c.probability < 1) bits.push(`p ${Math.round(c.probability * 100)}%`);
  if (c.lagDays) bits.push(`in ${Math.round(c.lagDays)}d`);
  return bits.join(' · ');
}
/** Full preview rows for tooltips. */
export function PreviewRows({ v }: { v: Pick<ActionView, 'costs' | 'gains' | 'exposure'> }) {
  const sect = (title: string, all: CostLine[], tone: string, sign: boolean, xs = all.filter((c) => c.amount !== 0 || !!c.target)) =>
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
  id, params = {}, label, primary, small = true, onDone, inline = false, testId, block, icon: Icon, reason = false, anchor, ariaLabel,
}: { /** Accessible name for an icon-only button. */ ariaLabel?: string; id: string; params?: Params; label?: ReactNode; primary?: boolean; small?: boolean; onDone?: () => void; inline?: boolean; testId?: string; /** Extra UI-side blocker (e.g. the run plan's reason). */ block?: string; icon?: LucideIcon; /** Show the disabled reason inline under the button. */ reason?: boolean; anchor?: string }) {
  const st = useV2();
  const s = st.state;
  if (!s) return null;
  const v = actionView(s, id, params);
  if (v.ok === true && block) v.ok = block;
  // FIN3a: a major decision shows the board's vote before you ask; a failed vote disables it (founder control can
  // force it at a confidence cost).
  const vote = v.ok === true ? actionVote(s, id, params) : undefined;
  const forcing = params.force === true;
  if (vote && !vote.passes && !(forcing && vote.canForce)) v.ok = `The board votes no (${vote.yes} of ${vote.total})${vote.canForce ? '; founder control can force it' : ''}`;
  const off = v.ok !== true;
  const btn = (
    <Tip
      className="act-wrap"
      content={() => (
        <TipCard title={v.title} value={off ? <span className="tone-neg">{v.ok}</span> : undefined}>
          <PreviewRows v={actionView(s, id, params)} />
        </TipCard>
      )}
    >
      <span className="act-col" id={anchor ? `ctl-${anchor}` : undefined}>
        <button
          className={`btn ${small ? 'btn-sm' : ''} ${primary ? 'btn-primary' : ''} act-btn ${off ? 'is-off' : ''}`}
          disabled={off}
          data-act={testId ?? id}
          aria-label={ariaLabel}
          onClick={() => {
            const err = store.act(id, params);
            if (!err) onDone?.();
          }}
        >
          {Icon && <Icon size={13} />}
          <span>{label ?? v.title}</span>
          {inline && <PreviewInline v={v} />}
        </button>
        {reason && off && <span className="act-reason">{v.ok}</span>}
      </span>
    </Tip>
  );
  if (!vote) return btn;
  // The vote sits under the button with its own tooltip (outside the button's preview tooltip).
  return (
    <span className="act-col">
      {btn}
      <VoteStrip v={vote} />
      {!vote.passes && vote.canForce && !forcing && (
        <button className="btn btn-sm btn-ghost" data-act={`${testId ?? id}:force`} onClick={() => { if (!store.act(id, { ...params, force: true })) onDone?.(); }}>
          Force · confidence −{VOTE.forceCost}
        </button>
      )}
    </span>
  );
}

const SEAT_ICON: Record<BoardSeat['kind'], LucideIcon> = { founder: ICON.you, mission: ICON.exec, financial: ICON.cash, strategic: ICON.relations, independent: ICON.board, gov: ICON.congress };
export const SEAT_KIND_LABEL: Record<BoardSeat['kind'], string> = { founder: 'CEO', mission: 'Mission', financial: 'Financial', strategic: 'Strategic', independent: 'Independent', gov: 'Government' };
const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}`;

/** The board's vote on a major decision, seat by seat (FIN3a, spec §7.3): one chip per voting seat, green yes / red
 *  no, and the total; the tooltip shows each seat's lean and its parts. */
export function VoteStrip({ v }: { v: BoardVote }) {
  const p = v.seats.find((x) => x.kind !== 'founder')?.parts ?? v.seats[0]?.parts;
  return (
    <Tip content={() => (
      <TipCard title={<Term id="boardVote">{v.label}</Term>} value={<span className={v.passes ? 'tone-pos' : 'tone-neg'}>{v.passes ? 'passes' : 'fails'} · {v.yes} of {v.total}</span>} rows={[
        { label: 'Needs the board', value: v.trigger },
        ...(p ? [
          { label: 'Outside owners (every seat)', value: signed(p.drift), tone: p.drift < 0 ? 'neg' as const : 'neutral' as const },
          { label: <Term id="boardConf">Board mood (every seat)</Term>, value: signed(p.mood), tone: p.mood < 0 ? 'neg' as const : 'pos' as const },
          { label: `Situation: ${v.needLabel}`, value: signed(p.need), tone: p.need < 0 ? 'neg' as const : 'neutral' as const },
        ] : []),
        ...v.seats.map((x) => ({ label: `${x.holder} · ${SEAT_KIND_LABEL[x.kind]}${x.weight > 1 ? ` · ${x.weight} votes` : ''}`, value: x.kind === 'founder' ? 'yes (your seat)' : `${x.yes ? 'yes' : 'no'} · stance ${signed(x.parts.stance)} → ${signed(x.lean)}`, tone: x.yes ? 'pos' as const : 'neg' as const })),
      ]} footer={v.canForce ? `Founder control: you can force it (board confidence −${VOTE.forceCost}).` : 'Passes with more than half the votes. No dice: this is the vote you will get.'}>
        {"Each seat's lean = its stance on this decision + the outside owners' drift + the board's mood + the situation; it votes yes above 0. See [[boardVote]]."}
      </TipCard>
    )}>
      <span className={`vote-strip ${v.passes ? 'pass' : 'fail'}`} data-test="vote" data-pass={v.passes ? '1' : '0'}>
        <span className="dim">{v.body === 'trust' ? 'trust' : 'board'}</span>
        {v.seats.map((x, i) => {
          const I = SEAT_ICON[x.kind];
          return <span key={i} className={`vote-seat ${x.yes ? 'yes' : 'no'}`} data-vote={x.yes ? 'yes' : 'no'}><I size={11} />{x.weight > 1 && <i>×{x.weight}</i>}</span>;
        })}
        <b className={v.passes ? 'tone-pos' : 'tone-neg'}>{v.yes}/{v.total} {v.passes ? 'yes' : 'no'}</b>
      </span>
    </Tip>
  );
}

/** Ledger source strings in player words (PLAN B8, UI side). */
const SOURCE_WORDS: Record<string, string> = {
  'chip deposit': 'Chip order deposit', 'revenue share': 'Revenue share', drift: 'Drift (no single cause)', 'weekly sum': 'Weekly total',
};
export const sourceWords = (x: string) => SOURCE_WORDS[x] ?? x.charAt(0).toUpperCase() + x.slice(1);
/** Diverging cause bars (Democracy-style strip): one row per source, bar ∝ |Δ|, gain right, loss left. */
export function CauseBars({ s, k, fmt = (x) => x.toFixed(1), days: d = 30, invert = false }: { s: GameStateV2; k: string; fmt?: (x: number) => string; days?: number; /** true when "up" is bad (scrutiny, risk). */ invert?: boolean }) {
  const rows = causeStrip(s, k, d, 6);
  if (!rows.length) return <div className="dim small">No recorded change in {d} d</div>;
  const max = Math.max(1e-9, ...rows.map((r) => Math.abs(r.delta)));
  return (
    <div className="cbars">
      {rows.map((r, i) => {
        const good = invert ? r.delta < 0 : r.delta > 0;
        const w = (Math.abs(r.delta) / max) * 50;
        return (
          <Tip as="div" key={i} content={() => <TipCard title={sourceWords(r.source)} value={`${r.delta >= 0 ? '+' : '−'}${fmt(Math.abs(r.delta))}`} rows={[
            { label: r.n > 1 ? 'Postings (days it moved)' : 'Postings', value: String(r.n) },
            ...r.details.map((d) => ({ label: 'e.g.', value: d })),
          ]}>{`Sum over the last ${d} days.`}</TipCard>}>
            <div className="cbar">
              <span className="cbar-lbl ellip">{sourceWords(r.source)}{r.n > 1 ? <span className="dim"> ×{r.n}</span> : null}</span>
              <span className="cbar-track"><i style={{ left: r.delta >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: good ? 'var(--good)' : 'var(--bad)' }} /></span>
              <span className={`cbar-val num ${good ? 'tone-pos' : 'tone-neg'}`}>{r.delta >= 0 ? '+' : '−'}{fmt(Math.abs(r.delta))}</span>
            </div>
          </Tip>
        );
      })}
    </div>
  );
}
/** Tooltip card for a meter (§2.6, DESIGN-SYSTEM §5.1): value, optional breakdown rows, cause bars, levers. */
export function WhyCard({ s, k, title, value, body, rows, fmt, levers, invert }: { s: GameStateV2; k: string; title: ReactNode; value?: ReactNode; body?: ReactNode; rows?: { label: ReactNode; value: ReactNode; tone?: 'pos' | 'neg' | 'neutral' }[]; fmt?: (x: number) => string; levers?: ReactNode; invert?: boolean }) {
  return (
    <TipCard title={title} value={value} rows={rows}>
      {body && <div className="why-body">{typeof body === 'string' ? <Rich text={body} /> : body}</div>}
      <div className="tip-sec"><div className="tip-cap">Why it moved · 30 d</div><CauseBars s={s} k={k} fmt={fmt} invert={invert} /></div>
      {levers && <div className="tip-sec"><div className="tip-cap">Levers</div><div className="btn-row wrap">{levers}</div></div>}
    </TipCard>
  );
}
/** Wrap a meter so it shows its "why" on hover. */
export function Why({ k, title, value, body, rows, fmt, children, className, levers, invert }: { k: string; title: ReactNode; value?: ReactNode; body?: ReactNode; rows?: { label: ReactNode; value: ReactNode; tone?: 'pos' | 'neg' | 'neutral' }[]; fmt?: (x: number) => string; children: ReactNode; className?: string; levers?: ReactNode; invert?: boolean }) {
  return (
    <Tip className={`has-tip ${className ?? ''}`} content={() => (store.state ? <WhyCard s={store.state} k={k} title={title} value={value} body={body} rows={rows} fmt={fmt} levers={levers} invert={invert} /> : null)}>
      {children}
    </Tip>
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
export const days = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d))}d`;
export function tone(x: number, good = 0) {
  return x > good ? 'tone-pos' : x < good ? 'tone-neg' : 'tone-neutral';
}
