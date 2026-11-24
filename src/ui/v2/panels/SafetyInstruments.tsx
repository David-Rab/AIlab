// UB-C: SAFETY › Instruments (UI-IA §1 SAFETY Instruments row; approved mockup design/ux/mockups/rd/saf-instruments.png,
// DATA-c.md "SAFETY › Instruments"). HOME of: each instrument's reliability on the picked model (one best guess and one
// 90% range, readoutsInstruments.ts instrumentRange; solid = validated on this model, dashed = extrapolated), its main
// limits in player words, its validation history, the real-use logs row, the per-trait hidden-goal reading on the model,
// the validation queue (instruments and methods) and its policy, disagreements. L2 drawers: the detection grid with the
// capability vs sight-limit history (the old race chart), and research results (publish). Beliefs / measured / facts only.
import { useCallback, useMemo, useState } from 'react';
import { Activity, Ban, ChartColumn, Check, ClipboardCheck, Crosshair, Droplets, FlaskConical, GitCompare, Info, MessageSquareText, Repeat, Ruler, ScanEye, Syringe, Telescope, TrendingDown, Wrench, type LucideIcon } from 'lucide-react';
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { CRITICAL_TRAITS, TRAIT_BY_ID } from '../../../data/v2/traits';
import { PROJECT_BY_ID, TREE, isLineNode } from '../../../data/v2/tree';
import {
  dateOf, disagreementsView, fmtDate, hiddenGoalReads, instrumentsGrid, nodeKnown, projectEta, projectReady, realUseLogs, riskFamilies, safetyView, sightGrid, sightLimit,
  teamsOn, validationBatches, versionById,
} from '../../../engine/v2';
import type { GameStateV2, InstrumentRange, InstrumentRow, TraitId } from '../../../engine/v2';
import { ActBtn, Term, Tip, TipCard } from '../ui';
import { store } from '../store';
import { Card, Ref } from '../kit';
import * as F from '../fmt';
import { ICON, TRAIT_ICON } from '../icons';
import { C, div } from '../theme';
import { useSafetyPick } from './SafetyRisks';
import { RangeVal, SfDrawer } from './safetyKit';
import './safetyInstruments.css';

type SV = ReturnType<typeof safetyView>;
const tname = (t: string) => TRAIT_BY_ID[t as TraitId]?.name ?? F.words(t);
const KIND_ICON: Record<string, LucideIcon> = { tests: ClipboardCheck, internals: ScanEye, reasoning: MessageSquareText, logs: Activity, formal: Ruler };
const KIND_SHORT: Record<string, string> = { tests: 'Tests', internals: 'Internals', reasoning: 'Reasoning', logs: 'Logs', formal: 'Formal checks' };
const MX = 0.6;
const X = (v: number) => `${Math.max(0, Math.min(100, (v / MX) * 100))}%`;
const date = (s: GameStateV2, day: number) => fmtDate(dateOf(s, day)).replace(/, \d{4}$/, '');
const CASES = { panel: 'safety', tab: 'cases' } as const;
/** A × factor: '2' not '2.0'. */
const mx = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));

/** One reliability as the tooltips show it (the one range of readoutsInstruments.ts). */
function relRows(r: InstrumentRange, model: string) {
  return [
    { label: 'Best guess', value: F.pct(r.pct) },
    { label: '90% range', value: `${F.pct(r.lo)}–${F.pct(r.hi)}` },
    { label: 'Certainty', value: r.certainty.unknown ? 'Unknown (range wider than 30 points)' : r.certainty.word },
    { label: 'Basis', value: r.basis === 'extrapolated' ? `extrapolated from ${r.from}` : r.basis === 'validated' ? `validated on ${model}` : 'never validated: a guess from the programme' },
  ];
}

function RelBar({ r, small }: { r: InstrumentRange; small?: boolean }) {
  const unk = r.certainty.unknown;
  const dash = r.basis !== 'validated';
  return (
    <span className={`sfi-rb ${small ? 'sm' : ''}`}>
      {!small && [10, 20, 30, 40, 50].map((t) => <i key={t} className="tk" style={{ left: X(t / 100) }} />)}
      <span className={`rg ${dash ? 'dash' : ''} ${unk ? 'unk' : ''}`} style={{ left: X(r.lo), width: `calc(${X(r.hi)} - ${X(r.lo)})` }} />
      {!unk && <span className="bg" style={{ left: X(r.pct) }} />}
    </span>
  );
}

function History({ s, row }: { s: GameStateV2; row: InstrumentRow }) {
  const h = row.history.slice(-3);
  const last = h.at(-1);
  if (!last) return <span className="t3 sm">never validated</span>;
  const hgt = (x: { k: number; n: number }) => Math.max(1, (x.k / Math.max(1, x.n)) * 2 * 28);
  return (
    <Tip content={() => <TipCard title={<><Term id="validation">Validations</Term> · {row.name}</>} rows={row.history.slice(-6).reverse().map((x) => ({ label: `${x.model} · ${date(s, x.day)} · ${x.human ? 'by people' : 'AI-assisted'}`, value: `${x.k} of ${x.n} found` }))} footer="A drop when people run the validation is how a broken or sabotaged instrument shows.">Planted cases found in a test copy of each model. The bars are the last three (full height = 10 of 20).</TipCard>}>
      <span className="sfi-val">
        <svg width={54} height={30} className="sfi-hist">
          <line x1={0} y1={29.5} x2={54} y2={29.5} stroke="#33435a" />
          {h.map((x, i) => <rect key={i} x={3 + i * 18} y={29 - Math.min(28, hgt(x))} width={12} height={Math.min(28, hgt(x))} rx={2} fill={i === h.length - 1 ? C.und : '#56677e'} />)}
        </svg>
        <span className="sfi-vt"><span className="w">{last.model}: <span className="num">{last.k} of {last.n}</span></span><br /><span className="t3">{last.human ? 'by people' : 'AI-assisted'} · {date(s, last.day)}</span></span>
      </span>
    </Tip>
  );
}

