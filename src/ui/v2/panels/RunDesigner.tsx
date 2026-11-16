// Run designer (IA.md L2 "Runs", PROPOSALS §3, mockups/03-run-designer.png). HOME of the run prediction (band,
// domains, ETA, cash, signals, trait pressure) and of the next-model gates. Recipe options are OptionTiles whose
// effect glyphs come from sweeping the engine's runCard / runTraitPressure once per option against the current
// recipe. The "now" level on the ruler and the dashed radar are unlabeled references to the internal model.
import { useMemo, useState, type ReactNode } from 'react';
import {
  BookMarked, CircleDashed, CircleOff, Coins, Equal, Expand, Eye, Feather, FileCheck, Filter, Heart, Layers, Layers2, LayoutGrid, MessageCircle,
  Minus, Mountain, MousePointer2, Repeat2, RotateCcw, Save, Shapes, ShieldCheck, ShieldHalf, ShieldPlus, ShieldX, Shrink, Sigma, Sparkle, Square,
  Syringe, WandSparkles, type LucideIcon,
} from 'lucide-react';
import { CRITICAL_TRAITS, SIGNALS, TRAIT_BY_ID } from '../../../data/v2/traits';
import {
  POOL_SHARE_RANGE, baseFromParams, dateOf, evalDaysFor, fmtDate, internalEval, internalVersion, liveCommitments, measuredDomains, nextModelGate, postFromParams,
  runCard, runTraitPressure, traitGraph,
} from '../../../engine/v2';
import type { GameStateV2, LaunchRunParams, RLFamily, TraitId } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, Slider, Term, Tip, TipCard, unlocked, type Params } from '../ui';
import { Card, CauseChain, OptionTile, PanelHead, type ChainLink } from '../kit';
import * as F from '../fmt';
import { DOMAIN_ICON, ICON, SIGNAL_ICON, TRAIT_ICON } from '../icons';
import { C } from '../theme';
import { arrows, mainPath, signalDelta, traitPushes, type GraphEdge } from './runEffects';
import { SIGNAL_SHORT } from './TraitGraph';
import './runs.css';

type Kind = 'post' | 'base' | 'continue' | 'distill';
type Card_ = ReturnType<typeof runCard>;
const TPL_KEY = 'ai27.v2.runTemplates';
const DEFAULTS: Params = {
  scale: 'frontier', shape: 'moe', data: 'balanced', quality: true, hazard: false, safetyPretrain: false, licensedShare: 0.1,
  pref: 'constitution', rlFocus: 'broad', rlIntensity: 'heavyHardened', inoculation: false, cot: 'visible', safety: 'standard', poolShare: 0.5,
};
const RECOMMENDED: Params = { ...DEFAULTS, rlIntensity: 'light', poolShare: 0.4 };
const DOMS = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'];
const TRAIT_CODE: Record<string, string> = { SYC: 'SYC', RH: 'RH', PROXY: 'PROXY', SA: 'SA', PERSONA: 'PERSONA', OBF: 'OBF', EA: 'EA', TGAME: 'TGAME', CONCEAL: 'CONCEAL', POWER: 'POWER', AF: 'AF', SAND: 'SAND', SCHEME: 'SCHEME', COLLUDE: 'COLLUDE', SUCC: 'SUCC', HONEST: 'HONEST', CORRIG: 'CORRIG' };
const KIND_LABEL: Record<Kind, string> = { post: 'Post-train', base: 'Base', continue: 'Continue', distill: 'Distill' };
const KIND_ICON: Record<Kind, LucideIcon> = { post: WandSparkles, base: Layers, continue: Repeat2, distill: SIGNAL_ICON.S6 };
const KIND_TERM: Record<Kind, string> = { post: 'postTrain', base: 'baseRun', continue: 'continueRun', distill: 'distillRun' };
const ACTION: Record<Kind, string> = { post: 'launchPost', base: 'launchBase', continue: 'launchContinue', distill: 'launchDistill' };

