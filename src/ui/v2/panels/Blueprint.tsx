// Model blueprint (BUILD-PLAN R5; design/ux/mockups-v3/v3-blueprint*.png + v3-blueprint-IA.md). Replaces the run designer.
// L1: the size card (hero size, snap points ×¼…×8, seven limit tiles with their source in the tooltip), the predicted
// model card and the plan card (pool share, Gantt, start). L2: the slot table grouped by layer, one row per slot with the
// selected card, its alternatives (locked cards name the tree idea that unlocks them and link to Research) and the card's
// own contribution in five fields (capability, time, cash, serving, four risk families). L3: tooltips (trait-level
// pushes, domain effects, limit breakdowns). One home per datum: limits live on the size card, the run ETA lives in the
// run queue (Models), so running runs show here as bars without numbers.
import { useMemo, useState, type ReactNode } from 'react';
import {
  Check, Crown, Database, Gamepad2, Ghost, History, Hourglass, Layers, Lock, RotateCcw, Save, Server, ThumbsUp, Wallet, WandSparkles, Wrench,
  type LucideIcon,
} from 'lucide-react';
import { TRAIT_BY_ID } from '../../../data/v2/traits';
import { OPTION_NODE, TREE_BY_ID } from '../../../data/v2/tree';
import {
  POOL_SHARE_RANGE, SIZE_SNAPS, baseFromParams, dateOf, evalDaysFor, fmtDate, fmtMonth, internalEval, internalVersion, liveCommitments, measuredDomains,
  nodeStatus, optionLocked, postFromParams, runCard, runTraitPressure, runStall,
} from '../../../engine/v2';
import type { GameStateV2, LaunchRunParams, TraitId } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, Slider, Term, Tip, TipCard, unlocked, type Params } from '../ui';
import { Card, PanelHead } from '../kit';
import * as F from '../fmt';
import { DOMAIN_ICON, ICON } from '../icons';
import { C } from '../theme';
import { arrows } from './runEffects';
import { runTitle } from './Models';
import './blueprint.css';

type Kind = 'base' | 'post' | 'distill' | 'continue';
type Card_ = ReturnType<typeof runCard>;
type Val = string | boolean;
const TPL_KEY = 'ai27.v2.runTemplates';
const DEFAULTS: Params = {
  size: 1, shape: 'moe', data: 'balanced', quality: true, hazard: false, safetyPretrain: false, licensedShare: 0.1,
  pref: 'constitution', rlFocus: 'broad', rlIntensity: 'heavyHardened', inoculation: false, cot: 'visible', safety: 'standard',
};
const POOL_DEFAULT: Record<Kind, number> = { base: 0.6, post: 0.4, distill: 0.2, continue: 0.4 };
const POOL_PILLS = [0.2, 0.4, 0.6, 0.8, 1];
const KIND_LABEL: Record<Kind, string> = { base: 'Base run', post: 'Post-train', distill: 'Distill', continue: 'Continue' };
const KIND_TERM: Record<Kind, string> = { base: 'baseRun', post: 'postTrain', distill: 'distillRun', continue: 'continueRun' };
const ACTION: Record<Kind, string> = { base: 'launchBase', post: 'launchPost', distill: 'launchDistill', continue: 'launchContinue' };
const START: Record<Kind, string> = { base: 'Start base run', post: 'Start post-train', distill: 'Start distill', continue: 'Start continue run' };
const DOMS = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'] as const;

/** The four risk families (STRUCTURE §4.5). */
const FAMILIES: { id: string; label: string; icon: LucideIcon; traits: TraitId[] }[] = [
  { id: 'please', label: 'People-pleasing', icon: ThumbsUp, traits: ['SYC', 'PERSONA'] },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2, traits: ['RH', 'PROXY', 'TGAME'] },
  { id: 'deception', label: 'Deception', icon: Ghost, traits: ['EA', 'CONCEAL', 'OBF', 'AF', 'SAND', 'SCHEME'] },
  { id: 'power', label: 'Power', icon: Crown, traits: ['POWER', 'SUCC', 'COLLUDE'] },
];

// ───────── slots ─────────
interface Opt { v: Val; label: string }
interface Slot { field: string; label: string; sub?: string; term: string; lockSlot: string; opts: Opt[]; multi?: 'focus' | 'toggle' }
const BACKBONE: Slot[] = [
  { field: 'shape', label: 'Architecture', term: 'shape', lockSlot: 'shape', opts: [{ v: 'moe', label: 'MoE' }, { v: 'dense', label: 'Dense' }, { v: 'overtrained', label: 'Overtrained' }, { v: 'latent', label: 'Latent-recurrent' }] },
  { field: 'data', label: 'Data', term: 'dataMix', lockSlot: 'data', opts: [{ v: 'balanced', label: 'Balanced' }, { v: 'codeMath', label: 'Code & math' }, { v: 'science', label: 'Science' }, { v: 'synthetic', label: 'Synthetic' }, { v: 'multimodal', label: 'Multimodal' }] },
  { field: 'filter', label: 'Data filter', term: 'hazardFilter', lockSlot: 'curation', multi: 'toggle', opts: [{ v: 'quality', label: 'Quality' }, { v: 'hazard', label: 'Hazard' }, { v: 'safetyPretrain', label: 'Safety pretraining' }] },
];
const TRAINING: Slot[] = [
  { field: 'rlFocus', label: 'Focus', sub: '≤ 2', term: 'rlFocus', lockSlot: 'rlFocus', multi: 'focus', opts: [
    { v: 'broad', label: 'Broad' }, { v: 'swe', label: 'Coding' }, { v: 'math', label: 'Math' }, { v: 'longHorizon', label: 'Long tasks' }, { v: 'mlResearch', label: 'ML research' },
    { v: 'computerUse', label: 'Computer use' }, { v: 'cyber', label: 'Cyber' }, { v: 'bio', label: 'Bio' }] },
  { field: 'rlIntensity', label: 'Effort', term: 'rlIntensity', lockSlot: 'rlIntensity', opts: [{ v: 'heavyHardened', label: 'Heavy + hardened' }, { v: 'heavyCheap', label: 'Heavy' }, { v: 'light', label: 'Light' }] },
  { field: 'cot', label: 'Reasoning', term: 'cot', lockSlot: 'cot', opts: [{ v: 'visible', label: 'Visible' }, { v: 'pressured', label: 'Pressured' }, { v: 'faithful', label: 'Faithful' }, { v: 'latent', label: 'Latent' }] },
  { field: 'pref', label: 'Rewarded for', term: 'preference', lockSlot: 'pref', opts: [{ v: 'constitution', label: 'Constitution' }, { v: 'engagement', label: 'Engagement' }, { v: 'persuasion', label: 'Persuasion' }, { v: 'minimal', label: 'Minimal' }] },
  { field: 'safety', label: 'Alignment', term: 'safetyTraining', lockSlot: 'safety', opts: [{ v: 'standard', label: 'Standard' }, { v: 'heavy', label: 'Heavy' }, { v: 'minimal', label: 'Minimal' }, { v: 'inoculation', label: 'Inoculation' }] },
];

