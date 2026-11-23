// Skill bars (UB-7 / UB-10; OQ-6, DECISIONS "Measurement scale"): ONE component for TRAINING › Prediction and the
// MODELS card. Each row is a skill on the JOB scale: the measured bar (with its range whisker), the predicted ghost
// (with its 90% range) and the skill's own median-expert / best-human ticks (skillMarksOf: the work fit's whole-job
// references, so milestones read "doing the job"). No level numbers at L1: differences and the test facts live in the
// row tooltip. Optional milestone axis under the rows (milestoneMarks). Reads measured values and forecasts only.
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { MilestoneMark } from '../../../engine/v2';
import { Term, Tip, TipCard } from '../ui';
import * as F from '../fmt';
import './skillbars.css';

export interface SkillRow {
  key: string;
  label: ReactNode;
  icon?: LucideIcon;
  /** Measured level today and its range; undefined = not measured yet. */
  now?: number;
  nowRange?: [number, number];
  /** Predicted level (mid) and its 90% range (TRAINING ghost). */
  next?: number;
  nextRange?: [number, number];
  /** The skill's own job-scale marks. */
  marks: { median: number; best: number };
  /** Rival released model measured by your evals (Q2), if any. */
  rival?: number;
  tip: () => ReactNode;
  strong?: boolean;
  test?: string;
}

/** Ruler bounds: 0 to the highest mark or value in view, at least 13 (the mockup's ruler), at most 15. */
export function rulerHi(rows: SkillRow[]): number {
  let hi = 13;
  for (const r of rows) hi = Math.max(hi, r.marks.best + 0.4, (r.nextRange?.[1] ?? 0) + 0.3, (r.nowRange?.[1] ?? 0) + 0.3);
  return Math.min(15.3, Math.ceil(hi * 2) / 2);
}

/** Where a level sits against a skill's marks, in words (levels only as differences, VOCAB). */
export function standing(L: number, m: { median: number; best: number }): string {
  if (L >= m.best) return `${F.num(L - m.best, 1)} levels past the best human`;
  if (L >= m.median) return `${F.num(m.best - L, 1)} levels short of the best human`;
  return `${F.num(m.median - L, 1)} levels short of the median expert`;
}

export function SkillBars({ rows, axis, head, hi: hiIn, notMeasured = 'not measured yet' }: {
  rows: SkillRow[];
  /** Milestone axis under the rows. */
  axis?: MilestoneMark[];
  /** Header labels over the shared marks (most skills share the coding marks). */
  head?: { median: number; best: number };
  hi?: number;
  notMeasured?: string;
}) {
  const hi = hiIn ?? rulerHi(rows);
  const x = (L: number) => `${(Math.max(0, Math.min(1, L / hi)) * 100).toFixed(2)}%`;
  // Milestone labels closer than ~1.6 levels to the previous one drop to a second line.
  const lo = new Set<number>();
  if (axis) { let last = -Infinity; let lastLo = false; axis.forEach((m, i) => { const near = m.level - last < 1.6 * (hi / 13); if (near && !lastLo) { lo.add(i); lastLo = true; } else lastLo = false; last = m.level; }); }
  const w = (a: number, b: number) => `calc(${x(Math.max(a, b))} - ${x(Math.min(a, b))})`;
  return (
    <div className="skb" data-test="skill-bars">
      {head && (
        <div className="skb-row skb-head">
          <span />
          <div className="skb-track bare">
            <span className="skb-tl" style={{ left: x(head.median) }}><Term id="medianExpert">median expert</Term></span>
            <span className="skb-tl" style={{ left: x(head.best) }}><Term id="bestHuman">best human</Term></span>
          </div>
        </div>
      )}
      {rows.map((r) => {
        const I = r.icon;
        const up = r.next !== undefined && r.now !== undefined ? r.next - r.now : 0;
        return (
          <Tip key={r.key} as="div" content={r.tip}>
            <div className={`skb-row ${r.strong ? 'strong' : ''}`} data-skill={r.key} data-test={r.test}>
              <span className="skb-n">{I && <I size={14} />}<span className="u">{r.label}</span></span>
              <div className="skb-track">
                <i className="skb-tk med" style={{ left: x(r.marks.median) }} />
                <i className="skb-tk best" style={{ left: x(r.marks.best) }} />
                {r.now === undefined ? <span className="skb-none">{notMeasured}</span> : (
                  <>
                    {r.next !== undefined && up > 0.005 && <i className="skb-gh" style={{ left: x(r.now), width: w(r.now, r.next) }} />}
                    {r.nextRange && <i className="skb-ghr" style={{ left: x(r.nextRange[0]), width: w(r.nextRange[0], r.nextRange[1]) }} />}
                    <i className="skb-bar" style={{ width: x(r.now) }} />
                    {r.nowRange && <i className="skb-wh" style={{ left: x(r.nowRange[0]), width: w(r.nowRange[0], r.nowRange[1]) }} />}
                  </>
                )}
                {r.rival !== undefined && <i className="skb-rv" style={{ left: x(r.rival) }} />}
              </div>
            </div>
          </Tip>
        );
      })}
      {axis && (
        <div className="skb-row skb-axisrow">
          <span />
          <div className="skb-axis" data-test="milestone-axis">
            {axis.filter((m) => m.level <= hi - 0.2).map((m, i) => (
              <span key={m.name} className={`skb-ax ${m.metDay !== undefined ? 'met' : ''} ${lo.has(i) ? 'lo' : ''} ${m.level / hi > 0.88 ? 'end' : ''}`} style={{ left: x(m.level) }}><Tip content={() => <TipCard title={<Term id="milestone">{m.name}</Term>} value={m.metDay !== undefined ? 'met' : 'not met'}>A milestone is about doing the job: share of the work your models do alone, at the skill of the people who do it. Ticks sit at its level on the capability scale.</TipCard>}>
                <span>{m.name}{m.metDay !== undefined ? ' ✓' : ''}</span>
              </Tip></span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Legend for the bars (measured, predicted, ranges, marks). */
export function SkillLegend({ now, next }: { now: string; next?: string }) {
  return (
    <div className="skb-legend">
      <span><i className="lg-bar" />{now}</span>
      {next && <span><i className="lg-gh" />{next}</span>}
      <span><i className="lg-rg" /><Term id="measureBand">range</Term></span>
      <span><i className="lg-med" /><Term id="medianExpert">median expert</Term></span>
      <span><i className="lg-best" /><Term id="bestHuman">best human</Term></span>
      <span className="dim">doing the job</span>
    </div>
  );
}
