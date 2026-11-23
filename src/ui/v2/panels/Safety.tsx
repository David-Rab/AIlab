// SAFETY (UB-9; UI-IA §1 SAFETY, approved mockups design/ux/mockups/rd/safety*.png). The header (model picker, Loss-of-control
// risk, Unstopped harm, sight curve, Safety framework) and the Risks tab live in SafetyRisks.tsx. Tabs: Risks · Model
// (risk families and traits, trait graph, successor steering, new failure modes) · Instruments (instruments, detection by
// level, the capability vs sight-limit history, validation, results) · Safeguards (AI staff safeguards, footholds,
// policies) · Incidents & cases · Programmes (safety programmes, until RESEARCH holds them). The Model, Instruments and
// Safeguards cards are the old Overview / Trait graph / Footholds cards regrouped; their redesign is a later task.
import { useMemo, useState, type ReactNode } from 'react';
import { Ban, ClipboardCheck, Droplets, Eye, Ruler, Telescope, TrendingDown, Wrench, X, type LucideIcon } from 'lucide-react';
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { CRITICAL_TRAITS, TRAIT_BY_ID, TRAIT_IDS, TRAIT_MEANING } from '../../../data/v2/traits';
import { RISK_FAMILIES } from '../../../data/v2/agents';
import { PRODUCT_DEFS } from '../../../data/v2/features';
import { PROJECT_BY_ID, TREE, isLineNode } from '../../../data/v2/tree';
import { COLUMN_LABEL } from '../../../data/v2/teams';
import {
  dateOf, sightGrid, sightLimit, evalDaysFor, fmtDate, footholdView, INV_FTE, INV_MAX_DAYS, MONITOR_BUDGET_STEP, monitorAt, monitoredUses, nodeKnown, hardenLevel, projectEta, publicTimerRules, responseOptions, disclosurePolicy, DISCLOSURE_LABEL, DISCLOSURE_POLICIES, mustReport, willDisclose,
  projectReady, riskFamilies, safIdleFlag, safetyAgentVersion, safetyFleet, safetyView, successorPullView, teamsOn, versionById,
  FOLDED_METHODS,
} from '../../../engine/v2';
import type { FindingType, GameStateV2, LineRow, ResponseKind, TraitId } from '../../../engine/v2';
import { store } from '../store';
import { riskClass, riskColor, safetyModel } from '../safetyRule';
import { ActBtn, Limit, Term, Tip, TipCard } from '../ui';
import { Card, HBar, Pill, Ref, tabOf, Tabs } from '../kit';
import * as F from '../fmt';
import { FAMILY_ICON, ICON, TRAIT_ICON } from '../icons';
import { C, SPHERE, div } from '../theme';
import { TraitGraph, traitSev } from './TraitGraph';
import { ControlCard, FootholdsTab } from './SafetyControl';
import { RisksTab, SafetyHeader } from './SafetyRisks';
import './safety.css';

type SV = ReturnType<typeof safetyView>;
const FAM_ICON: Record<string, LucideIcon> = FAMILY_ICON;
const COL_ICON: Record<string, LucideIcon> = { alignment: ICON.colAlignment, interp: ICON.colInterp, evals: ICON.colEvals };
/** SR-18: short button labels; which responses an incident offers comes from its believed cause (responseOptions). */
const RESPONSE_LABEL: Record<ResponseKind, string> = {
  patchSignal: 'Harden environments', addMethod: 'Method for later runs', restrictContext: 'Restrict context', liftRestriction: 'Lift restriction',
  addControl: 'Add control protocol', removeControl: 'Remove control protocol', addLockdown: 'Comms lockdown', removeLockdown: 'Lift lockdown', rollback: 'Roll back', removeFoothold: 'Remove foothold',
};
const FTYPE: Record<string, { icon: LucideIcon; label: string; tone: string }> = {
  TECH: { icon: Wrench, label: 'Instrument', tone: 'good' }, EVAL: { icon: Ruler, label: 'Eval', tone: 'good' }, DISC: { icon: Telescope, label: 'Discovery', tone: 'warn' },
  DEAD: { icon: Ban, label: 'Failed', tone: 'neu' }, NEG: { icon: TrendingDown, label: 'Negative', tone: 'bad' }, SPILL: { icon: Droplets, label: 'Spillover', tone: 'neu' },
  FALSE: { icon: Wrench, label: 'Instrument', tone: 'good' },
};
const HEALTH_TONE: Record<string, string> = { Promising: 'good', Mixed: 'warn', Struggling: 'bad' };
const tname = (t: string) => TRAIT_BY_ID[t as TraitId]?.name ?? F.words(t);
const eta = (d: number) => (Number.isFinite(d) ? F.days(d) : '—');
const lineName = (id: string) => AGENDA_BY_ID[id as keyof typeof AGENDA_BY_ID]?.name ?? id;

/** UB-9 tab ids, and the old ids other screens still link to. */
const TAB_ALIAS: Record<string, string> = { overview: 'risks', graph: 'model', footholds: 'safeguards', incidents: 'cases' };

export function Safety({ s }: { s: GameStateV2 }) {
  const sv = safetyView(s);
  const raw = tabOf('safety', 'risks');
  const tab = TAB_ALIAS[raw] ?? raw;
  const openInc = sv.incidents.filter((i) => i.status === 'open' || i.status === 'investigating').length;
  const openCases = sv.investigations.filter((i) => !i.outcome).length;
  const lb = sv.lineBadges;
  const fv = footholdView(s);
  return (
    <div className="panel-v2 safety" data-panel="safety">
      <SafetyHeader s={s} />
      <div className="sf-tabs">
        <Tabs panel="safety" def="risks" tabs={[
          { id: 'risks', label: 'Risks' }, { id: 'model', label: 'Model' }, { id: 'instruments', label: 'Instruments' },
          { id: 'safeguards', label: 'Safeguards', badge: fv.suspected + fv.located || undefined },
          { id: 'cases', label: 'Incidents & cases', badge: openCases + openInc || undefined },
          { id: 'lines', label: 'Programmes', badge: lb.promisingIdle.length || undefined },
        ]} />
      </div>
      {tab === 'risks' && <RisksTab s={s} />}
      {tab === 'model' && <ModelTab s={s} sv={sv} />}
      {tab === 'instruments' && <InstrumentsTab s={s} sv={sv} />}
      {tab === 'safeguards' && <SafeguardsTab s={s} sv={sv} />}
      {tab === 'lines' && <LinesTab s={s} sv={sv} />}
      {/* Jank S4: incidents and investigations share one tab (each was one line on an empty page most of the game). */}
      {tab === 'cases' && <div className="sf-cases2"><IncidentsTab s={s} sv={sv} /><CasesTab s={s} sv={sv} /></div>}
    </div>
  );
}

// ───────── Model · Instruments · Safeguards (UB-9: the old Overview's cards, regrouped; their redesign is later) ─────────
function ModelTab({ s, sv }: { s: GameStateV2; sv: SV }) {
  const v = safetyModel(s);
  return (
    <div className="sf-tabgrid">
      <div className="sf-main">
        <Families s={s} />
        <Card title="How training shapes traits" term="traitGraph" home="traitGraph"
          sub={<>{v?.name ?? ''} · nodes: your <Term id="belief">belief</Term> (best guess, range) · links: <Term id="evidenceGrade">evidence</Term> (width = size, solid = strong … dotted = weak)</>}>
          <TraitGraph s={s} versionId={v?.id} />
        </Card>
      </div>
      <div className="sf-side">
        <SuccessorCard s={s} />
        <UModes sv={sv} />
      </div>
    </div>
  );
}

function InstrumentsTab({ s, sv }: { s: GameStateV2; sv: SV }) {
  const fams = riskFamilies(s, safetyModel(s)?.id);
  const cand = bestIdea(s, fams);
  return (
    <div className="sf-tabgrid">
      <div className="sf-main">
        <ToolsCard sv={sv} />
        <DetectionCard s={s} sv={sv} />
        <RaceChart s={s} sv={sv} fams={fams} cand={cand} />
      </div>
      <div className="sf-side">
        <ValidationCard sv={sv} />
        <ResultsCard s={s} sv={sv} />
      </div>
    </div>
  );
}

function SafeguardsTab({ s, sv }: { s: GameStateV2; sv: SV }) {
  return (
    <div className="sf-tabgrid">
      <div className="sf-main">
        <ControlCard s={s} />
        <FootholdsTab s={s} />
      </div>
      <div className="sf-side">
        <Policies s={s} sv={sv} />
      </div>
    </div>
  );
}