function Limits({ row }: { row: InstrumentRow }) {
  const first = row.reasons[0];
  if (!first) return <span className="t3 sm">none</span>;
  const more = row.reasons.length - 1;
  return (
    <Tip content={() => <TipCard title={<>What limits {row.name}</>} rows={row.reasons.map((r) => ({ label: r.text, value: r.key === 'approach' ? 'believed chance it works' : r.key === 'notPorted' ? 'read by extrapolation' : `keeps ${F.pct(r.factor)}`, tone: r.warn ? 'neg' as const : 'neutral' as const }))} footer="From what you believe, at the model's measured skill; averaged over the traits it reads.">
      <b>notices tests</b>: the model behaves better when it thinks it is tested. <b>approach works?</b>: your belief that the programme behind it works at all. <b>reasoning hidden</b>: its written reasoning shows less of what it does. <b>fades with skill</b>: lost with the capability gap from the model it was validated on.</TipCard>}>
      <span className="sfi-lim"><span className={`sfi-chip ${first.warn ? 'warn' : ''}`}>{first.text}</span>{more > 0 && <span className="t3 sm">+{more} more</span>}</span>
    </Tip>
  );
}

function GridRow({ s, row, model, next }: { s: GameStateV2; row: InstrumentRow; model: string; next?: string }) {
  const I = KIND_ICON[row.kind] ?? Wrench;
  return (
    <div className="sfi-tr" data-instrument={row.id}>
      <Tip content={() => <TipCard title={<Term id="technique">{row.name}</Term>} value={row.kindLabel} rows={[{ label: 'Reads', value: row.reads.map(tname).join(', ') }, { label: <Term id="sightLimit">Hidden-goal traits</Term>, value: `${row.hiddenGoal} of ${row.reads.length}` }, ...(row.trainedAgainst ? [{ label: <Term id="goodhart">Trained against</Term>, value: 'yes', tone: 'neg' as const }] : [])]}>An instrument you own: it reads the traits listed. Owned instruments are always in use.</TipCard>}>
        <span className="sfi-in"><span className="nm"><I size={16} /> <span className="u">{row.name}</span></span><span className="t3 sm">{KIND_SHORT[row.kind]} · <span className="num">{row.reads.length}</span> trait{row.reads.length === 1 ? '' : 's'}{row.hiddenGoal ? <>, <span className="num">{row.hiddenGoal}</span> hidden-goal</> : ''}</span></span>
      </Tip>
      <Tip as="div" content={() => <TipCard title={<><Term id="instrumentReliability">Reliability</Term> on {model}</>} value={row.range.certainty.unknown ? 'Unknown' : F.pct(row.range.pct)} rows={relRows(row.range, model)} footer="Your belief, not the truth.">How often it shows a trait that is there, averaged over the traits it reads.</TipCard>}>
        <RelBar r={row.range} />
      </Tip>
      <Tip content={() => <TipCard title={<Term id="instrumentReliability">Reliability</Term>} value={`${F.pct(row.range.lo)}–${F.pct(row.range.hi)}`} rows={relRows(row.range, model)} />}>
        <RangeVal est={row.range.pct} lo={row.range.lo} hi={row.range.hi} />
      </Tip>
      {next !== undefined && (row.next ? <Tip content={() => <TipCard title={<>On {next}</>} value={row.next!.certainty.unknown ? 'Unknown' : F.pct(row.next!.pct)} rows={relRows(row.next!, next)}>Not validated on {next} yet: its reliability there is extrapolated until its validation finishes.</TipCard>}>
        <span className="sfi-nx"><RelBar r={row.next} small /><span className={`num sm ${row.next.certainty.unknown ? 'warn' : 't2'}`}>{row.next.certainty.unknown ? 'Unknown' : F.pct(row.next.pct)}</span></span>
      </Tip> : <span />)}
      <History s={s} row={row} />
      <Limits row={row} />
    </div>
  );
}

// ───────── detection grid drawer (the old detection-by-level card and the capability vs sight-limit history) ─────────

type Fams = ReturnType<typeof riskFamilies>;
const famRead = (f: Fams[number], pt: Partial<Record<TraitId, number>>) => { const ks = f.traits.filter((k) => CRITICAL_TRAITS.includes(k)); return ks.length ? ks.reduce((a, k) => a + (pt[k] ?? 0), 0) / ks.length : 1; };
const weakFamily = (fams: Fams, pt: Partial<Record<TraitId, number>>) => [...fams].filter((f) => f.critical).sort((a, b) => famRead(a, pt) - famRead(b, pt))[0];

