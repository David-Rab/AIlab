// Model v3 E11: the compact believed-danger readout of one deployment (a product card, an internal agent lane). L1: the
// estimated harmful acts per year and four factor bars of the act that dominates (disposition, capability, opportunity,
// oversight). L3 tooltip: the top acts with their four factors, each factor's parts, and what lowers it with the same
// estimate after. Reads dangerView (beliefs and measured levels only); the home of each datum is this readout.
import type { ReactNode } from 'react';
import { Eye } from 'lucide-react';
import type { DangerRead } from '../../../engine/v2';
import { Term, Tip, TipCard } from '../ui';
import { DOMAIN_WORD } from '../kit';
import * as F from '../fmt';
import { ICON, TRAIT_ICON } from '../icons';
import { riskClass, riskColor } from '../safetyRule';
import './danger.css';

/** Harmful acts per year: 2 significant digits, "< 0.01" below. */
export const perYr = (x: number) => (x < 0.005 ? '< 0.01' : x < 1 ? x.toFixed(2) : x < 10 ? x.toFixed(1) : x.toFixed(0));
const actName = (act: string) => act.split(':')[0];
/** Bad-when-up factor colour (disposition, capability, opportunity); oversight is good-when-up. */
const tone = (x: number, goodUp = false) => {
  const v = goodUp ? 1 - x : x;
  return riskColor(v, 'factor');
};

function Factor({ k, v, goodUp = false }: { k: ReactNode; v: number; goodUp?: boolean }) {
  const h = Math.max(0.06, Math.min(1, v));
  return (
    <span className="dg-f">
      <span className="dg-fb"><i style={{ height: `${h * 100}%`, background: tone(v, goodUp) }} /></span>
      <span className="dg-fk">{k}</span>
    </span>
  );
}

function DangerTip({ r, where }: { r: DangerRead; where: string }) {
  const t = r.top;
  const n2 = (x: number) => x.toFixed(2);
  const fac = t ? [
    { label: <Term id="disposition">Would try</Term>, value: `best guess ${F.pct(t.est)} → ${F.pct(t.disposition)} of chances` },
    { label: <Term id="actCapability">Able to</Term>, value: `${DOMAIN_WORD[t.domain] ?? t.domain} level ${F.level(t.level)}, needs ${F.level(t.theta)} → ${F.pct(t.capability)}` },
    { label: <Term id="opportunity">Chances</Term>, value: `use ${F.pct(r.usage)} · autonomy ${F.pct(r.autonomy)} · tool access ×${F.num(r.afford, 1)}${r.site === 'internal' ? ` · AI share of R&D ${F.pct(r.rd)}` : ''}` },
    { label: <Term id="actOversight">Stop rate</Term>, value: `blocked ${F.pct(t.block)} · caught ${F.pct(t.catch)}${r.site === 'internal' ? ` (humans ${F.pct(r.human)})` : r.monitor > 0 ? '' : ' (no monitor)'}` },
  ] : [];
  const levers = r.harmful >= 0.005 ? r.levers : [];
  return (
    <TipCard title={<><Term id="danger">Harmful acts</Term> · {where}</>} value={`${perYr(r.harmful)} harmful acts/yr`} rows={[
      ...(t ? [{ label: <span className="tip-cap">{actName(t.act)}: why</span>, value: '' }, ...fac] : []),
      { label: 'Attempts · caught', value: `${perYr(r.attempts)} · ${perYr(r.caught)} /yr (incidents)` },
      ...(levers.length ? [{ label: <span className="tip-cap">What lowers it</span>, value: '' }] : []),
      ...levers.map((l) => ({ label: l.id === 'control' ? <Term id="controlLayer">{l.label}</Term> : l.label, value: l.after !== undefined ? `${perYr(r.harmful)} → ${perYr(l.after)} /yr` : l.note, tone: (l.after !== undefined && l.after < r.harmful - 1e-9 ? 'pos' : 'neutral') as 'pos' | 'neutral' })),
    ]} footer="From your beliefs and measured levels: a model you read poorly can be worse.">
      <table className="dg-tab">
        <thead><tr><th>Act</th><th><Term id="disposition">Would try</Term></th><th><Term id="actCapability">Able to</Term></th><th><Term id="opportunity">Chances</Term></th><th><Term id="actOversight">Stop rate</Term></th><th>/yr</th></tr></thead>
        <tbody>{r.acts.slice(0, 3).map((a) => (
          <tr key={a.trait}><td><Term id={`trait:${a.trait}`}>{actName(a.act)}</Term></td><td>{F.pct(a.disposition)}</td><td>{F.pct(a.capability)}</td><td>{n2(a.opportunity)}</td><td>{F.pct(a.oversight)}</td><td><b>{perYr(a.harmful)}</b></td></tr>
        ))}</tbody>
      </table>
    </TipCard>
  );
}

/** The compact readout. `where` names the deployment in the tooltip. */
export function DangerChip({ r, where, testId, compact = false }: { r?: DangerRead; where: string; testId?: string; /** Lanes: no act name (tooltip only); "acts/yr" is in the lane table's head (F6d). */ compact?: boolean }) {
  if (!r) return null;
  const t = r.top;
  const TI = t ? TRAIT_ICON[t.trait] : undefined;
  return (
    <Tip content={() => <DangerTip r={r} where={where} />}>
      <span className="dg-chip" data-test={testId} data-harm={r.harmful.toFixed(4)}>
        <ICON.danger size={12} className={riskClass(r.harmful, 'rate', 'dim')} />
        <b className="num">{perYr(r.harmful)}</b><span className="dim small">{compact ? '/yr' : 'acts/yr'}</span>
        {t && <span className="dg-fs">
          <Factor k="try" v={t.disposition} />
          <Factor k="able" v={t.capability} />
          <Factor k="chances" v={Math.min(1, t.opportunity)} />
          <Factor k={<Eye size={8} />} v={t.oversight} goodUp />
        </span>}
        {t && !compact && <span className="dg-top small ellip">{TI && <TI size={11} />}{actName(t.act).toLowerCase()}</span>}
      </span>
    </Tip>
  );
}