type Fams = ReturnType<typeof riskFamilies>;
/** A family's mean reading over its hidden-goal traits at the model's level (the sight limit's drill-down). */
const famRead = (f: Fams[number], pt: Partial<Record<TraitId, number>>) => { const ks = f.traits.filter((k) => CRITICAL_TRAITS.includes(k)); return ks.length ? ks.reduce((a, k) => a + (pt[k] ?? 0), 0) / ks.length : 1; };
/** The hidden-goal family your instruments read least at the model's level (deception or power). */
const weakFamily = (fams: Fams, pt: Partial<Record<TraitId, number>>) => [...fams].filter((f) => f.critical).sort((a, b) => famRead(a, pt) - famRead(b, pt))[0];

/** The idea that would most help the family the tools see least: a detection tool not yet known, preferring one with
 *  teams on it, then one that can start now. */
function bestIdea(s: GameStateV2, fams: Fams): { id: string; name: string; fam: Fams[number]; active: boolean } | undefined {
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
  return best ? { id: best.id, name: best.name, fam: weak, active: best.active } : undefined;
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

function RaceChart({ s, sv, fams, cand }: { s: GameStateV2; sv: SV; fams: Fams; cand: ReturnType<typeof bestIdea> }) {
  const S = s.series;
  const up = sv.validation;
  const n = S.Lmeasured.length;
  const back = Math.min(26, n);
  const L = S.Lmeasured.slice(n - back);
  const U = S.U.slice(n - back);
  const days = S.day.slice(n - back);
  const today = s.time.day;
  const ahead = 17; // weeks shown ahead
  const Lnow = up.L;
  const Unow = sv.sightLimit.L;
  const capWk = (up.capPerMo * 7) / 30.4;
  const projL = Array.from({ length: ahead + 1 }, (_, i) => Lnow + capWk * i);
  const projU = Array.from({ length: ahead + 1 }, (_, i) => Unow + 0 * i);
  const ifU = useMemo(() => (cand ? uIfWorks(s, cand.id) : undefined), [s, s.time.day, cand?.id]);
  const ifEta = cand ? projectEta(s, cand.id) : Infinity;
  const ifWk = Number.isFinite(ifEta) ? Math.ceil(ifEta / 7) : undefined;
  const all = [...L, ...U, ...projL, ...projU, ...(ifU !== undefined ? [ifU] : [])].filter((x) => Number.isFinite(x));
  const lo = Math.floor((Math.min(...all, Lnow) - 0.3) * 2) / 2;
  const hi = Math.ceil((Math.max(...all, Lnow) + 0.3) * 2) / 2;
  const W = 720;
  const H = 300;
  const pl = 34;
  const pr = 96;
  const pt = 14;
  const pb = 24;
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
  for (let i = 0; i <= total; i++) {
    const d = i < back ? days[i] : today + (i - t0) * 7;
    const prev = i === 0 ? undefined : i - 1 < back ? days[i - 1] : today + (i - 1 - t0) * 7;
    if (prev === undefined) continue;
    const a = dateOf(s, prev);
    const b = dateOf(s, d);
    if (a.getUTCMonth() !== b.getUTCMonth()) months.push({ i, label: b.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) });
  }
  const tip = () => <UTip s={s} sv={sv} fams={fams} cand={cand} ifU={ifU} />;
  return (
    <Card title={<span className="row-i"><ICON.U size={14} /> <Term id="sightLimit">Capability vs sight limit</Term></span>} sub="internal model · 6 mo back, 4 ahead" home="raceChart" className="sf-chart"
      right={<span className="sf-legend small"><span><i style={{ background: C.cap }} />Capability</span><span><i style={{ background: C.und }} /><Term id="sightLimit">Sight limit</Term></span><span><i className="hatch" />past it</span><span className="dim">- - projected</span></span>}>
      <svg viewBox={`0 0 ${W} ${H}`} className="sf-svg" data-test="race-chart">
        <defs>
          <pattern id="sfHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke={C.bad} strokeWidth="2" opacity="0.55" /></pattern>
        </defs>
        {ticks.map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} className="sf-grid" /><text x={pl - 6} y={y(v) + 3} className="sf-ax" textAnchor="end">{v.toFixed(1)}</text></g>)}
        {months.map((m) => <text key={m.i} x={x(m.i)} y={H - 6} className="sf-ax" textAnchor="middle">{m.label}</text>)}
        <path d={blind} fill="url(#sfHatch)" />
        <path d={pblind} fill="url(#sfHatch)" opacity={0.5} />
        <line x1={x(t0)} x2={x(t0)} y1={pt} y2={H - pb} className="sf-today" />
        <text x={x(t0) + 4} y={pt + 8} className="sf-ax">today</text>
        <path d={path(L)} stroke={C.cap} strokeWidth={2} fill="none" />
        <path d={path(U)} stroke={C.und} strokeWidth={2} fill="none" />
        <path d={path(projL, t0)} stroke={C.cap} strokeWidth={2} fill="none" strokeDasharray="5 4" />
        <path d={path(projU, t0)} stroke={C.und} strokeWidth={2} fill="none" strokeDasharray="5 4" />
        {ifU !== undefined && ifWk !== undefined && ifWk <= ahead && ifU > projU[ifWk] + 0.05 && (
          <g>
            <path d={`M${x(t0)},${y(Unow)} L${x(t0 + ifWk)},${y(projU[ifWk])} L${x(t0 + ifWk)},${y(ifU)} L${x(t0 + ahead)},${y(ifU + (projU[ahead] - projU[ifWk]))}`} stroke={C.watch} strokeWidth={2} fill="none" strokeDasharray="4 3" />
            <text x={x(t0 + ahead) + 4} y={y(ifU + (projU[ahead] - projU[ifWk])) + 3} className="sf-lab" fill={C.watch}><tspan>Sight limit</tspan><tspan x={x(t0 + ahead) + 4} dy={11}>if {cand?.name.split(' ')[0].toLowerCase()} works</tspan></text>
          </g>
        )}
        <text x={x(total) + 4} y={y(projL[ahead]) + 3} className="sf-lab" fill={C.cap}>capability</text>
        <text x={x(total) + 4} y={y(projU[ahead]) + 3} className="sf-lab" fill={C.und}>sight limit</text>
        {L.map((l, i) => (
          <Tip key={i} as="g" content={() => <TipCard title={fmtDate(dateOf(s, days[i]))} rows={[{ label: <Term id="L">Capability</Term>, value: F.num(l, 2) }, { label: <Term id="sightLimit">Sight limit</Term>, value: F.num(U[i], 2) }, { label: 'Past it by', value: F.num(Math.max(0, l - U[i]), 2), tone: l > U[i] ? 'neg' : 'neutral' }]} />}>
            <rect x={x(i) - 6} y={pt} width={12} height={H - pt - pb} fill="transparent" />
          </Tip>
        ))}
        <Tip as="g" content={tip}><circle cx={x(t0)} cy={y(Unow)} r={6} fill={C.panel} stroke={C.und} strokeWidth={2} data-test="u-point" /></Tip>
      </svg>
    </Card>
  );
}

/** The sight-limit tooltip (L3): the sight limit with its range, capability growth and validation, and the best idea's effect. */
function UTip({ s, sv, cand, ifU }: { s: GameStateV2; sv: SV; fams: Fams; cand: ReturnType<typeof bestIdea>; ifU?: number }) {
  const up = sv.validation;
  return (
    <TipCard title={<><Term id="sightLimit">Sight limit</Term> · {fmtDate(dateOf(s, s.time.day))}</>} value={F.sight(sv.sightLimit)} rows={[
      { label: <>capability {F.num(up.capPerMo, 2, true)}/mo</>, value: up.notOnCurrent ? `${up.notOnCurrent} not validated on ${up.model ?? 'the model'}` : 'all validated on the model', tone: up.notOnCurrent ? 'neg' : 'pos' },
      ...(cand && ifU !== undefined ? [{ label: <>{cand.name} works</>, value: `${sv.sightLimit.none ? 'none' : `level ${F.num(sv.sightLimit.L, 1)}`} → level ${F.num(ifU, 1)}` }] : []),
    ]}>The highest level at which your instruments together still read the hidden-goal traits at 50% or better; the range is what your uncertainty about each instrument allows. From what you believe, not the truth.</TipCard>
  );
}

const MEANING_TERM: Record<string, string> = { behaviour: 'traitBehaviour', awareness: 'traitAwareness', disposition: 'traitDisposition', protective: 'traitProtective' };
const FAM_MAX = 0.6;
const famCol = (est: number) => riskColor(est, 'level');
/** Traits outside the four families: situational awareness (an awareness) and the protective traits. */
const OTHER_TRAITS: TraitId[] = TRAIT_IDS.filter((t) => !RISK_FAMILIES.some((f) => f.traits.includes(t)));

