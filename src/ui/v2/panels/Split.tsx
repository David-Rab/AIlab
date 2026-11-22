// Compute split (moved from Company in R7: one home per control, BUILD-PLAN R7). HOME of the compute split %, the
// research mix (experiments ↔ research agents, the player's own setting since RD-A02: no Auto), the engineering agents'
// own line (RD-A02), spare training compute and the research response charts. The split between routine and frontier
// research agents lives on Company › Agents at work.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { LENT_RECOVERY, MIX_RANGE, actionView, idleTrainingShare, poolsOf, spareServing, specOf, SPLIT_PRESETS, TOP_KEYS } from '../../../engine/v2';
import type { GameStateV2, SplitSpec, TopKey } from '../../../engine/v2';
import { ResponseCharts } from './ResearchCharts';
import { ActBtn, pct as pct0, Slider, Term, Tip, TipCard } from '../ui';
import { Card, Ref } from '../kit';
import * as F from '../fmt';
import { POOL_COLOR } from '../theme';

const TOP_TERM: Record<TopKey, string> = { training: 'poolTraining', research: 'poolResearch', engineering: 'engAgents', serving: 'poolServing', safety: 'poolSafety' };
const TOP_COLOR: Record<TopKey, string> = { training: POOL_COLOR.training, research: POOL_COLOR.experiments, engineering: POOL_COLOR.engineering, serving: POOL_COLOR.serving, safety: POOL_COLOR.safety };

// ───────── Split ─────────
const TOP_LABEL: Record<TopKey, string> = { training: 'Training', research: 'Research', engineering: 'Engineering agents', serving: 'Serving', safety: 'Safety' };

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
  const agents = s.player.computeOnline * s.player.split.agents;
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
  const cur = specOf(p.split);
  const [spec, setSpec] = useState<SplitSpec>(cur);

  const sum = TOP_KEYS.reduce((a, k) => a + spec.top[k], 0) || 1;
  const totalH = s.player.computeOnline;
  const norm = Object.fromEntries(TOP_KEYS.map((k) => [k, spec.top[k] / sum])) as Record<TopKey, number>;
  const changed = TOP_KEYS.some((k) => Math.abs(norm[k] - cur.top[k]) > 1e-3) || Math.abs(spec.dataShare - cur.dataShare) > 1e-3 || Math.abs(spec.expShare - cur.expShare) > 1e-3;
  const params: Record<string, number> = { ...norm, dataShare: spec.dataShare, expShare: spec.expShare };
  const reset = () => setSpec(specOf(s.player.split));
  // What a zero share does (no floors: the split always applies; these say what stops).
  const warns: string[] = [];
  if (norm.training * (1 - spec.dataShare) <= 1e-4 && p.models.runs.some((r) => r.status === 'running')) warns.push('Running training runs pause: no training compute');
  if (norm.serving <= 1e-4 && p.deployments.some((d) => d.status === 'live' && d.channel !== 'internal' && d.channel !== 'open')) warns.push('Every product goes capacity-bound: no serving compute');
  const row = (k: TopKey, sub?: ReactNode) => (
    <div key={k} className="split-group" id={`ctl-split-${k}`}>
      <div className="alloc-row split-row">
        <span className="alloc-label"><span className="dot" style={{ background: TOP_COLOR[k] }} /><Term id={TOP_TERM[k]}>{TOP_LABEL[k]}</Term></span>
        <Slider value={spec.top[k]} min={0} max={1} step={0.01} onChange={(v) => setSpec({ ...spec, top: { ...spec.top, [k]: v } })} width={260} />
        <Tip content={() => <TipCard title={<Term id={TOP_TERM[k]}>{TOP_LABEL[k]}</Term>} value={pct0(norm[k])} rows={[{ label: 'Now', value: `${pct0(cur.top[k])} · ${F.h100e(cur.top[k] * totalH)} H100e` }, { label: 'After apply', value: `${pct0(norm[k])} · ${F.h100e(norm[k] * totalH)} H100e` }]}>Share of your compute online.</TipCard>}><span className="alloc-val num">{pct0(norm[k])}</span></Tip>
        <Tip content={() => <TipCard title="Before the change" value={pct0(cur.top[k])}>Apply to make the new split take effect.</TipCard>}><span className={`num small ${Math.abs(norm[k] - cur.top[k]) > 1e-3 ? 'tone-warn' : 'dim'}`}>{Math.abs(norm[k] - cur.top[k]) > 1e-3 ? `was ${pct0(cur.top[k])}` : ''}</span></Tip>
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
            <Tip content={() => <TipCard title={<Term id="poolSynthetic">Data generation</Term>} value={pct0(spec.dataShare)}>Share of the training pool that generates synthetic data for bigger bases.</TipCard>}><span className="alloc-val num small">{pct0(spec.dataShare)}</span></Tip>
            <span className="small dim">of training</span>
          </div>
          <SpareRow s={s} />
        </>))}
        {row('research', (
          <div className="alloc-row split-row split-sub" id="ctl-split-experiments">
            <span className="alloc-label small"><Term id="researchMix">Mix</Term></span>
            <Slider value={spec.expShare} min={MIX_RANGE[0]} max={MIX_RANGE[1]} step={0.01} onChange={(v) => setSpec({ ...spec, expShare: v })} width={260} />
            <Tip content={() => <TipCard title={<Term id="researchMix">Research mix</Term>} value={`${pct0(spec.expShare)} experiments`}>The rest of the research pool runs AI research agents (routine and frontier). It stays where you set it.</TipCard>}><span className="alloc-val num small">{pct0(spec.expShare)}</span></Tip>
            <span className="small dim">experiments · rest <Term id="poolAgents">agents</Term></span><Ref id="agentPackage" to={{ panel: 'company', tab: 'people', anchor: 'agents' }}>agents by use</Ref>
          </div>
        ))}
        {row('engineering')}
        {row('serving')}
        <SpareServingRow s={s} />
        {row('safety')}
        {warns.map((w) => <div key={w} className="small tone-warn" data-test="split-warn">{w}</div>)}
        <div className="btn-row">
          <ActBtn id="setSplit" params={params} label={changed ? 'Apply split' : 'Split (no change)'} primary={changed} onDone={reset} />
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

