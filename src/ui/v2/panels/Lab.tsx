// LAB (UB-5; UI-IA §1 LAB, approved mockups design/ux/mockups/rd/lab*.png): who and what works on what.
// HOME of the compute allocation (set only here: the bar opens the editor), idle compute (inside each use plus one
// total), Auto-split idle compute, people per role, AI share per job, work done (× the people alone), needs (on click),
// the scientists' capability / safety split and Best moves (ranked by days of progress a year, UB-2 rankMoves) with
// "Won't help now". L2 tabs: Hiring & teams · AI staff & needs · Security. Reads beliefs, measurements and facts only.
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import {
  AUTO_SPLIT_USES, autoSplitPlan, engAllocView, fillWeeks, fullTeamPayroll, idleShares, idleTeams, queuedOfKey, rankMoves, reAllocView,
  responseCurves, RESPONSE_SCALES, safReAllocView, SPLIT_KEYS, SPLIT_LABEL, teamGain, teamsOfKey, workTypeViews,
} from '../../../engine/v2';
import type { AutoSplitUse } from '../../../engine/v2/departments/autoSplit';
import type { ComputeSplit, GameStateV2, Move, RankedMove, TeamKey, TeamQuality, WorkTypeView } from '../../../engine/v2';
import { TEAM_SIZE } from '../../../data/v2/teams';
import { ActBtn, Slider, Term, Tip, TipCard } from '../ui';
import { Card, PanelHead, Ref, tabOf, Tabs } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { SPHERE } from '../theme';
import { LabPeople, LabSecurity, LabWork } from './LabTabs';
import './lab.css';

type Key = keyof ComputeSplit;
type Group = 'cap' | 'saf' | 'prod' | 'idle';
/** Bar order (mockup): capability uses, AI staff by job, safety, products, then the unallocated line. */
const ORDER: Key[] = ['training', 'synthetic', 'experiments', 'engineering', 'routine', 'frontier', 'safetyAgents', 'safety', 'monitors', 'serving', 'idle'];
const GROUP: Record<Key, Group> = {
  training: 'cap', synthetic: 'cap', experiments: 'cap', engineering: 'cap', routine: 'cap', frontier: 'cap',
  safetyAgents: 'saf', safety: 'saf', monitors: 'saf', serving: 'prod', idle: 'idle',
};
const AI: Partial<Record<Key, string>> = { engineering: 'Engineering', routine: 'Experiments', frontier: 'Ideas', safetyAgents: 'Safety' };
/** The small uses the magnified inset shows (AI staff by job, Safety work, Safeguards). */
const INSET: Key[] = ['engineering', 'routine', 'frontier', 'safetyAgents', 'safety', 'monitors'];
const SHORT: Partial<Record<Key, string>> = { experiments: 'Experiments', idle: 'Not allocated' };
const LABEL = (k: Key) => (k === 'idle' ? 'Not allocated' : SPLIT_LABEL[k]);
const TERM: Record<Key, string> = {
  training: 'poolTraining', synthetic: 'poolSynthetic', experiments: 'poolExperiments', routine: 'poolAgents', frontier: 'aiScience',
  engineering: 'engAgents', safetyAgents: 'safetyAgents', monitors: 'agentMonitor', safety: 'poolSafety', serving: 'poolServing', idle: 'idleCompute',
};
const SHADES: Record<Group, string[]> = { cap: ['#9b6be0', '#8558cc', '#7a52b8', '#b48cf0', '#a07ce6', '#9470dc'], saf: ['#2fb3a3', '#22a394', '#1a8a7d'], prod: ['#b08e1a'], idle: ['#6b7c91'] };
const COLOR: Record<Key, string> = (() => {
  const n: Record<Group, number> = { cap: 0, saf: 0, prod: 0, idle: 0 };
  return Object.fromEntries(ORDER.map((k) => [k, SHADES[GROUP[k]][n[GROUP[k]]++ % SHADES[GROUP[k]].length]])) as Record<Key, string>;
})();
const WHAT: Record<Key, string> = {
  training: 'Compute your training runs draw on.', synthetic: 'Compute your models spend writing training data.', experiments: "Compute for your teams' small and big tests.",
  routine: 'Compute for your AI staff running experiments.', frontier: 'Compute for your AI staff working on research ideas.',
  engineering: 'Compute for your AI staff working through the build queue.', safetyAgents: 'Compute for your AI staff doing safety work.',
  monitors: "Safeguards: compute spent watching your AI staff's actions. Set on Safety › Safeguards.",
  safety: 'Safety work: open cases take their compute first, safety programmes and projects the rest.', serving: 'Compute that serves your customers.',
  idle: 'Compute no use draws on: it costs money and does nothing.',
};
const GROUP_NAME: Record<Exclude<Group, 'idle'>, string> = { cap: 'Capability', saf: 'Safety', prod: 'Products' };
const GROUP_COLOR: Record<Exclude<Group, 'idle'>, string> = { cap: SPHERE.cap, saf: SPHERE.saf, prod: SPHERE.prod };

/** Percent of compute, at a precision that keeps small uses readable. */
const pc = (x: number) => (x <= 0 ? '0%' : x < 0.001 ? '< 0.1%' : F.pct(x, x < 0.1 ? 1 : 0));

interface Seg { k: Key; share: number; idle: number; why?: string; h: number }
function segments(s: GameStateV2): { segs: Seg[]; online: number; idle: ReturnType<typeof idleShares> } {
  const p = s.player;
  const online = Math.max(0, p.computeOnline);
  const idle = idleShares(s);
  const runQueued = p.models.runs.some((r) => r.status === 'running' || r.status === 'paused');
  const segs = ORDER.map((k) => {
    const share = Math.max(0, p.split[k]);
    const id = k === 'training' ? idle.training : k === 'serving' ? idle.serving : k === 'monitors' ? idle.monitors : k === 'idle' ? idle.unallocated : 0;
    const why = k === 'training' && id > 0 ? (runQueued ? 'no run uses it' : 'no run queued') : k === 'serving' && id > 0 ? 'no product needs it' : k === 'monitors' && id > 0 ? 'beyond full watch' : undefined;
    return { k, share, idle: Math.min(share, id), ...(why ? { why } : {}), h: share * online };
  });
  return { segs, online, idle };
}

function SegTip({ g, online }: { g: Seg; online: number }) {
  return (
    <TipCard title={<Term id={TERM[g.k]}>{LABEL(g.k)}</Term>} value={`${pc(g.share)} · ${F.h100e(g.h)} H100e`} rows={[
      { label: 'In use', value: `${F.h100e((g.share - g.idle) * online)} H100e` },
      ...(g.idle > 0 ? [{ label: <Term id="idleCompute">Idle</Term>, value: `${F.h100e(g.idle * online)} H100e${g.why ? ` · ${g.why}` : ''}`, tone: 'neg' as const }] : []),
    ]} footer={g.k === 'monitors' ? 'Set on Safety › Safeguards.' : 'Click to change the allocation.'}>{WHAT[g.k]}</TipCard>
  );
}