/** The idea that would most help the family the instruments see least: a detection instrument not yet known, preferring
 *  one with teams on it, then one that can start now. */
function bestIdea(s: GameStateV2, fams: Fams): { id: string; name: string; active: boolean } | undefined {
  const weak = weakFamily(fams, sightLimit(s).perTrait);
  if (!weak) return undefined;
  let best: { id: string; name: string; score: number; active: boolean } | undefined;
  for (const n of TREE) {
    if (!n.technique || !isLineNode(n) || nodeKnown(s, n.id)) continue;
    const t = TECHNIQUE_BY_ID[n.technique];
    if (!t || t.role === 'fix') continue;
    const cov = weak.traits.reduce((a, k) => a + (t.coverage[k] ?? 0), 0);
    if (cov <= 0) continue;
    const active = teamsOn(s, n.id).length > 0;
    const ready = projectReady(s, n.id) === true;
    const score = cov + (active ? 10 : ready ? 5 : 0);
    if (!best || score > best.score) best = { id: n.id, name: n.name, score, active };
  }
  return best ? { id: best.id, name: best.name, active: best.active } : undefined;
}

/** Sight limit if an idea works (estimate from believed efficacy): with its instrument unlocked. */
function uIfWorks(s: GameStateV2, id: string): number | undefined {
  const tid = PROJECT_BY_ID[id]?.technique;
  const t = tid ? s.player.safety.techniques[tid] : undefined;
  if (!t || t.unlocked) return undefined;
  const techniques = { ...s.player.safety.techniques, [t.id]: { ...t, unlocked: true, active: true } };
  const hypo = { ...s, player: { ...s.player, safety: { ...s.player.safety, techniques } } } as GameStateV2;
  return sightLimit(hypo).L;
}