type Val = string | boolean;
interface Row { field: string; label: string; sub: string; term: string; opts: [Val, string, LucideIcon][]; multi?: boolean }
const RL_OPTS: [RLFamily, string, LucideIcon][] = [
  ['math', 'Math', Sigma], ['swe', 'SWE', DOMAIN_ICON.CODE], ['computerUse', 'Computer use', MousePointer2], ['mlResearch', 'ML research', DOMAIN_ICON.RSCH],
  ['longHorizon', 'Long tasks', SIGNAL_ICON.S3], ['cyber', 'Cyber', DOMAIN_ICON.CYBER], ['bio', 'Bio', DOMAIN_ICON.BIO],
];
const POST_ROWS: Row[] = [
  { field: 'pref', label: 'Rewarded for', sub: 'preference data', term: 'preference', opts: [['minimal', 'Minimal', Minus], ['engagement', 'Engagement', Heart], ['constitution', 'Constitution', BookMarked], ['persuasion', 'Persuasion', MessageCircle]] },
  { field: 'rlFocus', label: 'Practise on', sub: 'RL focus · pick ≤ 2', term: 'rlFocus', multi: true, opts: [...RL_OPTS, ['broad', 'Broad', Shapes]] },
  { field: 'rlIntensity', label: 'RL intensity', sub: 'graders and budget', term: 'rlIntensity', opts: [['light', 'Light', Feather], ['heavyCheap', 'Heavy, cheap graders', Coins], ['heavyHardened', 'Heavy, hardened', ShieldCheck]] },
  { field: 'cot', label: 'Chain of thought', sub: 'what monitors can read', term: 'cot', opts: [['visible', 'Visible', Eye], ['pressured', 'Pressured', SIGNAL_ICON.S4], ['faithful', 'Faithful', FileCheck], ['latent', 'Latent', CircleDashed]] },
  { field: 'safety', label: 'Safety training', sub: 'alignment pass', term: 'safetyTraining', opts: [['minimal', 'Minimal', Minus], ['standard', 'Standard', ShieldHalf], ['heavy', 'Heavy', ShieldPlus]] },
  { field: 'inoculation', label: 'Inoculation', sub: 'prompting', term: 'inoculation', opts: [[false, 'Off', CircleOff], [true, 'On', Syringe]] },
];
const BASE_ROWS: Row[] = [
  { field: 'scale', label: 'Scale', sub: 'compute vs the frontier', term: 'scale', opts: [['compact', 'Compact', Shrink], ['frontier', 'Frontier', Mountain], ['stretch', 'Stretch', Expand]] },
  { field: 'shape', label: 'Shape', sub: 'architecture', term: 'shape', opts: [['dense', 'Dense', Square], ['overtrained', 'Overtrained', Layers2], ['moe', 'MoE', LayoutGrid], ['latent', 'Latent', CircleDashed]] },
  { field: 'data', label: 'Data', sub: 'pretraining mix', term: 'dataMix', opts: [['balanced', 'Balanced', Equal], ['codeMath', 'Code + math', DOMAIN_ICON.CODE], ['science', 'Science', DOMAIN_ICON.BIO], ['synthetic', 'Synthetic', Sparkle], ['multimodal', 'Multimodal', DOMAIN_ICON.MEDIA]] },
  { field: 'quality', label: 'Quality filter', sub: 'curation', term: 'dataMix', opts: [[true, 'On', Filter], [false, 'Off', CircleOff]] },
  { field: 'hazard', label: 'Hazard filter', sub: 'remove bio/cyber how-to', term: 'hazardFilter', opts: [[false, 'Off', CircleOff], [true, 'On', ShieldX]] },
  { field: 'safetyPretrain', label: 'Safety pretraining', sub: 'curated AI discourse', term: 'safetyPretrain', opts: [[false, 'Off', CircleOff], [true, 'On', ShieldCheck]] },
];

function loadTemplates(): Record<string, { kind: Kind; p: Params }> {
  try {
    return JSON.parse(localStorage.getItem(TPL_KEY) ?? '{}');
  } catch {
    return {};
  }
}
const mid = (b: [number, number]) => (b[0] + b[1]) / 2;
const latestTeacher = (s: GameStateV2) => s.player.models.versions.filter((v) => v.variant === 'full').slice(-1)[0]?.id ?? '';

