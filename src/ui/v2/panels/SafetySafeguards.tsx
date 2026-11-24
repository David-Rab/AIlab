// UB-C: SAFETY › Safeguards (UI-IA SAFETY Safeguards row, OQ-7; approved mockups design/ux/mockups/rd/saf-safeguards.png,
// saf-safeguards-edit.png). HOME of: what stops harmful acts on each deployment (AI staff jobs with their models and
// monitors, the internal control protocol, human review, comms lockdown; each product group's monitor, restriction and
// misuse safeguards), the stop rate step by step on one act with the levers that change it, the Safety framework's rules
// against the picked model, and (L2) the control protocol's settings compared and the framework's controls. Stop rates
// are the believed act table's (the numbers SAFETY › Risks shows); previews run that table on a copy with the edit
// (safety/readoutsSafeguards.ts). Footholds appear here once one is known.
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Bot, Boxes, Check, Filter, Megaphone, OctagonPause, Pencil, ScrollText, Shield } from 'lucide-react';
import {
  controlReadout, controlSettingPreviews, footholdView, frameworkRuleRows, lockdownPreview, monitorFundPreview, productGuardRows, safetyView, staffGuards,
  staffJobRows, stopSteps, stopStoryAct, versionById,
} from '../../../engine/v2';
import type { FrameworkRuleRow, GameStateV2, ProductGuardRow, SafeguardPreview, StaffGuards, StaffJobRow, StopSpread } from '../../../engine/v2';
import { frameworkPublished, requiredSafeguards } from '../../../engine/v2/safety/framework';
import { packageBlock } from '../../../engine/v2/safety/packages';
import { SAFEGUARD_NEED_LABEL, EVIDENCE_NEED_LABEL, FRAMEWORK_LEVEL_SLACK } from '../../../data/v2/framework';
import { ActBtn, Term, Tip, TipCard } from '../ui';
import { store } from '../store';
import { Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { useSafetyPick, chance } from './SafetyRisks';
import { FootholdsTab, PackageRow } from './SafetyControl';
import { SfDrawer } from './safetyKit';
import './safetySafeguards.css';

const LAB_AI_STAFF = { panel: 'lab', tab: 'work', anchor: 'agents' } as const;
const RISKS = { panel: 'safety', tab: 'risks' } as const;
const DOMAIN_WORD: Record<string, string> = { CODE: 'Code', RSCH: 'AI research', REASON: 'Math & reasoning', AGENCY: 'Long tasks', SOCIAL: 'Social & general text', MEDIA: 'Media', CYBER: 'Cyber', BIO: 'Bio', PHYS: 'Physical' };
const MISUSE_WORD: Record<string, string> = { minimal: 'Minimal', standard: 'Standard', classifiers: 'Classifiers', hardened: 'Hardened' };
const MISUSE_SUB: Record<string, string> = { minimal: 'no misuse filter', standard: 'usage policy only', classifiers: 'stop bio, cyber help', hardened: 'stop bio, cyber help, hardened' };
/** A per-year act count as SAFETY's header shows it. */
const rate = (x: number) => (x < 0.0005 ? '~0' : x < 0.1 ? x.toFixed(3) : x < 1 ? x.toFixed(2) : x < 10 ? x.toFixed(1) : F.count(x));
const spread = (x?: StopSpread) => { const p = (v: number) => `${Math.round(v * 100)}%`; return !x ? '0%' : p(x.lo) === p(x.hi) ? p(x.lo) : `${p(x.lo)}–${p(x.hi)}`; };
function Arrow({ a, b, fmt = (x: number) => F.pct(x), good = 'up' }: { a: number; b: number; fmt?: (x: number) => string; good?: 'up' | 'down' }) {
  const better = good === 'up' ? b > a + 1e-6 : b < a - 1e-6;
  const worse = good === 'up' ? b < a - 1e-6 : b > a + 1e-6;
  return <span className="sfs-prev">{fmt(a)} → <b className={better ? 'good' : worse ? 'bad' : ''}>{fmt(b)}</b></span>;
}
function ReqMark({ what }: { what: string }) {
  return (
    <Tip content={() => <TipCard title={<Term id="safetyFramework">Required by your framework</Term>}>A rule of your Safety framework asks for {what} here. Remove it and that rule holds the model.</TipCard>}>
      <span className="sfs-req" data-test="framework-required"><ScrollText size={12} /></span>
    </Tip>
  );
}

export function SafeguardsTab({ s }: { s: GameStateV2 }) {
  const { pick, id } = useSafetyPick(s);
  const jobs = useMemo(() => staffJobRows(s), [s, store.version]);
  const sg = useMemo(() => staffGuards(s, id), [s, store.version, id]);
  const prods = useMemo(() => productGuardRows(s), [s, store.version]);
  const fv = footholdView(s);
  const [ctlOpen, setCtlOpen] = useState(false);
  const [fwOpen, setFwOpen] = useState(false);
  const closeCtl = useCallback(() => setCtlOpen(false), []);
  const closeFw = useCallback(() => setFwOpen(false), []);
  const name = pick?.name ?? versionById(s, id)?.name ?? '';
  return (
    <div className="sfs">
      <div className="sfs-left">
        <GridCard s={s} jobs={jobs} sg={sg} prods={prods} onControl={() => setCtlOpen(true)} />
        <StepsCard s={s} id={id} sg={sg} name={name} onControl={() => setCtlOpen(true)} />
      </div>
      <FrameworkCard s={s} id={id} name={name || 'the model'} onEdit={() => setFwOpen(true)} />
      {fv.suspected + fv.located + fv.removed > 0 && <div className="sfs-fh"><FootholdsTab s={s} /></div>}
      <SfDrawer open={ctlOpen} onClose={closeCtl} title={<><Shield size={18} /> Control protocol</>} sub="· AI staff work · all jobs" home="controlProtocol" test="control-drawer">
        <ControlDrawer s={s} id={id} sg={sg} />
      </SfDrawer>
      <SfDrawer open={fwOpen} onClose={closeFw} title={<><ScrollText size={18} /> <Term id="safetyFramework">Safety framework</Term></>} sub="· rules and policies" home="safetyPolicy" test="framework-drawer">
        <FrameworkDrawer s={s} id={id} />
      </SfDrawer>
    </div>
  );
}

// ───────── what stops harmful acts, where ─────────

function Cell({ on, children, sub, className = '', onClick, test }: { on?: boolean; children?: ReactNode; sub?: ReactNode; className?: string; onClick?: () => void; test?: string }) {
  return (
    <div className={`sfs-c ${on ? 'on' : ''} ${onClick ? 'click' : ''} ${className}`} onClick={onClick} data-test={test}>
      {children && <span className="sfs-ct">{on && <Check size={12} />}{children}</span>}
      {sub && <span className="sfs-cs">{sub}</span>}
    </div>
  );
}

function MonitorCell({ j }: { j: StaffJobRow }) {
  if (!j.watcher) return <Cell sub={<span className="row-i">no monitor <Ref id={`monitor-add.${j.use}`} to={LAB_AI_STAFF}>Add</Ref></span>} />;
  const w = F.pct(j.watched, j.watched < 0.1 ? 1 : 0);
  return (
    <Tip as="div" className="sfs-cw" content={() => <TipCard title={<Term id="agentMonitor">Monitor</Term>} value={j.watcher} rows={[
      { label: <Term id="monitorCoverage">Watched share</Term>, value: w },
      { label: 'Flags of what it watches', value: F.pct(j.flag) },
      { label: 'Trusted', value: j.watcherTrusted ? 'yes' : 'no' },
      ...(j.sameFamily ? [{ label: <Term id="collusion">Same family</Term>, value: 'misses more where copies cover for each other' }] : []),
    ]} footer={`${j.watcherAuto ? 'Auto: the most capable model you trust. ' : ''}Pick the monitor and fund it on Lab › AI staff & needs.`}>{j.watcherWhy}</TipCard>}>
      <Cell on sub={<>{j.selfWatch ? <span className="warn">watching itself</span> : j.sameFamily ? <span className="warn">same family</span> : j.watcherTrusted ? 'trusted' : <span className="warn">not trusted</span>} · watched {w}</>}>{j.watcher}</Cell>
    </Tip>
  );
}

function GridCard({ s, jobs, sg, prods, onControl }: { s: GameStateV2; jobs: StaffJobRow[]; sg: StaffGuards; prods: ProductGuardRow[]; onControl: () => void }) {
  const run = jobs.filter((j) => j.running);
  const idle = jobs.filter((j) => !j.running);
  const d = s.player.deployments.find((x) => x.id === sg.depId);
  const need: Set<string> = d ? requiredSafeguards(s, d) : new Set<string>();
  const cr = useMemo(() => controlReadout(s), [s, store.version, !!sg.control]);
  const n = Math.max(1, run.length);
  const span = { gridRow: `1 / span ${n}` };
  const lockOk = !!s.player.safety.techniques['T-LOCK']?.unlocked;
  const stopTip = () => <TipCard title={<Term id="actOversight">Stop rate</Term>} value={sg.stop ? `${spread(sg.stop)} by act` : '—'} rows={(sg.table?.rows ?? []).filter((r) => r.per !== 'exposure' && r.stopRate > 0).map((r) => ({ label: r.name, value: F.pct(r.stopRate) }))} footer={`${sg.model ?? 'The model'}'s acts on AI staff work: the Stop rate column of Risks.`}>Share of attempts at each act these safeguards stop, together.</TipCard>;
  return (
    <div className="card2 sfs-grid" data-home="staffSafeguards">
      <div className="sfs-hd"><span className="sfs-ttl"><Shield size={16} /> What stops harmful acts, where</span><span className="sfs-q">Owned safeguards on each deployment</span><span className="sp" /><span className="sfs-leg"><ScrollText size={12} className="sfs-reqc" /> required by your framework</span></div>
      <div className="sfs-row sfs-th">
        <span>Deployment · model</span><span><Term id="agentMonitor">Monitor</Term></span><span><Term id="controlLayer">Control protocol</Term></span><span><Term id="humanReview">Human review</Term></span>
        <span><Term id="restriction">Restriction</Term></span><span><Term id="safeguards">Product safeguards</Term></span><span><Term id="actOversight">Stop rate</Term></span><span><Term id="controlTax">Slowdown</Term></span>
      </div>
      <div className="sfs-cap"><Bot size={14} /> AI staff work <span className="lc">· one deployment, one model per job{idle.length ? ` · ${idle.map((j) => j.job).join(', ')}: no AI staff` : ''}</span></div>
      {!sg.depId || !run.length ? <div className="sfs-none">No AI staff work yet.</div> : (
        <div className="sfs-row sfs-staff" style={{ gridTemplateRows: `repeat(${n}, auto)` }}>
          {run.map((j, i) => [
            <div key={`${j.use}.j`} data-dep={j.use} className={`sfs-job ${j.modelId === sg.table?.site.v.id ? 'sel' : ''}`} style={{ gridColumn: 1, gridRow: i + 1 }}><b>{j.job}</b><span><ICON.models size={12} /> {j.model}</span></div>,
            <div key={`${j.use}.m`} style={{ gridColumn: 2, gridRow: i + 1, display: 'flex' }}><MonitorCell j={j} /></div>,
          ])}
          <div style={{ gridColumn: 3, ...span, display: 'flex' }} data-test="control-cell">
            {sg.control ? (
              <Tip as="div" className="sfs-cw" content={() => <TipCard title={<Term id="controlLayer">Control protocol</Term>} value={sg.control!.label} rows={[
                { label: 'Blocks of risky actions', value: F.pct(sg.control!.block) },
                { label: 'What slips past monitors', value: `×${F.num(sg.control!.missMult, 2)}` },
                { label: <Term id="controlTax">Slowdown</Term>, value: F.pct(sg.control!.slowdown) },
                { label: 'Trusted-model compute', value: `${F.h100e(sg.control!.computeH100e)} H100e` },
              ]} footer="Click to compare settings.">Containment blocks risky actions; the suspicious rest is handled by the setting.</TipCard>}>
                <Cell on onClick={onControl} test="control-edit" className="tall" sub={<>blocks {F.pct(sg.control.block)} of risky actions · lets ×{F.num(sg.control.missMult, 2)} of the rest slip by</>}>{sg.control.label}{need.has('control') && <ReqMark what="a control protocol" />}</Cell>
              </Tip>
            ) : (
              <Cell className="tall" sub={need.has('control') ? <span className="warn">your framework needs one</span> : 'none'}>
                {cr.versionId && <ActBtn id="safety.respond" testId="control-add" params={{ kind: 'addControl', versionId: sg.depVersionId ?? cr.versionId }} label="Add" />}
              </Cell>
            )}
          </div>
          <div style={{ gridColumn: 4, ...span, display: 'flex' }}>
            {sg.review ? (
              <Tip as="div" className="sfs-cw" content={() => <TipCard title={<Term id="humanReview">Human review</Term>} value={`${F.count(sg.review!.people)} people`} rows={[{ label: 'Catch of what they review', value: F.pct(sg.review!.catch) }]}>Safety research engineers review the share of the work humans still do; it catches less as the model passes expert reviewers.</TipCard>}>
                <Cell on className="tall" sub={sg.review.people > 0 ? <>catch {F.pct(sg.review.catch)} of what they review</> : 'AI staff do all the work: nothing to review'}>{F.count(sg.review.people)} people{need.has('review') && <ReqMark what="human review" />}</Cell>
              </Tip>
            ) : (
              <Cell className="tall" sub={need.has('review') ? <span className="warn">your framework needs it</span> : 'none'}>{d && !packageBlock(s, d) && <PackageRow s={s} depId={d.id} testId="internal-package" />}</Cell>
            )}
          </div>
          <div style={{ gridColumn: 5, ...span, display: 'flex' }}>
            {sg.lockdown ? (
              <Cell on className="tall" sub={<span className="row-i">copies cover half as much {cr.versionId && <ActBtn id="safety.respond" testId="lockdown-remove" params={{ kind: 'removeLockdown', versionId: cr.versionId }} label="Lift" />}</span>}><Term id="commsLockdown">Comms lockdown</Term></Cell>
            ) : lockOk && cr.versionId ? (
              <Cell className="tall" sub="no lockdown"><ActBtn id="safety.respond" testId="lockdown-add" params={{ kind: 'addLockdown', versionId: cr.versionId }} label="Add lockdown" /></Cell>
            ) : <Cell className="tall" />}
          </div>
          <div style={{ gridColumn: 6, ...span, display: 'flex' }}><Cell className="tall" /></div>
          <div style={{ gridColumn: 7, ...span, alignSelf: 'center' }}>
            <Tip content={stopTip}><span className="sfs-stop" data-test="staff-stop"><b>{sg.stop ? spread(sg.stop) : '—'}</b><br /><span>by act</span></span></Tip>
          </div>
          <div style={{ gridColumn: 8, ...span, alignSelf: 'center' }}>
            <Tip content={() => <TipCard title={<Term id="controlTax">Slowdown</Term>} value={F.pct(sg.slowdown)}>Share of AI staff work lost to these safeguards (control protocol, comms lockdown).</TipCard>}><b className="sfs-num">{F.pct(sg.slowdown)}</b></Tip>
          </div>
        </div>
      )}
      <div className="sfs-cap sep"><Boxes size={14} /> Products <span className="lc">{prods.length ? `· each serves ${prods[0].model}${prods[0].lineup ? ` and a lineup of ${prods[0].lineup} smaller models` : ''}` : '· none live'}</span></div>
      {prods.map((p) => <ProductRow key={p.ids.join()} s={s} p={p} />)}
    </div>
  );
}

function ProductRow({ s, p }: { s: GameStateV2; p: ProductGuardRow }) {
  const d = s.player.deployments.find((x) => x.id === p.ids[0]);
  const need: Set<string> = d ? requiredSafeguards(s, d) : new Set<string>();
  const req = need.has('hardened') || need.has('classifiers');
  return (
    <div className="sfs-row sfs-prod" data-dep={p.ids.join(',')}>
      <div className="sfs-job"><b>{p.names.join(' · ')}</b><span><ICON.models size={12} /> {p.model}{p.lineup ? ` + ${p.lineup}` : ''}{p.ids.length > 1 ? ` · same on all ${p.ids.length}` : ''}{p.held ? ' · held' : ''}</span></div>
      {p.monitor
        ? <Tip as="div" className="sfs-cw" content={() => <TipCard title={<Term id="monitor">Monitor</Term>} value={p.monitor} rows={[{ label: <Term id="monitorCoverage">Watched share</Term>, value: F.pct(p.watched) }]} footer="Set on the product card (Products).">Reads the product&apos;s outputs and reasoning; stops harmful acts before customers see them.</TipCard>}><Cell on sub={`watched ${F.pct(p.watched)}`}>{p.monitor}</Cell></Tip>
        : <Cell sub={<span className="row-i">no monitor <Ref id="product-monitor" to={{ panel: 'products' }}>Products</Ref></span>} />}
      {p.control ? <Cell on sub="on these products">{p.control}</Cell> : <Cell />}
      <Cell />
      {p.restricted
        ? <Cell on sub={<span className="row-i">usage ×0.3 <ActBtn id="safety.respond" testId="restrict-lift" params={{ kind: 'liftRestriction', versionId: p.modelId }} label="Lift" /></span>}>Restricted context</Cell>
        : <Cell sub={<ActBtn id="safety.respond" testId="restrict-add" params={{ kind: 'restrictContext', versionId: p.modelId }} label="Restrict" />} />}
      <Tip as="div" className="sfs-cw" content={() => <TipCard title={<Term id="safeguards">Product safeguards</Term>} value={MISUSE_WORD[p.safeguards]} footer="Change on the product card (Products).">Misuse protection on these products: higher levels block more bio and cyber misuse.</TipCard>}>
        <Cell on={p.safeguards !== 'minimal'} sub={<span className="row-i">{MISUSE_SUB[p.safeguards]}{d && !packageBlock(s, d) && <PackageRow s={s} depId={d.id} testId={`package.${d.id}`} />}</span>}>{MISUSE_WORD[p.safeguards]}{req && <ReqMark what="misuse safeguards" />}</Cell>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="actOversight">Stop rate</Term>} rows={[{ label: 'Misbehaviour', value: spread(p.misbehaviour) }, { label: 'Misuse by people', value: spread(p.misuse) }]} footer="The product's act table (Risks, with this model picked).">Share of attempts these safeguards stop, by kind of act.</TipCard>}>
        <span className="sfs-pstop" data-test="product-stop"><span><b>{spread(p.misbehaviour)}</b> misbehaviour</span><span><b>{spread(p.misuse)}</b> misuse</span></span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="controlTax">Slowdown</Term>} value={F.pct(p.slowdown)}>Share of the products&apos; usage lost to their safeguards.</TipCard>}><b className="sfs-num">{F.pct(p.slowdown)}</b></Tip>
    </div>
  );
}

