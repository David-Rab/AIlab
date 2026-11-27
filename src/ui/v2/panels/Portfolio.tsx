// RESEARCH › Portfolio (UB-6; UI-IA §1 Portfolio, approved mockups design/ux/mockups/rd/portfolio.png, portfolio-drawer.png;
// DATA.md "RESEARCH › Portfolio"). L1: the Limited-by strip (verdict words only; numbers live in LAB), the science-team
// split (read-only: set in LAB), one board with Capability and Safety side by side in priority order, one card grammar
// (stage track, next result, rate / chance / outlook, teams, ongoing / one-off chip, output tag). L2: the card drawer
// (idea under test, expected effect with its range, rate, results so far, Gets, idea choice). L3: tooltips.
// HOME of: priority order (both columns), stage, next result, programme rate, chance it works, returns falling, outlook,
// a card's Gets. Reads beliefs, measurements and facts only (UB-2 readouts).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, GripVertical, X } from 'lucide-react';
import {
  addableProjects, capPriorityList, engine, lineRows, PROJECT_MAX_TEAMS, programmeGets, programmeRates, reAllocView, researchMods,
  safetyProgrammes, safReAllocView, STAGES, teamGain, teamsOfKey, UNLOCK_STAGES,
} from '../../../engine/v2';
import type { CapProjectView, Column, GameStateV2, LineRow, ProgrammeGets, ProgrammeRate, SafetyProgramme, StageId } from '../../../engine/v2';
import { PROJECT_BY_ID, lineNodeId, optionsOf } from '../../../data/v2/tree';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { COLUMN_LABEL } from '../../../data/v2/teams';
import { store, useV2 } from '../store';
import { ActBtn, Limit, Term, Tip, TipCard } from '../ui';
import { GoBtn, Ref } from '../kit';
import { ICON } from '../icons';
import { SPHERE } from '../theme';
import * as F from '../fmt';
import './portfolio.css';
import { AREA_LANDS, AREA_NAME, COL_ICON, dispName, fracWord, KIND_CHIP, STAGE_LABEL, STAGE_TERM, xf } from './researchWords';

const ui = (k: string, d = '') => store.tab[`research.${k}`] ?? d;
const setUi = (k: string, v: string) => store.setTab(`research.${k}`, v);
/** A yearly × at two decimals below ×2, one above. */
const xr = (v: number) => xf(v, v < 1.995 ? 2 : 1);
const dd = (d: number) => (!Number.isFinite(d) ? '—' : d < 1 ? '<1' : `~${Math.round(d)}`);
const stagesOfView = (v: CapProjectView): readonly StageId[] => (v.unlock ? UNLOCK_STAGES : STAGES);
const RISK_OPTS = [{ v: 'safe', label: 'Safe' }, { v: 'balanced', label: 'Balanced' }, { v: 'speculative', label: 'Bold' }] as const;
/** Safety output tag from the role of what the programme's next result is (VOCAB: see / stop / fix). */
const ROLE_TAG: Record<string, { tag: 'see' | 'stop' | 'fix'; what: string; term: string }> = {
  detect: { tag: 'see', what: 'instrument', term: 'technique' },
  contain: { tag: 'stop', what: 'safeguard', term: 'controlLayer' },
  fix: { tag: 'fix', what: 'method', term: 'safetyMethod' },
};
const OUTLOOK_TONE: Record<string, string> = { Promising: 'good', Mixed: 'warn', Struggling: 'bad' };

// ───────── shared card parts ─────────
interface Step { id: string; label: string; term: string; tip: ReactNode }
function Track({ steps, cur, frac, failed, big, testId }: { steps: Step[]; cur: number; frac: number; failed?: boolean; big?: boolean; testId?: string }) {
  return (
    <div className={`pf-track ${big ? 'big' : ''} ${failed ? 'failed' : ''}`} data-test={testId} data-stage={steps[cur]?.id ?? 'none'}>
      {steps.map((st, i) => (
        <Tip key={st.id} as="div" className={`pf-stg ${i < cur ? 'done' : i === cur ? 'cur' : ''}`} content={() => <TipCard title={<Term id={st.term}>{st.label}</Term>} value={i < cur ? 'done' : i === cur ? F.pct(frac) : 'later'}>{st.tip}</TipCard>}>
          <div className="bb"><i style={{ width: `${i < cur ? 100 : i === cur ? Math.round(frac * 100) : 0}%` }} /></div>
          <div className="sl">{st.label}</div>
        </Tip>
      ))}
    </div>
  );
}

function Pips({ n, want, why }: { n: number; want: number; why: () => ReactNode }) {
  const k = Math.max(n, want, 1);
  return (
    <Tip content={why}>
      <span className="pf-teams" data-test="teams">
        <span className="pips">{Array.from({ length: Math.min(6, k) }, (_, i) => <i key={i} className={i >= n ? 'w' : ''} />)}</span>
        {n ? `${n} team${n > 1 ? 's' : ''}` : <span className={want > 0 ? 'tone-warn' : ''}>no team</span>}
      </span>
    </Tip>
  );
}

// ───────── Limited by strip ─────────
type SegState = 'on' | 'mid' | 'off' | 'bad';
interface Seg { k: string; name: string; term: string; icon: typeof ICON.L; st: SegState; word: string; tip: string }
function limitSegs(s: GameStateV2): Seg[] {
  const p = s.player;
  const lim = engine.production(s, 'player').label;
  const re = reAllocView(s);
  const nRE = teamsOfKey(p, 're.cap').length;
  const nSci = teamsOfKey(p, 'sci.cap').length;
  const exp = p.split.experiments * p.computeOnline;
  const held = researchMods(s).frontierExp <= 0;
  const idleSci = capPriorityList(s).idleTeams.length;
  const reShort = re.needs.some((n) => n.short > 1e-6 && Number.isFinite(n.demand));
  const sciGain = teamGain(s, { role: 'sci', dept: 'cap', specialty: 'pretraining' }).amount;
  const compute: Seg = exp <= 0 || held
    ? { k: 'compute', name: 'Compute', term: 'computeBound', icon: ICON.compute, st: 'bad', word: held ? 'Experiments held' : 'None for experiments', tip: held ? 'Frontier work is paused: capability experiments get no compute.' : 'No compute on research experiments: no capability project can test anything.' }
    : lim === 'compute-bound' ? { k: 'compute', name: 'Compute', term: 'computeBound', icon: ICON.compute, st: 'on', word: 'Limits most', tip: 'More experiment compute would speed research up the most (your estimate).' }
    : { k: 'compute', name: 'Compute', term: 'computeBound', icon: ICON.compute, st: 'off', word: 'Not limiting', tip: 'Experiments have more compute than the people can use well.' };
  const reSeg: Seg = nRE === 0
    ? { k: 're', name: 'Research engineers', term: 'laborBound', icon: ICON.roleRE, st: 'bad', word: 'None', tip: 'No research-engineer teams: experiments cannot run.' }
    : lim === 'labor-bound' || lim === 'human-bound' ? { k: 're', name: 'Research engineers', term: 'laborBound', icon: ICON.roleRE, st: 'on', word: 'Limits most', tip: 'More research engineers (people or AI staff) would speed research up the most (your estimate).' }
    : reShort ? { k: 're', name: 'Research engineers', term: 'laborBound', icon: ICON.roleRE, st: 'mid', word: 'Short', tip: 'Some research-engineer needs get less than they ask; see LAB.' }
    : re.idle >= 0.5 ? { k: 're', name: 'Research engineers', term: 'laborBound', icon: ICON.roleRE, st: 'off', word: 'Spare teams', tip: 'Some research-engineer teams have no experiment to run (at most two per programme).' }
    : { k: 're', name: 'Research engineers', term: 'laborBound', icon: ICON.roleRE, st: 'off', word: 'Enough', tip: 'Every need gets its research engineers.' };
  const sci: Seg = nSci === 0
    ? { k: 'sci', name: 'Scientists', term: 'humanBound', icon: ICON.roleSci, st: 'bad', word: 'None', tip: 'No capability science teams: no new ideas.' }
    : idleSci > 0 ? { k: 'sci', name: 'Scientists', term: 'humanBound', icon: ICON.roleSci, st: 'off', word: 'Spare teams', tip: `${idleSci} science team${idleSci > 1 ? 's have' : ' has'} no programme: add a project or raise teams wanted.` }
    : sciGain > 0 ? { k: 'sci', name: 'Scientists', term: 'humanBound', icon: ICON.roleSci, st: 'mid', word: 'More would help', tip: 'A programme waits for ideas: one more science team would bring its next result sooner.' }
    : { k: 'sci', name: 'Scientists', term: 'humanBound', icon: ICON.roleSci, st: 'off', word: 'Enough', tip: 'No programme waits for ideas.' };
  const taste: Seg = lim === 'taste-bound'
    ? { k: 'taste', name: 'Idea quality', term: 'tasteBound', icon: ICON.taste, st: 'on', word: 'Limits most', tip: 'Better research taste (stronger scientists or AI staff on ideas) would help most.' }
    : { k: 'taste', name: 'Idea quality', term: 'tasteBound', icon: ICON.taste, st: 'off', word: 'Not limiting', tip: 'Experiments, not the ideas, set the pace.' };
  return [compute, reSeg, sci, taste];
}

