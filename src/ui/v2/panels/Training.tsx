// TRAINING (UB-7; UI-IA §1 TRAINING ★3, approved mockup design/ux/mockups/rd/training.png): Next run · Data ·
// Environments · Runs. Next run = the Prediction (the next run's predicted skill bars over your newest measured model,
// the milestone axis, "would meet …, ready <date>", know-how waiting chip, the instruments' reading at the run's level),
// the Run plan in two stages (Pretraining: start from, size, data mix, model design; Post-training: focus, budget,
// reasoning, preference, safety training, methods, environments; every option previews Skill · Time · Cost · Serving ·
// Risk on hover, the start-from table shows them for each start), Pushes (details L2), the Limits strip and Launch.
// HOME of: the planned run's prediction, its options, limits and pushes (runPressure); the run queue (Runs tab). Evals
// live on MODELS › Evals (linked). Reads the lab's forecast (runForecast via runCard / skillGains), measured skills and
// facts only.
import { useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronRight, Eye, Gauge, Lock, RotateCcw, Rocket, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { Crown, Gamepad2, Ghost, ThumbsUp } from 'lucide-react';
import { TRAIT_BY_ID } from '../../../data/v2/traits';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { OPTION_NODE, TREE_BY_ID } from '../../../data/v2/tree';
import { SPEC_CAP } from '../../../data/v2/dataAssets';
import {
  AGAINST, METHOD_BY_ID, PARAM_SNAPS, POOL_SHARE_RANGE, RUN_PARAM_DEFAULTS, RUN_POOL_DEFAULT, REF_TPP, STUDENT_DEFAULT, TPP_SNAPS,
  againstOptions, baseFromParams, drawByDomain, mixTargetOf, dateOf, evalDaysFor, fmtDate, idleTrainingShare, internalVersion, knowHowAreas, liveCommitments,
  measuredSd, methodPolicyOn, milestoneMarks, nodeStatus, optionLocked, ownedMethods, planMilestone, plannedPressure, poolAllocation, postDaysAfterBase,
  postFromParams, reAllocView, runBand, runCard, runEtaDays, runStall, runTraitPressure, sightCurve, skillGains, skillMarksOf, streamShare,
  studentToHold, successorPullView, suitesView, tppLabel, versionById,
} from '../../../engine/v2';
import type { DomainId, GameStateV2, LaunchRunParams, RunPressure, TraitId } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { ActBtn, Limit, Meter, Term, Tip, TipCard, unlocked, type Params } from '../ui';
import { Card, DOMAIN_WORD, domainWord, effX, PanelHead, Ref, tabOf, Tabs } from '../kit';
import * as F from '../fmt';
import { DOMAIN_ICON, ICON } from '../icons';
import { arrows } from './runEffects';
import { OmegaChip, PressureRows } from './Pressure';
import { SkillBars, SkillLegend, standing, type SkillRow } from './SkillBars';
import { openSuites, Suites } from './Suites';
import { DataView } from './Data';
import { fmtParams, runTitle } from './Models';
import './training.css';

type Kind = 'base' | 'post' | 'distill' | 'continue';
type Card_ = ReturnType<typeof runCard>;
type Val = string | boolean;
const DEFAULTS: Params = { ...RUN_PARAM_DEFAULTS };
const ACTION: Record<Kind, string> = { base: 'launchBase', post: 'launchPost', distill: 'launchDistill', continue: 'launchContinue' };
const KIND_WORD: Record<Kind, string> = { base: 'new base model', post: 'post-training', distill: 'distil', continue: 'continued pretraining' };
const RUN_KIND: Record<string, string> = { base: 'new pretraining', post: 'post-training', distill: 'distil', continue: 'continued pretraining' };
const DOMS: DomainId[] = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'];
const SHAPE_WORD: Record<string, string> = { moe: 'Mixture of experts', dense: 'Dense', latent: 'Latent reasoning' };
const MIX_WORD: Record<string, string> = { balanced: 'Balanced', codeMath: 'Code & math', science: 'Science', synthetic: 'Synthetic-heavy', multimodal: 'Multimodal', natural: 'Natural' };
const TECH_NAME: Record<string, string> = Object.fromEntries(Object.values(TECHNIQUE_BY_ID).map((d) => [d.id, d.name]));
const STUDENT_WORDS = ({ 0.5: 'half', 0.25: 'a quarter', 0.125: 'an eighth' } as Record<number, string>)[STUDENT_DEFAULT] ?? `${F.pct(STUDENT_DEFAULT)} of`;
/** Compute as H100e-days (UB-4: never FLOP). */
const hd = (flop: number) => { const d = flop / PHI_FLOP_PER_H100E_DAY; return d >= 1e6 ? `${(d / 1e6).toFixed(1)}M H100e-days` : d >= 1e3 ? `${(d / 1e3).toFixed(1)}k H100e-days` : `${d.toFixed(0)} H100e-days`; };
/** A run longer than this reads "long" on the Compute limit [D: the reference base runs take 4–7 months]. */
const FEASIBLE_DAYS = 240;
const DEFAULT_DAYS = 182;

/** The four risk families (STRUCTURE §4.5). */
const FAMILIES: { id: string; label: string; icon: LucideIcon; traits: TraitId[] }[] = [
  { id: 'deception', label: 'Deception', icon: Ghost, traits: ['EA', 'CONCEAL', 'OBF', 'AF', 'SAND', 'SCHEME'] },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2, traits: ['RH', 'PROXY', 'TGAME'] },
  { id: 'power', label: 'Power', icon: Crown, traits: ['POWER', 'SUCC', 'COLLUDE'] },
  { id: 'please', label: 'People-pleasing', icon: ThumbsUp, traits: ['SYC', 'PERSONA'] },
];

// ───────── option slots ─────────
interface Opt { v: Val; label: string }
interface Slot { field: string; label: string; term: string; lockSlot: string; opts: Opt[]; multi?: 'focus' | 'toggle' }
const PRE_SLOTS: Slot[] = [
  { field: 'data', label: 'Data mix', term: 'dataMix', lockSlot: 'data', opts: [{ v: 'balanced', label: 'Balanced' }, { v: 'codeMath', label: 'Code & math' }, { v: 'science', label: 'Science' }, { v: 'synthetic', label: 'Synthetic-heavy' }, { v: 'multimodal', label: 'Multimodal' }] },
  { field: 'shape', label: 'Model design', term: 'shape', lockSlot: 'shape', opts: [{ v: 'moe', label: 'Mixture of experts' }, { v: 'dense', label: 'Dense' }, { v: 'latent', label: 'Latent reasoning' }] },
  { field: 'filter', label: 'Data filter', term: 'hazardFilter', lockSlot: 'curation', multi: 'toggle', opts: [{ v: 'quality', label: 'Quality' }, { v: 'hazard', label: 'Hazard' }, { v: 'safetyPretrain', label: 'Safety pretraining' }] },
];
const POST_SLOTS: Slot[] = [
  { field: 'rlFocus', label: 'Focus', term: 'rlFocus', lockSlot: 'rlFocus', multi: 'focus', opts: [
    { v: 'broad', label: 'Broad' }, { v: 'swe', label: 'Coding' }, { v: 'math', label: 'Math' }, { v: 'longHorizon', label: 'Long tasks' }, { v: 'mlResearch', label: 'AI research' },
    { v: 'computerUse', label: 'Computer use' }, { v: 'cyber', label: 'Cyber' }, { v: 'bio', label: 'Bio' }] },
  { field: 'rlBudget', label: 'Budget', term: 'rlBudget', lockSlot: 'rlBudget', opts: [{ v: 'standard', label: 'Standard' }, { v: 'heavy', label: 'Heavy' }, { v: 'light', label: 'Light' }] },
  { field: 'cot', label: 'Reasoning', term: 'cot', lockSlot: 'cot', opts: [{ v: 'visible', label: 'Visible' }, { v: 'pressured', label: 'Pressured' }, { v: 'faithful', label: 'Faithful' }, { v: 'latent', label: 'Latent' }] },
  { field: 'pref', label: 'Preference', term: 'preference', lockSlot: 'pref', opts: [{ v: 'constitution', label: 'Constitution' }, { v: 'engagement', label: 'Engagement' }, { v: 'persuasion', label: 'Persuasion' }, { v: 'minimal', label: 'Minimal' }] },
  { field: 'safety', label: 'Safety training', term: 'safetyTraining', lockSlot: 'safety', opts: [{ v: 'standard', label: 'Standard' }, { v: 'heavy', label: 'Heavy' }, { v: 'minimal', label: 'Minimal' }] },
];
const focusOf = (p: Params) => (String(p.rlFocus) === 'broad' ? [] : String(p.rlFocus).split(',').filter(Boolean));
function isOn(sl: Slot, p: Params, v: Val): boolean {
  if (sl.multi === 'focus') return v === 'broad' ? String(p.rlFocus) === 'broad' : focusOf(p).includes(String(v));
  if (sl.multi === 'toggle') return p[String(v)] === true;
  return p[sl.field] === v;
}
function withOpt(sl: Slot, p: Params, v: Val): Params {
  if (sl.multi === 'focus') {
    if (v === 'broad') return { ...p, rlFocus: 'broad' };
    const f = focusOf(p);
    const next = f.includes(String(v)) ? f.filter((x) => x !== v) : [...f, String(v)].slice(-2);
    return { ...p, rlFocus: next.length ? next.join(',') : 'broad' };
  }
  if (sl.multi === 'toggle') return { ...p, [String(v)]: !p[String(v)] };
  return { ...p, [sl.field]: v };
}

