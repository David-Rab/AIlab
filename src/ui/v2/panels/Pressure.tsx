// Training pressure of a run (model v3 E12, MODEL-V3 §11.2): the signals S1–S8 a run applies, each as its cause in plain
// words with the run quantities behind it, the trait families it pushes, and the run's ω (how far it moves traits).
// Shared by the Blueprint (the planned run: home `runPressure`) and the model card (what a finished run applied: home
// `versionPressure`). Successor pull (the R&D models' dispositions passed to the next run) lives on Safety.
import { useState } from 'react';
import { RISK_FAMILIES } from '../../../data/v2/agents';
import { RL_FAMILY_LABEL } from '../../../data/v2/suites';
import { TRAIT_BY_ID } from '../../../data/v2/traits';
import { signalPushes } from '../../../engine/v2';
import type { PressureRow, PushTarget, RunPressure, SignalId } from '../../../engine/v2';
import { Term, Tip, TipCard } from '../ui';
import * as F from '../fmt';
import { FAMILY_ICON, SIGNAL_ICON } from '../icons';
import { C } from '../theme';
import './pressure.css';

/** Plain-words name of each signal (the glossary `sig:` entry has the research name). */
export const SIGNAL_LABEL: Record<SignalId, string> = {
  S1: 'Approval reward', S2: 'Reward-hacking pressure', S3: 'Long agentic tasks', S4: 'Reasoning pressure',
  S5: 'Situational data', S6: 'Narrow & synthetic data', S7: 'Eval-like training', S8: 'Copies & shared memory',
};
export const TARGET_LABEL: Record<PushTarget, string> = { ...Object.fromEntries(RISK_FAMILIES.map((f) => [f.id, f.label])), awareness: 'Awareness' } as Record<PushTarget, string>;
const PREF_LABEL: Record<string, string> = { constitution: 'Constitution feedback', engagement: 'Engagement reward', persuasion: 'Persuasion reward', minimal: 'Minimal preference stage' };
const COT_LABEL: Record<string, string> = { visible: 'Visible reasoning, not trained against', pressured: 'Reasoning trained under pressure', faithful: 'Faithful-reasoning training', latent: 'Latent reasoning (no readable CoT)' };
const rel = (rho: number, ref: number) => `RL ${F.num(rho / ref, rho / ref >= 10 ? 0 : 1)}× the reference`;
const n = (x: number | string | boolean | undefined) => Number(x ?? 0);

/** One line of cause in plain words, with the quantities behind the value. */
export function causeText(r: PressureRow, kind: RunPressure['kind']): string {
  const q = r.q;
  switch (r.id) {
    case 'S1': return `${PREF_LABEL[String(q.method)] ?? String(q.method)} (bias ${F.num(n(q.bias), 2)}) on ${F.pct(n(q.prefShare), 1)} of RL (reference ${F.pct(n(q.prefShareRef), 1)})`;
    case 'S2': {
      const top = r.fams?.[0];
      const lead = top ? `${F.pct(top.share)} of RL on ${RL_FAMILY_LABEL[top.family]} at ${F.pct(top.x)} exploitable` : 'no RL';
      return `${lead}, ${F.pct(n(q.hackRate), 1)} hackable overall × ${rel(n(q.rho), n(q.rhoRef))}${q.p11 ? ' · +0.2 automated research (P11)' : ''}${q.todaySuites ? ' (suites as of today: the run’s own were not recorded)' : ''}`;
    }
    case 'S3': {
      const top = [...(r.fams ?? [])].sort((a, b) => b.x - a.x)[0];
      return n(q.agentic) > 0 ? `${F.pct(n(q.agentic))} of RL on agentic tasks; longest tasks ${top ? `${F.num(top.x, 0)} h (${RL_FAMILY_LABEL[top.family]})` : ''}` : 'no agentic RL';
    }
    case 'S4': return `${COT_LABEL[String(q.cot)] ?? String(q.cot)}${q.cotMonitor ? ' · trained against a CoT monitor' : ''}`;
    case 'S5': return kind === 'post' ? (n(q.longShare) > 0 ? `${F.pct(n(q.longShare))} of RL on long tasks` : 'no long-task RL')
      : q.legacy ? `scale G ${F.num(n(q.gPre), 1)} (AI-data share not recorded for this base)` : `AI-related data ${F.pct(n(q.ai), 1)} of tokens (reference ${F.pct(n(q.aiRef), 1)})${q.safetyPretrain ? ' after safety pretraining' : ''} + scale G ${F.num(n(q.gPre), 1)}`;
    case 'S6': return kind === 'distill' ? 'all training data written by the teacher' : kind === 'post' ? 'narrow fine-tunes (refusals, format): the baseline'
      : q.legacy ? 'synthetic share not recorded for this base' : `synthetic data ${F.pct(n(q.syn), 1)} of tokens (reference ${F.pct(n(q.synRef), 1)})`;
    case 'S7': return `${rel(n(q.rho), n(q.rhoRef))} · ${F.pct(n(q.mlShare))} of RL on ML research${n(q.bb) ? ` · ${n(q.bb)} behavioural detector${n(q.bb) > 1 ? 's' : ''} trained against` : ''}`;
    case 'S8': return `${F.count(n(q.copies))} internal agent copies${q.p05 ? ' · shared memory (P05)' : ''}${q.p20 ? ' · agent societies (P20)' : ''}${q.applied ? '' : ' (today)'}`;
  }
}