function SegBox({ g, online, inset, label, onPick }: { g: Seg; online: number; inset?: boolean; label?: boolean; onPick: (k: Key) => void }) {
  const used = g.share > 0 ? 1 - g.idle / g.share : 0;
  const flex = inset ? 1 : Math.max(g.share, 0.0001) * 1000;
  if (g.share <= 0) return <div className="lab-s empty" style={{ flex: `${inset ? 1000 : 0.1} 0 0` }} data-seg={g.k} />;
  return (
    <Tip as="div" className={`lab-s ${AI[g.k] ? 'ai' : ''}`} style={{ flex: `${flex} 0 0` }} content={() => <SegTip g={g} online={online} />}>
      <div className="lab-s-in" data-seg={g.k} onClick={() => onPick(g.k)}>
        <div className="used" style={{ width: `${used * 100}%`, background: COLOR[g.k] }} />
        <div className="idle hatch" style={{ width: `${(1 - used) * 100}%`, backgroundColor: COLOR[g.k] }} />
        {label && (
          <span className="lbl2">
            <b>{SHORT[g.k] ?? LABEL(g.k)}</b>
            <span>{pc(g.share)} · {F.h100e(g.h)}{g.idle > 0 && <> · <span className="idw">{g.idle >= g.share - 1e-9 ? `all idle${g.why ? `: ${g.why}` : ''}` : `${F.h100e(g.idle * online)} idle`}</span></>}</span>
          </span>
        )}
      </div>
    </Tip>
  );
}

// ───────── Compute allocation bar (+ magnified inset, + editor) ─────────
function AllocBar({ s, edit, setEdit }: { s: GameStateV2; edit: Key | 'auto' | null; setEdit: (k: Key | 'auto' | null) => void }) {
  const { segs, online, idle } = segments(s);
  const total = segs.reduce((a, g) => a + g.share, 0) || 1;
  const insetSum = segs.filter((g) => INSET.includes(g.k)).reduce((a, g) => a + g.share, 0);
  const useInset = insetSum < 0.15;
  const groups = (['cap', 'saf', 'prod'] as const).map((gk) => ({ gk, v: segs.filter((g) => GROUP[g.k] === gk).reduce((a, g) => a + g.share, 0) }));
  // Where the inset's cluster sits in the bar (percent of the bar).
  const before = segs.slice(0, ORDER.indexOf(INSET[0])).reduce((a, g) => a + g.share, 0) / total;
  const width = insetSum / total;
  const auto = s.player.policies.autoSplit;
  const pick = (k: Key) => setEdit(edit === k ? null : k);
  const bar: ReactNode[] = [];
  let cluster: Seg[] = [];
  const flush = () => {
    if (!cluster.length) return;
    bar.push(<div key="clu" className="lab-clu" style={{ flex: `${Math.max(insetSum, 0.0001) * 1000} 0 0` }} data-test="alloc-cluster">{cluster.map((g) => <SegBox key={g.k} g={g} online={online} onPick={pick} />)}</div>);
    cluster = [];
  };
  for (const g of segs) {
    if (useInset && INSET.includes(g.k)) { cluster.push(g); continue; }
    flush();
    if (g.k === 'idle' && g.share <= 0) continue;
    bar.push(<SegBox key={g.k} g={g} online={online} label={g.share / total > 0.06} onPick={pick} />);
  }
  flush();
  const inset = segs.filter((g) => INSET.includes(g.k));
  const nAi = inset.filter((g) => AI[g.k]).length;
  const insetFlex = (g: Seg) => Math.max(g.share / Math.max(1e-9, insetSum), 0.13) * 1000;
  const insetTotal = inset.reduce((a, g) => a + insetFlex(g), 0);
  const insetL = Math.max(0, Math.min(1 - 0.5, before + width / 2 - 0.25));
  return (
    <Card id="ctl-split" home="split" className="lab-alloc" title={<span className="row-i"><ICON.compute size={16} /><Term id="split">Compute allocation</Term></span>}
      sub={<span className="row-i lab-alloc-sub">
        <Tip content={() => <TipCard title={<Term id="computeOnline">Compute online</Term>} value={`${F.h100e(online)} H100e`}>The whole bar: chips installed in live sites plus cloud capacity. Bought and built on Compute; click to go there.</TipCard>}>
          <Ref id="computeOnline" to={{ panel: 'compute', tab: 'overview' }}>of {F.h100e(online)} <Term id="h100e">H100e</Term> online</Ref>
        </Tip>
        <span className="lab-legend">{groups.map(({ gk, v }) => (
          <Tip key={gk} content={() => <TipCard title={GROUP_NAME[gk]} value={`${pc(v)} · ${F.h100e(v * online)} H100e`} rows={segs.filter((g) => GROUP[g.k] === gk).map((g) => ({ label: LABEL(g.k), value: pc(g.share) }))}>Share of your compute on {GROUP_NAME[gk].toLowerCase()} uses.</TipCard>}>
            <span data-test={`alloc-group.${gk}`}><i style={{ background: GROUP_COLOR[gk] }} />{GROUP_NAME[gk]} <b className="num">{pc(v)}</b></span>
          </Tip>
        ))}</span>
      </span>}
      right={(
        <Tip content={() => <TipCard title={<Term id="idleCompute">Idle</Term>} value={`${pc(idle.total)} · ${F.h100e(idle.total * online)} H100e`} rows={[
          { label: 'Training no run uses', value: pc(idle.training) }, { label: 'Products: serving no product needs', value: pc(idle.serving) },
          { label: 'Safeguards beyond full watch', value: pc(idle.monitors) }, { label: 'Not allocated', value: pc(idle.unallocated) },
          { label: <Term id="autoSplit">Auto-split</Term>, value: auto.on ? `on → ${auto.to.map((k) => SPLIT_LABEL[k]).join(', ')}` : 'off' },
        ]} footer="Click to set Auto-split.">Compute no use draws on: it costs money and does nothing. It stays idle unless you move it or Auto-split is on.</TipCard>}>
          <button className={`lab-idlechip ${idle.total > 0.05 ? 'warn' : ''}`} data-test="alloc-idle" onClick={() => setEdit(edit === 'auto' ? null : 'auto')}>
            <ICON.idle size={14} /> <Term id="idleCompute">Idle</Term> <b className="num">{pc(idle.total)}</b> <span className="num dim">{F.h100e(idle.total * online)} H100e</span>
            <span className="dim">·</span> <span><Term id="autoSplit">Auto-split</Term> {auto.on ? 'on' : 'off'}</span>
          </button>
        </Tip>
      )}>
      <div className="lab-barwrap">
        <div className="lab-bar" data-test="alloc-bar">{bar}</div>
        {useInset && (
          <>
            <svg className="lab-lensln" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
              <path d={`M${before * 100} 0 L${insetL * 100} 30 M${(before + width) * 100} 0 L${(insetL + 0.5) * 100} 30`} stroke="#5d6f88" strokeWidth={1.2} strokeDasharray="3 3" fill="none" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="lab-lens" style={{ marginLeft: `${insetL * 100}%` }} data-test="alloc-inset">
              <div className="lab-lgrp"><div style={{ width: `${(inset.slice(0, nAi).reduce((a, g) => a + insetFlex(g), 0) / insetTotal) * 100}%` }}><ICON.agents size={12} /> <Term id="agentPackage">AI staff</Term></div></div>
              <div className="lab-lbar">{inset.map((g) => <div key={g.k} style={{ flex: `${insetFlex(g)} 0 0`, display: 'flex' }}><SegBox g={g} online={online} inset onPick={pick} /></div>)}</div>
              <div className="lab-llab">{inset.map((g) => (
                <Tip key={g.k} as="div" style={{ flex: `${insetFlex(g)} 0 0` }} content={() => <SegTip g={g} online={online} />}>
                  <span className={g.share > 0 ? '' : 'zero'}>{AI[g.k] ?? LABEL(g.k)}</span><span className="n">{g.share > 0 ? `${pc(g.share)} · ${F.h100e(g.h)}` : '0%'}</span>
                </Tip>
              ))}</div>
            </div>
          </>
        )}
      </div>
      {edit && <AllocEditor s={s} focus={edit} close={() => setEdit(null)} />}
    </Card>
  );
}