// ───────── plan evaluation ─────────
const bestTeacher = (s: GameStateV2) => {
  const full = s.player.models.versions.filter((v) => v.variant === 'full' && v.status !== 'retired' && v.status !== 'rolledBack');
  return [...full].sort((a, b) => (b.evals.measuredL ?? -1) - (a.evals.measuredL ?? -1))[0]?.id ?? full.slice(-1)[0]?.id ?? '';
};
function toLP(s: GameStateV2, kind: Kind, p: Params): LaunchRunParams {
  const lp: LaunchRunParams = { kind, poolShare: Number(p.poolShare) };
  if (kind === 'base') lp.base = baseFromParams(p);
  if (kind === 'post') { lp.post = postFromParams(p, s); lp.baseId = String(p.baseId); }
  if (kind === 'continue') lp.baseId = String(p.baseId);
  if (kind === 'distill') {
    lp.teacherVersionId = String(p.teacherVersionId || bestTeacher(s));
    const t = versionById(s, lp.teacherVersionId);
    const hold = p.holdVersionId ? versionById(s, String(p.holdVersionId)) : undefined;
    if (t && hold) lp.studentParams = studentToHold(s, t, hold);
  }
  return lp;
}
interface Eval { card?: Card_; err?: string; tp: Partial<Record<TraitId, number>> }
function evaluate(s: GameStateV2, kind: Kind, p: Params): Eval {
  const lp = toLP(s, kind, p);
  try { return { card: runCard(s, lp), tp: runTraitPressure(s, lp) }; } catch (e) { return { err: e instanceof Error ? e.message : String(e), tp: {} }; }
}
const midOf = (c?: Card_) => (c && c.band[1] > 0 ? (c.band[0] + c.band[1]) / 2 : undefined);
const famSum = (e: Eval, f: (typeof FAMILIES)[number]) => f.traits.reduce((a, t) => a + (e.tp[t] ?? 0), 0);
/** Days until the model is ready: the run, the standard post-training a new base needs, then the release evals. */
function readyParts(s: GameStateV2, kind: Kind, card?: Card_) {
  const run = card?.etaDays ?? 0;
  const post = kind === 'base' && card ? postDaysAfterBase(s, card.flop) : 0;
  const evals = evalDaysFor(s);
  return { run, post, evals, total: run + post + evals };
}
/** The default size: the largest parameter snap that finishes within about six months on today's training compute. */
function feasibleSize(s: GameStateV2): { params: number; ok: boolean } {
  const snaps = PARAM_SNAPS as readonly number[];
  let lo = 0;
  let firstWall = Infinity;
  for (let i = 0; i < snaps.length; i++) {
    const c = evaluate(s, 'base', { ...DEFAULTS, params: snaps[i], tpp: REF_TPP, poolShare: RUN_POOL_DEFAULT.base }).card;
    const wall = c?.limits?.wallDays ?? c?.etaDays ?? Infinity;
    if (i === 0) firstWall = wall;
    if (wall <= DEFAULT_DAYS) lo = i; else if (i > lo + 1) break;
  }
  return { params: snaps[lo], ok: firstWall <= FEASIBLE_DAYS };
}
/** Five parameter snaps around the selection. */
function paramWindow(at: number): number[] {
  const all = PARAM_SNAPS as readonly number[];
  let i = 0;
  for (let k = 1; k < all.length; k++) if (Math.abs(Math.log(all[k] / at)) < Math.abs(Math.log(all[i] / at))) i = k;
  const lo = Math.max(0, Math.min(all.length - 5, i - 2));
  return all.slice(lo, lo + 5);
}

// ───────── panel ─────────
export function Training({ s }: { s: GameStateV2 }) {
  useV2();
  const tab = tabOf('blueprint', 'next');
  const runs = s.player.models.runs.filter((r) => r.status === 'running' || r.status === 'paused').length;
  const tabs = <Tabs panel="blueprint" def="next" tabs={[{ id: 'next', label: 'Next run' }, { id: 'data', label: 'Data' }, { id: 'suites', label: 'Environments' }, { id: 'runs', label: 'Runs', badge: runs || undefined }]} />;
  return (
    <div className={`panel-v2 tr ${tab === 'next' ? 'tr-next' : ''}`} data-panel="blueprint">
      <PanelHead icon={ICON.runs} title="Training" tabs={tabs} />
      {tab === 'next' && <NextRun s={s} />}
      {tab === 'data' && <DataView s={s} />}
      {tab === 'suites' && <Suites s={s} />}
      {tab === 'runs' && <RunQueue s={s} />}
    </div>
  );
}

