// Model v3 E11: Safety › Overview's Control card (HOME of believed control, its band, what drives it and the control
// layer with its tax) and the Footholds tab (HOME of every foothold the lab knows of: symptoms of suspected ones with
// where a case could look, located ones with the remove response, removed ones as history). Reads controlReadout and
// footholdView only: believed control, never the true level or the world's tolerance; never a hidden foothold.
import { PACKAGE_LABEL, packageMeets } from '../../../engine/v2/safety/packages';
import { LOCKDOWN_SLOWDOWN, controlOn, lockdownOn } from '../../../engine/v2/safety/safeguards';
import { useMemo } from 'react';
import { believedInternalOversight, controlReadout, dateOf, fmtDate, footholdView, versionById } from '../../../engine/v2';
import { CONTROL } from '../../../data/v2/danger';
import type { FootholdRow, GameStateV2 } from '../../../engine/v2';
import { TRAIT_BY_ID } from '../../../data/v2/traits';
import { store } from '../store';
import { riskColor, riskTone, riskZones, safetyModel } from '../safetyRule';
import { ActBtn, Term, Tip, TipCard } from '../ui';
import { Card, Gauge, HBar, Pill, Ref } from '../kit';
import * as F from '../fmt';
import { FOOTHOLD_ICON, ICON } from '../icons';
import { C } from '../theme';

// SR-04: the gauge reads Loss-of-control risk on the Risk screen's scale (< 5% / 5–20% / > 20%).
const RISK_ZONES = riskZones('prob');
const riskKind = (p: number) => ({ good: 'good', watch: 'warn', bad: 'bad' } as const)[riskTone(p, 'prob')];
const riskWord = (p: number) => ({ good: 'low', watch: 'elevated', bad: 'high' } as const)[riskTone(p, 'prob')];
const FOOTHOLDS_TAB = { panel: 'safety', tab: 'footholds' } as const;
const AGENTS = { panel: 'lab', tab: 'work', anchor: 'agents' } as const;