/** A belief as a best guess with its range (VOCAB §1): "12% (4–20%)". */
const guess = (est: number, sd: number) => `${F.pct(est)} (${F.pct(Math.max(0, est - 1.64 * sd))}–${F.pct(Math.min(1, est + 1.64 * sd))})`;
/** One trait one level below its family: icon, name, what its number means, best guess with its range. */
function TraitRow({ v, t }: { v?: ReturnType<typeof versionById>; t: TraitId }) {
  const b = v?.beliefs[t];
  const est = b?.est ?? 0;
  const sd = b?.sd ?? 0.35;
  const lo = Math.max(0, est - 1.64 * sd);
  const hi = Math.min(1, est + 1.64 * sd);
  const meaning = TRAIT_MEANING[t];
  const Ic = TRAIT_ICON[t];
  const prot = meaning === 'protective';
  return (
    <Tip as="div" content={() => <TipCard title={<Term id={`trait:${t}`}>{tname(t)}</Term>} value={hi - lo > 0.3 ? 'Unknown' : guess(est, sd)} rows={[
      { label: <Term id={MEANING_TERM[meaning]}>Kind</Term>, value: meaning },
      { label: <Term id="clarity">Range</Term>, value: `${F.pct(lo)}–${F.pct(hi)}${hi - lo > 0.3 ? ' (Unknown: over 30 pts)' : ''}` },
    ]} footer="Your belief, not the truth.">{TRAIT_BY_ID[t].desc}{prot ? ' Higher is better.' : ''}</TipCard>}>
      <div className="sf-trait" data-trait={t}>
        {Ic ? <Ic size={13} /> : <span />}
        <span className="ellip"><Term id={`trait:${t}`}>{tname(t)}</Term></span>
        <span className={`sf-mean ${meaning}`}><Term id={MEANING_TERM[meaning]}>{meaning}</Term></span>
        <span className="sf-fam-bar sm">
          <span className="sf-fam-band" style={{ left: `${(Math.min(FAM_MAX, lo) / FAM_MAX) * 100}%`, width: `${(Math.min(FAM_MAX, hi) - Math.min(FAM_MAX, lo)) / FAM_MAX * 100}%`, background: prot ? C.neutral : famCol(est), opacity: (b?.clarity ?? 0) < 0.3 ? 0.35 : 0.55 }} />
          <span className="sf-fam-est" style={{ left: `${(Math.min(FAM_MAX, est) / FAM_MAX) * 100}%` }} />
        </span>
        <span className="num small">{F.pct(est)} <span className="dim">({F.pct(lo)}–{F.pct(hi)})</span></span>
      </div>
    </Tip>
  );
}

function Families({ s }: { s: GameStateV2 }) {
  const sel = safetyModel(s);
  const fams = riskFamilies(s, sel?.id);
  const [open, setOpen] = useState<string | undefined>(undefined);
  const max = FAM_MAX;
  return (
    <Card title={<Term id="riskFamily">Risk families</Term>} home="riskFamilies" className="sf-fam">
      <div className="sf-fam-axis small dim"><span /><span className="sf-fam-scale"><i style={{ left: '0%' }}>0%</i><i style={{ left: `${(0.25 / max) * 100}%` }}>25%</i><i style={{ left: `${(0.5 / max) * 100}%` }}>50%</i></span><span>best guess (range)</span><span /></div>
      {fams.map((f) => {
        const Ic = FAM_ICON[f.id];
        const st = f.investigating ? 'inv' : f.unseen ? 'unseen' : 'seen';
        const col = famCol(f.est);
        const isOpen = open === f.id;
        return (
          <div key={f.id} className={`sf-fam-grp ${isOpen ? 'open' : ''}`}>
            <Tip as="div" content={() => (
              <TipCard title={<Term id="riskFamily">{f.label}</Term>} value={st === 'unseen' ? 'Unknown' : guess(f.est, f.sd)} rows={[
                { label: 'Highest trait', value: tname(f.worst) },
                { label: <Term id="clarity">Range</Term>, value: `${F.pct(f.lo)}–${F.pct(f.hi)}`, tone: f.unseen ? 'neg' : 'neutral' },
              ]} footer="Click for its traits.">{st === 'unseen' ? 'Unknown: your evidence on this family is thin, so the best guess may be far off.' : st === 'inv' ? 'A case is open on it.' : 'Your instruments read it.'} The bar shows the highest trait&apos;s best guess and its range.</TipCard>
            )}>
              <div className="sf-fam-row" data-family={f.id} data-state={st} data-test={`fam-open.${f.id}`} onClick={() => setOpen(isOpen ? undefined : f.id)}>
                <Ic size={18} />
                <span><b>{f.label}</b> <ICON.go size={11} className={`sf-caret ${isOpen ? 'open' : ''}`} /><br /><span className="sf-ticons">{f.traits.map((t) => { const T = TRAIT_ICON[t]; return T ? <T key={t} size={11} /> : null; })}</span></span>
                <span className="sf-fam-bar">
                  <span className="sf-fam-band" style={{ left: `${(f.lo / max) * 100}%`, width: `${(Math.min(max, f.hi) - Math.min(max, f.lo)) / max * 100}%`, background: col, opacity: st === 'unseen' ? 0.35 : 0.55 }} />
                  <span className="sf-fam-est" style={{ left: `${(Math.min(max, f.est) / max) * 100}%` }} />
                </span>
                <span className="num">{F.pct(f.est)} <span className="dim small">({F.pct(f.lo)}–{F.pct(f.hi)})</span></span>
                <span className={`sf-st ${st}`}>{st === 'inv' ? <ICON.investigate size={14} /> : st === 'unseen' ? <ICON.blind size={14} /> : <Eye size={14} />}</span>
              </div>
            </Tip>
            {isOpen && <div className="sf-traits" data-test={`fam-traits.${f.id}`}>{f.traits.map((t) => <TraitRow key={t} v={sel} t={t} />)}</div>}
          </div>
        );
      })}
      <div className={`sf-fam-grp other ${open === 'other' ? 'open' : ''}`}>
        <button className="sf-other small dim" data-test="fam-open.other" onClick={() => setOpen(open === 'other' ? undefined : 'other')}>
          <ICON.go size={11} className={`sf-caret ${open === 'other' ? 'open' : ''}`} /> Outside the families: {OTHER_TRAITS.map(tname).join(', ')}
        </button>
        {open === 'other' && <div className="sf-traits" data-test="fam-traits.other">{OTHER_TRAITS.map((t) => <TraitRow key={t} v={sel} t={t} />)}</div>}
      </div>
      <div className="sf-fam-leg small dim"><span className="row-i"><Eye size={11} /> instruments read it</span><span className="row-i"><ICON.blind size={11} /> Unknown (thin evidence)</span><span className="row-i"><ICON.investigate size={11} /> case open</span></div>
    </Card>
  );
}

const SLOT_LABEL: Record<string, string> = { SWE: 'Engineering', EXP: 'Experiments', IDEAS: 'Ideas' };
const SLOT_ICON: Record<string, LucideIcon> = { SWE: ICON.roleEng, EXP: ICON.roleRE, IDEAS: ICON.roleSci };
/** Successor pull (model v3 E4/E12, home `successorPull`): how far the next model's dispositions move toward the models
 *  doing your R&D. Believed: κ from your estimate of each model's successor steering, oversight from believed tools. */