function LimitedBy({ s }: { s: GameStateV2 }) {
  const segs = useMemo(() => limitSegs(s), [s, s.time.day, JSON.stringify(s.player.split), s.player.teams.length]);
  return (
    <section className="pf-lim card2" data-home="limitedBy">
      <div className="lh">
        <span className="ttl"><ICON.M size={16} /><Term id="bottleneck">Limited by</Term></span>
        <span className="dim small">what would speed research most</span>
      </div>
      {segs.map((g) => (
        <Tip key={g.k} as="div" className={`seg ${g.st}`} content={() => <TipCard title={<Term id={g.term}>{g.name}</Term>} value={g.word} footer={g.st === 'on' || g.st === 'bad' ? 'The numbers and the moves are on LAB.' : undefined}>{g.tip}</TipCard>}>
          <span className="si" data-lim={g.k} data-state={g.st}><g.icon size={17} /></span>
          <span className="tx"><span className="nm">{g.name}</span><span className="vd">{g.word}</span></span>
          {(g.st === 'on' || g.st === 'bad') && <span className="go"><GoBtn to={{ panel: 'lab', anchor: 'bestMoves' }} label="best move" testId={`lim.${g.k}`} /></span>}
        </Tip>
      ))}
    </section>
  );
}

/** The science-team split, read-only (set in LAB, OQ-2). */
function SciSplit({ s }: { s: GameStateV2 }) {
  const cap = teamsOfKey(s.player, 'sci.cap').length;
  const saf = teamsOfKey(s.player, 'sci.saf').length;
  return (
    <div className="pf-sbar" data-test="sci-split-ro">
      <Tip content={() => <TipCard title={<Term id="roleSci">Science teams</Term>} value={`${cap} | ${saf}`} rows={[{ label: 'Capability', value: `${cap} teams` }, { label: 'Safety', value: `${saf} teams` }]}>Set in LAB (how many teams each side keeps hiring). Research places them on the programmes below in priority order.</TipCard>}>
        <span className="row-i"><span className="dim small"><Term id="roleSci">Science teams</Term></span><b style={{ color: SPHERE.cap }}>Capability <span className="num">{cap}</span></b></span>
      </Tip>
      <div className="b"><div style={{ flex: `${Math.max(cap, 0.01)} 0 0`, background: SPHERE.cap }} /><div style={{ flex: `${Math.max(saf, 0.01)} 0 0`, background: SPHERE.saf }} /></div>
      <Tip content={() => <TipCard title="Safety science teams" value={`${saf} teams`}>Set in LAB; placed on safety programmes in priority order.</TipCard>}>
        <b style={{ color: SPHERE.saf }}><span className="num">{saf}</span> Safety</b>
      </Tip>
      <Ref id="sciSplit" to={{ panel: 'lab', anchor: 'sciSplit' }}>scientists</Ref>
    </div>
  );
}

// ───────── capability card ─────────
function capSteps(v: CapProjectView): Step[] {
  return stagesOfView(v).map((st) => ({
    id: st, label: STAGE_LABEL[st], term: STAGE_TERM[st],
    tip: st === 'test' ? `One test: when its work is done it works or it does not (chance ${F.pct(v.odds)}).`
      : st === 'ideation' ? `Scientists find ideas; the team tests one once it has ${v.pickAt} (found ${v.cands}).`
      : st === 'small' ? 'Research engineers test the idea at small scale with experiment compute.'
      : st === 'scale' ? 'The idea is tested at scale: effects can grow, hold or shrink.'
      : v.adoption ? `Engineers build it into your recipe: ${F.num(v.adoption.tw, 1)} team-weeks left.` : 'Engineers build the result into your recipe.',
  }));
}

function NextResult({ v, rate }: { v: CapProjectView; rate?: ProgrammeRate }) {
  const text = v.state === 'adopting' ? <>build-in <b className="num">{dd(v.adoption?.eta ?? Infinity)} d</b></>
    : v.want === 0 && !v.teams.length && v.stage === 'ideation' ? <span className="dim">paused · 0 teams wanted</span>
    : !v.teams.length && v.stage === 'ideation' ? <span className="dim">waits for a team</span>
    : v.state === 'waiting' && v.wait ? <span className="tone-warn">{v.wait}</span>
    : !Number.isFinite(v.eta) ? <span className="tone-warn">stalled</span>
    : <>{v.kind === 'line' ? 'next result' : 'result'} <b className="num">{dd(v.eta)} d</b></>;
  return (
    <Tip content={() => <TipCard title={v.kind === 'line' ? 'Next result' : 'Result'} value={Number.isFinite(v.eta) ? F.days(v.eta) : '—'} rows={[
      ...(v.unlock ? [{ label: <Term id="stageTest">Test</Term>, value: F.days(v.etaParts.experiments) }] : [
        { label: <Term id="stageIdeation">Ideas</Term>, value: Number.isFinite(v.etaParts.ideation) ? F.days(v.etaParts.ideation) : '—' },
        { label: <Term id="stageSmall">Small and big tests</Term>, value: Number.isFinite(v.etaParts.experiments) ? F.days(v.etaParts.experiments) : '—' }]),
      ...(rate ? [{ label: 'Next result, best guess', value: <span>{xf(rate.next.x)} {rate.area?.toLowerCase()} <span className="dim">({xf(rate.next.range[0])}–{xf(rate.next.range[1])}, {rate.next.certainty.word})</span></span> }] : []),
    ]}>At today&apos;s teams, research engineers and compute (your estimate). A dropped idea restarts the ideas step.</TipCard>}>
      <span className="pf-eta" data-test={`next.${v.id}`}>{text}</span>
    </Tip>
  );
}