const focusOf = (p: Params) => (String(p.rlFocus) === 'broad' ? [] : String(p.rlFocus).split(',').filter(Boolean));
/** Is option `v` of slot `sl` selected in `p`? */
function isOn(sl: Slot, p: Params, v: Val): boolean {
  if (sl.multi === 'focus') return v === 'broad' ? String(p.rlFocus) === 'broad' : focusOf(p).includes(String(v));
  if (sl.multi === 'toggle') return p[String(v)] === true;
  if (sl.field === 'safety' && v === 'inoculation') return p.inoculation === true;
  return p[sl.field] === v;
}
/** Params with option `v` of slot `sl` clicked. */
function withOpt(sl: Slot, p: Params, v: Val): Params {
  if (sl.multi === 'focus') {
    if (v === 'broad') return { ...p, rlFocus: 'broad' };
    const f = focusOf(p);
    const next = f.includes(String(v)) ? f.filter((x) => x !== v) : [...f, String(v)].slice(-2);
    return { ...p, rlFocus: next.length ? next.join(',') : 'broad' };
  }
  if (sl.multi === 'toggle') return { ...p, [String(v)]: !p[String(v)] };
  if (sl.field === 'safety' && v === 'inoculation') return { ...p, inoculation: !p.inoculation };
  return { ...p, [sl.field]: v };
}
/** Params with slot `sl` at the reference card(s). */
function atRef(sl: Slot, p: Params): Params {
  if (sl.multi === 'toggle') return { ...p, quality: DEFAULTS.quality, hazard: DEFAULTS.hazard, safetyPretrain: DEFAULTS.safetyPretrain };
  if (sl.field === 'safety') return { ...p, safety: DEFAULTS.safety, inoculation: DEFAULTS.inoculation };
  return { ...p, [sl.field]: DEFAULTS[sl.field] };
}
const lockKey = (sl: Slot, v: Val) => (sl.field === 'safety' && v === 'inoculation' ? 'inoculation' : sl.lockSlot);
const lockVal = (sl: Slot, v: Val): string | boolean => (sl.field === 'safety' && v === 'inoculation' ? true : sl.multi === 'toggle' ? String(v) : v);

const latestTeacher = (s: GameStateV2) => s.player.models.versions.filter((v) => v.variant === 'full' && v.status !== 'retired').slice(-1)[0]?.id ?? '';
function toLP(s: GameStateV2, kind: Kind, p: Params): LaunchRunParams {
  const lp: LaunchRunParams = { kind, poolShare: Number(p.poolShare) };
  if (kind === 'base') lp.base = baseFromParams(p);
  if (kind === 'post') {
    lp.post = postFromParams(p);
    lp.baseId = String(p.baseId);
  }
  if (kind === 'continue') lp.baseId = String(p.baseId);
  if (kind === 'distill') lp.teacherVersionId = String(p.teacherVersionId || latestTeacher(s));
  return lp;
}
interface Eval { card?: Card_; err?: string; tp: Partial<Record<TraitId, number>> }
function evaluate(s: GameStateV2, kind: Kind, p: Params): Eval {
  const lp = toLP(s, kind, p);
  try {
    return { card: runCard(s, lp), tp: runTraitPressure(s, lp) };
  } catch (e) {
    return { err: e instanceof Error ? e.message : String(e), tp: {} };
  }
}
const mid = (b: [number, number]) => (b[0] + b[1]) / 2;
const famDelta = (a: Eval, b: Eval, f: (typeof FAMILIES)[number]) => f.traits.reduce((x, t) => x + (a.tp[t] ?? 0) - (b.tp[t] ?? 0), 0);
const sci = (x: number) => { const [m, e] = x.toExponential(1).split('e'); return `${m}e${Number(e)}`; };

/** A row's own contribution: the current design vs the same design with this slot at the reference card. */
interface Effect { dL: number; dDays: number; dCash: number; serve: number; fam: number[]; ref: boolean; cur: Eval; base: Eval }
function effectOf(cur: Eval, base: Eval, ref: boolean): Effect {
  const c = cur.card;
  const b = base.card;
  return {
    dL: c && b ? mid(c.band) - mid(b.band) : 0, dDays: c && b ? c.etaDays - b.etaDays : 0, dCash: c && b ? c.cash - b.cash : 0,
    serve: c && b ? c.serveCost / Math.max(1e-6, b.serveCost) : 1, fam: FAMILIES.map((f) => famDelta(cur, base, f)), ref, cur, base,
  };
}

/** A base run longer than this is shown as infeasible (red snap) and is never the default size [D: the reference base
 *  runs take 4–7 months; a year-long base finishes far behind]. */
const FEASIBLE_DAYS = 240;
const LONG_DAYS = 365;
const wallOf = (c?: Card_) => (c ? (c.limits?.wallDays ?? c.etaDays) : Infinity);
/** Wall time of each size snap on today's pool (the reference design). */
function snapWalls(s: GameStateV2, p: Params = DEFAULTS): number[] {
  return (SIZE_SNAPS as readonly number[]).map((v) => wallOf(evaluate(s, 'base', { ...p, size: v, poolShare: POOL_DEFAULT.base }).card));
}
/** Default base size: ×1 if it finishes within FEASIBLE_DAYS, else the largest snap below ×1 that does; `ok` false when
 *  even the smallest snap takes longer (then the smallest). */
function feasibleSize(s: GameStateV2): { size: number; ok: boolean } {
  const snaps = SIZE_SNAPS as readonly number[];
  const walls = snapWalls(s);
  for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i] <= 1 && walls[i] <= FEASIBLE_DAYS) return { size: snaps[i], ok: true };
  return { size: snaps[0], ok: false };
}

