// Model v3 E11: Safety › Overview's Control card (HOME of believed control, its band, what drives it and the control
// layer with its tax) and the Footholds tab (HOME of every foothold the lab knows of: symptoms of suspected ones with
// where a case could look, located ones with the remove response, removed ones as history). Reads controlReadout and
// footholdView only: believed control, never the true level or the world's tolerance; never a hidden foothold.
import { useMemo } from 'react';
import { controlReadout, CONTROL_BANDS, dateOf, fmtDate, footholdView, versionById } from '../../../engine/v2';
import type { ControlBand, FootholdRow, GameStateV2 } from '../../../engine/v2';
import { TRAIT_BY_ID } from '../../../data/v2/traits';
import { store } from '../store';
import { ActBtn, Term, Tip, TipCard } from '../ui';
import { Card, Gauge, HBar, Pill, Ref } from '../kit';
import * as F from '../fmt';
import { FOOTHOLD_ICON, ICON } from '../icons';
import { C } from '../theme';

const BAND_KIND: Record<ControlBand, 'good' | 'warn' | 'bad'> = { firm: 'good', holding: 'good', slipping: 'warn', weak: 'bad' };
const BAND_COL: Record<ControlBand, string> = { firm: C.good, holding: C.good, slipping: C.watch, weak: C.bad };
const ZONES = [...CONTROL_BANDS].reverse().map((b, i, a) => ({ to: a[i + 1]?.min ?? 1, color: BAND_COL[b.band] }));
const FOOTHOLDS_TAB = { panel: 'safety', tab: 'footholds' } as const;
const AGENTS = { panel: 'company', tab: 'people', anchor: 'agents' } as const;