/** Breakdown of one signal (L3): the formula's terms. */
function SignalTip({ r, kind }: { r: PressureRow; kind: RunPressure['kind'] }) {
  const q = r.q;
  const rows: { label: React.ReactNode; value: React.ReactNode }[] = [];
  if (r.id === 'S2') {
    for (const f of r.fams ?? []) rows.push({ label: `${RL_FAMILY_LABEL[f.family]}: ${F.pct(f.share)} of RL × ${F.pct(f.x, 1)} exploitable`, value: F.num(f.term, 3) });
    rows.push({ label: <Term id="rlBudget">Optimisation pressure</Term>, value: `×${F.num(n(q.pressure), 2)}` });
    if (q.p11) rows.push({ label: 'Automated research (P11)', value: '+0.20' });
  } else if (r.id === 'S3') {
    for (const f of r.fams ?? []) rows.push({ label: `${RL_FAMILY_LABEL[f.family]}: ${F.pct(f.share)} of RL, ${F.num(f.x, 0)} h tasks`, value: F.num(f.term, 3) });
  } else if (r.id === 'S5' && kind !== 'post') {
    rows.push({ label: `AI-related data ${F.pct(n(q.ai), 1)} ÷ ${F.pct(n(q.aiRef), 1)} × 0.2`, value: F.num(n(q.aiTerm), 3) });
    rows.push({ label: `Scale: 0.05 × (G ${F.num(n(q.gPre), 2)} − ${F.num(n(q.g0), 1)})`, value: F.num(n(q.gTerm), 3) });
  } else if (r.id === 'S7') {
    rows.push({ label: 'Baseline', value: F.num(n(q.base), 2) });
    rows.push({ label: rel(n(q.rho), n(q.rhoRef)), value: F.num(n(q.rl), 3) });
    rows.push({ label: `ML research ${F.pct(n(q.mlShare))} of RL × 0.6`, value: F.num(n(q.mlShare) * n(q.kMl), 3) });
    if (n(q.bb)) rows.push({ label: `${n(q.bb)} detector(s) trained against × 0.3`, value: F.num(n(q.bb) * n(q.kBb), 2) });
  }
  const pushes = signalPushes(r.id);
  return (
    <TipCard title={<Term id={`sig:${r.id}`}>{SIGNAL_LABEL[r.id]}</Term>} value={F.num(r.value, 2)} rows={[
      ...rows,
      ...pushes.map((p) => ({ label: <>pushes {TARGET_LABEL[p.target]}</>, value: p.traits.map((t) => TRAIT_BY_ID[t].name).join(', ') })),
    ]} footer="0–1. The trait graph turns signals into trait changes, scaled by the run's ω.">{causeText(r, kind)}.</TipCard>
  );
}