function RaceChart({ s, sv, cand }: { s: GameStateV2; sv: SV; cand: ReturnType<typeof bestIdea> }) {
  const S = s.series;
  const up = sv.validation;
  const n = S.Lmeasured.length;
  const back = Math.min(26, n);
  const L = S.Lmeasured.slice(n - back);
  const U = S.U.slice(n - back);
  const days = S.day.slice(n - back);
  const today = s.time.day;
  const ahead = 17;
  const Lnow = up.L;
  const Unow = sv.sightLimit.L;
  const capWk = (up.capPerMo * 7) / 30.4;
  const projL = Array.from({ length: ahead + 1 }, (_, i) => Lnow + capWk * i);
  const projU = Array.from({ length: ahead + 1 }, () => Unow);
  const ifU = useMemo(() => (cand ? uIfWorks(s, cand.id) : undefined), [s, store.version, cand?.id]);
  const ifEta = cand ? projectEta(s, cand.id) : Infinity;
  const ifWk = Number.isFinite(ifEta) ? Math.ceil(ifEta / 7) : undefined;
  const all = [...L, ...U, ...projL, ...projU, ...(ifU !== undefined ? [ifU] : [])].filter((x) => Number.isFinite(x));
  const lo = Math.max(0, Math.floor((Math.min(...all, Lnow) - 0.3) * 2) / 2); // levels start at 0
  const hi = Math.ceil((Math.max(...all, Lnow) + 0.3) * 2) / 2;
  const W = 700, H = 260, pl = 34, pr = 96, pt = 14, pb = 24;
  const total = back - 1 + ahead;
  const x = (i: number) => pl + (i / Math.max(1, total)) * (W - pl - pr);
  const y = (v: number) => pt + (1 - (v - lo) / Math.max(0.1, hi - lo)) * (H - pt - pb);
  const path = (vs: number[], off = 0) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i + off).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const t0 = back - 1;
  const top = L.map((l, i) => Math.max(l, U[i]));
  const blind = `${top.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')} ${[...U].reverse().map((v, j) => `L${x(back - 1 - j)},${y(v)}`).join(' ')} Z`;
  const ptop = projL.map((l, i) => Math.max(l, projU[i]));
  const pblind = `${ptop.map((v, i) => `${i ? 'L' : 'M'}${x(t0 + i)},${y(v)}`).join(' ')} ${[...projU].reverse().map((v, j) => `L${x(t0 + ahead - j)},${y(v)}`).join(' ')} Z`;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += hi - lo > 3 ? 1 : 0.5) ticks.push(v);
  const months: { i: number; label: string }[] = [];
  for (let i = 1; i <= total; i++) {
    const d = i < back ? days[i] : today + (i - t0) * 7;
    const prev = i - 1 < back ? days[i - 1] : today + (i - 1 - t0) * 7;
    const a = dateOf(s, prev);
    const b = dateOf(s, d);
    if (a.getUTCMonth() !== b.getUTCMonth()) months.push({ i, label: b.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) });
  }
  return (
    <div className="sfi-sec">
      <div className="sfi-cap row-i"><ICON.U size={13} /> <Term id="sightLimit">Capability vs sight limit</Term> <span className="t3">· internal model · 6 mo back, 4 ahead</span><span className="sp" />
        <span className="sf-legend small"><span><i style={{ background: C.cap }} />Capability</span><span><i style={{ background: C.und }} />Sight limit</span><span><i className="hatch" />past it</span><span className="dim">- - projected</span></span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="sf-svg" data-test="race-chart">
        <defs><pattern id="sfiHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke={C.bad} strokeWidth="2" opacity="0.55" /></pattern></defs>
        {ticks.map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} className="sf-grid" /><text x={pl - 6} y={y(v) + 3} className="sf-ax" textAnchor="end">{v.toFixed(1)}</text></g>)}
        {months.map((m) => <text key={m.i} x={x(m.i)} y={H - 6} className="sf-ax" textAnchor="middle">{m.label}</text>)}
        <path d={blind} fill="url(#sfiHatch)" />
        <path d={pblind} fill="url(#sfiHatch)" opacity={0.5} />
        <line x1={x(t0)} x2={x(t0)} y1={pt} y2={H - pb} className="sf-today" />
        <text x={x(t0) + 4} y={pt + 8} className="sf-ax">today</text>
        <path d={path(L)} stroke={C.cap} strokeWidth={2} fill="none" />
        <path d={path(U)} stroke={C.und} strokeWidth={2} fill="none" />
        <path d={path(projL, t0)} stroke={C.cap} strokeWidth={2} fill="none" strokeDasharray="5 4" />
        <path d={path(projU, t0)} stroke={C.und} strokeWidth={2} fill="none" strokeDasharray="5 4" />
        {ifU !== undefined && ifWk !== undefined && ifWk <= ahead && ifU > projU[ifWk] + 0.05 && (
          <g>
            <path d={`M${x(t0)},${y(Unow)} L${x(t0 + ifWk)},${y(projU[ifWk])} L${x(t0 + ifWk)},${y(ifU)} L${x(t0 + ahead)},${y(ifU)}`} stroke={C.watch} strokeWidth={2} fill="none" strokeDasharray="4 3" />
            <text x={x(t0 + ahead) + 4} y={y(ifU) + 3} className="sf-lab" fill={C.watch}><tspan>Sight limit</tspan><tspan x={x(t0 + ahead) + 4} dy={11}>if {cand?.name.split(' ')[0].toLowerCase()} works</tspan></text>
          </g>
        )}
        <text x={x(total) + 4} y={y(projL[ahead]) + 3} className="sf-lab" fill={C.cap}>capability</text>
        <text x={x(total) + 4} y={y(projU[ahead]) + 3} className="sf-lab" fill={C.und}>sight limit</text>
        {L.map((l, i) => (
          <Tip key={i} as="g" content={() => <TipCard title={fmtDate(dateOf(s, days[i]))} rows={[{ label: <Term id="L">Capability</Term>, value: F.num(l, 2) }, { label: <Term id="sightLimit">Sight limit</Term>, value: F.num(U[i], 2) }, { label: 'Past it by', value: F.num(Math.max(0, l - U[i]), 2), tone: l > U[i] ? 'neg' : 'neutral' }]} />}>
            <rect x={x(i) - 6} y={pt} width={12} height={H - pt - pb} fill="transparent" />
          </Tip>
        ))}
        <Tip as="g" content={() => <TipCard title={<><Term id="sightLimit">Sight limit</Term> · {fmtDate(dateOf(s, s.time.day))}</>} value={F.sight(sv.sightLimit)} rows={[
          { label: <>capability {F.num(up.capPerMo, 2, true)}/mo</>, value: up.notOnCurrent ? `${up.notOnCurrent} not validated on ${up.model ?? 'the model'}` : 'all validated on the model', tone: up.notOnCurrent ? 'neg' : 'pos' },
          ...(cand && ifU !== undefined ? [{ label: <>{cand.name} works</>, value: `level ${F.num(sv.sightLimit.L, 1)} → level ${F.num(ifU, 1)}` }] : []),
        ]}>The highest level at which your instruments together still read the hidden-goal traits at 50% or better; the range is what your uncertainty about each instrument allows.</TipCard>}>
          <circle cx={x(t0)} cy={y(Unow)} r={6} fill={C.panel} stroke={C.und} strokeWidth={2} data-test="u-point" />
        </Tip>
      </svg>
    </div>
  );
}

function DetectionGrid({ s }: { s: GameStateV2 }) {
  const g = useMemo(() => sightGrid(s), [s, store.version]);
  const cur = Math.round(g.L);
  return (
    <div className="sfi-sec" data-home="detectionByLevel">
      <div className="sfi-cap"><Term id="sightLimit">Reading by trait and level</Term> <span className="t3">· believed reading of each hidden-goal trait at each capability level (10 = best human)</span></div>
      <div className="det-grid" style={{ gridTemplateColumns: `150px repeat(${g.levels.length}, minmax(0, 1fr))` }}>
        <span />
        {g.levels.map((l) => <span key={l} className={`det-h num ${l === cur ? 'cur' : ''}`}>{l}</span>)}
        {g.rows.map((r) => {
          const Icon = TRAIT_ICON[r.trait];
          return [
            <span key={r.trait} className="det-t">{Icon && <Icon size={12} />}<Term id={`trait:${r.trait}`}>{tname(r.trait).replace('Successor alignment to self', 'Successor align.')}</Term></span>,
            ...r.det.map((d, i) => {
              const edge = d >= 0.5 && (r.det[i + 1] ?? 1) < 0.5;
              return (
                <Tip key={`${r.trait}${i}`} content={() => <TipCard title={`${tname(r.trait)} at level ${g.levels[i]}`} value={`${F.idx(d * 100)}% read`}>{d >= 0.5 ? 'Your instruments would read it at this level.' : 'Below 50%: your instruments would likely miss it at this level.'}</TipCard>}>
                  <span className={`det-c num ${g.levels[i] === cur ? 'cur' : ''} ${edge ? 'edge' : ''}`} style={{ background: div((d - 0.5) * 2.2) }}>{g.levels[i] === cur ? F.idx(d * 100) : ''}</span>
                </Tip>
              );
            }),
          ];
        })}
      </div>
      <div className="det-leg small dim">
        <span className="row-i"><i className="det-sw cur" /> your level</span>
        <span className="row-i"><i className="det-sw edge" /> last level at 50% or better</span>
      </div>
    </div>
  );
}