/** Safety › Overview: believed control (L1 gauge + band), its three drivers, the control layer and its tax. */
export function ControlCard({ s }: { s: GameStateV2 }) {
  const c = useMemo(() => controlReadout(s), [s, s.time.day, s.player.deployments.some((d) => d.channel === 'internal' && d.controlLayer)]);
  const assessed = !!c.versionId;
  const known = c.suspected + c.located;
  return (
    <Card title={<span className="row-i"><ICON.control size={14} /><Term id="effectiveControl">Control</Term></span>} home="effectiveControl" id="ctl-control" className="sf-ctl"
      sub={assessed ? <>believed · {c.name}</> : 'no model'}
      right={<button className={`sf-fh-chip ${c.suspected ? 'warn' : ''}`} data-test="foothold-chip" onClick={() => store.goto('safety', FOOTHOLDS_TAB)}>
        <ICON.foothold size={12} /><Term id="foothold">Footholds</Term> <b className="num">{known}</b>{known ? <span className="dim"> · {c.suspected} suspected · {c.located} located</span> : <span className="dim"> known</span>} <ICON.go size={11} />
      </button>}>
      <div className="sf-ctl-top">
        <Tip content={() => <TipCard title={<Term id="effectiveControl">Control (believed)</Term>} value={F.num(c.believed, 2)} rows={[
          { label: <Term id="controlBand">Band</Term>, value: c.band },
          { label: 'Exposure', value: `${F.num(c.mis, 2)} × (1 − ${F.num(c.oversight, 2)}) × (1 + ${F.num(c.F, 2)}) = ${F.num(c.exposure, 2)}` },
          ...CONTROL_BANDS.map((b) => ({ label: b.band, value: `≥ ${F.num(b.min, 2)}` })),
        ]} footer="Your estimate only. The true level can be lower: footholds you have not found and traits you misread do not count here.">{assessed ? `The share of ${c.name}'s capacity you believe you could still see and undo; the lowest over your best model and your internal fleets.` : 'Assessed with each day: run the clock.'}</TipCard>}>
          <span className="sf-ctl-g" data-test="control-value" data-control={c.believed.toFixed(4)}>
            <Gauge value={c.believed} max={1} zones={ZONES} w={92} h={54} stroke={7} />
            <span className="sf-ctl-n"><b className="num">{F.num(c.believed, 2)}</b><Pill kind={BAND_KIND[c.band]}>{c.band}</Pill></span>
          </span>
        </Tip>
        <div className="sf-ctl-drv">
          <Tip content={() => <TipCard title={<Term id="misalign">Estimated misalignment</Term>} value={F.num(c.mis, 2)}>From your trait beliefs on {c.name ?? 'the model'}. Its band and the traits behind it: Safety › Trait graph.</TipCard>}>
            <div className="sf-drv" data-test="control-mis"><span className="k"><Term id="misalign">Misalignment</Term></span><HBar v={c.mis} max={1} w={70} color={c.mis >= 0.4 ? C.bad : c.mis >= 0.2 ? C.watch : C.good} /><span className="num">{F.num(c.mis, 2)}</span><span className="dim small">est.</span></div>
          </Tip>
          <Tip content={() => <TipCard title={<Term id="effOversight">Effective oversight</Term>} value={F.pct(c.oversight)} rows={[
            { label: <Term id="oversightGap">Gap to its monitor</Term>, value: c.monitorGapOom !== undefined ? `${F.num(c.monitorGapOom, 1)} OOM (${F.num(c.monitorGapL ?? 0, 1)} levels) · ${c.monitorName}` : 'no monitor' },
            { label: <Term id="humanGap">Gap above expert humans</Term>, value: c.humanGapOom > 0 ? `${F.num(c.humanGapOom, 1)} OOM` : 'none (below L 10)' },
            { label: <Term id="controlLayer">Control layer</Term>, value: c.layer ? 'on' : 'off' },
          ]}>Share of a takeover attempt blocked or caught. It falls as capability outruns the monitors and human reviewers.</TipCard>}>
            <div className="sf-drv" data-test="control-oversight"><span className="k"><Term id="effOversight">Oversight</Term></span><HBar v={c.oversight} max={1} w={70} color={c.oversight >= 0.5 ? C.good : c.oversight >= 0.2 ? C.watch : C.bad} /><span className="num">{F.pct(c.oversight)}</span><span className="dim small">{c.monitorGapOom !== undefined ? `gap ${F.num(c.monitorGapOom, 1)}` : 'no monitor'}</span></div>
          </Tip>
          <Tip content={() => <TipCard title={<Term id="footholdCapacity">Known foothold capacity</Term>} value={F.num(c.F, 2)} rows={[
            { label: <Term id="footholdSuspected">Suspected</Term>, value: String(c.suspected) }, { label: <Term id="footholdLocated">Located</Term>, value: String(c.located) }, { label: 'Removed', value: String(c.removed) },
          ]}>Capacity outside oversight from the footholds you know of. Details and responses: Safety › Footholds.</TipCard>}>
            <div className="sf-drv" data-test="control-footholds"><span className="k"><Term id="footholdCapacity">Footholds</Term></span><HBar v={c.F} max={1} w={70} color={c.F > 0 ? C.bad : C.good} /><span className="num">{F.num(c.F, 2)}</span><span className="dim small">{known ? `${known} known` : 'none known'}</span></div>
          </Tip>
        </div>
      </div>
      <div className="sf-ctl-layer">
        <Tip content={() => <TipCard title={<Term id="controlLayer">Control layer</Term>} value={c.layer ? 'on' : 'off'} rows={[
          { label: <Term id="controlTax">Control tax</Term>, value: `−${F.pct(c.tax)} AI labour (largest lane)${c.layer ? '' : ' if on'}` },
          { label: 'Bad actions slipping through', value: `×${F.num(c.missMult, 2)}${c.layer ? '' : ' if on'}` },
        ]} footer="Tax per lane: Company › Agents at work.">Containment tools block actions and the most suspicious 10% go to the trusted monitor. Remove control turns it off (the tax ends, and so does the protection).</TipCard>}>
          <span className="row-i" data-test="control-layer"><ICON.wsl size={13} /><Term id="controlLayer">Control layer</Term> <b>{c.layer ? 'on' : 'off'}</b> <span className="dim small">· <Term id="controlTax">tax</Term> −{F.pct(c.tax)}{c.layer ? '' : ' if on'}</span></span>
        </Tip>
        <span className="sp" />
        {!c.layer && c.versionId && <ActBtn id="safety.respond" testId="control-add" params={{ kind: 'addControl', versionId: c.versionId }} label="Add control" />}
        {c.layer && c.layerVersionId && <ActBtn id="safety.respond" testId="control-remove" params={{ kind: 'removeControl', versionId: c.layerVersionId }} label="Remove control" />}
        <Ref id="controlTax" to={AGENTS}>Tax per lane</Ref>
      </div>
    </Card>
  );
}