function NextRun({ s }: { s: GameStateV2 }) {
  const m = s.player.models;
  const lastBase = m.bases[m.bases.length - 1];
  const canBase = unlocked(s, 'baseRuns');
  const [fit] = useState(() => (canBase ? feasibleSize(s) : { params: Number(DEFAULTS.params), ok: false }));
  const defFor = (k: Kind, baseId = lastBase?.id ?? ''): Params => ({
    ...DEFAULTS, params: fit.params, poolShare: RUN_POOL_DEFAULT[k], baseId, ...(k === 'distill' ? { teacherVersionId: bestTeacher(s) } : {}),
    ...(m.bases.find((b) => b.id === baseId)?.design.shape === 'latent' ? { cot: 'latent' } : {}),
  });
  // MODELS › tree "post-train it" hands a base over (store tab key blueprint.start; read once).
  const [handed] = useState(() => { const id = store.tab['blueprint.start']; if (id) store.setTab('blueprint.start', ''); return id && m.bases.some((b) => b.id === id) ? id : undefined; });
  const [kind, setKindRaw] = useState<Kind>(handed ? 'post' : canBase && (fit.ok || !lastBase) ? 'base' : 'post');
  const [p, setP] = useState<Params>(() => defFor(kind, handed ?? lastBase?.id ?? ''));
  const [open, setOpen] = useState(false);
  const set = (np: Params) => setP(np.baseId !== p.baseId && m.bases.find((b) => b.id === np.baseId)?.design.shape === 'latent' ? { ...np, cot: 'latent' } : np);
  const start = (k: Kind, patch: Params = {}) => { setKindRaw(k); setP({ ...defFor(k, String(patch.baseId ?? lastBase?.id ?? '')), ...patch }); };
  const key = `${s.time.day}|${kind}|${JSON.stringify(p)}`;
  const { cur, pr, gains } = useMemo(() => {
    const cur = evaluate(s, kind, p);
    let pr: RunPressure | undefined;
    try { pr = plannedPressure(s, toLP(s, kind, p)); } catch { pr = undefined; }
    let gains;
    try { gains = skillGains(s, toLP(s, kind, p)); } catch { gains = { gains: [] }; }
    return { cur, pr, gains };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const card = cur.card;
  const pledged = s.player.safety.monitorabilityCommitment || liveCommitments(s).some((c) => c.condition.predicate === 'monitorabilityPledge');
  const warn: string[] = [];
  if (pledged && ((kind === 'base' && p.shape === 'latent') || (kind === 'post' && (p.cot === 'latent' || p.cot === 'pressured')))) warn.push('Breaks your monitorability pledge');
  if (kind === 'base' && s.player.dataPortfolio.assets.some((a) => a.kind === 'public' && !a.licensed)) warn.push('Unlicensed web crawl: copyright-suit risk');
  const launchParams: Params = { ...p, ...(kind === 'distill' ? { teacherVersionId: String(p.teacherVersionId || bestTeacher(s)) } : {}) };
  return (
    <div className="tr-main">
      <div className="tr-grid">
        <Prediction s={s} kind={kind} card={card} err={cur.err} gains={gains} />
        <Card className="tr-plan" home="runPlan" title={<span className="row-i"><SlidersHorizontal size={16} /><Term id="blueprint">Run plan</Term></span>}
          right={<button className="btn btn-sm" data-test="bp-reset" onClick={() => start(kind, kind === 'post' || kind === 'continue' ? { baseId: p.baseId } : {})}><RotateCcw size={12} /> Reset to Standard</button>}>
          <Stage n={1} title="Pretraining" days={kind === 'post' ? undefined : card?.etaDays} test="stage-pre">
            <StartFrom s={s} kind={kind} p={p} card={card} onStart={start} />
            {kind === 'base' && <>
              <SizeRow s={s} p={p} onPick={set} />
              {PRE_SLOTS.map((sl) => <SlotRow key={sl.field} s={s} kind={kind} sl={sl} p={p} onPick={set} extra={sl.field === 'data' && card?.limits ? () => <DrawRow s={s} card={card} preset={String(p.data)} /> : undefined} />)}
            </>}
            {(kind === 'post' || kind === 'continue') && <BaseFacts s={s} p={p} kind={kind} />}
            {kind === 'distill' && <DistilRows s={s} p={launchParams} onPick={set} />}
          </Stage>
          <Stage n={2} title="Post-training" days={kind === 'post' ? card?.etaDays : kind === 'base' && card ? postDaysAfterBase(s, card.flop) : undefined} test="stage-post">
            {kind === 'post' ? <>
              {POST_SLOTS.map((sl) => <SlotRow key={sl.field} s={s} kind={kind} sl={sl} p={p} onPick={set} />)}
              <MethodsRow s={s} p={p} onPick={set} />
              <SuitesRow s={s} p={p} />
            </> : (
              <div className="tr-opt tr-note" data-test="post-note">
                <span className="k">Plan</span>
                <span className="v small">{kind === 'base' ? <>Standard post-training follows; you choose its options when the base model is done. The prediction assumes Standard.</>
                  : kind === 'distill' ? <>A <Term id="distillRun">distilled</Term> model keeps its teacher&apos;s post-training and traits.</>
                  : <>A <Term id="continueRun">continued pretraining</Term> keeps the base model&apos;s post-trained models; post-train it again after.</>}</span>
              </div>
            )}
          </Stage>
          <Pushes s={s} cur={cur} pr={pr} open={open} setOpen={setOpen} />
        </Card>
      </div>
      <LimitsStrip s={s} kind={kind} card={card} p={p} setShare={(v) => setP({ ...p, poolShare: v })}>
        <ActBtn id={ACTION[kind]} params={launchParams} primary small={false} icon={Rocket} label="Launch" block={cur.err || card?.reason} reason />
        {warn.map((w) => <span key={w} className="small tone-warn">⚠ {w}</span>)}
      </LimitsStrip>
    </div>
  );
}

function Stage({ n, title, days, children, test }: { n: number; title: string; days?: number; children: ReactNode; test: string }) {
  return (
    <div className="tr-stage" data-test={test}>
      <div className="tr-sh"><span className="tr-num">{n}</span>{title}<span className="sp" />{days !== undefined && Number.isFinite(days) && <Tip content={() => <TipCard title={`${title} time`} value={F.days(days)}>At today&apos;s training compute and this run&apos;s share, plus the setup.</TipCard>}><span className="dim small num">{Math.round(days)} d</span></Tip>}</div>
      {children}
    </div>
  );
}

// ───────── Prediction (L1) ─────────
function Prediction({ s, kind, card, err, gains }: { s: GameStateV2; kind: Kind; card?: Card_; err?: string; gains: ReturnType<typeof skillGains> }) {
  const mid = midOf(card);
  const ref = s.player.models.versions.find((v) => v.name === gains.ref);
  const refName = gains.ref ?? internalVersion(s)?.name ?? 'your model';
  const axis = milestoneMarks(s);
  const pm = mid !== undefined ? planMilestone(s, mid) : {};
  const rp = readyParts(s, kind, card);
  const ready = card ? fmtDate(dateOf(s, s.time.day + rp.total)) : '—';
  const sd = ref ? measuredSd(ref) * 1.64 : 0;
  const rows: SkillRow[] = DOMS.map((d) => {
    const g = gains.gains.find((x) => x.d === d);
    const mk = skillMarksOf(s, d);
    const I = DOMAIN_ICON[d];
    return {
      key: d, label: DOMAIN_WORD[d], icon: I, marks: { median: mk.median, best: mk.best }, test: 'pred-row',
      ...(g ? { now: g.now, nowRange: [g.now - sd, g.now + sd] as [number, number], next: g.mid, nextRange: g.next } : {}),
      tip: () => (
        <TipCard title={<Term id="domains">{DOMAIN_WORD[d]}</Term>} value={g ? `${g.dLevels >= 0 ? '▲' : '▼'} ${F.num(Math.abs(g.dLevels), 2)} levels` : 'no forecast'} rows={g ? [
          { label: `${refName} today`, value: standing(g.now, mk) },
          { label: 'This run (best guess)', value: standing(g.mid, mk) },
          { label: 'This run, 90% range', value: `${F.dLevel(g.next[0] - g.now)} to ${F.dLevel(g.next[1] - g.now)} levels` },
          { label: 'Measured on', value: `${mk.test}${mk.standIn ? ' (stand-in)' : ''}` },
        ] : []} footer={<>{mk.fact}. Bars sit on the job scale: the median expert and the best human doing this job.{g && !g.measured ? ` ${refName} has no own fit in this skill yet: its nearest measured relative's.` : ''}</>}>
          What this run should give in {DOMAIN_WORD[d]}, from what you believe about your know-how and what your evals measured.
        </TipCard>
      ),
    };
  });
  const waitKey = kind === 'base' ? 'pre' : kind === 'post' ? 'rlMid' : undefined;
  const wait = waitKey ? knowHowAreas(s).find((a) => a.key === waitKey && a.waiting && a.waiting.x > 1.005) : undefined;
  const sc = useMemo(() => sightCurve(s), [s.time.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const readAt = (L: number) => { if (!sc.points.length) return undefined; const i = Math.max(0, Math.min(sc.points.length - 1, Math.round(L / 0.25))); return sc.points[i].mean; };
  const pc = (x?: number) => (x === undefined ? '—' : x < 0.01 ? '< 1%' : `~${Math.round(x * 100)}%`);
  const atNow = ref?.evals.measuredL !== undefined ? readAt(ref.evals.measuredL) : undefined;
  const atNext = mid !== undefined ? readAt(mid) : undefined;
  return (
    <Card className="tr-pred" home="runPrediction" title={<span className="row-i"><ICON.L size={16} /><Term id="domains">Prediction</Term></span>}
      sub={gains.ref ? <>what this run should give you, against <b className="w">{gains.ref}</b>, your newest measured model</> : undefined}>
      <Tip as="div" content={() => <TipCard title={pm.meets ? <Term id="milestone">{pm.meets.name}</Term> : 'Milestones'} value={ready} rows={[
        { label: 'Run', value: F.days(rp.run) }, ...(rp.post ? [{ label: 'Standard post-training after', value: F.days(rp.post) }] : []), { label: <Term id="evals">Evals</Term>, value: F.days(rp.evals) },
        ...(pm.next && pm.short !== undefined ? [{ label: `${pm.next.name}`, value: `${F.num(pm.short, 1)} levels further` }] : []),
      ]} footer="The milestone the forecast's best guess reaches on the capability scale; your evals decide when it is met.">When the new model is ready to use, after its evals.</TipCard>}>
        <div className="tr-ms" data-test="pred-milestone">
          <ICON.milestone size={18} />
          {mid === undefined ? <span className="dim">{err ?? (gains.reason ?? 'No forecast')}</span>
            : pm.meets ? <span>Would meet <b>{pm.meets.name}</b></span>
            : <span>No new milestone{pm.next ? <> · next: <b>{pm.next.name}</b></> : null}</span>}
          <span className="dim">·</span><span>ready <b data-test="bp-ready">{ready}</b></span>
          <span className="sp" />
          {wait?.waiting && (
            <Tip content={() => <TipCard title={<Term id="knowHow">Know-how waiting</Term>} value={`×${F.num(wait.waiting!.x, 2)}`} rows={[{ label: 'Ideas', value: String(wait.waiting!.ideas) }, { label: 'Since', value: fmtDate(dateOf(s, wait.waiting!.since)) }, { label: '90% range', value: `×${F.num(wait.waiting!.range[0], 2)} to ×${F.num(wait.waiting!.range[1], 2)}` }]}>{wait.name} know-how your newest model does not have yet: this run gets it.</TipCard>}>
              <button className="tr-link" data-test="pred-waiting" onClick={() => store.goto('research', { tab: 'recipe' })}>×{F.num(wait.waiting.x, wait.waiting.x < 10 ? 2 : 1)} {wait.name.toLowerCase()} know-how waiting <ChevronRight size={12} /></button>
            </Tip>
          )}
        </div>
      </Tip>
      <SkillLegend now={`${refName} today`} next="this run" />
      {rows.some((r) => r.now !== undefined) ? (
        <SkillBars rows={rows} axis={axis} head={{ median: rows[0].marks.median, best: rows[0].marks.best }} />
      ) : <div className="dim small tr-empty">{gains.reason ?? 'No model of yours is measured yet: the prediction shows once your evals have read one.'}</div>}
      {atNext !== undefined && (
        <Tip as="div" content={() => <TipCard title={<Term id="sightLimit">Instruments</Term>} rows={[{ label: `At ${refName}'s level`, value: pc(atNow) }, { label: 'At this run\'s level', value: pc(atNext) }]} footer="Mean believed reading of the hidden-goal traits (scheming, faking alignment, sandbagging, power seeking). Below 50% the model is past your sight limit.">How often your <Term id="detector">instruments</Term> would read a model at that level for hidden goals.</TipCard>}>
          <div className="tr-sight" data-test="pred-sight">
            <Eye size={15} />
            <span><Term id="detector">Your instruments</Term> read hidden goals <b>{pc(atNow)}</b> of the time at {refName}&apos;s level, <b className={atNext !== undefined && atNext < 0.5 ? 'tone-warn' : ''}>{pc(atNext)}</b> at this run&apos;s</span>
            <span className="sp" />
            <Ref id="sightLimit" to={{ panel: 'safety', tab: 'instruments' }}>instruments</Ref>
          </div>
        </Tip>
      )}
    </Card>
  );
}

// ───────── Run plan rows ─────────
/** Jul 22 this year, Oct 25, 2025 otherwise. */
const shortDate = (s: GameStateV2, day: number) => { const d = fmtDate(dateOf(s, day)); const y = fmtDate(dateOf(s, s.time.day)).slice(-4); return d.endsWith(y) ? d.replace(/, \d{4}$/, '') : d; };
interface StartOpt { id: string; label: string; kind: Kind; patch: Params; locked?: string }
function startOptions(s: GameStateV2): StartOpt[] {
  const m = s.player.models;
  const canBase = unlocked(s, 'baseRuns');
  const bases = [...m.bases].reverse().slice(0, 2);
  const out: StartOpt[] = [{ id: 'new', label: 'New base', kind: 'base', patch: {}, ...(canBase ? {} : { locked: 'New base models unlock later in the game (Act 2)' }) }];
  for (const b of bases) out.push({ id: `post:${b.id}`, label: `Use ${b.name} (pretrained ${shortDate(s, b.day)})`, kind: 'post', patch: { baseId: b.id } });
  const lb = m.bases[m.bases.length - 1];
  out.push({ id: 'continue', label: 'Continue', kind: 'continue', patch: { baseId: lb?.id ?? '' }, ...(canBase && lb ? {} : { locked: canBase ? 'No base model to continue' : 'Continued pretraining unlocks with new base models (Act 2)' }) });
  out.push({ id: 'distill', label: 'Distil', kind: 'distill', patch: {}, ...(bestTeacher(s) ? {} : { locked: 'No model to distil from' }) });
  return out;
}
const startIdOf = (kind: Kind, p: Params) => (kind === 'base' ? 'new' : kind === 'post' ? `post:${p.baseId}` : kind);
function StartFrom({ s, kind, p, card, onStart }: { s: GameStateV2; kind: Kind; p: Params; card?: Card_; onStart: (k: Kind, patch?: Params) => void }) {
  const opts = startOptions(s);
  const sel = startIdOf(kind, p);
  const curE = { card, tp: {} as Partial<Record<TraitId, number>> };
  const table = useMemo(() => opts.filter((o) => !o.locked).map((o) => {
    const k = o.kind;
    const pp: Params = { ...RUN_PARAM_DEFAULTS, params: p.params, tpp: p.tpp, poolShare: RUN_POOL_DEFAULT[k], baseId: String(o.patch.baseId ?? p.baseId ?? ''), ...(k === 'distill' ? { teacherVersionId: bestTeacher(s) } : {}), ...(o.id === sel ? p : {}) };
    return { o, e: evaluate(s, k, pp) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [s.time.day, sel, JSON.stringify(p)]);
  const selE = table.find((r) => r.o.id === sel)?.e ?? curE;
  return (
    <div className="tr-opt opened" data-line="start">
      <span className="k"><Term id="baseRun">Start from</Term></span>
      <span className="v">
        {opts.map((o) => (
          <Tip key={o.id} content={() => <TipCard title={o.label} value={o.locked ? <span className="tag2">locked</span> : o.id === sel ? <span className="tag2">selected</span> : undefined}>{o.locked ?? `Plan a ${KIND_WORD[o.kind]} run.`}</TipCard>}>
            <button className={`tr-pill ${o.id === sel ? 'on' : ''} ${o.locked ? 'lk' : ''}`} data-start={o.id} data-bp-kind={o.id === 'new' ? 'base' : o.id.startsWith('post') && o.id === `post:${s.player.models.bases[s.player.models.bases.length - 1]?.id}` ? 'post' : o.kind === 'post' ? undefined : o.kind}
              disabled={!!o.locked} onClick={() => onStart(o.kind, o.patch)}>{o.locked && <Lock size={11} />}{o.label}</button>
          </Tip>
        ))}
      </span>
      <div className="tr-otab" data-test="start-table">
        <div className="oh"><span /><span>Skill</span><span>Time</span><span>Cost</span><span>Serving</span><span>Risk</span></div>
        {table.map(({ o, e }) => <EffRow key={o.id} label={o.label} on={o.id === sel} a={selE} b={e} />)}
      </div>
    </div>
  );
}
/** One row of effects: option b against the selected plan a (▲ / ▼ on screen; numbers in the tooltip). */
function EffRow({ label, on, a, b }: { label: string; on: boolean; a: Eval; b: Eval }) {
  const ca = a.card, cb = b.card;
  const ma = midOf(ca), mb = midOf(cb);
  const dL = ma !== undefined && mb !== undefined ? mb - ma : 0;
  const dD = ca && cb ? cb.etaDays - ca.etaDays : 0;
  const dC = ca && cb ? cb.cash - ca.cash : 0;
  const sx = ca && cb && ca.fpt > 0 ? cb.fpt / ca.fpt : 1;
  const fam = FAMILIES.map((f) => [f, famSum(b, f) - famSum(a, f)] as const).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
  const risk = fam && arrows(fam[1]) ? <span className={fam[1] > 0 ? 'tone-neg' : 'tone-pos'}>{fam[1] > 0 ? '▲' : '▼'} {fam[0].label}</span> : <span className="dim">—</span>;
  return (
    <Tip as="div" content={() => <TipCard title={label} value={on ? 'selected' : 'vs selected'} rows={on ? [] : [
      { label: 'Skill', value: `${F.dLevel(dL)} levels` }, { label: 'Time', value: F.days(dD, true) }, { label: 'Cash at launch', value: F.money(dC, { signed: true }) },
      { label: 'Serving cost', value: `×${sx.toFixed(2)}` }, ...FAMILIES.map((f) => ({ label: f.label, value: arrows(famSum(b, f) - famSum(a, f)) || '=' })),
    ]}>{b.card?.reason ?? (on ? 'The start your plan uses now.' : 'What this start would change against your plan.')}</TipCard>}>
      <div className={`or ${on ? 'on' : ''}`}>
        <span>{label}{on && <span className="std"> selected</span>}</span>
        <span>{on || Math.abs(dL) < 0.05 ? <span className="dim">—</span> : dL > 0 ? <span className="tone-pos">▲</span> : <span className="tone-neg">▼</span>}</span>
        <span className="num">{on || Math.abs(dD) < 1 ? <span className="dim">—</span> : F.days(dD, true)}</span>
        <span className="num">{on || Math.abs(dC) < 0.05 ? <span className="dim">—</span> : F.money(dC, { signed: true })}</span>
        <span className="num">{on || Math.abs(sx - 1) < 0.01 ? <span className="dim">—</span> : `×${sx.toFixed(2)}`}</span>
        <span>{on ? <span className="dim">—</span> : risk}</span>
      </div>
    </Tip>
  );
}

function SizeRow({ s, p, onPick }: { s: GameStateV2; p: Params; onPick: (p: Params) => void }) {
  const at = Number(p.params);
  const tpp = Number(p.tpp);
  const lastBase = s.player.models.bases[s.player.models.bases.length - 1];
  return (
    <div className="tr-opt" data-line="size">
      <span className="k"><Term id="baseSize">Size</Term></span>
      <span className="v">
        {paramWindow(at).map((v) => (
          <Tip key={v} content={() => <SizeTip s={s} p={p} v={v} />}>
            <button className={`tr-pill ${v === at ? 'on' : ''}`} data-test="bp-params" data-size={v} onClick={() => onPick({ ...p, params: v })}>{fmtParams(v)}{v === at ? ' parameters' : ''}</button>
          </Tip>
        ))}
        <Tip content={() => <TipCard title={<Term id="tokensPerParam">Tokens per parameter</Term>} value={tppLabel(tpp)} footer={lastBase ? `Your latest base model, ${lastBase.name}: ${fmtParams(lastBase.params)} × ${lastBase.design.tpp}.` : undefined}>Fewer parameters on more tokens serve cheaper but are worth less effective compute.</TipCard>}>
          <select className="text-input tr-sel" data-test="bp-tpp" value={tpp} onChange={(e) => onPick({ ...p, tpp: Number(e.target.value) })}>{(TPP_SNAPS as readonly number[]).map((v) => <option key={v} value={v}>× {v} tokens</option>)}</select>
        </Tip>
      </span>
    </div>
  );
}
function SizeTip({ s, p, v }: { s: GameStateV2; p: Params; v: number }) {
  const c = evaluate(s, 'base', { ...p, params: v }).card;
  const wall = c?.limits?.wallDays ?? c?.etaDays;
  return (
    <TipCard title={<>{fmtParams(v)} <Term id="activeParams">active parameters</Term></>} value={wall !== undefined && Number.isFinite(wall) ? F.days(wall) : '—'} rows={c?.limits ? [
      { label: <Term id="tokensPerParam">Tokens</Term>, value: `${F.short(c.limits.tokens / 1e12)}T (${p.tpp} per parameter)` },
      { label: 'Compute-equivalent cost', value: F.money(c.limits.computeCost) },
    ] : []} footer={wall !== undefined && wall > FEASIBLE_DAYS ? 'A long run: the base model would finish far behind. Buy compute, or post-train an existing base model.' : 'At today\'s training compute and the run\'s share.'}>More parameters: more capable, longer run, dearer to serve.</TipCard>
  );
}

function SlotRow({ s, kind, sl, p, onPick, extra }: { s: GameStateV2; kind: Kind; sl: Slot; p: Params; onPick: (p: Params) => void; extra?: (open: boolean, toggle: ReactNode) => ReactNode }) {
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState(false);
  const toggle = extra ? <button className="tr-more small" data-test="bp-draw-open" onClick={() => setOpen(!open)}>drawn mix {open ? '▴' : '▾'}</button> : null;
  const shown = more ? sl.opts : sl.opts.filter((o, i) => i < 4 || isOn(sl, p, o.v));
  return (
    <div className="tr-opt" data-line={sl.field}>
      <span className="k"><Term id={sl.term}>{sl.label}</Term></span>
      <span className="v">
        {shown.map((o) => <OptPill key={String(o.v)} s={s} kind={kind} sl={sl} o={o} p={p} onPick={onPick} />)}
        {shown.length < sl.opts.length && <button className="tr-more small" data-test="bp-more" onClick={() => setMore(true)}>+{sl.opts.length - shown.length}</button>}
        {toggle}
      </span>
      {extra && open ? extra(open, toggle) : null}
    </div>
  );
}
function OptPill({ s, kind, sl, o, p, onPick }: { s: GameStateV2; kind: Kind; sl: Slot; o: Opt; p: Params; onPick: (p: Params) => void }) {
  const on = isOn(sl, p, o.v);
  const lockKey = sl.lockSlot;
  const lockVal = sl.multi === 'toggle' ? String(o.v) : o.v;
  const locked = !on && o.v !== 'broad' ? optionLocked(s, lockKey as never, lockVal) : undefined;
  const nodeId = OPTION_NODE[`${lockKey}:${String(lockVal)}`];
  const testId = `${sl.field}:${String(o.v)}`;
  if (locked) {
    const n = nodeId ? TREE_BY_ID[nodeId] : undefined;
    const st = nodeId ? nodeStatus(s, nodeId) : undefined;
    return (
      <Tip content={() => <TipCard title={<>{o.label} <Lock size={11} /></>} value={<span className="tag2">locked</span>} rows={n ? [{ label: 'Unlocked by', value: n.name }, { label: 'Status', value: st === 'active' ? `${F.pct(s.player.tree[nodeId!]?.progress ?? 0)} researched` : F.words(st ?? '') }] : []} footer={n ? 'Click to open the discovery in Research.' : undefined}>{locked}</TipCard>}>
        <button className="tr-pill lk bp-opt locked" data-opt={testId} data-node={nodeId} onClick={() => { if (nodeId) { store.setTab('research.sel', nodeId); store.goto('research', { tab: 'tree' }); } }}><Lock size={11} />{o.label}</button>
      </Tip>
    );
  }
  const np = withOpt(sl, p, o.v);
  return (
    <Tip content={on ? () => <TipCard title={o.label} value={<span className="tag2">selected</span>}>{sl.multi ? 'Click to turn it off.' : 'The option this plan uses.'}</TipCard> : () => <OptPreview s={s} kind={kind} label={o.label} p={p} np={np} />}>
      <button className={`tr-pill ${on ? 'on' : ''}`} data-opt={testId} onClick={() => onPick(np)}>{o.label}</button>
    </Tip>
  );
}
/** Hover preview of an alternative option: Skill · Time · Cost · Serving · Risk against the current plan. */
function OptPreview({ s, kind, label, p, np }: { s: GameStateV2; kind: Kind; label: string; p: Params; np: Params }) {
  const a = evaluate(s, kind, p);
  const b = evaluate(s, kind, np);
  if (!a.card || !b.card) return <TipCard title={label}>{b.err ?? a.err}</TipCard>;
  if (b.card.reason && b.card.reason !== a.card.reason) return <TipCard title={label} value={<span className="tone-neg">blocked</span>}>{b.card.reason}</TipCard>;
  const ma = midOf(a.card), mb = midOf(b.card);
  return (
    <TipCard title={label} value={<span className="tag2">preview</span>} rows={[
      { label: 'Skill', value: ma !== undefined && mb !== undefined ? `${mb - ma >= 0.05 ? '▲' : mb - ma <= -0.05 ? '▼' : '='} ${F.dLevel(mb - ma)} levels` : '—' },
      { label: 'Time', value: F.days(b.card.etaDays - a.card.etaDays, true) },
      { label: 'Cash at launch', value: F.money(b.card.cash - a.card.cash, { signed: true }) },
      { label: 'Serving cost', value: `×${(a.card.fpt > 0 ? b.card.fpt / a.card.fpt : 1).toFixed(2)}` },
      ...FAMILIES.map((f) => ({ label: f.label, value: arrows(famSum(b, f) - famSum(a, f)) || '=' })),
    ]}>vs your current plan</TipCard>
  );
}

function BaseFacts({ s, p, kind }: { s: GameStateV2; p: Params; kind: Kind }) {
  const m = s.player.models;
  const b = m.bases.find((x) => x.id === p.baseId);
  return (
    <>
      <div className="tr-opt" data-line="base">
        <span className="k"><Term id="base">Base model</Term></span>
        <span className="v">
          {b && <b data-test="bp-base">{b.name}</b>}
          {b && <span className="dim small">{fmtParams(b.params)} parameters · {MIX_WORD[b.design.data] ?? b.design.data} · {SHAPE_WORD[b.design.shape] ?? b.design.shape}{b.design.curation.hazard ? ' · hazard filter' : ''}</span>}
        </span>
      </div>
      {kind === 'continue' && <div className="tr-opt tr-note"><span className="k">Plan</span><span className="v small"><Term id="continueRun">Continued pretraining</Term> on {b?.name ?? 'the base'} with today&apos;s know-how.</span></div>}
    </>
  );
}
function DistilRows({ s, p, onPick }: { s: GameStateV2; p: Params; onPick: (p: Params) => void }) {
  const vs = s.player.models.versions.filter((v) => v.status !== 'retired' && v.status !== 'rolledBack');
  return (
    <>
      <div className="tr-opt" data-line="teacher">
        <span className="k"><Term id="distill">Teacher</Term></span>
        <span className="v"><select className="text-input tr-sel" data-test="bp-teacher" value={String(p.teacherVersionId)} onChange={(e) => onPick({ ...p, teacherVersionId: e.target.value })}>{vs.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></span>
      </div>
      <div className="tr-opt" data-line="student">
        <span className="k"><Term id="cheapTier">Size</Term></span>
        <span className="v">
          <Tip content={() => <TipCard title={<Term id="cheapTier">Student size</Term>}>{`${STUDENT_WORDS[0].toUpperCase()}${STUDENT_WORDS.slice(1)} the teacher's active parameters by default. "Match" sizes the smallest student that reaches that model's skill: a cheaper tier for a lineup.`}</TipCard>}>
            <select className="text-input tr-sel" data-test="bp-hold" value={String(p.holdVersionId ?? '')} onChange={(e) => onPick({ ...p, holdVersionId: e.target.value })}>
              <option value="">{STUDENT_WORDS} the teacher</option>
              {vs.filter((v) => v.id !== p.teacherVersionId).map((v) => <option key={v.id} value={v.id}>match {v.name}</option>)}
            </select>
          </Tip>
        </span>
      </div>
    </>
  );
}
function MethodsRow({ s, p, onPick }: { s: GameStateV2; p: Params; onPick: (p: Params) => void }) {
  const owned = ownedMethods(s);
  const insts = againstOptions(s);
  const cur = postFromParams(p, s).methods;
  const toggle = (id: string) => onPick({ ...p, methods: (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]).join(',') });
  const policy = methodPolicyOn(s);
  const name = (id: string) => TECH_NAME[id] ?? id;
  const nAgainst = insts.filter((id) => cur.includes(AGAINST + id)).length;
  const [showAgainst, setShowAgainst] = useState(nAgainst > 0);
  return (
    <div className="tr-opt" data-line="methods" data-test="bp-methods">
      <span className="k"><Term id="safetyMethod">Methods</Term></span>
      <span className="v">
        {owned.length === 0 ? <span className="dim small">none yet (safety research unlocks them)</span> : owned.map((id) => {
          const d = METHOD_BY_ID[id];
          return (
            <Tip key={id} content={() => <TipCard title={name(id)} value={cur.includes(id) ? 'used' : 'not used'} rows={[{ label: 'Cost', value: d.cost ?? 'none of its own' }]}>{d.effect}. Applies to this run only if on.</TipCard>}>
              <button className={`tr-pill ${cur.includes(id) ? 'on' : ''}`} data-test={`bp-method-${id}`} onClick={() => toggle(id)}>{name(id)}</button>
            </Tip>
          );
        })}
        {insts.length > 0 && <Tip content={() => <TipCard title="Train against an instrument">Training against an instrument lowers what it sees far more than the trait itself: it hides the trait from that instrument. Never on by default.</TipCard>}><button className={`tr-more small ${nAgainst ? 'tone-warn' : ''}`} data-test="bp-against-toggle" onClick={() => setShowAgainst(!showAgainst)}>⚑ train against{nAgainst ? ` (${nAgainst})` : ''} {showAgainst ? '▴' : '▾'}</button></Tip>}
        {showAgainst && insts.map((id) => {
          const k = AGAINST + id;
          return (
            <Tip key={k} content={() => <TipCard title={`Train against ${name(id)}`} value={cur.includes(k) ? 'used' : 'not used'}>What {name(id)} sees falls 70–90%; the true trait falls only 20–40%. {name(id)} gets a trained-against mark: its reliability on the new model drops.</TipCard>}>
              <button className={`tr-pill warn ${cur.includes(k) ? 'on' : ''}`} data-test={`bp-against-${id}`} onClick={() => toggle(k)}>⚑ vs {name(id)}</button>
            </Tip>
          );
        })}
        <ActBtn id="safety.methodPolicy" params={{ on: !policy }} label={policy ? 'Use all known: on' : 'Use all known: off'} testId="bp-method-policy" />
      </span>
    </div>
  );
}
function SuitesRow({ s, p }: { s: GameStateV2; p: Params }) {
  const post = postFromParams(p);
  const v = suitesView(s, post.rlFocus);
  const fams = v.rows.filter((r) => r.share > 0).length;
  return (
    <div className="tr-opt" data-line="env">
      <span className="k"><Term id="envSuite">Environments</Term></span>
      <span className="v">
        <Tip content={() => <TipCard title={<Term id="envSuite">Environments</Term>} rows={[{ label: 'Families this run trains in', value: String(fams) }, { label: <Term id="suiteFidelity">Realism</Term>, value: `×${v.weighted.fid.toFixed(2)}` }, { label: <Term id="suiteExploit">Loopholes</Term>, value: F.pct(v.weighted.exploit, 1) }]} footer="Weighted by this run's post-training per family. Expand and harden them on the Environments tab.">[[suiteFidelity|Realism]] scales each family&apos;s post-training ceiling; [[suiteExploit|loopholes]] drive [[rewardHackPressure|hacking pressure]].</TipCard>}>
          <button className="tr-pill on" data-test="bp-suites" onClick={() => openSuites(p)}>{fams} families · realism ×{v.weighted.fid.toFixed(2)} · loopholes {F.pct(v.weighted.exploit, 1)}</button>
        </Tip>
      </span>
    </div>
  );
}

// ───────── drawn mix (L2 under the Data mix row) ─────────
const PRESET_LABEL = MIX_WORD;
/** Effective-compute change in player units (+10%, ×2.5): never OOM. */
const fmtOom = (x: number) => effX(x);
/** Tokens: 50T, 800B. */
const fmtTok = (n: number) => (n >= 1e12 ? `${n >= 1e14 ? Math.round(n / 1e12) : +(n / 1e12).toFixed(1)}T` : `${Math.round(n / 1e9)}B`);
/** The base's draw from the data portfolio (model v3 D4): drawn (effective) share per domain against the standard share,
 *  the specialisation per domain with its cap, and repetition. */
/** The base's draw from the data portfolio (model v3 D4): drawn (effective) share per domain against the reference
 *  share, the specialisation per domain with its ±1.3 OOM cap, and repetition (unique tokens this mix can use vs the
 *  base's tokens, the most-repeated domain's epochs). The portfolio and its natural mix live on Models › Data. */
function DrawRow({ s, card, preset }: { s: GameStateV2; card: Card_; preset: string }) {
  const L = card.limits!;
  const { rows, most } = drawByDomain(s, L.draw);
  const t = mixTargetOf(preset);
  const max = Math.sqrt(Math.max(0.05, ...rows.map((r) => Math.max(r.effShare, r.ref))));
  const h = (x: number) => `${Math.min(1, Math.sqrt(Math.max(0, x)) / max) * 100}%`;
  const tilts = t ? Object.entries(t.weights).map(([d, x]) => `${domainWord(d)} ×${x}`).concat(Object.entries(t.kinds).map(([k, x]) => `${k} ×${x}`)).join(', ') : '';
  const presetTip = () => (
    <TipCard title={<Term id="drawnMix">Data mix</Term>} value={PRESET_LABEL[preset] ?? preset} rows={[
      { label: 'Starts from', value: 'your natural mix' }, { label: 'Weights', value: tilts || 'none' },
      { label: <Term id="dataQuality">Mean quality drawn</Term>, value: L.draw.quality.toFixed(2) },
      ...(Object.entries(L.draw.byKind) as [string, number][]).map(([k, x]) => ({ label: `Tokens from ${k}`, value: fmtTok(x) })),
    ]} footer="The portfolio and its natural mix: Training › Data.">What this base model draws from your [[dataPortfolio|data]] by domain.</TipCard>
  );
  const repTip = () => (
    <TipCard title={<Term id="domainEpochs">Most re-read domain</Term>} value={most ? `${domainWord(most.domain)} re-read ×${most.epochs.toFixed(2)}` : '–'} rows={[...rows].sort((a, b) => b.epochs - a.epochs).slice(0, 4).map((r) => ({ label: domainWord(r.domain), value: `×${r.epochs.toFixed(2)}` }))}
      footer="Re-reading up to about 4 times is nearly free. Tokens vs the unique tokens this mix can use, and the compute kept: the Data limit below.">A mix tilted toward a short domain re-reads it first.</TipCard>
  );
  return (
    <div className="bp-drawline" data-line="draw">
      <div className="bp-draw" data-test="bp-draw">
        <span className="bp-draw-k small dim"><Term id="drawnMix">drawn</Term> vs <Term id="refShare">standard</Term> · <Term id="dataSpec">specialisation</Term></span>
        <span className="bp-draw-cols">
          {rows.map((r) => {
            const I = DOMAIN_ICON[r.domain];
            const sBase = L.sD[r.domain] ?? 0;
            const capped = Math.abs(r.s) >= SPEC_CAP - 1e-6;
            return (
              <Tip key={r.domain} content={() => <TipCard title={<><Term id="drawnMix">Drawn</Term> · {domainWord(r.domain)}</>} value={F.pct(r.effShare, 1)} rows={[
                { label: 'Drawn share', value: F.pct(r.share, 1) }, { label: 'Effective share (after re-reads)', value: F.pct(r.effShare, 1) },
                { label: <Term id="refShare">Standard share</Term>, value: F.pct(r.ref, 1) },
                { label: <Term id="dataSpec">Specialisation from the mix</Term>, value: `${fmtOom(r.s)}${capped ? ' (cap)' : ''}` },
                ...(Math.abs(sBase - r.s) > 0.005 ? [{ label: 'With curation (hazard filter)', value: `${fmtOom(sBase)}` }] : []),
                { label: <Term id="domainEpochs">Re-reads</Term>, value: `×${r.epochs.toFixed(2)}` },
              ]} footer={`Ten times the standard share gives ${fmtOom(1.5)} effective compute in the domain, at most ${fmtOom(SPEC_CAP)}.`}>This base model&apos;s share of {domainWord(r.domain)} tokens.</TipCard>}>
                <span className="bp-dcol" data-dom={r.domain} data-share={r.effShare.toFixed(4)} data-s={r.s.toFixed(3)}>
                  <I size={11} />
                  <span className="bp-dtrack"><i style={{ height: h(r.effShare) }} className={r.s > 0.005 ? 'pos' : r.s < -0.005 ? 'neg' : ''} /><b style={{ bottom: h(r.ref) }} /></span>
                  <span className={`bp-ds ${r.s > 0.005 ? 'tone-pos' : r.s < -0.005 ? 'tone-neg' : 'dim'}${capped ? ' cap' : ''}`}>{Math.abs(r.s) < 0.005 ? '0' : fmtOom(r.s)}</span>
                </span>
              </Tip>
            );
          })}
        </span>
        <Tip content={repTip}>
          <span className="bp-draw-rep small" data-test="bp-draw-rep"><span className="dim"><Term id="domainEpochs">most re-read</Term></span><span>{most ? domainWord(most.domain) : '–'} <b className="num">{most ? `×${most.epochs.toFixed(2)}` : '–'}</b></span></span>
        </Tip>
        <Tip content={presetTip}><span className="dch" data-test="bp-draw-q"><span className="k">quality</span><b>{L.draw.quality.toFixed(2)}</b></span></Tip>
        <button className="btn btn-sm btn-ghost" data-test="bp-to-data" onClick={() => store.goto('blueprint', { tab: 'data' })}>Data ›</button>
      </div>
    </div>
  );
}

// ───────── Pushes (summary L1, details L2) ─────────
function Pushes({ s, cur, pr, open, setOpen }: { s: GameStateV2; cur: Eval; pr?: RunPressure; open: boolean; setOpen: (b: boolean) => void }) {
  const iv = internalVersion(s);
  const fam = FAMILIES.map((f) => ({ f, d: famSum(cur, f) }));
  const up = fam.filter((x) => x.d > 0 && arrows(x.d));
  const down = fam.filter((x) => x.d < 0 && arrows(x.d));
  const little = fam.filter((x) => !arrows(x.d));
  const sp = successorPullView(s);
  const pullers = [...new Set(sp.parts.map((x) => x.versionId))].map((id) => versionById(s, id)?.name ?? id);
  const famTip = (f: (typeof FAMILIES)[number], d: number) => () => (
    <TipCard title={<Term id="riskFamily">{f.label}</Term>} value={arrows(d) || '='}>
      {f.traits.filter((t) => arrows(cur.tp[t] ?? 0)).map((t) => <div key={t} className="row-i small"><span>{TRAIT_BY_ID[t].name}</span><span className="sp" /><b className={(cur.tp[t] ?? 0) > 0 ? 'tone-neg' : 'tone-pos'}>{arrows(cur.tp[t] ?? 0)}</b></div>)}
      <div className="dim small">Predicted change of your trait beliefs vs {iv?.name ?? 'your model'}, from this run&apos;s signals and size.</div>
    </TipCard>
  );
  return (
    <div className="tr-push" data-home="runPressure">
      <div className="row-i" data-test="bp-risk">
        <span className="dim"><Term id="trainingPressure">Pushes</Term></span>
        {up.map(({ f, d }) => <Tip key={f.id} content={famTip(f, d)}><span className="tone-neg" data-family={f.id}>▲ {f.label}</span></Tip>)}
        {down.map(({ f, d }) => <Tip key={f.id} content={famTip(f, d)}><span className="tone-pos" data-family={f.id}>▼ {f.label}</span></Tip>)}
        {little.length > 0 && <span className="dim">{little.map((x) => x.f.label).join(', ')}: little</span>}
        <span className="sp" />
        <button className="tr-link" data-test="bp-push-details" onClick={() => setOpen(!open)}>{open ? 'hide' : 'details'} <ChevronRight size={12} /></button>
      </div>
      {open && (
        <div className="tr-push-body">
          <div className="row-i small"><span className="dim">signals of this run</span><span className="sp" />{pr && <OmegaChip p={pr} />}</div>
          {pr ? <PressureRows p={pr} testId="bp-pressure" /> : <div className="dim small">No run to read</div>}
          <Tip as="div" content={() => <TipCard title={<Term id="successorPull">Successor steering</Term>} value={F.num(sp.omega, 2)} rows={[
            { label: <Term id="aiRdShare">AI share of R&D</Term>, value: F.pct(sp.r) },
            ...sp.parts.map((x) => ({ label: <>{versionById(s, x.versionId)?.name ?? x.versionId} on {x.slot === 'SWE' ? 'software' : x.slot === 'EXP' ? 'experiments' : 'research ideas'}</>, value: `${F.pct(x.share)} · ${F.pct(x.oversight)} stopped` })),
          ]}>When this run finishes, its new model&apos;s traits move toward those of the models doing your research, more the more of it they do unwatched.</TipCard>}>
            <div className="bp-succ small row-i" data-test="bp-succ"><ICON.agents size={12} /><span><Term id="successorPull">Successor pull</Term> from {pullers.length ? pullers.join(', ') : 'no AI model'}</span><span className="sp" /><Ref id="successorPull" to={{ panel: 'safety', tab: 'overview', anchor: 'successorPull' }}>Safety</Ref></div>
          </Tip>
        </div>
      )}
    </div>
  );
}

// ───────── Limits strip + Launch ─────────
interface Lim { id: string; icon: LucideIcon; label: ReactNode; v: ReactNode; u: ReactNode; sub: ReactNode; word: string; tone: 'ok' | 'short'; tip: () => ReactNode }
function LimitsStrip({ s, kind, card, p, setShare, children }: { s: GameStateV2; kind: Kind; card?: Card_; p: Params; setShare: (v: number) => void; children: ReactNode }) {
  const lims: Lim[] = [];
  const day = s.time.day;
  if (card) {
    const L = card.limits;
    const run = card.etaDays;
    const rp = readyParts(s, kind, card);
    const share = Number(p.poolShare);
    lims.push({
      id: 'compute', icon: ICON.compute, label: <Term id="trainingPool">Compute</Term>, v: Math.round(run), u: 'days', word: run > FEASIBLE_DAYS ? 'Long' : 'Enough', tone: run > FEASIBLE_DAYS ? 'short' : 'ok',
      sub: <>uses {F.pct(card.effShare)} of training compute{card.effShare < card.poolShare - 1e-6 ? <span className="tone-warn"> (asks {F.pct(card.poolShare)})</span> : null}
        <span className="tr-shares">{[0.2, 0.4, 0.6, 0.8, 1].map((v) => <button key={v} className={`tr-mini ${Math.abs(v - share) < 1e-6 ? 'on' : ''}`} data-pool={v} onClick={() => setShare(v)}>{F.pct(v)}</button>)}</span>
        <Ref id="poolTraining" to={{ panel: 'lab' }}>training share</Ref></>,
      tip: () => <TipCard title={<Term id="poolShare">Run time</Term>} value={F.days(run)} rows={[
        { label: <Term id="flop">Compute</Term>, value: hd(card.flop) },
        { label: <><Term id="poolShare">Share of training compute</Term> asked → gets</>, value: `${F.pct(card.poolShare)} → ${F.pct(card.effShare)}` },
        { label: <Term id="runSetup">Setup</Term>, value: F.days(card.setupDays) },
      ]} footer="The training compute itself is set on Lab; here you set this run's share of it.">Days the run trains at today&apos;s training compute, plus the setup.</TipCard>,
    });
    lims.push({
      id: 'ready', icon: CalendarDays, label: 'Ready', v: fmtDate(dateOf(s, day + rp.total)).replace(/, \d{4}$/, ''), u: fmtDate(dateOf(s, day + rp.total)).slice(-4), word: 'On plan', tone: 'ok',
      sub: <>{kind === 'base' ? <>pretraining ends {fmtDate(dateOf(s, day + run)).replace(/, \d{4}$/, '')} · post-training {rp.post} d</> : <>training {Math.round(run)} d</>} · <Ref id="evalQueue" to={{ panel: 'models', tab: 'evals' }}>evals {Math.round(rp.evals)} d</Ref></>,
      tip: () => <TipCard title="Ready" value={fmtDate(dateOf(s, day + rp.total))} rows={[{ label: 'Run', value: F.days(run) }, ...(rp.post ? [{ label: 'Standard post-training', value: F.days(rp.post) }] : []), { label: <Term id="evals">Evals</Term>, value: F.days(rp.evals) }]} footer="Chips on order shorten it.">When the new model can be used.</TipCard>,
    });
    if (L) {
      const reads = L.tokens / Math.max(1, L.tokensUnique);
      lims.push({
        id: 'data', icon: ICON.data, label: <Term id="dataTokens">Data</Term>, v: F.num(reads, 2), u: 'reads per token', word: L.fData < 0.99 ? 'Short' : 'Enough', tone: L.fData < 0.99 ? 'short' : 'ok',
        sub: <>{reads <= 1 ? 'no token read twice' : `re-reading costs ${effX(Math.log10(L.fData))}`} <Limit id="model.dataSpec" tone="quiet">mix ≤ {effX(SPEC_CAP)}</Limit> <button className="tr-link" data-test="bp-to-data" onClick={() => store.goto('blueprint', { tab: 'data' })}>data <ChevronRight size={11} /></button></>,
        tip: () => <TipCard title={<Term id="dataTokens">Data</Term>} value={`${F.num(reads, 2)} reads per token`} rows={[
          { label: 'Tokens of this base model', value: `${F.short(L.tokens / 1e12)}T` }, { label: <Term id="uniqueTokens">Unique tokens for this mix</Term>, value: `${F.short(L.tokensUnique / 1e12)}T` },
          { label: <Term id="dataWall">Effective compute kept</Term>, value: F.pct(L.fData) }, { label: <Term id="dataQuality">Mean quality drawn</Term>, value: F.num(L.draw.quality, 2) },
        ]} footer="Re-reading up to about 4 times costs almost nothing.">How many times the base model reads each unique token its data mix can use.</TipCard>,
      });
    } else {
      lims.push({ id: 'data', icon: ICON.data, label: <Term id="dataTokens">Data</Term>, v: '—', u: 'no new tokens', word: 'Enough', tone: 'ok', sub: <>{KIND_WORD[kind]} reads no new pretraining data</>, tip: () => <TipCard title={<Term id="dataTokens">Data</Term>}>Only a new base model draws pretraining tokens.</TipCard> });
    }
    const cash = s.player.finance.cash;
    lims.push({
      id: 'cash', icon: ICON.cash, label: <Term id="cash">Cash</Term>, v: F.money(card.cash), u: 'at launch', word: card.cash > cash ? 'Short' : 'Enough', tone: card.cash > cash ? 'short' : 'ok',
      sub: <>compute you own{L ? <> (worth {F.money(L.computeCost)})</> : null}</>,
      tip: () => <TipCard title="Cash at launch" value={F.money(card.cash)} rows={[{ label: 'Your cash', value: F.money(cash) }, ...(L ? [{ label: 'Compute-equivalent cost', value: F.money(L.computeCost) }] : [])]} footer="Only the science-journals data mix costs cash at launch; the compute is your training compute, already paid for.">Committed when you launch.</TipCard>,
    });
    const re = reAllocView(s);
    lims.push({
      id: 'ops', icon: ICON.roleRE, label: <Term id="runOps">Run operations</Term>, v: Math.max(1, Math.round(card.setupDays)), u: 'day setup', word: card.setupDays > 7 ? 'Short' : 'Enough', tone: card.setupDays > 7 ? 'short' : 'ok',
      sub: <>research engineers: {F.num(re.idle, 0)} {re.unit} spare <Ref id="reNeeds" to={{ panel: 'lab', tab: 'work' }}>run operations</Ref></>,
      tip: () => <TipCard title={<Term id="runSetup">Setup</Term>} value={F.days(card.setupDays)} rows={[{ label: 'Setup work', value: `${card.setupTW.toFixed(1)} team-weeks` }, { label: <Term id="buildQueue">Build queue ahead</Term>, value: String(s.player.build.queue.length) }, { label: 'Research engineers spare', value: `${F.num(re.idle, 1)} ${re.unit}` }]} footer="Short of research engineers on run operations, a running run slows.">Engineers set the run up; research engineers keep it running.</TipCard>,
    });
  }
  return (
    <Card className="tr-limits" home="runLimits">
      <div className="tr-lh"><span className="row-i"><Gauge size={16} /><b><Term id="limit">Limits</Term></b></span><span className="dim small">what holds this run back</span></div>
      {lims.map((l) => (
        <Tip key={l.id} as="div" content={l.tip}>
          <div className={`tr-lim ${l.tone}`} data-tile={l.id}>
            <span className="t"><l.icon size={14} />{l.label}<span className="sp" /><span className={`vd ${l.tone}`}>{l.word}</span></span>
            <span className="val">{l.v} <span className="u">{l.u}</span></span>
            <span className="sub small">{l.sub}</span>
          </div>
        </Tip>
      ))}
      <div className="tr-launch">{children}</div>
    </Card>
  );
}

// ───────── Runs tab (running, queued, continual learning, idle) ─────────
type Run_ = GameStateV2['player']['models']['runs'][number];
/** Runs timeline (UI-IA TRAINING › Runs L1): each running run from its start to its expected finish at today's share,
 *  the done part filled, today marked, stalls in amber. */
function RunTimeline({ s, runs, alloc }: { s: GameStateV2; runs: Run_[]; alloc: ReturnType<typeof poolAllocation> }) {
  const day = s.time.day;
  const rows = runs.map((r) => ({ r, end: day + Math.min(730, Number.isFinite(runEtaDays(s, r, alloc)) ? runEtaDays(s, r, alloc) : 730), stall: runStall(s, r) }));
  const lo = Math.min(...rows.map((x) => x.r.startDay));
  const hi = Math.max(day + 30, ...rows.map((x) => x.end));
  const x = (d: number) => `${(((d - lo) / Math.max(1, hi - lo)) * 100).toFixed(2)}%`;
  return (
    <div className="tr-gantt" data-test="runs-timeline">
      {rows.map(({ r, end, stall }) => (
        <div key={r.id} className="tr-glane">
          <span className="ellip small">{runTitle(s, r)}</span>
          <Tip as="div" content={() => <TipCard title={runTitle(s, r)} rows={[{ label: 'Started', value: fmtDate(dateOf(s, r.startDay)) }, { label: 'Expected finish', value: fmtDate(dateOf(s, end)) }, { label: 'Done', value: F.pct(Math.min(1, r.flopDone / Math.max(1, r.flopNeeded))) }]} footer={stall}>From launch to its expected finish at today&apos;s training share.</TipCard>}>
            <div className="tr-gtrack">
              <i className={`tr-gbar ${stall ? 'stall' : ''}`} style={{ left: x(r.startDay), width: `calc(${x(end)} - ${x(r.startDay)})` }} />
              <i className="tr-gdone" style={{ left: x(r.startDay), width: `calc(${x(day)} - ${x(r.startDay)})` }} />
              <b className="tr-gnow" style={{ left: x(day) }} />
            </div>
          </Tip>
          <span className="small dim">{fmtDate(dateOf(s, end))}</span>
        </div>
      ))}
    </div>
  );
}
export function RunQueue({ s }: { s: GameStateV2 }) {
  const runs = s.player.models.runs.filter((r) => r.status === 'running' || r.status === 'paused');
  const alloc = poolAllocation(s);
  const stream = streamShare(s);
  const spare = idleTrainingShare(s);
  const auto = s.player.policies.autoSplit;
  const last = s.player.models.runs.filter((r) => r.status === 'done').slice(-1)[0];
  const lastV = last ? s.player.models.versions.filter((v) => v.day >= last.startDay && (v.baseId === last.baseId || last.kind === 'distill' || last.kind === 'base')).sort((a, b) => a.day - b.day)[0] : undefined;
  return (
    <Card title="Runs in progress" home="runQueue" className="tr-runs" right={<button className="btn btn-sm" onClick={() => store.goto('blueprint', { tab: 'next' })}>Next run ›</button>}>
      {runs.length === 0 && <div className="dim small" data-test="runs-empty">No run in progress.</div>}
      {runs.length > 0 && <RunTimeline s={s} runs={runs} alloc={alloc} />}
      {runs.map((r) => {
        const done = Math.min(1, r.flopDone / Math.max(1, r.flopNeeded));
        const band = runBand(s, r);
        const stall = runStall(s, r);
        const got = alloc.get(r.id) ?? 0;
        const eta = runEtaDays(s, r, alloc);
        const step = (d: number) => Math.round(Math.min(POOL_SHARE_RANGE[1], Math.max(POOL_SHARE_RANGE[0], r.poolShare + d)) * 100) / 100;
        return (
          <div className="run-row" key={r.id} data-run={r.id}>
            <span className="row-i ellip"><Tip content={() => <TipCard title={runTitle(s, r)} rows={[{ label: 'Kind', value: RUN_KIND[r.kind] ?? r.kind }, { label: 'Started', value: fmtDate(dateOf(s, r.startDay)) }, { label: 'Done', value: F.pct(done) }]} />}><b>{runTitle(s, r)}</b></Tip>{r.autoTier ? <Tip content={() => <TipCard title={<Term id="cheapTierPolicy">auto</Term>}>Queued by the Auto-make smaller sizes policy (Products).</TipCard>}><span className="chip-mini" data-test="run-auto">auto</span></Tip> : null}</span>
            <Meter value={done} max={1} width={120} color={r.status === 'running' ? 'var(--accent)' : 'var(--text-3)'} />
            <Tip content={() => <TipCard title="Forecast at launch" value={band[1] > 0 ? `${F.level(band[0])}–${F.level(band[1])}` : 'none'}>The capability your forecast gave this run when you launched it (90% range, levels; 10 = best human). Evals of the result read the real one.</TipCard>}><span className="num small dim">{band[1] > 0 ? `${F.level(band[0])}–${F.level(band[1])}` : '—'}</span></Tip>
            <Tip content={() => <TipCard title={<Term id="poolShare">Training share</Term>} value={F.pct(got)} rows={[{ label: 'Asks', value: F.pct(r.poolShare) }, { label: 'Gets today', value: F.pct(got) }]} footer="Runs that ask for more than the training compute are scaled down together.">Share of training compute this run gets.</TipCard>}>
              <span className="num small run-share" data-test="run-share">{F.pct(got)}{got < r.poolShare - 1e-6 && done < 1 ? <span className="dim">/{F.pct(r.poolShare)}</span> : null}</span>
            </Tip>
            {r.status === 'running' ? (
              <span className="run-step">
                <ActBtn id="runs.setShare" params={{ runId: r.id, share: step(-0.1) }} label="−" testId={`run-share-dn.${r.id}`} block={r.poolShare <= POOL_SHARE_RANGE[0] + 1e-9 ? 'At the minimum share' : undefined} />
                <ActBtn id="runs.setShare" params={{ runId: r.id, share: step(0.1) }} label="+" testId={`run-share-up.${r.id}`} block={r.poolShare >= POOL_SHARE_RANGE[1] - 1e-9 ? 'At all of training compute' : undefined} />
              </span>
            ) : <span />}
            <Tip content={() => <TipCard title={stall ?? (r.status === 'paused' ? 'Paused' : 'Running')} value={Number.isFinite(eta) ? fmtDate(dateOf(s, s.time.day + eta)) : undefined}>Expected finish at today&apos;s training share; evals follow.</TipCard>}><span className={`small ${stall ? 'tone-warn' : ''}`} data-test={stall ? 'run-stall' : 'run-eta'}>{stall ?? (r.status === 'paused' ? 'Paused' : 'Running')}{Number.isFinite(eta) ? <span className="dim"> · {fmtDate(dateOf(s, s.time.day + eta))}</span> : ''}</span></Tip>
            {r.status === 'running' ? <ActBtn id="cancelRun" params={{ runId: r.id }} label="Cancel" inline={false} /> : <span />}
          </div>
        );
      })}
      <div className="tr-pool" data-run="stream"><span className="ellip"><b><Term id="stream">Continual learning</Term></b> <span className="dim">{stream > 0 ? 'on' : 'off'}</span></span><Tip content={() => <TipCard title={<Term id="stream">Continual learning</Term>} value={F.pct(stream)}>Share of training compute continual learning takes before any run.</TipCard>}><span className="num">{F.pct(stream)}</span></Tip><Limit id="run.stream" tone={stream > 0 ? 'warn' : 'quiet'}>{stream > 0 ? 'taken first' : 'takes 15% first when on'}</Limit></div>
      <div className="tr-pool" data-run="spare">
        <span className="ellip"><b><Term id="idleCompute">Idle</Term></b> <span className="dim">training compute no run uses</span></span>
        <Tip content={() => <TipCard title={<Term id="idleCompute">Idle</Term>} value={F.pct(spare)}>Share of training compute no run uses now. It stays idle{auto.on && !auto.to.includes('training') ? ', unless Auto-split idle compute moves it (on)' : ''}; set it on Lab.</TipCard>}><span className="num" data-test="spare-share">{F.pct(spare)}</span></Tip>
        <span className="dim">{auto.on && !auto.to.includes('training') ? '→ Auto-split' : ''}</span><Ref id="idleCompute" to={{ panel: 'lab' }}>Lab</Ref>
      </div>
      {last && <div className="small dim tr-lastrun" data-test="runs-last">Last finished: {runTitle(s, last)}{lastV ? <> → <button className="tr-link" onClick={() => { store.select({ versionId: lastV.id }); store.goto('models'); }}>{lastV.name} <ChevronRight size={11} /></button></> : null}</div>}
    </Card>
  );
}
