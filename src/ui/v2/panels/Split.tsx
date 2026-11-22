// Compute allocation (moved from Company in R7: one home per control, BUILD-PLAN R7). HOME of the compute allocation:
// RD-A05a, ONE flat list of uses (training runs, data generation, experiments, each agent package, monitors, safety
// research, products, idle), each a share of total compute summing to 1; no nested sub-sliders. Idle compute inside a
// use shows under it (DD-19); home of Auto-split (RD-A05b) and the research response charts. Models per agent use: Company › Agents at work.
import { useState } from 'react';
import { AUTO_SPLIT_USES, autoSplitPlan, idleServing, idleShares, idleTrainingShare, monitorBudget, poolsOf, SPLIT_KEYS, SPLIT_LABEL, SPLIT_PRESETS } from '../../../engine/v2';
import type { AutoSplitUse } from '../../../engine/v2/departments/autoSplit';
import type { ComputeSplit, GameStateV2 } from '../../../engine/v2';
import { ResponseCharts } from './ResearchCharts';
import { ActBtn, pct as pct0, Slider, Term, Tip, TipCard } from '../ui';
import { Card } from '../kit';
import * as F from '../fmt';
import { POOL_COLOR } from '../theme';

type Key = keyof ComputeSplit;
const TERM: Partial<Record<Key, string>> = {
  training: 'poolTraining', synthetic: 'poolSynthetic', experiments: 'poolExperiments', routine: 'poolAgents', frontier: 'poolAgents',
  engineering: 'engAgents', safetyAgents: 'safetyAgents', monitors: 'agentMonitor', safety: 'poolSafety', serving: 'poolServing',
};
const COLOR: Record<Key, string> = {
  training: POOL_COLOR.training, synthetic: POOL_COLOR.synthetic, experiments: POOL_COLOR.experiments, routine: POOL_COLOR.agents, frontier: POOL_COLOR.agents,
  engineering: POOL_COLOR.engineering, safetyAgents: POOL_COLOR.safety, monitors: POOL_COLOR.safety, safety: POOL_COLOR.safety, serving: POOL_COLOR.serving, idle: '#8a8f98',
};
const WHAT: Record<Key, string> = {
  training: 'Training runs in the queue.', synthetic: 'Synthetic data for bigger bases.', experiments: 'Research experiments (with the research agents, the research engine).',
  routine: 'AI agents doing routine research (experiments).', frontier: 'AI agents doing frontier research (ideas, research taste).',
  engineering: 'AI agents coding for the build queue.', safetyAgents: 'AI agents doing safety research.', monitors: "Monitors watching the internal agents' forward passes; what full coverage does not need stays unused (shown on Safety).",
  safety: 'Safety research: open cases take their compute first, the research lines take the rest.', serving: 'Inference for your products.', idle: 'Compute you have not given to any use. It stays idle unless Auto-split is on.',
};

/** Idle compute inside a use (RD-A05b, DD-19): what the use does not need today. It stays idle, shown here, unless
 *  Auto-split is on. */
function IdleRow({ s, k, h, what }: { s: GameStateV2; k: Key; h: number; what: string }) {
  const auto = s.player.policies.autoSplit;
  const moves = auto.on && !auto.to.includes(k as AutoSplitUse);
  return (
    <div className="alloc-row split-row split-sub" id={`ctl-split-idle-${k}`} data-test={`split-idle.${k}`}>
      <Tip content={() => <TipCard title={<Term id="idleCompute">Idle compute</Term>} value={`${F.h100e(h)} H100e`}>{what} It stays idle{moves ? ': Auto-split moves it to your listed uses once a day' : ''}. Lower this share, or turn on Auto-split below.</TipCard>}>
        <span className="alloc-label small"><Term id="idleCompute">Idle</Term> <span className="num dim">{h >= 1 ? `${F.h100e(h)} H100e${moves ? ' → Auto-split' : ''}` : 'none now'}</span></span>
      </Tip>
    </div>
  );
}

/** Auto-split idle compute (RD-A05b): the one policy that moves idle compute, off by default. Lists the uses it feeds. */
function AutoSplitRow({ s }: { s: GameStateV2 }) {
  const pol = s.player.policies.autoSplit;
  const idle = idleShares(s);
  const moved = autoSplitPlan(s).moved;
  const toggle = (k: AutoSplitUse) => (pol.to.includes(k) ? pol.to.filter((x) => x !== k) : [...pol.to, k]).join(',');
  return (
    <div className="split-auto" id="ctl-split-auto" data-home="autoSplit">
      <div className="row-i">
        <ActBtn id="compute.autoSplit" testId="autoSplit.toggle" params={{ on: !pol.on }} label={<span className="psw"><span className={`sw ${pol.on ? 'on' : ''}`}><i /></span><Term id="autoSplit">Auto-split idle compute</Term></span>} />
        <Tip content={() => <TipCard title={<Term id="idleCompute">Idle compute now</Term>} value={F.pct(idle.total, 1)} rows={[
          { label: 'Unallocated', value: F.pct(idle.unallocated, 1) }, { label: 'Training no run uses', value: F.pct(idle.training, 1) },
          { label: 'Serving no product needs', value: F.pct(idle.serving, 1) }, { label: 'Monitors beyond full coverage', value: F.pct(idle.monitors, 1) },
        ]}>Compute that does nothing today. Off: it stays idle where it is. On: once a day it moves to the uses you pick (in equal parts) and the log says so.</TipCard>}>
          <span className="num small dim" data-test="autoSplit.idle">{F.pct(idle.total, 1)} idle now{pol.on && moved > 0 ? ` · moves ${F.pct(moved, 1)} today` : ''}</span>
        </Tip>
        {pol.last && <span className="small dim">last moved {F.pct(pol.last.share, 1)}</span>}
      </div>
      <div className="row-i small">
        <span className="dim">Send it to</span>
        {AUTO_SPLIT_USES.map((k) => pol.to.includes(k)
          ? <ActBtn key={k} id="compute.autoSplit" testId={`autoSplit.to.${k}`} params={{ to: toggle(k) }} label={<span className="tag2 good">{SPLIT_LABEL[k]}</span>} />
          : <ActBtn key={k} id="compute.autoSplit" testId={`autoSplit.to.${k}`} params={{ to: toggle(k) }} label={<span className="dim">{SPLIT_LABEL[k]}</span>} />)}
      </div>
    </div>
  );
}

