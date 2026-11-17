// Compute split (moved from Company in R7: one home per control, BUILD-PLAN R7). HOME of the compute split %, the
// research mix (experiments ↔ agents, Auto or manual), spare training compute and the research trade-off charts.
// The split between engineering, routine and frontier research agents lives on Company › Agents at work.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { MANUAL_MIX_RANGE, actionView, idleTrainingShare, poolsOf, specOf, SPLIT_PRESETS, TOP_KEYS } from '../../../engine/v2';
import type { GameStateV2, SplitSpec, TopKey } from '../../../engine/v2';
import { MixChart, ResponseCharts } from './ResearchCharts';
import { ActBtn, pct as pct0, Seg, Slider, Term, Tip, TipCard } from '../ui';
import { Card, Ref } from '../kit';
import * as F from '../fmt';
import { POOL_COLOR } from '../theme';

const TOP_TERM: Record<TopKey, string> = { training: 'poolTraining', research: 'poolResearch', serving: 'poolServing', safety: 'poolSafety' };
const TOP_COLOR: Record<TopKey, string> = { training: POOL_COLOR.training, research: POOL_COLOR.experiments, serving: POOL_COLOR.serving, safety: POOL_COLOR.safety };

// ───────── Split ─────────
const TOP_LABEL: Record<TopKey, string> = { training: 'Training', research: 'Research', serving: 'Serving', safety: 'Safety' };

/** Spare training compute (R5 policy; R6 default data generation): where training compute no run uses goes, with what
 *  each choice gives today. Home of the policy; the run queue shows the spare share and links here. */
function SpareRow({ s }: { s: GameStateV2 }) {
  const use = s.player.policies.spareTraining;
  const spareH = idleTrainingShare(s) * poolsOf(s).training;
  const toResearch = actionView(s, 'runs.spareTraining', { use: 'research' });
  const gain = [...toResearch.gains, ...toResearch.costs].find((c) => c.currency === 'progress')?.amount ?? 0;
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

export function Split({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const cur = specOf(p.split);
  const [spec, setSpec] = useState<SplitSpec>(cur);
  const [manual, setManual] = useState(!!p.researchManual);
  const sum = TOP_KEYS.reduce((a, k) => a + spec.top[k], 0) || 1;
  const norm = Object.fromEntries(TOP_KEYS.map((k) => [k, spec.top[k] / sum])) as Record<TopKey, number>;
  const changed = TOP_KEYS.some((k) => Math.abs(norm[k] - cur.top[k]) > 1e-3) || Math.abs(spec.dataShare - cur.dataShare) > 1e-3 || manual !== !!p.researchManual || (manual && Math.abs(spec.expShare - cur.expShare) > 1e-3);
  const params: Record<string, number> = { ...norm, dataShare: spec.dataShare, manual: manual ? 1 : 0, ...(manual ? { expShare: spec.expShare } : {}) };
  const reset = () => { setSpec(specOf(s.player.split)); setManual(!!s.player.researchManual); };
  // What a zero share does (no floors: the split always applies; these say what stops).
  const warns: string[] = [];
  if (norm.training * (1 - spec.dataShare) <= 1e-4 && p.models.runs.some((r) => r.status === 'running')) warns.push('Running training runs pause: no training compute');
  if (norm.serving <= 1e-4 && p.deployments.some((d) => d.status === 'live' && d.channel !== 'internal' && d.channel !== 'open')) warns.push('Every product goes capacity-bound: no serving compute');
  const row = (k: TopKey, sub?: ReactNode) => (
    <div key={k} className="split-group" id={`ctl-split-${k}`}>
      <div className="alloc-row split-row">
        <span className="alloc-label"><span className="dot" style={{ background: TOP_COLOR[k] }} /><Term id={TOP_TERM[k]}>{TOP_LABEL[k]}</Term></span>
        <Slider value={spec.top[k]} min={0} max={1} step={0.01} onChange={(v) => setSpec({ ...spec, top: { ...spec.top, [k]: v } })} width={260} />
        <span className="alloc-val num">{pct0(norm[k])}</span>
        <span className={`num small ${Math.abs(norm[k] - cur.top[k]) > 1e-3 ? 'tone-warn' : 'dim'}`}>{Math.abs(norm[k] - cur.top[k]) > 1e-3 ? `was ${pct0(cur.top[k])}` : ''}</span>
      </div>
      {sub}
    </div>
  );
  return (
    <div className="split-page">
      <Card title={<Term id="split">Compute split</Term>} sub="drag, then apply" home="split" right={<div className="btn-row">{SPLIT_PRESETS.map((x) => <ActBtn key={x} id="splitPreset" testId={`splitPreset.${x}`} params={{ preset: x }} label={F.words(x)} onDone={reset} />)}</div>}>
        <div className="split-bar">{TOP_KEYS.map((k) => <i key={k} style={{ flex: Math.max(0.0001, norm[k]), background: TOP_COLOR[k] }} title={TOP_LABEL[k]} />)}</div>
        {row('training', (<>
          <div className="alloc-row split-row split-sub" id="ctl-split-synthetic">
            <span className="alloc-label small"><Term id="poolSynthetic">Data generation</Term></span>
            <Slider value={spec.dataShare} min={0} max={1} step={0.01} onChange={(v) => setSpec({ ...spec, dataShare: v })} width={260} />
            <span className="alloc-val num small">{pct0(spec.dataShare)}</span>
            <span className="small dim">of training</span>
          </div>
          <SpareRow s={s} />
        </>))}
        {row('research', (
          <div className="alloc-row split-row split-sub" id="ctl-split-experiments">
            <span className="alloc-label small"><Term id="researchMix">Mix</Term> <Seg value={manual ? 'manual' : 'auto'} options={[{ v: 'auto', label: 'Auto', tip: 'Best mix, re-set every day' }, { v: 'manual', label: 'Manual', tip: 'Hold your own mix' }]} onChange={(v) => setManual(v === 'manual')} /></span>
            {manual
              ? <Slider value={spec.expShare} min={MANUAL_MIX_RANGE[0]} max={MANUAL_MIX_RANGE[1]} step={0.01} onChange={(v) => setSpec({ ...spec, expShare: v })} width={260} />
              : <span className="small dim" style={{ width: 260 }}>follows the best mix</span>}
            <span className="alloc-val num small">{pct0(manual ? spec.expShare : cur.expShare)}</span>
            <span className="small dim">experiments · rest <Term id="poolAgents">agents</Term></span><Ref id="agentPackage" to={{ panel: 'company', tab: 'people', anchor: 'agents' }}>agents by use</Ref>
          </div>
        ))}
        {row('serving')}
        {row('safety')}
        {warns.map((w) => <div key={w} className="small tone-warn" data-test="split-warn">{w}</div>)}
        <div className="btn-row">
          <ActBtn id="setSplit" params={params} label={changed ? 'Apply split' : 'Split (no change)'} primary={changed} onDone={reset} />
          <button className="btn btn-sm" onClick={reset}>Reset</button>
        </div>
      </Card>
      <div className="g2">
        <Card title={<Term id="researchMix">Research mix</Term>} sub="R&D speed by experiments vs agents">
          <MixChart s={s} preview={manual ? spec.expShare : undefined} />
        </Card>
        <Card title={<Term id="responseCurve">What more of each buys</Term>} sub="R&D speed at ×¼ … ×4 of one input">
          <ResponseCharts s={s} />
        </Card>
      </div>
    </div>
  );
}

