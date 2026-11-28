// Powers (W8b): the three outside powers and what they ask of you, in one screen. Top rail: your prominence and the public
// frontier (what the world has seen, and which US stage each milestone triggers). Cards: the public (concern, approval),
// pledges and obligations, the US government (stage ladder, trust, briefing, laws) and China (lead, tension ladder, talks,
// treaty). Every number has a breakdown on hover; every control sits next to what it changes. Retire lives in the game menu.
import type { ReactNode } from 'react';
import {
  approvalCauses, approvalParts, attentionParts, blockingCommitments, briefingEffect, CHINA_ID, CHINAGOV, chinaWarOdds, chinagovView, concernParts, dateOf,
  fmtDate, frontier, incidentList, keptShare, lawStatus, OBSERVE, PLAYER_ID, publicMilestones, stageProgress, STAGE_NAMES, TALKS_NAMES, talksProgress,
  tensionProgress, TENSION_NAMES, trustCauses, USGOV, usgovView, usLeadOverChinaMonths,
} from '../../../engine/v2';
import type { GameStateV2, StepProgress } from '../../../engine/v2';
import { MILESTONES } from '../../../data/world';
import { ActBtn, Gate, Term, Tip, TipCard } from '../ui';
import { Card, PanelHead, Ref, Spark2 } from '../kit';
import { store } from '../store';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';
import './powers.css';

const labNm = (s: GameStateV2, id: string): string => (id === PLAYER_ID ? 'You' : id === CHINA_ID ? s.china.lab.core.name : s.rivals.find((r) => r.core.id === id)?.core.name ?? 'A rival');
const dateAt = (s: GameStateV2, day: number) => fmtDate(dateOf(s, day));
const signed = (x: number, d = 1) => F.num(x, d, true);
const arrow = (x: number) => (x > 0.05 ? '▲' : x < -0.05 ? '▼' : '=');
const TICK = (ok: boolean) => <span className={ok ? 'tone-pos' : 'dim'}>{ok ? '✓' : '○'}</span>;

/** A small value bar (0..max) used inside breakdown tooltips. */
function Bar({ v, max, color = 'var(--accent)' }: { v: number; max: number; color?: string }) {
  return <span className="pw-tbar"><i style={{ width: `${Math.max(0, Math.min(1, v / max)) * 100}%`, background: color }} /></span>;
}

/** Condition parts of a ladder step: a tick and the words. */
function Parts({ p }: { p: StepProgress }) {
  return (
    <div className="pw-parts">
      <div className="dim small">{p.mode === 'any' ? 'Any one of' : 'All of'}</div>
      {p.parts.map((x, i) => <div key={i} className="pw-part">{TICK(x.met)} <span>{x.text}</span></div>)}
    </div>
  );
}

// ───────── top rail ─────────
/** What each public milestone triggers on the US ladder: milestones 2..5 are the triggers of stages 1..4 (stageProgress). */
const stageOfMilestone = (i: number): number | null => (i >= 2 && i <= 5 ? i - 1 : null);

