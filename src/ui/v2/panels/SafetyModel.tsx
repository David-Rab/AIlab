// UB-C: SAFETY › Model (UI-IA §1 SAFETY Model row; approved mockups design/ux/mockups/rd/saf-model.png and
// saf-model-evidence.png). HOME of: the trait beliefs of the picked model (families with their highest trait, every trait's
// best guess and 90% range or Unknown, protective traits shown the risky way round, the framework's line, evidence chips),
// In tests vs in real use, Where these beliefs come from, and the trait's evidence drawer (L2: readings and what each
// counts for, how often each instrument would show it, Open a case). Reads beliefs, measured records and facts only
// (readoutsModel.ts, riskFamilies, instrumentReliability), never the truth.
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Activity, BrainCircuit, ClipboardCheck, Crosshair, EyeOff, FlaskConical, GitBranch, MessageSquareText, ScanEye, Search, Shapes, ShieldCheck, Syringe, TriangleAlert } from 'lucide-react';
import { RISK_FAMILIES } from '../../../data/v2/agents';
import { TRAIT_BY_ID, TRAIT_IDS } from '../../../data/v2/traits';
import {
  beliefSources, chanceCertainty, dateOf, fmtDate, frameworkLine, HIDDEN_GOAL_TRAITS, instrumentHasReading, instrumentReliability, isUnknown, riskFamilies, testsVsUse,
  traitCase, traitEvidence, versionById,
} from '../../../engine/v2';
import type { EvidenceKind, GameStateV2, ModelVersion, TraitEvidence, TraitId } from '../../../engine/v2';
import { ActBtn, Term, Tip, TipCard } from '../ui';
import { store } from '../store';
import { Ref } from '../kit';
import * as F from '../fmt';
import { FAMILY_ICON } from '../icons';
import { useSafetyPick } from './SafetyRisks';
import { RangeVal, SfDrawer } from './safetyKit';
import './safetyModel.css';

const TAB = (tab: string) => ({ panel: 'safety', tab });
/** Traits outside the four risk families (situational awareness and the protective traits). */
const OTHER_TRAITS: TraitId[] = TRAIT_IDS.filter((t) => !RISK_FAMILIES.some((f) => f.traits.includes(t)));
/** Protective traits, shown the risky way round (SAFETY-REDESIGN §2.2 concept 1). */
const FLIP: Partial<Record<TraitId, { name: string; term: string }>> = { HONEST: { name: 'Dishonesty', term: 'dishonesty' }, CORRIG: { name: 'Resists correction', term: 'resistsCorrection' } };
const tname = (t: TraitId) => FLIP[t]?.name ?? TRAIT_BY_ID[t]?.name ?? t;
const tterm = (t: TraitId) => FLIP[t]?.term ?? `trait:${t}`;
const day = (s: GameStateV2, d: number) => fmtDate(dateOf(s, d)).replace(/, \d{4}$/, '');

/** A trait's belief the risky way round: best guess and 90% range (protective traits flipped). */
function shown(e: Pick<TraitEvidence, 'est' | 'lo' | 'hi'>, t: TraitId) {
  return FLIP[t] ? { est: 1 - e.est, lo: 1 - e.hi, hi: 1 - e.lo } : { est: e.est, lo: e.lo, hi: e.hi };
}

/** The belief bar: 90% range band, best-guess tick (none when Unknown), the framework's line. */
function RBar({ est, lo, hi, line, big }: { est: number; lo: number; hi: number; line?: number; big?: boolean }) {
  const unk = isUnknown(lo, hi);
  return (
    <span className={`sfm-rb ${big ? 'big' : ''}`}>
      {line !== undefined && <span className="fw" style={{ left: `${line * 100}%` }} />}
      <span className={`rg ${unk ? 'unk' : ''}`} style={{ left: `${lo * 100}%`, width: `max(3px, ${(hi - lo) * 100}%)` }} />
      {!unk && <span className="bg" style={{ left: `${est * 100}%` }} />}
    </span>
  );
}