/** The run's ω (how far it moves traits) with its parts. */
export function OmegaChip({ p }: { p: RunPressure }) {
  const o = p.omega;
  return (
    <Tip content={() => <TipCard title={<Term id="traitMovement">Trait movement ω</Term>} value={F.num(o.growth, 2)} rows={[
      { label: `${p.kind === 'base' ? 'Base run' : p.kind === 'post' ? 'Post-training' : p.kind === 'distill' ? 'Distillation' : 'Continued pretraining'} at the reference`, value: F.num(o.kind, 2) },
      ...(o.rlFactor !== undefined && o.rho !== undefined ? [{ label: <>RL compute {F.pct(o.rho)} of the base's FLOP: ×(ρ ÷ 15%)^¼</>, value: `×${F.num(o.rlFactor, 2)}` }] : []),
      { label: <Term id="safetyTraining">Safety training ω</Term>, value: F.num(o.safety, 2) },
    ]}>How far this run moves the traits along the graph's edges: the signals' push × ω.</TipCard>}>
      <span className="pr-omega" data-test="pr-omega"><Term id="traitMovement">ω</Term> <b className="num">{F.num(o.growth, 2)}</b></span>
    </Tip>
  );
}

/** Families a signal pushes, as icons (hover: the traits). */
function Pushes({ id }: { id: SignalId }) {
  return (
    <span className="pr-push">
      {signalPushes(id).map((p) => {
        const I = FAMILY_ICON[p.target];
        return <Tip key={p.target} content={() => <TipCard title={p.target === 'awareness' ? <Term id="traitAwareness">Awareness</Term> : <Term id="riskFamily">{TARGET_LABEL[p.target]}</Term>}>Pushes {p.traits.map((t) => TRAIT_BY_ID[t].name.toLowerCase()).join(', ')}.</TipCard>}><span data-push={p.target}><I size={12} /></span></Tip>;
      })}
    </span>
  );
}

/** The signal rows of a run: label, bar, value, families pushed, cause line. Signals at zero fold into one line. */
export function PressureRows({ p, testId }: { p: RunPressure; testId: string }) {
  const [all, setAll] = useState(false);
  const live = p.rows.filter((r) => r.value >= 0.005);
  const zero = p.rows.filter((r) => r.value < 0.005);
  return (
    <div className="pr-rows" data-test={testId}>
      {live.map((r) => {
        const I = SIGNAL_ICON[r.id];
        return (
          <Tip key={r.id} as="div" content={() => <SignalTip r={r} kind={p.kind} />}>
            <div className="pr-row" data-signal={r.id}>
              <span className="pr-name"><I size={12} /><Term id={`sig:${r.id}`}>{SIGNAL_LABEL[r.id]}</Term></span>
              <span className="pr-bar"><i style={{ width: `${Math.min(1, r.value) * 100}%`, background: r.value >= 0.6 ? C.bad : r.value >= 0.3 ? C.watch : C.neutral }} /></span>
              <span className="num pr-v" data-test="pr-value">{F.num(r.value, 2)}</span>
              <Pushes id={r.id} />
              <span className={`pr-cause small dim ${all ? '' : 'ellip'}`} data-test="pr-cause">{causeText(r, p.kind)}</span>
            </div>
          </Tip>
        );
      })}
      <div className="pr-foot small dim">
        {zero.length > 0 && <span>{zero.map((r) => SIGNAL_LABEL[r.id]).join(', ')}: none</span>}
        <span className="sp" />
        {live.length > 0 && <button className="btn btn-sm btn-ghost" data-test={`${testId}-wrap`} onClick={() => setAll(!all)}>{all ? 'Short causes' : 'Full causes'}</button>}
      </div>
    </div>
  );
}