function loadTemplates(): Record<string, { kind: Kind; p: Params }> {
  try {
    return JSON.parse(localStorage.getItem(TPL_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function Blueprint({ s }: { s: GameStateV2 }) {
  const m = s.player.models;
  const lastBase = m.bases[m.bases.length - 1];
  const kinds: Kind[] = [...(unlocked(s, 'baseRuns') ? (['base'] as Kind[]) : []), 'post', 'distill', ...(unlocked(s, 'baseRuns') ? (['continue'] as Kind[]) : [])];
  // Jank B3: the default size is the largest that finishes in reasonable time on your pool; a lab with no feasible
  // base size (the spinout) opens on post-training its model.
  const [fit] = useState(() => feasibleSize(s));
  const [kind, setKindRaw] = useState<Kind>(unlocked(s, 'baseRuns') && (fit.ok || !lastBase) ? 'base' : 'post');
  const defFor = (k: Kind, baseId = lastBase?.id ?? ''): Params => ({ ...DEFAULTS, size: fit.size, poolShare: POOL_DEFAULT[k], baseId, ...(m.bases.find((b) => b.id === baseId)?.design.shape === 'latent' ? { cot: 'latent' } : {}) });
  const [p, setP] = useState<Params>(() => defFor(kind));
  const [prev, setPrev] = useState<Card_ | undefined>(undefined);
  const [tpls, setTpls] = useState(loadTemplates);
  const setKind = (k: Kind) => {
    setKindRaw(k);
    setP({ ...p, poolShare: POOL_DEFAULT[k] });
    setPrev(undefined);
  };
  const set = (np: Params) => setP(np.baseId !== p.baseId && m.bases.find((b) => b.id === np.baseId)?.design.shape === 'latent' ? { ...np, cot: 'latent' } : np);
  const key = `${s.time.day}|${kind}|${JSON.stringify(p)}`;
  const { cur, opts, sizeEff } = useMemo(() => {
    const cur = evaluate(s, kind, p);
    // Jank B2 (STRUCTURE §4.3): every card shows its own effect in the five fields: the design with this card in its
    // slot vs the same design with the slot at the reference card (toggles: on vs off).
    const opts: Record<string, Record<string, Effect>> = {};
    const slots = kind === 'base' ? BACKBONE : kind === 'post' ? TRAINING : [];
    for (const sl of slots) {
      const rp = atRef(sl, p);
      const ref = evaluate(s, kind, rp);
      const row: Record<string, Effect> = {};
      for (const o of sl.opts) {
        if (sl.multi === 'toggle') {
          row[String(o.v)] = effectOf(evaluate(s, kind, { ...p, [String(o.v)]: true }), evaluate(s, kind, { ...p, [String(o.v)]: false }), false);
          continue;
        }
        const op = sl.multi === 'focus' ? { ...rp, rlFocus: String(o.v) } : sl.field === 'safety' && o.v === 'inoculation' ? { ...rp, inoculation: true } : { ...rp, [sl.field]: o.v };
        const isRef = JSON.stringify(op) === JSON.stringify(rp);
        row[String(o.v)] = effectOf(isRef ? ref : evaluate(s, kind, op), ref, isRef);
      }
      opts[sl.field] = row;
    }
    const sizeEff = kind === 'base' ? effectOf(cur, Number(p.size) === 1 ? cur : evaluate(s, kind, { ...p, size: 1 }), Number(p.size) === 1) : undefined;
    return { cur, opts, sizeEff };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const card = cur.card;
  const params: Params = { ...p, ...(kind === 'distill' ? { teacherVersionId: String(p.teacherVersionId || latestTeacher(s)) } : {}) };
  const setSize = (size: number) => {
    if (size === Number(p.size)) return;
    setPrev(card);
    setP({ ...p, size });
  };
  const saveTpl = () => {
    const name = `${kind}-${Object.keys(tpls).length + 1}`;
    const next = { ...tpls, [name]: { kind, p } };
    localStorage.setItem(TPL_KEY, JSON.stringify(next));
    setTpls(next);
    store.say(`Blueprint ${name} saved`, 'pos');
  };
  const pledged = s.player.safety.monitorabilityCommitment || liveCommitments(s).some((c) => c.condition.predicate === 'monitorabilityPledge');
  const breaksPledge = pledged && ((kind === 'base' && p.shape === 'latent') || (kind === 'post' && (p.cot === 'latent' || p.cot === 'pressured')));
  const warn: string[] = [];
  if (breaksPledge) warn.push('Breaks your monitorability pledge');
  if (kind === 'base' && Number(p.licensedShare) < 0.3) warn.push('Unlicensed data: litigation risk');
  const baseSel = (kind === 'post' || kind === 'continue') && (
    <label className="bp-on small dim">on
      <select className="text-input" data-test="bp-base" value={String(p.baseId)} onChange={(e) => set({ ...p, baseId: e.target.value })}>{m.bases.map((b) => <option key={b.id} value={b.id}>{b.name} · {F.size(b.design.size)} · {b.design.shape === 'moe' ? 'MoE' : F.words(b.design.shape)}</option>)}</select>
    </label>
  );
  const teacherSel = kind === 'distill' && (
    <label className="bp-on small dim">teacher
      <select className="text-input" data-test="bp-teacher" value={String(params.teacherVersionId)} onChange={(e) => set({ ...p, teacherVersionId: e.target.value })}>{m.versions.filter((v) => v.status !== 'retired').map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
    </label>
  );
  return (
    <div className="panel-v2 bp" data-panel="blueprint">
      <PanelHead
        icon={ICON.runs}
        title="Blueprint"
        tabs={<>
          <div className="tabs2 bp-kinds">
            {kinds.map((k) => <button key={k} className={`tab2 seg-btn ${kind === k ? 'on active' : ''}`} data-bp-kind={k} onClick={() => setKind(k)}><Term id={KIND_TERM[k]}>{KIND_LABEL[k]}</Term></button>)}
          </div>
          {baseSel}{teacherSel}
        </>}
        right={<div className="btn-row">
          <button className="btn btn-sm" data-test="bp-reset" onClick={() => { setP(defFor(kind, String(p.baseId))); setPrev(undefined); }}><RotateCcw size={13} /> Reference</button>
          <button className="btn btn-sm" data-test="bp-save" onClick={saveTpl}><Save size={13} /> Save</button>
          {Object.entries(tpls).slice(-3).map(([n, t]) => <button key={n} className="btn btn-sm btn-ghost" onClick={() => { setKindRaw(t.kind); setP(t.p); setPrev(undefined); }}>{n}</button>)}
        </div>}
      />
      <Card className="bp-top" home="runLimits">
        {kind === 'base' ? <SizeCtl s={s} size={Number(p.size)} ghost={prev ? Number(prev.limits?.size ?? 1) : undefined} card={card} onSize={setSize} /> : <KindCtl s={s} kind={kind} p={params} />}
        <Limits s={s} card={card} prev={prev} />
      </Card>
      <div className="bp-lower">
        <Card className="bp-slots" home="blueprintSlots">
          <div className="bp-grid">
            <span className="ch">Card</span><span className="ch r"><ICON.L size={11} />Capab.</span><span className="ch r"><Hourglass size={11} />Time</span>
            <span className="ch r"><Wallet size={11} />Cash</span><span className="ch r"><Server size={11} />Serve</span>
            <span className="ch fams">{FAMILIES.map((f) => <Tip key={f.id} content={() => <TipCard title={<Term id="riskFamily">{f.label}</Term>}>{f.traits.map((t) => TRAIT_BY_ID[t].name).join(', ')}</TipCard>}><f.icon size={12} /></Tip>)}</span>
            <Group icon={Layers} layer="layerBackbone" name="Backbone" rebuild="new base run" />
            {kind === 'base' ? (
              <>
                <div className="sl"><Term id="baseSize">Size</Term></div>
                <div className="sc"><Tip content={() => <TipCard title={<Term id="baseSize">Size</Term>} value={F.size(Number(p.size))}>Set on the size card above; this row shows its effect against ×1.</TipCard>}><span className="bp-opt on"><Check size={12} />{F.size(Number(p.size))}</span></Tip><span className="dim small">set above · effect vs ×1</span></div>
                {sizeEff && <Effects s={s} e={sizeEff} />}
                {BACKBONE.map((sl) => <SlotRow key={sl.field} s={s} kind={kind} sl={sl} p={p} effs={opts[sl.field]} onPick={(np) => set(np)} />)}
                <div className="sl"><Term id="licensedShare">Licensed data</Term></div>
                <div className="sc bp-lic"><Slider value={Number(p.licensedShare)} min={0} max={1} step={0.05} onChange={(v) => set({ ...p, licensedShare: v })} width={200} /><Tip content={() => <TipCard title={<Term id="licensedShare">Licensed data</Term>} value={F.pct(Number(p.licensedShare))}>Share of the training data you pay to license. Below 30%: litigation risk; more costs cash at launch.</TipCard>}><span className="num small">{F.pct(Number(p.licensedShare))}</span></Tip></div>
                <span className="bp-span" />
              </>
            ) : (
              <BaseSummary s={s} kind={kind} p={params} onNewBase={unlocked(s, 'baseRuns') ? () => setKind('base') : undefined} />
            )}
            <Group icon={WandSparkles} layer="layerTraining" name="Training" rebuild="post-train on a base" />
            {kind === 'post' ? TRAINING.map((sl) => <SlotRow key={sl.field} s={s} kind={kind} sl={sl} p={p} effs={opts[sl.field]} onPick={(np) => set(np)} />) : (
              <div className="bp-note small dim">{kind === 'base' ? <>Set on the post-train after this base. <button className="btn btn-sm btn-ghost" data-test="bp-to-post" onClick={() => setKind('post')}>Post-train ›</button></> : kind === 'distill' ? <>A <Term id="distillRun">distilled</Term> mini keeps its teacher's training and traits.</> : <>A <Term id="continueRun">continue run</Term> keeps the base's lineage, traits and failure modes.</>}</div>
            )}
            <Group icon={Wrench} layer="layerScaffold" name="Scaffold" rebuild="engineering build, no training" />
            <div className="sl">Serving</div>
            <div className="bp-scaf small dim">effort · tools · safeguards · features<span className="sp" /><button className="btn btn-sm" data-go="products" onClick={() => store.goto('products')}>Products ›</button></div>
          </div>
        </Card>
        <div className="bp-rcol">
          <Predicted s={s} card={card} err={cur.err} cur={cur} />
          <Plan s={s} kind={kind} card={card} p={p} setShare={(v) => setP({ ...p, poolShare: v })} warn={warn}>
            <ActBtn id={ACTION[kind]} params={params} primary small={false} icon={ICON.run} label={START[kind]} block={cur.err || card?.reason} reason />
          </Plan>
        </div>
      </div>
    </div>
  );
}

// ───────── size card (hero) ─────────
function SizeCtl({ s, size, ghost, card, onSize }: { s: GameStateV2; size: number; ghost?: number; card?: Card_; onSize: (v: number) => void }) {
  const snaps = SIZE_SNAPS as readonly number[];
  const idx = (v: number) => {
    let best = 0;
    for (let i = 1; i < snaps.length; i++) if (Math.abs(Math.log(snaps[i] / v)) < Math.abs(Math.log(snaps[best] / v))) best = i;
    return best;
  };
  const F1 = card?.limits ? card.flop / Math.max(1e-9, card.limits.size) : 0;
  const lastBase = s.player.models.bases[s.player.models.bases.length - 1];
  const pos = (i: number) => `${(i / (snaps.length - 1)) * 100}%`;
  const walls = useMemo(() => snapWalls(s), [s.time.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const flopTip = (v: number, i: number) => () => (
    <TipCard title={<>{F.size(v)} of today's <Term id="frontierRun">frontier run</Term></>} value={F1 ? `${sci(F1 * v)} FLOP` : undefined} rows={[
      { label: <Term id="wallTime">Wall time</Term>, value: Number.isFinite(walls[i]) ? F.days(walls[i]) : '—', tone: walls[i] > LONG_DAYS ? 'neg' : walls[i] > FEASIBLE_DAYS ? undefined : 'pos' },
    ]} footer={walls[i] > LONG_DAYS ? 'Takes over a year on your training pool: the base would finish far behind. Buy or rent compute, or post-train an existing base.' : 'At today\'s training pool with the reference design and pool share.'}>
      Training compute of the base run, as a multiple of the largest run the frontier labs train today.
    </TipCard>
  );
  return (
    <div className="bp-size" id="ctl-size">
      <div className="row-i bp-size-h"><b><Term id="baseSize">Size</Term></b><span className="tag2"><Layers size={11} /> <Term id="layerBackbone">Backbone</Term></span><span className="sp" /><span className="dim small">× today's <Term id="frontierRun">frontier run</Term></span></div>
      <Tip content={flopTip(size, idx(size))}><div className="bp-big"><span className="num">{F.size(size)}</span><span className="u">{walls[idx(size)] > LONG_DAYS ? <span className="tone-neg">takes {F.days(walls[idx(size)])}</span> : <>of the frontier run</>}</span></div></Tip>
      <div className="bp-track">
        <div className="bp-rail" />
        <div className="bp-fill" style={{ width: pos(idx(size)) }} />
        {lastBase && <Tip content={() => <TipCard title={lastBase.name}>Your latest base: {F.size(lastBase.design.size)} of the frontier run when it started.</TipCard>}><span className="bp-reftick" style={{ left: pos(idx(lastBase.design.size)) }}><i />{lastBase.name}</span></Tip>}
        {ghost !== undefined && ghost !== size && <span className="bp-ghost" style={{ left: pos(idx(ghost)) }} />}
        <span className="bp-thumb" style={{ left: pos(idx(size)) }} />
        {snaps.map((v, i) => (
          <Tip key={v} content={flopTip(v, i)}>
            <button className={`bp-snap ${v === size ? 'on' : ''} ${walls[i] > LONG_DAYS ? 'long' : ''}`} style={{ left: pos(i) }} data-size={v} onClick={() => onSize(v)}>
              <i /><b>{F.size(v)}</b><span className="num">{Number.isFinite(walls[i]) ? F.days(walls[i]) : ''}</span>
            </button>
          </Tip>
        ))}
      </div>
    </div>
  );
}

/** Non-base kinds: what the run starts from. */
function KindCtl({ s, kind, p }: { s: GameStateV2; kind: Kind; p: Params }) {
  const b = s.player.models.bases.find((x) => x.id === p.baseId);
  const t = s.player.models.versions.find((x) => x.id === p.teacherVersionId);
  return (
    <div className="bp-size">
      <div className="row-i bp-size-h"><b><Term id={KIND_TERM[kind]}>{KIND_LABEL[kind]}</Term></b><span className="tag2">{kind === 'post' ? <><WandSparkles size={11} /> <Term id="layerTraining">Training</Term></> : <><Layers size={11} /> <Term id="layerBackbone">Backbone</Term></>}</span></div>
      <div className="bp-big bp-big-name"><span className="num">{kind === 'distill' ? (t?.name ?? '—') : (b?.name ?? '—')}</span><span className="u">{kind === 'distill' ? 'teacher' : b ? `${F.size(b.design.size)} · ${b.design.shape === 'moe' ? 'MoE' : F.words(b.design.shape)}` : ''}</span></div>
      <div className="dim small">{kind === 'post' ? 'Captures 70% of the know-how gained since the base.' : kind === 'distill' ? 'A mini: −0.3 years, a quarter of the serving cost.' : '0.3 × the frontier run on the same base.'}</div>
    </div>
  );
}

// ───────── limit tiles (home of the run's limits) ─────────
interface Tile { id: string; icon: LucideIcon; term: string; label: string; v: string; u?: string; old?: string; sub: ReactNode; tone: 'good' | 'warn' | 'bad' | 'neu'; bar?: { f: number; mark?: number }; tip: () => ReactNode }
function Limits({ s, card, prev }: { s: GameStateV2; card?: Card_; prev?: Card_ }) {
  if (!card) return <div className="bp-lims" />;
  const L = card.limits;
  const P = prev?.limits;
  const day = s.time.day;
  const cash = s.player.finance.cash;
  const ivServe = internalVersion(s)?.serveCost ?? 0.5;
  const tiles: Tile[] = [];
  const wall = L?.wallDays ?? card.etaDays;
  const pWall = P?.wallDays ?? prev?.etaDays;
  tiles.push({
    id: 'wall', icon: Hourglass, term: 'wallTime', label: 'Wall time', v: `${Math.round(wall)}`, u: 'd', old: pWall !== undefined && pWall !== wall ? `${Math.round(pWall)}` : undefined,
    sub: wall > LONG_DAYS ? <span className="tone-neg">over a year: ends {fmtDate(dateOf(s, day + wall))}</span> : <>ends {fmtDate(dateOf(s, day + wall))}</>, tone: wall > LONG_DAYS ? 'bad' : wall > FEASIBLE_DAYS ? 'warn' : 'neu', bar: { f: Math.min(1, card.minDays / Math.max(1, wall)) },
    tip: () => <TipCard title={<Term id="wallTime">Wall time</Term>} value={F.days(wall)} rows={[
      { label: <Term id="flop">FLOP</Term>, value: sci(card.flop) },
      { label: <><Term id="poolShare">Pool share</Term> asked → gets</>, value: `${F.pct(card.poolShare)} → ${F.pct(card.effShare)}` },
      { label: <Term id="runSetup">Wait for engineers</Term>, value: F.days(card.setupDays) },
      { label: 'Minimum length', value: F.days(card.minDays) },
    ]} footer="At today's training pool; chips on order shorten it. The bar is the minimum length's part.">A run trains until its FLOP is done and its minimum length has passed.</TipCard>,
  });
  if (L) {
    const behind = L.behindMonths;
    tiles.push({
      id: 'behind', icon: History, term: 'behindAtFinish', label: 'Behind at finish', v: behind.toFixed(1), u: 'mo', old: P && Math.abs(P.behindMonths - behind) > 0.05 ? P.behindMonths.toFixed(1) : undefined,
      sub: <>of <Term id="knowHow">know-how</Term></>, tone: behind <= 3 ? 'good' : behind <= 6 ? 'warn' : 'bad', bar: { f: Math.min(1, behind / 9), mark: 3 / 9 },
      tip: () => <TipCard title={<Term id="behindAtFinish">Behind at finish</Term>} value={`${behind.toFixed(1)} months`} rows={[
        { label: 'Wall time', value: F.days(wall) }, { label: <Term id="rdmult">Research speed</Term>, value: F.mult(s.player.prodCache?.rate ?? 1) },
      ]} footer="Zones ≤ 3 mo / 3–6 / > 6 are a judgement, not a sourced limit. Replaces the old 150-day cap.">The base embodies the know-how of its start date; what your lab learns while it trains is not in it.</TipCard>,
    });
    const ratio = L.tokensOwned / Math.max(1, L.tokensNeeded);
    const pRatio = P ? P.tokensOwned / Math.max(1, P.tokensNeeded) : undefined;
    tiles.push({
      id: 'data', icon: Database, term: 'dataTokens', label: 'Data', v: ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1), u: '×', old: pRatio !== undefined && Math.abs(pRatio - ratio) > 0.05 ? pRatio.toFixed(1) : undefined,
      sub: L.dataWallDp < 0 ? <span className="tone-neg">short: <Term id="dataWall">data wall</Term> {F.num(L.dataWallDp, 2, true)} y</span> : 'of tokens needed', tone: L.dataWallDp < 0 ? 'bad' : ratio < 1.5 ? 'warn' : 'good', bar: { f: Math.min(1, ratio / 3), mark: 1 / 3 },
      tip: () => <TipCard title={<Term id="dataTokens">Data</Term>} value={`${F.num(ratio, 2)}×`} rows={[
        { label: 'Tokens needed (∝ √FLOP)', value: `${(L.tokensNeeded / 1e12).toFixed(0)}T` }, { label: 'Usable stock', value: `${(L.tokensOwned / 1e12).toFixed(0)}T` },
        { label: <Term id="dataWall">Data wall</Term>, value: L.dataWallDp < 0 ? `${F.num(L.dataWallDp, 2, true)} y` : 'none' },
      ]} footer="Synthetic or multimodal data avoid the wall; spare training compute can generate data (run queue).">Chinchilla: 20 tokens per parameter.</TipCard>,
    });
  }
  const pCash = prev?.cash;
  tiles.push({
    id: 'cash', icon: Wallet, term: 'cash', label: 'Cash', v: F.money(card.cash).replace(/B$/, ''), u: /B$/.test(F.money(card.cash)) ? 'B' : undefined, old: pCash !== undefined && Math.abs(pCash - card.cash) > 0.05 ? F.money(pCash) : undefined,
    sub: <>{F.pct(card.cash / Math.max(0.01, cash))} of cash</>, tone: card.cash > cash ? 'bad' : card.cash > 0.25 * cash ? 'warn' : 'good', bar: { f: Math.min(1, card.cash / Math.max(0.01, cash)) },
    tip: () => <TipCard title="Cash at launch" value={F.money(card.cash)} rows={[
      { label: 'Your cash', value: F.money(cash) },
      ...(L ? [{ label: 'Compute-equivalent cost', value: F.money(L.computeCost) }] : []),
    ]} footer="Data licences, RL environments and journals are paid at launch; the compute is your training pool, already paid for.">Committed when you start the run.</TipCard>,
  });
  if (L) {
    tiles.push({
      id: 'restart', icon: RotateCcw, term: 'restartRisk', label: 'Restart risk', v: `${Math.round(L.restart * 100)}`, u: '%', old: P && Math.round(P.restart * 100) !== Math.round(L.restart * 100) ? `${Math.round(P.restart * 100)}` : undefined,
      sub: nodeStatus(s, 'faultTolerant') === 'known' ? <>halved: <Term id="faultTolerant">fault-tolerant</Term></> : <>×0.5 with <Term id="faultTolerant">FT training</Term> <Lock size={10} /></>, tone: L.restart >= 0.15 ? 'bad' : L.restart >= 0.08 ? 'warn' : 'good', bar: { f: Math.min(1, L.restart / 0.3) },
      tip: () => <TipCard title={<Term id="restartRisk">Restart risk</Term>} value={F.pct(L.restart)} footer="Rises above size ×1 (×3: +10 points) and with MoE (+10).">A loss spike rolls back 15% of the work and stalls the run 14–28 days.</TipCard>,
    });
  }
  const serve = card.serveCost;
  const pServe = prev?.serveCost;
  tiles.push({
    id: 'serve', icon: Server, term: 'serveCost', label: 'Serving cost', v: serve.toFixed(2), old: pServe !== undefined && Math.abs(pServe - serve) > 0.005 ? pServe.toFixed(2) : undefined,
    sub: <>today {ivServe.toFixed(2)}</>, tone: serve > ivServe * 1.5 ? 'bad' : serve > ivServe * 1.05 ? 'warn' : 'good', bar: { f: Math.min(1, serve / 1.5), mark: ivServe / 1.5 },
    tip: () => <TipCard title={<Term id="serveCost">Serving cost</Term>} value={serve.toFixed(2)} rows={[{ label: 'Internal model today', value: ivServe.toFixed(2) }]}
      footer="0.5 × √size × architecture (MoE 1, dense 2, overtrained 0.6, latent 0.4) × reasoning × efficiency ideas (quantization ×0.8, speculative decoding ×0.85, AI kernels ×0.75).">Bigger is smarter but dearer to serve: fewer agent copies and less margin per token.</TipCard>,
  });
  const pTW = prev?.setupTW;
  tiles.push({
    id: 'eng', icon: ICON.roleEng, term: 'runSetup', label: 'Engineers', v: card.setupTW.toFixed(1), u: 'team-wk', old: pTW !== undefined && Math.abs(pTW - card.setupTW) > 0.005 ? pTW.toFixed(pTW < 1 ? 2 : 1) : undefined,
    sub: card.setupDays <= 1 ? 'built within a day' : <>waits {F.days(card.setupDays)} for engineers</>, tone: card.setupDays <= 1 ? 'good' : card.setupDays <= 7 ? 'warn' : 'bad',
    tip: () => <TipCard title={<Term id="runSetup">Run setup</Term>} value={`${card.setupTW.toFixed(2)} team-weeks`} rows={[
      { label: <Term id="buildQueue">Build queue ahead</Term>, value: `${s.player.build.queue.length} item${s.player.build.queue.length === 1 ? '' : 's'}` },
      { label: 'Ready in', value: F.days(card.setupDays) },
    ]} footer="Capacity and the queue live on Company › People.">The run trains once your engineers have set it up.</TipCard>,
  });
  return (
    <div className={`bp-lims n${tiles.length}`}>
      {tiles.map((t) => (
        <Tip key={t.id} as="div" content={t.tip}>
          <div className={`bp-lim ${t.tone} ${t.old ? 'chg' : ''}`} data-tile={t.id}>
            <span className="lh"><t.icon size={13} /><Term id={t.term}>{t.label}</Term></span>
            <span className="lv">{t.old && <span className="was">{t.old} →</span>}{t.v}{t.u && <span className="u">{t.u}</span>}</span>
            {t.bar && <span className="bp-lbar"><i style={{ width: `${t.bar.f * 100}%` }} />{t.bar.mark !== undefined && <b style={{ left: `${t.bar.mark * 100}%` }} />}</span>}
            <span className="ls">{t.sub}</span>
          </div>
        </Tip>
      ))}
    </div>
  );
}

// ───────── slot table ─────────
function Group({ icon: I, layer, name, rebuild }: { icon: LucideIcon; layer: string; name: string; rebuild: string }) {
  // Jank B1: the note had class `rb`, which a global rule lays out as a grid (one word per line over the cards).
  return <div className="bp-grp"><I size={13} /><span className="ln"><Term id={layer}>{name.toUpperCase()}</Term></span><span className="bp-rebuild">change = <b>{rebuild}</b></span></div>;
}

function Effects({ s, e }: { s: GameStateV2; e: Effect }) {
  void s;
  const dom = e.cur.card && e.base.card ? DOMS.map((d) => [d, mid(e.cur.card!.domains[d]) - mid(e.base.card!.domains[d]) - e.dL] as const).filter(([, v]) => Math.abs(v) >= 0.2).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])) : [];
  const top = dom[0];
  return (
    <>
      <Tip content={() => <TipCard title="Capability" value={e.ref ? 'reference' : `L ${F.dLevel(e.dL)}`} rows={dom.slice(0, 5).map(([d, v]) => ({ label: d, value: F.dLevel(v) }))}>General level vs the reference card{dom.length ? '; domains beyond the general shift:' : '.'}</TipCard>}>
        <span className={`e ${e.ref ? 'ref' : e.dL >= 0.05 ? 'pos' : e.dL <= -0.05 ? 'neg' : ''}`}>{e.ref ? 'ref' : top && Math.abs(e.dL) < 0.05 ? `${top[0]} ${F.dLevel(top[1])}` : Math.abs(e.dL) < 0.05 ? '–' : F.dLevel(e.dL)}</span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="wallTime">Time</Term>} value={e.ref ? 'reference' : F.days(e.dDays, true)} rows={e.cur.card && e.base.card ? [{ label: 'With this card', value: F.days(e.cur.card.etaDays) }, { label: 'With the reference card', value: F.days(e.base.card.etaDays) }] : []}>Days until the run is done (FLOP and minimum length).</TipCard>}>
        <span className={`e ${e.ref || Math.abs(e.dDays) < 1 ? 'no' : e.dDays > 0 ? 'neg' : 'pos'}`}>{e.ref ? '' : Math.abs(e.dDays) < 1 ? '–' : F.days(e.dDays, true)}</span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="cash">Cash at launch</Term>} value={e.ref ? 'reference' : F.money(e.dCash, { signed: true })} rows={e.cur.card && e.base.card ? [{ label: 'With this card', value: F.money(e.cur.card.cash) }, { label: 'With the reference card', value: F.money(e.base.card.cash) }] : []}>Data licences and RL environments paid when the run starts.</TipCard>}>
        <span className={`e ${e.ref || Math.abs(e.dCash) < 0.05 ? 'no' : e.dCash > 0 ? 'neg' : 'pos'}`}>{e.ref ? '' : Math.abs(e.dCash) < 0.05 ? '–' : F.money(e.dCash, { signed: true })}</span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="serveCost">Serving cost</Term>} value={e.ref ? 'reference' : `×${e.serve.toFixed(2)}`} rows={e.cur.card && e.base.card ? [{ label: 'With this card', value: e.cur.card.serveCost.toFixed(2) }, { label: 'With the reference card', value: e.base.card.serveCost.toFixed(2) }] : []}>H100e per agent copy, relative to the reference card.</TipCard>}>
        <span className={`e ${e.ref || Math.abs(e.serve - 1) < 0.01 ? 'no' : e.serve > 1 ? 'neg' : 'pos'}`}>{e.ref ? '' : Math.abs(e.serve - 1) < 0.01 ? '–' : `×${e.serve.toFixed(2)}`}</span>
      </Tip>
      <span className="rk">
        {FAMILIES.map((f, i) => {
          const a = arrows(e.fam[i]);
          const traits = f.traits.map((t) => [t, (e.cur.tp[t] ?? 0) - (e.base.tp[t] ?? 0)] as const).filter(([, d]) => arrows(d));
          return (
            <Tip key={f.id} content={() => <TipCard title={<Term id="riskFamily">{f.label}</Term>} value={a || '='}>{traits.length ? traits.map(([t, d]) => <div key={t} className="row-i small"><span>{TRAIT_BY_ID[t].name}</span><span className="sp" /><b className={d > 0 ? 'tone-neg' : 'tone-pos'}>{arrows(d)}</b></div>) : 'No trait in this family moves noticeably.'}</TipCard>}>
              <span className={a ? (e.fam[i] > 0 ? 'up' : 'dn') : 'z'}>{a ? a.slice(0, 2) : '·'}</span>
            </Tip>
          );
        })}
      </span>
    </>
  );
}