/** Programme: rate at current staffing (≈ × / yr on its area). Project: expected effect where it lands. */
function Effect({ v, rate }: { v: CapProjectView; rate?: ProgrammeRate }) {
  if (rate && v.stack && !(rate.perYear > 0)) return <span className="pf-eff dim" data-test={`rate.${v.id}`}>no results a year without a team · {AREA_LANDS[v.stack]}</span>;
  if (rate && v.stack) {
    const st = v.stack;
    return (
      <Tip content={() => <TipCard title={<Term id="programmeRate">Rate</Term>} value={`≈ ${xr(rate.xPerYear)} / yr`} rows={[
        { label: 'Results a year at today\'s staffing', value: F.num(rate.perYear, 1) },
        { label: 'One result takes', value: F.days(rate.cycleDays) },
        { label: 'Each result, best guess', value: `${xf(rate.next.x)} (${xf(rate.next.range[0])}–${xf(rate.next.range[1])})` },
        { label: 'Certainty', value: rate.next.certainty.word },
        { label: 'So far', value: `${F.num(rate.soFar.perYear, 1)} results a year · ≈ ${xr(rate.soFar.xPerYear)} / yr` },
      ]}>{`What this programme adds to the ${AREA_NAME[st].toLowerCase()} in a year at today's teams and compute (your estimate). It lands in the ${AREA_LANDS[st]}.`}</TipCard>}>
        <span className="pf-eff" data-test={`rate.${v.id}`}>≈ <b className="num">{xr(rate.xPerYear)}</b> / yr <span className="u">{AREA_NAME[v.stack].toLowerCase()}</span> <span className="dim">· {AREA_LANDS[v.stack]}</span></span>
      </Tip>
    );
  }
  if (v.unlock) {
    const opts = optionsOf(v.id);
    return (
      <Tip content={() => <TipCard title="Unlocks" rows={opts.map(([slot, val]) => ({ label: slot, value: F.words(val) }))}>When it works, engineers build it in and the option opens on the Next run or Products.</TipCard>}>
        <span className="pf-eff">unlocks <b>{dispName(PROJECT_BY_ID[v.id]?.name ?? v.name)}</b></span>
      </Tip>
    );
  }
  const b = v.belief ? { mu: v.belief.mu, sd: v.belief.sd } : v.result ? { mu: v.result.est, sd: v.result.estSd } : undefined;
  if (!b) return <span className="pf-eff dim">expected effect after its first test</span>;
  const x = (o: number) => (v.unit === 'design' ? o : Math.pow(10, o));
  return (
    <Tip content={() => <TipCard title={<Term id="beliefBand">Expected effect</Term>} value={xf(x(b.mu))} rows={[{ label: 'Likely range', value: `${xf(x(b.mu - 1.64 * b.sd))}–${xf(x(b.mu + 1.64 * b.sd))}` }]}>{v.unit === 'design' ? 'As × of the designed effect on its domains.' : 'Best guess and its likely range (9 in 10).'}</TipCard>}>
      <span className="pf-eff"><b className="num">{xf(x(b.mu))}</b> <span className="u">{v.stack ? AREA_NAME[v.stack].toLowerCase() : v.unit === 'design' ? 'domain effect' : v.area}</span>{v.stack && <span className="dim"> · {AREA_LANDS[v.stack]}</span>}</span>
    </Tip>
  );
}

function capTeamsTip(v: CapProjectView) {
  return () => (
    <TipCard title={<Term id="teamsWanted">Teams</Term>} value={`${v.teams.length} of ${v.want} wanted${v.auto ? ' (auto)' : ''}`} rows={v.teams.map((t, i) => ({ label: `${t.specialty ? COLUMN_LABEL[t.specialty as Column] : 'Science'} team ${i + 1}`, value: t.match ? 'right field' : '' }))}>
      {v.teams.length < v.want ? 'Higher-priority programmes took the free teams. ' : ''}The game places science teams down the list; change teams wanted in the card.
    </TipCard>
  );
}

function CapCard({ v, rate, rank, q, capQ }: { v: CapProjectView; rate?: ProgrammeRate; rank: number; q: string[]; capQ: string[] }) {
  const Ic = COL_ICON[v.column as Column] ?? ICON.research;
  const steps = capSteps(v);
  const failed = v.state === 'failed';
  const sel = ui('drawer') === v.id;
  const i = capQ.indexOf(v.id);
  const move = (d: number) => { const target = capQ[i + d]; if (target) store.act('research.move', { id: v.id, to: q.indexOf(target) }); };
  return (
    <div className={`pf-card s-cap ${sel ? 'sel' : ''} ${failed ? 'failed' : ''}`} data-card={v.id} data-project={v.id} draggable={!failed} tabIndex={0}
      aria-label={`${dispName(v.name)}. Enter opens its card; Alt+Up or Alt+Down moves it.`}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', v.id); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain'); if (from && from !== v.id && q.includes(from) && capQ.includes(from)) store.act('research.move', { id: from, to: q.indexOf(v.id) }); }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter') { e.preventDefault(); setUi('drawer', v.id); }
        else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); move(e.key === 'ArrowUp' ? -1 : 1); }
      }}
      onClick={() => setUi('drawer', sel ? '' : v.id)}>
      <div className="r1">
        {!failed && <span className="grip"><GripVertical size={13} /></span>}
        <Tip content={() => <TipCard title={<Term id="projectQueue">Priority</Term>} value={failed ? 'off the list' : `#${rank}`}>Teams, research engineers and compute go down the list. Drag a card, or Alt+↑ / Alt+↓ on a focused card, to reorder.</TipCard>}><span className="pr num">{failed ? '' : rank}</span></Tip>
        <Ic size={14} className="dim" />
        <span className="nm">{dispName(v.name)}</span>
        <Tip content={() => <TipCard title={<Term id="projectKind">{v.kind === 'line' ? 'Programme' : 'Project'}</Term>} value={KIND_CHIP[v.kind]}>{v.kind === 'line' ? 'Ongoing: it keeps producing results, each smaller than the last.' : 'One-off: it works or it does not.'}</TipCard>}><span className="kind">{KIND_CHIP[v.kind]}</span></Tip>
        <span className="fld">{v.area}</span>
        <span className="sp" />
        {v.line && !failed && v.line.gen === 0 && <span className="retp dim">no results yet</span>}
        {v.line && !failed && v.line.gen > 0 && (
          <Tip content={() => <TipCard title={<Term id="linePool">Returns falling</Term>} value={`~${fracWord(1 / Math.max(1, v.line!.harder))} of the first`} rows={[{ label: 'Results so far', value: String(v.line!.gen) }]}>Each result of a programme is smaller than the last: the next one is expected at about this share of the first.</TipCard>}>
            <span className="retp dim">results now <b>~{fracWord(1 / Math.max(1, v.line.harder))}</b> of the first</span>
          </Tip>
        )}
        {v.kind !== 'line' && !failed && (
          <Tip content={() => <TipCard title={<Term id="odds">Chance it works</Term>} value={F.pct(v.odds)} rows={[{ label: 'Ideas dropped', value: `${v.drops} of ${v.maxDrops}` }, { label: 'Retries', value: String(v.spec) }]}>Your current odds, from attempts so far.</TipCard>}>
            <span className="retp dim">chance it works <b>{F.pct(v.odds)}</b></span>
          </Tip>
        )}
        <Pips n={v.teams.length} want={v.want} why={capTeamsTip(v)} />
      </div>
      {failed ? (
        <div className="r2">
          <Tip content={() => <TipCard title={<Term id="reopenSpeculative">Failed</Term>} rows={[{ label: 'Ideas dropped', value: String(v.maxDrops) }, { label: 'Chance if retried', value: F.pct(v.odds) }]}>Retry: the chance halves, the expected effect falls and its range widens.</TipCard>}>
            <span className="pf-fail"><ICON.alert size={12} /> Failed</span>
          </Tip>
          <Tip content={() => <TipCard title={<Term id="odds">Chance it works on retry</Term>} value={F.pct(v.odds)}>Weak results can be bad luck.</TipCard>}>
            <span className="small">{v.unlock ? 'Failed in test' : `${v.maxDrops} ideas dropped`} · retry at lower odds: <Term id="odds">chance it works</Term> <b className="num">{F.pct(v.odds)}</b></span>
          </Tip>
          <span className="sp" />
          <span onClick={(e) => e.stopPropagation()}><ActBtn id="research.reopen" params={{ id: v.id }} label="Retry" testId={`reopen.${v.id}`} /></span>
        </div>
      ) : (
        <div className="r2">
          <Track steps={steps} cur={Math.max(0, steps.findIndex((x) => x.id === v.stage))} frac={v.state === 'adopting' ? 1 : v.stageFrac} testId={`track.${v.id}`} />
          <NextResult v={v} rate={rate} />
          <Effect v={v} rate={rate} />
        </div>
      )}
    </div>
  );
}