const fmtSize = (r: FootholdRow) => {
  if (r.size === undefined) return '—';
  if (r.unit === 'H100e') return `${F.h100e(r.size)} H100e`;
  if (r.unit === 'reach') return `reach ${F.pct(r.size)}`;
  if (r.unit === 'copies') return `${F.count(r.size)} copies`;
  return `${r.unit} ${F.num(r.size, 2)}`;
};
const KIND_TERM: Record<string, string> = { backdoor: 'fhBackdoor', hiddenCompute: 'fhHiddenCompute', steeredSuccessor: 'fhSteeredSuccessor', exfiltratedCopy: 'fhExfiltratedCopy', corruptedTool: 'fhCorruptedTool' };

function KindName({ r }: { r: FootholdRow }) {
  const I = FOOTHOLD_ICON[r.kind] ?? ICON.foothold;
  return <span className="row-i sf-fh-k"><I size={14} /><Term id={KIND_TERM[r.kind]}>{r.name}</Term></span>;
}

/** What surfaces each kind (the watch list: symptom ← channel → the lever that strengthens it). Static rules, no state. */
const WATCH: { kind: string; symptom: string; by: string; to?: { panel: string; tab?: string; anchor?: string }; lever?: string }[] = [
  { kind: 'backdoor', symptom: 'unexplained access', by: 'monitors on the fleet', to: AGENTS, lever: 'Monitors' },
  { kind: 'hiddenCompute', symptom: 'unexplained compute use', by: 'monitors and compute accounting', to: AGENTS, lever: 'Monitors' },
  { kind: 'steeredSuccessor', symptom: 'evals drift from predicted traits', by: 'your eval stack', to: { panel: 'safety', tab: 'lines' }, lever: 'Tools' },
  { kind: 'corruptedTool', symptom: 'anomalous research results', by: 'model organisms, cross-checks', to: { panel: 'safety', tab: 'lines' }, lever: 'Lines' },
  { kind: 'exfiltratedCopy', symptom: 'outbound traffic', by: 'weight security', to: { panel: 'company', tab: 'security' }, lever: 'Security' },
];

function WatchCard() {
  return (
    <Card title={<Term id="symptom">What to watch for</Term>} sub="how each kind shows" className="sf-watch">
      {WATCH.map((w) => {
        const I = FOOTHOLD_ICON[w.kind] ?? ICON.foothold;
        return (
          <div className="sf-watch-row" key={w.kind} data-watch={w.kind}>
            <I size={14} />
            <span className="sf-fh-main"><Term id={KIND_TERM[w.kind]}>{w.symptom}</Term><span className="small dim">seen by {w.by}</span></span>
            {w.to && w.lever && <Ref id={`watch-${w.kind}`} to={w.to}>{w.lever}</Ref>}
          </div>
        );
      })}
    </Card>
  );
}