/** One slot: the label spans one line per card; each card line shows the card's own effect (B2). Selected cards first,
 *  then the alternatives (up to four lines, "+N" for the rest). */
function SlotRow({ s, kind, sl, p, effs, onPick }: { s: GameStateV2; kind: Kind; sl: Slot; p: Params; effs?: Record<string, Effect>; onPick: (p: Params) => void }) {
  const [more, setMore] = useState(false);
  const on = sl.opts.filter((o) => isOn(sl, p, o.v));
  const off = sl.opts.filter((o) => !isOn(sl, p, o.v));
  const shown = more ? off : off.slice(0, Math.max(0, 4 - on.length));
  const hidden = off.length - shown.length;
  const lines = on.length + shown.length + (hidden > 0 ? 1 : 0);
  return (
    <>
      <div className="sl" style={{ gridRow: `span ${lines}` }}><Term id={sl.term}>{sl.label}</Term>{sl.sub && <small>{sl.sub}</small>}</div>
      {[...on, ...shown].map((o, i) => {
        const e = effs?.[String(o.v)];
        const sel = i < on.length;
        return (
          <div key={String(o.v)} className={`bp-line ${sel ? 'sel' : ''}`} data-line={`${sl.field}:${String(o.v)}`}>
            <div className="sc"><OptBtn s={s} kind={kind} sl={sl} o={o} p={p} on={sel} onPick={onPick} /></div>
            {e ? <Effects s={s} e={e} /> : <span className="bp-span" />}
          </div>
        );
      })}
      {hidden > 0 && <div className="bp-line"><button className="bp-more small" onClick={() => setMore(true)}>+{hidden} more</button></div>}
    </>
  );
}