function Rail({ s }: { s: GameStateV2 }) {
  const board = publicMilestones(s);
  const att = attentionParts(s, PLAYER_ID);
  const applies = att.attention >= USGOV.attentionMin;
  const mine = s.player.milestoneDays as Record<number, number | undefined>;
  return (
    <Card className="pw-rail" home="attention">
      <div className="pw-prom">
        <div className="pw-cap"><Term id="attention">Your prominence</Term></div>
        <Tip content={() => (
          <TipCard title={<Term id="attention">Prominence</Term>} value={F.num(att.attention, 2)} rows={[
            { label: <>Frontier part{att.behindMonths !== null ? ` (${F.num(att.behindMonths, 1)} mo behind the public frontier)` : ' (no public model)'}</>, value: F.num(att.frontier, 2) },
            { label: 'Reach part (share of AI users and customers)', value: F.num(att.reach, 2) },
          ]}>
            The larger of the two parts. Washington’s lab rules apply from {USGOV.attentionMin}; approval pushes are multiplied by it.
          </TipCard>
        )}>
          <span className="pw-bigwrap">
            <b className="pw-big num">{F.num(att.attention, 2)}</b>
            <span className="pw-pbar"><i style={{ width: `${att.attention * 100}%` }} /><u style={{ left: `${USGOV.attentionMin * 100}%` }} /></span>
          </span>
        </Tip>
        <div className="pw-note">{applies ? 'Washington’s rules apply to you' : 'Washington’s rules do not reach you yet'}</div>
      </div>
      <div className="pw-frontier" data-home="publicFrontier">
        <div className="pw-cap">What the world has seen · <Term id="publicFrontier">public frontier</Term></div>
        <div className="pw-track" data-test="ms-track">
          {MILESTONES.filter((m) => m.idx >= 1).map((m, k, all) => {
            const seen = board[m.idx];
            const internal = !seen && mine[m.idx] !== undefined;
            const st = stageOfMilestone(m.idx);
            const sub = [st !== null ? `stage ${st}` : '', m.idx >= 2 ? 'concern +6' : ''].filter(Boolean).join(' · ');
            const who = seen ? seen.lab : null;
            return (
              <Tip key={m.idx} as="div" className="pw-ms" content={() => (
                <TipCard title={m.name} value={seen ? `seen ${dateAt(s, seen.day)}` : internal ? 'yours, internal' : 'not seen yet'} rows={[
                  ...(seen ? [{ label: 'First shown by', value: labNm(s, seen.lab) }] : []),
                  ...(internal ? [{ label: 'You reached it', value: dateAt(s, mine[m.idx]!) }] : []),
                  { label: 'Lifts the US stage', value: st !== null ? `to stage ${st}, ${STAGE_NAMES[st]}` : 'none' },
                  { label: <Term id="concern">Concern</Term>, value: m.idx >= 2 ? `+${F.num(6, 0)} once any lab shows it` : 'no step' },
                ]}>
                  {m.desc} {internal ? 'Washington sees it only through your briefing.' : ''}
                </TipCard>
              )}>
                <div className={`pw-seg ${seen && k < all.length ? 'lit' : ''}`} />
                <div className={`pw-flag ${who === CHINA_ID ? 'cn' : who === PLAYER_ID ? 'you' : 'rv'}`}>{seen ? `SEEN · ${labNm(s, seen.lab).toUpperCase()}` : internal ? 'YOURS · INTERNAL' : ''}</div>
                <span className={`pw-dot ${seen ? (who === CHINA_ID ? 'cn' : who === PLAYER_ID ? 'you' : 'rv') : internal ? 'int' : ''}`} />
                <div className={`pw-msn ${seen || internal ? 'on' : ''}`}>{m.name}</div>
                <div className="pw-mss">{sub || '—'}</div>
              </Tip>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ───────── the public ─────────
function Public({ s }: { s: GameStateV2 }) {
  const c = concernParts(s);
  const a = approvalParts(s);
  const att = attentionParts(s, PLAYER_ID);
  const lic = USGOV.licensingOn + USGOV.concernShift;
  const hit = USGOV.hitlOn + USGOV.concernShift;
  const pos = (x: number) => `${Math.max(0, Math.min(100, x))}%`;
  const dist = (t: number) => (s.public.concern > t ? 'passed' : `${F.num(t - s.public.concern, 0)} below`);
  const incTip = () => {
    const list = incidentList(s).slice(0, 6);
    return (
      <TipCard title={<Term id="incidentHeat">Public incidents</Term>} value={F.num(c.incidentHeat, 1)} rows={list.map((x) => ({
        label: <>{labNm(s, x.lab)} · {dateAt(s, x.day)}</>, value: <>severity {x.severity} · {F.pct(x.left, 0)} left</>,
      }))}>
        Incidents any lab disclosed or leaked, weighted by severity; each fades with a half-life of about {F.num(OBSERVE.incidentHalfLifeDays / 30.4, 0)} months.{!list.length ? ' None now.' : ''}
      </TipCard>
    );
  };
  const approvalLeft = (x: number) => `${50 + Math.max(-100, Math.min(100, x)) / 2}%`;
  const ap = s.public.approval;
  return (
    <Card className="pw-card" title={<span className="row-i"><ICON.public size={15} /> The public</span>} home="concern">
      <div className="pw-gauge">
        <div>
          <div className="pw-cap"><Term id="concern">Concern</Term></div>
          <Tip content={() => (
            <TipCard title={<Term id="concern">Concern</Term>} value={F.idx(c.concern)} footer={<span className="dim">heading to {F.num(c.in90Days, 0)} in 90 days</span>}
              rows={[
                { label: 'Starting level', value: <span className="row-i"><Bar v={c.base} max={Math.max(c.target, 1)} />{F.num(c.base, 0)}</span> },
                { label: <>Milestones the world has seen ({c.milestoneCount})</>, value: <span className="row-i"><Bar v={c.milestones} max={Math.max(c.target, 1)} color="var(--neg)" />{signed(c.milestones, 0)}</span> },
                { label: <>Unemployment rise · 12 mo ({F.num(c.jobsRisePts, 1)} pt)</>, value: <span className="row-i"><Bar v={c.jobs} max={Math.max(c.target, 1)} color="var(--neg)" />{signed(c.jobs)}</span> },
                { label: <Tip className="term" content={incTip}>Public incidents</Tip>, value: <span className="row-i"><Bar v={c.incidents} max={Math.max(c.target, 1)} color="var(--neg)" />{signed(c.incidents)}</span> },
                { label: <b>Where it is heading</b>, value: <b>{F.num(c.target, 1)}</b> },
              ]}>
              Share of the public more worried than excited about AI. It drifts to its target, halving the gap about every three months.
              <div className="pw-sub">What it triggers</div>
              <div className="pw-trig"><span><Term id="lawLicensing">Frontier licensing</Term> · above {lic} for {USGOV.licensingHoldDays} d</span><span className="num">{dist(lic)}</span></div>
              <div className="pw-trig"><span><Term id="lawHitl">Human-in-the-loop</Term> · above {hit} after a scare</span><span className="num">{dist(hit)}</span></div>
            </TipCard>
          )}>
            <span className="pw-bigrow">
              <b className="pw-big num">{F.idx(c.concern)}</b>
              <span className={`pw-trend ${c.change90d > 0.05 ? 'bad' : ''}`}>{arrow(c.change90d)} {F.num(Math.abs(c.change90d), 1)} · 90 d</span>
            </span>
          </Tip>
        </div>
      </div>
      <Tip content={() => <TipCard title={<Term id="concern">Concern, 0 to 100</Term>} value={`heading to ${F.num(c.in90Days, 0)}`}>The marks show where the laws switch on. The triangle is where concern stands in 90 days if nothing changes.</TipCard>}>
        <div className="pw-scale" data-test="concern-scale">
          <div className="pw-sbar"><i style={{ width: pos(c.concern) }} /><u className="hot" style={{ left: pos(lic), width: pos(100 - lic) }} /></div>
          <span className="pw-head" style={{ left: pos(c.in90Days) }}>▲<em>heading to {F.num(c.in90Days, 0)}</em></span>
          {[[50, '50'], [lic, 'licensing'], [hit, 'human mandate']].map(([x, l], i) => (
            <span key={i} className="pw-tick" style={{ left: pos(x as number) }}><b />{i === 2 ? <em className="lo">{l}</em> : <em>{l}</em>}</span>
          ))}
        </div>
      </Tip>
      <div className="pw-gauge ap">
        <div>
          <div className="pw-cap"><Term id="approval">Approval of you</Term></div>
          <Tip content={() => (
            <TipCard title={<Term id="approval">Approval of you</Term>} value={F.idx(ap)} footer={<span className="dim">heading to {F.idx(a.baseline)}, {F.idx(a.in90Days)} in 90 days</span>}
              rows={[
                { label: <>Concern term (−{F.num(0.4, 1)} per point of concern above 50)</>, value: signed(a.concernTerm) },
                { label: <>× <Term id="attention">your prominence</Term></>, value: F.num(att.attention, 2) },
                { label: <b>It drifts toward</b>, value: <b>{signed(a.baseline)}</b> },
                ...approvalCauses(s, 5).map((x) => ({ label: <span className="dim">{dateAt(s, x.day)} · {x.reason}</span>, value: <span className={x.delta < 0 ? 'tone-neg' : 'tone-pos'}>{signed(x.delta)}</span> })),
              ]}>
              What the public thinks of your lab. Your incidents, disclosures and pledges push it, more when you are prominent; it settles toward a baseline that falls as concern rises.
            </TipCard>
          )}>
            <span className="pw-bigrow">
              <b className={`pw-big num ${Math.round(ap) < 0 ? 'neg' : ''}`}>{F.idx(ap)}</b>
              <span className={`pw-trend ${a.drift90d < 0 ? 'bad' : 'good'}`}>{arrow(a.drift90d)} {F.num(Math.abs(a.drift90d), 1)} · 90 d</span>
            </span>
          </Tip>
        </div>
      </div>
      <div className="pw-sbar bi" data-test="approval-bar"><i style={{ left: ap >= 0 ? '50%' : approvalLeft(ap), width: `${Math.abs(ap) / 2}%`, background: ap >= 0 ? 'var(--pos)' : 'var(--neg)' }} /><u className="mid" /></div>
      <div className="pw-axis"><span>−100</span><span>0</span><span>+100</span></div>
      <div className="pw-cap pad">What moves with it</div>
      <div className="row-i pw-links">
        <Ref id="pw-products" to={{ panel: 'products' }}>Product demand</Ref>
        <Ref id="pw-hiring" to={{ panel: 'lab', tab: 'people' }}>Hiring pull</Ref>
        <Ref id="pw-sites" to={{ panel: 'compute' }}>Site opposition</Ref>
      </div>
    </Card>
  );
}

// ───────── pledges and obligations ─────────
const PLEDGE_TERM: Record<string, string> = { testingAgreement: 'pledgePreDeploy', framework: 'pledgeFramework', whistleblower: 'pledgeWhistleblower' };

function Pledges({ s }: { s: GameStateV2 }) {
  const binding = blockingCommitments(s);
  const kept = keptShare(s);
  return (
    <Card className="pw-card grow" home="pledges" title={<span className="row-i"><ICON.commitment size={15} /> <Term id="commitment">Pledges</Term> &amp; obligations</span>}
      right={<Tip content={() => <TipCard title="Pledges kept" value={F.pct(kept)}>Share of your public pledges kept so far.</TipCard>}><span className="small dim">kept <b className="num pw-w">{F.pct(kept)}</b></span></Tip>}>
      <Gate s={s} k="commitments">
        <div className="pw-pledges" data-test="pledges">
          {s.commitments.map((c) => {
            const binds = binding.some((b) => b.id === c.id);
            const t = PLEDGE_TERM[c.kind];
            return (
              <div key={c.id} className={`pw-pl ${binds ? 'bind' : ''} ${c.status === 'broken' ? 'broke' : ''}`} data-test={`pledge-${c.id}`}>
                <Tip content={() => <TipCard title={c.title} value={binds ? 'binding now' : c.status} rows={[{ label: 'Condition', value: F.words(c.condition.predicate) }, { label: 'Signed', value: dateAt(s, c.signedDay) }, { label: 'Amended', value: `${c.amendments}×` }]}>
                  {binds ? 'Its condition holds now. What it forbids is refused at launch; honour, amend or break it here. Breaking it costs approval (× your prominence) and trust.' : 'A public pledge. Breaking it costs approval and trust.'}
                </TipCard>}>
                  <span className="pw-pt">{t ? <Term id={t}>{c.title}</Term> : c.title} <span className={`small ${binds ? 'tone-warn' : c.status === 'broken' ? 'tone-neg' : 'tone-pos'}`}>{binds ? 'binding now' : c.status === 'kept' || c.status === 'live' ? `since ${dateAt(s, c.signedDay)}` : c.status}</span></span>
                </Tip>
                {binds && <span className="row-i" data-test={`binds-${c.id}`}>
                  <ActBtn id="CMT_HONOUR" params={{ cid: c.id }} /><ActBtn id="CMT_AMEND" params={{ cid: c.id }} /><ActBtn id="CMT_BREAK" params={{ cid: c.id }} />
                </span>}
              </div>
            );
          })}
          {!s.commitments.length && <div className="dim small">No pledges yet</div>}
        </div>
      </Gate>
      <div className="pw-cap pad">Make a pledge</div>
      <div className="pw-make" data-test="make-pledge">
        <ActBtn id="A1" testId="A1" inline label="Pre-deploy testing" />
        <ActBtn id="A3" testId="A3" inline label="Publish framework" />
        <ActBtn id="A6" testId="A6" inline label="Whistleblower channel" />
      </div>
      <div className="pw-note">A broken pledge costs approval (× your prominence) and trust.</div>
    </Card>
  );
}

// ───────── US government ─────────
const STAGE_FX = ['no requirements', 'industry security floor', 'staff clearances, officials embedded', 'reviews on your launches', 'labs pooled, or taken over'];
const STAGE_TERM = [null, 'stageSecurity', 'stageClearances', 'stageOversight', 'stageConsolidation'];
const LAW_TERM: Record<string, string> = { sb53: 'lawSb53', raise: 'lawRaise', euGpai: 'lawEuGpai', sb243: 'lawSb243', exportStrict: 'lawExport', licensing: 'lawLicensing', relief: 'lawRelief', ubi: 'lawUbi', hitl: 'lawHitl', sez: 'lawSez', fdaFastTrack: 'lawFda' };

function Briefing({ s }: { s: GameStateV2 }) {
  const cur = Math.min(2, s.player.policies.govBriefing) as 0 | 1 | 2;
  const eff = briefingEffect(s, cur);
  const OPTS: [0 | 1 | 2, string][] = [[0, 'None'], [1, 'Partial'], [2, 'Full']];
  const m = eff.milestone;
  const tipOf = (lv: 0 | 1 | 2, label: string) => { const e = briefingEffect(s, lv); return () => (
    <TipCard title={`${label} briefing`} value={lv === cur ? 'now' : undefined} rows={[
      { label: 'Delay on your internal milestones', value: e.delayDays === null ? 'never seen' : e.delayDays === 0 ? 'none' : `${F.num(e.delayDays, 0)} d` },
      ...(e.milestone ? [{ label: <>{e.milestone.name} (yours, internal)</>, value: e.milestone.seenDay === null ? 'not shown' : dateAt(s, e.milestone.seenDay) }] : []),
      { label: <><Term id="govTrust">Trust</Term> per month</>, value: e.trustPerMonth > 0 ? `+${F.num(e.trustPerMonth, 2)}` : '0' },
    ]}>
      {e.forcedFull ? 'Your pre-deploy testing pledge already gives Washington the full view.' : lv === 0 ? 'Only public milestones count for Washington’s stage.' : lv === 1 ? 'Staff pass on what they know with a delay.' : 'Full access; trust grows each month.'}
    </TipCard>
  ); };
  const line = (e: ReturnType<typeof briefingEffect>) => e.delayDays === null
    ? 'Washington sees none of your internal milestones.'
    : <>Your internal milestones reach Washington {e.delayDays === 0 ? <b>the day you reach them</b> : <><b>{Math.round(e.delayDays)} d late</b></>}.</>;
  return (
    <div className="pw-lever" data-home="govBriefing" data-test="briefing">
      <div className="row-i pw-lv-hd">
        <span className="pw-cap"><ICON.you size={12} /> <Term id="govBriefing">What Washington sees of your lab</Term></span>
        <span className="sp" />
        <div className="seg3" data-test="briefing-seg">
          {OPTS.map(([lv, label]) => {
            return (
              <Tip key={lv} content={tipOf(lv, label)}>
                <button className={`seg3-b ${lv === cur ? 'on' : ''}`} data-brief={lv} onClick={() => store.act('B7', { level: lv })}>{label}</button>
              </Tip>
            );
          })}
        </div>
      </div>
      <Tip as="div" className="pw-lv-tx" content={tipOf(cur, OPTS[cur]![1])}>
        {line(eff)}
        {m && eff.delayDays !== null && m.seenDay !== null && <> Your <b>{m.name}</b> (internal, {F.num(s.time.day - m.reachedDay, 0)} d ago) shows {m.seenDay <= s.time.day ? 'now' : <>in <b>{F.num(m.seenDay - s.time.day, 0)} d</b></>}.</>}
        {m && eff.delayDays === null && <> Your <b>{m.name}</b> stays unseen.</>}
        {eff.forcedFull && <> Your testing pledge gives the full view.</>}
      </Tip>
      <div className="row-i pw-chips">
        {OPTS.filter(([lv]) => lv !== cur).map(([lv, label]) => {
          const e = briefingEffect(s, lv);
          const early = e.milestone?.earlierThanPartial;
          return (
            <Tip key={lv} content={() => <TipCard title={`${label} instead`}>{line(e)}</TipCard>}>
              <span className="pw-pill">{label}: {e.delayDays === null ? 'sees none' : e.delayDays === 0 ? 'seen now' : `${F.num(e.delayDays, 0)} d late`}{early && lv === 2 ? ` · ${F.num(early, 0)} d sooner` : ''}{e.trustPerMonth > 0 ? ` · trust +${F.num(e.trustPerMonth, 1)} / mo` : ''}</span>
            </Tip>
          );
        })}
      </div>
    </div>
  );
}

function UsGov({ s }: { s: GameStateV2 }) {
  const g = usgovView(s);
  const sp = stageProgress(s);
  const trust = trustCauses(s, 6);
  const dTrust = trustCauses(s, 40).filter((x) => s.time.day - x.day <= 30).reduce((a, x) => a + x.delta, 0);
  const laws = lawStatus(s);
  const order = [...laws.filter((l) => l.inForce), ...laws.filter((l) => !l.inForce)];
  const att = attentionParts(s, PLAYER_ID);
  return (
    <Card className="pw-card" home="usStage" title={<span className="row-i"><ICON.exec size={15} /> US government</span>}
      right={<Tip content={() => (
        <TipCard title={<Term id="govTrust">Trust in you</Term>} value={F.idx(g.trust)} rows={[
          ...trust.map((x) => ({ label: <span className="dim">{dateAt(s, x.day)} · {x.reason}</span>, value: <span className={x.delta < 0 ? 'tone-neg' : 'tone-pos'}>{signed(x.delta)}</span> })),
        ]} footer={<span className="dim">Monthly: security floor +{F.num(USGOV.securityMet, 1)} met / {F.num(USGOV.securityMissed, 1)} missed, full briefing +{F.num(USGOV.briefingFull, 1)}, all × prominence ({F.num(att.attention, 2)}).</span>}>
          How much Washington trusts your lab, 0 to 100. Thefts, cover-ups and refused requests cost it; meeting the security floor and briefing earn it.
          {!trust.length && ' Nothing has moved it yet.'}
        </TipCard>
      )}>
        <span className="row-i" data-home="usTrust"><span className="pw-cap"><Term id="govTrust">Trust in you</Term></span><b className="pw-mid num">{F.idx(g.trust)}</b>
          <span className="pw-pbar sm"><i style={{ width: `${g.trust}%`, background: 'var(--pos)' }} /></span>
          <span className={`pw-trend ${dTrust < -0.05 ? 'bad' : 'good'}`}>{arrow(dTrust)} {F.num(Math.abs(dTrust), 1)}</span></span>
      </Tip>}>
      <div className="pw-cap pad0"><Term id="securityStage">Security stage</Term> · what it asks of you</div>
      <div className="pw-lad" data-test="us-ladder">
        {STAGE_NAMES.map((nm, i) => {
          const past = i < g.stage;
          const now = i === g.stage;
          const next = i === g.stage + 1;
          const tag = i === 3 ? (g.oversight ? ' · accepted' : '') : i === 4 ? (g.dpaAccepted ? ' · you hold the pool' : g.consolidated !== 'none' ? ` · ${g.consolidated === 'nationalized' ? 'taken over' : 'pooled'}` : '') : '';
          return (
            <div key={nm} className={`pw-lr us ${past ? 'past' : ''} ${now ? 'now' : ''} ${next ? 'next' : ''}`} data-stage={i}>
              <span className="pw-n">{past ? '✓' : i}</span>
              <span className="pw-nm">{STAGE_TERM[i] ? <Term id={STAGE_TERM[i]!}>{nm}</Term> : nm}</span>
              <span className="pw-fx">{STAGE_FX[i]}{tag}{now && i > 0 && !g.applies ? ' · not on you yet' : ''}</span>
              {next && (
                <Tip as="div" className="pw-need" content={() => (
                  <TipCard title={`Next: ${sp.nextName}`} value={`${F.num(sp.heldDays, 0)} / ${F.num(sp.needDays, 0)} d`} rows={[
                    ...(sp.since !== null ? [{ label: sp.seenBy ? `Seen by ${labNm(s, sp.seenBy)}` : 'Condition holding since', value: dateAt(s, sp.since) }] : [{ label: 'Condition', value: 'not met yet' }]),
                    ...(sp.priorHeld ? [{ label: 'Stage 3 held', value: `${F.num(sp.priorHeld.heldDays, 0)} / ${F.num(sp.priorHeld.needDays, 0)} d` }] : []),
                  ]}>
                    It needs: {sp.needs}. Once the condition holds, Washington takes {USGOV.lagDays} days to act.
                  </TipCard>
                )}>
                  <span className="pw-needtx">needs {sp.needs.replace(/^A lab shows /, '')}</span>
                  <span className="pw-hold"><i style={{ width: `${sp.needDays ? (sp.heldDays / sp.needDays) * 100 : 0}%` }} /></span>
                  <span className="num">{F.num(sp.heldDays, 0)} / {F.num(sp.needDays, 0)} d</span>
                </Tip>
              )}
            </div>
          );
        })}
      </div>
      <Briefing s={s} />
      <div className="pw-cap pad" data-home="usLaws">Laws in force</div>
      <div className="pw-laws" data-test="laws">
        {order.map((l) => (
          <Tip key={l.id} content={() => (
            <TipCard title={<Term id={LAW_TERM[l.id] ?? 'commitment'}>{l.name}</Term>} value={l.inForce ? (l.since !== null ? `in force since ${dateAt(s, l.since)}` : 'in force') : 'not in force'} rows={[
              { label: l.kind === 'dated' ? 'Starts' : 'Switches on', value: <span className="pw-rule">{l.on.replace(/^On when /, '').replace(/^Takes effect on /, '')}</span> },
              { label: 'Switches off', value: <span className="pw-rule">{l.off.replace(/^Off when /, '')}</span> },
            ]}>{l.text}</TipCard>
          )}>
            <span className={`pw-law ${l.inForce ? 'on' : ''}`} data-law={l.id}><i />{l.id === 'exportStrict' ? 'Chip exports · strict' : l.name}</span>
          </Tip>
        ))}
        <Tip content={() => <TipCard title="Chip export policy" value={F.words(s.market.exportPolicy)}>Set by the dated rules and strict controls above. It changes China’s compute.</TipCard>}>
          <Ref id="pw-export" to={{ panel: 'compute', tab: 'orders' }}>Chip exports · {F.words(s.market.exportPolicy)}</Ref>
        </Tip>
      </div>
    </Card>
  );
}

// ───────── China ─────────
const TENSION_FX = ['', 'talent, smuggling, distillation', 'China’s lab pools compute; weight theft starts', 'chip shipping at risk', 'war risk every quarter'];
const TENSION_TERM = [null, null, 'nationalCollective', null, null];

function China({ s }: { s: GameStateV2 }) {
  const g = chinagovView(s);
  const lead = usLeadOverChinaMonths(s, frontier(s));
  const tp = tensionProgress(s);
  const kp = talksProgress(s);
  const war = chinaWarOdds(s);
  const hist = s.chinagov.leadHist;
  const maxLead = Math.max(12, (lead ?? 0) * 1.2, ...hist);
  const at = (x: number) => `${Math.max(0, Math.min(100, (x / maxLead) * 100))}%`;
  const talksOpen = CHINAGOV.talksLead * CHINAGOV.bargaining;
  const climb = CHINAGOV.lead1 / CHINAGOV.aggression;
  return (
    <Card className="pw-card" home="chinaTension" title={<span className="row-i"><ICON.china size={15} style={{ color: C.china }} /> China</span>}
      right={<span className="row-i" data-home="usLead"><span className="pw-cap"><Term id="usLeadOverChina">US lead over China</Term></span>
        <Tip content={() => (
          <TipCard title={<Term id="usLeadOverChina">US lead over China</Term>} value={lead === null ? 'no public model' : `${F.num(lead, 1)} mo`} rows={[
            { label: 'Smoothed over four quarters', value: hist.length ? `${F.num(hist.slice(-CHINAGOV.leadQuarters).reduce((a, b) => a + b, 0) / Math.min(hist.length, CHINAGOV.leadQuarters), 1)} mo` : '—' },
            { label: 'Tension climbs above', value: `${F.num(climb, 0)} mo` },
            { label: 'Talks can open under', value: `${F.num(talksOpen, 1)} mo` },
          ]}>
            Months between the best US public model and China’s. A long lead pushes Beijing; a short one opens talks.{lead === null ? ' One of them shows no public model yet.' : ''}
          </TipCard>
        )}>
          <span className="row-i">{hist.length >= 2 && <Spark2 data={hist} w={64} h={22} color={C.china} />}<b className="pw-mid num">{lead === null ? '—' : `${F.num(lead, 1)} mo`}</b></span>
        </Tip></span>}>
      <Tip as="div" className="pw-lead" content={() => <TipCard title={<Term id="usLeadOverChina">US lead over China</Term>} value={lead === null ? 'no public model' : `${F.num(lead, 1)} mo`}>Marks: talks can open under {F.num(talksOpen, 1)} mo; tension climbs above {F.num(climb, 0)} mo.</TipCard>}><div data-test="lead-track">
        <div className="pw-sbar china"><i style={{ width: at(Math.max(0, lead ?? 0)) }} /></div>
        {[[talksOpen, 'talks'], [climb, 'tension climbs']].map(([x, l]) => (
          <span key={String(l)} className="pw-tick" style={{ left: at(x as number) }}><b /><em>{l} · {F.num(x as number, 0)} mo</em></span>
        ))}
      </div></Tip>
      <div className="pw-cap pad"><Term id="chinaTension">Tension</Term> · what it does to you</div>
      <div className="pw-lad" data-test="tension-ladder">
        {TENSION_NAMES.map((nm, i) => {
          const past = i < g.tension;
          const now = i === g.tension;
          const next = i === g.tension + 1;
          return (
            <div key={nm} className={`pw-lr cn ${past ? 'past' : ''} ${now ? 'now' : ''} ${next ? 'next' : ''}`} data-tension={i}>
              <span className="pw-n">{past ? '✓' : i === 0 ? '·' : i}</span>
              <span className="pw-nm">{TENSION_TERM[i] ? <Term id={TENSION_TERM[i]!}>{nm}</Term> : nm}</span>
              <span className="pw-fx">{TENSION_FX[i] || '—'}</span>
              {next && (
                <Tip as="div" className="pw-need" content={() => (
                  <TipCard title={`Next: ${tp.nextName}`} value={`${F.num(tp.heldDays, 0)} / ${F.num(tp.needDays, 0)} d`}>
                    <Parts p={tp} />
                    {tp.easing && <div className="dim small pw-sub">{tp.easing.text}</div>}
                  </TipCard>
                )}>
                  <span className="pw-needtx">needs {tp.needs.replace(/^Any push on China: /, '')}</span>
                  <span className="pw-hold"><i style={{ width: `${tp.needDays ? (tp.heldDays / tp.needDays) * 100 : 0}%` }} /></span>
                  <span className="num">{F.num(tp.heldDays, 0)} / {F.num(tp.needDays, 0)} d</span>
                </Tip>
              )}
            </div>
          );
        })}
      </div>
      {(g.tension >= 3 || war.p > 0) && (
        <Tip content={() => <TipCard title="War risk, next year" value={F.pct(war.p, 0)} rows={war.drivers.map((d) => ({ label: d.label, value: F.pct(d.share, 0) }))}>A war roll falls every quarter at war footing.</TipCard>}>
          <div className="pw-war"><ICON.war size={13} /> War risk next year <b className="num">{F.pct(war.p, 0)}</b> <Ref id="pw-war" to={{ panel: 'world', tab: 'risk' }}>World › Risk</Ref></div>
        </Tip>
      )}
      <div className="pw-cap pad" data-home="chinaTalks"><Term id="talksSteps">Talks</Term></div>
      <Tip content={() => (
        <TipCard title={kp.next === null ? 'Verified treaty' : `Next: ${kp.nextName}`} value={kp.needDays ? `${F.num(kp.heldDays, 0)} / ${F.num(kp.needDays, 0)} d` : undefined}>
          <Parts p={kp} />
        </TipCard>
      )}>
        <div className="pw-talks" data-test="talks-track">
          {TALKS_NAMES.map((nm, i) => (
            <div key={nm} className={`pw-tk ${i <= g.talks ? 'on' : ''} ${i === g.talks ? 'now' : ''}`}><i />{nm}</div>
          ))}
        </div>
      </Tip>
      <Tip as="div" className="pw-note left" content={() => <TipCard title={kp.next === null ? 'Verified treaty' : `Next: ${kp.nextName}`} value={kp.needDays ? `${F.num(kp.heldDays, 0)} / ${F.num(kp.needDays, 0)} d` : undefined}><Parts p={kp} /></TipCard>}>{g.talks === 0 && g.rejected ? 'The treaty was rejected; talks are closed.' : kp.needs + (kp.needDays ? ` · ${F.num(kp.heldDays, 0)} / ${F.num(kp.needDays, 0)} d held` : '')}</Tip>
      <div className="pw-cap pad" data-home="treaty"><Term id="treaty">Treaty</Term></div>
      <div className="pw-note left">
        {g.treaty === 'none' && 'None. A verified treaty caps every lab’s AI R&D compute and ends the race.'}
        {g.treaty === 'restraint' && 'Restraint pact: both sides hold back while it lasts.'}
        {g.treaty === 'verified' && <>Verified. Your AI R&amp;D compute is capped at <Tip content={() => <TipCard title="AI R&D compute cap" value={F.h100e(g.cap ?? 0)}>Your pool the day it was signed; every lab is held to its own.</TipCard>}><b className="num">{F.h100e(g.cap ?? 0)}</b></Tip> H100e.</>}
      </div>
      <div className="pw-links bottom row-i">
        <Tip content={() => <TipCard title="Taiwan shipping" value={s.market.disruptTW > 0 ? 'disrupted' : 'open'}>Chip supply from Taiwan; coercion raises its risk. Its home is Compute.</TipCard>}>
          <span><Ref id="pw-taiwan" to={{ panel: 'compute', tab: 'orders' }}>{s.market.disruptTW > 0 ? 'Taiwan shipping · disrupted' : 'Taiwan shipping'}</Ref></span>
        </Tip>
        <Ref id="pw-theft" to={{ panel: 'lab', tab: 'security' }}>Theft flows</Ref>
      </div>
    </Card>
  );
}

export function Powers({ s }: { s: GameStateV2 }): ReactNode {
  return (
    <div className="panel-v2 pw" data-panel="powers">
      <PanelHead icon={ICON.relations} title="Powers" sub="Washington · Beijing · the public" />
      <Rail s={s} />
      <div className="pw-cols">
        <div className="pw-col"><Public s={s} /><Pledges s={s} /></div>
        <UsGov s={s} />
        <China s={s} />
      </div>
    </div>
  );
}