/** L2: the allocation editor (opens from the bar). Every use a share of compute online; Apply with a before → after
 *  preview (the action's own preview); the idle policy below. Safeguards is set on Safety › Safeguards (read-only). */
function AllocEditor({ s, focus, close }: { s: GameStateV2; focus: Key | 'auto'; close: () => void }) {
  const p = s.player;
  const cur = p.split;
  const [alloc, setAlloc] = useState<ComputeSplit>(cur);
  const sum = SPLIT_KEYS.reduce((a, k) => a + Math.max(0, alloc[k]), 0) || 1;
  const norm = Object.fromEntries(SPLIT_KEYS.map((k) => [k, Math.max(0, alloc[k]) / sum])) as unknown as ComputeSplit;
  const changed = SPLIT_KEYS.some((k) => Math.abs(norm[k] - cur[k]) > 1e-4);
  const warns: string[] = [];
  if (norm.training <= 1e-4 && p.models.runs.some((r) => r.status === 'running')) warns.push('Running training runs pause: no training compute');
  if (norm.serving <= 1e-4 && p.deployments.some((d) => d.status === 'live' && d.channel !== 'internal' && d.channel !== 'open')) warns.push('Every product is limited by serving compute: none allocated');
  const online = p.computeOnline;
  return (
    <div className="lab-editor" data-test="alloc-editor">
      <div className="lab-ed-rows">
        {ORDER.map((k) => (
          <div key={k} className={`alloc-row split-row ${focus === k ? 'focus' : ''}`} id={`ctl-split-${k}`}>
            <span className="alloc-label"><span className="dot" style={{ background: COLOR[k] }} /><Term id={TERM[k]}>{LABEL(k)}</Term></span>
            {k === 'monitors'
              ? <span className="small dim" style={{ width: 220 }}><Ref id="safeguards" to={{ panel: 'safety' }}>set by safeguards</Ref></span>
              : <Slider value={alloc[k]} min={0} max={Math.min(1, Math.max(0.05, cur[k] * 4))} step={0.0005} onChange={(v) => setAlloc({ ...alloc, [k]: v })} width={220} />}
            <Tip content={() => <TipCard title={LABEL(k)} value={pc(norm[k])} rows={[{ label: 'Now', value: `${pc(cur[k])} · ${F.h100e(cur[k] * online)} H100e` }, { label: 'After apply', value: `${pc(norm[k])} · ${F.h100e(norm[k] * online)} H100e` }]}>{WHAT[k]} Share of your compute online.</TipCard>}>
              <span className="alloc-val num">{pc(norm[k])}</span>
            </Tip>
            <Tip content={() => <TipCard title={LABEL(k)} value={`${F.h100e(cur[k] * online)} H100e`}>{Math.abs(norm[k] - cur[k]) > 1e-4 ? `Now ${pc(cur[k])}; Apply sets ${pc(norm[k])}.` : 'Compute on this use today.'}</TipCard>}>
              <span className={`num small ${Math.abs(norm[k] - cur[k]) > 1e-4 ? 'tone-warn' : 'dim'}`}>{Math.abs(norm[k] - cur[k]) > 1e-4 ? `was ${pc(cur[k])}` : `${F.h100e(cur[k] * online)} H100e`}</span>
            </Tip>
          </div>
        ))}
      </div>
      <AutoSplitRow s={s} focus={focus === 'auto'} />
      {warns.map((w) => <div key={w} className="small tone-warn" data-test="split-warn">{w}</div>)}
      <div className="btn-row">
        <ActBtn id="setSplit" params={{ ...norm }} label={changed ? 'Apply allocation' : 'Allocation (no change)'} primary={changed} onDone={() => setAlloc(s.player.split)} />
        <button className="btn btn-sm" data-test="alloc-reset" onClick={() => setAlloc(s.player.split)}>Reset</button>
        <button className="btn btn-sm" data-test="alloc-close" onClick={close}>Close</button>
      </div>
    </div>
  );
}