function OptBtn({ s, kind, sl, o, p, on, onPick }: { s: GameStateV2; kind: Kind; sl: Slot; o: Opt; p: Params; on?: boolean; onPick: (p: Params) => void }) {
  const locked = !on && o.v !== 'broad' ? optionLocked(s, lockKey(sl, o.v) as never, lockVal(sl, o.v)) : undefined;
  const nodeId = OPTION_NODE[`${lockKey(sl, o.v)}:${String(lockVal(sl, o.v))}`];
  const testId = `${sl.field}:${String(o.v)}`;
  if (locked && nodeId) {
    const st = nodeStatus(s, nodeId);
    const pr = s.player.tree[nodeId]?.progress ?? 0;
    const n = TREE_BY_ID[nodeId];
    return (
      <Tip content={() => <TipCard title={<>{o.label} <Lock size={11} /></>} value={<span className="tag2">locked</span>} rows={[{ label: 'Unlocked by', value: n?.name ?? nodeId }, { label: 'Status', value: st === 'active' ? `${F.pct(pr)} researched` : st }]} footer="Click to open the idea in Research.">{locked}</TipCard>}>
        <button className="bp-opt locked" data-opt={testId} data-node={nodeId} onClick={() => { store.setTab('research.sel', nodeId); store.goto('research'); }}>
          <Lock size={11} />{o.label}<span className="bp-node"><ICON.research size={10} />{n?.name ?? nodeId}{st === 'active' ? ` ${F.pct(pr)}` : st === 'queued' ? ' queued' : ''}</span>
        </button>
      </Tip>
    );
  }
  const np = withOpt(sl, p, o.v);
  return (
    <Tip content={on ? () => <TipCard title={o.label} value={<span className="tag2">selected</span>}>{sl.multi ? 'Click to turn it off.' : 'The card in this slot.'}</TipCard> : () => <OptPreview s={s} kind={kind} label={o.label} p={p} np={np} />}>
      <button className={`bp-opt ${on ? 'on' : ''}`} data-opt={testId} onClick={() => onPick(np)}>{on && <Check size={12} />}{o.label}</button>
    </Tip>
  );
}

