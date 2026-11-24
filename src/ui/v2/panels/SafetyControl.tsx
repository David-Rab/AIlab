// Model v3 E11 / UB-9 / UB-C: SAFETY › Safeguards' footholds card (HOME of every foothold the lab knows of: symptoms of
// suspected ones with where a case could look, located ones with the remove response, removed ones as history) and the
// framework package button. The AI staff safeguards themselves live in SafetySafeguards.tsx (UB-C). Reads footholdView
// only: never a hidden foothold.
import { PACKAGE_LABEL, packageMeets } from '../../../engine/v2/safety/packages';
import { dateOf, fmtDate, footholdView, versionById } from '../../../engine/v2';
import type { FootholdRow, GameStateV2 } from '../../../engine/v2';
import { TRAIT_BY_ID } from '../../../data/v2/traits';
import { ActBtn, Term, Tip, TipCard } from '../ui';
import { Card, Ref } from '../kit';
import * as F from '../fmt';
import { FOOTHOLD_ICON, ICON } from '../icons';

const AGENTS = { panel: 'lab', tab: 'work', anchor: 'agents' } as const;

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