/** Safety › Overview: believed control (L1 gauge + band), its three drivers, the control layer and its tax. */
export function ControlCard({ s }: { s: GameStateV2 }) {
  const c = useMemo(() => controlReadout(s), [s, s.time.day, s.player.deployments.some((d) => d.channel === 'internal' && controlOn(d))]);
  const r = c.risk;
  const assessed = !!r;
  const name = r?.name ?? c.name;
  const known = c.suspected + c.located;
  // F6b: oversight's believed parts (the same selector believed control uses), so the row says what binds.
  const ov = useMemo(() => { const id = r?.versionId ?? c.versionId; const v = id ? safetyModel(s, id) : undefined; return v ? believedInternalOversight(s, v, CONTROL.trait) : undefined; }, [s, s.time.day, r?.versionId, c.versionId, c.layer]);
  const selfWatch = !!c.monitorName?.startsWith('copy of');
  const gapText = c.monitorGapOom === undefined ? 'no monitor' : selfWatch ? 'watching itself' : `watcher ${F.num(c.monitorGapL ?? 0, 1)} levels below`;
  return (
    <Card title={<span className="row-i"><ICON.control size={14} /><Term id="lossRisk">Loss-of-control risk</Term></span>} home="lossRisk" id="ctl-control" className="sf-ctl"
      sub={assessed ? <>if it could act now · {name} · <Term id="unstoppedHarm">unstopped harm</Term> {F.num(c.harm, 2)} / yr</> : 'no model'}
      right={<button className={`sf-fh-chip ${c.suspected ? 'warn' : ''}`} data-test="foothold-chip" onClick={() => store.goto('safety', FOOTHOLDS_TAB)}>
        <ICON.foothold size={12} /><Term id="foothold">Footholds</Term> <b className="num">{known}</b>{known ? <span className="dim"> · {c.suspected} suspected · {c.located} located</span> : <span className="dim"> known</span>} <ICON.go size={11} />
      </button>}>
      <div className="sf-ctl-top">
        <Tip content={() => <TipCard title={<Term id="lossRisk">Loss-of-control risk</Term>} value={r ? `${F.pct(r.p, 1)} (${F.pct(r.lo, 1)}–${F.pct(r.hi, 1)})` : '—'} rows={r ? [
          { label: <Term id="misalign">Would try (act against the lab)</Term>, value: `${F.pct(r.mis)} (${F.pct(Math.max(0, r.mis - 1.64 * r.misSd))}–${F.pct(Math.min(1, r.mis + 1.64 * r.misSd))})` },
          { label: 'Stop rate (acts against the lab)', value: F.pct(r.stopRate) },
          { label: <Term id="footholdCapacity">Footholds: known + unfound</Term>, value: `${F.num(r.knownF, 2)} + ${F.num(r.unfoundF, 2)}${r.reach > 0 ? ` · backdoor reach ${F.pct(r.reach)}` : ''}` },
          { label: 'Exposure at best guess', value: F.num(r.exposure, 2) },
          { label: 'What the world survives', value: 'published range around 0.40' },
          { label: <Term id="unstoppedHarm">Unstopped harm</Term>, value: `${F.num(c.harm, 2)} / yr (${F.num(c.harmActs, 2)} acts)` },
        ] : []} footer="If it could act now. The game checks it when the model could act on it: your lab's ASI, or an escaped copy once the frontier is at Superhuman AI researcher. Your estimate only: traits you misread and footholds beyond the expected count do not show here.">{assessed ? `Your believed chance that ${name} could act against you with nothing able to stop it; the highest over the models you run. The range comes from how sure you are of what it would try.` : 'Assessed with each day: run the clock.'}</TipCard>}>
          <span className="sf-ctl-g" data-test="control-value" data-control={c.believed.toFixed(4)} data-risk={(r?.p ?? 0).toFixed(4)}>
            <Gauge value={r?.p ?? 0} max={1} zones={RISK_ZONES} band={r ? [r.lo, r.hi] : undefined} w={92} h={54} stroke={7} />
            <span className="sf-ctl-n"><b className="num">{F.pct(r?.p ?? 0, 1)}</b><Pill kind={riskKind(r?.p ?? 0)}>{riskWord(r?.p ?? 0)}</Pill></span>
          </span>
        </Tip>
        <div className="sf-ctl-drv">
          <Tip content={() => <TipCard title={<Term id="misalign">Would try (act against the lab)</Term>} value={F.pct(r?.mis ?? c.mis)}>From your trait beliefs on {name ?? 'the model'}. Its range and the traits behind it: Safety › Trait graph.</TipCard>}>
            <div className="sf-drv" data-test="control-mis"><span className="k"><Term id="misalign">Would try</Term></span><HBar v={r?.mis ?? c.mis} max={1} w={70} color={riskColor(r?.mis ?? c.mis, 'level')} /><span className="num">{F.pct(r?.mis ?? c.mis)}</span><span className="dim small">{r ? `± ${F.pct(1.64 * r.misSd)}` : 'best guess'}</span></div>
          </Tip>
          <Tip content={() => <TipCard title="Stop rate (acts against the lab)" value={F.pct(r?.stopRate ?? c.oversight)} rows={[
            ...(ov ? [
              { label: 'Blocked by control protocols', value: F.pct(ov.block) },
              { label: 'Caught by monitors and instruments', value: F.pct(ov.monitor) },
              { label: 'Caught by human review', value: F.pct(ov.human) },
            ] : []),
            { label: <Term id="oversightGap">Watcher gap</Term>, value: c.monitorGapOom === undefined ? 'no monitor' : selfWatch ? <>watching itself: <Term id="collusion">{c.monitorName}</Term></> : `${F.num(c.monitorGapL ?? 0, 1)} levels below · ${c.monitorName}` },
            { label: <Term id="humanGap">Past expert human reviewers</Term>, value: c.humanGapOom > 0 ? 'yes: reviewers miss more' : 'no (below best human)' },
            { label: <Term id="controlLayer">Control protocol</Term>, value: c.layer ? 'on' : 'off' },
          ]}>Share of a takeover attempt blocked or caught. It falls as capability outruns the monitors and human reviewers.</TipCard>}>
            <div className="sf-drv" data-test="control-oversight"><span className="k">Stop rate</span><HBar v={r?.stopRate ?? c.oversight} max={1} w={70} color={riskColor(r?.stopRate ?? c.oversight, 'factor', true)} /><span className="num">{F.pct(r?.stopRate ?? c.oversight)}</span><span className="dim small">{gapText}</span></div>
          </Tip>
          <Tip content={() => <TipCard title={<Term id="footholdCapacity">Footholds</Term>} value={`${F.num(r?.F ?? c.F, 2)} points`} rows={[
            ...(r ? [{ label: 'Known', value: F.num(r.knownF, 2) }, { label: 'Unfound (expected within a year)', value: F.num(r.unfoundF, 2) }] : []),
            { label: <Term id="footholdSuspected">Suspected</Term>, value: String(c.suspected) }, { label: <Term id="footholdLocated">Located</Term>, value: String(c.located) }, { label: 'Removed', value: String(c.removed) },
          ]}>Capacity beyond your safeguards&apos; reach: the footholds you know of (suspected ones at their kind&apos;s typical size) and the ones you expect but have not found. Details and responses: Safety › Footholds.</TipCard>}>
            <div className="sf-drv" data-test="control-footholds"><span className="k"><Term id="footholdCapacity">Footholds</Term></span><HBar v={r?.F ?? c.F} max={1} w={70} color={(r?.F ?? c.F) > 0 ? C.bad : C.good} /><span className="num">{F.num(r?.F ?? c.F, 2)}</span><span className="dim small">{known ? `${known} known` : 'none known'}</span></div>
          </Tip>
        </div>
      </div>
      <div className="sf-ctl-layer">
        <Tip content={() => <TipCard title={<Term id="controlLayer">Control protocol</Term>} value={c.layer ? 'on' : 'off'} rows={[
          { label: <Term id="controlTax">Slowdown</Term>, value: `−${F.pct(c.tax)} AI staff work (largest job)${c.layer ? '' : ' if on'}` },
          { label: <Term id="unstoppedHarm">Unstopped harm</Term>, value: `×${F.num(c.missMult, 2)}${c.layer ? '' : ' if on'}` },
        ]} footer="Slowdown per job: Lab › AI staff & needs.">Blocks risky actions and sends the most suspicious 10% to a trusted monitor. Removing it ends the slowdown and the protection.</TipCard>}>
          <span className="row-i" data-test="control-layer"><ICON.wsl size={13} /><Term id="controlLayer">Control protocol</Term> <b>{c.layer ? 'on' : 'off'}</b> <span className="dim small">· <Term id="controlTax">slowdown</Term> −{F.pct(c.tax)}{c.layer ? '' : ' if on'}</span></span>
        </Tip>
        <span className="sp" />
        {!c.layer && c.versionId && <ActBtn id="safety.respond" testId="control-add" params={{ kind: 'addControl', versionId: c.versionId }} label="Add control protocol" />}
        {c.layer && c.layerVersionId && <ActBtn id="safety.respond" testId="control-remove" params={{ kind: 'removeControl', versionId: c.layerVersionId }} label="Remove control protocol" />}
        {c.versionId && s.player.safety.techniques['T-LOCK']?.unlocked && (lockdownOn(s)
          ? <ActBtn id="safety.respond" testId="lockdown-remove" params={{ kind: 'removeLockdown', versionId: c.versionId }} label="Remove lockdown" />
          : <ActBtn id="safety.respond" testId="lockdown-add" params={{ kind: 'addLockdown', versionId: c.versionId }} label={`Add comms lockdown (−${Math.round(LOCKDOWN_SLOWDOWN * 100)}% work)`} />)}
        {(() => { const d = s.player.deployments.find((x) => x.channel === 'internal' && x.status === 'live'); return d ? <PackageRow s={s} depId={d.id} testId="internal-package" /> : null; })()}
        <Ref id="controlTax" to={AGENTS}>Slowdown per job</Ref>
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
  { kind: 'steeredSuccessor', symptom: 'evals drift from predicted traits', by: 'your eval stack', to: { panel: 'safety', tab: 'lines' }, lever: 'Instruments' },
  { kind: 'corruptedTool', symptom: 'anomalous research results', by: 'model organisms, cross-checks', to: { panel: 'safety', tab: 'lines' }, lever: 'Programmes' },
  { kind: 'exfiltratedCopy', symptom: 'outbound traffic', by: 'weight security', to: { panel: 'lab', tab: 'security' }, lever: 'Security' },
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
        right={<Ref id="effectiveControl" to={{ panel: 'safety', tab: 'overview' }}>Loss-of-control risk</Ref>}>
        <div className="tip-cap"><Term id="symptom">Symptoms</Term> · suspected</div>
        {sus.map((r) => (
          <div className="sf-fh-row sus" key={r.id} data-foothold={r.id} data-status="suspected">
            <ICON.alert size={14} className="tone-warn" />
            <span className="sf-fh-main"><span className="sf-fh-sym">{r.symptom}</span><span className="small dim"><KindName r={r} /> · since {date(r.suspectedDay)}</span></span>
            {r.caseVersionId && r.caseTrait ? (
              <span className="sf-fh-act">
                <Tip content={() => <TipCard title={<Term id="investigation">Where a case could look</Term>} rows={[{ label: 'Model', value: vname(r.caseVersionId) }, { label: 'Trait', value: TRAIT_BY_ID[r.caseTrait!]?.name ?? r.caseTrait! }]}>A case on this model and trait may locate the foothold; the better your evidence, the likelier.</TipCard>}>
                  <span className="small dim">{vname(r.caseVersionId)} · <Term id={`trait:${r.caseTrait}`}>{TRAIT_BY_ID[r.caseTrait]?.name ?? r.caseTrait}</Term></span>
                </Tip>
                <ActBtn id="safety.investigate" testId={`foothold-case.${r.id}`} params={{ versionId: r.caseVersionId, trait: r.caseTrait, fte: 15 }} icon={ICON.investigate} label="Open case" />
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

/** SR-20 / RF-S2: the "Meet my framework" package on one deployment (product or internal agents): one button; its
 *  preview lists every part's charged cost and the stop rates (safety.package). Parts stay editable on their own controls. */
export function PackageRow({ s, depId, testId }: { s: GameStateV2; depId: string; testId: string }) {
  return (
    <span className="row-i small" data-test={testId}>
      <Tip content={() => { const d = s.player.deployments.find((x) => x.id === depId); return <TipCard title="Framework safeguards">Adds what {d ? packageMeets(s, d) : 'your Safety framework asks'} that this deployment lacks. Your Safety framework applies it by itself when a rule starts asking (once per model and safeguard; the log says what it cost); use this to put back a part you removed. Safeguards you already run stay; each part's cost in the preview is the engine's own charge.</TipCard>; }}><span className="dim">Framework safeguards</span></Tip>
      <ActBtn id="safety.package" testId={`${testId}.framework`} params={{ deploymentId: depId }} label={PACKAGE_LABEL} />
    </span>
  );
}