/** Auto-split idle compute (RD-A05b): the one policy that moves idle compute, off by default. */
function AutoSplitRow({ s, focus }: { s: GameStateV2; focus: boolean }) {
  const pol = s.player.policies.autoSplit;
  const idle = idleShares(s);
  const moved = autoSplitPlan(s).moved;
  const toggle = (k: AutoSplitUse) => (pol.to.includes(k) ? pol.to.filter((x) => x !== k) : [...pol.to, k]).join(',');
  return (
    <div className={`split-auto ${focus ? 'focus' : ''}`} id="ctl-split-auto" data-home="autoSplit">
      <div className="row-i">
        <ActBtn id="compute.autoSplit" testId="autoSplit.toggle" params={{ on: !pol.on }} label={<span className="psw"><span className={`sw ${pol.on ? 'on' : ''}`}><i /></span><Term id="autoSplit">Auto-split idle compute</Term></span>} />
        <Tip content={() => <TipCard title={<Term id="idleCompute">Idle now</Term>} value={pc(idle.total)}>Off: idle compute stays where it is. On: once a day it moves to the uses you pick (in equal parts) and the log says so.</TipCard>}>
          <span className="num small dim" data-test="autoSplit.idle">{pc(idle.total)} idle now{pol.on && moved > 0 ? ` · moves ${pc(moved)} today` : ''}</span>
        </Tip>
        {pol.last && <Tip content={() => <TipCard title="Last move" value={pc(pol.last!.share)}>Share of compute Auto-split moved last time.</TipCard>}><span className="small dim">last moved {pc(pol.last.share)}</span></Tip>}
      </div>
      <div className="row-i small">
        <span className="dim">Send it to</span>
        {AUTO_SPLIT_USES.map((k) => <ActBtn key={k} id="compute.autoSplit" testId={`autoSplit.to.${k}`} params={{ to: toggle(k) }} label={pol.to.includes(k) ? <span className="tag2 good">{SPLIT_LABEL[k]}</span> : <span className="dim">{SPLIT_LABEL[k]}</span>} />)}
      </div>
    </div>
  );
}

// ───────── Workforce board: one line per role; the needs list opens on click ─────────
type RowKey = TeamKey;
const ROW_WT: Record<RowKey, WorkTypeView['wt']> = { eng: 'SWE', 're.cap': 'EXP', 'sci.cap': 'IDEAS', 're.saf': 'SAF_EXP', 'sci.saf': 'SAF_IDEAS' };
const ROW_NAME: Record<RowKey, string> = { eng: 'Engineers', 're.cap': 'Research engineers', 'sci.cap': 'Scientists', 're.saf': 'Research engineers', 'sci.saf': 'Scientists' };
const ROW_TERM: Record<RowKey, string> = { eng: 'roleEng', 're.cap': 'roleRE', 'sci.cap': 'roleSci', 're.saf': 'roleRE', 'sci.saf': 'roleSci' };
const ROW_ICON: Record<RowKey, typeof ICON.L> = { eng: ICON.roleEng, 're.cap': ICON.roleRE, 'sci.cap': ICON.roleSci, 're.saf': ICON.roleRE, 'sci.saf': ICON.roleSci };
const Q_N: Record<TeamQuality, number> = { solid: 1, strong: 2, elite: 3 };
const Q_WORD: Record<TeamQuality, string> = { solid: 'Solid', strong: 'Strong', elite: 'Elite' };

interface Need { name: ReactNode; fill: number; st: string; tip: string; short?: boolean; spare?: boolean }
interface RowStatus { kind: 'short' | 'spare' | 'ok'; text: string; tip: string }
interface RowData { k: RowKey; people: number; teams: number; q: TeamQuality; w?: WorkTypeView; needs: Need[]; quiet?: string; status: RowStatus; aiNote?: string }

/** VOCAB names of the needs (the engine's labels are longer). */
const NEED_WORD: Record<string, string> = {
  review: 'Human review', spotCheck: 'Spot-checks', cases: 'Cases', validation: 'Validations', evals: 'Safety evals', removal: 'Foothold removal', safExp: 'Research experiments',
  ops: 'Run operations', exp: 'Research experiments', runs: 'Run setup', upkeep: 'Upkeep: products, tools, safeguards', builds: 'Build queue',
};
const needWord = (n: { k: string; label: string }) => NEED_WORD[n.k] ?? n.label;
/** Work done as ×: ×1.2, ×18, ×1.8K. */
const xm = (m: number) => `×${m >= 1000 ? `${(m / 1000).toFixed(1)}K` : m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(0) : m.toFixed(1)}`;
/** Bar units for work done: linear up to ×10 across the board, else log (×1 = 1 unit, each ×10 one more). */
const wu = (m: number, maxM: number) => (maxM > 10 ? 1 + Math.log10(Math.max(1, m)) : m);
const t1 = (x: number) => (x >= 10 ? F.count(x) : x.toFixed(1).replace(/\.0$/, ''));