// ───────── results drawer (safety research results, publishing) ─────────

const FTYPE: Record<string, { icon: LucideIcon; label: string; tone: string }> = {
  TECH: { icon: Wrench, label: 'Instrument', tone: 'good' }, EVAL: { icon: Ruler, label: 'Eval', tone: 'good' }, DISC: { icon: Telescope, label: 'Discovery', tone: 'warn' },
  DEAD: { icon: Ban, label: 'Failed', tone: 'neu' }, NEG: { icon: TrendingDown, label: 'Negative', tone: 'bad' }, SPILL: { icon: Droplets, label: 'Spillover', tone: 'neu' },
  FALSE: { icon: Wrench, label: 'Instrument', tone: 'good' },
};
const lineName = (id: string) => AGENDA_BY_ID[id as keyof typeof AGENDA_BY_ID]?.name ?? id;

function Results({ s, sv }: { s: GameStateV2; sv: SV }) {
  const rows = [...sv.findings].reverse();
  const pol = s.player.policies.publishSafety;
  return (
    <div className="sfi-sec">
      <div className="row-i sfi-pub"><b><Term id="publishPolicy">Publish results</Term></b><span className="sp" />
        <span className="seg-acts">{(['none', 'selective', 'all'] as const).map((p) => <span key={p} className={pol === p ? 'on' : ''}><ActBtn id="safety.publishPolicy" testId={`safety.publishPolicy.${p}`} params={{ policy: p }} label={p} /></span>)}</span>
      </div>
      <div className="find-list">
        {rows.map((f) => {
          const ft = FTYPE[f.type] ?? FTYPE.TECH;
          return (
            <div className="sf-find sfi-find" key={f.id + f.day} data-finding={f.id}>
              <span className={`ftype2 ${ft.tone}`}><ft.icon size={12} />{ft.label}</span>
              <Tip content={() => <TipCard title={f.title} rows={[{ label: 'Programme', value: lineName(f.agenda) }, { label: 'Date', value: fmtDate(dateOf(s, f.day)) }, ...(f.job ? [{ label: <Term id="expectedObserved">Expected vs observed</Term>, value: `${F.pct(f.job.expected)} chance it works · ${f.job.observed ? 'worked' : 'did not'}` }, { label: <Term id="aiDoneShare">AI share</Term>, value: `${F.pct(f.job.aiShare)}${f.job.aiShare > 0 ? ` · spot-checked ${F.pct(f.job.spot)}` : ''}` }] : [])]} />}><span className={`ellip ${f.retracted ? 'strike' : ''}`}>{f.title}</span></Tip>
              <span className="t3 sm">{date(s, f.day)}</span>
              {f.published ? <span className="tag2 good">published</span> : f.retracted ? <span className="tag2 bad">retracted</span> : <ActBtn id="safety.publish" testId={`safety.publish.${f.id}`} params={{ findingId: f.id }} label="Publish" />}
            </div>
          );
        })}
        {!rows.length && <div className="dim small">No results yet.</div>}
      </div>
    </div>
  );
}

// ───────── side cards ─────────

function HiddenGoals({ s, id, name, onGrid }: { s: GameStateV2; id?: string; name: string; onGrid: () => void }) {
  const reads = useMemo(() => hiddenGoalReads(s, id), [s, store.version, id]);
  const above = reads.filter((r) => r.read >= 0.5).length;
  return (
    <Card title={<span className="row-i"><Crosshair size={15} /> Hidden goals you can read on {name}</span>} home="hiddenGoalReads" className="sfi-card"
      right={<button className="ref-chip" data-test="detection-open" onClick={onGrid}>Detection grid <ICON.go size={11} /></button>}>
      <div className="sfi-sub">All your instruments together: chance a hidden goal that is there shows up</div>
      <div className="sfi-hg">
        {reads.map((r) => (
          <Tip key={r.trait} as="div" content={() => <TipCard title={<Term id={`trait:${r.trait}`}>{tname(r.trait)}</Term>} value={F.pct(r.read)}>Believed chance your instruments together show {tname(r.trait).toLowerCase()} on {name} if it is there, at its measured skill. Below 50% they miss it more often than they find it.</TipCard>}>
            <div className="sfi-hgr" data-trait={r.trait}>
              <span className="nm"><Term id={`trait:${r.trait}`}>{tname(r.trait)}</Term></span>
              <span className="bar"><i style={{ width: `${r.read * 100}%` }} /><b /></span>
              <span className="num w">{F.pct(r.read)}</span>
            </div>
          </Tip>
        ))}
        <div className="sfi-hgr ax"><span /><span className="bar0"><span>50%</span></span><span /></div>
      </div>
      <div className="sfi-note">{above === 0 ? <>All under 50%: on {name} you miss more hidden goals than you find.</> : above === reads.length ? <>All at 50% or better on {name}.</> : <><span className="num">{above}</span> of <span className="num">{reads.length}</span> at 50% or better on {name}; below it you miss more than you find.</>}</div>
    </Card>
  );
}