/** Hover preview of an alternative card: what changes vs the current blueprint (computed on hover). */
function OptPreview({ s, kind, label, p, np }: { s: GameStateV2; kind: Kind; label: string; p: Params; np: Params }) {
  const a = evaluate(s, kind, p);
  const b = evaluate(s, kind, np);
  if (!a.card || !b.card) return <TipCard title={label}>{b.err ?? a.err}</TipCard>;
  if (b.card.reason && b.card.reason !== a.card.reason) return <TipCard title={label} value={<span className="tone-neg">blocked</span>}>{b.card.reason}</TipCard>;
  const e = effectOf(b, a, false);
  const rows = [
    { label: 'Capability', value: `L ${F.dLevel(e.dL)}` },
    { label: 'Time', value: F.days(e.dDays, true) },
    { label: 'Cash', value: F.money(e.dCash, { signed: true }) },
    { label: 'Serving cost', value: `×${e.serve.toFixed(2)}` },
    ...FAMILIES.map((f, i) => ({ label: f.label, value: arrows(e.fam[i]) || '=' })),
  ];
  return <TipCard title={label} value={<span className="tag2">preview</span>} rows={rows}>vs your current blueprint</TipCard>;
}

function BaseSummary({ s, kind, p, onNewBase }: { s: GameStateV2; kind: Kind; p: Params; onNewBase?: () => void }) {
  const t = kind === 'distill' ? s.player.models.versions.find((v) => v.id === p.teacherVersionId) : undefined;
  const b = s.player.models.bases.find((x) => x.id === (t?.baseId ?? p.baseId));
  return (
    <div className="bp-note small">
      {b ? <><b>{b.name}</b> <span className="dim">· {F.size(b.design.size)} · {b.design.shape === 'moe' ? 'MoE' : F.words(b.design.shape)} · {F.words(b.design.data)}{b.design.curation.hazard ? ' · hazard filter' : ''}</span></> : <span className="dim">no base</span>}
      <span className="sp" />{onNewBase && <button className="btn btn-sm btn-ghost" data-test="bp-to-base" onClick={onNewBase}>New base ›</button>}
    </div>
  );
}