function boardRows(s: GameStateV2): RowData[] {
  const p = s.player;
  const wts = workTypeViews(s);
  const eng = engAllocView(s);
  const re = reAllocView(s);
  const saf = safReAllocView(s);
  const idleSci = idleTeams(s);
  const base = (k: RowKey) => {
    const ts = teamsOfKey(p, k);
    const qs = ts.map((t) => Q_N[t.quality]);
    const qn = qs.length ? Math.round(qs.reduce((a, b) => a + b, 0) / qs.length) : 2;
    const q = (Object.keys(Q_N) as TeamQuality[]).find((x) => Q_N[x] === qn) ?? 'strong';
    return { k, people: ts.reduce((a, t) => a + t.heads, 0), teams: ts.length, q, w: wts.find((w) => w.wt === ROW_WT[k]) };
  };
  const needRows = (v: { cap: number; needs: { k: string; label: string; demand: number; got: number; short: number }[]; idle: number }, unit: (x: number) => string): Need[] => [
    ...v.needs.map((n) => {
      const d = Number.isFinite(n.demand) ? n.demand : n.got;
      const short = n.short > 1e-6 && Number.isFinite(n.demand);
      return { name: needWord(n), fill: d > 0 ? Math.min(1, n.got / d) : 0, st: d <= 1e-9 ? 'none' : short ? `${t1(n.got)} of ${t1(d)}` : unit(n.got), short, tip: d <= 1e-9 ? 'Nothing to do here today.' : short ? `Gets ${unit(n.got)} of the ${unit(d)} it needs: short ${unit(n.short)}.` : `Gets all it needs: ${unit(n.got)}.` };
    }),
    { name: 'Spare', fill: v.cap > 0 ? v.idle / v.cap : 0, st: unit(v.idle), spare: true, tip: 'Capacity no need takes.' },
  ] as Need[];
  const engNeeds = needRows(eng, (x) => `${F.pct(x / Math.max(1e-9, eng.cap))}`);
  const reNeeds = needRows(re, (x) => `${t1(x)} teams`);
  const safNeeds = needRows(saf, (x) => `${t1(x)} people`).filter((n) => n.spare || n.st !== 'none');
  const safNone = saf.needs.filter((n) => n.demand <= 1e-9).map(needWord);
  const sciRow = (k: 'sci.cap' | 'sci.saf'): Pick<RowData, 'needs' | 'status'> => {
    const ts = teamsOfKey(p, k);
    const idle = idleSci.filter((t) => t.dept === (k === 'sci.cap' ? 'cap' : 'saf')).length;
    const progs = new Set(ts.filter((t) => t.projectId).map((t) => t.projectId)).size;
    return {
      needs: [
        { name: `${progs} programme${progs === 1 ? '' : 's'}`, fill: ts.length ? (ts.length - idle) / ts.length : 0, st: `${ts.length - idle} teams`, tip: 'Teams working on a programme or project in your priority order (Research).' },
        { name: 'Idle', fill: ts.length ? idle / ts.length : 0, st: String(idle), spare: true, tip: 'Teams with no programme to work on.' },
      ],
      status: idle > 0 ? { kind: 'spare', text: `${idle} team${idle > 1 ? 's' : ''} idle`, tip: 'Science teams with no programme: give them one on Research, or hire fewer.' }
        : { kind: 'ok', text: 'All on programmes', tip: 'Every science team works on a programme.' },
    };
  };
  const shortOf = (v: { needs: { k: string; label: string; short: number; demand: number }[] }) => v.needs.filter((n) => n.short > 1e-6 && Number.isFinite(n.demand));
  const engShort = shortOf(eng);
  const reShort = shortOf(re);
  const safShort = shortOf(saf);
  const safTotalShort = safShort.reduce((a, n) => a + n.short, 0);
  const allowed = p.policies.trustedToAI ?? 0;
  return [
    { ...base('eng'), needs: engNeeds,
      status: engShort.length ? { kind: 'short', text: `Short on ${needWord(engShort[0]).toLowerCase()}`, tip: `${engShort.map(needWord).join(', ')} get less than they need.` }
        : eng.idle / Math.max(1e-9, eng.cap) > 0.02 ? { kind: 'spare', text: `${F.pct(eng.idle / Math.max(1e-9, eng.cap))} spare`, tip: 'Engineering capacity no need takes this week.' } : { kind: 'ok', text: 'All in use', tip: 'Every need gets its share; nothing spare.' } },
    { ...base('re.cap'), needs: reNeeds,
      status: reShort.length ? { kind: 'short', text: `Short ${t1(reShort.reduce((a, n) => a + n.short, 0))} teams`, tip: `${reShort.map(needWord).join(', ')} get less than they need.` }
        : re.idle >= 0.05 ? { kind: 'spare', text: `${t1(re.idle)} teams spare`, tip: 'Research-engineer capacity no need takes (at most two teams per programme).' } : { kind: 'ok', text: 'All in use', tip: 'Every need gets what it asks; nothing spare.' } },
    { ...base('sci.cap'), ...sciRow('sci.cap') },
    { ...base('re.saf'), needs: safNeeds, ...(safNone.length ? { quiet: `${safNone.join(', ')}: none open` } : {}), aiNote: `AI share allowed ${F.pct(allowed)}`,
      status: safTotalShort > 0.05 ? { kind: 'short', text: `Short ${t1(safTotalShort)} people`, tip: `${safShort.map((n) => `${needWord(n)} short ${t1(n.short)} people`).join('; ')}.` }
        : saf.idle >= 0.5 ? { kind: 'spare', text: `${t1(saf.idle)} people spare`, tip: 'Safety research-engineer capacity no need takes.' } : { kind: 'ok', text: 'All needs met', tip: 'Every safety need gets its people.' } },
    { ...base('sci.saf'), ...sciRow('sci.saf'), aiNote: `AI share allowed ${F.pct(allowed)}` },
  ];
}

function QDots({ q }: { q: TeamQuality }) {
  return <span className={`lab-qp q-${q}`} data-q={q}>{[1, 2, 3].map((i) => <i key={i} className={i <= Q_N[q] ? 'on' : ''} />)}</span>;
}

