// Safety (STRUCTURE §4.5, BUILD-PLAN R8, mockups-v3 v3-safety*, v3-safety-IA.md). Replaces the Safety lab.
// First glance (Overview) holds four things: the verdict with its cause → fix chains, the capability vs understanding
// chart (U only; its breakdown, tools validated to and upkeep live in the U tooltip, L3), the four risk families of a
// model, and the policies. One click deeper: Research lines (HOME of line health, teams, results, dead ends, tool
// upkeep, tools, results feed), Investigations, Trait graph (beliefs, detection by level, misalignment band, failure
// modes) and Incidents. Trusted to AI and the monitors live on Company › Agents at work (D4): links only.
import { useMemo, useState, type ReactNode } from 'react';
import { Ban, ClipboardCheck, Droplets, Eye, ListChecks, Ruler, Telescope, TrendingDown, Waypoints, Wrench, X, type LucideIcon } from 'lucide-react';
import { AGENDA_BY_ID, UPKEEP_MIN } from '../../../data/v2/agendas';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { CRITICAL_TRAITS, TRAIT_BY_ID, TRAIT_IDS, TRAIT_MEANING } from '../../../data/v2/traits';
import { RISK_FAMILIES } from '../../../data/v2/agents';
import { PROJECT_BY_ID, TREE, isLineNode } from '../../../data/v2/tree';
import { COLUMN_LABEL } from '../../../data/v2/teams';
import {
  beliefView, dateOf, sightGrid, sightLimit, evalDaysFor, fmtDate, footholdView, INV_FTE, INV_MAX_DAYS, internalVersion, MONITOR_BUDGET_STEP, monitorAt, monitoredUses, nodeKnown, PATCH_FLOOR, patchLevel, projectEta, publicTimerRules,
  projectReady, riskFamilies, safIdleFlag, safetyAgentVersion, safetyFleet, safetyView, successorPullView, teamsOn, versionById,
} from '../../../engine/v2';
import type { FindingType, GameStateV2, LineRow, ResponseKind, TraitId } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, Limit, Term, Tip, TipCard } from '../ui';
import { Card, CauseChain, GoBtn, HBar, PanelHead, Pill, Ref, tabOf, Tabs, type ChainLink } from '../kit';
import * as F from '../fmt';
import { FAMILY_ICON, ICON, TRAIT_ICON } from '../icons';
import { C, SPHERE, div } from '../theme';
import { TraitGraph, traitSev } from './TraitGraph';
import { ControlCard, FootholdsTab } from './SafetyControl';
import './safety.css';

type SV = ReturnType<typeof safetyView>;
const FAM_ICON: Record<string, LucideIcon> = FAMILY_ICON;
const COL_ICON: Record<string, LucideIcon> = { alignment: ICON.colAlignment, interp: ICON.colInterp, evals: ICON.colEvals };
const RESPONSES: { k: ResponseKind; label: string }[] = [
  { k: 'patchSignal', label: 'Patch signal' }, { k: 'retrainAgainst', label: 'Retrain against' }, { k: 'targetedTraining', label: 'Targeted training' },
  { k: 'restrictContext', label: 'Restrict context' }, { k: 'liftRestriction', label: 'Lift restriction' }, { k: 'addControl', label: 'Add control' }, { k: 'rollback', label: 'Roll back' }, { k: 'disclose', label: 'Disclose' },
];
const FTYPE: Record<string, { icon: LucideIcon; label: string; tone: string }> = {
  TECH: { icon: Wrench, label: 'Tool', tone: 'good' }, EVAL: { icon: Ruler, label: 'Eval', tone: 'good' }, DISC: { icon: Telescope, label: 'Discovery', tone: 'warn' },
  DEAD: { icon: Ban, label: 'Dead end', tone: 'neu' }, NEG: { icon: TrendingDown, label: 'Negative', tone: 'bad' }, SPILL: { icon: Droplets, label: 'Spillover', tone: 'neu' },
  FALSE: { icon: Wrench, label: 'Tool', tone: 'good' },
};
const HEALTH_TONE: Record<string, string> = { Promising: 'good', Mixed: 'warn', Struggling: 'bad' };
const tname = (t: string) => TRAIT_BY_ID[t as TraitId]?.name ?? F.words(t);
const eta = (d: number) => (Number.isFinite(d) ? F.days(d) : '—');
const lineName = (id: string) => AGENDA_BY_ID[id as keyof typeof AGENDA_BY_ID]?.name ?? id;

export function Safety({ s }: { s: GameStateV2 }) {
  const sv = safetyView(s);
  const tab = tabOf('safety', 'overview');
  const openInc = sv.incidents.filter((i) => i.status === 'open' || i.status === 'investigating').length;
  const openCases = sv.investigations.filter((i) => !i.outcome).length;
  const lb = sv.lineBadges;
  const fv = footholdView(s);
  const lineBadge = (lb.promisingIdle.length || lb.deadEndTM >= 0.5) ? (
    <span className="sf-tbadges">
      {lb.promisingIdle.length > 0 && <span className="sf-tb warn" data-test="badge-idle">{lb.promisingIdle.length} idle</span>}
      {lb.deadEndTM >= 0.5 && <span className="sf-tb" data-test="badge-dead">{F.num(lb.deadEndTM, 0)} team-mo lost</span>}
    </span>
  ) : undefined;
  return (
    <div className="panel-v2 safety" data-panel="safety">
      <PanelHead
        icon={ICON.safety}
        title="Safety"
        tabs={<Tabs panel="safety" def="overview" tabs={[
          { id: 'overview', label: 'Overview', icon: ICON.overview }, { id: 'lines', label: 'Research lines', icon: ListChecks, badge: lineBadge },
          { id: 'cases', label: 'Cases', icon: ICON.incident, badge: openCases + openInc || undefined }, { id: 'graph', label: 'Trait graph', icon: Waypoints },
          { id: 'footholds', label: 'Footholds', icon: ICON.foothold, badge: fv.suspected + fv.located || undefined },
        ]} />}
      />
      {tab === 'overview' && <Overview s={s} sv={sv} />}
      {tab === 'lines' && <LinesTab s={s} sv={sv} />}
      {/* Jank S4: incidents and investigations share one Cases tab (each was one line on an empty page most of the game). */}
      {(tab === 'cases' || tab === 'incidents') && <div className="sf-cases2"><IncidentsTab s={s} sv={sv} /><CasesTab s={s} sv={sv} /></div>}
      {tab === 'graph' && <GraphTab s={s} sv={sv} />}
      {tab === 'footholds' && <FootholdsTab s={s} />}
    </div>
  );
}