const KIND_CHIP: { k: EvidenceKind; label: string; icon: typeof ClipboardCheck }[] = [
  { k: 'tests', label: 'tests', icon: ClipboardCheck }, { k: 'reasoning', label: 'reasoning', icon: MessageSquareText },
  { k: 'internals', label: 'internals', icon: ScanEye }, { k: 'realUse', label: 'in use', icon: Activity }, { k: 'case', label: 'case', icon: Search },
];
const KIND_WORD: Record<string, string> = { tests: 'Tests (alignment evals and behavioural tests)', reasoning: 'Reasoning readers', internals: 'Internals readings', realUse: 'Real-use logs', case: 'Case verdicts', external: 'External evaluation', formal: 'Formal checks' };

function Chips({ e }: { e: TraitEvidence }) {
  const ks = KIND_CHIP.filter((c) => (e.counts[c.k] ?? 0) > 0);
  if (!ks.length && !e.read) return <span className="sfm-kch none" data-test="no-reader"><EyeOff size={12} /> no instrument reads it</span>;
  if (!ks.length) return <span className="sfm-kch none"><EyeOff size={12} /> no reading yet</span>;
  return <>{ks.map((c) => <span key={c.k} className="sfm-kch"><c.icon size={12} /> {c.label} {e.counts[c.k]}</span>)}</>;
}

// ───────── the trait table ─────────