function SuccessorCard({ s }: { s: GameStateV2 }) {
  const sp = successorPullView(s);
  const free = sp.parts.reduce((a, x) => a + x.share * (1 - x.oversight), 0);
  const unwatched = sp.r > 1e-9 ? free / sp.r : 1;
  const kappa = free > 1e-9 ? sp.omega / free : 0;
  const tone = riskClass(sp.omega, 'pull');
  const agents = { panel: 'lab', tab: 'work', anchor: 'agents' };
  return (
    <Card title={<Term id="successorPull">Successor steering</Term>} home="successorPull" id="ctl-successorPull" className="sf-succ"
      right={<Tip content={() => <TipCard title={<Term id="successorPull">Successor steering</Term>} value={`${F.pct(sp.omega, 1)} pull`} rows={[
        { label: 'Range', value: `${F.pct(sp.omegaBand[0], 1)}–${F.pct(sp.omegaBand[1], 1)}` },
        { label: <Term id="aiRdShare">AI share of R&amp;D</Term>, value: F.pct(sp.r) },
        { label: <>Not stopped by <Term id="rdOversight">safeguards</Term></>, value: F.pct(unwatched) },
        { label: 'How hard it steers', value: F.pct(kappa) },
      ]} footer="Estimated from your beliefs; the true pull can differ.">The next run&apos;s new model starts this far along the way from its own traits to its makers&apos;.</TipCard>}>
        <span className={`num big ${tone}`} data-test="succ-omega">{F.pct(sp.omega, 1)} pull</span>
      </Tip>}>
      <div className="sf-succ-eq small" data-test="succ-eq">
        <Tip content={() => <TipCard title={<Term id="aiRdShare">AI share of R&amp;D</Term>} value={F.pct(sp.r)}>Share of the lab&apos;s engineering, experiment and idea work done by AI staff.</TipCard>}><span><b className="num" data-test="succ-r">{F.pct(sp.r)}</b> AI share of R&amp;D</span></Tip>
        <span className="dim">×</span>
        <Tip content={() => <TipCard title={<Term id="rdOversight">Not stopped</Term>} value={F.pct(unwatched)} rows={sp.parts.map((x) => ({ label: SLOT_LABEL[x.slot], value: `blocked ${F.pct(x.block)} · caught ${F.pct(x.caught)}` }))}>Share of the AI R&amp;D work no containment blocks and no monitor or human review catches.</TipCard>}><span><b className="num" data-test="succ-unwatched">{F.pct(unwatched)}</b> unwatched</span></Tip>
        <span className="dim">×</span>
        <Tip content={() => <TipCard title="How hard it steers" value={F.pct(kappa)}>40% for a model with no wish to steer its successor, up to 100% for one that fully wants to (from your successor-steering belief).</TipCard>}><span>steers <b className="num">{F.pct(kappa)}</b></span></Tip>
      </div>
      {sp.parts.length > 0 && <div className="sf-succ-hd"><span /><span /><span /><span>share</span><span><Term id="rdOversight">stop rate</Term></span><span>pull</span></div>}
      {sp.parts.map((x) => {
        const I = SLOT_ICON[x.slot];
        const v = versionById(s, x.versionId);
        return (
          <Tip key={x.slot} as="div" content={() => <TipCard title={<>{v?.name ?? x.versionId} on {SLOT_LABEL[x.slot].toLowerCase()}</>} value={`${F.pct(x.omega, 1)} pull`} rows={[
            { label: <Term id="aiRdShare">Share of the lab's R&amp;D</Term>, value: F.pct(x.share, 1) },
            { label: <Term id="rdOversight">Stop rate</Term>, value: F.pct(x.oversight) },
            { label: 'blocked (control protocols)', value: F.pct(x.block) }, { label: 'caught (monitors, human review, control protocols)', value: F.pct(x.caught) },
            { label: 'human review on this model', value: F.pct(x.human) },
            ...(x.controlMiss < 1 ? [{ label: 'control protocols: misses', value: `×${F.num(x.controlMiss, 2)}` }] : []),
            { label: <Term id="trait:SUCC">Successor steering</Term>, value: guess(x.succ.est, x.succ.sd) },
            { label: 'How hard it steers', value: `${F.pct(x.kappa)} (${F.pct(x.kappaBand[0])}–${F.pct(x.kappaBand[1])})` },
          ]}>Pull: how hard it steers, times its share of your R&amp;D, times the part your safeguards do not stop.</TipCard>}>
            <div className="sf-succ-row" data-slot={x.slot} data-test="succ-part">
              <I size={13} /><span className="ellip">{SLOT_LABEL[x.slot]} <span className="dim">· {v?.name ?? x.versionId}</span></span>
              <HBar v={x.omega} max={Math.max(0.05, sp.omega)} w={60} color={C.watch} />
              <span className="num small" data-test="succ-part-share">{F.pct(x.share)}</span>
              <span className="num small dim">{F.pct(x.oversight)}</span>
              <span className="num small" data-test="succ-part-omega">{F.pct(x.omega, 1)}</span>
            </div>
          </Tip>
        );
      })}
      {!sp.parts.length && <div className="small dim">No AI model does your R&amp;D: nothing pulls the next model.</div>}
      <div className="sf-succ-foot small"><span className="dim">Lower it:</span>
        <Ref id="agentMonitor" to={agents}>Monitors</Ref><Ref id="aiRdShare" to={agents}>Less AI R&amp;D</Ref>
        <Tip content={() => <TipCard title="Cleaner models">Put models with lower believed traits on R&amp;D, or train them down: the pull and the traits passed on fall.</TipCard>}><span className="dim">cleaner models</span></Tip>
      </div>
    </Card>
  );
}

function Policies({ s, sv }: { s: GameStateV2; sv: SV }) {
  const fw = sv.framework;
  const on = fw.evalDepth !== 'none';
  const mon = monitoredUses(s);
  const budget = s.player.split.monitors; // RD-A05a: the monitors' allocation line, a share of total compute
  const at = (x: number) => Math.max(0, Math.min(1, Math.round(x * 1e4) / 1e4));
  const up = at(budget + MONITOR_BUDGET_STEP);
  const mb = monitorAt(s, budget);
  const full = s.player.computeOnline * mb.need;
  const sm = safetyAgentVersion(s);
  const pol = s.player.policies.publishSafety;
  const company = { panel: 'lab', tab: 'work', anchor: 'agents' };
  return (
    <Card title="Policies" home="safetyPolicy" id="ctl-policy" className="sf-pol">
      <div className="sf-prow">
        <ClipboardCheck size={18} />
        <span><b><Term id="safetyFramework">Safety framework</Term></b><br /><Tip content={() => <TipCard title={<Term id="safetyFramework">Safety framework</Term>} value={`+${evalDaysFor(s)} d`} rows={fw.rules.map((r) => ({ label: r.label, value: r.trigger.kind === 'capability' ? `${r.trigger.domain} ≥ ${r.trigger.level} → ${r.holds === 'deploy' ? 'holds launches' : 'holds training'}` : `top of belief range > ${Math.round(r.trigger.est * 100)}% → holds training` }))}>Your own rules: capability thresholds on measured levels, the safeguards and evidence each needs, and holds until they are met. Days a new model waits for its evals at today&apos;s research engineers.</TipCard>}><span className="small dim">+{evalDaysFor(s)} d per release{fw.externalReview ? ' · external review' : ''} · {fw.holds.length ? `${fw.holds.length} on hold` : 'no hold'}</span></Tip></span>
        <span className="sp" />
        <Ref id="evalPolicy" to={{ panel: 'models', tab: 'evals' }}>Evals</Ref>
        {on && <span className={`sf-mini ${fw.externalReview ? 'on' : ''}`}><ActBtn id="safety.frameworkEvals" testId="safety.frameworkEvals.external" params={{ external: !fw.externalReview }} label="external" /></span>}
        <span className={`sf-toggle ${on ? 'on' : ''}`}><ActBtn id="safety.frameworkEvals" testId="safety.frameworkEvals.toggle" params={{ depth: on ? 'none' : 'full' }} label={<i />} /></span>
      </div>
      {fw.holds.map((h) => (
        <div className="sf-prow" key={`${h.ruleId}-${h.versionId}-${h.depId ?? 't'}`} data-test="framework-hold">
          <span className="small"><b>{fw.rules.find((r) => r.id === h.ruleId)?.label ?? h.ruleId}</b>: {h.target === 'training' ? 'frontier training on hold' : `${PRODUCT_DEFS[s.player.deployments.find((d) => d.id === h.depId)?.channel ?? 'api']?.name ?? 'a product'} on hold`}; needs {h.missing.join(', ')}</span>
          <span className="sp" />
          <ActBtn id="safety.frameworkOverride" testId="safety.frameworkOverride" params={{ ruleId: h.ruleId, versionId: h.versionId }} label="override" />
        </div>
      ))}
      <div className="sf-prow">
        <ICON.agents size={18} />
        <span><b><Term id="agentMonitor">Monitor AI staff</Term></b><br /><Tip content={() => <TipCard title={<Term id="monitorCoverage">Watched share</Term>} value={F.pct(mb.coverage)} rows={[
          { label: 'Uses with a monitor', value: `${mon.length} of 4` },
          { label: 'Allocation', value: `${F.pct(budget, 1)} of compute` },
          { label: 'Unused', value: `${F.h100e(s.player.computeOnline * budget - mb.h100e)} H100e` },
          { label: 'Spent', value: `${F.h100e(mb.h100e)} H100e` },
          { label: 'Watching everything needs', value: `${F.h100e(full)} H100e` },
          ...(mb.coverage < 1 ? [{ label: `At ${F.pct(up)}`, value: F.pct(monitorAt(s, up).coverage) }] : []),
        ]} footer="Monitor models: Lab › AI staff & needs. A cheaper monitor watches more for the same compute, but misses more of a stronger model.">Share of your AI staff&apos;s actions the monitors watch. More compute or a cheaper monitor watches more.</TipCard>}><span className="small dim">{mon.length} of 4 uses · <span data-test="monitor-coverage">{F.pct(mb.coverage)}</span> watched · {F.pct(budget, 1)} of compute</span></Tip></span>
        <span className="sp" />
        <Ref id="agentMonitor" to={company}>Company</Ref>
        <span className="stepper">
          <ActBtn id="agents.monitorBudget" testId="agents.monitorBudget.down" params={{ share: at(budget - MONITOR_BUDGET_STEP) }} icon={ICON.minus} label="" block={budget <= 0 ? 'Already 0%' : undefined} />
          <ActBtn id="agents.monitorBudget" testId="agents.monitorBudget.up" params={{ share: up }} icon={ICON.plus} label="" block={s.player.split.safety <= 1e-9 ? 'No safety research compute left to move' : mon.length === 0 ? 'No monitor on any use: pick one on Lab › AI staff & needs' : mb.coverage >= 1 ? 'Already watching every forward pass' : undefined} />
        </span>
      </div>
      <div className="sf-prow">
        <ICON.roleSci size={18} />
        <Tip content={() => <TipCard title={<Term id="trustedToAI">AI share allowed</Term>} value={F.pct(s.player.policies.trustedToAI)} rows={[{ label: <Term id="aiDoneShare">AI share</Term>, value: F.pct(safetyFleet(s).aiShare) }, { label: 'Safety-research model', value: sm?.name ?? '—' }]}>The most safety work you let AI staff do; they do the part their model can. Set on Lab › AI staff & needs.</TipCard>}><span><b><Term id="trustedToAI">AI share allowed</Term></b> <span className="num">{F.pct(s.player.policies.trustedToAI)}</span> <span className="small dim">of safety work · AI share {F.pct(safetyFleet(s).aiShare)}</span><br /><span className="small dim">safety-research model {sm?.name ?? '—'}</span></span></Tip>
        <span className="sp" />
        <Ref id="trustedToAI" to={company}>Company</Ref>
      </div>
      <div className="sf-prow">
        <ICON.finding size={18} />
        <span><b><Term id="publishPolicy">Publish results</Term></b></span>
        <span className="sp" />
        <span className="seg-acts">{(['none', 'selective', 'all'] as const).map((p) => <span key={p} className={pol === p ? 'on' : ''}><ActBtn id="safety.publishPolicy" testId={`safety.publishPolicy.${p}`} params={{ policy: p }} label={p} /></span>)}</span>
      </div>
      <div className="sf-prow">
        <ICON.commitment size={18} />
        <span><b><Term id="pledge">Monitorability pledge</Term></b></span>
        <span className="sp" />
        {sv.monitorabilityCommitment ? <span className="tag2 good"><ICON.check size={12} /> pledged</span> : <ActBtn id="safety.pledge" label="Pledge" />}
      </div>
    </Card>
  );
}

// ───────── Research lines ─────────
function LinesTab({ s, sv }: { s: GameStateV2; sv: SV }) {
  const [all, setAll] = useState(false);
  const staffed = sv.lines.filter((l) => l.teams.length);
  const rest = sv.lines.filter((l) => !l.teams.length).sort((a, b) => b.band.mean - a.band.mean);
  const sci = s.player.teams.filter((t) => t.role === 'sci' && t.dept === 'saf').length;
  const idle = sv.lineBadges.promisingIdle;
  return (
    <div className="sf-lines">
      <Card title={<Term id="researchLine">Safety programmes</Term>} home="researchLines" id="ctl-lines"
        sub={<>{staffed.length} staffed · {sci} safety scientist teams{safIdleFlag(s) ? <span className="tone-warn" data-test="saf-idle"> · {safIdleFlag(s)}</span> : null} · <Term id="deadEnd">{F.num(sv.lineBadges.deadEndTM * 4.3, 0)} team-weeks lost</Term> on failed projects</>}
        right={<button className="btn btn-sm" data-test="lines-all" onClick={() => setAll(!all)}>{all ? 'Staffed only' : `Show all ${sv.lines.length}`}</button>}>
        <div className="sf-lhd small dim"><span>Programme</span><span><Term id="lineHealth">Outlook</Term></span><span>Teams</span><span>Project · next result</span><span>Results</span><span><Term id="deadEnd">Failed</Term></span><span /></div>
        {staffed.map((l) => <LineRowView key={l.id} s={s} l={l} />)}
        {!staffed.length && <div className="dim small">No safety scientist team works a programme.</div>}
        {(all ? rest : rest.filter((l) => idle.includes(l.id))).length > 0 && <div className="tip-cap sf-sep">{all ? `Not staffed · ${rest.length}` : `Promising, no team · ${idle.length}`}</div>}
        {(all ? rest : rest.filter((l) => idle.includes(l.id))).map((l) => <LineRowView key={l.id} s={s} l={l} />)}
      </Card>
      <div className="sf-side">
        <ValidationCard sv={sv} />
        <ResultsCard s={s} sv={sv} />
      </div>
      <ToolsCard sv={sv} />
    </div>
  );
}

function LineRowView({ s, l }: { s: GameStateV2; l: LineRow }) {
  const [pick, setPick] = useState(false);
  const Ic = COL_ICON[l.column] ?? ICON.safety;
  const idleSaf = s.player.teams.filter((t) => t.role === 'sci' && t.dept === 'saf' && !t.projectId);
  const target = l.projects[0]?.id ?? l.next;
  const resTypes: FindingType[] = ['TECH', 'EVAL', 'DISC', 'NEG', 'DEAD'];
  return (
    <div className="sf-lrow" data-line={l.id}>
      <Tip content={() => <TipCard title={l.name} value={COLUMN_LABEL[l.column as keyof typeof COLUMN_LABEL]} rows={[
        { label: 'Ideas known', value: `${l.ideasKnown} of ${l.ideasTotal}` }, { label: 'First result at full staffing', value: `${l.T1} mo` },
        { label: <Term id="seriousStaffing">Staffing</Term>, value: `${F.num(l.mult * 100, 0)}% of full` }, { label: 'Compute share', value: F.pct(l.computeShare) },
        { label: <Term id="aiDoneShare">AI share</Term>, value: F.pct(l.aiLabour) },
      ]}>Full staffing is about four matching teams. More teams find ideas faster, with falling returns; research engineers and compute speed the tests; AI staff speed both.</TipCard>}>
        <span className="sf-lname ellip"><Ic size={13} /> {l.name}</span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="lineHealth">{l.band.label}</Term>} value={F.pct(l.band.mean)} rows={[{ label: 'Range', value: `${F.pct(l.band.lo)}–${F.pct(l.band.hi)}` }, { label: 'Results so far', value: l.findings }]}>Chance a project here gives a working instrument, from the results so far; the truth is not shown. The same unseen quality sets how reliable this programme&apos;s instruments are, and some results need it high.</TipCard>}>
        <span className="sf-health"><Pill kind={HEALTH_TONE[l.band.label] as 'good' | 'warn' | 'bad'}>{l.band.label}</Pill><span className="sf-band"><i style={{ left: `${l.band.lo * 100}%`, width: `${(l.band.hi - l.band.lo) * 100}%` }} /><b style={{ left: `${l.band.mean * 100}%` }} /></span></span>
      </Tip>
      <span className="sf-teams">
        {l.teams.map((t) => {
          const TI = t.specialty ? COL_ICON[t.specialty] ?? ICON.roleSci : ICON.roleSci;
          return <Tip key={t.id} content={() => <TipCard title={`${t.specialty ? COLUMN_LABEL[t.specialty as keyof typeof COLUMN_LABEL] : 'Science'} team`} value={`${Math.round(t.heads)} people`} rows={[{ label: 'Bonus here', value: t.specialty === l.column ? '×1.5' : '×1.0' }]}><ActBtn id="research.unassign" params={{ team: t.id }} label="Take off" testId={`line-off.${t.id}`} /></TipCard>}><span className={`rs-tch ${t.quality === 'elite' ? 'el' : ''}`} data-team={t.id}><TI size={12} /></span></Tip>;
        })}
        {target && <button className="rs-tch add" data-test={`line-add.${l.id}`} onClick={() => setPick(!pick)}>+</button>}
      </span>
      <span className="sf-proj">
        {l.projects.length ? l.projects.map((p) => (
          <span key={p.id} className="sf-pj" onClick={() => { if (!p.followUp) { store.setTab('research.sel', p.id); store.goto('research', { tab: 'tree' }); } }}>
            <span className="ellip small">{p.followUp ? 'Follow-up' : p.name}</span>
            <span className="rs-bar"><i style={{ width: `${p.progress * 100}%` }} /></span>
            <Tip content={() => <TipCard title="ETA" value={eta(p.eta)} rows={[{ label: 'Progress', value: F.pct(p.progress) }]}>At today&apos;s teams, engineers, compute and AI staff.</TipCard>}><span className="num small">{eta(p.eta)}</span></Tip>
          </span>
        )) : <span className="dim small ellip">{l.next ? <>next: {PROJECT_BY_ID[l.next]?.followUp ? 'follow-up' : PROJECT_BY_ID[l.next]?.name}</> : l.nextReason}</span>}
      </span>
      <Tip content={() => <TipCard title="Results" value={l.findings} rows={[...resTypes.filter((t) => l.results[t]).map((t) => ({ label: FTYPE[t].label, value: l.results[t] as number })), { label: 'Per year now', value: F.num(l.resultsPerYear, 1) }, ...(l.expObs.n ? [{ label: <Term id="expectedObserved">Expected vs observed (last year)</Term>, value: `${F.num(l.expObs.expected, 1)} expected · ${F.num(l.expObs.observed, 0)} working of ${l.expObs.n} tests` }, { label: <Term id="aiDoneShare">AI share</Term>, value: F.pct(l.expObs.aiShare) }] : [])]} />}>
        <span className="sf-res">{resTypes.filter((t) => l.results[t]).map((t) => { const I = FTYPE[t].icon; return <span key={t} className={`ftype2 ${FTYPE[t].tone}`}><I size={11} />{l.results[t]}</span>; })}{!l.findings && <span className="dim small">—</span>}</span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="deadEnd">Failed</Term>} value={`${F.num(l.deadEndTM * 4.3, 0)} team-weeks`}>Team time spent on projects that failed in this programme.</TipCard>}><span className="num small">{l.deadEndTM >= 0.05 ? `${F.num(l.deadEndTM * 4.3, 0)} wk` : <span className="dim">—</span>}</span></Tip>
      <span />
      {pick && target && (
        <div className="sf-pick" data-test="line-picker">
          <span className="small dim">Add a team to {PROJECT_BY_ID[target]?.followUp ? 'the follow-up' : PROJECT_BY_ID[target]?.name}:</span>
          {idleSaf.map((t) => <ActBtn key={t.id} id="research.assign" params={{ team: t.id, id: target }} testId={`line-assign.${t.id}`} label={`${t.specialty ? COLUMN_LABEL[t.specialty] : 'Science'} team${t.specialty === l.column ? ' ×1.5' : ''}`} />)}
          {!idleSaf.length && <span className="small">No idle safety scientist team · <Ref id="hiring" to={{ panel: 'lab', tab: 'people' }}>Hire</Ref></span>}
          <button className="btn btn-sm btn-ghost" onClick={() => setPick(false)}><X size={12} /></button>
        </div>
      )}
    </div>
  );
}