export function Split({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const cur = p.split;
  const [alloc, setAlloc] = useState<ComputeSplit>(cur);
  const sum = SPLIT_KEYS.reduce((a, k) => a + Math.max(0, alloc[k]), 0) || 1;
  const totalH = p.computeOnline;
  const norm = Object.fromEntries(SPLIT_KEYS.map((k) => [k, Math.max(0, alloc[k]) / sum])) as unknown as ComputeSplit;
  const changed = SPLIT_KEYS.some((k) => Math.abs(norm[k] - cur[k]) > 1e-4);
  const params: Record<string, number> = { ...norm };
  const reset = () => setAlloc(s.player.split);
  // What a zero share does (no floors: the allocation always applies; these say what stops).
  const warns: string[] = [];
  if (norm.training <= 1e-4 && p.models.runs.some((r) => r.status === 'running')) warns.push('Running training runs pause: no training compute');
  if (norm.serving <= 1e-4 && p.deployments.some((d) => d.status === 'live' && d.channel !== 'internal' && d.channel !== 'open')) warns.push('Every product goes capacity-bound: no serving compute');
  const label = (k: Key) => (TERM[k] ? <Term id={TERM[k] as string}>{SPLIT_LABEL[k]}</Term> : SPLIT_LABEL[k]);
  const row = (k: Key) => (
    <div key={k} className="alloc-row split-row" id={`ctl-split-${k}`}>
      <span className="alloc-label"><span className="dot" style={{ background: COLOR[k] }} />{label(k)}</span>
      <Slider value={alloc[k]} min={0} max={Math.min(1, Math.max(0.05, cur[k] * 4))} step={0.0005} onChange={(v) => setAlloc({ ...alloc, [k]: v })} width={260} />
      <Tip content={() => <TipCard title={label(k)} value={pct0(norm[k])} rows={[{ label: 'Now', value: `${pct0(cur[k])} · ${F.h100e(cur[k] * totalH)} H100e` }, { label: 'After apply', value: `${pct0(norm[k])} · ${F.h100e(norm[k] * totalH)} H100e` }]}>{WHAT[k]} Share of your compute online.</TipCard>}><span className="alloc-val num">{F.pct(norm[k], 1)}</span></Tip>
      <span className={`num small ${Math.abs(norm[k] - cur[k]) > 1e-4 ? 'tone-warn' : 'dim'}`}>{Math.abs(norm[k] - cur[k]) > 1e-4 ? `was ${F.pct(cur[k], 1)}` : `${F.h100e(cur[k] * totalH)} H100e`}</span>
    </div>
  );
  return (
    <div className="split-page">
      <Card title={<Term id="split">Compute allocation</Term>} sub="every use a share of your compute · drag, then apply" home="split" right={<div className="btn-row">{SPLIT_PRESETS.map((x) => <ActBtn key={x} id="splitPreset" testId={`splitPreset.${x}`} params={{ preset: x }} label={F.words(x)} onDone={reset} />)}</div>}>
        <div className="split-bar">{SPLIT_KEYS.map((k) => <i key={k} style={{ flex: Math.max(0.0001, norm[k]), background: COLOR[k] }} title={SPLIT_LABEL[k]} />)}</div>
        {SPLIT_KEYS.map((k) => (
          <div key={k} className="split-group">
            {row(k)}
            {k === 'training' && <IdleRow s={s} k="training" h={idleTrainingShare(s) * poolsOf(s).training} what="Training compute no run uses now." />}
            {k === 'serving' && <IdleRow s={s} k="serving" h={idleServing(s)} what="Serving compute no product needs today." />}
            {k === 'monitors' && monitorBudget(s).need > 0 && <IdleRow s={s} k="monitors" h={(monitorBudget(s).budget - monitorBudget(s).used) * p.computeOnline} what="Monitoring compute beyond full coverage." />}
          </div>
        ))}
        <AutoSplitRow s={s} />
        {warns.map((w) => <div key={w} className="small tone-warn" data-test="split-warn">{w}</div>)}
        <div className="btn-row">
          <ActBtn id="setSplit" params={params} label={changed ? 'Apply allocation' : 'Allocation (no change)'} primary={changed} onDone={reset} />
          <button className="btn btn-sm" onClick={reset}>Reset</button>
        </div>
      </Card>
      <div className="g2">
        <Card title={<Term id="responseCurve">What more of each buys</Term>} sub="R&D speed at ×¼ … ×4 of one input">
          <ResponseCharts s={s} />
        </Card>
      </div>
    </div>
  );
}