function Validation({ s, id, nextId }: { s: GameStateV2; id?: string; nextId?: string }) {
  const target = nextId ?? id;
  const tv = versionById(s, target);
  const vb = useMemo(() => validationBatches(s, target), [s, store.version, target]);
  const vv = safetyView(s).validation;
  const name = versionById(s, id)?.name ?? '';
  const open = vv.model && tv?.name === vv.model && !vb.batches.some((b) => b.modelId === target) ? vv.notOnCurrent : 0;
  return (
    <Card title={<span className="row-i"><FlaskConical size={15} /> <Term id="validation">Validation</Term></span>} home="validation" id="ctl-validation" className="sfi-card"
      right={<Ref id="safReNeeds" to={{ panel: 'lab' }}>Order in Lab</Ref>}>
      <div className="sfi-vq">
        {vb.batches.map((b) => (
          <div key={b.modelId} className="sfi-vb" data-test="validation-queue">
            <Tip as="div" content={() => <TipCard title={<>Validating on {b.model}</>} value={Number.isFinite(b.daysLeft) ? `${F.days(b.daysLeft)} left` : 'waiting for engineers'} rows={[{ label: 'Instruments', value: b.names.join(', ') }, { label: 'Engineers', value: F.count(b.engineers) }, { label: 'Done', value: F.pct(b.progress) }, { label: 'Run by', value: b.human ? 'people' : 'AI staff with people' }]}>Each validation plants the trait in a test copy of the model and counts the planted cases the instrument finds.</TipCard>}>
              <div className="row-i"><span className="w"><span className="num">{b.count}</span> {b.count === 1 ? 'instrument' : 'instruments'} on <b>{b.model}</b></span><span className="t3 sm">{b.human ? 'by people' : 'AI-assisted'} · <span className="num">{F.count(b.engineers)}</span> engineers</span><span className="sp" /><span className="num w sm">{Number.isFinite(b.daysLeft) ? `${F.days(b.daysLeft)} left` : 'waiting'}</span></div>
              <div className="sfi-pbar"><i style={{ width: `${b.progress * 100}%` }} /></div>
            </Tip>
            {b.modelId !== id && <div className="t3 sm">Until it finishes, {b.model}&apos;s readings use reliability extrapolated from {name} (dashed).</div>}
          </div>
        ))}
        {!vb.batches.length && <div className="t3 sm" data-test="validation-queue">{open ? `${open} instruments not validated on ${vv.model}` : 'Nothing waiting: every instrument is validated on the newest model.'}</div>}
        {open > 0 && <div className="row-i"><span className="sp" /><ActBtn id="safety.validate" params={{ tool: 'all', model: target ?? '' }} label={`Validate all on ${tv?.name ?? 'model'}`} testId="validate-all" /></div>}
        {vb.methods.map((m) => (
          <div key={m.id} className="sfi-vm" data-method={m.id}>
            <div className="row-i"><Syringe size={14} /><span className="w"><Term id="safetyMethod">{m.name}</Term> <span className="t3">(method)</span></span><span className="sp" />
              {m.queued ? <span className="t3 sm">queued</span> : <ActBtn id="safety.validate" params={{ tool: m.id, model: target ?? '' }} label="Validate" testId="validate-methods" />}</div>
            <Tip content={() => <TipCard title={<>{m.name} at {tv?.name}&apos;s scale</>} value={`${mx(m.lo)}–${mx(m.hi)}×`} rows={[{ label: 'Validated on', value: m.validatedOn ?? 'never past its tested scale' }, { label: 'A validation takes', value: `~${F.days(m.days)} · ${F.count(m.engineers)} engineers` }]}>Its effect on a model this capable could be anywhere in this range times what was tested. A validation plants the trait in a test copy, trains it with the method, and counts the cases it removes.</TipCard>}>
              <span className="t3 sm">Not validated at {tv?.name}&apos;s scale: its effect there could be <span className="num w">{mx(m.lo)}–{mx(m.hi)}×</span> what was tested. ~<span className="num">{F.days(m.days)}</span> · <span className="num">{F.count(m.engineers)}</span> engineers</span>
            </Tip>
          </div>
        ))}
        <div className="sfi-vp row-i"><Repeat size={14} /><Tip content={() => <TipCard title="Validate each new model" value={vv.autoNew ? 'On' : 'Off'}>When a new model joins your AI staff, every instrument is queued for validation on it.</TipCard>}><span className="t2">Validate every instrument on each new model</span></Tip><span className="sp" />
          <span className={`sfi-tog ${vv.autoNew ? 'on' : ''}`}><ActBtn id="safety.validationPolicy" params={{ on: !vv.autoNew }} label={vv.autoNew ? 'On' : 'Off'} testId="validate-auto" /></span></div>
        <div className="sfi-vp row-i"><Syringe size={14} /><Tip content={() => <TipCard title="Validate methods on each new model" value={vv.autoMethods ? 'On' : 'Off'}>Also queues each owned method a new model has outgrown.</TipCard>}><span className="t2">Validate methods on each new model</span></Tip><span className="sp" />
          <span className={`sfi-tog ${vv.autoMethods ? 'on' : ''}`}><ActBtn id="safety.validationPolicy" params={{ methods: !vv.autoMethods }} label={vv.autoMethods ? 'On' : 'Off'} testId="validate-methods-auto" /></span></div>
      </div>
    </Card>
  );
}

