// Overview (IA.md L1, the main screen): your company as the core loop (STRUCTURE §2, a verdict per system linking to
// its home) · lead track · race history · Watch, plus Goals while the tutorial runs. Nothing else: every other datum
// lives one level down.
import { useState } from 'react';
import { activeRivals, dateOf, engine, fmtDate, fmtMonth, internalEval, leadDays } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { store } from '../store';
import { Term, Tip, TipCard } from '../ui';
import { Card, CauseChain, GoBtn, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';
import { watchItems } from '../shell/watch';
import { Goals, goalsActive } from '../shell/Onboarding';
import { CoreLoop } from './CoreLoop';

function monogram(name: string) {
  const w = name.split(/[\s-]+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase();
}

/** Each rival's best internal model relative to yours: x = −lead (days); the centre line is you. */
function LeadTrack({ s }: { s: GameStateV2 }) {
  const labs = [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])];
  const rows = labs.map((r) => ({ r, l: leadDays(s, r.core.id) })).sort((a, b) => a.l.est - b.l.est);
  const W = 1500;
  const x0 = 170;
  const x1 = 1460;
  const laneH = 46;
  const top = 34;
  const bot = top + rows.length * laneH;
  const H = bot + 40;
  const D0 = Math.min(-150, ...rows.map((x) => -x.l.est - x.l.sd)) - 30;
  const D1 = Math.max(90, ...rows.map((x) => -x.l.est + x.l.sd)) + 30;
  const X = (d: number) => x0 + ((d - D0) / (D1 - D0)) * (x1 - x0);
  const step = D1 - D0 > 900 ? 180 : D1 - D0 > 450 ? 90 : 30;
  const ticks: number[] = [];
  for (let d = Math.ceil(D0 / step) * step; d <= D1; d += step) ticks.push(d);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="leadtrack" data-home="leadTrack" data-test="leadtrack">
      {ticks.map((d) => <g key={d}><line x1={X(d)} x2={X(d)} y1={top - 6} y2={bot} stroke={d === 0 ? 'none' : '#1f2a38'} />{d !== 0 && <text x={X(d)} y={bot + 16} textAnchor="middle" className="lt-tick">{d > 0 ? '+' : d < 0 ? '−' : ''}{Math.abs(d)} d</text>}</g>)}
      <rect x={X(0)} y={top - 10} width={Math.max(0, x1 + 10 - X(0))} height={bot - top + 10} fill="rgba(239,107,107,.06)" />
      <text x={X(0) + 10} y={top - 14} className="lt-ahead">ahead of you →</text>
      <text x={X(0) - 10} y={top - 14} textAnchor="end" className="lt-behind">← behind you</text>
      {rows.map(({ r, l }, i) => {
        const y = top + i * laneH + laneH / 2;
        const cn = r.core.kind === 'china';
        const col = cn ? C.china : C.rival;
        const grade = s.researchBodies.index.grades[r.core.id]?.letter;
        return (
          <Tip as="g" key={r.core.id} content={() => (
            <TipCard title={r.core.name} value={grade ? <span><Term id="index">Index</Term> {grade}</span> : undefined} rows={[
              { label: <Term id="lead">Your lead</Term>, value: `${F.lead(l.est)} ± ${l.sd} d`, tone: l.est >= 0 ? 'pos' : 'neg' },
              { label: <Term id="misalign">Misalignment</Term>, value: `${F.num(r.intel.misalignBand[0], 2)}–${F.num(r.intel.misalignBand[1], 2)}` },
              { label: 'Public model', value: r.publicModel?.name ?? '—' },
              { label: 'Known incidents', value: r.intel.knownIncidents.length },
            ]}>{cn ? 'China\'s national lab.' : r.archetype === 'leader' ? 'The frontier leader: a US lab on the reference pace.' : 'US rival.'} Estimates from releases, evaluators and intel. Click for Relations.</TipCard>
          )}>
            <g className="lt-lane" data-lane={r.core.id} onClick={() => store.setPanel('relations')}>
              <line x1={x0 - 6} x2={x1 + 8} y1={y} y2={y} stroke="#1f2a38" strokeWidth={12} strokeLinecap="round" />
              <text x={8} y={y + 4} className="lt-name">{r.core.name}</text>
              <rect x={X(-l.est - l.sd)} y={y - 3} width={Math.max(2, X(-l.est + l.sd) - X(-l.est - l.sd))} height={6} rx={3} fill={col} opacity={0.35} />
              <circle cx={X(-l.est)} cy={y} r={12} fill={col} stroke="#0b0f15" strokeWidth={2} />
              <text x={X(-l.est)} y={y + 3.5} textAnchor="middle" className="lt-mono">{monogram(r.core.name)}</text>
            </g>
          </Tip>
        );
      })}
      <line x1={X(0)} x2={X(0)} y1={top - 10} y2={bot + 4} stroke={C.you} strokeWidth={3} />
      <rect x={X(0) - 28} y={bot + 20} width={56} height={18} rx={9} fill="#13263d" stroke={C.you} />
      <text x={X(0)} y={bot + 33} textAnchor="middle" className="lt-you">YOU</text>
    </svg>
  );
}

