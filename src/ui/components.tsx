import {
  AlertTriangle, Building2, Cpu, Flag, Landmark, Brain, Users, Swords, Shield, FlaskConical, Activity,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { GLOSSARY } from '../data/glossary';
import { Tip, TipCard } from './Tooltip';

// ---------------- Format ----------------
export const fmtB = (b: number) => (Math.abs(b) >= 1000 ? `$${(b / 1000).toFixed(b >= 10000 ? 0 : 1)}T` : `$${b.toFixed(b < 10 ? 1 : 0)}B`);
export const fmtNum = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : `${Math.round(n)}`);
export const fmtPct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
export const fmtMult = (m: number) => (m >= 100 ? `${m.toFixed(0)}x` : m >= 10 ? `${m.toFixed(1)}x` : `${m.toFixed(2)}x`);
export const fmtSigned = (n: number, d = 0) => `${n >= 0 ? '+' : ''}${n.toFixed(d)}`;
export function fmtDays(d: number) {
  const a = Math.abs(d);
  const s = a >= 60 ? `${(a / 30.4).toFixed(1)} mo` : `${Math.round(a)} d`;
  return d < 0 ? `−${s}` : s;
}
export function fmtMinutes(m: number) {
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 60 * 24 * 2) return `${(m / 60).toFixed(m < 600 ? 1 : 0)} h`;
  const wm = m / (167 * 60);
  if (wm < 12) return `${(m / (40 * 60)).toFixed(0)} wk`;
  return `${(wm / 12).toFixed(wm < 120 ? 1 : 0)} yr`;
}

export const KIND_ICON: Record<string, LucideIcon> = {
  gov: Landmark, china: Flag, public: Users, model: Brain, rival: Swords, company: Building2, alert: AlertTriangle,
  incident: AlertTriangle, milestone: Cpu, research: FlaskConical, news: Activity, security: Shield,
};
export const KIND_COLOR: Record<string, string> = {
  gov: 'var(--gov)', china: 'var(--china)', public: 'var(--pub)', model: 'var(--model)', rival: 'var(--rival)', company: 'var(--accent)',
  alert: 'var(--neg)', incident: 'var(--warn)', milestone: 'var(--violet)', research: 'var(--pos)', news: 'var(--text-2)',
};

// ---------------- Rich text with glossary terms ----------------
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const g = GLOSSARY[id];
  if (!g) return <>{children}</>;
  return (
    <Tip className="term" content={() => <TipCard title={g.title} footer={g.src}><Rich text={g.body} /></TipCard>}>
      {children ?? g.title}
    </Tip>
  );
}

/** Renders text, turning [[id]] / [[id|label]] into nested-tooltip terms. */
export function Rich({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\[\[([a-zA-Z0-9]+)(?:\|([^\]]+))?\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<Term key={k++} id={m[1]}>{m[2]}</Term>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// ---------------- Visual primitives ----------------
export function Meter({ value, max = 100, color = 'var(--accent)', sigma, marker, width }: { value: number; max?: number; color?: string; sigma?: number; marker?: number; width?: number }) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className="meter" style={width ? { width } : undefined}>
      <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      {sigma !== undefined && sigma > 0 && (
        <div className="meter-sigma" style={{ left: `${Math.max(0, pct - sigma * 100)}%`, width: `${Math.min(100, pct + sigma * 100) - Math.max(0, pct - sigma * 100)}%` }} />
      )}
      {marker !== undefined && <div className="meter-marker" style={{ left: `${Math.max(0, Math.min(1, marker / max)) * 100}%` }} />}
    </div>
  );
}

/** Two-sided meter for -100..100 values */
export function Bipolar({ value, width = 80 }: { value: number; width?: number }) {
  const pct = Math.max(-1, Math.min(1, value / 100));
  return (
    <div className="meter bipolar" style={{ width }}>
      <div className="bipolar-mid" />
      <div className="meter-fill" style={{ left: pct >= 0 ? '50%' : `${50 + pct * 50}%`, width: `${Math.abs(pct) * 50}%`, background: pct >= 0 ? 'var(--pos)' : 'var(--neg)' }} />
    </div>
  );
}

export function Spark({ data, color = 'var(--accent)', w = 120, h = 28, log = false }: { data: number[]; color?: string; w?: number; h?: number; log?: boolean }) {
  if (data.length < 2) return <svg width={w} height={h} />;
  const vals = log ? data.map((d) => Math.log10(Math.max(1e-6, d))) : data;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)}`).join(' ');
  return (
    <svg width={w} height={h} className="spark">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

export function Slider({ value, min, max, step, onChange, width = 120 }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; width?: number }) {
  return <input className="slider" type="range" min={min} max={max} step={step} value={value} style={{ width }} onChange={(e) => onChange(Number(e.target.value))} />;
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string; tip?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.v)} className={`seg-btn ${o.v === value ? 'active' : ''}`} onClick={() => onChange(o.v)} title={o.tip}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span className="toggle-knob" />
      {label && <span className="toggle-label">{label}</span>}
    </button>
  );
}

export function Section({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <span className="section-title">{title}</span>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Row({ label, children, tip }: { label: ReactNode; children: ReactNode; tip?: () => ReactNode }) {
  const l = tip ? <Tip className="has-tip" content={tip}>{label}</Tip> : label;
  return (
    <div className="row">
      <span className="row-label">{l}</span>
      <span className="row-value">{children}</span>
    </div>
  );
}

export function Soon({ label = 'Coming soon' }: { label?: string }) {
  return <span className="soon">{label}</span>;
}