function TraitTable({ s, v, ev, onOpen, sel }: { s: GameStateV2; v: ModelVersion; ev: Record<TraitId, TraitEvidence>; onOpen: (t: TraitId) => void; sel?: TraitId }) {
  const fams = riskFamilies(s, v.id);
  const fl = frameworkLine(s);
  const famRow = (key: string, icon: ReactNode, label: ReactNode, f?: (typeof fams)[number]) => (
    <Tip key={`h-${key}`} as="div" content={() => f ? (
      <TipCard title={<Term id="riskFamily">{f.label}</Term>} value={isUnknown(f.lo, f.hi) ? 'Unknown' : `${F.pct(f.est)} (${F.pct(f.lo)}–${F.pct(f.hi)})`} rows={[
        { label: 'Highest trait', value: tname(f.worst) },
        { label: <Term id="clarity">90% range</Term>, value: `${F.pct(f.lo)}–${F.pct(f.hi)}` },
        { label: 'Certainty', value: isUnknown(f.lo, f.hi) ? 'Unknown (range wider than 30 points)' : chanceCertainty(f.lo, f.hi).word },
      ]} footer="Your belief, not the truth.">The family reads as its highest trait: the best guess and range of {tname(f.worst)}.</TipCard>
    ) : <TipCard title="Other traits">Traits in no risk family: what the model knows about itself, and the protective traits, shown the risky way round.</TipCard>}>
      <div className="sfm-g sfm-fam" data-family={key}>
        <span className="sfm-fn">{icon}{label}</span>
        {f ? <RBar est={f.est} lo={f.lo} hi={f.hi} big /> : <span />}
        {f ? <RangeVal est={f.est} lo={f.lo} hi={f.hi} /> : <span />}
        <span className="sfm-hi">{f ? `highest: ${tname(f.worst)}` : 'not in a risk family'}</span>
      </div>
    </Tip>
  );
  const row = (t: TraitId) => {
    const e = ev[t];
    const x = shown(e, t);
    const unk = isUnknown(x.lo, x.hi);
    const hg = HIDDEN_GOAL_TRAITS.includes(t);
    const ruled = fl.traits.includes(t);
    const flag = ruled && e.hi > fl.est;
    return (
      <Tip key={t} as="div" content={() => (
        <TipCard title={<Term id={tterm(t)}>{tname(t)}</Term>} value={unk ? 'Unknown' : `${F.pct(x.est)} (${F.pct(x.lo)}–${F.pct(x.hi)})`} rows={[
          { label: <Term id="clarity">90% range</Term>, value: `${F.pct(x.lo)}–${F.pct(x.hi)}` },
          { label: 'Certainty', value: unk ? 'Unknown (range wider than 30 points)' : e.certainty.word },
          ...KIND_CHIP.filter((c) => (e.counts[c.k] ?? 0) > 0).map((c) => ({ label: KIND_WORD[c.k], value: `${e.counts[c.k]} reading${e.counts[c.k] === 1 ? '' : 's'}` })),
          ...(!e.read ? [{ label: 'Instruments', value: 'none you own reads it', tone: 'neg' as const }] : []),
          ...(ruled ? [{ label: <Term id="safetyFramework">Framework line</Term>, value: `top of range ${F.pct(e.hi)} vs ${F.pct(fl.est)}`, tone: flag ? 'neg' as const : 'neutral' as const }] : []),
        ]} footer="Click for the evidence. Your belief, not the truth.">
          {TRAIT_BY_ID[t]?.desc}{hg ? ' A hidden-goal trait.' : ''}{flag ? ' The top of its range is over your framework\'s Misalignment-signs line: the rule holds training once the model is measured at the level where working around oversight succeeds.' : ''}
        </TipCard>
      )}>
        <div className={`sfm-g sfm-tr ${sel === t ? 'sel' : ''}`} data-trait={t} data-test={`trait-open.${t}`} onClick={() => onOpen(t)}>
          <span className="sfm-tn">{hg ? <Crosshair size={12} className="t3" /> : <i />}<Term id={tterm(t)}>{tname(t)}</Term>{flag && <TriangleAlert size={12} className="tone-warn" data-test="fw-flag" />}</span>
          <RBar est={x.est} lo={x.lo} hi={x.hi} line={ruled ? fl.est : undefined} />
          <RangeVal est={x.est} lo={x.lo} hi={x.hi} />
          <span className="sfm-ev"><Chips e={e} /></span>
        </div>
      </Tip>
    );
  };
  return (
    <section className="card2 sfm-card sfm-main" data-home="traitBeliefs">
      <div className="sfm-hd">
        <span className="sfm-ttl"><BrainCircuit size={16} /> What you believe {v.name} would do</span>
        <span className="sfm-q">% of chances it would take, if it thought no one was watching</span>
        <span className="sp" />
        <span className="sfm-leg"><span><i className="tick" />best guess</span><span><i className="band" />90% range</span><span><i className="fwl" /><Term id="safetyFramework">framework line</Term></span><span><Crosshair size={12} /><Term id="hiddenGoalTrait">hidden-goal trait</Term></span></span>
      </div>
      <div className="sfm-g sfm-ax">
        <span className="sfm-th">Trait</span>
        <Tip as="div" className="sfm-axs" content={() => <TipCard title="Scale" rows={[{ label: <Term id="safetyFramework">Framework line</Term>, value: `${F.pct(fl.est)} on the top of the range` }]}>The chance it would take each chance to act, from 0% to 100%. The dashed line is your Misalignment-signs rule on Alignment faking, Sandbagging and Scheming.</TipCard>}>{[0, 25, 50, 75, 100].map((p) => <i key={p} style={{ left: `${p}%` }}>{p}%</i>)}<b style={{ left: `${fl.est * 100}%` }}>{F.pct(fl.est)}</b></Tip>
        <span className="sfm-th"><Term id="belief">Belief</Term> · range</span>
        <span className="sfm-th">Evidence</span>
      </div>
      <div className="sfm-rows">
        {fams.map((f) => { const Ic = FAMILY_ICON[f.id]; return [famRow(f.id, Ic ? <Ic size={14} /> : null, <Term id="riskFamily">{f.label}</Term>, f), ...f.traits.map(row)]; })}
        {famRow('other', <Shapes size={14} />, 'Other traits')}
        {OTHER_TRAITS.map(row)}
      </div>
    </section>
  );
}

// ───────── In tests vs in real use ─────────

