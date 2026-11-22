// Compute allocation (moved from Company in R7: one home per control, BUILD-PLAN R7). HOME of the compute allocation:
// RD-A05a, ONE flat list of uses (training runs, data generation, experiments, each agent package, monitors, safety
// research, products, idle), each a share of total compute summing to 1; no nested sub-sliders. Also home of spare
// training / serving compute and the research response charts. Models per agent use: Company › Agents at work.
import { useState } from 'react';
import { LENT_RECOVERY, actionView, idleTrainingShare, poolsOf, spareServing, SPLIT_KEYS, SPLIT_LABEL, SPLIT_PRESETS } from '../../../engine/v2';
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
  safety: 'Safety research: open cases first, the research lines take the rest.', serving: 'Inference for your products.', idle: 'Compute no use takes. Shown, never moved to a use on its own.',
};

/** Spare training compute (R5 policy; R6 default data generation): where training compute no run uses goes, with what
 *  each choice gives today. Home of the policy; the run queue shows the spare share and links here. */
function SpareRow({ s }: { s: GameStateV2 }) {
  const use = s.player.policies.spareTraining;
  const spareH = idleTrainingShare(s) * poolsOf(s).training;
  const toResearch = actionView(s, 'runs.spareTraining', { use: 'research' });
  const gain = ([...toResearch.gains, ...toResearch.costs].find((c) => c.currency === 'progress')?.amount ?? 0) / 100; // the line is in % (F6b)
  return (
    <div className="alloc-row split-row split-sub" id="ctl-split-spare" data-home="spareTraining">
      <Tip content={() => <TipCard title={<Term id="spareTraining">Spare training compute</Term>} value={`${F.h100e(spareH)} H100e idle now`} rows={[
        { label: 'Data generation', value: 'synthetic tokens for bigger bases (the reference lab)' },
        { label: 'Research experiments', value: `research speed +${F.pct(gain, 1)} today` },
      ]}>Training compute that no run uses between runs. Nothing is wasted: it goes to one of these.</TipCard>}>
        <span className="alloc-label small"><Term id="spareTraining">Spare</Term> <span className="num dim">{spareH >= 1 ? `${F.h100e(spareH)} idle` : 'none idle now'}</span></span>
      </Tip>
      <span className="row-i">
        {(['data', 'research'] as const).map((u) => u === use
          ? <span key={u} className="tag2 good" data-test={`spare-on.${u}`}>{u === 'data' ? 'Data generation' : 'Research experiments'}</span>
          : <ActBtn key={u} id="runs.spareTraining" params={{ use: u }} testId={`spare.${u}`} label={u === 'data' ? 'Use for data' : <>Use for experiments{gain > 5e-4 && <span className="tone-pos"> +{F.pct(gain, 1)} speed</span>}</>} />)}
      </span>
    </div>
  );
}

/** Spare serving compute (J2 PR1): serving compute no product needs runs research agents by default, or stays on the
 *  products as headroom. Home of the policy; Products › Serving shows the spare segment, Company › Flow its effect. */
function SpareServingRow({ s }: { s: GameStateV2 }) {
  const use = s.player.policies.spareServing;
  const spare = spareServing(s);
  const agents = s.player.computeOnline * (s.player.split.routine + s.player.split.frontier);
  const toResearch = actionView(s, 'serving.spare', { use: 'research' });
  const gain = ([...toResearch.gains, ...toResearch.costs].find((c) => c.currency === 'progress')?.amount ?? 0) / 100; // the line is in % (F6b)
  return (
    <div className="alloc-row split-row split-sub" id="ctl-split-spare-serving" data-home="spareServing">
      <Tip content={() => <TipCard title={<Term id="spareServing">Spare serving compute</Term>} value={`${F.h100e(spare)} H100e no product needs`} rows={[
        { label: 'Research agents', value: `+${F.pct(spare / Math.max(1, agents))} agent compute · research speed +${F.pct(gain, 1)}` },
        { label: 'Headroom', value: `eroded share wins back at full speed (${F.pct(LENT_RECOVERY)} when lent)` },
      ]}>Products take lent compute back first when their demand rises.</TipCard>}>
        <span className="alloc-label small"><Term id="spareServing">Spare</Term> <span className="num dim">{spare >= 1 ? `${F.h100e(spare)} unused` : 'none unused now'}</span></span>
      </Tip>
      <span className="row-i">
        {(['research', 'headroom'] as const).map((u) => u === use
          ? <span key={u} className="tag2 good" data-test={`spare-serving-on.${u}`}>{u === 'research' ? 'Research agents' : 'Headroom'}</span>
          : <ActBtn key={u} id="serving.spare" params={{ use: u }} testId={`spare-serving.${u}`} label={u === 'headroom' ? 'Keep as headroom' : <>Lend to research{gain > 5e-4 && <span className="tone-pos"> +{F.pct(gain, 1)} speed</span>}</>} />)}
      </span>
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
            {k === 'training' && <SpareRow s={s} />}
            {k === 'serving' && <SpareServingRow s={s} />}
          </div>
        ))}
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