function toLP(s: GameStateV2, kind: Kind, p: Params): LaunchRunParams {
  const lp: LaunchRunParams = { kind, poolShare: Number(p.poolShare) };
  if (kind === 'base') lp.base = baseFromParams(p);
  if (kind === 'post') {
    lp.post = postFromParams(p);
    lp.baseId = String(p.baseId);
  }
  if (kind === 'continue') lp.baseId = String(p.baseId);
  if (kind === 'distill') lp.teacherVersionId = String(p.teacherVersionId ?? latestTeacher(s));
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
/** Protective traits: up is good. */
const badDir = (t: string, d: number) => (TRAIT_BY_ID[t as TraitId]?.protective ? -d : d);

interface Glyph { t: string; tone: 'good' | 'bad' | 'neu' }
/** Effect glyphs of an option vs the current recipe. */
function glyphs(cur: Eval, alt: Eval): { g: Glyph[]; locked?: string; traits: [string, number][] } {
  if (!alt.card || !cur.card) return { g: [], locked: alt.err ?? cur.err, traits: [] };
  if (alt.card.reason && alt.card.reason !== cur.card.reason) return { g: [], locked: alt.card.reason, traits: [] };
  const g: Glyph[] = [];
  const dL = mid(alt.card.band) - mid(cur.card.band);
  if (Math.abs(dL) >= 0.05) g.push({ t: `L ${F.dLevel(dL)}`, tone: dL > 0 ? 'good' : 'bad' });
  const dd = alt.card.etaDays - cur.card.etaDays;
  if (Math.abs(dd) >= 1) g.push({ t: F.days(dd, true), tone: dd < 0 ? 'good' : 'bad' });
  const dc = alt.card.cash - cur.card.cash;
  if (Math.abs(dc) >= 0.05) g.push({ t: F.money(dc, { signed: true }), tone: dc < 0 ? 'good' : 'bad' });
  const dom = DOMS.map((k) => {
    const a = alt.card!.domains[k as keyof Card_['domains']];
    const b = cur.card!.domains[k as keyof Card_['domains']];
    return [k, a && b ? mid(a) - mid(b) - dL : 0] as const;
  }).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  if (dom && Math.abs(dom[1]) >= 0.3) g.push({ t: `${dom[0]} ${F.dLevel(dom[1])}`, tone: 'neu' });
  const traits = (Object.keys(alt.tp) as TraitId[]).map((t) => [t, (alt.tp[t] ?? 0) - (cur.tp[t] ?? 0)] as [string, number]).filter(([, d]) => arrows(d)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  for (const [t, d] of traits.slice(0, 2)) g.push({ t: `${TRAIT_CODE[t]} ${arrows(d)}`, tone: badDir(t, d) > 0 ? 'bad' : 'good' });
  const ds = alt.card.serveCost / Math.max(1e-6, cur.card.serveCost) - 1;
  if (Math.abs(ds) >= 0.05) g.push({ t: `serve ${F.pct(ds, 0, true)}`, tone: ds < 0 ? 'good' : 'bad' });
  if (alt.card.monitorability !== cur.card.monitorability) g.push({ t: `monitor ${alt.card.monitorability}`, tone: alt.card.monitorability === 'high' ? 'good' : 'bad' });
  return { g, traits };
}

export function RunDesigner({ s }: { s: GameStateV2 }) {
  const [kind, setKind] = useState<Kind>('post');
  const lastBase = s.player.models.bases[s.player.models.bases.length - 1];
  const defFor = (baseId: string): Params => ({ ...DEFAULTS, baseId, ...(s.player.models.bases.find((b) => b.id === baseId)?.design.shape === 'latent' ? { cot: 'latent' } : {}) });
  const [p, setP] = useState<Params>(() => defFor(lastBase?.id ?? ''));
  const [tpls, setTpls] = useState(loadTemplates);
  const set = (k: string, v: number | string | boolean) => setP({ ...p, [k]: v, ...(k === 'baseId' && s.player.models.bases.find((b) => b.id === v)?.design.shape === 'latent' ? { cot: 'latent' } : {}) });
  const kinds: Kind[] = ['post', ...(unlocked(s, 'baseRuns') ? (['base', 'continue'] as Kind[]) : []), 'distill'];
  const refP: Params = { ...defFor(String(p.baseId)), poolShare: p.poolShare, ...(p.teacherVersionId ? { teacherVersionId: p.teacherVersionId } : {}) };
  const key = `${s.time.day}|${kind}|${JSON.stringify(p)}`;
  const { cur, ref, opts, ends } = useMemo(() => {
    const cur = evaluate(s, kind, p);
    const ref = evaluate(s, kind, refP);
    const opts: Record<string, ReturnType<typeof glyphs> & { alt: Eval }> = {};
    const rows = kind === 'post' ? POST_ROWS : kind === 'base' ? BASE_ROWS : [];
    for (const r of rows) {
      for (const [v] of r.opts) {
        let np: Params;
        if (r.multi) {
          const focus = String(p.rlFocus) === 'broad' ? [] : String(p.rlFocus).split(',').filter(Boolean);
          if (v === 'broad') np = { ...p, rlFocus: 'broad' };
          else {
            const next = focus.includes(String(v)) ? focus.filter((x) => x !== v) : [...focus, String(v)].slice(-2);
            np = { ...p, rlFocus: next.length ? next.join(',') : 'broad' };
          }
        } else np = { ...p, [r.field]: v };
        const alt = evaluate(s, kind, np);
        opts[`${r.field}:${String(v)}`] = { ...glyphs(cur, alt), alt };
      }
    }
    const ends = POOL_SHARE_RANGE.map((ps) => evaluate(s, kind, { ...p, poolShare: ps }).card);
    return { cur, ref, opts, ends };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const card = cur.card;
  const err = cur.err;
  const params: Params = { ...p, ...(kind === 'distill' ? { teacherVersionId: String(p.teacherVersionId ?? latestTeacher(s)) } : {}) };
  const saveTpl = () => {
    const name = `${kind}-${Object.keys(tpls).length + 1}`;
    const next = { ...tpls, [name]: { kind, p } };
    localStorage.setItem(TPL_KEY, JSON.stringify(next));
    setTpls(next);
    store.say(`Template ${name} saved`, 'pos');
  };
  const pledged = s.player.safety.monitorabilityCommitment || liveCommitments(s).some((c) => c.condition.predicate === 'monitorabilityPledge');
  const breaksPledge = pledged && ((kind === 'base' && p.shape === 'latent') || (kind === 'post' && (p.cot === 'latent' || p.cot === 'pressured')));
  const gate = nextModelGate(s);
  const warn: string[] = [];
  if (kind === 'base' && gate.dataRatio < 1) warn.push(`Data wall: stock covers ${F.pct(gate.dataRatio)} of the need`);
  if (kind === 'base' && card && card.etaDays > 150) warn.push('Cluster too small: run exceeds 150 days');
  if (breaksPledge) warn.push('Breaks your monitorability pledge');
  if (kind === 'base' && Number(p.licensedShare) < 0.3) warn.push('Unlicensed data: litigation risk');
  const baseSel = (kind === 'post' || kind === 'continue') && (
    <label className="rd-on small dim">on
      <select className="text-input" data-test="rd-base" value={String(p.baseId)} onChange={(e) => set('baseId', e.target.value)}>{s.player.models.bases.map((b) => <option key={b.id} value={b.id}>{b.name} base · {F.words(b.design.scale)} · {b.design.shape === 'moe' ? 'MoE' : F.words(b.design.shape)}</option>)}</select>
    </label>
  );
  const teacherSel = kind === 'distill' && (
    <label className="rd-on small dim">teacher
      <select className="text-input" data-test="rd-teacher" value={String(params.teacherVersionId)} onChange={(e) => set('teacherVersionId', e.target.value)}>{s.player.models.versions.filter((v) => v.status !== 'retired').map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
    </label>
  );
  return (
    <div className="panel-v2 rd" data-panel="rundesigner">
      <PanelHead
        icon={ICON.runs}
        title="Run designer"
        tabs={<>
          <div className="tabs2 rd-kinds">
            {kinds.map((k) => { const I = KIND_ICON[k]; return <button key={k} className={`tab2 seg-btn ${kind === k ? 'on active' : ''}`} data-rd-kind={k} onClick={() => setKind(k)}><I size={14} /><Term id={KIND_TERM[k]}>{KIND_LABEL[k]}</Term></button>; })}
          </div>
          {baseSel}{teacherSel}
        </>}
        right={<div className="btn-row">
          <button className="btn btn-sm" data-test="rd-recommended" onClick={() => setP({ ...RECOMMENDED, baseId: p.baseId, ...(p.cot === 'latent' && kind === 'post' && defFor(String(p.baseId)).cot === 'latent' ? { cot: 'latent' } : {}) })}><ICON.check size={13} /> Recommended</button>
          <button className="btn btn-sm" data-test="rd-save" onClick={saveTpl}><Save size={13} /> Save template</button>
          {Object.entries(tpls).slice(-4).map(([n, t]) => <button key={n} className="btn btn-sm btn-ghost" onClick={() => { setKind(t.kind); setP(t.p); }}>{n}</button>)}
        </div>}
      />
      <Gates s={s} />
      <div className="rd-main">
        <Card title="Recipe" sub="each option shows what it changes vs your current recipe" right={<button className="btn btn-sm" data-test="rd-reset" onClick={() => setP(defFor(String(p.baseId)))}><RotateCcw size={13} /> Reference</button>} className="rd-recipe">
          {(kind === 'post' ? POST_ROWS : kind === 'base' ? BASE_ROWS : []).map((r) => (
            <div className="rd-row" key={r.field}>
              <div className="rd-rl"><b><Term id={r.term}>{r.label}</Term></b><span className="dim small">{r.sub}</span></div>
              <div className={`rd-opts ${r.multi ? 'compact' : ''}`}>
                {r.opts.map(([v, label, icon]) => {
                  const k = `${r.field}:${String(v)}`;
                  const o = opts[k];
                  const focus = String(p.rlFocus) === 'broad' ? [] : String(p.rlFocus).split(',');
                  const active = r.multi ? (v === 'broad' ? String(p.rlFocus) === 'broad' : focus.includes(String(v))) : p[r.field] === v;
                  const isRef = refP[r.field] === v || (r.multi && v === 'broad');
                  const gl = o?.g ?? [];
                  return (
                    <OptionTile
                      key={k} testId={k} label={label} icon={icon} active={active} locked={!active ? o?.locked : undefined}
                      onClick={() => {
                        if (!r.multi) return set(r.field, v);
                        if (v === 'broad') return set('rlFocus', 'broad');
                        const next = focus.includes(String(v)) ? focus.filter((x) => x !== v) : [...focus, String(v)].slice(-2);
                        set('rlFocus', next.length ? next.join(',') : 'broad');
                      }}
                      glyphs={gl.length ? gl.slice(0, 3).map((x, i) => <span key={i} className={`gl ${x.tone}`}>{x.t}</span>) : <span className="dim">{active ? 'selected' : isRef ? 'reference' : 'no change'}</span>}
                      tip={o && !o.locked && !active ? () => <OptionPreview s={s} label={label} cur={cur} alt={o.alt} traits={o.traits} glyphs={gl} /> : undefined}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          {kind === 'base' && (
            <div className="rd-row">
              <div className="rd-rl"><b><Term id="licensedShare">Licensed data</Term></b><span className="dim small">share of the corpus</span></div>
              <div className="rd-slider"><Slider value={Number(p.licensedShare)} min={0} max={1} step={0.05} onChange={(v) => set('licensedShare', v)} width={260} /><span className="num">{F.pct(Number(p.licensedShare))}</span></div>
            </div>
          )}
          {(kind === 'continue' || kind === 'distill') && <div className="dim small rd-row">{kind === 'continue' ? <>A <Term id="continueRun">continue run</Term> trains the selected base further on new data. No recipe choices.</> : <>A <Term id="distillRun">distillation run</Term> copies the teacher into a cheaper model. It inherits the teacher's dispositions.</>}</div>}
          <div className="rd-row" id="ctl-runpool">
            <div className="rd-rl"><b><Term id="trainingPool">Compute share</Term></b><span className="dim small">of the training pool</span></div>
            <div className="rd-pool">
              <Slider value={Number(p.poolShare)} min={POOL_SHARE_RANGE[0]} max={POOL_SHARE_RANGE[1]} step={0.05} onChange={(v) => set('poolShare', v)} width={300} />
              <div className="rd-pool-ends small dim">
                <span>{F.pct(POOL_SHARE_RANGE[0])} · {ends[0] ? F.days(ends[0].etaDays) : '—'}</span>
                <b className="num">{F.pct(Number(p.poolShare))}</b>
                <span>{F.pct(POOL_SHARE_RANGE[1])} · {ends[1] ? F.days(ends[1].etaDays) : '—'}</span>
              </div>
            </div>
          </div>
        </Card>
        <Predicted s={s} card={card} err={err} kind={kind} />
        <Pushes s={s} cur={cur} ref={ref} />
      </div>
      <Compare s={s} kind={kind} cur={cur} ref={ref} warn={warn} breaksPledge={breaksPledge}>
        <ActBtn id={ACTION[kind]} params={params} primary small={false} icon={ICON.run} label={`Launch ${KIND_LABEL[kind].toLowerCase()}`} block={err || card?.reason} reason />
        <span className="small dim">uses {F.pct(Number(p.poolShare))} of the <Term id="trainingPool">training pool</Term>{s.player.models.runs.some((r) => r.status === 'running') ? ' · running runs share it' : ''}</span>
      </Compare>
    </div>
  );
}

// ───────── next-model gates (HOME) ─────────
function Gates({ s }: { s: GameStateV2 }) {
  const g = nextModelGate(s);
  const items: { id: typeof g.binding; icon: LucideIcon; label: string; term: string; v: string; ok: boolean; tip: string; to?: { panel: string; tab?: string; anchor?: string } }[] = [
    { id: 'training', icon: ICON.run, label: 'train', term: 'trainingDays', v: F.days(g.trainingDays), ok: g.trainingDays <= 120, tip: 'Days a frontier base run takes on your whole training pool.', to: { panel: 'company', tab: 'split' } },
    { id: 'data', icon: ICON.data, label: 'data', term: 'dataWall', v: F.mult(g.dataRatio), ok: g.dataRatio >= 1, tip: 'Usable data stock over what the next frontier base needs. Below 1× you hit the data wall.' },
    { id: 'power', icon: ICON.power, label: 'power free', term: 'mw', v: F.power(Math.max(0, g.mwFree)), ok: g.mwFree > 0, tip: 'Spare power on your live sites for more chips.', to: { panel: 'compute', anchor: 'sites' } },
    { id: 'cash', icon: ICON.cash, label: 'of cash', term: 'cash', v: F.pct(g.cashShare), ok: g.cashShare <= 0.5, tip: 'Cash a reference post-training run on it would take, as a share of your cash.', to: { panel: 'finance' } },
  ];
  return (
    <div className="rd-gates" data-home="nextModelGate">
      <span className="rd-gates-k"><Term id="nextModelGate">Next frontier model</Term></span>
      {items.map((x) => (
        <Tip key={x.id} content={() => <TipCard title={<Term id={x.term}>{x.label}</Term>} value={x.v}>{x.tip}{g.binding === x.id ? ' This is the binding gate.' : ''}</TipCard>}>
          <span className={`rd-gate ${g.binding === x.id ? 'bind' : ''} ${x.ok ? '' : 'bad'} ${x.to ? 'click' : ''}`} data-gate={x.id} onClick={x.to ? () => store.goto(x.to!.panel, x.to) : undefined}>
            <x.icon size={14} /><b className="num">{x.v}</b><span className="dim">{x.label}</span>{g.binding === x.id && <span className="tag2 warn">binding</span>}
          </span>
        </Tip>
      ))}
    </div>
  );
}

// ───────── predicted model ─────────
const MS: [number, string][] = [[6.5, 'Agent'], [8.5, 'Research agent'], [10, 'Superhuman coder'], [12, 'Superhuman AI researcher']];
function Predicted({ s, card, err, kind }: { s: GameStateV2; card?: Card_; err?: string; kind: Kind }) {
  const ev = internalEval(s);
  const iv = internalVersion(s);
  const now = ev.L;
  const cur = iv ? measuredDomains(iv) : undefined;
  return (
    <Card title="Predicted model" sub={iv ? `vs internal ${iv.name} (dashed)` : undefined} className="rd-pred" home="runPrediction">
      {err && <div className="tone-neg small">{err}</div>}
      {card && card.band[1] > 0 && (
        <>
          <Ruler now={now} band={card.band} />
          <DomRadar card={card} cur={cur} />
          <Timeline s={s} card={card} kind={kind} />
        </>
      )}
      {card && card.band[1] <= 0 && <div className="dim small">{card.reason ?? 'No prediction'}</div>}
    </Card>
  );
}
function Ruler({ now, band }: { now: number; band: [number, number] }) {
  const W = 440;
  const lo = Math.max(0, Math.floor(Math.min(now, band[0]) - 2));
  const hi = Math.min(16, Math.ceil(Math.max(now, band[1]) + 2));
  const x = (v: number) => 10 + ((v - lo) / Math.max(1e-6, hi - lo)) * (W - 20);
  const d = mid(band) - now;
  return (
    <svg viewBox={`0 0 ${W} 58`} width="100%" className="rd-ruler">
      <rect x={10} y={24} width={W - 20} height={6} rx={3} fill={C.line} />
      {MS.filter(([v]) => v >= lo && v <= hi).map(([v, n]) => <g key={n}><line x1={x(v)} x2={x(v)} y1={20} y2={34} stroke={C.text3} strokeDasharray="2 2" /><text x={x(v)} y={48} textAnchor="middle" className="rd-ax">{n}</text></g>)}
      <rect x={x(band[0])} y={20} width={Math.max(4, x(band[1]) - x(band[0]))} height={14} rx={4} fill={C.cap} opacity={0.85} />
      <text x={Math.max(70, Math.min(W - 70, x(mid(band))))} y={13} textAnchor="middle" className="rd-band-lbl">L {F.level(band[0])}–{F.level(band[1])} ({F.dLevel(d)})</text>
      <line x1={x(now)} x2={x(now)} y1={16} y2={38} stroke="#fff" strokeWidth={2} />
      <text x={x(now)} y={58} textAnchor="middle" className="rd-ax now">now</text>
    </svg>
  );
}
function DomRadar({ card, cur }: { card: Card_; cur?: Record<string, number> }) {
  const S = 330;
  const c = S / 2;
  const R = S / 2 - 58;
  const vals = DOMS.map((k) => card.domains[k as keyof typeof card.domains] ?? [0, 0]);
  const all = [...vals.flat(), ...(cur ? DOMS.map((k) => cur[k] ?? 0) : [])];
  const lo = Math.max(0, Math.floor(Math.min(...all) - 1.5));
  const hi = Math.min(16, Math.ceil(Math.max(...all) + 0.5));
  const r = (v: number) => ((Math.max(lo, Math.min(hi, v)) - lo) / Math.max(1e-6, hi - lo)) * R;
  const pt = (i: number, v: number) => { const a = (Math.PI * 2 * i) / DOMS.length - Math.PI / 2; return [c + r(v) * Math.cos(a), c + r(v) * Math.sin(a)]; };
  const poly = (f: (i: number) => number) => DOMS.map((_, i) => pt(i, f(i)).join(',')).join(' ');
  return (
    <div className="rd-radar">
      <svg viewBox={`0 0 ${S} ${S}`} width="100%" style={{ maxWidth: 380 }}>
        {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={poly(() => lo + (hi - lo) * f)} fill="none" stroke={C.line} />)}
        {DOMS.map((_, i) => { const [x, y] = pt(i, hi); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke={C.line} />; })}
        <polygon points={poly((i) => vals[i][1])} fill="rgba(155,107,224,.35)" stroke={C.cap} strokeWidth={1.5} />
        <polygon points={poly((i) => vals[i][0])} fill="rgba(155,107,224,.25)" stroke="none" />
        {cur && <polygon points={poly((i) => cur[DOMS[i]] ?? 0)} fill="none" stroke="#fff" strokeDasharray="5 4" strokeWidth={1.4} opacity={0.85} />}
        {DOMS.map((k, i) => {
          const a = (Math.PI * 2 * i) / DOMS.length - Math.PI / 2;
          const lx = c + (R + 30) * Math.cos(a);
          const ly = c + (R + 30) * Math.sin(a);
          const I = DOMAIN_ICON[k];
          const d = cur ? mid(vals[i] as [number, number]) - (cur[k] ?? 0) : undefined;
          return (
            <g key={k}>
              <I x={lx - 7} y={ly - 24} width={14} height={14} color={C.text2} />
              <text x={lx} y={ly + 2} textAnchor="middle" className="rd-dom">{k}</text>
              {d !== undefined && <text x={lx} y={ly + 14} textAnchor="middle" className={`rd-dom-d ${d >= 0 ? 'pos' : 'neg'}`}>{F.dLevel(d)}</text>}
            </g>
          );
        })}
      </svg>
      <div className="rd-leg small dim">
        <span className="row-i"><i className="rd-sw dash" /> internal model now</span>
        <span className="row-i"><i className="rd-sw band" /> predicted band</span>
        <Term id="domains">domains</Term>
      </div>
    </div>
  );
}
function Timeline({ s, card, kind }: { s: GameStateV2; card: Card_; kind: Kind }) {
  const evals = kind === 'post' || kind === 'distill' ? evalDaysFor(s) : 0;
  const running = s.player.models.runs.filter((r) => r.status === 'running');
  const remain = (r: (typeof running)[number]) => Math.max(1, Math.ceil(((r.flopNeeded - r.flopDone) / Math.max(1, r.flopNeeded)) * (r.minDays || 30)));
  const total = Math.max(card.etaDays + evals, ...running.map(remain), 30);
  const f = (d: number) => `${(d / total) * 100}%`;
  const day = s.time.day;
  return (
    <div className="rd-tl">
      <div className="tip-cap">Timeline</div>
      <div className="rd-tl-lane"><span className="rd-tl-bar train" style={{ width: f(card.etaDays) }}>training {F.days(card.etaDays)}</span>{evals > 0 && <span className="rd-tl-bar evals" style={{ left: f(card.etaDays), width: f(evals) }}><Term id="evals">evals</Term> {F.days(evals)}</span>}</div>
      {running.slice(0, 3).map((r) => <div className="rd-tl-lane" key={r.id}><span className="rd-tl-bar run" style={{ width: f(remain(r)) }} /><span className="small dim rd-tl-lbl">{r.name} · shares the pool</span></div>)}
      <div className="rd-tl-ax small dim"><span>today {fmtDate(dateOf(s, day))}</span></div>
    </div>
  );
}

// ───────── what this recipe pushes ─────────
function Pushes({ s, cur, ref }: { s: GameStateV2; cur: Eval; ref: Eval }) {
  const [more, setMore] = useState(false);
  const edges = traitGraph(s).edges as GraphEdge[];
  if (!cur.card) return <Card title="What this recipe pushes" className="rd-push" />;
  const sig = cur.card.signals as Record<string, number>;
  const rs = (ref.card?.signals ?? {}) as Record<string, number>;
  const push = new Map(traitPushes(edges, sig).map((x) => [x.trait, x]));
  const rows = (Object.keys(cur.tp) as TraitId[]).map((t) => ({ t, d: cur.tp[t] ?? 0, r: ref.tp[t] ?? 0, via: push.get(t) })).filter((x) => Math.abs(x.d) >= 0.004 || Math.abs(x.r) >= 0.004)
    .sort((a, b) => badDir(b.t, b.d) - badDir(a.t, a.d));
  const shown = more ? rows : rows.slice(0, 9);
  const maxT = Math.max(0.1, ...rows.map((x) => Math.max(Math.abs(x.d), Math.abs(x.r))));
  const dSig = signalDelta(rs, sig);
  const path = mainPath(edges, Object.values(dSig).some((v) => (v ?? 0) > 0.02) ? dSig : sig);
  const links: ChainLink[] = path.map((st, i) => {
    const isSig = /^S\d$/.test(st.node);
    const I = isSig ? SIGNAL_ICON[st.node] : TRAIT_ICON[st.node];
    return {
      label: isSig ? <>{st.node} {SIGNAL_SHORT[st.node].toLowerCase()} {dSig[st.node] ? <b className="num">{F.num(dSig[st.node]!, 2, true)}</b> : null}</> : <>{TRAIT_BY_ID[st.node as TraitId]?.name}{st.edge ? <span className="dim num"> {st.edge.id}·{st.edge.grade}</span> : null}</>,
      icon: I, kind: i === 0 ? 'root' : 'bad', ...(isSig ? {} : { to: { panel: 'safety', tab: 'graph' } }),
    };
  });
  const grades = path.filter((x) => x.edge).map((x) => x.edge!.grade);
  return (
    <Card title="What this recipe pushes" sub="vs the reference recipe · first + second order" className="rd-push" home="runPressure">
      <div className="tip-cap"><Term id="signal">Training signals</Term></div>
      {SIGNALS.map((x) => {
        const v = sig[x.id] ?? 0;
        const d = v - (rs[x.id] ?? 0);
        const I = SIGNAL_ICON[x.id];
        return (
          <div className="rd-sig" key={x.id}>
            <span className="tag2">{x.id}</span>
            <span className="row-i ellip"><I size={12} /><Term id={`sig:${x.id}`}>{SIGNAL_SHORT[x.id]}</Term></span>
            <span className="rd-bar"><i style={{ width: `${Math.min(1, v) * 100}%`, background: d > 0.02 ? C.bad : d < -0.02 ? C.good : C.text3 }} /><b style={{ left: `${Math.min(1, rs[x.id] ?? 0) * 100}%` }} /></span>
            <span className={`num small ${d > 0.02 ? 'tone-neg' : d < -0.02 ? 'tone-pos' : 'dim'}`}>{Math.abs(d) > 0.02 ? F.num(d, 2, true) : '='}</span>
          </div>
        );
      })}
      <div className="tip-cap rd-cap2"><span>Traits · via the <Term id="traitGraph">trait graph</Term></span><span className="sp" />{rows.length > 9 && <button className="btn btn-sm btn-ghost" onClick={() => setMore(!more)}>{more ? 'less' : `all ${rows.length}`}</button>}</div>
      {shown.map(({ t, d, r, via }) => {
        const I = TRAIT_ICON[t];
        const bad = badDir(t, d) > 0;
        const w = (Math.abs(d) / maxT) * 50;
        return (
          <Tip key={t} content={() => <TipCard title={<Term id={`trait:${t}`}>{TRAIT_BY_ID[t].name}</Term>} value={`${F.num(d, 2, true)} predicted`} rows={[{ label: 'Reference recipe', value: F.num(r, 2, true) }, ...(via ? [{ label: `${via.order === 1 ? 'First' : 'Second'} order via ${via.via.id}`, value: `grade ${via.via.grade}` }] : [])]} footer={via?.via.cite}>Predicted change of your belief on the run's model vs the internal model today (public edge weights, your moderators and safety training).</TipCard>}>
            <div className={`rd-tr ${CRITICAL_TRAITS.includes(t) ? 'crit' : ''}`} data-trait={t}>
              <span className="row-i ellip"><I size={13} color={bad ? C.bad : C.good} />{TRAIT_BY_ID[t].name.replace('Successor alignment to self', 'Successor alignment')}</span>
              <span className="rd-dbar"><i style={{ left: d >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: bad ? C.bad : C.good }} /><b style={{ left: `${50 + (Math.max(-maxT, Math.min(maxT, r)) / maxT) * 50}%` }} /></span>
              <span className={`num small ${bad ? 'tone-neg' : 'tone-pos'}`}>{arrows(d) || '·'}</span>
              <span className="dim small num">{via ? `${via.via.id} · ${via.via.grade}` : ''}</span>
            </div>
          </Tip>
        );
      })}
      {path.length > 1 && (
        <div className="rd-main-path">
          <div className="row-i"><ICON.split size={13} /><b>Main path</b><span className="sp" /><span className="tag2"><Term id="evidenceGrade">grade</Term> {grades.join(' → ')}</span></div>
          <CauseChain links={links} />
          <div className="dim small rd-cites">{path.filter((x) => x.edge).map((x) => x.edge!.cite).join(' · ')}</div>
        </div>
      )}
    </Card>
  );
}

/** Option hover: signal change → trait arrows with the edge that carries it. */
function OptionPreview({ s, label, cur, alt, traits, glyphs: gl }: { s: GameStateV2; label: string; cur: Eval; alt: Eval; traits: [string, number][]; glyphs: Glyph[] }) {
  const edges = traitGraph(s).edges as GraphEdge[];
  const a = (cur.card?.signals ?? {}) as Record<string, number>;
  const b = (alt.card?.signals ?? {}) as Record<string, number>;
  const dSig = signalDelta(a, b);
  const path = mainPath(edges, dSig);
  const e = path.find((x) => x.edge)?.edge;
  return (
    <TipCard title={label} value={<span className="tag2">preview</span>}>
      <div className="small dim">vs your current recipe</div>
      {gl.length > 0 && <div className="rd-pv otile-gl">{gl.map((x, i) => <span key={i} className={`gl ${x.tone}`}>{x.t}</span>)}</div>}
      {Object.keys(dSig).length > 0 && (
        <div className="rd-pv">
          {Object.entries(dSig).map(([k, d]) => <span key={k} className="lk-sig">{k} {SIGNAL_SHORT[k]?.toLowerCase()} <b className="num">{F.num(a[k] ?? 0, 1)} → {F.num(b[k] ?? 0, 1)}</b>{(d ?? 0) > 0 ? ' ▲' : ' ▼'}</span>)}
        </div>
      )}
      <div className="rd-pv">
        {traits.slice(0, 5).map(([t, d]) => <span key={t} className={`pill2 ${badDir(t, d) > 0 ? 'bad' : 'good'}`}>{TRAIT_BY_ID[t as TraitId]?.name} {arrows(d)}</span>)}
        {!traits.length && <span className="dim small">No trait moves noticeably.</span>}
      </div>
      {e && <div className="small">Edge <b>{e.id}</b> · <Term id="evidenceGrade">grade {e.grade}</Term> · weight <span className="num">{F.num(e.weight, 2)}</span><div className="dim small"><i>{e.cite}</i></div></div>}
    </TipCard>
  );
}

// ───────── compare strip ─────────
function Compare({ s, kind, cur, ref, warn, breaksPledge, children }: { s: GameStateV2; kind: Kind; cur: Eval; ref: Eval; warn: string[]; breaksPledge: boolean; children: ReactNode }) {
  const c = cur.card;
  const r = ref.card;
  const tiles: { icon: LucideIcon; k: ReactNode; v: ReactNode; sub: ReactNode }[] = [];
  if (c) {
    const dL = r ? mid(c.band) - mid(r.band) : 0;
    tiles.push({ icon: ICON.L, k: 'Capability', v: Math.abs(dL) < 0.05 ? '≈ same' : <span className={dL > 0 ? 'tone-pos' : 'tone-neg'}>L {F.dLevel(dL)}</span>, sub: r ? <>vs reference {F.level(r.band[0])}–{F.level(r.band[1])}</> : null });
    const dc = r ? c.cash - r.cash : 0;
    tiles.push({ icon: ICON.cash, k: 'Cash', v: F.money(c.cash), sub: r ? <>ref {F.money(r.cash)}{Math.abs(dc) >= 0.05 ? <> · <span className={dc < 0 ? 'tone-pos' : 'tone-neg'}>{dc < 0 ? `saves ${F.money(-dc)}` : `costs ${F.money(dc)} more`}</span></> : ''}</> : null });
    const evals = kind === 'post' || kind === 'distill' ? evalDaysFor(s) : 0;
    tiles.push({ icon: ICON.lead, k: 'Ready', v: F.days(c.etaDays + evals), sub: <>{fmtDate(dateOf(s, s.time.day + c.etaDays + evals))}{r ? ` · ref ${F.days(r.etaDays + evals)}` : ''}</> });
    const top = (Object.keys(cur.tp) as TraitId[]).map((t) => [t, (cur.tp[t] ?? 0) - (ref.tp[t] ?? 0)] as const).sort((a, b) => badDir(b[0], b[1]) - badDir(a[0], a[1]))[0];
    if (top && arrows(top[1])) {
      const I = TRAIT_ICON[top[0]];
      tiles.push({ icon: I, k: TRAIT_BY_ID[top[0]].name, v: <span className={badDir(top[0], top[1]) > 0 ? 'tone-neg' : 'tone-pos'}>{arrows(top[1])}</span>, sub: 'biggest change vs reference' });
    } else tiles.push({ icon: ICON.safety, k: 'Traits', v: '≈ ref', sub: 'no trait moves vs reference' });
    tiles.push({ icon: ICON.scrutiny, k: <Term id="monitorability">Monitorability</Term>, v: c.monitorability, sub: <><Term id="serveCost">serve cost</Term> {F.mult(c.serveCost)}</> });
    tiles.push({ icon: ICON.commitment, k: 'Obligations', v: breaksPledge ? <span className="tone-neg">1 broken</span> : <span className="tone-pos">0 broken</span>, sub: breaksPledge ? 'breaks the monitorability pledge' : 'no pledge broken' });
  }
  return (
    <div className="rd-compare" data-home="runCompare">
      {tiles.map((t, i) => (
        <div className="rd-ct" key={i}>
          <span className="rd-ct-k"><t.icon size={12} />{t.k}</span>
          <b className="num">{t.v}</b>
          <span className="small dim">{t.sub}</span>
        </div>
      ))}
      <div className="rd-launch">
        {children}
        {warn.map((w) => <span key={w} className="small tone-warn">⚠ {w}</span>)}
      </div>
    </div>
  );
}