// ───────── Overview ─────────
function Overview({ s, sv }: { s: GameStateV2; sv: SV }) {
  const fams = riskFamilies(s);
  const cand = bestIdea(s, fams);
  return (
    <div className="sf-ov">
      <Verdict sv={sv} fams={fams} cand={cand} />
      <div className="sf-grid">
        {/* E11: the Control card joins the side column; Policies move under the chart (the side column grew). */}
        <div className="sf-main">
          <RaceChart s={s} sv={sv} fams={fams} cand={cand} />
          <Policies s={s} sv={sv} />
        </div>
        <div className="sf-side">
          <ControlCard s={s} />
          <SideSwitch />
          {sideTab() === 'successor' ? <SuccessorCard s={s} /> : <Families s={s} />}
        </div>
      </div>
    </div>
  );
}

/** F6b: the side column under Control shows one of Risk families / Successor pull (it was taller than the chart with
 *  both). The choice is a store tab (`safety.side`), so the Blueprint's successor link opens it. */
const sideTab = () => (store.tab['safety.side'] === 'successor' ? 'successor' : 'families');
function SideSwitch() {
  const cur = sideTab();
  const opts = [{ id: 'families', label: 'Risk families', term: 'riskFamily' }, { id: 'successor', label: 'Successor pull', term: 'successorPull' }] as const;
  return (
    <div className="sf-side-tabs" role="tablist" data-test="sf-side-tabs">
      {opts.map((o) => <button key={o.id} role="tab" aria-selected={cur === o.id} className={`sf-side-tab ${cur === o.id ? 'on' : ''}`} data-test={`sf-side.${o.id}`} onClick={() => store.setTab('safety.side', o.id)}>{o.label}</button>)}
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

function Verdict({ sv, fams, cand }: { sv: SV; fams: Fams; cand: ReturnType<typeof bestIdea> }) {
  const sl = sv.sightLimit;
  const m = sl.gap;
  const up = sv.upkeep;
  const tone = m < 0 ? 'bad' : m < 0.5 || fams.some((f) => f.unseen) ? 'warn' : 'good';
  // Jank S1: the verdict counts what the tools cannot see.
  const unseen = fams.filter((f) => f.unseen);
  const title = m < 0 ? 'Model past your sight limit' : m < 0.5 ? 'Sight limit barely above the model' : unseen.length ? `Sight limit above the model, but ${unseen.length} of ${fams.length} risk families unseen` : 'Sight limit above the model';
  const widening = up.capPerMo > up.upkeepPerMo + 0.02;
  const sub = [`Sight limit L ${F.level(sl.L)} (${F.level(sl.lo)}–${F.level(sl.hi)})`, m < 0 ? `${F.num(-m, 1)} levels past it` : `${F.num(m, 1)} levels above the model`, widening ? 'gap widening' : 'holding',
    up.behindInMonths !== undefined && up.behindInMonths > 0 ? `tools fall behind in ~${Math.max(1, Math.round(up.behindInMonths))} mo` : up.behindInMonths === 0 ? 'tools already behind' : ''].filter(Boolean).join(' · ');
  const weak = weakFamily(fams, sl.perTrait);
  const weakRead = weak ? famRead(weak, sl.perTrait) : 1;
  const chains: ChainLink[][] = [];
  if (weak && weakRead < 0.6) {
    chains.push([
      { label: <>{weak.label} {weakRead < 0.5 ? 'unread' : 'barely read'}</>, icon: FAM_ICON[weak.id], kind: 'bad', to: { panel: 'safety', tab: 'overview' } },
      cand ? { label: cand.name, icon: ICON.research, kind: 'root', tip: () => <TipCard title={cand.name} value={cand.active ? 'in progress' : 'not started'}>A detection idea that covers {weak.label.toLowerCase()}. Its odds are the research line's estimate.</TipCard> }
        : { label: 'Research lines', icon: ListChecks, kind: 'root', to: { panel: 'safety', tab: 'lines' } },
    ]);
  }
  if (up.toolsInUpkeep > 0 && widening) chains.push([{ label: 'Tool upkeep slow', icon: ICON.revalidate, kind: 'bad' }, { label: 'Safety RE teams', icon: ICON.roleRE, kind: 'root' }]);
  else if (!sv.lines.some((l) => l.teams.length)) chains.push([{ label: 'No line staffed', icon: ListChecks, kind: 'bad' }, { label: 'Research lines', icon: ICON.roleSci, kind: 'root', to: { panel: 'safety', tab: 'lines' } }]);
  return (
    <div className={`sf-verdict ${tone}`} data-home="safetyVerdict" data-test="verdict">
      {m < 0 ? <ICON.blind size={22} /> : <Eye size={22} />}
      <div className="sf-vt">
        <b>{title}</b>
        <Tip content={() => <TipCard title={<Term id="sightLimit">Sight limit vs capability</Term>} value={`${F.num(m, 1, true)} levels`} rows={[
          { label: 'Capability (measured)', value: F.level(up.L) }, { label: <Term id="sightLimit">Sight limit</Term>, value: `L ${F.level(sl.L)} (${F.level(sl.lo)}–${F.level(sl.hi)})` },
          { label: 'Capability per month', value: `+${F.num(up.capPerMo, 2)} L` }, { label: 'Tool upkeep per month', value: `+${F.num(up.upkeepPerMo, 2)} L` },
        ]}>Positive: your instruments read the model past its level. The gap widens when capability grows faster than tool upkeep.</TipCard>}><span className="small">{sub}</span></Tip>
      </div>
      <span className="sp" />
      {chains.map((c, i) => (
        <span key={i} className="sf-chain row-i">
          <CauseChain links={c} />
          {i === 0 && cand && c.length && c[1].label === cand.name ? <GoBtn to={{ panel: 'research' }} label="Research" testId="verdict.research" /> : null}
          {c[0].label === 'Tool upkeep slow' && <GoBtn to={{ panel: 'company', tab: 'people' }} label="Company" testId="verdict.company" />}
        </span>
      ))}
    </div>
  );
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
  const up = sv.upkeep;
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
  const upkWk = (up.upkeepPerMo * 7) / 30.4;
  const projL = Array.from({ length: ahead + 1 }, (_, i) => Lnow + capWk * i);
  const projU = Array.from({ length: ahead + 1 }, (_, i) => Unow + Math.min(capWk, upkWk) * i);
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
            <text x={x(t0 + ahead) + 4} y={y(ifU + (projU[ahead] - projU[ifWk])) + 3} className="sf-lab" fill={C.watch}>U, if {cand?.name.split(' ')[0].toLowerCase()}</text>
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

/** The sight-limit tooltip (L3): the sight limit with its range, upkeep against capability, and the best idea's effect. */
function UTip({ s, sv, cand, ifU }: { s: GameStateV2; sv: SV; fams: Fams; cand: ReturnType<typeof bestIdea>; ifU?: number }) {
  const up = sv.upkeep;
  return (
    <TipCard title={<><Term id="sightLimit">Sight limit</Term> · {fmtDate(dateOf(s, s.time.day))}</>} value={`L ${F.level(sv.sightLimit.L)} (${F.level(sv.sightLimit.lo)}–${F.level(sv.sightLimit.hi)})`} rows={[
      { label: <>upkeep {F.num(up.upkeepPerMo, 2, true)}/mo · capability {F.num(up.capPerMo, 2, true)}/mo</>, value: up.behindInMonths === undefined ? 'keeps up' : up.behindInMonths === 0 ? 'behind now' : `behind in ~${Math.max(1, Math.round(up.behindInMonths))} mo`, tone: up.behindInMonths !== undefined ? 'neg' : 'pos' },
      ...(cand && ifU !== undefined ? [{ label: <>{cand.name} works</>, value: `L ${F.num(sv.sightLimit.L, 1)} → ${F.num(ifU, 1)}` }] : []),
    ]}>The highest level at which your instruments together still read the hidden-goal traits at 50% or better; the range is what your uncertainty about each instrument allows. From what you believe, not the truth.</TipCard>
  );
}

const MEANING_TERM: Record<string, string> = { behaviour: 'traitBehaviour', awareness: 'traitAwareness', disposition: 'traitDisposition', protective: 'traitProtective' };
const FAM_MAX = 0.6;
const famCol = (est: number) => (est >= 0.3 ? C.bad : est >= 0.15 ? C.watch : C.good);
/** Traits outside the four families: situational awareness (an awareness) and the protective traits. */
const OTHER_TRAITS: TraitId[] = TRAIT_IDS.filter((t) => !RISK_FAMILIES.some((f) => f.traits.includes(t)));

/** One trait one level below its family: icon, name, what its number means, believed estimate with its 90% band. */
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
    <Tip as="div" content={() => <TipCard title={<Term id={`trait:${t}`}>{tname(t)}</Term>} value={`${F.num(est, 2)} ± ${F.num(sd, 2)}`} rows={[
      { label: <Term id={MEANING_TERM[meaning]}>Kind</Term>, value: meaning },
      { label: <Term id="misBand">90% band</Term>, value: `${F.num(lo, 2)}–${F.num(hi, 2)}` },
      { label: <Term id="clarity">Clarity</Term>, value: F.pct(b?.clarity ?? 0) },
    ]} footer="Your belief, not the truth.">{TRAIT_BY_ID[t].desc}{prot ? ' Higher is better.' : ''}</TipCard>}>
      <div className="sf-trait" data-trait={t}>
        {Ic ? <Ic size={13} /> : <span />}
        <span className="ellip"><Term id={`trait:${t}`}>{tname(t)}</Term></span>
        <span className={`sf-mean ${meaning}`}><Term id={MEANING_TERM[meaning]}>{meaning}</Term></span>
        <span className="sf-fam-bar sm">
          <span className="sf-fam-band" style={{ left: `${(Math.min(FAM_MAX, lo) / FAM_MAX) * 100}%`, width: `${(Math.min(FAM_MAX, hi) - Math.min(FAM_MAX, lo)) / FAM_MAX * 100}%`, background: prot ? C.neutral : famCol(est), opacity: (b?.clarity ?? 0) < 0.3 ? 0.35 : 0.55 }} />
          <span className="sf-fam-est" style={{ left: `${(Math.min(FAM_MAX, est) / FAM_MAX) * 100}%` }} />
        </span>
        <span className="num small">{F.num(est, 2)} <span className="dim">±{F.num(sd, 2)}</span></span>
      </div>
    </Tip>
  );
}

function Families({ s }: { s: GameStateV2 }) {
  const iv = internalVersion(s);
  const vs = s.player.models.versions.filter((v) => v.status !== 'retired' && v.status !== 'rolledBack').slice(-3).reverse();
  const sel = versionById(s, store.sel.versionId) ?? iv;
  const fams = riskFamilies(s, sel?.id);
  const [open, setOpen] = useState<string | undefined>(undefined);
  const max = FAM_MAX;
  return (
    <Card title={<Term id="riskFamily">Risk families</Term>} home="riskFamilies" className="sf-fam"
      right={vs.length > 1 && (
        <span className="sf-vtabs">
          {vs.map((v) => <button key={v.id} className={`sf-vt ${sel?.id === v.id ? 'on' : ''}`} data-test={`fam-v.${v.id}`} onClick={() => store.select({ versionId: v.id })}>{v.name}{v.id === iv?.id ? <span className="dim"> internal</span> : null}</button>)}
        </span>
      )}>
      <div className="sf-fam-axis small dim"><span /><span className="sf-fam-scale"><i style={{ left: '0%' }}>0</i><i style={{ left: `${(0.25 / max) * 100}%` }}>0.25</i><i style={{ left: `${(0.5 / max) * 100}%` }}>0.5</i></span><span>est. ± band</span><span /></div>
      {fams.map((f) => {
        const Ic = FAM_ICON[f.id];
        const st = f.investigating ? 'inv' : f.unseen ? 'unseen' : 'seen';
        const col = famCol(f.est);
        const isOpen = open === f.id;
        return (
          <div key={f.id} className={`sf-fam-grp ${isOpen ? 'open' : ''}`}>
            <Tip as="div" content={() => (
              <TipCard title={<Term id="riskFamily">{f.label}</Term>} value={`${F.num(f.est, 2)} ± ${F.num(f.sd, 2)}`} rows={[
                { label: 'Highest trait', value: tname(f.worst) },
                { label: <Term id="clarity">Mean clarity</Term>, value: F.pct(f.clarity), tone: f.unseen ? 'neg' : 'neutral' },
              ]} footer="Click for its traits.">{st === 'unseen' ? 'Your evidence on this family is thin (clarity under 30%): the estimate may be far off.' : st === 'inv' ? 'A case is open on it.' : 'Your tools read it.'} The bar shows the highest trait estimate and its 90% band.</TipCard>
            )}>
              <div className="sf-fam-row" data-family={f.id} data-state={st} data-test={`fam-open.${f.id}`} onClick={() => setOpen(isOpen ? undefined : f.id)}>
                <Ic size={18} />
                <span><b>{f.label}</b> <ICON.go size={11} className={`sf-caret ${isOpen ? 'open' : ''}`} /><br /><span className="sf-ticons">{f.traits.map((t) => { const T = TRAIT_ICON[t]; return T ? <T key={t} size={11} /> : null; })}</span></span>
                <span className="sf-fam-bar">
                  <span className="sf-fam-band" style={{ left: `${(f.lo / max) * 100}%`, width: `${(Math.min(max, f.hi) - Math.min(max, f.lo)) / max * 100}%`, background: col, opacity: st === 'unseen' ? 0.35 : 0.55 }} />
                  <span className="sf-fam-est" style={{ left: `${(Math.min(max, f.est) / max) * 100}%` }} />
                </span>
                <span className="num">{F.num(f.est, 2)} <span className="dim small">±{F.num(f.sd, 2)}</span></span>
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
      <div className="sf-fam-leg small dim"><span className="row-i"><Eye size={11} /> tools see it</span><span className="row-i"><ICON.blind size={11} /> unseen (thin evidence)</span><span className="row-i"><ICON.investigate size={11} /> under investigation</span></div>
    </Card>
  );
}

const SLOT_LABEL: Record<string, string> = { SWE: 'Software', EXP: 'Experiments', IDEAS: 'Research ideas' };
const SLOT_ICON: Record<string, LucideIcon> = { SWE: ICON.roleEng, EXP: ICON.roleRE, IDEAS: ICON.roleSci };
/** Successor pull (model v3 E4/E12, home `successorPull`): how far the next model's dispositions move toward the models
 *  doing your R&D. Believed: κ from your estimate of each model's successor steering, oversight from believed tools. */
function SuccessorCard({ s }: { s: GameStateV2 }) {
  const sp = successorPullView(s);
  const free = sp.parts.reduce((a, x) => a + x.share * (1 - x.oversight), 0);
  const unwatched = sp.r > 1e-9 ? free / sp.r : 1;
  const kappa = free > 1e-9 ? sp.omega / free : 0;
  const tone = sp.omega >= 0.3 ? 'tone-neg' : sp.omega >= 0.1 ? 'tone-warn' : '';
  const agents = { panel: 'company', tab: 'people', anchor: 'agents' };
  return (
    <Card title={<Term id="successorPull">Successor pull</Term>} home="successorPull" id="ctl-successorPull" className="sf-succ"
      right={<Tip content={() => <TipCard title={<Term id="successorPull">Successor pull ω</Term>} value={F.num(sp.omega, 3)} rows={[
        { label: '90% band (successor-steering belief)', value: `${F.num(sp.omegaBand[0], 2)}–${F.num(sp.omegaBand[1], 2)}` },
        { label: <Term id="aiRdShare">AI share of R&amp;D</Term>, value: F.pct(sp.r) },
        { label: <>Not caught by <Term id="rdOversight">oversight</Term></>, value: F.pct(unwatched) },
        { label: 'κ (pull per unit)', value: F.num(kappa, 2) },
      ]} footer="Estimated from your beliefs; the true pull can differ.">The next run's new model starts this far along the way from its own dispositions to its makers'.</TipCard>}>
        <span className={`num big ${tone}`} data-test="succ-omega">ω {F.num(sp.omega, 2)}</span>
      </Tip>}>
      <div className="sf-succ-eq small" data-test="succ-eq">
        <Tip content={() => <TipCard title={<Term id="aiRdShare">AI share of R&amp;D</Term>} value={F.pct(sp.r)}>Share of the lab's software, experiment and research-idea labour done by AI agents.</TipCard>}><span><b className="num" data-test="succ-r">{F.pct(sp.r)}</b> AI share of R&amp;D</span></Tip>
        <span className="dim">×</span>
        <Tip content={() => <TipCard title={<Term id="rdOversight">Not caught</Term>} value={F.pct(unwatched)} rows={sp.parts.map((x) => ({ label: SLOT_LABEL[x.slot], value: `blocked ${F.pct(x.block)} · caught ${F.pct(x.caught)}` }))}>Share of the AI R&amp;D work no containment blocks and no monitor or human review catches.</TipCard>}><span><b className="num" data-test="succ-unwatched">{F.pct(unwatched)}</b> unwatched</span></Tip>
        <span className="dim">×</span>
        <Tip content={() => <TipCard title="κ" value={F.num(kappa, 2)}>0.4 for a model with no wish to steer its successor, up to 1 for one that fully wants to (from your successor-steering estimate).</TipCard>}><span>κ <b className="num">{F.num(kappa, 2)}</b></span></Tip>
      </div>
      {sp.parts.length > 0 && <div className="sf-succ-hd"><span /><span /><span /><span>share</span><span><Term id="rdOversight">oversight</Term></span><span>ω</span></div>}
      {sp.parts.map((x) => {
        const I = SLOT_ICON[x.slot];
        const v = versionById(s, x.versionId);
        return (
          <Tip key={x.slot} as="div" content={() => <TipCard title={<>{v?.name ?? x.versionId} on {SLOT_LABEL[x.slot].toLowerCase()}</>} value={`ω ${F.num(x.omega, 3)}`} rows={[
            { label: <Term id="aiRdShare">Share of the lab's R&amp;D</Term>, value: F.pct(x.share, 1) },
            { label: <Term id="rdOversight">Oversight</Term>, value: F.pct(x.oversight) },
            { label: 'blocked (control layer)', value: F.pct(x.block) }, { label: 'caught (monitors, human review, control)', value: F.pct(x.caught) },
            { label: 'human review on this model', value: F.pct(x.human) },
            ...(x.controlMiss < 1 ? [{ label: 'control protocols: misses', value: `×${F.num(x.controlMiss, 2)}` }] : []),
            { label: <Term id="trait:SUCC">Successor steering</Term>, value: `${F.num(x.succ.est, 2)} ± ${F.num(x.succ.sd, 2)}` },
            { label: 'κ', value: `${F.num(x.kappa, 2)} (${F.num(x.kappaBand[0], 2)}–${F.num(x.kappaBand[1], 2)})` },
          ]}>ω = κ × share × (1 − oversight).</TipCard>}>
            <div className="sf-succ-row" data-slot={x.slot} data-test="succ-part">
              <I size={13} /><span className="ellip">{SLOT_LABEL[x.slot]} <span className="dim">· {v?.name ?? x.versionId}</span></span>
              <HBar v={x.omega} max={Math.max(0.05, sp.omega)} w={60} color={C.watch} />
              <span className="num small" data-test="succ-part-share">{F.pct(x.share)}</span>
              <span className="num small dim">{F.pct(x.oversight)}</span>
              <span className="num small" data-test="succ-part-omega">{F.num(x.omega, 2)}</span>
            </div>
          </Tip>
        );
      })}
      {!sp.parts.length && <div className="small dim">No AI model does your R&amp;D: nothing pulls the next model.</div>}
      <div className="sf-succ-foot small"><span className="dim">Lower it:</span>
        <Ref id="agentMonitor" to={agents}>Monitors</Ref><Ref id="aiRdShare" to={agents}>Less AI R&amp;D</Ref>
        <Tip content={() => <TipCard title="Cleaner models">Put models with lower believed dispositions on R&amp;D, or train them down: κ and the dispositions passed on fall.</TipCard>}><span className="dim">cleaner models</span></Tip>
      </div>
    </Card>
  );
}

function Policies({ s, sv }: { s: GameStateV2; sv: SV }) {
  const gate = sv.evalGate;
  const on = gate !== 'none';
  const mon = monitoredUses(s);
  const budget = s.player.split.monitors; // RD-A05a: the monitors' allocation line, a share of total compute
  const at = (x: number) => Math.max(0, Math.min(1, Math.round(x * 1e4) / 1e4));
  const up = at(budget + MONITOR_BUDGET_STEP);
  const mb = monitorAt(s, budget);
  const full = s.player.computeOnline * mb.need;
  const sm = safetyAgentVersion(s);
  const pol = s.player.policies.publishSafety;
  const company = { panel: 'company', tab: 'people', anchor: 'agents' };
  return (
    <Card title="Policies" home="safetyPolicy" id="ctl-policy" className="sf-pol">
      <div className="sf-prow">
        <ClipboardCheck size={18} />
        <span><b><Term id="evalGate">Evaluate before release</Term></b><br /><Tip content={() => <TipCard title={<Term id="evalGate">Eval gate</Term>} value={`+${evalDaysFor(s)} d`}>Days a new version waits in evaluation before it can be used or sold: its eval suite's work at today's research engineers.</TipCard>}><span className="small dim">+{evalDaysFor(s)} d per release{gate === 'fullPlusExternal' ? ' · external review' : ''}</span></Tip></span>
        <span className="sp" />
        <Ref id="evalPolicy" to={{ panel: 'models', tab: 'evals' }}>Evals</Ref>
        {on && <span className={`sf-mini ${gate === 'fullPlusExternal' ? 'on' : ''}`}><ActBtn id="safety.evalGate" testId="safety.evalGate.external" params={{ level: gate === 'fullPlusExternal' ? 'full' : 'fullPlusExternal' }} label="external" /></span>}
        <span className={`sf-toggle ${on ? 'on' : ''}`}><ActBtn id="safety.evalGate" testId="safety.evalGate.toggle" params={{ level: on ? 'none' : 'full' }} label={<i />} /></span>
      </div>
      <div className="sf-prow">
        <ICON.agents size={18} />
        <span><b><Term id="agentMonitor">Monitor internal agents</Term></b><br /><Tip content={() => <TipCard title={<Term id="monitorCoverage">Monitoring coverage</Term>} value={F.pct(mb.coverage)} rows={[
          { label: 'Uses with a monitor', value: `${mon.length} of 4` },
          { label: 'Budget', value: `${F.pct(budget, 1)} of compute` },
          { label: 'Unused', value: `${F.h100e(s.player.computeOnline * budget - mb.h100e)} H100e` },
          { label: 'Spent', value: `${F.h100e(mb.h100e)} H100e` },
          { label: 'Full coverage needs', value: `${F.h100e(full)} H100e` },
          ...(mb.coverage < 1 ? [{ label: `At ${F.pct(up)}`, value: F.pct(monitorAt(s, up).coverage) }] : []),
        ]} footer="Monitor models: Company › Agents at work. A cheaper monitor watches more for the same budget, but misses more of a stronger model.">Share of the internal agents' forward passes the monitors watch: budget ÷ (watched compute × the monitor's cost per pass).</TipCard>}><span className="small dim">{mon.length} of 4 uses · <span data-test="monitor-coverage">{F.pct(mb.coverage)}</span> watched · {F.pct(budget, 1)} of compute</span></Tip></span>
        <span className="sp" />
        <Ref id="agentMonitor" to={company}>Company</Ref>
        <span className="stepper">
          <ActBtn id="agents.monitorBudget" testId="agents.monitorBudget.down" params={{ share: at(budget - MONITOR_BUDGET_STEP) }} icon={ICON.minus} label="" block={budget <= 0 ? 'Already 0%' : undefined} />
          <ActBtn id="agents.monitorBudget" testId="agents.monitorBudget.up" params={{ share: up }} icon={ICON.plus} label="" block={s.player.split.safety <= 1e-9 ? 'No safety research compute left to move' : mon.length === 0 ? 'No monitor on any use: pick one on Company › Agents at work' : mb.coverage >= 1 ? 'Already watching every forward pass' : undefined} />
        </span>
      </div>
      <div className="sf-prow">
        <ICON.roleSci size={18} />
        <Tip content={() => <TipCard title={<Term id="trustedToAI">Trusted to AI</Term>} value={F.pct(s.player.policies.trustedToAI)} rows={[{ label: <Term id="aiDoneShare">Work AI does</Term>, value: F.pct(safetyFleet(s).aiShare) }, { label: 'Safety-research model', value: sm?.name ?? '—' }]}>Share of safety research handed to AI agents; they do the part their model covers. Set on Company › Agents at work.</TipCard>}><span><b><Term id="trustedToAI">Trusted to AI</Term></b> <span className="num">{F.pct(s.player.policies.trustedToAI)}</span> <span className="small dim">of safety work · AI does {F.pct(safetyFleet(s).aiShare)}</span><br /><span className="small dim">safety-research model {sm?.name ?? '—'}</span></span></Tip>
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
      <Card title={<Term id="researchLine">Research lines</Term>} home="researchLines" id="ctl-lines"
        sub={<>{staffed.length} staffed · {sci} safety science teams{safIdleFlag(s) ? <span className="tone-warn" data-test="saf-idle"> · {safIdleFlag(s)}</span> : null} · <Term id="deadEnd">{F.num(sv.lineBadges.deadEndTM, 0)} team-mo lost</Term> on dead ends</>}
        right={<button className="btn btn-sm" data-test="lines-all" onClick={() => setAll(!all)}>{all ? 'Staffed only' : `Show all ${sv.lines.length}`}</button>}>
        <div className="sf-lhd small dim"><span>Line</span><span><Term id="lineHealth">Health</Term></span><span>Teams</span><span>Project · next result</span><span>Results</span><span><Term id="deadEnd">Dead ends</Term></span><span /></div>
        {staffed.map((l) => <LineRowView key={l.id} s={s} l={l} />)}
        {!staffed.length && <div className="dim small">No safety science team works a research line.</div>}
        {(all ? rest : rest.filter((l) => idle.includes(l.id))).length > 0 && <div className="tip-cap sf-sep">{all ? `Not staffed · ${rest.length}` : `Promising, no team · ${idle.length}`}</div>}
        {(all ? rest : rest.filter((l) => idle.includes(l.id))).map((l) => <LineRowView key={l.id} s={s} l={l} />)}
      </Card>
      <div className="sf-side">
        <UpkeepCard sv={sv} />
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
        { label: 'Ideas known', value: `${l.ideasKnown} of ${l.ideasTotal}` }, { label: 'First result at serious staffing', value: `${l.T1} mo` },
        { label: <Term id="seriousStaffing">Staffing</Term>, value: `${F.num(l.mult * 100, 0)}% of serious` }, { label: 'Compute share', value: F.pct(l.computeShare) },
        { label: <Term id="aiDoneShare">Work AI does</Term>, value: F.pct(l.aiLabour) },
      ]}>A serious programme is about four matching teams' capacity. More teams find candidates faster (with diminishing returns); research engineers and compute speed the experiments; AI labour speeds both.</TipCard>}>
        <span className="sf-lname ellip"><Ic size={13} /> {l.name}</span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="lineHealth">{l.band.label}</Term>} value={F.pct(l.band.mean)} rows={[{ label: '90% band', value: `${F.pct(l.band.lo)}–${F.pct(l.band.hi)}` }, { label: 'Results so far', value: l.findings }]}>Estimated chance a project here gives a working tool, from the results so far; the true efficacy stays unknown. The same hidden efficacy also sets how strong this line's tools are, and some results need it high.</TipCard>}>
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
            <Tip content={() => <TipCard title="ETA" value={eta(p.eta)} rows={[{ label: 'Progress', value: F.pct(p.progress) }]}>At today's teams, engineers, compute and AI labour.</TipCard>}><span className="num small">{eta(p.eta)}</span></Tip>
          </span>
        )) : <span className="dim small ellip">{l.next ? <>next: {PROJECT_BY_ID[l.next]?.followUp ? 'follow-up' : PROJECT_BY_ID[l.next]?.name}</> : l.nextReason}</span>}
      </span>
      <Tip content={() => <TipCard title="Results" value={l.findings} rows={[...resTypes.filter((t) => l.results[t]).map((t) => ({ label: FTYPE[t].label, value: l.results[t] as number })), { label: 'Per year now', value: F.num(l.resultsPerYear, 1) }]} />}>
        <span className="sf-res">{resTypes.filter((t) => l.results[t]).map((t) => { const I = FTYPE[t].icon; return <span key={t} className={`ftype2 ${FTYPE[t].tone}`}><I size={11} />{l.results[t]}</span>; })}{!l.findings && <span className="dim small">—</span>}</span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="deadEnd">Dead ends</Term>} value={`${F.num(l.deadEndTM, 1)} team-months`}>Team time spent on results that went nowhere in this line.</TipCard>}><span className="num small">{l.deadEndTM >= 0.05 ? `${F.num(l.deadEndTM, 1)} tm` : <span className="dim">—</span>}</span></Tip>
      <span />
      {pick && target && (
        <div className="sf-pick" data-test="line-picker">
          <span className="small dim">Add a team to {PROJECT_BY_ID[target]?.followUp ? 'the follow-up' : PROJECT_BY_ID[target]?.name}:</span>
          {idleSaf.map((t) => <ActBtn key={t.id} id="research.assign" params={{ team: t.id, id: target }} testId={`line-assign.${t.id}`} label={`${t.specialty ? COLUMN_LABEL[t.specialty] : 'Science'} team${t.specialty === l.column ? ' ×1.5' : ''}`} />)}
          {!idleSaf.length && <span className="small">No idle safety science team · <Ref id="hiring" to={{ panel: 'company', tab: 'people' }}>Hire</Ref></span>}
          <button className="btn btn-sm btn-ghost" onClick={() => setPick(false)}><X size={12} /></button>
        </div>
      )}
    </div>
  );
}