// ───────── safety card ─────────
const SAF_STEPS: Step[] = [
  { id: 'Ideas', label: 'Ideas', term: 'stageIdeation', tip: 'Safety scientists work out what to try.' },
  { id: 'Small test', label: 'Small test', term: 'stageSmall', tip: 'Research engineers test it on small models.' },
  { id: 'Validate', label: 'Validate', term: 'validation', tip: 'The result is checked on a test copy with a known trait planted.' },
];
interface SafCardData { p: SafetyProgramme; r?: LineRow; tag?: (typeof ROLE_TAG)[string]; nextName?: string; limited: boolean }
function safCards(s: GameStateV2): SafCardData[] {
  const rows = new Map(lineRows(s).map((r) => [r.id, r]));
  const saf = safReAllocView(s);
  const expShort = saf.needs.some((n) => n.k === 'safExp' && n.short > 1e-6 && Number.isFinite(n.demand));
  return safetyProgrammes(s).map((p) => {
    const r = rows.get(p.id);
    const node = r?.next ? PROJECT_BY_ID[r.next] : undefined;
    const tech = node?.technique ? TECHNIQUE_BY_ID[node.technique] : undefined;
    return { p, r, ...(tech ? { tag: ROLE_TAG[tech.role] } : {}), ...(node ? { nextName: dispName(node.name) } : {}), limited: p.staffed && expShort };
  });
}

function SafCard({ c, rank, q }: { c: SafCardData; rank: number; q: string[] }) {
  const { p, r } = c;
  const nodeId = lineNodeId(p.id);
  const Ic = r ? COL_ICON[r.column as Column] ?? ICON.safety : ICON.safety;
  const sel = ui('drawer') === nodeId;
  const cur = SAF_STEPS.findIndex((x) => x.id === p.stage);
  return (
    <div className={`pf-card s-saf ${sel ? 'sel' : ''} ${p.staffed ? '' : 'dimc'}`} data-card={nodeId} data-line={p.id} draggable tabIndex={0}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', nodeId); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData('text/plain');
        if (!from || from === nodeId || !from.startsWith('line:')) return;
        const at = q.indexOf(nodeId);
        if (q.includes(from) && at >= 0) store.act('research.move', { id: from, to: at });
        else store.act('research.queue', at >= 0 ? { id: from, at } : { id: from });
      }}
      onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === 'Enter') { e.preventDefault(); setUi('drawer', nodeId); } }}
      onClick={() => setUi('drawer', sel ? '' : nodeId)}>
      <div className="r1">
        <span className="grip"><GripVertical size={13} /></span>
        <Tip content={() => <TipCard title={<Term id="projectQueue">Priority</Term>} value={`#${rank}`}>{p.why === 'your order' ? 'Your order: drag to change.' : p.why === 'staffed' ? 'Staffed, not yet ordered by you: drag to set its place.' : 'No team: ordered by outlook. Drag it up to give it the next free safety team.'}</TipCard>}><span className="pr num">{rank}</span></Tip>
        <Ic size={14} className="dim" />
        <span className="nm">{dispName(p.name)}</span>
        <Tip content={() => <TipCard title={<Term id="projectKind">Programme</Term>} value="ongoing">Ongoing: each result is a working tool, a weaker result, a dead end or a discovery.</TipCard>}><span className="kind">ongoing</span></Tip>
        {c.tag && <Tip content={() => <TipCard title={<Term id="outputTag">{c.tag!.tag}</Term>} value={`new ${c.tag!.what}`}>{c.tag!.tag === 'see' ? 'Its next result helps you see what a model is like (an instrument).' : c.tag!.tag === 'stop' ? 'Its next result helps stop a model acting badly (a safeguard).' : 'Its next result changes the model itself (a training method).'}</TipCard>}><span className={`otag ${c.tag.tag}`}>{c.tag.tag}</span></Tip>}
        <span className="fld">{r ? COLUMN_LABEL[r.column as Column] ?? '' : ''}</span>
        <span className="sp" />
        {c.limited && <Tip content={() => <TipCard title="Limited by research engineers">Safety research experiments get fewer safety research engineers than they need; see LAB.</TipCard>}><span className="plim"><ICON.alert size={12} /> limited by research engineers</span></Tip>}
        <Pips n={p.teams} want={p.staffed ? p.teams : 1} why={() => <TipCard title="Safety science teams" value={`${p.teams}`}>{p.staffed ? 'Teams on this programme now.' : 'No team: higher-priority programmes took them. Drag it up, or hire safety scientists in LAB.'}</TipCard>} />
      </div>
      <div className="r2">
        <Track steps={SAF_STEPS} cur={cur} frac={p.stageFrac ?? 0} testId={`track.${nodeId}`} />
        <Tip content={() => <TipCard title="Next result" value={p.nextDays !== undefined && Number.isFinite(p.nextDays) ? F.days(p.nextDays) : '—'} rows={[{ label: <Term id="safetyResults">Results a year</Term>, value: F.num(p.resultsPerYear, 1) }, { label: 'Share of safety compute', value: F.pct(p.computeShare) }]}>At today&apos;s teams, safety research engineers and compute (your estimate).</TipCard>}>
          <span className="pf-eta">{p.staffed && p.nextDays !== undefined && Number.isFinite(p.nextDays) ? <>next result <b className="num">{dd(p.nextDays)} d</b></> : <span className="dim">waits for a team</span>}</span>
        </Tip>
        <span className="pf-eff">{c.nextName ? <>new <Term id={c.tag?.term ?? 'technique'}>{c.tag?.what ?? 'result'}</Term>: <b>{c.nextName}</b></> : <span className="dim">every idea known: follow-up results</span>}</span>
        <Tip content={() => <TipCard title={<Term id="lineHealth">Outlook</Term>} value={p.outlook} rows={r ? [{ label: 'Chance a result works, best guess', value: F.pct(r.band.mean) }, { label: 'Likely range', value: `${F.pct(r.band.lo)}–${F.pct(r.band.hi)}` }] : []}>From its results so far; the truth differs by world.</TipCard>}>
          <span className="pf-odds"><span className="dim">outlook</span> <span className={`olk ${OUTLOOK_TONE[p.outlook] ?? ''}`}>{p.outlook}</span></span>
        </Tip>
      </div>
    </div>
  );
}