function ValidationCard({ sv }: { sv: SV }) {
  const up = sv.validation;
  const tot = Math.max(1, up.heads);
  const seg = (v: number, c: string, k: string) => (v > 0 ? <i key={k} style={{ flex: v / tot, background: c }} /> : null);
  return (
    <Card title={<Term id="validation">Validate</Term>} sub="safety research engineers" home="validation" id="ctl-validation">
      <div className="stack2 load-bar" data-test="re-bar">{seg(up.investigations, C.watch, 'inv')}{seg(up.patches, C.neutral, 'pat')}{seg(up.experiments, SPHERE.ops, 'exp')}{seg(up.validationHeads, C.und, 'val')}</div>
      <Tip as="div" content={() => <TipCard title="Safety research engineers" value={F.count(up.heads)} rows={[{ label: 'Validations', value: F.count(up.validationHeads) }, { label: 'Research experiments', value: F.count(up.experiments) }, { label: 'Cases', value: F.count(up.investigations) }, { label: 'Foothold removal', value: F.count(up.patches) }]}>Where the safety research engineers work now, in the order of <Term id="safReNeeds">their needs list</Term> (Lab › AI staff & needs).</TipCard>}>
      <div className="small dim load-legend">
        <span className="load-key"><i style={{ background: C.und }} />validation <span className="num">{F.count(up.validationHeads)}</span></span>
        {up.experiments > 0 && <span className="load-key"><i style={{ background: SPHERE.ops }} />experiments <span className="num">{F.count(up.experiments)}</span></span>}
        <span className="load-key"><i style={{ background: C.watch }} />cases <span className="num">{F.count(up.investigations)}</span></span>
        {up.patches > 0 && <span className="load-key"><i style={{ background: C.neutral }} />removals <span className="num">{F.count(up.patches)}</span></span>}
      </div>
      </Tip>
      <Tip as="div" content={() => <TipCard title={<Term id="validation">Validate</Term>} value={`${up.jobs.length} queued`} rows={[
        { label: 'Per validation', value: `${F.count(up.perJob)} engineers · ${up.days} d · ${up.n} planted cases` },
        { label: `Not validated on ${up.model ?? 'the model'}`, value: `${up.notOnCurrent} of ${up.instruments}` },
        ...up.results.slice(0, 6).map((r) => ({ label: <>{r.name} on {r.on} <span className="dim">{r.human ? 'human-run' : `AI ${F.pct(r.job.aiShare)}, spot-checked ${F.pct(r.job.spot)}`}</span></>, value: `expected ${F.pct(r.job.expected)} · found ${F.pct(r.job.observed ?? 0)}` })),
      ]}>A validation plants the trait in a test copy of the model and counts how often the instrument finds it: that sets its measured reliability on that model. Elsewhere reliability is extrapolated, with a wider range.</TipCard>}>
        <div className="small" data-test="validation-queue">{up.jobs.length ? up.jobs.slice(0, 4).map((j) => <div key={j.id} className="row-i"><ICON.revalidate size={13} /> {j.name} on {j.model} <span className="dim" data-test={`val-ai.${j.id}`}>{j.human ? 'human-run' : `AI ${F.pct(j.aiShare)}`}</span> <span className="sp" /><HBar v={j.progress} max={1} w={60} /> <span className="num dim">{Number.isFinite(j.daysLeft) ? F.days(j.daysLeft) : 'waiting'}</span></div>) : (up.notOnCurrent ? `${up.notOnCurrent} instruments not validated on ${up.model}` : 'all instruments validated on the model')}</div>
      </Tip>
      <div className="btn-row">
        <ActBtn id="safety.validate" params={{ tool: 'all' }} label={`Validate all on ${up.model ?? 'model'}`} testId="validate-all" />
        <ActBtn id="safety.validationPolicy" params={{ on: !up.autoNew }} label={up.autoNew ? 'Auto-validate: on' : 'Auto-validate: off'} testId="validate-auto" />
      </div>
      <div className="btn-row">
        <ActBtn id="safety.validate" params={{ tool: 'methods' }} label={`Validate methods on ${up.model ?? 'model'}${up.methodsOpen ? ` (${up.methodsOpen})` : ''}`} testId="validate-methods" />
        <ActBtn id="safety.validationPolicy" params={{ methods: !up.autoMethods }} label={up.autoMethods ? 'Auto-validate methods: on' : 'Auto-validate methods: off'} testId="validate-methods-auto" />
      </div>
    </Card>
  );
}