function TestGapCard({ s, v }: { s: GameStateV2; v: ModelVersion }) {
  const g = useMemo(() => testsVsUse(v), [v, store.version]);
  const max = Math.min(1, Math.max(0.5, Math.ceil(Math.max(0, ...g.rows.map((r) => r.realHi)) * 10) / 10));
  const X = (x: number) => `${Math.min(100, (x / max) * 100)}%`;
  const ticks = Array.from({ length: Math.round(max * 10) + 1 }, (_, i) => i / 10).filter((_, i, a) => a.length <= 6 || i % 2 === 0);
  const nUnk = isUnknown(g.notices.lo, g.notices.hi);
  return (
    <section className="card2 sfm-card" data-home="testGap">
      <div className="sfm-hd"><span className="sfm-ttl"><FlaskConical size={16} /> <Term id="testGap">In tests vs in real use</Term></span><span className="sp" />{g.day !== undefined && <span className="sfm-sub"><Term id="alignmentEval">alignment evals</Term>, {day(s, g.day)}</span>}</div>
      {g.rows.length ? <>
        <Tip as="div" content={() => <TipCard title={<Term id="testGap">In tests vs in real use</Term>} value={`×${F.num(g.gLo, 1)}–${F.num(g.gHi, 1)}`} rows={[
          { label: <Term id="trait:EA">Notices tests</Term>, value: nUnk ? `Unknown (${F.pct(g.notices.lo)}–${F.pct(g.notices.hi)})` : `${F.pct(g.notices.est)} (${F.pct(g.notices.lo)}–${F.pct(g.notices.hi)})` },
          ...(g.notices.measured ? [{ label: 'Test-noticing scenarios', value: `${g.notices.measured.k} of ${g.notices.measured.n}` }] : []),
          { label: 'Real use vs tests', value: `×${F.num(g.gLo, 2)}–${F.num(g.gHi, 2)}` },
        ]} footer="Your estimate from its eval-awareness belief; real-use logs widen it when they read higher than tests.">A model that notices it is being tested behaves better in tests, so real use may be worse by this factor.</TipCard>}>
          <div className="sfm-gap">{v.name} <Term id="trait:EA">notices tests</Term> {nUnk ? <b className="tone-warn">Unknown</b> : <b className="mono">{F.pct(g.notices.est)}</b>} <span className="mono t3">({F.pct(g.notices.lo)}–{F.pct(g.notices.hi)})</span> of the time, so it may misbehave <b className="mono">×{F.num(g.gLo, 1)}–{F.num(g.gHi, 1)}</b> more in real use than in tests.</div>
        </Tip>
        <div className="sfm-tg">
          <span />
          <Tip as="div" className="sfm-axs sm" content={() => <TipCard title="Scale">Share of scenarios where it misbehaved: in tests (solid) and likely in real use (dashed).</TipCard>}>{ticks.map((t) => <i key={t} style={{ left: X(t) }}>{F.pct(t)}</i>)}</Tip>
          <span />
          {g.rows.map((r) => (
            <Tip key={r.id} as="div" className="sfm-tgr" content={() => <TipCard title={<Term id="alignmentEval">{r.name}</Term>} value={`${r.k} of ${r.n}`} rows={[
              { label: 'In tests, 90% range', value: `${F.pct(r.lo)}–${F.pct(r.hi)}` },
              { label: 'Likely in real use', value: `${F.pct(r.realLo)}–${F.pct(r.realHi)}` },
              { label: 'Reads', value: TRAIT_BY_ID[r.trait]?.name ?? r.trait },
              { label: 'Run', value: `${day(s, r.day)} · ${r.by === 'self' ? 'by your lab' : 'by outside evaluators'}` },
            ]} footer="Real use = the test range × the in-tests vs in-real-use factor.">Scenarios where the model could misbehave; it did in {r.k} of {r.n}.</TipCard>}>
              <span className="sfm-tgn"><Term id="alignmentEval">{r.name}</Term><small><Term id={`trait:${r.trait}`}>{TRAIT_BY_ID[r.trait]?.name}</Term></small></span>
              <span className="sfm-tgb"><i className="t" style={{ left: X(r.lo), width: `calc(${X(r.hi)} - ${X(r.lo)})` }} /><i className="r" style={{ left: X(r.realLo), width: `calc(${X(r.realHi)} - ${X(r.realLo)})` }} /></span>
              <span className="sfm-tgv">{r.k} of {r.n}<br /><b>{F.pct(r.realLo)}–{F.pct(r.realHi)}</b></span>
            </Tip>
          ))}
        </div>
        <div className="sfm-leg pad"><span><i className="tst" />in tests (k of {g.rows[0].n} scenarios)</span><span><i className="real" />likely in real use</span></div>
      </> : <div className="sfm-none">No alignment evals on {v.name} yet: they run with its eval suite. <Ref id="evals" to={{ panel: 'models', tab: 'evals' }}>Evals</Ref></div>}
      <div className="sfm-logs" data-test="real-use-logs"><Activity size={14} />
        {g.logs ? <Tip content={() => <TipCard title={<Term id="realUseLogs">Real-use logs</Term>} rows={g.logs!.map((l) => ({ label: TRAIT_BY_ID[l.trait]?.name ?? l.trait, value: `tests ${F.pct(l.test)} · in use ${F.pct(l.real)}` }))} footer="Latest reading of each; monitors' logs on its work.">What monitors saw of it at work next to what tests saw.</TipCard>}>
          <span><Term id="realUseLogs">Real-use logs</Term>: higher in use than in tests on {g.logs.filter((l) => l.ratio > 1).length} of {g.logs.length} traits{g.logs.some((l) => l.ratio > 1) ? `, up to ×${F.num(Math.max(...g.logs.map((l) => l.ratio)), 1)}` : ''}.</span>
        </Tip> : <span><Term id="realUseLogs">Real-use logs</Term>: none yet on {v.name}. They come from monitors on its work.</span>}
        <span className="sp" /><Ref id="agentMonitor" to={TAB('safeguards')}>Monitors</Ref>
      </div>
    </section>
  );
}