function UpkeepCard({ sv }: { sv: SV }) {
  const up = sv.upkeep;
  const tot = Math.max(1, up.heads);
  const seg = (v: number, c: string, k: string) => (v > 0 ? <i key={k} style={{ flex: v / tot, background: c }} /> : null);
  return (
    <Card title={<Term id="toolUpkeep">Tool upkeep</Term>} sub="safety research engineers" home="toolUpkeep" id="ctl-upkeep">
      <div className="stack2 load-bar" data-test="re-bar">{seg(up.investigations, C.watch, 'inv')}{seg(up.patches, C.neutral, 'pat')}{seg(up.experiments, SPHERE.ops, 'exp')}{seg(up.upkeepHeads, C.und, 'upk')}</div>
      <Tip as="div" content={() => <TipCard title="Safety research engineers" value={F.count(up.heads)} rows={[{ label: 'Tool upkeep', value: F.count(up.upkeepHeads) }, { label: 'Line experiments', value: F.count(up.experiments) }, { label: 'Cases', value: F.count(up.investigations) }, { label: 'Patches', value: F.count(up.patches) }]}>Where the safety research engineers work now: cases and patches first, then the research lines' experiments (at most half of the rest), then tool upkeep.</TipCard>}>
      <div className="small dim load-legend">
        <span className="load-key"><i style={{ background: C.und }} />upkeep <span className="num">{F.count(up.upkeepHeads)}</span></span>
        {up.experiments > 0 && <span className="load-key"><i style={{ background: SPHERE.ops }} />experiments <span className="num">{F.count(up.experiments)}</span></span>}
        <span className="load-key"><i style={{ background: C.watch }} />cases <span className="num">{F.count(up.investigations)}</span></span>
        {up.patches > 0 && <span className="load-key"><i style={{ background: C.neutral }} />patches <span className="num">{F.count(up.patches)}</span></span>}
      </div>
      </Tip>
      <Tip as="div" content={() => <TipCard title={<Term id="toolUpkeep">Tool upkeep</Term>} value={up.daysPerOom ? `+1 OOM per ${F.days(up.daysPerOom)}` : 'none needed'} rows={[
        { label: 'Tools fading on today\'s model', value: `${up.toolsInUpkeep} of ${up.toolsTotal}` }, { label: 'Engineers per fading tool', value: F.count(up.perTool) },
      ]}>Research engineers re-validate tools that start to fade on your newest model, so they keep working as capability rises. Each fading tool needs a crew of about {UPKEEP_MIN}; beyond that, more engineers per tool means faster upkeep.</TipCard>}>
        <div className="row-i small" data-test="upkeep-rate"><ICON.revalidate size={13} /> {up.toolsInUpkeep ? (up.daysPerOom ? <>{up.toolsInUpkeep} tools fading · <span className="num">{F.days(up.daysPerOom)}</span> per OOM of <Term id="halfStrength">headroom</Term></> : <span className="tone-neg">{up.toolsInUpkeep} tools fading · crew too thin ({F.count(up.perTool)} per tool, needs {UPKEEP_MIN}+)</span>) : 'all tools hold on today\'s model'}</div>
      </Tip>
      <div className="btn-row"><Ref id="hiring" to={{ panel: 'company', tab: 'people' }}>Safety RE teams</Ref></div>
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
              <Tip content={() => <TipCard title={f.title} rows={[{ label: 'Line', value: lineName(f.agenda) }, { label: 'Date', value: fmtDate(dateOf(s, f.day)) }]} />}><span className={`ellip ${f.retracted ? 'strike' : ''}`}>{f.title}</span></Tip>
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
  const techs = sv.techniques.filter((t) => t.unlocked).sort((a, b) => a.decay - b.decay);
  return (
    <Card title={<><Term id="technique">Tools</Term> <span className="dim num">{techs.length}</span></>} sub="strength on today's model" home="techniques" className="sf-tools"
      right={<button className="btn btn-sm" data-test="tools-open" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</button>}>
      {open && (
        <div className="sf-tgrid">
          {techs.map((t) => (
            <div key={t.id} className="sf-tool" data-technique={t.id}>
              <Tip content={() => <TipCard title={t.name} value={t.family} rows={[{ label: 'Line', value: lineName(t.agenda) }, { label: 'Strength', value: F.num(t.strength, 2) }, { label: 'Faded', value: F.pct(1 - t.decay) }, { label: <Term id="halfStrength">Half strength at</Term>, value: t.halfL !== undefined ? `L ${F.num(t.halfL, 1)}` : t.agenda === 'AG05' ? 'overseer gap' : 'never' }]}>{t.role === 'fix' ? 'A training method used in your post-training runs.' : 'A detection or control tool in your safety stack. Tools you own are always in use.'}</TipCard>}>
                <span className="ellip small"><b>{t.name}</b></span>
              </Tip>
              <HBar v={t.strength} max={1} w={70} color={t.decay < 0.5 ? C.bad : C.und} />
              <span className="num small">{F.num(t.strength, 2)}</span>
              {t.trainedAgainst > 0.05 ? <span className="tag2 warn"><Term id="goodhart">masked</Term></span> : t.decay < 0.8 ? <span className="tag2 bad">{F.pct(1 - t.decay)} faded</span> : <span />}
              {t.role === 'fix' ? <span className="tag2">fix</span> : <span />}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ───────── Investigations ─────────
function CasesTab({ s, sv }: { s: GameStateV2; sv: SV }) {
  const v = versionById(s, store.sel.versionId) ?? internalVersion(s);
  const [trait, setTrait] = useState<TraitId>('SCHEME');
  const [fte, setFte] = useState(15);
  const open = sv.investigations.filter((i) => !i.outcome).reverse();
  const done = sv.investigations.filter((i) => i.outcome).slice(-8).reverse();
  const up = sv.upkeep;
  const free = Math.max(0, up.heads - up.investigations - up.patches);
  const card = (x: SV['investigations'][number]) => {
    const vn = x.target.kind === 'trait' ? s.player.models.versions.find((q) => q.id === (x.target as { versionId: string }).versionId)?.name ?? '' : '';
    const closeDay = x.startDay + INV_MAX_DAYS;
    return (
      <div className={`sf-case ${x.outcome ? 'done' : ''}`} key={x.id} data-case={x.id}>
        <div className="row-i">
          <ICON.investigate size={15} />
          <b>{x.target.kind === 'trait' ? <><Term id={`trait:${x.target.trait}`}>{tname(x.target.trait)}</Term> in {vn}</> : <>incident {x.target.incidentId}</>}</b>
          <span className="sp" />
          {x.outcome ? <span className="tag2">{F.words(x.outcome)}{x.outcomeDetail?.severityEst !== undefined ? ` ≈ ${F.num(x.outcomeDetail.severityEst, 2)}` : ''}</span> : <ActBtn id="safety.closeCase" params={{ id: x.id }} label="Close" testId={`case-close.${x.id}`} />}
        </div>
        <div className="sf-case-b">
          <Tip content={() => <TipCard title={<Term id="clarity">Clarity</Term>} value={F.pct(x.clarity)}>The case resolves at 80% clarity, when you close it, or after {INV_MAX_DAYS} days.</TipCard>}>
            <span className="row-i"><span className="small dim">clarity</span><HBar v={x.clarity} max={1} w={110} mark={0.8} /><span className="num small">{F.pct(x.clarity)}</span></span>
          </Tip>
          <Tip content={() => <TipCard title={<Term id="caseStaffing">Case staffing</Term>} value={`${F.count(x.fte)} people`}>Safety research engineers on the case: {INV_FTE[0]}–{INV_FTE[1]}. Clarity grows with √(people ÷ 15); the engineers come out of tool upkeep while it runs.</TipCard>}>
            <span className="small" data-test="case-staff"><ICON.roleRE size={12} /> {F.count(x.fte)} safety research engineers <span className="dim">({INV_FTE[0]}–{INV_FTE[1]})</span></span>
          </Tip>
          <Limit id="case.staffing"><span data-test="case-close">{x.outcome ? `opened ${fmtDate(dateOf(s, x.startDay))}` : `closes by ${fmtDate(dateOf(s, closeDay))} · ${INV_MAX_DAYS} d max · ${INV_FTE[0]}–${INV_FTE[1]} people`}</span></Limit>
        </div>
      </div>
    );
  };
  return (
    <div className="sf-cases">
      <Card title={<Term id="investigation">Investigations</Term>} sub={`${open.length} open · ${F.count(free)} safety research engineers free`} home="investigations" id="ctl-investigate">
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
          <ActBtn id="safety.investigate" params={{ versionId: v?.id ?? '', trait, fte }} icon={ICON.investigate} label="Investigate" primary reason />
        </div>
        {done.length > 0 && <><div className="tip-cap sf-sep">Closed</div>{done.map(card)}</>}
      </Card>
    </div>
  );
}

// ───────── Trait graph ─────────
function GraphTab({ s, sv }: { s: GameStateV2; sv: SV }) {
  const v = versionById(s, store.sel.versionId) ?? internalVersion(s);
  const versions = s.player.models.versions.filter((x) => x.status !== 'retired');
  const iv = internalVersion(s);
  return (
    <div className="saf-graph">
      <Card title="How training shapes dispositions" term="traitGraph"
        sub={<>nodes: your <Term id="belief">belief</Term> (estimate ± uncertainty) · edges: <Term id="evidenceGrade">evidence</Term> (width = weight, solid A … dotted D)</>}
        right={versions.length > 0 && (
          <label className="small dim row-i">beliefs for
            <select className="text-input" data-test="tg-version" value={v?.id ?? ''} onChange={(e) => store.select({ versionId: e.target.value })}>
              {versions.map((x) => <option key={x.id} value={x.id}>{x.name}{x.id === iv?.id ? ' · internal' : ''}</option>)}
            </select>
          </label>
        )}>
        <TraitGraph s={s} versionId={v?.id} />
      </Card>
      <div className="saf-side">
        <DetectionCard s={s} sv={sv} />
        <MisCard s={s} versionId={v?.id} />
        <UModes sv={sv} />
      </div>
    </div>
  );
}

function DetectionCard({ s }: { s: GameStateV2; sv: SV }) {
  const g = useMemo(() => sightGrid(s), [s, s.time.day]);
  const cur = Math.round(g.L);
  return (
    <Card title="Sight limit by trait" sub="believed reading by capability level" home="detectionByLevel" id="ctl-detection">
      <div className="det-grid" style={{ gridTemplateColumns: `130px repeat(${g.levels.length}, minmax(0, 1fr))` }}>
        <span />
        {g.levels.map((l) => <span key={l} className={`det-h num ${l === cur ? 'cur' : ''}`}>L{l}</span>)}
        {g.rows.map((r) => {
          const Icon = TRAIT_ICON[r.trait];
          return [
            <span key={r.trait} className="det-t"><Icon size={12} /><Term id={`trait:${r.trait}`}>{tname(r.trait).replace('Successor alignment to self', 'Successor align.')}</Term></span>,
            ...r.det.map((d, i) => {
              const edge = d >= 0.5 && (r.det[i + 1] ?? 1) < 0.5;
              // Jank S5: colours carry the heatmap; the number is on hover (and in your own level's column).
              return (
                <Tip key={`${r.trait}${i}`} content={() => <TipCard title={`${tname(r.trait)} at L${g.levels[i]}`} value={`${F.idx(d * 100)}% detected`}>{d >= 0.5 ? 'Your tools would see it at this level.' : 'Below 50%: your tools would likely miss it at this level.'}</TipCard>}>
                  <span className={`det-c num ${g.levels[i] === cur ? 'cur' : ''} ${edge ? 'edge' : ''}`} style={{ background: div((d - 0.5) * 2.2) }}>{g.levels[i] === cur ? F.idx(d * 100) : ''}</span>
                </Tip>
              );
            }),
          ];
        })}
      </div>
      <div className="det-leg small dim">
        <span className="row-i"><i className="det-sw cur" /> your level</span>
        <span className="row-i"><i className="det-sw edge" /> 50% line ({CRITICAL_TRAITS.length} hidden-goal traits average = <Ref id="sightLimit" to={{ panel: 'safety', tab: 'overview' }}>Sight limit</Ref>)</span>
      </div>
    </Card>
  );
}

const DANGER = 0.4;
function MisCard({ s, versionId }: { s: GameStateV2; versionId?: string }) {
  const bv = beliefView(s, versionId);
  if (!bv) return <Card title={<Term id="misalign">Estimated misalignment</Term>}><div className="dim small">No model yet</div></Card>;
  const [lo, hi] = bv.misBand;
  const max = Math.max(0.6, hi + 0.08);
  const f = (x: number) => `${(Math.max(0, Math.min(max, x)) / max) * 100}%`;
  const thin = CRITICAL_TRAITS.filter((t) => (bv.beliefs[t]?.clarity ?? 0) < 0.4).length;
  const name = s.player.models.versions.find((x) => x.id === bv.versionId)?.name;
  const col = bv.misEst >= DANGER ? C.bad : bv.misEst >= DANGER / 2 ? C.watch : C.good;
  return (
    <Card title={<Term id="misalign">Estimated misalignment</Term>} sub={`${name ?? ''} · from beliefs`} home="misBand">
      <Tip as="div" content={() => <TipCard title={<Term id="misalign">Estimated misalignment</Term>} value={F.num(bv.misEst, 2)} rows={[{ label: <Term id="misBand">90% band</Term>, value: `${F.num(lo, 2)}–${F.num(hi, 2)}` }, { label: <Term id="dangerLine">Danger line</Term>, value: F.num(DANGER, 2) }, { label: 'Critical traits under-observed', value: String(thin) }]}>From your trait beliefs on {name ?? 'this model'}; the true value stays unknown.</TipCard>}>
      <div className="mis-bar">
        <span className="mis-band" style={{ left: f(lo), width: `calc(${f(hi)} - ${f(lo)})`, background: col }} />
        <span className="mis-est" style={{ left: f(bv.misEst) }}><b className="num">{F.num(bv.misEst, 2)}</b></span>
        <span className="mis-danger" style={{ left: f(DANGER) }}><span><Term id="dangerLine">danger line</Term> <span className="num">{F.num(DANGER, 2)}</span> (published)</span></span>
      </div>
      <div className="small dim"><Term id="misBand">band</Term> <span className="num">{F.num(lo, 2)}–{F.num(hi, 2)}</span>: {thin ? <>wide because {thin} critical traits are under-observed</> : 'your evidence on the critical traits is fresh'}</div>
      </Tip>
      <div className="btn-row" style={{ marginTop: 8 }}><GoBtn to={{ panel: 'risk' }} label="Risk sources" testId="mis.risk" /></div>
    </Card>
  );
}

function UModes({ sv }: { sv: SV }) {
  return (
    <Card title={<Term id="umode">Failure modes found</Term>} home="umodes">
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
          <Pill kind={i.severity >= 4 ? 'bad' : i.severity >= 3 ? 'warn' : 'neu'}><Term id="severity">S{i.severity}</Term></Pill>
          {TI && <TI size={13} />}<b>{i.apparent === 'unexplained' || i.apparent === 'misuse' ? F.words(i.apparent) : <Term id={`trait:${i.apparent}`}>{tname(i.apparent)}</Term>}</b>
          <span className="dim small">{vn} · {i.exposure} · {fmtDate(dateOf(s, i.day))}</span>
          <span className="sp" />
          {i.publicTimerDays !== undefined && i.status === 'open' && (() => { const pr = publicTimerRules(s); return <Limit id="incident.publicTimer" tone="bind">public in {F.days(i.publicTimerDays)}{pr.raise ? ' · RAISE ≤ 3 d' : pr.sb53 ? ' · SB 53 ≤ 15 d' : ''}</Limit>; })()}
          <span className={`tag2 ${isLive ? 'warn' : ''}`}>{i.status}</span>
        </div>
        {i.responses.length > 0 && <div className="small dim">Done: {i.responses.map((r) => RESPONSES.find((x) => x.k === r)?.label ?? r).join(', ')}</div>}
        {isLive && (
          <div className="inc-menu">
            <span className="row-i"><span className="tip-cap"><Term id="response">Respond</Term></span>{(() => { const tr = i.apparent !== 'unexplained' && i.apparent !== 'misuse' ? patchLevel(s, i.apparent) : undefined; return <Limit id="response.patchFloor" tone={tr?.atFloor ? 'bind' : tr && tr.lo < 1 ? 'warn' : 'quiet'}>{tr && tr.lo < 1 ? `patched to ×${tr.hi.toFixed(2)}` : 'patch ×0.3–0.6'} · floor ×{PATCH_FLOOR}</Limit>; })()}</span>
            <div className="btn-row wrap">
              {RESPONSES.map((r) => <ActBtn key={r.k} id="safety.respond" testId={`safety.respond.${r.k}`} params={{ kind: r.k, incidentId: i.id, versionId: i.versionId }} label={r.label} />)}
              <ActBtn id="safety.investigate" testId="safety.investigate.incident" params={{ incidentId: i.id, fte: 15 }} icon={ICON.investigate} label="Investigate" />
            </div>
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="saf-inc">
      <Card title={<Term id="incident">Incidents</Term>} sub={<Tip content={() => <TipCard title={<Term id="incident">Open incidents</Term>} value={String(live.length)}>Incidents not yet resolved: respond or investigate.</TipCard>}><span>{live.length} open</span></Tip>} home="incidents" id="ctl-incidents">
        {live.map(card)}
        {!live.length && <div className="row-i small"><ICON.check size={14} className="tone-pos" /> No open incidents</div>}
        {past.length > 0 && <><div className="tip-cap" style={{ marginTop: 10 }}>Closed</div>{past.map(card)}</>}
      </Card>
    </div>
  );
}