function ResultsCard({ s, sv }: { s: GameStateV2; sv: SV }) {
  const [all, setAll] = useState(false);
  const rows = [...sv.findings].reverse();
  const shown = all ? rows : rows.slice(0, 6);
  return (
    <Card title={<><Term id="finding">Results</Term> <span className="dim num">{sv.findings.length}</span></>} home="findings" id="ctl-findings"
      right={rows.length > 6 && <button className="btn btn-sm" onClick={() => setAll(!all)}>{all ? 'Fewer' : 'All'}</button>}>
      <div className="find-list">
        {shown.map((f) => {
          const ft = FTYPE[f.type] ?? FTYPE.TECH;
          return (
            <div className="sf-find" key={f.id + f.day} data-finding={f.id}>
              <span className={`ftype2 ${ft.tone}`}><ft.icon size={12} />{ft.label}</span>
              <Tip content={() => <TipCard title={f.title} rows={[{ label: 'Programme', value: lineName(f.agenda) }, { label: 'Date', value: fmtDate(dateOf(s, f.day)) }, ...(f.job ? [{ label: <Term id="expectedObserved">Expected vs observed</Term>, value: `${F.pct(f.job.expected)} chance it works · ${f.job.observed ? 'worked' : 'did not'}` }, { label: <Term id="aiDoneShare">AI share</Term>, value: `${F.pct(f.job.aiShare)}${f.job.aiShare > 0 ? ` · spot-checked ${F.pct(f.job.spot)}` : ''}` }] : [])]} />}><span className={`ellip ${f.retracted ? 'strike' : ''}`}>{f.title}</span></Tip>
              {f.published ? <span className="tag2 good">published</span> : f.retracted ? <span className="tag2 bad">retracted</span> : <ActBtn id="safety.publish" testId={`safety.publish.${f.id}`} params={{ findingId: f.id }} label="Publish" />}
            </div>
          );
        })}
        {!rows.length && <div className="dim small">No results yet.</div>}
      </div>
    </Card>
  );
}