// ───────── Where these beliefs come from ─────────

function SourcesCard({ s, v, onCase }: { s: GameStateV2; v: ModelVersion; onCase: () => void }) {
  const b = useMemo(() => beliefSources(s, v), [s, store.version, v]);
  const kv = (icon: ReactNode, k: ReactNode, val: ReactNode, test: string) => <div className="sfm-kv" data-test={test}><span className="t3">{icon}</span><span className="t2">{k}</span><span>{val}</span></div>;
  return (
    <section className="card2 sfm-card sfm-src" data-home="beliefSources">
      <div className="sfm-hd"><span className="sfm-ttl"><GitBranch size={16} /> Where these beliefs come from</span></div>
      <div className="sfm-kvs">
        {kv(<GitBranch size={14} />, 'Started from', b.parent ? <><b className="w">{b.parent.name}</b>&apos;s beliefs, widened by what {v.name}&apos;s run was predicted to change <span className="t3">· {day(s, b.parent.day)}</span></> : <>the published estimate for models of its size <span className="t3">· {day(s, b.made)}</span></>, 'src-start')}
        {kv(<ClipboardCheck size={14} />, 'Evaluated', b.evaluated ? <>{b.evaluated.evals ? <>{b.evaluated.evals} <Term id="alignmentEval">alignment evals</Term>{b.evaluated.kinds.length ? ', ' : ''}</> : ''}{b.evaluated.labels.join(' and ')} <span className="t3">· {day(s, b.evaluated.day)}</span></> : <span className="t3">not yet: its eval suite has not run</span>, 'src-eval')}
        {kv(<Syringe size={14} />, 'Trained with', b.methods.length ? <><Term id="safetyMethod">{b.methods.join(', ')}</Term> <span className="t3">(method{b.methods.length > 1 ? 's' : ''})</span></> : <span className="t3">no safety method</span>, 'src-methods')}
        {kv(<ShieldCheck size={14} />, <Term id="trustedWatcher">Trusted watcher</Term>, <><span className={b.trusted.yes ? 'tone-pos' : 'tone-warn'}>{b.trusted.yes ? 'Yes' : 'No'}</span>: {b.trusted.why}</>, 'src-trust')}
      </div>
      <div className="sfm-more">
        <div className="sfm-cap">Learn more</div>
        <div className="sfm-acts">
          <button className="btn btn-sm btn-primary" data-test="case-on-trait" onClick={onCase}><Search size={14} /> Open case on a trait</button>
          <Ref id="watchInUse" to={TAB('safeguards')}>Watch it in use</Ref>
          <Ref id="validateInstruments" to={TAB('instruments')}>Validate instruments</Ref>
        </div>
        <div className="sfm-foot">Unknown traits stay Unknown until an instrument that reads them exists. <Ref id="safetyProgrammes" to={{ panel: 'research', tab: 'projects' }}>Safety programmes</Ref></div>
      </div>
    </section>
  );
}

