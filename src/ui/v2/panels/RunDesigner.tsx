// Run designer (§6.3, §3.3.2): choices A–H as segmented controls, live run card (predicted L and domain bands, ETA,
// FLOP, $, trait-pressure arrows, serve cost, monitorability), warnings; launch or save as template.
import { useState } from 'react';
import { SIGNALS } from '../../../data/v2/traits';
import { baseFromParams, liveCommitments, nextModelGate, postFromParams, runCard } from '../../../engine/v2';
import type { GameStateV2, LaunchRunParams, RLFamily } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, fmtB, Gate, pct, Row, Section, Seg, Slider, Toggle, unlocked, type Params } from '../ui';

type Kind = 'post' | 'base' | 'continue' | 'distill';
const RL: RLFamily[] = ['math', 'swe', 'computerUse', 'mlResearch', 'longHorizon', 'cyber', 'bio'];
const TPL_KEY = 'ai27.v2.runTemplates';
const DEFAULTS: Params = {
  scale: 'frontier', shape: 'moe', data: 'balanced', quality: true, hazard: false, safetyPretrain: false, licensedShare: 0.1,
  pref: 'constitution', rlFocus: 'broad', rlIntensity: 'heavyHardened', inoculation: false, cot: 'visible', safety: 'standard', poolShare: 0.5,
};
const RECOMMENDED: Params = { ...DEFAULTS, rlIntensity: 'light', poolShare: 0.4 };