function Disagreements({ s, id, name }: { s: GameStateV2; id?: string; name: string }) {
  const d = useMemo(() => disagreementsView(s, id), [s, store.version, id]);
  const KI = (k: string) => KIND_ICON[k] ?? Wrench;
  const tip = (x: NonNullable<typeof d.last>) => () => <TipCard title={<>{x.model} · {tname(x.trait)}</>} value={date(s, x.day)} rows={[{ label: x.a.label, value: F.pct(x.a.reading) }, { label: x.b.label, value: F.pct(x.b.reading) }]}>Two independent instruments read this trait far outside each other&apos;s range: one of them is wrong, and you are not told which. A case or a validation by people can tell.</TipCard>;
  const line = (x: NonNullable<typeof d.last>) => { const A = KI(x.a.kind); const B = KI(x.b.kind); return <Tip content={tip(x)}><span className="row-i sfi-dr"><A size={13} /> {KIND_SHORT[x.a.kind] ?? x.a.label} <b className="num w">{F.pct(x.a.reading)}</b><span className="t3">vs</span><B size={13} /> {KIND_SHORT[x.b.kind] ?? x.b.label} <b className="num w">{F.pct(x.b.reading)}</b></span></Tip>; };
  return (
    <Card title={<span className="row-i"><GitCompare size={15} /> <Term id="instrumentDisagreement">Disagreements</Term></span>} sub="two kinds read the same trait far apart" home="disagreements" className="sfi-card sfi-dis">
      {d.onModel.length ? d.onModel.slice(0, 2).map((x, i) => (
        <Tip key={i} as="div" content={tip(x)}>
          <div className="sfi-dl one"><span><b className="w">{tname(x.trait)}</b> <span className="t3">· {date(s, x.day)}</span></span>{line(x)}</div>
        </Tip>
      )) : <span className="sfi-chip good row-i"><Check size={12} /> None on {name}</span>}
            {d.last && !d.onModel.length && <>
        <div className="t3 sm sfi-last">Last one</div>
        <Tip as="div" content={tip(d.last)}>
          <div className="sfi-dl"><span><b className="w">{d.last.model} · {tname(d.last.trait)}</b> <span className="t3">· {date(s, d.last.day)}</span></span>
            <span className="row-i">{line(d.last)}<span className="sp" /><Ref id="investigation" to={CASES}>Open case</Ref></span></div>
        </Tip>
      </>}
      {d.onModel.length > 0 && <div className="row-i">{d.onModel.length > 2 && <Tip content={() => <TipCard title={<>Disagreements on {name}</>} rows={d.onModel.map((x) => ({ label: `${tname(x.trait)} · ${date(s, x.day)}`, value: `${F.pct(x.a.reading)} vs ${F.pct(x.b.reading)}` }))} />}><span className="t3 sm">+{d.onModel.length - 2} more on {name}</span></Tip>}<span className="sp" /><Ref id="investigation" to={CASES}>Open case</Ref></div>}
    </Card>
  );
}

// ───────── the tab ─────────

