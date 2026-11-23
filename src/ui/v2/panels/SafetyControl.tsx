// Model v3 E11 / UB-9: SAFETY › Safeguards' AI staff safeguards card (what stops acts against the lab, the control
// layer with its Slowdown) and the footholds card (HOME of every foothold the lab knows of: symptoms of suspected ones with
// where a case could look, located ones with the remove response, removed ones as history). Reads controlReadout and
// footholdView only: believed control, never the true level or the world's tolerance; never a hidden foothold.
import { PACKAGE_LABEL, packageMeets } from '../../../engine/v2/safety/packages';
import { LOCKDOWN_SLOWDOWN, controlOn, lockdownOn } from '../../../engine/v2/safety/safeguards';
import { useMemo, type ReactNode } from 'react';
import { believedInternalOversight, controlReadout, dateOf, fmtDate, footholdView, versionById } from '../../../engine/v2';
import { CONTROL } from '../../../data/v2/danger';
import type { FootholdRow, GameStateV2 } from '../../../engine/v2';
import { TRAIT_BY_ID } from '../../../data/v2/traits';
import { safetyModel } from '../safetyRule';
import { ActBtn, Term, Tip, TipCard } from '../ui';
import { Card, HBar, Ref } from '../kit';
import * as F from '../fmt';
import { FOOTHOLD_ICON, ICON } from '../icons';
import { C } from '../theme';

const AGENTS = { panel: 'lab', tab: 'work', anchor: 'agents' } as const;

/** UB-9: SAFETY › Safeguards on AI staff work: what stops acts against the lab (blocked, caught by monitors, caught by
 *  human review, watcher gap) and the control layer with its Slowdown. Loss-of-control risk and its parts live in the
 *  SAFETY header (one home); this card holds the safeguards only. */
export function ControlCard({ s }: { s: GameStateV2 }) {
  const c = useMemo(() => controlReadout(s), [s, s.time.day, s.player.deployments.some((d) => d.channel === 'internal' && controlOn(d))]);
  const id = c.risk?.versionId ?? c.versionId;
  const ov = useMemo(() => { const v = id ? safetyModel(s, id) : undefined; return v ? believedInternalOversight(s, v, CONTROL.trait) : undefined; }, [s, s.time.day, id, c.layer]);
  const selfWatch = !!c.monitorName?.startsWith('copy of');
  const gapText = c.monitorGapOom === undefined ? 'no monitor' : selfWatch ? 'watching itself' : `watcher ${F.num(c.monitorGapL ?? 0, 1)} levels below`;
  const part = (k: string, label: ReactNode, v: number, test: string) => (
    <Tip key={k} as="div" content={() => <TipCard title={label} value={F.pct(v)}>Share of attempts at acts against the lab this safeguard stops on its own; together they make the Stop rate of the Acts against the lab row in Risks.</TipCard>}>
      <div className="sf-drv" data-test={test}><span className="k">{label}</span><HBar v={v} max={1} w={90} color={C.und} /><span className="num">{F.pct(v)}</span></div>
    </Tip>
  );
  return (
    <Card title={<span className="row-i"><ICON.control size={14} />AI staff safeguards</span>} home="staffSafeguards" id="ctl-control" className="sf-ctl"
      sub={<>{c.risk?.name ?? c.name ?? 'no model'} · stops acts against the lab</>}
      right={<Ref id="lossRisk" to={{ panel: 'safety', tab: 'risks' }}>Stop rate in Risks</Ref>}>
      <div className="sf-ctl-drv">
        {ov && part('block', <Term id="controlLayer">Blocked by control protocols</Term>, ov.block, 'control-block')}
        {ov && part('mon', <Term id="agentMonitor">Caught by monitors</Term>, ov.monitor, 'control-monitor')}
        {ov && part('human', <Term id="humanGap">Caught by human review</Term>, ov.human, 'control-human')}
        <div className="small dim" data-test="control-gap"><Term id="oversightGap">Watcher</Term>: {c.monitorGapOom === undefined ? 'no monitor' : selfWatch ? <>watching itself: <Term id="collusion">{c.monitorName}</Term></> : `${c.monitorName} · ${gapText}`} · {c.humanGapOom > 0 ? 'past expert human reviewers: they miss more' : 'below best human'}</div>
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
  { kind: 'steeredSuccessor', symptom: 'evals drift from predicted traits', by: 'your eval stack', to: { panel: 'safety', tab: 'instruments' }, lever: 'Instruments' },
  { kind: 'corruptedTool', symptom: 'anomalous research results', by: 'model organisms, cross-checks', to: { panel: 'research', tab: 'projects' }, lever: 'Programmes' },
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
        right={<Ref id="effectiveControl" to={{ panel: 'safety', tab: 'risks' }}>Loss-of-control risk</Ref>}>
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