function loadTemplates(): Record<string, { kind: Kind; p: Params }> {
  try {
    return JSON.parse(localStorage.getItem(TPL_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function RunDesigner({ s }: { s: GameStateV2 }) {
  const [kind, setKind] = useState<Kind>('post');
  const [p, setP] = useState<Params>({ ...DEFAULTS, baseId: s.player.models.bases[s.player.models.bases.length - 1]?.id ?? '' });
  const [tpls, setTpls] = useState(loadTemplates);
  const set = (k: string, v: number | string | boolean) => setP({ ...p, [k]: v });
  const focus = String(p.rlFocus) === 'broad' ? [] : String(p.rlFocus).split(',').filter(Boolean);
  const toggleFocus = (f: RLFamily) => {
    const next = focus.includes(f) ? focus.filter((x) => x !== f) : [...focus, f].slice(-2);
    set('rlFocus', next.length ? next.join(',') : 'broad');
  };
  const lp: LaunchRunParams = { kind, poolShare: Number(p.poolShare) };
  if (kind === 'base') lp.base = baseFromParams(p);
  if (kind === 'post') {
    lp.post = postFromParams(p);
    lp.baseId = String(p.baseId);
  }
  if (kind === 'continue') lp.baseId = String(p.baseId);
  if (kind === 'distill') lp.teacherVersionId = String(p.teacherVersionId ?? s.player.models.versions.filter((v) => v.variant === 'full').slice(-1)[0]?.id ?? '');
  let card: ReturnType<typeof runCard> | undefined;
  let err = '';
  try {
    card = runCard(s, lp);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  const gate = nextModelGate(s);
  const warn: string[] = [];
  if (card?.reason) warn.push(card.reason);
  if (kind === 'base' && gate.dataRatio < 1) warn.push(`Data wall: stock covers ${pct(gate.dataRatio)} of the need`);
  if (kind === 'base' && card && card.etaDays > 150) warn.push('Cluster too small: run exceeds 150 days');
  const pledged = s.player.safety.monitorabilityCommitment || liveCommitments(s).some((c) => c.condition.predicate === 'monitorabilityPledge');
  if (pledged && ((kind === 'base' && p.shape === 'latent') || (kind === 'post' && (p.cot === 'latent' || p.cot === 'pressured')))) warn.push('Breaks your monitorability pledge');
  if (kind === 'base' && Number(p.licensedShare) < 0.3) warn.push('Unlicensed data: litigation risk');
  const actionId = { post: 'launchPost', base: 'launchBase', continue: 'launchContinue', distill: 'launchDistill' }[kind];
  const params: Params = { ...p, ...(kind === 'distill' ? { teacherVersionId: lp.teacherVersionId ?? '' } : {}) };
  const saveTpl = () => {
    const name = `${kind}-${Object.keys(tpls).length + 1}`;
    const next = { ...tpls, [name]: { kind, p } };
    localStorage.setItem(TPL_KEY, JSON.stringify(next));
    setTpls(next);
    store.say(`Template ${name} saved`, 'pos');
  };
  const sig = card?.signals ?? {};
  return (
    <div className="panel-v2 grid2" data-panel="rundesigner">
      <Section title="Design" right={<Seg value={kind} options={[{ v: 'post', label: 'Post-train' }, ...(unlocked(s, 'baseRuns') ? [{ v: 'base' as Kind, label: 'Base' }, { v: 'continue' as Kind, label: 'Continue' }] : []), { v: 'distill', label: 'Distill' }]} onChange={setKind} />}>
        {(kind === 'post' || kind === 'continue') && (
          <Row label="Base"><select className="text-input" data-test="rd-base" value={String(p.baseId)} onChange={(e) => set('baseId', e.target.value)}>{s.player.models.bases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Row>
        )}
        {kind === 'distill' && (
          <Row label="Teacher"><select className="text-input" value={String(lp.teacherVersionId)} onChange={(e) => set('teacherVersionId', e.target.value)}>{s.player.models.versions.filter((v) => v.status !== 'retired').map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Row>
        )}
        {kind === 'base' && (
          <Gate s={s} k="baseRuns">
            <Row label="A Scale"><Seg value={String(p.scale)} options={['compact', 'frontier', 'stretch'].map((v) => ({ v, label: v }))} onChange={(v) => set('scale', v)} /></Row>
            <Row label="B Shape"><Seg value={String(p.shape)} options={['dense', 'overtrained', 'moe', 'latent'].map((v) => ({ v, label: v }))} onChange={(v) => set('shape', v)} /></Row>
            <Row label="C Data"><Seg value={String(p.data)} options={['balanced', 'codeMath', 'science', 'synthetic', 'multimodal'].map((v) => ({ v, label: v }))} onChange={(v) => set('data', v)} /></Row>
            <Row label="Curation"><Toggle on={!!p.quality} onChange={(v) => set('quality', v)} label="quality" /><Toggle on={!!p.hazard} onChange={(v) => set('hazard', v)} label="hazard" /><Toggle on={!!p.safetyPretrain} onChange={(v) => set('safetyPretrain', v)} label="safety pretrain" /></Row>
            <Row label={`Licensed ${pct(Number(p.licensedShare))}`}><Slider value={Number(p.licensedShare)} min={0} max={1} step={0.05} onChange={(v) => set('licensedShare', v)} /></Row>
          </Gate>
        )}
        {kind === 'post' && (
          <>
            <Row label="D Preference"><Seg value={String(p.pref)} options={['minimal', 'engagement', 'constitution', 'persuasion'].map((v) => ({ v, label: v }))} onChange={(v) => set('pref', v)} /></Row>
            <Row label="E RL focus"><div className="seg">{RL.map((f) => <button key={f} className={`seg-btn ${focus.includes(f) ? 'active' : ''}`} onClick={() => toggleFocus(f)}>{f}</button>)}<button className={`seg-btn ${!focus.length ? 'active' : ''}`} onClick={() => set('rlFocus', 'broad')}>broad</button></div></Row>
            <Row label="F Intensity"><Seg value={String(p.rlIntensity)} options={['light', 'heavyCheap', 'heavyHardened'].map((v) => ({ v, label: v }))} onChange={(v) => set('rlIntensity', v)} /></Row>
            <Row label="G CoT"><Seg value={String(p.cot)} options={['visible', 'pressured', 'faithful', 'latent'].map((v) => ({ v, label: v }))} onChange={(v) => set('cot', v)} /></Row>
            <Row label="H Safety"><Seg value={String(p.safety)} options={['minimal', 'standard', 'heavy'].map((v) => ({ v, label: v }))} onChange={(v) => set('safety', v)} /></Row>
            <Row label="Inoculation prompting"><Toggle on={!!p.inoculation} onChange={(v) => set('inoculation', v)} /></Row>
          </>
        )}
        <Row label={`Training pool ${pct(Number(p.poolShare))}`}><Slider value={Number(p.poolShare)} min={0.05} max={1} step={0.05} onChange={(v) => set('poolShare', v)} /></Row>
        <div className="btn-row wrap">
          <button className="btn btn-sm" data-test="rd-recommended" onClick={() => setP({ ...RECOMMENDED, baseId: p.baseId })}>Recommended</button>
          <button className="btn btn-sm" data-test="rd-reset" onClick={() => setP({ ...DEFAULTS, baseId: p.baseId })}>Reference</button>
          <button className="btn btn-sm" data-test="rd-save" onClick={saveTpl}>Save template</button>
          {Object.entries(tpls).map(([n, t]) => <button key={n} className="btn btn-sm btn-ghost" onClick={() => { setKind(t.kind); setP(t.p); }}>{n}</button>)}
        </div>
      </Section>
      <Section title="Run card" right={card ? <span className="num">ETA {Math.round(card.etaDays)} d</span> : null}>
        {err && <div className="tone-neg small">{err}</div>}
        {card && (
          <>
            <Row label="Predicted L"><span className="num big">{card.band[0].toFixed(2)} – {card.band[1].toFixed(2)}</span></Row>
            <div className="dom-bands">
              {Object.entries(card.domains).map(([d, [lo, hi]]) => (
                <div key={d} className="dom-band"><span className="small">{d}</span><div className="bandbar" style={{ width: 120 }}><div className="bandbar-fill" style={{ left: `${(lo / 15) * 100}%`, width: `${((hi - lo) / 15) * 100}%`, background: 'var(--accent)' }} /></div><span className="num small dim">{lo.toFixed(1)}–{hi.toFixed(1)}</span></div>
              ))}
            </div>
            <Row label="FLOP · min days"><span className="num">{card.flop.toExponential(2)} · {Math.round(card.minDays)} d</span></Row>
            <Row label="Cash (env/data)"><span className="num">{fmtB(card.cash)}</span></Row>
            <Row label="Serve cost · monitorability"><span className="num">{card.serveCost.toFixed(2)}× · {card.monitorability}</span></Row>
            <div className="sig-row">
              {SIGNALS.map((x) => {
                const v = (sig as Record<string, number>)[x.id] ?? 0;
                return <span key={x.id} className={`sig ${v > 0.3 ? 'tone-neg' : v > 0.1 ? 'tone-warn' : 'dim'}`} title={x.name}>{x.id} {v > 0.3 ? '▲▲' : v > 0.1 ? '▲' : '·'}</span>;
              })}
            </div>
          </>
        )}
        {warn.map((w) => <div key={w} className="warn-line tone-warn small">⚠ {w}</div>)}
        <div className="btn-row"><ActBtn id={actionId} params={params} primary small={false} label={`Launch ${kind}`} block={err || card?.reason} /></div>
      </Section>
    </div>
  );
}