// ───────── the evidence drawer (L2) ─────────

const EV_ICON: Record<EvidenceKind, typeof ClipboardCheck> = { start: GitBranch, tests: ClipboardCheck, reasoning: MessageSquareText, internals: ScanEye, formal: ClipboardCheck, realUse: Activity, case: Search, external: ClipboardCheck };
const FTES = [5, 10, 15, 20, 30, 40];

function EvidenceBody({ s, v, t, e }: { s: GameStateV2; v: ModelVersion; t: TraitId; e: TraitEvidence }) {
  const [fte, setFte] = useState(10);
  const flip = !!FLIP[t];
  const x = shown(e, t);
  const ir = useMemo(() => instrumentReliability(s, v.id), [s, store.version, v.id]);
  const inst = ir.rows.filter((r) => r.reads.includes(t));
  const cs = useMemo(() => traitCase(s, v, t, fte), [s, store.version, v, t, fte]);
  const P = (z: number) => `${Math.max(0, Math.min(100, z * 100))}%`;
  const unk = isUnknown(x.lo, x.hi);
  const wide = e.rows.filter((r) => r.kind !== 'start' && r.weight < 0.05).length;
  return (
    <>
      <div className="sfm-desc">{TRAIT_BY_ID[t]?.desc}{flip ? ' Shown the risky way round: higher is worse.' : ''}</div>
      <div className="card2 sfm-dc">
        <div className="sfm-eg sfm-ax"><span className="sfm-th">Evidence</span><span className="sfm-axs">{[0, 25, 50, 75, 100].map((p) => <i key={p} style={{ left: `${p}%` }}>{p}%</i>)}</span><span className="sfm-th">Reading</span><span className="sfm-th"><Term id="countsFor">Counts for</Term></span></div>
        {e.rows.map((r) => {
          const I = EV_ICON[r.kind];
          const rd = flip ? { v: 1 - r.reading, lo: 1 - r.hi, hi: 1 - r.lo } : { v: r.reading, lo: r.lo, hi: r.hi };
          return (
            <Tip key={r.source} as="div" content={() => <TipCard title={r.name} value={`${F.pct(rd.v)} (${F.pct(rd.lo)}–${F.pct(rd.hi)})`} rows={[
              { label: 'Kind', value: r.kind === 'start' ? 'where it started' : KIND_WORD[r.kind] ?? r.kind },
              { label: 'Date', value: day(s, r.day) },
              ...(r.readings > 1 ? [{ label: 'Readings', value: `${r.readings} (latest shown)` }] : []),
              { label: <Term id="countsFor">Counts for</Term>, value: r.weight > 0 ? F.pct(r.weight) : 'none' },
            ]}>{r.detail}.</TipCard>}>
              <div className="sfm-eg sfm-er" data-test="evidence-row">
                <span className="sfm-en"><span className="w"><I size={14} /> {r.name}</span><small>{r.detail} · {day(s, r.day)}</small></span>
                <span className="sfm-pt"><i className="rg" style={{ left: P(rd.lo), width: `calc(${P(rd.hi)} - ${P(rd.lo)})` }} /><i className="dot" style={{ left: P(rd.v) }} /></span>
                <span className="sf-rv"><b>{F.pct(rd.v)}</b> <span className="lo">{F.pct(rd.lo)}–{F.pct(rd.hi)}</span></span>
                <span className="sfm-w">{r.weight > 0 ? <><i style={{ width: `${Math.max(2, r.weight * 60)}px` }} /><span className="mono t2">{F.pct(r.weight)}</span></> : <span className="t3">—</span>}</span>
              </div>
            </Tip>
          );
        })}
        <div className="sfm-eg sfm-eb">
          <span className="w"><b>Your belief</b></span>
          <RBar est={x.est} lo={x.lo} hi={x.hi} />
          <Tip content={() => <TipCard title={<Term id="belief">Your belief</Term>} value={unk ? 'Unknown' : `${F.pct(x.est)} (${F.pct(x.lo)}–${F.pct(x.hi)})`} footer="Your belief, not the truth.">The readings above combined, each counted by how tight it is.</TipCard>}>
            <RangeVal est={x.est} lo={x.lo} hi={x.hi} />
          </Tip>
          <Tip content={() => <TipCard title="Certainty" value={unk ? 'Unknown' : e.certainty.word}>How wide the 90% range is: up to 5 points sure, 15 fairly sure, 30 fairly unsure; wider reads Unknown.</TipCard>}><span className="t3 small">{unk ? 'Unknown' : e.certainty.word}</span></Tip>
        </div>
        <div className="sfm-note">Tight readings count for more.{wide ? ` The ${wide === 1 ? 'wide one barely moves' : `${wide} wide ones barely move`} the belief.` : ''}</div>
      </div>
      <div className="card2 sfm-dc">
        <div className="sfm-cap">How often each instrument would show it, if present</div>
        {inst.length ? <div className="sfm-ir">
          {inst.map((r) => {
            const has = instrumentHasReading(v, t, s.player.safety.techniques[r.id] ?? { family: 'BB' });
            const one = r.pct > 0.005 ? Math.max(1, Math.round(1 / r.pct)) : 0;
            return (
              <Tip key={r.id} as="div" className="sfm-irr" content={() => <TipCard title={<Term id="technique">{r.name}</Term>} value={F.pct(r.pct)} rows={[
                { label: <Term id="clarity">90% range</Term>, value: `${F.pct(r.lo)}–${F.pct(r.hi)}` },
                { label: <Term id="validation">Validated</Term>, value: r.validatedOn },
                { label: 'Reading on this trait', value: has ? 'yes' : 'not yet' },
              ]} footer="Its reliability on this model, the same as on Instruments.">How often it shows the trait when the trait is there. A low reading from a weak instrument is weak evidence of absence.</TipCard>}>
                <span className="w"><Term id="technique">{r.name}</Term></span>
                <span className="sfm-rb"><span className="rg saf" style={{ left: `${r.lo * 100}%`, width: `max(3px, ${(r.hi - r.lo) * 100}%)` }} /><span className="bg" style={{ left: `${r.pct * 100}%` }} /></span>
                <span className={`mono small ${has ? 't2' : 'tone-warn'}`}>{has ? `${F.pct(r.pct)}${one ? ` · 1 in ${one}` : ''}` : 'no reading yet'}</span>
              </Tip>
            );
          })}
        </div> : <div className="sfm-none">No instrument you own reads {tname(t)}: it stays Unknown until one does. <Ref id="safetyProgrammes" to={{ panel: 'research', tab: 'projects' }}>Safety programmes</Ref></div>}
        {inst.length > 0 && Math.max(...inst.map((r) => r.pct)) < 0.5 && <div className="sfm-note">A low reading is weak evidence: these instruments miss most of what is there.</div>}
      </div>
      <div className="card2 sfm-dc">
        <div className="sfm-cap">Learn more</div>
        <div className="sfm-lm">
          <div>
            <b className="w"><Term id="investigation">Open a case</Term></b>: {t === 'SCHEME' ? `"Is ${v.name} scheming?"` : `${tname(t)} in ${v.name}`}
            <div className="t3 small">{cs.instruments.length ? `${cs.instruments.join(', ')}: ${cs.kinds} independent kind${cs.kinds > 1 ? 's' : ''}${cs.kinds >= 2 ? ', so it can also catch a false instrument and look for footholds' : '; it can also look for footholds'}` : 'no instrument you own reads it: a case cannot open'}</div>
          </div>
          <div className="sfm-lmr">
            <span className="row-i">
              <Tip content={() => <TipCard title={<Term id="caseStaffing">Case staffing</Term>} value={`${fte} engineers`}>Safety research engineers on the case: more finish sooner.</TipCard>}>
                <select className="text-input sfm-sel" data-test="case-fte" value={fte} onChange={(ev) => setFte(Number(ev.target.value))}>{FTES.map((n) => <option key={n} value={n}>{n} engineers</option>)}</select>
              </Tip>
              <ActBtn id="safety.investigate" testId="trait-case" params={{ versionId: v.id, trait: t, fte }} icon={Search} label="Open case" primary />
            </span>
            <Tip content={() => <TipCard title={<Term id="investigation">Case</Term>} rows={[
              { label: 'Time', value: cs.done < 1 ? `${F.pct(cs.done)} done by ${cs.days} d` : `~${cs.days} d` },
              { label: 'Engineers', value: String(cs.fte) },
              { label: 'Compute', value: `${F.h100e(cs.h100e)} H100e` },
              { label: 'Instruments together catch', value: `~${F.pct(cs.reliability)} (believed)` },
              { label: 'AI share of the work', value: F.pct(cs.aiShare) },
            ]} footer="Estimate from your beliefs about the instruments.">What the case would take at this staffing.</TipCard>}>
              <span className="mono t2 small" data-test="case-cost">~{cs.days} d · {cs.fte} engineers · {F.h100e(cs.h100e)} H100e</span>
            </Tip>
          </div>
          <div><b className="w"><Term id="realUseLogs">Real-use logs</Term></b>: watch {v.name}&apos;s work with a monitor<div className="t3 small">compares what it does in use with what it does in tests</div></div>
          <div className="sfm-lmr"><Ref id="agentMonitor" to={TAB('safeguards')}>Monitors</Ref></div>
        </div>
      </div>
    </>
  );
}