/** Capability vs understanding over the whole game, the blind gap shaded; hover reads a week. */
function RaceHistory({ s }: { s: GameStateV2 }) {
  const [hi, setHi] = useState<number>();
  const S = s.series;
  const n = Math.min(S.Lmeasured.length, S.U.length, S.day.length);
  const W = 1000;
  const H = 380;
  const pl = 30;
  const pr = 10;
  const pt = 14;
  const pb = 26;
  // Jank O4: day 0 shows the start point, not a large empty card.
  if (n < 2) {
    const ev = internalEval(s);
    const u = engine.understanding(s);
    return <div className="small rh-start" data-test="race-start"><span className="dim">Start:</span> <b style={{ color: C.cap }}>capability {F.level(ev.L)}</b> · <b style={{ color: C.und }}>understanding {F.level(u.U)}</b> <span className="dim">· the history fills in week by week</span></div>;
  }
  const L = S.Lmeasured.slice(0, n);
  const U = S.U.slice(0, n);
  const lo = Math.max(0, Math.floor(Math.min(...L.filter((x) => x > 0), ...U) - 0.5));
  const top = Math.ceil(Math.max(...L, ...U) + 0.5);
  const X = (i: number) => pl + (i / (n - 1)) * (W - pl - pr);
  const Y = (v: number) => pt + (1 - (v - lo) / Math.max(1, top - lo)) * (H - pt - pb);
  const polys: string[] = [];
  let seg: number[] = [];
  const flush = () => { if (seg.length > 1) polys.push(`M${seg.map((i) => `${X(i)},${Y(L[i])}`).join(' L')} L${[...seg].reverse().map((i) => `${X(i)},${Y(U[i])}`).join(' L')}Z`); seg = []; };
  for (let i = 0; i < n; i++) { if (L[i] > U[i]) seg.push(i); else flush(); }
  flush();
  const levels = [5, 6.5, 8.5, 10, 12, 15].filter((v) => v > lo && v < top);
  const years: number[] = [];
  for (let i = 1; i < n; i++) if (dateOf(s, S.day[i]).getUTCMonth() !== dateOf(s, S.day[i - 1]).getUTCMonth() && dateOf(s, S.day[i]).getUTCMonth() % 6 === 0) years.push(i);
  const releases0 = s.player.models.versions.filter((v) => v.variant === 'full' && v.day > 0 && v.evals.measuredL !== undefined)
    .map((v) => ({ v, i: S.day.findIndex((d) => d >= v.day) })).filter((x) => x.i > 0).slice(-6);
  // Jank O4: thin release labels so they never overlap (keep the later one when two are closer than a label).
  const releases: typeof releases0 = [];
  for (let k = releases0.length - 1; k >= 0; k--) if (!releases.length || X(releases[releases.length - 1].i) - X(releases0[k].i) >= 74) releases.push(releases0[k]);
  // Jank M2: why understanding moved in the hovered week (the engine's weekly U drivers).
  const uWhy = (i: number) => (s.causes.byKey.U ?? []).filter((e) => e.day <= S.day[i] && e.day > S.day[i] - 7).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="racehist" data-home="raceHistory" onMouseLeave={() => setHi(undefined)}
      onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const fx = ((e.clientX - r.left) / r.width) * W; setHi(Math.max(0, Math.min(n - 1, Math.round(((fx - pl) / (W - pl - pr)) * (n - 1))))); }}>
      {levels.map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke="#1f2a38" strokeDasharray="3 4" /><text x={pl - 5} y={Y(v) + 3} textAnchor="end" className="rh-ax">{v}</text></g>)}
      {years.map((i) => <text key={i} x={X(i)} y={H - 8} textAnchor="middle" className="rh-ax">{fmtMonth(dateOf(s, S.day[i]))}</text>)}
      {polys.map((d, i) => <path key={i} d={d} fill="rgba(239,107,107,.3)" />)}
      {releases.map(({ v, i }) => <g key={v.id}><line x1={X(i)} x2={X(i)} y1={pt} y2={H - pb} stroke="#33435a" strokeDasharray="2 3" /><text x={X(i) + 3} y={pt + 9} className="rh-rel">{v.name}</text></g>)}
      <polyline points={U.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} fill="none" stroke={C.und} strokeWidth={2.2} />
      <polyline points={L.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} fill="none" stroke={C.cap} strokeWidth={2.2} />
      {hi !== undefined && (
        <g>
          <line x1={X(hi)} x2={X(hi)} y1={pt} y2={H - pb} stroke="#fff" opacity={0.4} />
          <circle cx={X(hi)} cy={Y(L[hi])} r={3.5} fill={C.cap} /><circle cx={X(hi)} cy={Y(U[hi])} r={3.5} fill={C.und} />
          {(() => {
            const why = uWhy(hi);
            const txt = why ? `U ${F.num(why.delta, 1, true)}: ${(why.detail ?? why.source).split(' · ')[0]}` : '';
            const w = Math.max(180, Math.min(330, txt.length * 6.4 + 20));
            return (
              <g transform={`translate(${Math.min(W - w - 10, X(hi) + 8)}, ${pt + 18})`}>
                <rect width={w} height={why ? 68 : 52} rx={6} fill="#0e141c" stroke="#46597a" />
                <text x={10} y={17} className="rh-tt">{fmtDate(dateOf(s, S.day[hi]))}</text>
                <text x={10} y={33} className="rh-tt" fill={C.cap}>Capability {L[hi].toFixed(1)}</text>
                <text x={10} y={47} className="rh-tt" fill={C.und}>Understanding {U[hi].toFixed(1)} ({F.num(U[hi] - L[hi], 1, true)})</text>
                {why && <text x={10} y={62} className="rh-tt" fill="#c9d4e2" data-test="u-why">{txt}</text>}
              </g>
            );
          })()}
        </g>
      )}
    </svg>
  );
}