// ───────── columns ─────────
function CapColumn({ s }: { s: GameStateV2 }) {
  const pl = capPriorityList(s);
  const rates = useMemo(() => new Map(programmeRates(s, pl.list).map((r) => [r.id, r])), [s, s.time.day, s.player.research.queue.join(','), s.player.teams.length]);
  const q = s.player.research.queue;
  const capQ = pl.list.map((x) => x.id);
  const nTeams = teamsOfKey(s.player, 'sci.cap').length;
  const progs = pl.list.filter((v) => v.kind === 'line').length;
  return (
    <div className="pf-col" data-home="priorities">
      <div className="ch">
        <span className="tt" style={{ color: SPHERE.cap }}><ICON.capabilities size={17} /> Capability</span>
        <Tip content={() => <TipCard title="Capability research" rows={[{ label: 'Science teams', value: String(nTeams) }, { label: 'Programmes', value: String(progs) }, { label: 'Projects', value: String(pl.list.length - progs) }, { label: 'Idle teams', value: String(pl.idleTeams.length) }]}>Teams go down this list in order.</TipCard>}>
          <span className="st">{nTeams} teams · {progs} programme{progs === 1 ? '' : 's'}{pl.list.length > progs ? ` · ${pl.list.length - progs} project${pl.list.length - progs === 1 ? '' : 's'}` : ''}</span>
        </Tip>
        <span className="sp" /><span className="dim small">priority order · drag to change</span>
      </div>
      {researchMods(s).frontierExp <= 0 && <div className="pf-note tone-warn small" data-test="exp-held">Experiments held: frontier work is paused, so capability projects get no experiment compute.</div>}
      {pl.list.length === 0 && <div className="dim small pf-note">No capability programmes. Add one with Add project, or from Discoveries.</div>}
      {pl.list.map((v, i) => <CapCard key={v.id} v={v} rate={rates.get(v.id)} rank={i + 1} q={q} capQ={capQ} />)}
      {pl.failed.map((v) => <CapCard key={v.id} v={v} rank={0} q={q} capQ={capQ} />)}
      {pl.idleTeams.length > 0 && (
        <Tip content={() => <TipCard title="Idle science teams" value={String(pl.idleTeams.length)}>{pl.idleTeams[0].why}</TipCard>}>
          <div className="pf-note tone-warn small" data-test="idle-teams"><ICON.alert size={12} /> {pl.idleTeams.length} team{pl.idleTeams.length > 1 ? 's' : ''} idle: {pl.idleTeams[0].why.replace(/^Idle: /, '')}</div>
        </Tip>
      )}
    </div>
  );
}

const SAF_SHOWN = 4;
function SafColumn({ s }: { s: GameStateV2 }) {
  const cards = useMemo(() => safCards(s), [s, s.time.day, s.player.research.queue.join(','), s.player.teams.length]);
  const [open, setOpen] = useState(false);
  const q = s.player.research.queue;
  const nTeams = teamsOfKey(s.player, 'sci.saf').length;
  const staffed = cards.filter((c) => c.p.staffed).length;
  const shownN = Math.max(SAF_SHOWN, staffed);
  const shown = open ? cards : cards.slice(0, shownN);
  const rest = cards.slice(shownN);
  const count = (o: string) => rest.filter((c) => c.p.outlook === o).length;
  return (
    <div className="pf-col" data-home="safetyProgrammes">
      <div className="ch">
        <span className="tt" style={{ color: SPHERE.saf }}><ICON.safety size={17} /> Safety</span>
        <Tip content={() => <TipCard title="Safety research" rows={[{ label: 'Safety science teams', value: String(nTeams) }, { label: 'Programmes staffed', value: `${staffed} of ${cards.length}` }]}>Staffed programmes first, in your order; then the rest by outlook.</TipCard>}>
          <span className="st">{nTeams} teams · {staffed} of {cards.length} programmes staffed</span>
        </Tip>
        <span className="sp" /><Ref id="instruments" to={{ panel: 'safety' }}>Safety</Ref>
      </div>
      {shown.map((c, i) => <SafCard key={c.p.id} c={c} rank={i + 1} q={q} />)}
      {rest.length > 0 && (
        <button className="pf-more" data-test="saf-more" onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {open ? 'Show fewer' : <>{rest.length} more programmes, no team <span className="dim">·</span>{(['Promising', 'Mixed', 'Struggling'] as const).filter((o) => count(o) > 0).map((o) => <span key={o} className="row-i"><span className={`olk ${OUTLOOK_TONE[o]}`}>{o}</span><span className="num">{count(o)}</span></span>)}</>}
        </button>
      )}
    </div>
  );
}

// ───────── drawer (L2) ─────────
function RangeStrip({ x, lo, hi }: { x: number; lo: number; hi: number }) {
  const pad = Math.max(0.002, (hi - lo) * 0.25);
  const a = Math.max(0, lo - pad);
  const b = Math.max(hi, x) + pad;
  const W = 560;
  const X = (v: number) => 40 + ((v - a) / (b - a)) * (W - 80);
  const ticks = Array.from({ length: 5 }, (_, i) => a + ((b - a) * i) / 4);
  return (
    <svg width={W} height={58} className="pf-range" data-test="range-strip">
      <line x1={40} y1={30} x2={W - 40} y2={30} stroke="#33435a" strokeWidth={2} />
      {ticks.map((t, i) => <g key={i}><line x1={X(t)} y1={26} x2={X(t)} y2={34} stroke="#4a5b72" /><text x={X(t)} y={52} fill="#6b7c91" fontSize={11} textAnchor="middle" fontFamily="var(--mono)">{xf(t, 3)}</text></g>)}
      <rect x={X(lo)} y={21} width={Math.max(2, X(hi) - X(lo))} height={18} rx={5} fill="rgba(155,107,224,.28)" stroke="#9b6be0" />
      <line x1={X(x)} y1={15} x2={X(x)} y2={45} stroke="#fff" strokeWidth={2.5} />
      <text x={Math.min(W - 120, X(x) + 7)} y={13} fill="#fff" fontSize={12.5} fontWeight={650}>{xf(x)} best guess</text>
      <text x={X(lo)} y={13} fill="#9fb0c3" fontSize={11.5}>likely</text>
    </svg>
  );
}