// ───────── predicted model ─────────
const MS: [number, string][] = [[6.5, 'agent'], [8.5, 'research agent'], [10, 'superhuman coder'], [12, 'superhuman researcher']];
function Predicted({ s, card, err, cur }: { s: GameStateV2; card?: Card_; err?: string; cur: Eval }) {
  const iv = internalVersion(s);
  const now = internalEval(s).L;
  const doms = iv ? measuredDomains(iv) : undefined;
  const W = 380;
  const band = card?.band ?? [0, 0];
  const lo = Math.max(0, Math.floor(Math.min(now, band[0]) - 1.5));
  const hi = Math.min(16, Math.ceil(Math.max(now, band[1]) + 1.5));
  const x = (v: number) => 8 + ((v - lo) / Math.max(1e-6, hi - lo)) * (W - 16);
  const dChips = card && doms ? DOMS.map((d) => [d, mid(card.domains[d]) - (doms[d] ?? 0)] as const).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4) : [];
  return (
    <Card title="Predicted model" sub={iv ? <>vs {iv.name} internal</> : undefined} className="bp-pred" home="runPrediction" right={<button className="btn btn-sm" data-go="models" onClick={() => store.goto('models')}>Model card ›</button>}>
      {err && <div className="tone-neg small">{err}</div>}
      {card && card.band[1] > 0 && (
        <>
          <svg viewBox={`0 0 ${W} 56`} width="100%" className="bp-ruler">
            <rect x={8} y={24} width={W - 16} height={6} rx={3} fill={C.line} />
            {MS.filter(([v]) => v > lo && v < hi).map(([v, n]) => <g key={n}><line x1={x(v)} x2={x(v)} y1={20} y2={34} stroke={C.text3} strokeDasharray="2 2" /><text x={x(v)} y={48} textAnchor="middle" className="bp-ax">{n}</text></g>)}
            <rect x={x(band[0])} y={19} width={Math.max(4, x(band[1]) - x(band[0]))} height={16} rx={4} fill={C.cap} opacity={0.85} />
            <text x={Math.max(60, Math.min(W - 60, x(mid(band))))} y={13} textAnchor="middle" className="bp-band-lbl">L {F.level(band[0])}–{F.level(band[1])}</text>
            <line x1={x(now)} x2={x(now)} y1={14} y2={40} stroke="#fff" strokeWidth={2} />
            {iv && <text x={x(now)} y={10} textAnchor="middle" className="bp-ax now">{iv.name}</text>}
          </svg>
          <div className="tip-cap"><Term id="domains">Domains</Term></div>
          <div className="bp-chips">
            {dChips.map(([d, v]) => { const I = DOMAIN_ICON[d]; return <Tip key={d} content={() => <TipCard title={<Term id="domains">{d}</Term>} value={`${F.dLevel(v)} L`} rows={[{ label: 'Predicted', value: F.level(mid(card.domains[d])) }, { label: iv?.name ?? 'Today', value: F.level(doms?.[d] ?? 0) }]}>This domain's predicted level vs your internal model.</TipCard>}><span className="dch"><I size={11} /><span className="k">{d}</span><b className={v >= 0 ? 'tone-pos' : 'tone-neg'}>{F.dLevel(v)}</b></span></Tip>; })}
          </div>
          <div className="tip-cap"><Term id="riskFamily">Risk pressure</Term> <span className="dim">vs {iv?.name ?? 'today'}</span></div>
          <div className="bp-chips">
            {FAMILIES.map((f) => {
              const d = f.traits.reduce((a, t) => a + (cur.tp[t] ?? 0), 0);
              const a = arrows(d);
              return (
                <Tip key={f.id} content={() => <TipCard title={<Term id="riskFamily">{f.label}</Term>} value={a || '='}>{f.traits.filter((t) => arrows(cur.tp[t] ?? 0)).map((t) => <div key={t} className="row-i small"><span>{TRAIT_BY_ID[t].name}</span><span className="sp" /><b className={(cur.tp[t] ?? 0) > 0 ? 'tone-neg' : 'tone-pos'}>{arrows(cur.tp[t] ?? 0)}</b></div>)}<div className="dim small">Predicted change of the trait beliefs vs your internal model, from this blueprint's training signals.</div></TipCard>}>
                  <span className="dch" data-family={f.id}><f.icon size={11} /><span className="k">{f.label}</span><b className={a ? (d > 0 ? 'tone-neg' : 'tone-pos') : 'dim'}>{a ? a.slice(0, 2) : '='}</b></span>
                </Tip>
              );
            })}
          </div>
          <div className="small dim bp-mon"><Term id="monitorability">Monitorability</Term> {card.monitorability}</div>
        </>
      )}
      {card && card.band[1] <= 0 && <div className="dim small">{card.reason ?? 'No prediction'}</div>}
    </Card>
  );
}

// ───────── plan (pool share, Gantt, start) ─────────
function Plan({ s, kind, card, p, setShare, warn, children }: { s: GameStateV2; kind: Kind; card?: Card_; p: Params; setShare: (v: number) => void; warn: string[]; children: ReactNode }) {
  const day = s.time.day;
  const evals = kind === 'base' ? 0 : evalDaysFor(s);
  const post = kind === 'base' ? 77 : 0; // the reference post-train that follows a base (shape only)
  const train = card ? Math.max(1, card.etaDays - card.setupDays) : 0;
  const total = Math.max(30, (card?.etaDays ?? 0) + post + evals + 10);
  const running = s.player.models.runs.filter((r) => r.status === 'running' || r.status === 'paused');
  const f = (d: number) => `${Math.min(100, (d / total) * 100)}%`;
  const share = Number(p.poolShare);
  const months: number[] = [];
  const stepM = Math.max(1, Math.ceil(total / 30.4 / 5));
  for (let i = 1; i * stepM * 30.4 <= total; i++) months.push(Math.round(i * stepM * 30.4));
  const ready = card ? card.etaDays + post + evals : 0;
  return (
    <Card title="Plan" className="bp-plan" home="runPlan" right={
      <span className="row-i" id="ctl-runpool"><Term id="poolShare">Pool share</Term>
        <span className="seg bp-pills">{POOL_PILLS.filter((v) => v >= POOL_SHARE_RANGE[0]).map((v) => <button key={v} className={`seg-btn ${Math.abs(v - share) < 1e-6 ? 'active' : ''}`} data-pool={v} onClick={() => setShare(v)}>{F.pct(v)}</button>)}</span>
      </span>
    }>
      {card && (
        <>
          <div className="small dim bp-gets row-i">
            <Tip content={() => <TipCard title={<Term id="poolShare">Pool share</Term>} rows={[{ label: 'Asks', value: F.pct(card.poolShare) }, { label: 'Gets now', value: F.pct(card.effShare) }]}>Runs that ask for more than the pool are scaled down together.</TipCard>}>{card.effShare < card.poolShare - 1e-6 ? <span>gets <b className="tone-warn">{F.pct(card.effShare)}</b> now: running runs share the pool</span> : <span>gets {F.pct(card.effShare)} of the <Term id="trainingPool">training pool</Term></span>}</Tip>
            <span className="sp" />
            <Tip content={() => <TipCard title="Ready" value={fmtDate(dateOf(s, day + ready))} rows={[{ label: 'Training', value: F.days(card.etaDays) }, ...(post ? [{ label: 'Reference post-train', value: F.days(post) }] : []), ...(evals ? [{ label: <Term id="evals">Evals</Term>, value: F.days(evals) }] : [])]}>When the model can be used.</TipCard>}><span>ready <b data-test="bp-ready">{fmtDate(dateOf(s, day + ready))}</b></span></Tip>
          </div>
          <div className="bp-gantt">
            {running.slice(0, 3).map((r) => {
              const left = Math.max(0, r.flopNeeded - r.flopDone) / Math.max(1, r.flopNeeded);
              const stall = runStall(s, r);
              return <div className="bp-lane" key={r.id}><Tip content={() => <TipCard title={runTitle(s, r)} rows={[{ label: 'FLOP left', value: F.pct(left) }]}>A run already training; it shares the pool with this one.</TipCard>}><span className="bp-ll small dim">{runTitle(s, r)}</span></Tip><span className="bp-track2"><span className="bp-bar run" style={{ width: f(Math.max(3, left * (r.minDays || 60))) }} />{stall && <span className="small tone-warn bp-bl">{stall}</span>}</span></div>;
            })}
            <div className="bp-lane me"><span className="bp-ll small"><b>{KIND_LABEL[kind]}</b></span>
              <span className="bp-track2">
                {card.setupDays > 0 && <span className="bp-bar setup" style={{ width: f(card.setupDays) }} title="waiting for engineers" />}
                <span className="bp-bar train" style={{ left: f(card.setupDays), width: f(train) }}>{kind === 'base' ? 'base' : 'train'}</span>
                {post > 0 && <span className="bp-bar post" style={{ left: f(card.etaDays), width: f(post) }}>post</span>}
                {evals > 0 && <span className="bp-bar evals" style={{ left: f(card.etaDays), width: f(evals) }}><Term id="evals">evals</Term></span>}

              </span>
            </div>
            {kind === 'base' && card.limits && (
              <div className="bp-lane"><span className="bp-ll small dim"><Term id="knowHow">Know-how</Term></span>
                <span className="bp-track2"><svg className="bp-wedge" viewBox="0 0 100 20" preserveAspectRatio="none" style={{ width: f(card.etaDays) }}><polygon points="0,20 100,20 100,0" fill="rgba(229,96,96,.35)" stroke={C.bad} strokeWidth={0.6} vectorEffect="non-scaling-stroke" /></svg><span className="small tone-neg bp-bl" style={card.etaDays / total > 0.8 ? { right: 0 } : { left: f(card.etaDays) }}><Term id="behindAtFinish">behind</Term> ›</span></span>
              </div>
            )}
            <div className="bp-axis small dim">{months.map((d) => <span key={d} style={{ left: f(d) }}>{fmtMonth(dateOf(s, day + d))}</span>)}</div>
          </div>
        </>
      )}
      <div className="bp-launch">
        {children}
        {warn.map((w) => <span key={w} className="small tone-warn">⚠ {w}</span>)}
      </div>
    </Card>
  );
}