/** Safety › Footholds: the lab's known footholds (home). */
export function FootholdsTab({ s }: { s: GameStateV2 }) {
  const fv = footholdView(s);
  const sus = fv.rows.filter((r) => r.status === 'suspected');
  const loc = fv.rows.filter((r) => r.status === 'detected');
  const gone = fv.rows.filter((r) => r.status === 'removed');
  const date = (d?: number) => (d === undefined ? '—' : fmtDate(dateOf(s, d)));
  const vname = (id?: string) => versionById(s, id)?.name ?? id ?? '—';
  return (
    <div className="sf-fh">
      <div className="sf-fh-list">
      <Card title={<span className="row-i"><ICON.foothold size={14} /><Term id="foothold">Footholds</Term></span>} home="footholds" id="ctl-footholds"
        sub={<Tip content={() => <TipCard title={<Term id="foothold">Footholds you know of</Term>} rows={[{ label: <Term id="footholdSuspected">Suspected</Term>, value: String(fv.suspected) }, { label: <Term id="footholdLocated">Located</Term>, value: String(fv.located) }, { label: 'Removed', value: String(fv.removed) }]}>Only what your monitors, accounting, evals, cases and security have turned up. Others may exist.</TipCard>}><span>{fv.suspected} suspected · {fv.located} located · {fv.removed} removed</span></Tip>}
        right={<Ref id="effectiveControl" to={{ panel: 'safety', tab: 'overview' }}>Control</Ref>}>
        <div className="tip-cap"><Term id="symptom">Symptoms</Term> · suspected</div>
        {sus.map((r) => (
          <div className="sf-fh-row sus" key={r.id} data-foothold={r.id} data-status="suspected">
            <ICON.alert size={14} className="tone-warn" />
            <span className="sf-fh-main"><span className="sf-fh-sym">{r.symptom}</span><span className="small dim"><KindName r={r} /> · since {date(r.suspectedDay)}</span></span>
            {r.caseVersionId && r.caseTrait ? (
              <span className="sf-fh-act">
                <Tip content={() => <TipCard title={<Term id="investigation">Where a case could look</Term>} rows={[{ label: 'Model', value: vname(r.caseVersionId) }, { label: 'Trait', value: TRAIT_BY_ID[r.caseTrait!]?.name ?? r.caseTrait! }]}>A case on this model and trait locates the foothold with a chance about its clarity.</TipCard>}>
                  <span className="small dim">{vname(r.caseVersionId)} · <Term id={`trait:${r.caseTrait}`}>{TRAIT_BY_ID[r.caseTrait]?.name ?? r.caseTrait}</Term></span>
                </Tip>
                <ActBtn id="safety.investigate" testId={`foothold-case.${r.id}`} params={{ versionId: r.caseVersionId, trait: r.caseTrait, fte: 15 }} icon={ICON.investigate} label="Investigate" />
              </span>
            ) : <span className="small dim">{r.kind === 'exfiltratedCopy' ? 'outside the lab: only the hunt' : 'no running model to examine'}</span>}
          </div>
        ))}
        {!sus.length && <div className="small dim sf-fh-none">No symptom open.</div>}
        <div className="tip-cap sf-sep"><Term id="footholdLocated">Located</Term> · <Term id="footholdRemove">remove</Term> ends its effect</div>
        {loc.map((r) => (
          <div className="sf-fh-row loc" key={r.id} data-foothold={r.id} data-status="detected">
            <ICON.foothold size={14} className="tone-neg" />
            <span className="sf-fh-main"><KindName r={r} /><span className="small dim">made by {vname(r.versionId)} · located {date(r.detectedDay)} · {r.symptom}</span></span>
            <Tip content={() => <TipCard title="Size" value={fmtSize(r)}>As far as the lab now knows it.</TipCard>}><span className="num sf-fh-size">{fmtSize(r)}</span></Tip>
            <ActBtn id="safety.respond" testId={`foothold-remove.${r.id}`} params={{ kind: 'removeFoothold', footholdId: r.id }} label="Remove" block={r.kind === 'exfiltratedCopy' ? 'Outside the lab: only the hunt can end it' : undefined} />
          </div>
        ))}
        {!loc.length && <div className="small dim sf-fh-none">None located.</div>}
        {gone.length > 0 && <>
          <div className="tip-cap sf-sep">Removed</div>
          {gone.map((r) => (
            <div className="sf-fh-row gone" key={r.id} data-foothold={r.id} data-status="removed">
              <ICON.check size={14} className="tone-pos" />
              <span className="sf-fh-main"><KindName r={r} /><span className="small dim">made by {vname(r.versionId)} · removed {date(r.removedDay)}</span></span>
              <Tip content={() => <TipCard title="Size when removed" value={fmtSize(r)} />}><span className="num sf-fh-size dim">{fmtSize(r)}</span></Tip>
              <span />
            </div>
          ))}
        </>}
      </Card>
      </div>
      <WatchCard />
    </div>
  );
}