function ideaWords(v: CapProjectView, g?: ProgrammeGets): string {
  if (!g?.idea) return v.state === 'waiting' ? 'No idea under test: the team is finding ideas.' : 'No idea under test yet.';
  const pct = (g.idea.x - 1) * 100;
  const size = pct < 1 ? 'A small' : pct < 3 ? 'A mid-sized' : 'A large';
  const scale = g.idea.testedAtScale ? 'It has been tested at scale' : 'It has not been tried at scale yet';
  const how = g.idea.atScale === 'shrinks' ? 'and may shrink there' : g.idea.atScale === 'grows' ? 'and may grow there' : 'and should hold there';
  return `${size} change to the ${v.stack ? AREA_NAME[v.stack].toLowerCase() : 'recipe'}. ${scale}, ${how}.`;
}

function CapDrawer({ s, v }: { s: GameStateV2; v: CapProjectView }) {
  const pl = capPriorityList(s);
  const rate = programmeRates(s, pl.list).find((r) => r.id === v.id);
  const g = programmeGets(s, pl.list).find((x) => x.id === v.id);
  const steps = capSteps(v);
  const risk = s.player.research.risk ?? 'balanced';
  const Ic = COL_ICON[v.column as Column] ?? ICON.research;
  const lim = engine.production(s, 'player').label;
  const labLim = lim === 'compute-bound' ? 'compute' : lim === 'taste-bound' ? 'idea quality' : 'research engineers';
  const myLim = v.bound === 'compute' ? 'compute' : v.bound === 'labour' ? 'research engineers' : undefined;
  const first = v.line ? 1 : 0;
  const nextShare = v.line ? 1 / Math.max(1, v.line.harder) : 0;
  // Believed: Σ the estimates of this programme's kept results (the last 30 results of the lab are kept).
  const kept = (s.player.research.adopted ?? []).filter((a) => a.id === v.id);
  const builtX = Math.pow(10, kept.reduce((a, x) => a + x.est, 0));
  return (
    <>
      <div className="pf-dh">
        <Ic size={18} className="dim" /><h2 data-test="drawer-title">{dispName(v.name)}</h2><span className="sp" />
        <button className="btn btn-sm btn-ghost" data-test="drawer-close" aria-label="Close" onClick={() => setUi('drawer', '')}><X size={16} /></button>
      </div>
      <div className="row-i pf-chips">
        <span className="kind">{KIND_CHIP[v.kind]}</span><span className="otag capability">capability</span>
        <span className="dim">{v.area}{v.rank ? ` · priority ${v.rank}` : ''}</span>
      </div>
      {v.state === 'failed' ? (
        <div className="pf-sec"><span className="tone-neg">{v.unlock ? 'The test showed it does not work on this attempt.' : `The team gave up after ${v.maxDrops} weak ideas; weak results can be bad luck.`}</span>
          <Tip content={() => <TipCard title={<Term id="odds">Chance it works on retry</Term>} value={F.pct(v.odds)} />}><span>Retry works with chance <b className="num">{F.pct(v.odds)}</b></span></Tip>
          <ActBtn id="research.reopen" params={{ id: v.id }} label="Retry (lower odds)" testId={`drawer-reopen.${v.id}`} />
        </div>
      ) : (
        <div className="pf-sec row-i" style={{ alignItems: 'flex-end', gap: 16 }}>
          <Track steps={steps} cur={Math.max(0, steps.findIndex((x) => x.id === v.stage))} frac={v.state === 'adopting' ? 1 : v.stageFrac} big testId={`drawer-track.${v.id}`} />
          <NextResult v={v} rate={rate} />
        </div>
      )}
      {v.kind !== 'line' || v.stack ? (
        <div className="pf-sec">
          <div className="cap">The idea under test</div>
          <div className="pf-lead">{v.unlock ? 'A one-off test: it works or it does not.' : ideaWords(v, g)}</div>
          <div className="pf-kv">
            {g?.idea && (
              <>
                <span className="k"><Term id="beliefBand">Expected effect</Term></span>
                <Tip content={() => <TipCard title="Expected effect" value={xf(g.idea!.x)} rows={[{ label: 'Likely range (9 in 10)', value: `${xf(g.idea!.range[0])}–${xf(g.idea!.range[1])}` }, { label: 'Certainty', value: g.idea!.certainty.word }]}>{`On the ${v.stack ? AREA_NAME[v.stack].toLowerCase() : 'area'}, in the ${v.stack ? AREA_LANDS[v.stack] : 'next model'}.`}</TipCard>}>
                  <span>{v.stack ? AREA_LANDS[v.stack] : ''} <b className="num">{xf(g.idea.x)}</b> <span className="dim num">({xf(g.idea.range[0])}–{xf(g.idea.range[1])})</span> · {g.idea.certainty.word}</span>
                </Tip>
              </>
            )}
          </div>
          {g?.idea && <RangeStrip x={g.idea.x} lo={g.idea.range[0]} hi={g.idea.range[1]} />}
          <div className="pf-kv">
            {rate && v.stack && (
              <>
                <span className="k"><Term id="programmeRate">Rate</Term></span>
                <Tip content={() => <TipCard title="Rate" value={`≈ ${xr(rate.xPerYear)} / yr`} rows={[{ label: 'Results a year', value: F.num(rate.perYear, 1) }, { label: 'One result takes', value: F.days(rate.cycleDays) }]}>At today&apos;s staffing (your estimate).</TipCard>}>
                  <span>≈ <b className="num">{xr(rate.xPerYear)}</b> / yr {AREA_NAME[v.stack].toLowerCase()} <span className="dim small">at today&apos;s staffing: ~{F.num(rate.perYear, 1)} results a year</span></span>
                </Tip>
              </>
            )}
            {g?.idea && (
              <>
                <span className="k"><Term id="scaleBehaviour">At scale</Term></span>
                <Tip content={() => <TipCard title="At scale" value={g.idea!.atScale} rows={[{ label: 'Tested at scale', value: g.idea!.testedAtScale ? 'yes' : 'not yet' }]}>Whether the effect grows, holds or shrinks from a small test to a full run.</TipCard>}>
                  <span><span className={`chip2 ${g.idea.atScale === 'shrinks' ? 'warn' : g.idea.atScale === 'grows' ? 'good' : ''}`}>{g.idea.atScale}</span></span>
                </Tip>
              </>
            )}
            {v.stack && (
              <>
                <span className="k"><Term id="layer">Takes effect</Term></span>
                <span>{AREA_LANDS[v.stack]} {v.stack === 'pre' || v.stack === 'rlMid' || v.stack === 'rlCeil' ? <Ref id="nextRun" to={{ panel: 'blueprint' }}>next run</Ref> : null}</span>
              </>
            )}
          </div>
        </div>
      ) : null}
      {v.line && (
        <div className="pf-sec">
          <div className="cap">Results so far</div>
          <div className="row-i" style={{ gap: 22 }}>
            <Tip content={() => <TipCard title={<Term id="linePool">Returns falling</Term>} value={`~${fracWord(nextShare)} of the first`}>The next result against the programme&apos;s first, from the research it has had so far.</TipCard>}>
              <svg width={250} height={70} data-test="returns-bars">
                <rect x={0} y={10} width={56} height={44} rx={3} fill="#9b6be0" opacity={first} /><text x={28} y={66} fill="#9fb0c3" fontSize={11} textAnchor="middle">first</text>
                <rect x={72} y={10 + 44 * (1 - nextShare)} width={56} height={44 * nextShare} rx={3} fill="#7a52b8" /><text x={100} y={66} fill="#9fb0c3" fontSize={11} textAnchor="middle">next</text>
                <text x={146} y={30} fill="#fff" fontSize={18} fontWeight={650}>~{fracWord(nextShare)}</text>
                <text x={146} y={48} fill="#9fb0c3" fontSize={11.5}>the size of the first</text>
              </svg>
            </Tip>
            <div className="pf-kv" style={{ flex: 1 }}>
              <span className="k">Built in</span>
              <Tip content={() => <TipCard title="Built in" rows={[{ label: 'Results', value: String(v.line!.gen) }, { label: 'Waiting to be built in', value: String(v.line!.pending) }, ...(kept.length ? [{ label: `Your estimate, last ${kept.length} result${kept.length === 1 ? '' : 's'}`, value: xf(builtX) }] : [])]}>Your estimate of what they added (believed until a model trained with them is measured).</TipCard>}>
                <span><b className="num">{v.line.gen}</b> results{v.stack && kept.length ? <> · <b className="num">{xf(builtX)}</b> {AREA_NAME[v.stack].toLowerCase()}{kept.length < v.line.gen ? <span className="dim small"> (last {kept.length})</span> : null}</> : null}</span>
              </Tip>
              <span className="k">Dropped</span>
              <Tip content={() => <TipCard title="Dropped ideas" value={String(v.drops)}>Ideas that tested weak and were dropped.</TipCard>}><span><b className="num">{v.drops}</b> ideas</span></Tip>
              <span className="k">Waiting to test</span>
              <Tip content={() => <TipCard title="Ideas found" value={String(g?.waitingIdeas ?? v.cands)}>{`Ideas the team has found; it tests one once it has ${v.pickAt}.`}</TipCard>}><span><b className="num">{g?.waitingIdeas ?? v.cands}</b> ideas</span></Tip>
            </div>
          </div>
        </div>
      )}
      {v.state !== 'failed' && (
        <div className="pf-sec">
          <div className="cap">Gets</div>
          <div className="pf-kv">
            <span className="k"><Term id="roleSci">Science</Term></span>
            <span className="row-i">
              <Tip content={capTeamsTip(v)}><span><b className="num">{v.teams.length}</b> team{v.teams.length === 1 ? '' : 's'}{v.teams[0]?.specialty ? ` · ${COLUMN_LABEL[v.teams[0].specialty as Column]}` : ''}</span></Tip>
              {v.teams.some((t) => t.match) && <Tip content={() => <TipCard title={<Term id="specialtyBonus">Right field</Term>}>A team in its own field works faster on it.</TipCard>}><span className="chip2 good"><ICON.check size={11} /> right field</span></Tip>}
              <span className="dim small"><Term id="teamsWanted">wanted</Term> {v.auto ? 'auto' : v.want}</span>
              <ActBtn id="research.want" testId={`want-down.${v.id}`} ariaLabel={`Fewer teams wanted for ${v.name}`} params={{ id: v.id, n: Math.max(0, v.want - 1) }} icon={ICON.minus} label="" block={v.want <= 0 && !v.auto ? 'Already 0 (paused)' : undefined} />
              <ActBtn id="research.want" testId={`want-up.${v.id}`} ariaLabel={`More teams wanted for ${v.name}`} params={{ id: v.id, n: Math.min(PROJECT_MAX_TEAMS, v.want + 1) }} icon={ICON.plus} label="" block={v.want >= PROJECT_MAX_TEAMS ? `At most ${PROJECT_MAX_TEAMS} teams` : undefined} />
              <Tip content={() => <TipCard title={<Term id="teamsWantedAuto">Auto</Term>} value={v.auto ? 'on' : 'off'}>Let the game pick the number by priority and fit.</TipCard>}>
                <button className={`btn btn-sm ${v.auto ? 'on' : 'btn-ghost'}`} data-act={`want-auto.${v.id}`} aria-pressed={v.auto} aria-label={`Auto teams wanted for ${v.name}`} onClick={() => store.act('research.want', v.auto ? { id: v.id, n: v.want } : { id: v.id, auto: true })}>Auto</button>
              </Tip>
              <Limit id="research.maxTeams" tone={v.want >= PROJECT_MAX_TEAMS ? 'warn' : 'quiet'}>max {PROJECT_MAX_TEAMS}</Limit>
            </span>
            <span className="k"><Term id="roleRE">Research engineers</Term></span>
            <Tip content={() => <TipCard title="Research engineers on it" value={`${F.num(v.re, 1)} teams`}>Given to programmes in testing, in priority order; at most two per programme.</TipCard>}>
              <span><b className="num">{F.num(v.re, 1)}</b> teams {v.re <= 0 ? <span className="dim small">(none while it finds ideas)</span> : null} <Limit id="research.rePerProject" tone={v.re >= 2 - 1e-9 ? 'warn' : 'quiet'}>at most 2 per programme</Limit></span>
            </Tip>
            <span className="k"><Term id="expCompute">Experiment compute</Term></span>
            <span className="row-i">
              <Tip content={() => <TipCard title="Experiment compute" value={`${F.h100e(g?.h100e ?? 0)} H100e`} rows={[{ label: 'Share of experiment compute', value: F.pct(g?.shareOfExperiments ?? 0) }]}>Yesterday&apos;s experiment compute on this programme.</TipCard>}>
                <span><b className="num">{fracWord(g?.shareOfExperiments ?? 0)}</b> of it · <b className="num">{F.h100e(g?.h100e ?? 0)}</b> H100e</span>
              </Tip>
              <Ref id="expCompute" to={{ panel: 'lab', anchor: 'split' }}>experiment compute</Ref>
            </span>
            <span className="k"><Term id="bottleneck">Limited by</Term></span>
            <Tip content={() => <TipCard title="Limited by (this programme)" value={myLim ?? '—'} rows={[{ label: 'The lab', value: labLim }]}>What would speed this programme&apos;s experiments most (your estimate).</TipCard>}>
              <span>{myLim ?? <span className="dim">nothing yet (finding ideas)</span>} {myLim && <span className="dim small">{myLim === labLim ? '(same as the lab)' : `(the lab: ${labLim})`}</span>}</span>
            </Tip>
          </div>
        </div>
      )}
      {!v.unlock && v.state !== 'failed' && (
        <div className="pf-sec">
          <div className="cap"><Term id="riskPolicy">Idea choice</Term></div>
          <div className="row-i">
            <span className="seg" data-test="risk-policy">{RISK_OPTS.map((o) => <button key={o.v} className={`seg-btn ${risk === o.v ? 'active' : ''}`} data-opt={o.v} onClick={() => store.act('research.risk', { risk: o.v })}>{o.label}</button>)}</span>
            <span className="dim small">which ideas every team tries first (lab-wide)</span>
          </div>
        </div>
      )}
      <div className="pf-sec row-i">
        {v.state !== 'failed' && <ActBtn id="research.dequeue" params={{ id: v.id }} icon={X} label="Remove from the list" testId={`dequeue.${v.id}`} />}
        <span className="sp" />
        <button className="btn btn-sm btn-ghost" data-test="drawer-tree" onClick={() => { setUi('sel', v.id); setUi('drawer', ''); store.setTab('research', 'tree'); }}>Discoveries ›</button>
      </div>
    </>
  );
}