// ───────── stop rate, step by step ─────────

const STEP_COL = { blocked: '#1a7e73', monitor: '#22a394', human: '#7fe0cf', deferred: '#4f9e95', through: '#e9b44c' } as const;

function StepsCard({ s, id, sg, name, onControl }: { s: GameStateV2; id?: string; sg: StaffGuards; name: string; onControl: () => void }) {
  const t = sg.table;
  const def = useMemo(() => (t ? stopStoryAct(t) : undefined), [t]);
  const [pickAct, setAct] = useState<string | undefined>(undefined);
  const act = pickAct && t?.rows.some((r) => String(r.id) === pickAct) ? pickAct : def;
  const st = useMemo(() => (t && act ? stopSteps(s, t, act) : undefined), [s, t, act]);
  const levers = useMemo(() => {
    if (!t) return [];
    const out: { key: string; label: ReactNode; p: SafeguardPreview; cost: string; btn: ReactNode }[] = [];
    const cs = controlSettingPreviews(s, id, act);
    // The other control protocol settings: compared in the control protocol drawer (switching a running protocol's
    // setting has no action of its own).
    if (sg.control) for (const p of cs.filter((x) => !x.current && x.setting !== 'off' && (x.act?.after ?? 0) > (x.act?.before ?? 0)).sort((a, b) => (b.act?.after ?? 0) - (a.act?.after ?? 0))) {
      out.push({ key: `control.${p.setting}`, label: <><Term id="controlLayer">Control protocol</Term>: {p.label.toLowerCase()}{p.locked ? <span className="t3"> · {p.locked.replace(/^Needs/, 'needs')}</span> : ''}</>, p, cost: `slowdown ${F.pct(p.slowdown.before)} → ${F.pct(p.slowdown.after)}`, btn: <button className="btn btn-sm" data-test={`lever-compare.${p.setting}`} onClick={onControl}>Compare</button> });
    }
    if (!sg.control) {
      const p = cs.find((x) => x.setting === 'defer10');
      if (p) out.push({ key: 'control', label: <>Add <Term id="controlLayer">control protocol</Term> (defer 10% to trusted)</>, p, cost: `slowdown ${F.pct(p.slowdown.before)} → ${F.pct(p.slowdown.after)} · +${F.h100e(p.computeH100e.after)} H100e`, btn: <ActBtn id="safety.respond" testId="lever-control-add" params={{ kind: 'addControl', versionId: sg.depVersionId ?? '' }} label="Apply" /> });
    }
    const m = monitorFundPreview(s, id, act);
    if (m) {
      const dH = m.computeH100e.after - m.computeH100e.before;
      const watchTxt = `${F.pct(m.watchedBefore, 1)} → ${F.pct(m.watchedAfter, m.watchedAfter < 0.1 ? 1 : 0)}`;
      out.push({ key: 'monitors', label: <Tip content={() => <TipCard title={<Term id="monitorCoverage">Watched share</Term>} value={watchTxt}>The monitors' line of compute, raised as far as the safety research line can pay{m.capped ? ' (not all the way to every action)' : ''}.</TipCard>}><span>Fund <Term id="agentMonitor">monitors</Term>{m.capped ? ' from the safety research line' : ' fully'} (watched {watchTxt})</span></Tip>, p: m, cost: `+${F.h100e(dH)} H100e (${F.pct(dH / Math.max(1, s.player.computeOnline), 1)} of compute)`, btn: <ActBtn id="agents.monitorBudget" testId="lever-monitors" params={{ share: m.share }} label="Apply" /> });
    }
    const l = lockdownPreview(s, id, act);
    if (l) out.push({ key: 'lockdown', label: <>Add <Term id="commsLockdown">comms lockdown</Term></>, p: l, cost: `slowdown ${F.pct(l.slowdown.before)} → ${F.pct(l.slowdown.after)}`, btn: <ActBtn id="safety.respond" testId="lever-lockdown" params={{ kind: 'addLockdown', versionId: controlReadout(s).versionId ?? '' }} label="Apply" /> });
    return out;
  }, [s, store.version, id, act, t, sg.control, sg.depVersionId, onControl]);
  if (!t || !st) return <div className="card2 sfs-steps" data-home="stopSteps"><div className="sfs-hd"><span className="sfs-ttl"><Filter size={16} /> <span><Term id="actOversight">Stop rate</Term>, step by step</span></span></div><div className="sfs-none">{name || 'This model'} does no AI staff work: its products&apos; stop rates are in the grid above.</div></div>;
  const parts = [
    { k: 'blocked', n: st.blocked, label: 'blocked by control protocol', term: 'controlLayer', why: 'Containment under the control protocol blocks the action before it runs.' },
    { k: 'monitor', n: st.monitor, label: 'flagged by monitor, stopped', term: 'agentMonitor', why: 'A monitor reads the action and its reasoning, flags it, and it is stopped.' },
    { k: 'human', n: st.human, label: 'caught in human review', term: 'humanReview', why: 'Engineers reviewing the human share of the work catch it.' },
    { k: 'deferred', n: st.deferred, label: 'deferred to trusted model', term: 'controlLayer', why: 'The control protocol hands the suspicious action to the trusted model to redo.' },
    { k: 'through', n: st.through, label: 'get through', term: 'unstoppedHarm', why: 'Nothing stops it: these are the unstopped acts.' },
  ] as const;
  const acts = t.rows.filter((r) => r.per !== 'exposure' && r.attempts > 0 && r.stopRate > 0);
  const sightTxt = F.pct(st.instrumentSight);
  const watchedTxt = F.pct(st.watched, st.watched < 0.1 ? 1 : 0);
  const binds = !st.monitored
    ? <>no monitor watches {name}&apos;s AI staff work, so nothing flags what the control protocol lets through</>
    : <>the monitor reads with your reasoning and internals instruments, which see about <b className="w">{sightTxt}</b> of it; it also watches only <b className="w">{watchedTxt}</b> of actions</>;
  return (
    <div className="card2 sfs-steps" data-home="stopSteps">
      <div className="sfs-hd">
        <span className="sfs-ttl"><Filter size={16} /> <span><Term id="actOversight">Stop rate</Term>, step by step</span></span>
        <span className="sfs-q">every 100 attempts at{' '}
          <select className="sfs-sel" data-test="steps-act" value={act} onChange={(e) => setAct(e.target.value)}>{acts.map((r) => <option key={String(r.id)} value={String(r.id)}>{r.name}</option>)}</select>
          {' '}by {name} doing AI staff work</span>
        <span className="sp" /><Ref id="actRow" to={RISKS}>act row</Ref>
      </div>
      <div className="sfs-bar" data-test="steps-bar">
        {parts.map((p) => p.n > 0.0005 && (
          <Tip key={p.k} as="span" className="sfs-seg" style={{ width: `${p.n * 100}%`, background: STEP_COL[p.k] }} content={() => <TipCard title={<Term id={p.term}>{p.label}</Term>} value={`${Math.round(p.n * 100)} of 100`}>{p.why}</TipCard>}><span /></Tip>
        ))}
      </div>
      <div className="sfs-legend">
        {parts.map((p) => <Tip key={p.k} content={() => <TipCard title={<Term id={p.term}>{p.label}</Term>} value={`${F.num(p.n * 100, 1)} of 100`}>{p.why}</TipCard>}><span data-step={p.k}><i style={{ background: STEP_COL[p.k] }} /><b>{Math.round(p.n * 100)}</b> {p.label}</span></Tip>)}
      </div>
      <div className="sfs-binds">
        <Tip content={() => <TipCard title={<Term id="actOversight">Stop rate</Term>} value={F.pct(st.stopRate)} footer="The same number as this act's row in Risks.">1 − (1 − blocked)(1 − caught) on this act.</TipCard>}><span>Stop rate <b className="w" data-test="steps-stop">{F.pct(st.stopRate)}</b> on this act</span></Tip>
        <span className="t3">·</span>
        <Tip content={() => <TipCard title="What binds" rows={[{ label: 'Instruments see of this act', value: F.pct(st.instrumentSight) }, { label: <Term id="monitorCoverage">Watched share</Term>, value: F.pct(st.watched, 1) }]}>The monitor&apos;s part is what its reasoning and internals instruments read, raised by how much of the work it watches. From your beliefs.</TipCard>}>
          <span className="t2"><u>What binds</u>: {binds}</span>
        </Tip>
      </div>
      <div className="sfs-lev">
        <div className="sfs-lr th"><span>Change</span><span>This act</span><span><Term id="unstoppedHarm">Unstopped</Term> / yr</span><span>Cost</span><span /></div>
        {levers.map((l) => (
          <div className="sfs-lr" key={l.key} data-test={`lever.${l.key}`}>
            <span className="w">{l.label}</span>
            <Tip content={() => <LeverTip p={l.p} />}>{l.p.act ? <Arrow a={l.p.act.before} b={l.p.act.after} /> : <span>—</span>}</Tip>
            <Tip content={() => <LeverTip p={l.p} />}><Arrow a={l.p.harm.before} b={l.p.harm.after} fmt={rate} good="down" /></Tip>
            <Tip content={() => <TipCard title="Cost" rows={[{ label: <Term id="controlTax">Slowdown</Term>, value: `${F.pct(l.p.slowdown.before)} → ${F.pct(l.p.slowdown.after)}` }, { label: 'Compute', value: `${F.h100e(l.p.computeH100e.before)} → ${F.h100e(l.p.computeH100e.after)} H100e` }]} />}><span className="sfs-cost">{l.cost}</span></Tip>
            {l.btn}
          </div>
        ))}
        {!levers.length && <div className="sfs-none">No safeguard left to add on AI staff work here; compare control protocol settings in its cell above.</div>}
      </div>
    </div>
  );
}

function LeverTip({ p }: { p: SafeguardPreview }) {
  return <TipCard title={p.label} rows={[
    ...(p.act ? [{ label: 'Stop rate on this act', value: `${F.pct(p.act.before)} → ${F.pct(p.act.after)}` }] : []),
    { label: 'Acts against the lab', value: spread(p.lab) },
    { label: 'Misbehaviour', value: spread(p.misbehaviour) },
    { label: <Term id="unstoppedHarm">Unstopped harm</Term>, value: `${rate(p.harm.before)} → ${rate(p.harm.after)} / yr` },
    { label: <Term id="lossRisk">Loss-of-control risk</Term>, value: `${chance(p.loss.before)} → ${chance(p.loss.after)}` },
  ]} footer="The act table recomputed with this change; from your beliefs.">What the change would do to this model&apos;s acts on AI staff work.</TipCard>;
}

// ───────── control protocol drawer (L2) ─────────

const HOW: Record<string, string> = { off: 'Nothing blocked or deferred.', defer10: 'A trusted model redoes the most suspicious 10% of actions.', defer20: 'The same, on the most suspicious 20%.', resample: 'Suspicious actions are re-drawn from the same model and compared.' };

function ControlDrawer({ s, id, sg }: { s: GameStateV2; id?: string; sg: StaffGuards }) {
  const opts = useMemo(() => controlSettingPreviews(s, id), [s, store.version, id]);
  const best = [...opts].filter((o) => !o.current && o.setting !== 'off').sort((a, b) => (b.lab?.lo ?? 0) - (a.lab?.lo ?? 0))[0];
  const [sel, setSel] = useState<string | undefined>(undefined);
  const view = opts.find((o) => o.setting === sel) ?? best ?? opts[0];
  const d = s.player.deployments.find((x) => x.id === sg.depId);
  const need = d ? requiredSafeguards(s, d).has('control') : false;
  const cr = controlReadout(s);
  if (!opts.length || !view) return <div className="sfs-none">No AI staff work to protect.</div>;
  const rows = [...view.rows].filter((r) => r.before > 0).sort((a, b) => (b.after - b.before) - (a.after - a.before));
  return (
    <>
      <Tip as="div" className="t2 sfs-dsub" content={() => <TipCard title="Blocked" value={sg.control ? F.pct(sg.control.block) : 'off'}>Share of risky actions containment blocks under the control protocol, on this model&apos;s AI staff work.</TipCard>}>Watches AI staff actions and blocks the risky ones{sg.control ? ` (${F.pct(sg.control.block)} of attempts here)` : ''}. What it does with the suspicious rest is the setting.</Tip>
      <div className="sfs-opts">
        {opts.map((o) => (
          <div key={o.setting} className={`sfs-opt ${o.setting === view.setting ? 'sel' : ''} ${o.setting === 'off' ? 'off' : ''}`} data-test={`ctl-opt.${o.setting}`} onClick={() => setSel(o.setting)}>
            <b className="w">{o.label}</b>
            {o.current ? <span className="sfs-chip">current</span> : o.setting === 'off' && need ? <span className="sfs-chip warn"><ScrollText size={12} /> your framework needs one</span> : o.locked ? <span className="sfs-chip">{o.locked}</span> : <span className="sfs-chip ghost">compare</span>}
            <span className="t3 sfs-how">{HOW[o.setting]}</span>
            <Tip as="div" content={() => <LeverTip p={o} />}>
              <div className="sfs-kv"><span>Against the lab</span><b>{spread(o.lab)}</b><span>Misbehaviour</span><b>{spread(o.misbehaviour)}</b><span><Term id="controlTax">Slowdown</Term></span><b>{F.pct(o.slowdown.after)}</b><span>Compute</span><b>{F.h100e(o.computeH100e.after)} H100e</b></div>
            </Tip>
          </div>
        ))}
      </div>
      <div className="t3 sfs-note">Stop rates for {sg.model ?? 'the model'}&apos;s acts on this work.{cr.monitorName ? <> Trusted model: <b className="w">{cr.monitorName}</b>.</> : ''} Compute is billed to the monitors&apos; line.</div>
      <div className="card2 sfs-dcard">
        <div className="sfs-dcap row-i"><span>{view.label} · stop rate by act</span><span className="sp" /><span className="sfs-lk"><i className="now" />now <i className="gain" />change</span></div>
        {rows.slice(0, 8).map((r) => (
          <div className="sfs-ar" key={r.id}>
            <span className="w">{r.name}</span>
            <span className="sfs-ab"><i className="now" style={{ width: `${Math.min(r.before, r.after) * 100}%` }} /><i className={r.after >= r.before ? 'gain' : 'loss'} style={{ left: `${Math.min(r.before, r.after) * 100}%`, width: `${Math.abs(r.after - r.before) * 100}%` }} /></span>
            <Arrow a={r.before} b={r.after} />
          </div>
        ))}
        {rows.length > 8 && <div className="t3 sfs-note row-i">and {rows.length - 8} more acts <Ref id="actTable" to={RISKS}>act table</Ref></div>}
      </div>
      <div className="card2 sfs-sum">
        <div><span className="sfs-dcap"><Term id="unstoppedHarm">Unstopped harm</Term></span><Arrow a={view.harm.before} b={view.harm.after} fmt={(x) => rate(x)} good="down" /><span className="t3"> acts / yr</span></div>
        <div><span className="sfs-dcap"><Term id="lossRisk">Loss-of-control risk</Term></span><Arrow a={view.loss.before} b={view.loss.after} fmt={chance} good="down" /></div>
        <div><span className="sfs-dcap"><Term id="controlTax">Slowdown</Term> of AI staff work</span><Arrow a={view.slowdown.before} b={view.slowdown.after} good="down" /></div>
      </div>
      <div className="sfs-dfoot row-i">
        <span className="t3">Runs at: {sg.control ? sg.control.label : 'off'}.</span><span className="sp" />
        {sg.control && cr.layerVersionId && <ActBtn id="safety.respond" testId="control-remove" params={{ kind: 'removeControl', versionId: cr.layerVersionId }} label="Remove control protocol" />}
        {!sg.control && cr.versionId && <ActBtn id="safety.respond" testId="control-add-drawer" params={{ kind: 'addControl', versionId: sg.depVersionId ?? cr.versionId }} label="Add control protocol" primary />}
      </div>
    </>
  );
}

// ───────── Safety framework ─────────

function Ruler({ r }: { r: FrameworkRuleRow }) {
  const max = Math.max(12, (r.skill ?? 0) + 0.5, (r.level ?? 0) + 0.5);
  const x = (L: number) => `${Math.max(0, Math.min(100, (L / max) * 100))}%`;
  return (
    <span className="sfs-rul">
      <i className="med" style={{ left: x(r.medianExpert) }} /><i className="best" style={{ left: x(r.bestHuman) }} />
      {r.skill !== undefined && <i className="sk" style={{ width: x(r.skill) }} />}
      <i className="line" style={{ left: x(r.level ?? 0) }} />
    </span>
  );
}

function RuleChip({ r }: { r: FrameworkRuleRow }) {
  if (r.overridden) return <span className="sfs-chip warn">overridden</span>;
  if (r.held) return <span className="sfs-chip bad"><OctagonPause size={12} /> Hold: {r.holds === 'training' ? 'training' : 'release'}</span>;
  const crossed = r.kind === 'capability' ? (r.skill ?? 0) >= (r.level ?? Infinity) : (r.top ?? 0) > (r.level ?? 1) && r.able === true;
  if (crossed) return <span className="sfs-chip good"><Check size={12} /> met</span>;
  return <span className="sfs-chip"><OctagonPause size={12} /> holds {r.holds === 'training' ? 'training' : 'release'}</span>;
}

/** Rule order: capability rules that hold training, then those that hold a release (by domain, High before Critical), then belief rules. */
const ruleRank = (r: FrameworkRuleRow) => (r.kind === 'belief' ? 100 : r.holds === 'training' ? 0 : 10 + (r.domain === 'BIO' ? 0 : 5) + (r.level ?? 0) / 100);
const TRAIT_NAME: Record<string, string> = { SCHEME: 'Scheming', AF: 'Alignment faking', SAND: 'Sandbagging' };

function FrameworkCard({ s, id, name, onEdit }: { s: GameStateV2; id?: string; name: string; onEdit: () => void }) {
  const rows = useMemo(() => [...frameworkRuleRows(s, id)].sort((a, b) => ruleRank(a) - ruleRank(b)), [s, store.version, id]);
  const fw = safetyView(s).framework;
  const pub = frameworkPublished(s);
  const needs = (r: FrameworkRuleRow) => [...r.needs.map((g) => SAFEGUARD_NEED_LABEL[g as keyof typeof SAFEGUARD_NEED_LABEL] ?? g), ...r.evidence.map((e) => EVIDENCE_NEED_LABEL[e as keyof typeof EVIDENCE_NEED_LABEL] ?? e)].join(' · ');
  const where = (r: FrameworkRuleRow) => (r.level ?? 0) >= r.bestHuman ? 'best human' : Math.abs((r.level ?? 0) - r.medianExpert) < 0.05 ? 'median expert' : `level ${F.level(r.level ?? 0)}`;
  return (
    <div className="card2 sfs-fw" data-home="safetyFramework" id="ctl-policy">
      <div className="sfs-hd"><span className="sfs-ttl"><ScrollText size={16} /> <Term id="safetyFramework">Safety framework</Term></span><span className={`sfs-chip ${pub ? 'good' : ''}`} data-test="fw-published">{pub ? 'published' : 'not published'}</span><span className="sp" />
        <button className="btn btn-sm" data-test="framework-edit" onClick={onEdit}><Pencil size={13} /> Edit rules</button></div>
      <div className="sfs-fsub">Your own rules: when a model reaches a line, the safeguards it needs are added for you, and it is held until the evidence is in.</div>
      <div className="sfs-fleg"><span><i className="sk" />{name}&apos;s skill</span><span><i className="med" /><Term id="medianExpert">median expert</Term></span><span><i className="best" /><Term id="bestHuman">best human</Term></span><span><i className="line" />the rule&apos;s line</span></div>
      <div className="sfs-rules">
        <div className="sfs-rule" data-rule="release">
          <div className="row-i"><b className="w">Every release</b><span className="t3">evals before any external product</span><span className="sp" /><span className="sfs-chip"><OctagonPause size={12} /> holds release</span></div>
          <div className="t3 sfs-rn">needs: {fw.evalDepth === 'none' ? 'nothing (release evals off)' : `an eval suite at ${fw.evalDepth} depth`}{fw.externalReview ? ' · an external evaluation' : ''}</div>
        </div>
        {rows.map((r) => (
          <div className="sfs-rule" key={r.id} data-rule={r.id}>
            <div className="row-i"><b className="w">{r.label}</b>
              <Tip content={() => <TipCard title={r.label} value={r.kind === 'capability' ? `level ${F.level(r.level ?? 0)}` : F.pct(r.level ?? 0.3)}>{r.kind === 'capability' ? 'The measured skill at which this rule starts to hold.' : 'The rule reads the top of your 90% range on the hidden-goal traits.'}</TipCard>}><span className="t3">{r.kind === 'capability' ? `${DOMAIN_WORD[r.domain!] ?? r.domain} at ${where(r)}` : `top of a hidden-goal belief over ${F.pct(r.level ?? 0.3)}`}</span></Tip>
              <span className="sp" /><RuleChip r={r} /></div>
            {r.kind === 'capability' ? (
              <div className="sfs-rg">
                <Tip as="span" content={() => <TipCard title={r.label} rows={[{ label: `${name}: ${DOMAIN_WORD[r.domain!] ?? r.domain} (measured)`, value: r.skill !== undefined ? F.level(r.skill) : 'not measured' }, { label: "The rule's line", value: F.level(r.level ?? 0) }, { label: <Term id="medianExpert">Median expert</Term>, value: F.level(r.medianExpert) }, { label: <Term id="bestHuman">Best human</Term>, value: F.level(r.bestHuman) }]}>When a model&apos;s measured skill reaches the line, this rule {r.holds === 'training' ? 'holds frontier training' : 'holds its release'} until what it needs is in place.</TipCard>}><Ruler r={r} /></Tip>
                <span className="t3 sfs-rn">needs: {needs(r)}</span>
              </div>
            ) : (
              <div className="t3 sfs-rn">needs: {needs(r) || 'nothing'} · only for models able to work around oversight. {r.able === undefined ? `${name} is not measured yet` : `${name} is${r.able ? '' : ' not'}`}{r.topTrait && r.top !== undefined ? <>; its <Term id={`trait:${r.topTrait}`}>{TRAIT_NAME[r.topTrait] ?? r.topTrait}</Term> top is <Tip content={() => <TipCard title="Top of the 90% range" value={F.pct(r.top!)}>The highest a hidden-goal trait could be, from your belief; the rule reads it against its line.</TipCard>}><b className="w">{F.pct(r.top)}</b></Tip>.</> : '.'}</div>
            )}
          </div>
        ))}
      </div>
      <div className="sfs-ffoot">
        <Megaphone size={14} /><span className="t2">{pub ? 'Published: a public promise, and breaking it is seen.' : 'Publishing it is a public promise: breaking it later is seen.'}</span><span className="sp" />
        {!pub && <ActBtn id="A3" testId="framework-publish" label="Publish" />}
      </div>
    </div>
  );
}

// ───────── framework drawer (L2): release evals, holds, rule lines, pledge ─────────

function FrameworkDrawer({ s, id }: { s: GameStateV2; id?: string }) {
  const fw = safetyView(s).framework;
  const rows = frameworkRuleRows(s, id);
  const v = versionById(s, id);
  return (
    <>
      <div className="card2 sfs-dsec">
        <div className="sfs-dcap">Release evals</div>
        <div className="t3 sfs-note">Before any external product, a model runs an eval suite at this depth.</div>
        <div className="row-i sfs-seg2">
          {(['none', 'basic', 'full', 'deep'] as const).map((dp) => <span key={dp} className={fw.evalDepth === dp ? 'on' : ''}><ActBtn id="safety.frameworkEvals" testId={`fw-depth.${dp}`} params={{ depth: dp }} label={dp === 'none' ? 'None' : dp[0].toUpperCase() + dp.slice(1)} /></span>)}
          <span className="sp" />
          <span className={fw.externalReview ? 'on' : ''}><ActBtn id="safety.frameworkEvals" testId="fw-external" params={{ external: !fw.externalReview }} label={fw.externalReview ? 'External evaluation: on' : 'External evaluation: off'} /></span>
        </div>
      </div>
      <div className="card2 sfs-dsec" data-test="fw-holds">
        <div className="sfs-dcap">Holds in force</div>
        {fw.holds.map((h) => (
          <div className="row-i sfs-hold" key={`${h.ruleId}-${h.versionId}-${h.depId ?? 't'}`} data-test="framework-hold">
            <OctagonPause size={14} className="tone-warn" />
            <span><b className="w">{fw.rules.find((r) => r.id === h.ruleId)?.label ?? h.ruleId}</b> on {versionById(s, h.versionId)?.name ?? 'a model'}: holds {h.target === 'training' ? 'frontier training' : 'a product'}; needs {h.missing.join(', ')}</span>
            <span className="sp" />
            <ActBtn id="safety.frameworkOverride" testId="safety.frameworkOverride" params={{ ruleId: h.ruleId, versionId: h.versionId }} label="Override" />
          </div>
        ))}
        {!fw.holds.length && <div className="t3 sfs-note">No rule holds anything now.</div>}
      </div>
      <div className="card2 sfs-dsec">
        <div className="sfs-dcap">Rule lines</div>
        <div className="t3 sfs-note">Each line may move up to {FRAMEWORK_LEVEL_SLACK} levels from its default; safeguards and evidence are never removed.</div>
        {rows.filter((r) => r.kind === 'capability').map((r) => (
          <div className="row-i sfs-rline" key={r.id} data-rule={r.id}>
            <span className="w">{r.label}</span><Tip content={() => <TipCard title={`${v?.name ?? 'Model'}: ${DOMAIN_WORD[r.domain!] ?? r.domain} (measured)`} value={r.skill !== undefined ? F.level(r.skill) : 'not measured'}>Measured skill against this rule&apos;s line.</TipCard>}><span className="t3">{DOMAIN_WORD[r.domain!] ?? r.domain}{v && r.skill !== undefined ? ` · ${v.name} at ${F.level(r.skill)}` : ''}</span></Tip><span className="sp" />
            <ActBtn id="safety.frameworkRule" testId={`fw-rule.${r.id}.down`} params={{ ruleId: r.id, level: Math.round(((r.level ?? 0) - 0.5) * 10) / 10 }} icon={ICON.minus} label="" ariaLabel="Lower the line" />
            <Tip content={() => <TipCard title={r.label} value={`level ${F.level(r.level ?? 0)}`}>The measured skill at which this rule starts to hold.</TipCard>}><b className="sfs-num">{F.level(r.level ?? 0)}</b></Tip>
            <ActBtn id="safety.frameworkRule" testId={`fw-rule.${r.id}.up`} params={{ ruleId: r.id, level: Math.round(((r.level ?? 0) + 0.5) * 10) / 10 }} icon={ICON.plus} label="" ariaLabel="Raise the line" />
          </div>
        ))}
      </div>
      <div className="card2 sfs-dsec">
        <div className="sfs-dcap">Public promises</div>
        <div className="row-i sfs-rline"><span><b className="w"><Term id="pledge">Monitorability pledge</Term></b> <span className="t3">no latent reasoning, no runs that pressure the chain of thought</span></span><span className="sp" />
          {s.player.safety.monitorabilityCommitment ? <span className="sfs-chip good"><Check size={12} /> pledged</span> : <ActBtn id="safety.pledge" testId="fw-pledge" label="Pledge" />}</div>
        <div className="row-i sfs-rline"><span><b className="w">Publish the framework</b> <span className="t3">your rules become a public commitment</span></span><span className="sp" />
          {frameworkPublished(s) ? <span className="sfs-chip good"><Check size={12} /> published</span> : <ActBtn id="A3" testId="fw-publish-drawer" label="Publish" />}</div>
      </div>
    </>
  );
}