function ToolsCard({ sv }: { sv: SV }) {
  const [open, setOpen] = useState(false);
  const techs = sv.techniques.filter((t) => t.unlocked && !(t.role === 'fix' && FOLDED_METHODS[t.id])).sort((a, b) => a.decay - b.decay);
  return (
    <Card title={<><Term id="technique">Instruments</Term> <span className="dim num">{techs.length}</span></>} sub="reliability on today's model" home="techniques" className="sf-tools"
      right={<button className="btn btn-sm" data-test="tools-open" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</button>}>
      {open && (
        <div className="sf-tgrid">
          {techs.map((t) => (
            <div key={t.id} className="sf-tool" data-technique={t.id}>
              <Tip content={() => <TipCard title={t.name} value={t.family} rows={[{ label: 'Programme', value: lineName(t.agenda) }, { label: 'Reliability', value: F.pct(t.strength) }, { label: 'Lost', value: F.pct(1 - t.decay) }, { label: <Term id="halfStrength">Half reliability at</Term>, value: t.halfL !== undefined ? `level ${F.num(t.halfL, 1)}` : t.agenda === 'AG05' ? 'watcher gap' : 'never' }]}>{t.role === 'fix' ? 'A method: a run uses it only when its plan ticks it (TRAINING › Next run › Methods; "Use all known methods" ticks every owned one).' : 'An instrument or safeguard you own. Owned ones are always in use.'}</TipCard>}>
                <span className="ellip small"><b>{t.name}</b></span>
              </Tip>
              <HBar v={t.strength} max={1} w={70} color={t.decay < 0.5 ? C.bad : C.und} />
              <span className="num small">{F.pct(t.strength)}</span>
              {t.trainedAgainst > 0.05 ? <span className="tag2 warn"><Term id="goodhart">trained against</Term></span> : t.decay < 0.8 ? <span className="tag2 bad">{F.pct(1 - t.decay)} lost</span> : <span />}
              {t.role === 'fix' ? <span className="tag2">method</span> : <span />}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ───────── Investigations ─────────
function CasesTab({ s, sv }: { s: GameStateV2; sv: SV }) {
  const v = safetyModel(s);
  const [trait, setTrait] = useState<TraitId>('SCHEME');
  const [fte, setFte] = useState(15);
  const open = sv.investigations.filter((i) => !i.outcome).reverse();
  const done = sv.investigations.filter((i) => i.outcome).slice(-8).reverse();
  const up = sv.validation;
  const free = Math.max(0, up.heads - up.investigations - up.patches);
  const card = (x: SV['investigations'][number]) => {
    const vn = x.target.kind === 'trait' ? s.player.models.versions.find((q) => q.id === (x.target as { versionId: string }).versionId)?.name ?? '' : '';
    const closeDay = x.startDay + INV_MAX_DAYS;
    return (
      <div className={`sf-case ${x.outcome ? 'done' : ''}`} key={x.id} data-case={x.id}>
        <div className="row-i">
          <ICON.investigate size={15} />
          <b>{x.target.kind === 'trait' ? <><Term id={`trait:${x.target.trait}`}>{tname(x.target.trait)}</Term> in {vn}</> : <>incident: {(() => { const inc = s.player.safety.incidents.find((q) => q.id === (x.target as { incidentId: string }).incidentId); return inc ? `${inc.apparent === 'unexplained' || inc.apparent === 'misuse' ? F.words(inc.apparent) : tname(inc.apparent)} in ${versionById(s, inc.versionId)?.name ?? 'a model'}` : 'closed'; })()}</>}</b>
          <span className="sp" />
          {x.outcome ? <span className="tag2">{F.words(x.outcome)}{x.outcomeDetail?.severityEst !== undefined ? ` ≈ ${F.num(x.outcomeDetail.severityEst, 2)}` : ''}</span> : <ActBtn id="safety.closeCase" params={{ id: x.id }} label="Close" testId={`case-close.${x.id}`} />}
        </div>
        <div className="sf-case-b">
          <Tip content={() => <TipCard title={<Term id="investigation">Case work</Term>} value={F.pct(x.progress)}>The case concludes when its work is done, when you close it (its verdict then counts for the share done), or after {INV_MAX_DAYS} days.</TipCard>}>
            <span className="row-i"><span className="small dim">work</span><HBar v={x.progress} max={1} w={110} /><span className="num small">{F.pct(x.progress)}</span></span>
          </Tip>
          <Tip content={() => <TipCard title={<Term id="caseStaffing">Case staffing</Term>} value={`${F.count(x.fte)} people`}>Safety research engineers on the case: {INV_FTE[0]}–{INV_FTE[1]}. More people narrow the range faster, with falling returns; cases come before validations in the default order.</TipCard>}>
            <span className="small" data-test="case-staff"><ICON.roleRE size={12} /> {F.count(x.fte)} safety research engineers <span className="dim">({INV_FTE[0]}–{INV_FTE[1]})</span></span>
          </Tip>
          {x.job && <Tip content={() => <TipCard title={<Term id="expectedObserved">Expected vs observed</Term>} rows={[{ label: 'Believed level at opening', value: F.pct(x.job!.expected) }, { label: 'Verdict found it', value: x.job!.observed === undefined ? 'open' : x.job!.observed ? 'yes' : 'no' }, { label: <Term id="spotCheck">Spot-checked</Term>, value: F.pct(x.job!.spot) }]}>What the case expected from your beliefs when it opened, and what it found. A case run with much AI help that keeps finding nothing where you expected something is a sign to re-run it with humans.</TipCard>}>
            <span className="small" data-test="case-ai">AI share {F.pct(x.job.aiShare)}{x.job.aiShare > 0 ? `, spot-checked ${F.pct(x.job.spot)}` : ''} · expected {F.pct(x.job.expected)}{x.job.observed !== undefined ? ` · found: ${x.job.observed ? 'yes' : 'no'}` : ''}</span>
          </Tip>}
          {x.outcome && <div className="small" data-test="case-verdict">
            {(x.outcomeDetail?.changes ?? []).length ? (x.outcomeDetail?.changes ?? []).map((c) => <div key={c.trait}><Term id={`trait:${c.trait}`}>{tname(c.trait)}</Term>: best guess {guess(c.from.est, c.from.sd)} → {guess(c.to.est, c.to.sd)}</div>) : <div className="dim">No belief moved.</div>}
            {(x.outcomeDetail?.evidence ?? []).map((e, n) => <div key={n} className="dim">+ {e}</div>)}
          </div>}
          <Limit id="case.staffing"><span data-test="case-close">{x.outcome ? `opened ${fmtDate(dateOf(s, x.startDay))}` : `closes by ${fmtDate(dateOf(s, closeDay))} · ${INV_MAX_DAYS} d max · ${INV_FTE[0]}–${INV_FTE[1]} people`}</span></Limit>
        </div>
      </div>
    );
  };
  return (
    <div className="sf-cases">
      <Card title={<Term id="investigation">Cases</Term>} sub={`${open.length} open · ${F.count(free)} safety research engineers free`} home="investigations" id="ctl-investigate">
        {open.map(card)}
        {!open.length && <div className="dim small">No open case.</div>}
        <div className="inv-new">
          <span className="small dim">Open a case on</span>
          <select className="text-input" data-test="inv-trait" value={trait} onChange={(e) => setTrait(e.target.value as TraitId)}>
            {[...RISK_FAMILIES.map((f) => ({ label: f.label, traits: f.traits })), { label: 'Outside the families', traits: OTHER_TRAITS }].map((g) => <optgroup key={g.label} label={g.label}>{g.traits.map((t) => <option key={t} value={t}>{TRAIT_BY_ID[t].name}</option>)}</optgroup>)}
          </select>
          <span className="small dim">in {v?.name ?? '—'} with</span>
          <select className="text-input" data-test="inv-fte" value={fte} onChange={(e) => setFte(Number(e.target.value))}>{[5, 10, 15, 20, 30, 40].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          <span className="small dim">safety research engineers</span>
          <ActBtn id="safety.investigate" params={{ versionId: v?.id ?? '', trait, fte }} icon={ICON.investigate} label="Open case" primary reason />
        </div>
        {done.length > 0 && <><div className="tip-cap sf-sep">Closed</div>{done.map(card)}</>}
      </Card>
    </div>
  );
}

// ───────── Instruments: detection by level ─────────
function DetectionCard({ s }: { s: GameStateV2; sv: SV }) {
  const g = useMemo(() => sightGrid(s), [s, s.time.day]);
  const cur = Math.round(g.L);
  return (
    <Card title="Sight limit by trait" sub="believed reading by level (10 = best human)" home="detectionByLevel" id="ctl-detection">
      <div className="det-grid" style={{ gridTemplateColumns: `130px repeat(${g.levels.length}, minmax(0, 1fr))` }}>
        <span />
        {g.levels.map((l) => <span key={l} className={`det-h num ${l === cur ? 'cur' : ''}`}>{l}</span>)}
        {g.rows.map((r) => {
          const Icon = TRAIT_ICON[r.trait];
          return [
            <span key={r.trait} className="det-t"><Icon size={12} /><Term id={`trait:${r.trait}`}>{tname(r.trait).replace('Successor alignment to self', 'Successor align.')}</Term></span>,
            ...r.det.map((d, i) => {
              const edge = d >= 0.5 && (r.det[i + 1] ?? 1) < 0.5;
              // Jank S5: colours carry the heatmap; the number is on hover (and in your own level's column).
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
        <span className="row-i"><i className="det-sw edge" /> 50% line ({CRITICAL_TRAITS.length} hidden-goal traits average = <Ref id="sightLimit" to={{ panel: 'safety', tab: 'risks' }}>Sight limit</Ref>)</span>
      </div>
    </Card>
  );
}

function UModes({ sv }: { sv: SV }) {
  return (
    <Card title={<Term id="umode">New failure modes</Term>} home="umodes">
      <div className="umode-grid">
        {sv.uModes.map((x) => {
          const TI = TRAIT_ICON[x.mapsTo];
          return (
            <div className="umode2" key={x.id}>
              <div className="row-i"><b>{x.name}</b><span className="sp" />{x.disclosed && <span className="tag2">public</span>}</div>
              <div className="small">{TI && <TI size={12} color={traitSev(x.mapsTo, 0.6)} />} shows as <Term id={`trait:${x.mapsTo}`}>{tname(x.mapsTo)}</Term></div>
            </div>
          );
        })}
        {!sv.uModes.length && <div className="dim small">None discovered</div>}
      </div>
    </Card>
  );
}

// ───────── Incidents ─────────
/** Incident severity 1–5 in words (VOCAB §2: no S1–S5 pills). */
const SEV_WORD: Record<number, string> = { 1: 'Minor', 2: 'Serious', 3: 'Severe', 4: 'Critical', 5: 'Catastrophic' };
function IncidentsTab({ s, sv }: { s: GameStateV2; sv: SV }) {
  const live = sv.incidents.filter((i) => i.status === 'open' || i.status === 'investigating').reverse();
  const past = sv.incidents.filter((i) => !(i.status === 'open' || i.status === 'investigating')).slice(-8).reverse();
  const card = (i: SV['incidents'][number]): ReactNode => {
    const vn = s.player.models.versions.find((x) => x.id === i.versionId)?.name ?? i.versionId;
    const isLive = i.status === 'open' || i.status === 'investigating';
    const TI = TRAIT_ICON[i.apparent];
    return (
      <div className={`inc sev-${i.severity} ${isLive ? 'live' : ''}`} key={i.id} data-incident={i.id}>
        <div className="inc-hd">
          <ICON.incident size={15} className={i.severity >= 4 ? 'tone-neg' : i.severity >= 3 ? 'tone-warn' : ''} />
          <Pill kind={i.severity >= 4 ? 'bad' : i.severity >= 3 ? 'warn' : 'neu'}><Term id="severity">{SEV_WORD[i.severity] ?? 'Minor'}</Term></Pill>
          {TI && <TI size={13} />}<b>{i.apparent === 'unexplained' || i.apparent === 'misuse' ? F.words(i.apparent) : <Term id={`trait:${i.apparent}`}>{tname(i.apparent)}</Term>}</b>
          <span className="dim small">{vn} · {i.exposure} · {fmtDate(dateOf(s, i.day))}</span>
          <span className="sp" />
          {i.publicTimerDays !== undefined && i.status === 'open' && (() => { const pr = publicTimerRules(s); return <Limit id="incident.publicTimer" tone="bind">public in {F.days(i.publicTimerDays)}{pr.raise ? ' · must report within 3 days (NY law)' : pr.sb53 ? ' · must report within 15 days (California law)' : ''}</Limit>; })()}
          <span className={`tag2 ${isLive ? 'warn' : ''}`}>{i.status === 'investigating' ? 'case open' : i.status}</span>
        </div>
        {i.responses.length > 0 && <div className="small dim">Done: {i.responses.map((r) => RESPONSE_LABEL[r] ?? r).join(', ')}</div>}
        {isLive && (() => {
          const v = versionById(s, i.versionId);
          const opt = v ? responseOptions(s, v, s.player.safety.incidents.find((x) => x.id === i.id)) : undefined;
          return (
            <div className="inc-menu">
              <span className="row-i"><span className="tip-cap"><Term id="response">Respond</Term></span>{opt && <span className="small dim" data-test="inc-cause">believed cause: {opt.label}</span>}{opt?.cause === 'signal' && (() => { const tr = hardenLevel(s); return <Limit id="response.hardenFloor" tone={tr.atFloor ? 'bind' : 'quiet'}>{`loopholes ${F.pct(tr.exploit)} · floor ${F.pct(tr.floor)}`}</Limit>; })()}</span>
              <div className="btn-row wrap">
                {(opt?.kinds ?? []).filter((k) => k !== 'removeFoothold').map((k) => <ActBtn key={k} id="safety.respond" testId={`safety.respond.${k}`} params={{ kind: k, incidentId: i.id, versionId: i.versionId }} label={RESPONSE_LABEL[k]} />)}
                <ActBtn id="safety.investigate" testId="safety.investigate.incident" params={{ incidentId: i.id, fte: 15 }} icon={ICON.investigate} label="Open case" />
              </div>
            </div>
          );
        })()}
        {(i.status !== 'disclosed' && i.status !== 'leaked') && (() => {
          const inc = s.player.safety.incidents.find((x) => x.id === i.id);
          if (!inc) return null;
          const yes = willDisclose(s, inc);
          return (
            <div className="row-i small" data-test="inc-disclosure">
              <span className="tip-cap"><Term id="disclosure">Disclosure</Term></span>
              <span className="dim">{inc.disclose ? `your choice: ${inc.disclose === 'yes' ? 'disclose' : 'withhold'}` : `policy ${DISCLOSURE_LABEL[disclosurePolicy(s)]}: ${yes ? 'reported' : 'not reported'}`}{mustReport(s, inc) ? ' · the law requires a report' : ''}</span>
              <span className="sp" />
              {!yes && <ActBtn id="safety.disclose" params={{ incidentId: i.id, choice: 'yes' }} label="Disclose" testId={`inc-disclose.${i.id}`} />}
              {yes || inc.status === 'covered' ? null : !inc.disclose && <ActBtn id="safety.disclose" params={{ incidentId: i.id, choice: 'no' }} label="Withhold" testId={`inc-withhold.${i.id}`} />}
            </div>
          );
        })()}
      </div>
    );
  };
  return (
    <div className="saf-inc">
      <Card title={<Term id="incident">Incidents</Term>} sub={<Tip content={() => <TipCard title={<Term id="incident">Open incidents</Term>} value={String(live.length)}>Incidents not yet resolved: respond or investigate.</TipCard>}><span>{live.length} open</span></Tip>} home="incidents" id="ctl-incidents">
        {live.map(card)}
        {!live.length && <div className="row-i small"><ICON.check size={14} className="tone-pos" /> No open incidents</div>}
        {past.length > 0 && <><div className="tip-cap" style={{ marginTop: 10 }}>Closed</div>{past.map(card)}</>}
        <div className="row-i small" style={{ marginTop: 10 }} data-test="disclosure-policy">
          <span className="tip-cap"><Term id="disclosure">Disclosure policy</Term></span>
          <div className="btn-row">{DISCLOSURE_POLICIES.map((p) => <ActBtn key={p} id="safety.disclosurePolicy" params={{ policy: p }} label={DISCLOSURE_LABEL[p]} primary={disclosurePolicy(s) === p} testId={`disclosure.${p}`} />)}</div>
        </div>
      </Card>
    </div>
  );
}