function SafDrawer({ c }: { c: SafCardData }) {
  const { p, r } = c;
  const cur = SAF_STEPS.findIndex((x) => x.id === p.stage);
  return (
    <>
      <div className="pf-dh"><ICON.safety size={18} className="dim" /><h2 data-test="drawer-title">{dispName(p.name)}</h2><span className="sp" />
        <button className="btn btn-sm btn-ghost" data-test="drawer-close" aria-label="Close" onClick={() => setUi('drawer', '')}><X size={16} /></button></div>
      <div className="row-i pf-chips"><span className="kind">ongoing</span>{c.tag && <span className={`otag ${c.tag.tag}`}>{c.tag.tag}</span>}<span className="dim">{r ? COLUMN_LABEL[r.column as Column] : ''} · priority {p.rank}</span></div>
      <div className="pf-sec row-i" style={{ alignItems: 'flex-end', gap: 16 }}>
        <Track steps={SAF_STEPS} cur={cur} frac={p.stageFrac ?? 0} big testId={`drawer-track.${lineNodeId(p.id)}`} />
        <Tip content={() => <TipCard title="Next result" value={p.nextDays !== undefined && Number.isFinite(p.nextDays) ? F.days(p.nextDays) : '—'}>At today&apos;s staffing (your estimate).</TipCard>}>
          <span className="pf-eta">{p.staffed && p.nextDays !== undefined && Number.isFinite(p.nextDays) ? <>next result <b className="num">{dd(p.nextDays)} d</b></> : <span className="dim">waits for a team</span>}</span>
        </Tip>
      </div>
      <div className="pf-sec">
        <div className="cap">What it works on</div>
        <div className="pf-kv">
          <span className="k">Next result</span><span>{c.nextName ? <>new {c.tag?.what ?? 'result'}: <b>{c.nextName}</b> <Ref id="instruments" to={{ panel: 'safety' }}>Safety</Ref></> : 'follow-up results'}</span>
          <span className="k"><Term id="lineHealth">Outlook</Term></span>
          <Tip content={() => <TipCard title="Outlook" value={p.outlook} rows={r ? [{ label: 'Best guess', value: F.pct(r.band.mean) }, { label: 'Likely range', value: `${F.pct(r.band.lo)}–${F.pct(r.band.hi)}` }] : []}>Chance a result works, from its results so far.</TipCard>}>
            <span><span className={`olk ${OUTLOOK_TONE[p.outlook] ?? ''}`}>{p.outlook}</span>{r && <span className="dim small num"> {F.pct(r.band.lo)}–{F.pct(r.band.hi)}</span>}</span>
          </Tip>
          {r && (
            <>
              <span className="k"><Term id="expectedObserved">Expected vs observed</Term></span>
              <Tip content={() => <TipCard title="Expected vs observed" rows={[{ label: 'Tests in the last year', value: String(r.expObs.n) }, { label: 'Working results expected', value: F.num(r.expObs.expected, 1) }, { label: 'Working results seen', value: String(r.expObs.observed) }]}>Over the last year: how many working results your beliefs expected against how many came.</TipCard>}>
                <span><b className="num">{F.num(r.expObs.expected, 1)}</b> expected · <b className="num">{r.expObs.observed}</b> seen <span className="dim small">last 12 months</span></span>
              </Tip>
              <span className="k">Results so far</span>
              <Tip content={() => <TipCard title="Results so far" rows={Object.entries(r.results).map(([k, n]) => ({ label: F.words(k), value: String(n) }))} />}><span><b className="num">{r.findings}</b></span></Tip>
            </>
          )}
        </div>
      </div>
      <div className="pf-sec">
        <div className="cap">Gets</div>
        <div className="pf-kv">
          <span className="k"><Term id="roleSci">Science</Term></span>
          <Tip content={() => <TipCard title="Safety science teams" value={String(p.teams)}>Placed automatically by priority; the split is set in LAB.</TipCard>}><span><b className="num">{p.teams}</b> team{p.teams === 1 ? '' : 's'}</span></Tip>
          <span className="k"><Term id="safetyResults">Results a year</Term></span>
          <Tip content={() => <TipCard title="Results a year" value={F.num(p.resultsPerYear, 1)}>At today&apos;s staffing.</TipCard>}><span><b className="num">{F.num(p.resultsPerYear, 1)}</b></span></Tip>
          <span className="k">Safety compute</span>
          <span className="row-i"><Tip content={() => <TipCard title="Share of safety work compute" value={F.pct(p.computeShare)} />}><span><b className="num">{F.pct(p.computeShare)}</b></span></Tip><Ref id="safReNeeds" to={{ panel: 'lab' }}>LAB</Ref></span>
          {c.limited && <><span className="k">Limited by</span><span className="tone-warn">safety research engineers</span></>}
        </div>
      </div>
    </>
  );
}