function WorkRow({ s, r, open, toggle, maxM }: { s: GameStateV2; r: RowData; open: boolean; toggle: () => void; maxM: number }) {
  const Ic = ROW_ICON[r.k];
  const w = r.w;
  const hasAI = !!w?.version && w.copies > 0 && w.A > 0.0005;
  const m = w ? Math.max(1, w.m) : 1;
  const pay = teamsOfKey(s.player, r.k);
  return (
    <>
      <div className={`lab-wr ${open ? 'open' : ''}`} data-row={r.k} onClick={toggle} role="button" aria-expanded={open}>
        <span className="rn"><Ic size={18} /><Term id={ROW_TERM[r.k]}>{ROW_NAME[r.k]}</Term></span>
        <Tip content={() => <TipCard title={ROW_NAME[r.k]} value={`${F.count(r.people)} people`} rows={[
          { label: 'Teams', value: String(r.teams) }, { label: <Term id="teamQuality">Quality</Term>, value: Q_WORD[r.q] },
          { label: 'Open positions', value: F.count(pay.reduce((a, t) => a + t.size - t.heads, 0)) },
        ]}>People on these teams now.</TipCard>}>
          <span className="pp"><b className="num">{Math.round(r.people).toLocaleString('en-US')}</b> <span className="dim">people · {r.teams} team{r.teams === 1 ? '' : 's'}</span> <QDots q={r.q} /></span>
        </Tip>
        {hasAI && w ? (
          <span className="ais">
            <Tip content={() => <TipCard title={<Term id="agentPackage">AI staff</Term>} value={w.version} rows={[{ label: <Term id="agentCopies">Copies</Term>, value: F.count(w.copies) }, { label: 'Compute', value: `${F.h100e(w.h100e)} H100e` }]}>The model doing this job, and how many copies run.{w.measured ? '' : ' Its own skills are not measured yet: a measured relative\'s are used.'}</TipCard>}>
              <span className="lab-mchip"><ICON.agents size={12} /> {w.version}</span>
            </Tip>
            <Tip content={() => <TipCard title={<Term id="aiShareWork">AI share</Term>} value={F.pct(w.A)} rows={[{ label: 'Of the work AI can do alone', value: F.pct(w.coverage) }, ...(w.t < 1 ? [{ label: <Term id="trustedToAI">AI share allowed</Term>, value: F.pct(w.t) }] : [])]}>Share of this job's work your AI staff do. It grows with the model's skill at the job and with the compute you give the AI staff.</TipCard>}>
              <span><Term id="aiShareWork">AI share</Term> <b className="num">{F.pct(w.A)}</b></span>
            </Tip>
          </span>
        ) : <Tip content={() => <TipCard title="No AI staff">{r.aiNote ? `${r.aiNote}: no AI staff on this job.` : 'No AI staff on this job: give it a model and compute on AI staff & needs.'}</TipCard>}><span className="ais dim">No AI staff</span></Tip>}
        <Tip content={() => <TipCard title={<Term id="workDone">Work done</Term>} value={xm(m)} rows={w ? [{ label: 'People alone', value: '×1' }, { label: 'Added by AI staff', value: m - 1 >= 10 ? xm(m - 1) : `×${(m - 1).toFixed(2)}` }] : []}>This job's work, people and AI staff together, as × what the people alone would do.{maxM > 10 ? ' Bars on a log scale (each step ×10).' : ''}</TipCard>}>
          <span className="wd"><span className="lab-ebar"><span className="hp" style={{ flex: '100 0 0' }} />{m > 1.01 && <span className="ap" style={{ flex: `${(wu(m, maxM) - 1) * 100} 0 0` }} />}<span style={{ flex: `${Math.max(0, wu(maxM, maxM) - wu(m, maxM)) * 100} 0 0` }} /></span><b className="num">{xm(m)}</b></span>
        </Tip>
        <Tip content={() => <TipCard title={r.status.kind === 'short' ? 'Short' : r.status.kind === 'spare' ? <Term id="overflow">Spare</Term> : 'Staffing'} value={r.status.text}>{r.status.tip} Click the row for the needs.</TipCard>}>
          <span className={`lab-stc ${r.status.kind}`} data-test={`status.${r.k}`}>{r.status.kind === 'short' ? <ICON.alert size={14} /> : r.status.kind === 'spare' ? <i className="sparesw" /> : <ICON.check size={14} />} {r.status.text}</span>
        </Tip>
        <span className="dim">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      </div>
      {open && (
        <div className="lab-wopen" data-needs={r.k}>
          <div className="row-i" style={{ marginBottom: 8 }}>
            <span className="cap"><Term id={r.k === 'eng' ? 'engNeeds' : r.k === 're.cap' ? 'reNeeds' : r.k === 're.saf' ? 'safReNeeds' : 'roleSci'}>Needs</Term>, in priority order</span>
            <span className="dim small">staff go to the top first</span><span className="sp" />
            {r.k.startsWith('sci') ? <Ref id="portfolio" to={{ panel: 'research' }}>Portfolio</Ref> : <Ref id="needsOrder" to={{ panel: 'lab', tab: 'work' }}>Change order</Ref>}
          </div>
          <div className="lab-needs">
            {r.needs.map((n, i) => (
              <Tip key={i} as="div" content={() => <TipCard title={n.name} value={n.st}>{n.tip}</TipCard>}>
                <div className={`nd ${n.short ? 'short' : ''} ${n.spare ? 'spare' : ''} ${!n.fill && !n.spare ? 'nil' : ''}`}><span className="nm">{n.short ? <ICON.alert size={12} /> : null} {n.name}</span><span className="gb"><i style={{ width: `${Math.min(100, n.fill * 100)}%` }} /></span><span className="st num">{n.st}</span></div>
              </Tip>
            ))}
            {r.quiet && <div className="dim small">{r.quiet}</div>}
          </div>
          <div className="row-i small" style={{ marginTop: 10 }}>
            {r.aiNote && <Tip content={() => <TipCard title={<Term id="trustedToAI">AI share allowed</Term>} value={r.aiNote!.replace('AI share allowed ', '')}>The most safety work you let AI staff do. Set with the AI staff.</TipCard>}><span className="dim">{r.aiNote}</span></Tip>}
            <Ref id="agentPackage" to={{ panel: 'lab', tab: 'work', anchor: 'agents' }}>AI staff</Ref>
            <Ref id="keepHiring" to={{ panel: 'lab', tab: 'people' }}>Hiring</Ref>
          </div>
        </div>
      )}
    </>
  );
}

function SciSplit({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const cap = teamsOfKey(p, 'sci.cap').length;
  const saf = teamsOfKey(p, 'sci.saf').length;
  const target = (k: TeamKey) => Math.max(p.hiring.targets[k] ?? 0, teamsOfKey(p, k).length + queuedOfKey(p, k).length);
  const step = (k: TeamKey, d: number) => (
    <ActBtn id="teams.target" testId={`sciSplit.${k}.${d > 0 ? 'up' : 'down'}`} params={{ key: k, n: Math.max(0, target(k) + d) }} icon={d > 0 ? ICON.plus : ICON.minus} label="" ariaLabel={`${d > 0 ? 'More' : 'Fewer'} ${k === 'sci.cap' ? 'capability' : 'safety'} scientist teams`} block={d < 0 && target(k) <= 0 ? 'Already 0' : undefined} />
  );
  return (
    <div className="lab-wfoot" id="ctl-sciSplit" data-home="sciSplit">
      <span className="dim">Scientists</span>
      <Tip content={() => <TipCard title={<Term id="roleSci">Scientists</Term>} value={`${cap} | ${saf} teams`} rows={[{ label: 'Capability', value: `${cap} teams` }, { label: 'Safety', value: `${saf} teams` }, { label: <Term id="keepHiring">Hiring target</Term>, value: `${target('sci.cap')} | ${target('sci.saf')}` }]}>Science teams by department. Research assigns them to programmes in your priority order. A science team is hired for its field and cannot change department: the steppers set how many teams each side keeps hiring to.</TipCard>}>
        <div className="lab-split" data-test="sci-split">
          <GripVertical size={14} className="dim" /><span style={{ color: SPHERE.cap }}>Capability</span>
          {step('sci.cap', -1)}
          <div className="hbar"><div style={{ flex: `${Math.max(cap, 0.001)} 0 0`, background: SPHERE.cap }} /><div style={{ flex: `${Math.max(saf, 0.001)} 0 0`, background: SPHERE.saf }} /></div>
          {step('sci.cap', 1)}
          <b className="num">{cap}</b><span className="dim">|</span><b className="num">{saf}</b>
          {step('sci.saf', -1)}{step('sci.saf', 1)}
          <span style={{ color: SPHERE.saf }}>Safety</span><span className="dim">teams</span>
        </div>
      </Tip>
      <Ref id="portfolio" to={{ panel: 'research' }}>Portfolio</Ref>
    </div>
  );
}

function Workforce({ s }: { s: GameStateV2 }) {
  const rows = useMemo(() => boardRows(s), [s, s.time.day, s.player.teams.length, JSON.stringify(s.player.split), s.player.hiring.filling.length]);
  const [open, setOpen] = useState<RowKey | null>(null);
  const maxM = Math.max(1.5, ...rows.map((r) => r.w?.m ?? 1));
  const row = (k: RowKey) => { const r = rows.find((x) => x.k === k)!; return <WorkRow key={k} s={s} r={r} open={open === k} toggle={() => setOpen(open === k ? null : k)} maxM={maxM} />; };
  return (
    <Card className="lab-board" home="workforce" title={<span className="row-i"><ICON.staff size={16} /><Term id="team">Workforce</Term></span>}>
      <div className="lab-wgrid">
        <div className="lab-wh"><span /><span>People</span><span><Term id="agentPackage">AI staff</Term></span><span><Term id="workDone">Work done</Term> <span className="dim lc">vs the people alone</span></span><span>Short / spare</span><span /></div>
        {row('eng')}
        <div className="lab-wg" style={{ color: SPHERE.cap }}><ICON.capabilities size={14} /> Capability</div>
        {row('re.cap')}{row('sci.cap')}
        <div className="lab-wg" style={{ color: SPHERE.saf }}><ICON.safety size={14} /> Safety</div>
        {row('re.saf')}{row('sci.saf')}
        <SciSplit s={s} />
      </div>
    </Card>
  );
}

// ───────── Best moves: ranked by days of progress a year (UB-2 rankMoves); "Won't help now" ─────────
/** Believed response at ×x of an input (log-linear between the curve's scales; clamped to ×¼ … ×4). */
function at(curve: number[], x: number): number {
  const xs = RESPONSE_SCALES;
  const lx = Math.log(Math.max(xs[0], Math.min(xs[xs.length - 1], x)));
  for (let i = 1; i < xs.length; i++) {
    if (lx <= Math.log(xs[i])) {
      const f = (lx - Math.log(xs[i - 1])) / (Math.log(xs[i]) - Math.log(xs[i - 1]));
      return curve[i - 1] + f * (curve[i] - curve[i - 1]);
    }
  }
  return curve[curve.length - 1];
}

interface MoveCard { id: string; kind: 'compute' | 'hire'; what: string; target: string; eff: string; pre?: string; cost: string; warn?: string; act: { id: string; params: Record<string, number | string | boolean> }; rank?: RankedMove; other?: boolean }
const MIN_GAIN = 0.005;
function bestMoves(s: GameStateV2): { cards: MoveCard[]; wont: string[] } {
  const p = s.player;
  const cards: MoveCard[] = [];
  const wont: string[] = [];
  const moves: Move[] = [];
  const speed = (() => { try { return rankMoves(s, [{ id: 'x', target: 'research', gain: 0 }])[0].rateNow; } catch { return 0; } })();
  const rc = responseCurves(s);
  const idle = idleShares(s);
  // Compute: idle compute → a research use (up to ×4 of that use: the believed curve's range).
  const src: [Key, number][] = ([['idle', idle.unallocated], ['training', idle.training], ['serving', idle.serving]] as [Key, number][]).filter(([, x]) => x > 1e-4);
  const free = src.reduce((a, [, x]) => a + x, 0);
  const mainSrc = [...src].sort((a, b) => b[1] - a[1])[0]?.[0];
  const toUse = (to: 'experiments' | 'agents') => {
    if (!rc || !(free > 1e-4) || !(speed > 0)) return;
    const base = to === 'experiments' ? p.split.experiments : p.split.routine + p.split.frontier;
    if (!(base > 1e-6)) return;
    const mv = Math.min(free, 3 * base);
    const g = at(to === 'experiments' ? rc.experiments : rc.agents, (base + mv) / base) - 1;
    if (g < MIN_GAIN) { wont.push(to === 'experiments' ? 'More experiment compute: no gain' : 'More AI staff compute: no gain'); return; }
    const next = { ...p.split };
    let left = mv;
    let fromTraining = 0;
    for (const [k, x] of src) { const take = Math.min(left, x); next[k] -= take; left -= take; if (k === 'training') fromTraining = take; }
    if (to === 'experiments') next.experiments += mv;
    else { const r = p.split.routine / Math.max(1e-9, base); next.routine += mv * r; next.frontier += mv * (1 - r); }
    const id = `idle>${to}`;
    moves.push({ id, target: 'research', gain: g * speed });
    cards.push({
      id, kind: 'compute', what: `Idle ${mainSrc === 'idle' ? '' : `${SPLIT_LABEL[mainSrc!]} `}compute → ${to === 'experiments' ? 'Research experiments' : 'AI staff research'}`,
      target: 'Research speed', eff: `+${F.pct(g)}`, pre: `×${speed.toFixed(1)} → ×${(speed * (1 + g)).toFixed(1)}`,
      cost: `+${pc(mv)} of compute (${to === 'experiments' ? 'experiments' : 'AI staff'} ×${F.short((base + mv) / base)}) · idle now`,
      // UB-5b: no policy lends idle training compute and returns it at launch (Auto-split moves it for good), so this
      // is a share move: the preview says what a queued run will need back.
      ...(fromTraining > 1e-4 ? { warn: `A queued run will need ${pc(fromTraining)} of compute back (Training ${pc(p.split.training)} → ${pc(next.training)})` } : {}),
      act: { id: 'setSplit', params: { ...next } },
    });
  };
  toUse('experiments');
  toUse('agents');
  if (rc && !(free > 1e-4) && at(rc.agents, 1.4) - 1 < MIN_GAIN) wont.push('More AI staff compute: no gain');
  // Hires: one Strong team of a kind (Keep hiring +1).
  const target = (k: TeamKey) => Math.max(p.hiring.targets[k] ?? 0, teamsOfKey(p, k).length + queuedOfKey(p, k).length);
  const hireCost = (k: TeamKey) => {
    const role = k === 'eng' ? 'eng' : (k.split('.')[0] as 're' | 'sci');
    const dept = k === 'eng' ? 'cap' : (k.split('.')[1] as 'cap' | 'saf');
    const wk = fillWeeks(s, { role, dept, size: TEAM_SIZE[role], heads: 0 });
    return `${F.money(fullTeamPayroll(role, dept, 'strong'), { perYear: true })} · ${Number.isFinite(wk) ? `~${wk} wk to hire` : 'hiring stalled'}`;
  };
  const hire = (k: TeamKey, what: string, target2: string, eff: string, gain: number, mt: Move['target'] | null, note = '') => {
    const id = `hire>${k}`;
    if (mt) moves.push({ id, target: mt, gain });
    cards.push({ id, kind: 'hire', what, target: target2, eff, cost: `${note}${hireCost(k)}`, act: { id: 'teams.target', params: { key: k, n: target(k) + 1 } }, ...(mt ? {} : { other: true }) });
  };
  const re = reAllocView(s);
  if (re.idle >= 0.5) wont.push(`Research engineers: ${t1(re.idle)} teams spare`);
  else if (rc && speed > 0 && re.cap > 0) {
    const g = at(rc.humans, (re.cap + 1) / re.cap) - 1;
    if (g >= MIN_GAIN) hire('re.cap', '+1 research-engineer team', 'Research speed', `+${F.pct(g, 1)}`, g * speed, 'research');
    else wont.push('Research engineers: no gain');
  }
  const eng = engAllocView(s);
  if (eng.cap > 0 && eng.idle / eng.cap > 0.05) wont.push(`Engineers: ${F.pct(eng.idle / eng.cap)} spare`);
  else {
    const g = teamGain(s, { role: 'eng', dept: 'cap', quality: 'strong' });
    if (g.amount > 0.01) hire('eng', '+1 engineer team', 'Build capacity', `+${F.num(g.amount, 1)} teams`, 0, null);
  }
  const sc = teamGain(s, { role: 'sci', dept: 'cap', quality: 'strong', specialty: 'pretraining' });
  if (!(sc.amount > 0)) wont.push('Scientists: no programme waits for ideas');
  else hire('sci.cap', '+1 scientist team', 'Next result', `${F.num(sc.amount, 0)} d sooner`, 0, null, `${sc.target ?? ''} · `);
  const saf = safReAllocView(s);
  const safShort = saf.needs.filter((n) => n.short > 1e-6);
  for (const k of ['sci.saf', 're.saf'] as const) {
    const g = teamGain(s, { role: k === 'sci.saf' ? 'sci' : 're', dept: 'saf', quality: 'strong', ...(k === 'sci.saf' ? { specialty: 'alignment' as const } : {}) });
    const name = k === 'sci.saf' ? '+1 safety scientist team' : '+1 safety research-engineer team';
    if (g.currency === 'alignment' && g.amount > 0.005) {
      const note = k === 're.saf' && safShort.length ? `ends the ${t1(safShort.reduce((a, n) => a + n.short, 0))}-person shortage on ${needWord(safShort[0]).toLowerCase()} · ` : '';
      hire(k, name, 'Safety results', `+${F.num(g.amount, g.amount < 0.1 ? 2 : 1)} /yr`, g.amount, 'safety', note);
    } else wont.push(k === 'sci.saf' ? 'Safety scientists: no programme waits for them' : `Safety research engineers: ${saf.idle >= 0.5 ? `${t1(saf.idle)} people spare` : 'no gain'}`);
  }
  const ranked = rankMoves(s, moves);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const out = ranked.map((r) => ({ ...byId.get(r.id)!, rank: r }));
  return { cards: [...out, ...cards.filter((c) => c.other)].slice(0, 5), wont };
}

function BestMoves({ s }: { s: GameStateV2 }) {
  const { cards, wont } = useMemo(() => bestMoves(s), [s, s.time.day, JSON.stringify(s.player.split), s.player.teams.length, s.player.hiring.filling.length, JSON.stringify(s.player.hiring.targets)]);
  return (
    <Card id="ctl-bestMoves" className="lab-moves" home="bestMoves" title={<span className="row-i"><ICON.revenue size={16} /><Term id="bestMoves">Best moves</Term></span>}
      right={<Tip content={() => <TipCard title="From your estimates">Gains come from what your lab believes about how compute and people turn into results, not from the truth. Ranked by days of progress a year: a move that raises a rate by a share f of today's gives f × 365 more days of today's progress each year.</TipCard>}><span className="dim small">from your estimates</span></Tip>}>
      {cards.length === 0 && <div className="dim small lab-mv-none">No move helps now.</div>}
      {cards.map((m, i) => (
        <div key={m.id} className={`lab-mv ${i === 0 ? 'top' : ''}`} data-move={m.id}>
          <Tip content={() => <TipCard title={`Rank ${i + 1}`} value={m.rank?.days !== undefined ? `+${Math.round(m.rank.days)} days a year` : 'not ranked'}>{m.rank?.days !== undefined ? `${m.target} ${m.eff} of today's rate: ${Math.round(m.rank.days)} more days of today's progress each year.` : m.rank?.startsIt ? 'Starts progress that is at zero today: no days-a-year value.' : 'Its gain is in another unit (not research speed or safety results): listed after the ranked moves.'}</TipCard>}>
            <span className="rk num">{i + 1}</span>
          </Tip>
          <span className={m.kind === 'hire' ? 'mv-ic hire' : 'mv-ic'}>{m.kind === 'hire' ? <ICON.hiring size={18} /> : <ICON.compute size={18} />}</span>
          <div className="mv-body">
            <div className="what">{m.what}</div>
            <div className="eff"><Term id={m.target === 'Research speed' ? 'labSpeed' : m.target === 'Safety results' ? 'safetyResults' : m.target === 'Build capacity' ? 'buildCapacity' : 'roleSci'}>{m.target}</Term> <b className="num">{m.eff}</b>{m.pre && <Tip content={() => <TipCard title={<Term id="labSpeed">Research speed</Term>} value={m.pre}>Today → after the move, × the leading lab in July 2025 (your estimate).</TipCard>}><span className="pre num">{m.pre}</span></Tip>}</div>
            <div className="cost">{m.cost}</div>
            {m.warn && <Tip content={() => <TipCard title="Training compute" value={m.warn}>This move lowers the Training share. Training no run uses is idle today, but a run you queue later draws on the Training share: move this compute back first, or the run waits. No policy hands it back by itself.</TipCard>}><div className="cost tone-warn" data-test="move-warn"><ICON.alert size={11} /> {m.warn}</div></Tip>}
          </div>
          <ActBtn id={m.act.id} params={m.act.params} testId={`move.${m.id}`} label="Do" primary={i === 0} />
        </div>
      ))}
      {wont.length > 0 && (
        <div className="lab-wont" data-test="wont-help">
          <div className="cap">Won't help now</div>
          {wont.map((w) => <div key={w} className="row-i"><ICON.minus size={12} /><span>{w}</span></div>)}
        </div>
      )}
    </Card>
  );
}

function LabBoard({ s }: { s: GameStateV2 }) {
  const [edit, setEdit] = useState<Key | 'auto' | null>(null);
  return (
    <div className="lab-main">
      <AllocBar s={s} edit={edit} setEdit={setEdit} />
      <div className="lab-lower">
        <Workforce s={s} />
        <BestMoves s={s} />
      </div>
    </div>
  );
}

export function Lab({ s }: { s: GameStateV2 }) {
  const tab = tabOf('lab', 'board');
  return (
    <div className="panel-v2 lab" data-panel="lab">
      <PanelHead icon={ICON.company} title="Lab" tabs={<Tabs panel="lab" def="board" tabs={[{ id: 'board', label: 'Lab', icon: ICON.company }, { id: 'people', label: 'Hiring & teams', icon: ICON.hiring }, { id: 'work', label: 'AI staff & needs', icon: ICON.agents }, { id: 'security', label: 'Security', icon: ICON.security }]} />} />
      {tab === 'board' && <LabBoard s={s} />}
      {tab === 'people' && <LabPeople s={s} />}
      {tab === 'work' && <LabWork s={s} />}
      {tab === 'security' && <LabSecurity s={s} />}
    </div>
  );
}