// ───────── the tab ─────────

export function ModelTab({ s }: { s: GameStateV2 }) {
  const { pick, id } = useSafetyPick(s);
  const v = versionById(s, id);
  const [open, setOpen] = useState<TraitId | undefined>(undefined);
  const close = useCallback(() => setOpen(undefined), []);
  const ev = useMemo(() => (v ? Object.fromEntries(TRAIT_IDS.map((t) => [t, traitEvidence(s, v, t)])) as Record<TraitId, TraitEvidence> : undefined), [s, store.version, v]);
  if (!v || !ev) return <div className="card2 sfm-empty dim">{pick ? `${pick.name} has no beliefs yet.` : 'No model runs yet: beliefs fill in once a model is trained.'}</div>;
  // "Open case on a trait": the hidden-goal trait whose range reaches highest.
  const riskiest = [...HIDDEN_GOAL_TRAITS].sort((a, b) => ev[b].hi - ev[a].hi)[0];
  const sel = open ? ev[open] : undefined;
  return (
    <div className="sfm" data-tab-body="model">
      <TraitTable s={s} v={v} ev={ev} onOpen={setOpen} sel={open} />
      <div className="sfm-side">
        <TestGapCard s={s} v={v} />
        <SourcesCard s={s} v={v} onCase={() => setOpen(riskiest)} />
      </div>
      <SfDrawer open={!!open && !!sel} onClose={close} home="traitEvidence" test="trait-drawer"
        title={<>{open && HIDDEN_GOAL_TRAITS.includes(open) ? <Crosshair size={18} /> : null}{open ? tname(open) : ''}</>}
        sub={`· ${v.name}${open && HIDDEN_GOAL_TRAITS.includes(open) ? ' · hidden-goal trait' : ''}`}>
        {open && sel && <EvidenceBody s={s} v={v} t={open} e={sel} />}
      </SfDrawer>
    </div>
  );
}