function WatchCard({ s }: { s: GameStateV2 }) {
  const items = watchItems(s).slice(0, 4);
  return (
    <Card title={<Term id="watch">Watch</Term>} sub="what needs you · cause → fix" right={items.length ? <span className="tag2 warn">{items.length}</span> : undefined} home="watch" id="watch">
      <div className="watch2" data-test="watch">
        {items.map((w) => (
          <div className="wi2" key={w.id} data-watch={w.id}>
            <CauseChain links={w.chain.map((c) => ({ label: c.label, icon: c.icon, kind: c.kind, tip: c.detail ? () => <TipCard title={c.label}>{c.detail}</TipCard> : undefined }))} />
            <div className="wi2-row"><span className="dim small">{w.why}</span><span className="sp" /><GoBtn to={w.go} label={w.goLabel} testId={`watch.${w.id}`} /></div>
          </div>
        ))}
        {!items.length && <div className="wi2-empty"><ICON.check size={18} /> Nothing needs you right now.</div>}
      </div>
    </Card>
  );
}

export function Overview({ s }: { s: GameStateV2 }) {
  const goals = goalsActive(s);
  return (
    <div className="panel-v2 overview" data-panel="overview">
      <Card title="Your company" sub="the core loop · a verdict per system · hover for numbers, click for its screen" id="ctl-coreloop" right={<Ref id="codex.loop" to={{ panel: 'codex' }}>How it works</Ref>}>
        <CoreLoop s={s} live />
      </Card>
      <Card title="Who is close" sub="each lab's best internal model, relative to yours · estimates ± intel error · hover a lane, click for the lab" id="ctl-leadtrack"
        right={<span className="legend2"><span><i style={{ background: C.rival }} />US rival</span><span><i style={{ background: C.china }} />China</span></span>}>
        <LeadTrack s={s} />
      </Card>
      <div className={`ov-lower ${goals ? 'with-goals' : ''}`}>
        <Card title="How the race got here" sub="hover to read a week" right={<span className="legend2"><span><i style={{ background: C.cap }} /><Term id="L">Capability</Term></span><span><i style={{ background: C.und }} /><Term id="U">Understanding</Term></span><span><i style={{ background: 'rgba(239,107,107,.5)', height: 8 }} /><Term id="gap">blind</Term></span></span>}>
          <RaceHistory s={s} />
        </Card>
        <WatchCard s={s} />
        {goals && <Goals s={s} />}
      </div>
    </div>
  );
}