function Drawer({ s }: { s: GameStateV2 }) {
  const id = ui('drawer');
  useEffect(() => {
    // Escape closes an open tooltip first (good-ui 4), then the drawer.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.tip')) setUi('drawer', ''); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!id) return null;
  let body: ReactNode = null;
  if (id.startsWith('line:')) {
    const c = safCards(s).find((x) => lineNodeId(x.p.id) === id);
    if (c) body = <SafDrawer c={c} />;
  } else {
    const pl = capPriorityList(s);
    const v = [...pl.list, ...pl.failed].find((x) => x.id === id);
    if (v) body = <CapDrawer s={s} v={v} />;
  }
  if (!body) return null;
  return (
    <>
      <div className="pf-scrim" onClick={() => setUi('drawer', '')} />
      <aside className="pf-drawer" data-test="drawer" data-home="projectCard" data-card={id}>{body}</aside>
    </>
  );
}

/** Add a capability project to the bottom of the list (panel header). */
export function AddProject({ s }: { s: GameStateV2 }) {
  const opts = addableProjects(s);
  return (
    <Tip content={() => <TipCard title="Add project" value={`${opts.length} open`}>Adds it to the bottom of the capability list; drag it up to give it teams sooner. Discoveries shows what each one does and needs.</TipCard>}>
      <select className="chip-select pf-add" data-test="add-project" value="" onChange={(e) => { if (e.target.value) store.act('research.queue', { id: e.target.value }); }}>
        <option value="">+ Add project</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{dispName(o.name)} · {KIND_CHIP[o.kind] ?? o.kind} · {o.area}</option>)}
      </select>
    </Tip>
  );
}

export function Portfolio({ s }: { s: GameStateV2 }) {
  useV2();
  return (
    <div className="pf" data-test="portfolio">
      <LimitedBy s={s} />
      <SciSplit s={s} />
      <div className="pf-board">
        <CapColumn s={s} />
        <SafColumn s={s} />
      </div>
      <Drawer s={s} />
    </div>
  );
}