export function InstrumentsTab({ s }: { s: GameStateV2 }) {
  const { models, pick, id } = useSafetyPick(s);
  const nextId = models.find((m) => m.evaluating && m.id !== id)?.id;
  const sv = safetyView(s);
  const g = useMemo(() => instrumentsGrid(s, id, nextId), [s, store.version, id, nextId]);
  const logs = useMemo(() => realUseLogs(s, id), [s, store.version, id]);
  const [drawer, setDrawer] = useState<'' | 'grid' | 'results'>('');
  const close = useCallback(() => setDrawer(''), []);
  const cand = useMemo(() => bestIdea(s, riskFamilies(s, id)), [s, store.version, id]);
  const name = pick?.name ?? versionById(s, id)?.name ?? 'your model';
  const hasNext = !!g.next;
  const cols = `235px 250px 125px ${hasNext ? '150px ' : ''}185px minmax(0, 1fr)`;
  const w = logs.watched;
  return (
    <div className="sfi-body">
      <section className="card2 sfi-grid" data-home="reliabilityGrid" style={{ ['--sfi-cols' as string]: cols }}>
        <div className="sfi-hd"><span className="ttl"><Telescope size={16} /> Your instruments on {name}</span><span className="t3">How often each shows a trait that is there</span><span className="sp" />
          <span className="sfi-leg"><span><i className="sw" />validated on this model</span><span><i className="sw dash" />extrapolated</span><span><span className="sf-unk">Unknown</span> range over 30 pts</span></span></div>
        <div className="sfi-th">
          <span>Instrument</span>
          <span><Term id="instrumentReliability">Reliability</Term> on {name}<span className="sfi-ax">{[0, 10, 20, 30, 40, 50, 60].map((v) => <i key={v} style={{ left: X(v / 100), transform: `translateX(${v === 0 ? '0' : v === 60 ? '-100%' : '-50%'})` }}>{v}%</i>)}</span></span>
          <span />
          {hasNext && <span>On {g.next}<br /><span className="lc">extrapolated</span></span>}
          <span><Term id="validation">Validated</Term> · found of 20</span>
          <span>Main limit</span>
        </div>
        {g.rows.map((r) => <GridRow key={r.id} s={s} row={r} model={name} {...(hasNext ? { next: g.next } : {})} />)}
        {!g.rows.length && <div className="sfi-empty t3">You own no instruments yet: they come from safety research.</div>}
        <div className="sfi-tr logs" data-instrument="logs">
          <Tip content={() => <TipCard title={<Term id="realUseLogs">Real-use logs</Term>} value={logs.readings ? `${logs.readings} readings` : 'none yet'}>What the model does in real work, read by the monitors that watch your AI staff: real-use readings of its traits, compared with tests.</TipCard>}>
            <span className="sfi-in"><span className="nm t2"><Activity size={16} /> <span className="u">Real-use logs</span></span><span className="t3 sm">Logs · from monitors</span></span>
          </Tip>
          <span className="sfi-rb empty" />
          <Tip content={() => <TipCard title="Real-use readings" value={String(logs.readings)}>Readings of {name}&apos;s traits taken by monitors on its AI staff work.</TipCard>}><span className="t3 sm">{logs.readings ? <><span className="num">{logs.readings}</span> readings</> : 'no readings yet'}</span></Tip>
          {hasNext && <span />}
          <span />
          <span className="sfi-lim">
            {w !== undefined ? <Tip content={() => <TipCard title={<Term id="monitorCoverage">Watched share</Term>} value={F.pct(w, w < 0.1 ? 1 : 0)}>Share of {name}&apos;s AI staff work a monitor watches (averaged over its jobs by their compute). Set on Safeguards.</TipCard>}>
              <span className={`sfi-chip ${w < 0.5 ? 'warn' : ''}`}>watched {F.pct(w, w < 0.1 ? 1 : 0)}</span>
            </Tip> : <span className="t3 sm">no AI staff work</span>}
            <Ref id="agentMonitor" to={{ panel: 'safety', tab: 'safeguards' }}>Monitors</Ref>
          </span>
        </div>
        <div className="sfi-notes">
          <Info size={14} className="t3" /><span>Validation plants the trait in a test copy and counts how many cases the instrument finds. Planted cases are easier than real ones, so reliability = share found × <Tip content={() => <TipCard title="Planted to real" value="× 0.7">Planted cases are easier to read than a real model&apos;s own traits: your lab reads a planted share as 0.4–1.0 of it in real use, 0.7 as the best guess.</TipCard>}><span className="num w">0.7</span></Tip>.</span>
          <ChartColumn size={14} className="t3" /><span>History bars: planted cases found on the last three models validated. A drop when people run the validation is how a broken or sabotaged instrument shows.</span>
        </div>
        <div className="sfi-foot">
          <span className="t2">More reliable instruments come from safety research.</span><Ref id="safetyProgrammes" to={{ panel: 'research', tab: 'projects' }}>Safety programmes</Ref>
          <button className="ref-chip" id="ctl-findings" data-test="results-open" onClick={() => setDrawer('results')}>Results <span className="num">{sv.findings.length}</span> <ICON.go size={11} /></button>
          <span className="sp" />
          <Tip content={() => <TipCard title="Trained against · waiting to be ported" rows={[{ label: <Term id="goodhart">Trained against</Term>, value: String(g.trainedAgainst) }, { label: `Not validated on ${name}, not queued`, value: String(g.waitingPort) }]}>An instrument trained against reads less; one not validated on a model reads it by extrapolation.</TipCard>}>
            <span className="t3">{g.trainedAgainst ? `${g.trainedAgainst} trained against` : 'None trained against'} · {g.waitingPort ? `${g.waitingPort} waiting to be ported` : 'none waiting to be ported'}</span>
          </Tip>
        </div>
      </section>
      <div className="sfi-side">
        <HiddenGoals s={s} id={id} name={name} onGrid={() => setDrawer('grid')} />
        <Validation s={s} id={id} {...(nextId ? { nextId } : {})} />
        <Disagreements s={s} id={id} name={name} />
      </div>
      <SfDrawer open={drawer === 'grid'} onClose={close} title={<><Crosshair size={18} /> Detection grid</>} sub={`· hidden-goal traits by capability · ${name}`} test="detection-drawer">
        <DetectionGrid s={s} />
        <RaceChart s={s} sv={sv} cand={cand} />
      </SfDrawer>
      <SfDrawer open={drawer === 'results'} onClose={close} title={<><ICON.finding size={18} /> <Term id="finding">Results</Term></>} sub={`· ${sv.findings.length} from safety research`} home="findings" test="results-drawer">
        <Results s={s} sv={sv} />
      </SfDrawer>
    </div>
  );
}
