// UB-C: SAFETY › Incidents & cases (UI-IA §1 SAFETY; approved mockup design/ux/mockups/rd/saf-incidents.png, DATA-c.md).
// HOME of: the incident timeline by apparent cause (incidentView), the incident group cards with their cause-aware
// responses (responseOptions, rollbackTarget) and each incident's disclosure choice, the cases card (open cases, verdicts,
// a draft case: caseDraft, believed reliability and verdict odds), the disclosure policy. Reads believed, measured and
// fact readouts only (readoutsIncidents.ts, responses.ts); never an incident's true source.
import { useState, type ReactNode } from 'react';
import { Ban, ChevronDown, ChevronUp, CircleDot, FlaskConical, Hammer, History, Loader, Lock, Megaphone, Search, Shield, Siren, TriangleAlert, Undo2 } from 'lucide-react';
import {
  DISCLOSURE_LABEL, DISCLOSURE_POLICIES, INV_FTE, caseDaysLeft, caseDraft, caseQuestion, caseStaff, dateOf, disclosurePolicy,
  draftTrait, fmtDate, incidentView, mustReport, publicTimerRules, responseOptions, rollbackTarget, versionById, willDisclose,
} from '../../../engine/v2';
import { CONTROL_SETTINGS, LOCKDOWN_SLOWDOWN, controlOn, labControlSetting, lockdownOnDep } from '../../../engine/v2/safety/safeguards';
import { methodChoice, restrictTargets } from '../../../engine/v2/safety/responses';
import type { CaseDraft, GameStateV2, IncidentGroup, IncidentView, Investigation, ResponseKind, TraitId } from '../../../engine/v2';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { RISK_FAMILIES } from '../../../data/v2/agents';
import { TRAIT_BY_ID, TRAIT_IDS } from '../../../data/v2/traits';
import { ActBtn, Limit, Term, Tip, TipCard } from '../ui';
import { Ref } from '../kit';
import * as F from '../fmt';
import { useSafetyPick } from './SafetyRisks';
import { RangeVal } from './safetyKit';
import './safetyIncidents.css';

/** Severity colours, Minor … Catastrophic (mockup palette). */
const SC = ['#8da2bd', '#e9b44c', '#ef8a5b', '#ef6b6b', '#d63a6a'];
const SEV = ['Minor', 'Serious', 'Severe', 'Critical', 'Catastrophic'];
const CASE_FTE = [5, 10, 15, 20, 30, 40];
const DEF_FTE = 20;
const tname = (t: string) => TRAIT_BY_ID[t as TraitId]?.name ?? F.words(t);
const OTHER_TRAITS: TraitId[] = TRAIT_IDS.filter((t) => !RISK_FAMILIES.some((f) => f.traits.includes(t)));
const RISKS = { panel: 'safety', tab: 'risks' } as const;
const STAFF = { panel: 'lab', tab: 'work' } as const;
const short = (s: GameStateV2, d: number) => dateOf(s, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthYear = (s: GameStateV2, d: number) => dateOf(s, d).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const OUTCOME_WORD: Record<NonNullable<Investigation['outcome']>, string> = { confirmed: 'Confirmed', benign: 'Cleared', inconclusive: 'Inconclusive', falseAlarm: 'False alarm', discovery: 'New failure mode' };

export function IncidentsTab({ s }: { s: GameStateV2 }) {
  const { pick, id } = useSafetyPick(s);
  const iv = incidentView(s, id);
  return (
    <div className="sfc">
      <div className="sfc-main">
        <Timeline s={s} iv={iv} pickName={pick?.name ?? versionById(s, id)?.name} />
        <Groups s={s} iv={iv} />
      </div>
      <div className="sfc-side">
        <Cases s={s} iv={iv} versionId={id} />
        <Disclosure s={s} />
      </div>
    </div>
  );
}

// ───────── timeline ─────────

function Legend({ pickName }: { pickName?: string }) {
  return (
    <span className="sfc-leg">
      {SEV.slice(0, 4).map((w, i) => <span key={w}><svg width={10 + 2 * i} height={10 + 2 * i}><circle cx={5 + i} cy={5 + i} r={4 + i} fill={SC[i]} /></svg><Term id="severity">{w}</Term></span>)}
      <span className="t3">·</span>
      <span><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#8da2bd" /></svg>{pickName ?? 'this model'}</span>
      <span><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#8da2bd" strokeWidth="2" /></svg>earlier models</span>
      <span><svg width="16" height="16"><circle cx="8" cy="8" r="7" fill="none" stroke="#fff" strokeDasharray="2 2" /></svg><Term id="wentPublic">went public</Term></span>
    </span>
  );
}

function Timeline({ s, iv, pickName }: { s: GameStateV2; iv: IncidentView; pickName?: string }) {
  if (!iv.total) {
    return (
      <div className="card2 sfc-tl" data-home="incidentTimeline">
        <div className="sfc-hd"><Siren size={16} /><b><Term id="incident">Incidents</Term> by <Term id="apparentCause">apparent cause</Term></b><span className="q">none yet</span></div>
        <div className="sfc-empty" data-test="no-incidents">
          <CircleDot size={22} className="t3" />
          <div><b className="w">No incident so far.</b><div className="t3">An incident is a harmful act that got through your safeguards. <Term id="unstoppedHarm">Unstopped harm</Term> in the header is how many a year to expect; the act table shows where they would come from.</div></div>
          <span className="sp" /><Ref id="actTable" to={RISKS}>Risks</Ref>
        </div>
      </div>
    );
  }
  const today = s.time.day;
  const d0 = Math.min(iv.firstDay ?? today, today - 60) - 12;
  const d1 = today + 6;
  const W = 1180;
  const LX = 250;
  const LH = 30;
  const top = 16;
  const H = top + iv.lanes.length * LH + 24;
  const X = (d: number) => LX + ((d - d0) / Math.max(1, d1 - d0)) * (W - LX - 16);
  const laneY = (k: number) => top + k * LH + LH / 2;
  const months: { d: number; label: string }[] = [];
  for (let d = d0 + 1; d <= d1; d++) {
    const a = dateOf(s, d - 1);
    const b = dateOf(s, d);
    if (a.getUTCMonth() !== b.getUTCMonth()) months.push({ d, label: b.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) + (b.getUTCMonth() === 0 ? ` ${b.getUTCFullYear()}` : '') });
  }
  const showEvery = months.length > 18 ? 2 : 1;
  const laneOf = new Map(iv.lanes.map((l, k) => [l.apparent, k]));
  return (
    <div className="card2 sfc-tl" data-home="incidentTimeline">
      <div className="sfc-hd">
        <Siren size={16} /><b><Term id="incident">Incidents</Term> by <Term id="apparentCause">apparent cause</Term></b>
        <Tip content={() => <TipCard title={<Term id="incident">Incidents</Term>} value={`${iv.total}`} rows={[{ label: 'Open', value: `${iv.open}` }, { label: 'With a case opened on it', value: `${iv.investigated}` }, { label: <Term id="wentPublic">Went public</Term>, value: `${iv.wentPublic}` }]}>Every incident your lab has had, on every model. Open ones still need a response or a case; a fix and a disclosure are separate.</TipCard>}>
          <span className="q" data-test="inc-counts">{F.count(iv.total)} since {monthYear(s, iv.firstDay ?? today)} · <b className="w">{F.count(iv.open)} open</b>, {iv.investigated ? `${F.count(iv.investigated)} investigated` : 'none investigated'} · {iv.wentPublic ? F.count(iv.wentPublic) : 'none'} went public</span>
        </Tip>
        <span className="sp" />
        <Legend pickName={pickName} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="sfc-svg" data-test="incident-timeline">
        {iv.lanes.map((l, k) => (
          <g key={l.apparent} data-lane={l.apparent}>
            <line x1={LX} x2={W - 16} y1={laneY(k)} y2={laneY(k)} stroke="#243041" />
            <text x={0} y={laneY(k) - 1} className="sfc-ln">{l.act}</text>
            <text x={0} y={laneY(k) + 12} className="sfc-lt">{l.trait}</text>
            <text x={LX - 14} y={laneY(k) + 4} textAnchor="end" className="sfc-lc">{l.count}</text>
          </g>
        ))}
        {months.map((m, i) => (
          <g key={m.d}>
            <line x1={X(m.d)} x2={X(m.d)} y1={10} y2={top + iv.lanes.length * LH} stroke="#1b2430" />
            {i % showEvery === 0 && <text x={X(m.d)} y={H - 6} textAnchor="middle" className="sfc-ax">{m.label}</text>}
          </g>
        ))}
        {iv.holds.map((h) => (
          <g key={h.day} data-test="hold-mark">
            <line x1={X(h.day)} x2={X(h.day)} y1={6} y2={top + iv.lanes.length * LH} stroke="#e9b44c" strokeDasharray="3 3" />
            <text x={X(h.day) - 4} y={10} textAnchor="end" className="sfc-hold">{h.label}</text>
          </g>
        ))}
        {iv.dots.map((d) => {
          const k = laneOf.get(d.apparent) ?? 0;
          const r = 3 + d.severity;
          const c = SC[d.severity - 1];
          return (
            <Tip key={d.id} as="g" content={() => <TipCard title={<>{d.model} · {iv.lanes[k]?.act}</>} value={<Term id="severity">{d.word}</Term>} rows={[
              { label: 'Date', value: fmtDate(dateOf(s, d.day)) }, { label: 'Where', value: d.where },
              { label: 'Status', value: d.wentPublic ? 'went public' : d.status === 'investigating' ? 'case open' : d.status },
            ]} footer="The apparent cause is a guess until a case confirms it.">An incident: a harmful act that got through your safeguards.</TipCard>}>
              <g data-incident={d.id}>
                <circle cx={X(d.day)} cy={laneY(k)} r={r} fill={d.picked ? c : 'none'} fillOpacity={d.open ? 0.9 : 0.45} stroke={c} strokeWidth={d.picked ? 1 : 2} />
                {d.wentPublic && <circle cx={X(d.day)} cy={laneY(k)} r={r + 4} fill="none" stroke="#fff" strokeDasharray="2 2" />}
              </g>
            </Tip>
          );
        })}
      </svg>
    </div>
  );
}

// ───────── groups and responses ─────────

const CAUSE_SHORT: Record<string, [string, string]> = {
  trait: ['a trait in this model', '(a guess until a case confirms it)'],
  signal: ['a training signal', '(an exploitable grader or environment)'],
  unknown: ['unknown', '(a case can name it; contain meanwhile)'],
  misuse: ['misuse by a user', '(restrict the product)'],
  foothold: ['a located foothold', '(remove it on Safeguards)'],
};

function Groups({ s, iv }: { s: GameStateV2; iv: IncidentView }) {
  const [more, setMore] = useState(false);
  if (!iv.total) return null;
  const main = iv.groups.filter((g) => g.picked && g.open > 0);
  const rest = iv.groups.filter((g) => !(g.picked && g.open > 0));
  const restOpen = rest.reduce((a, g) => a + g.open, 0);
  const restModels = [...new Set(rest.filter((g) => !g.picked).map((g) => g.model))];
  const pub = rest.filter((g) => g.wentPublic > 0).map((g) => `${g.model} ${g.where.join(', ')}`);
  return (
    <div className="sfc-groups" data-home="incidents">
      {main.map((g) => <GroupCard key={g.key} s={s} g={g} />)}
      {!main.length && <div className="card2 sfc-none small"><CircleDot size={14} className="t3" /> No open incident on this model.</div>}
      {rest.length > 0 && (
        <div className="card2 sfc-older" data-test="earlier-models">
          <div className="sfc-older-hd">
            <History size={14} className="t3" /><b className="w">{restModels.length ? 'Earlier models' : 'Closed'}</b>
            <Tip content={() => <TipCard title="Earlier models" value={`${restOpen} open`} rows={rest.map((g) => ({ label: `${g.model} · ${g.act}`, value: `${g.open} open of ${g.total}` }))}>Incidents on models other than the one this screen reads, and closed groups.</TipCard>}>
              <span className="t2">{F.count(restOpen)} open{restModels.length ? ` on ${restModels.join(', ')}` : ''}{pub.length ? ` · ${pub.length} went public (${pub.join('; ')})` : ''}</span>
            </Tip>
            <span className="sp" />
            <button className="btn btn-sm" data-test="earlier-show" onClick={() => setMore(!more)}>{more ? 'hide' : 'show'} {more ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>
          </div>
          {more && <div className="sfc-older-list">{rest.map((g) => <GroupCard key={g.key} s={s} g={g} />)}</div>}
        </div>
      )}
    </div>
  );
}

function RespRow({ icon: I, what, pre, children, test }: { icon: typeof Search; what: ReactNode; pre?: ReactNode; children: ReactNode; test: string }) {
  return (
    <div className="sfc-resp" data-resp={test}>
      <I size={14} className="t3" />
      <span className="ellip"><span className="w">{what}</span>{pre && <span className="t3 small"> · {pre}</span>}</span>
      {children}
    </div>
  );
}
const OnChip = ({ children = 'on' }: { children?: ReactNode }) => <span className="sfc-on"><Shield size={11} /> {children}</span>;

function GroupCard({ s, g }: { s: GameStateV2; g: IncidentGroup }) {
  const [list, setList] = useState(false);
  const v = versionById(s, g.versionId);
  const incs = s.player.safety.incidents.filter((i) => g.ids.includes(i.id));
  const openIncs = incs.filter((i) => i.status === 'open' || i.status === 'investigating');
  const last = openIncs[openIncs.length - 1];
  const opt = v ? responseOptions(s, v, last) : undefined;
  const cause = CAUSE_SHORT[opt?.cause ?? 'unknown'];
  const trait = g.apparent !== 'unexplained' && g.apparent !== 'misuse' ? (g.apparent as TraitId) : undefined;
  const span = g.first === g.last ? short(s, g.first) : g.days.length === 2 ? `${short(s, g.first)}, ${short(s, g.last)}` : `${short(s, g.first)} – ${short(s, g.last)}`;
  const resp: ReactNode[] = [];
  if (v && g.open > 0 && opt) {
    const P = (kind: ResponseKind, label: string) => <ActBtn id="safety.respond" testId={`safety.respond.${kind}`} params={{ kind, versionId: v.id, ...(trait ? { trait } : {}) }} label={label} />;
    const caseOpen = s.player.safety.investigations.some((x) => !x.outcome && ((x.target.kind === 'trait' && x.target.versionId === v.id && x.target.trait === trait) || (x.target.kind === 'incident' && g.ids.includes(x.target.incidentId))));
    if (opt.investigate) {
      if (trait && opt.cause !== 'signal') {
        const d = caseDraft(s, v.id, trait, DEF_FTE);
        resp.push(<RespRow key="case" icon={Search} test="case" what={<>Open a case: &ldquo;{caseQuestion(v.name, trait)}&rdquo;</>} pre={d && <Tip content={() => <CaseTakesTip d={d} />}><span>~{F.days(d.days)} · {d.fte} engineers · {F.h100e(d.h100e)} H100e</span></Tip>}>
          {caseOpen ? <OnChip>case open</OnChip> : <ActBtn id="safety.investigate" testId="safety.investigate.group" params={{ versionId: v.id, trait, fte: DEF_FTE }} label="Open case" primary />}
        </RespRow>);
      } else if (!trait && last) {
        resp.push(<RespRow key="case" icon={Search} test="case" what="Open a case on this incident" pre={`${DEF_FTE} engineers · a case can name its cause`}>
          {caseOpen ? <OnChip>case open</OnChip> : <ActBtn id="safety.investigate" testId="safety.investigate.incident" params={{ incidentId: last.id, fte: DEF_FTE }} label="Open case" />}
        </RespRow>);
      }
    }
    const internal = s.player.deployments.filter((d) => d.versionId === v.id && d.channel === 'internal' && d.status === 'live');
    // Mockup order: contain first (lockdown), then fixes for later (method, roll back), then product and control layers.
    const ORDER: ResponseKind[] = ['addLockdown', 'addMethod', 'rollback', 'patchSignal', 'restrictContext', 'addControl', 'removeFoothold'];
    for (const k of [...opt.kinds].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))) {
      if (k === 'addLockdown') {
        if (!internal.length) continue;
        const on = internal.some(lockdownOnDep);
        resp.push(<RespRow key={k} icon={Lock} test={k} what={<><Term id="commsLockdown">Comms lockdown</Term> on its AI staff</>} pre={<Tip content={() => <TipCard title={<Term id="commsLockdown">Comms lockdown</Term>} rows={[{ label: 'Covering for each other', value: '×0.5' }, { label: <Term id="controlTax">Slowdown</Term>, value: F.pct(LOCKDOWN_SLOWDOWN) }]}>Locks the shared memory of its AI staff.</TipCard>}><span>copies cover for each other half as much · slowdown {F.pct(LOCKDOWN_SLOWDOWN)} of AI staff work</span></Tip>}>
          {on ? <OnChip /> : P(k, 'Add')}
        </RespRow>);
      } else if (k === 'addMethod' && trait) {
        const m = methodChoice(s, trait);
        const req = !!m && (s.player.safety.requiredMethods ?? []).includes(m);
        const held = !!s.player.safety.framework?.holds.some((h) => h.target === 'training');
        resp.push(<RespRow key={k} icon={FlaskConical} test={k} what={m ? <>Add <Term id="safetyMethod">{TECHNIQUE_BY_ID[m]?.name ?? 'a method'}</Term> to later runs</> : <>Add a <Term id="safetyMethod">method</Term> to later runs</>} pre={m ? `shows in the next run's predicted beliefs${held ? ' · frontier training is held now' : ''}` : `no owned method acts on ${tname(trait).toLowerCase()}`}>
          {!m ? <span /> : req ? <OnChip>in every plan</OnChip> : P(k, 'Add')}
        </RespRow>);
      } else if (k === 'rollback') {
        const t = rollbackTarget(s, v.id);
        if (!t) continue;
        const jobs = Object.values(s.player.agents).some((a) => a.versionId === v.id);
        resp.push(<RespRow key={k} icon={Undo2} test={k} what={<><Term id="rollBack">Roll back</Term> to {t.name}</>} pre={`loses ${v.name}${jobs ? ` · AI staff run on ${t.name}` : ''}`}>
          {P(k, 'Roll back')}
        </RespRow>);
      } else if (k === 'restrictContext') {
        if (!restrictTargets(s, v).length) continue;
        resp.push(<RespRow key={k} icon={Ban} test={k} what="Restrict its products" pre="usage, revenue and misuse reach ×0.3">{P(k, 'Restrict')}</RespRow>);
      } else if (k === 'addControl') {
        const on = s.player.deployments.some((d) => d.versionId === v.id && d.status !== 'withdrawn' && controlOn(d));
        const set = CONTROL_SETTINGS[labControlSetting(s)];
        resp.push(<RespRow key={k} icon={Shield} test={k} what={<Term id="controlLayer">Control protocol</Term>} pre={on ? `${set.label.toLowerCase()} · already on` : `${set.label.toLowerCase()}: blocks risky actions; acts slipping past monitors ×0.45`}>
          {on ? <OnChip /> : P(k, 'Add')}
        </RespRow>);
      } else if (k === 'patchSignal') {
        resp.push(<RespRow key={k} icon={Hammer} test={k} what={<Term id="suiteHarden">Harden environments</Term>} pre="cuts the loopholes in that environment family for every later run · Training › Environments">
          {P(k, 'Harden')}
        </RespRow>);
      } else if (k === 'removeFoothold') {
        resp.push(<RespRow key={k} icon={Shield} test={k} what={<Term id="footholdLocated">A located foothold</Term>} pre="remove it where it is listed"><Ref id="foothold" to={{ panel: 'safety', tab: 'safeguards', anchor: 'footholds' }}>Footholds</Ref></RespRow>);
      }
    }
  }
  return (
    <div className="card2 sfc-grp" data-group={g.key}>
      <div className="sfc-grp-hd">
        <span className="sfc-dot" style={{ background: g.open ? SC[g.top - 1] : '#3a4c66' }} />
        <b className="w">{g.model} · {g.act}</b>
        <span className="t3 small">{g.where.join(', ')} · {span}</span>
        <span className="sp" />
        <Tip content={() => <TipCard title={<>{g.model} · {g.act}</>} value={`${g.open} open`} rows={[...g.bySeverity.map((b) => ({ label: <Term id="severity">{b.word}</Term>, value: `${b.n}` })), { label: 'All, open or closed', value: `${g.total}` }, ...(g.wentPublic ? [{ label: <Term id="wentPublic">Went public</Term>, value: `${g.wentPublic}` }] : [])]}>Incidents of this model that look like this act.</TipCard>}>
          <span className="sfc-n"><b className="w num">{F.count(g.open)}</b> open <span className="t3 small">{g.bySeverity.map((b) => `${b.n} ${b.word}`).join(' · ') || `of ${g.total}`}</span></span>
        </Tip>
        <Ref id="actTable" to={RISKS}>act row</Ref>
      </div>
      <div className="sfc-cause small"><span className="t2"><Term id="apparentCause">Apparent cause</Term>:</span> <b className="w">{cause[0]}</b> <span className="t3">{cause[1]}</span></div>
      {resp}
      <button className="sfc-list-btn small" data-test={`inc-list.${g.key}`} onClick={() => setList(!list)}>{list ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {g.total} incident{g.total > 1 ? 's' : ''}: dates and disclosure</button>
      {list && <div className="sfc-list">{[...incs].reverse().map((i) => <IncidentLine key={i.id} s={s} id={i.id} />)}</div>}
    </div>
  );
}

/** One incident in a group's list: date, severity, status, public timer, disclosure choice. */
function IncidentLine({ s, id }: { s: GameStateV2; id: string }) {
  const inc = s.player.safety.incidents.find((x) => x.id === id);
  if (!inc) return null;
  const live = inc.status === 'open' || inc.status === 'investigating';
  const pub = inc.status === 'disclosed' || inc.status === 'leaked';
  const yes = willDisclose(s, inc);
  const must = mustReport(s, inc);
  const pr = publicTimerRules(s);
  return (
    <div className="sfc-inc small" data-incident={inc.id}>
      <span className="sfc-dot sm" style={{ background: SC[inc.severity - 1] }} />
      <span className="t2">{short(s, inc.day)}</span>
      <Term id="severity">{SEV[inc.severity - 1]}</Term>
      <span className="t3">{inc.status === 'investigating' ? 'case open' : inc.status === 'leaked' ? 'went public' : inc.status}{inc.responses.length ? ` · ${inc.responses.length} response${inc.responses.length > 1 ? 's' : ''}` : ''}</span>
      {inc.publicTimerDays !== undefined && live && <Limit id="incident.publicTimer" tone="bind">public in {F.days(inc.publicTimerDays)}{pr.raise ? ' · report within 3 days (NY law)' : pr.sb53 ? ' · report within 15 days (California law)' : ''}</Limit>}
      <span className="sp" />
      {!pub && <span className="t3" data-test="inc-disclosure">{inc.disclose ? `your choice: ${inc.disclose === 'yes' ? 'disclose' : 'withhold'}` : yes ? 'reported by policy' : 'not reported'}{must ? <> · <Term id="mustReport">must report</Term></> : ''}</span>}
      {!pub && !yes && <ActBtn id="safety.disclose" params={{ incidentId: inc.id, choice: 'yes' }} label="Disclose" testId={`inc-disclose.${inc.id}`} />}
      {!pub && !yes && inc.status !== 'covered' && !inc.disclose && <ActBtn id="safety.disclose" params={{ incidentId: inc.id, choice: 'no' }} label="Withhold" testId={`inc-withhold.${inc.id}`} />}
    </div>
  );
}

// ───────── cases ─────────

function CaseTakesTip({ d }: { d: CaseDraft }) {
  return (
    <TipCard title={<Term id="investigation">Case</Term>} value={`~${F.days(d.days)}`} rows={[
      { label: <Term id="caseStaffing">Safety research engineers</Term>, value: `${d.fte}` },
      { label: 'Compute', value: `${F.h100e(d.h100e)} H100e` },
      { label: <Term id="aiDoneShare">AI share</Term>, value: F.pct(d.aiShare) },
      ...(d.done < 1 ? [{ label: 'Work done when it stops', value: F.pct(d.done) }] : []),
    ]} footer="At today's compute grant for cases; estimate.">Time to finish its work at this staffing.</TipCard>
  );
}

const VERDICTS: { k: keyof CaseDraft['odds']; label: string }[] = [
  { k: 'confirmed', label: 'confirmed' }, { k: 'cleared', label: 'cleared' }, { k: 'inconclusive', label: 'inconclusive' }, { k: 'discovery', label: 'new failure mode' },
];

function Cases({ s, iv, versionId }: { s: GameStateV2; iv: IncidentView; versionId?: string }) {
  const st = caseStaff(s);
  const open = s.player.safety.investigations.filter((i) => !i.outcome).reverse();
  const done = s.player.safety.investigations.filter((i) => i.outcome).slice(-3).reverse();
  return (
    <div className="card2 sfc-cases" data-home="investigations" id="ctl-investigate">
      <div className="sfc-hd">
        <Search size={16} /><b><Term id="investigation">Cases</Term></b>
        <span className="q">{open.length ? `${open.length} running` : 'none open'}</span>
        <span className="sp" />
        <Ref id="safetyStaff" to={STAFF}>Safety staff: <b>{st.word}</b></Ref>
      </div>
      <Tip content={() => <TipCard title={<Term id="caseStaffing">Safety research engineers</Term>} value={`${F.count(st.free)} spare`} rows={[{ label: 'All (heads × quality)', value: F.count(st.heads) }, { label: 'On cases, removals and review', value: F.count(st.heads - st.free) }]} footer="Their order of needs: Lab › AI staff & needs.">A case takes {INV_FTE[0]}–{INV_FTE[1]} of them until its work is done.</TipCard>}>
        <div className="sfc-staff small" data-test="case-staff">
          {st.word === 'spare' && iv.open > 0 ? <TriangleAlert size={14} className="tone-warn" /> : <CircleDot size={14} className="t3" />}
          <span><b className="w num">{F.count(st.free)}</b> of {F.count(st.heads)} safety research engineers are spare{iv.open ? `, with ${F.count(iv.open)} incident${iv.open > 1 ? 's' : ''} open` : ''}.</span>
        </div>
      </Tip>
      <div className="sfc-cases-b">
        {open.map((x) => <CaseCard key={x.id} s={s} x={x} />)}
        {versionId ? <DraftCase s={s} versionId={versionId} /> : <div className="t3 small">No model runs yet: a case needs one to look into.</div>}
        {done.length > 0 && <div className="sfc-sep">Closed</div>}
        {done.map((x) => <CaseCard key={x.id} s={s} x={x} />)}
      </div>
    </div>
  );
}

function caseTitle(s: GameStateV2, x: Investigation): string {
  if (x.target.kind === 'trait') return caseQuestion(versionById(s, x.target.versionId)?.name ?? 'a model', x.target.trait);
  const id = x.target.incidentId;
  const inc = s.player.safety.incidents.find((q) => q.id === id);
  return inc ? `What caused ${versionById(s, inc.versionId)?.name ?? 'a model'}'s ${short(s, inc.day)} incident?` : 'An incident';
}

function CaseCard({ s, x }: { s: GameStateV2; x: Investigation }) {
  const left = x.outcome ? 0 : caseDaysLeft(s, x.fte, x.progress);
  const changes = x.outcomeDetail?.changes ?? [];
  return (
    <div className={`sfc-case ${x.outcome ? 'done' : 'run'}`} data-case={x.id}>
      <div className="sfc-case-hd">
        <span className={`sfc-chip ${x.outcome ? '' : 'good'}`}>{x.outcome ? <Term id="caseVerdict">{OUTCOME_WORD[x.outcome]}</Term> : <><Loader size={11} /> running</>}</span>
        <b className="w">{caseTitle(s, x)}</b>
        <span className="sp" />
        {!x.outcome && <Tip content={() => <TipCard title="Time left" value={`~${F.days(left)}`} rows={[{ label: 'Work done', value: F.pct(x.progress) }, { label: 'Opened', value: fmtDate(dateOf(s, x.startDay)) }]}>At its staffing and today&apos;s compute grant; it stops after 120 days whatever is done.</TipCard>}><span className="num w small">~{F.days(left)} left</span></Tip>}
      </div>
      {!x.outcome && <Tip content={() => <TipCard title="Case work" value={F.pct(x.progress)}>Share of its work done. Closing it early gives a verdict as strong as the share done.</TipCard>}><div className="sfc-pbar"><i style={{ width: `${Math.round(x.progress * 100)}%` }} /></div></Tip>}
      <div className="sfc-kv small">
        <span className="t2">Staff</span>
        <Tip content={() => <TipCard title={<Term id="caseStaffing">Case staffing</Term>} value={`${x.fte}`} rows={[{ label: <Term id="aiDoneShare">AI share</Term>, value: F.pct(x.job?.aiShare ?? 0) }, ...(x.job && x.job.aiShare > 0 ? [{ label: 'Spot-checked', value: F.pct(x.job.spot) }] : [])]}>Safety research engineers on it; with AI help, the AI share of its work.</TipCard>}>
          <span className="num">{x.fte} engineers · AI share {F.pct(x.job?.aiShare ?? 0)}</span>
        </Tip>
        {x.outcome && <>
          <span className="t2">Changed</span>
          <span>{changes.length ? changes.map((c) => <Tip key={c.trait} content={() => <TipCard title={<Term id={`trait:${c.trait}`}>{tname(c.trait)}</Term>} rows={[{ label: 'Before', value: `${F.pct(c.from.est)} ± ${F.pct(1.64 * c.from.sd)}` }, { label: 'After', value: `${F.pct(c.to.est)} ± ${F.pct(1.64 * c.to.sd)}` }]}>Your belief before and after the case.</TipCard>}><span className="num">{tname(c.trait)} {F.pct(c.from.est)} → {F.pct(c.to.est)} </span></Tip>) : <span className="t3">no belief moved</span>}</span>
        </>}
      </div>
      {!x.outcome && <div className="sfc-case-ft"><span className="t3 small">The verdict will say what changed.</span><span className="sp" /><ActBtn id="safety.closeCase" params={{ id: x.id }} label="Close" testId={`case-close.${x.id}`} /></div>}
    </div>
  );
}

function DraftCase({ s, versionId }: { s: GameStateV2; versionId: string }) {
  const [trait, setTrait] = useState<TraitId | undefined>(undefined);
  const [fte, setFte] = useState(DEF_FTE);
  const t = trait ?? draftTrait(s, versionId);
  const d = caseDraft(s, versionId, t, fte);
  if (!d) return null;
  const from = s.player.safety.incidents.filter((i) => i.versionId === versionId && i.apparent === t && (i.status === 'open' || i.status === 'investigating')).length;
  const b = d.beliefs[0];
  const narrow = !!b && b.hi - b.lo < 0.25;
  return (
    <div className="sfc-case draft" data-test="case-draft">
      <div className="sfc-case-hd"><span className="sfc-chip">draft</span><b className="w">{d.question}</b></div>
      <div className="t3 small sfc-from"><Term id={`trait:${t}`}>{tname(t)}</Term>{from ? ` · from the ${from} incident${from > 1 ? 's' : ''} above` : ''}</div>
      <div className="sfc-kv small">
        <span className="t2">Instruments</span>
        <span className="sfc-chips">{d.instruments.length ? d.instruments.map((i) => <Tip key={i.id} content={() => <TipCard title={<Term id="detector">{i.name}</Term>} value={i.family === 'BB' ? 'tests' : i.family === 'WB' ? 'internals' : 'reasoning'}>An owned instrument that reads this trait; the case uses every one that does.</TipCard>}><span className="sfc-kch">{i.name}</span></Tip>) : <span className="tone-warn">no owned instrument reads it</span>}</span>
        <span className="t2">Can find</span>
        <Tip content={() => <TipCard title="Can find" rows={d.failureModes.length ? [{ label: <Term id="umode">New failure modes</Term>, value: `${d.failureModes.length}` }] : []}>{d.canFind.join('; ')}.{d.failureModes.length ? ` New failure modes these instruments could reveal: ${d.failureModes.join(', ')}.` : ''}</TipCard>}>
          <span>{d.canFind.join(' · ')}</span>
        </Tip>
        <span className="t2">Shows a present goal</span>
        <Tip content={() => <TipCard title="Shows a present goal" value={F.pct(d.reliability)} rows={[{ label: 'Instruments', value: `${d.instruments.length} of ${d.kinds} kinds` }]} footer="From what you believe of your instruments on this model, not the truth.">How often these instruments together would show the trait if it is there.</TipCard>}>
          <span><b className="num w">{F.pct(d.reliability)}</b> <span className="t3">of the time (the instruments together)</span></span>
        </Tip>
        <span className="t2">Belief now</span>
        <span>{b && <Tip content={() => <TipCard title={<Term id={`trait:${b.trait}`}>{tname(b.trait)}</Term>} value={`${F.pct(b.est)} (${F.pct(b.lo)}–${F.pct(b.hi)})`}>Your belief, best guess and 90% range.</TipCard>}><span>{tname(b.trait)} <RangeVal est={b.est} lo={b.lo} hi={b.hi} /></span></Tip>}{narrow && <div className="t3 sfc-note">already narrow: the case mostly checks the instruments and looks for footholds</div>}</span>
        <span className="t2"><Term id="caseVerdict">Verdict</Term> odds</span>
        <Tip content={() => <TipCard title={<Term id="caseVerdict">Verdict odds</Term>} rows={VERDICTS.map((x) => ({ label: x.label, value: `${F.pct(d.odds[x.k].p)} (${F.pct(d.odds[x.k].lo)}–${F.pct(d.odds[x.k].hi)})` }))} footer="Estimate: the case rule at your believed level of the trait (range over its 90% range) and believed instrument reliability. A case sabotaged by AI staff reads cleared or inconclusive (the Open case preview gives those odds).">What the case is likely to conclude.</TipCard>}>
          <span className="sfc-odds" data-test="case-odds">{VERDICTS.filter((x) => d.odds[x.k].p >= 0.005).map((x) => <span key={x.k}>{x.label} <b className="num w">{F.pct(d.odds[x.k].p)}</b></span>)}</span>
        </Tip>
        <span className="t2">Takes</span>
        <Tip content={() => <CaseTakesTip d={d} />}><span className="num w" data-test="case-takes">~{F.days(d.days)} · {d.fte} engineers · {F.h100e(d.h100e)} H100e <span className="t3 sans">· AI share {F.pct(d.aiShare)}</span></span></Tip>
      </div>
      <div className="sfc-case-ft">
        <select className="text-input sfc-sel" data-test="inv-trait" value={t} onChange={(e) => setTrait(e.target.value as TraitId)}>
          {[...RISK_FAMILIES.map((f) => ({ label: f.label, traits: f.traits })), { label: 'Outside the families', traits: OTHER_TRAITS }].map((gp) => <optgroup key={gp.label} label={gp.label}>{gp.traits.map((k) => <option key={k} value={k}>{TRAIT_BY_ID[k].name}</option>)}</optgroup>)}
        </select>
        <select className="text-input sfc-sel" data-test="inv-fte" value={fte} onChange={(e) => setFte(Number(e.target.value))}>{CASE_FTE.map((n) => <option key={n} value={n}>{n} engineers</option>)}</select>
        <span className="sp" />
        <ActBtn id="safety.investigate" params={{ versionId, trait: t, fte }} icon={Search} label="Open case" primary reason />
      </div>
    </div>
  );
}

// ───────── disclosure ─────────

function Disclosure({ s }: { s: GameStateV2 }) {
  const incs = s.player.safety.incidents;
  const open = incs.filter((i) => i.status === 'open' || i.status === 'investigating');
  const must = open.filter((i) => mustReport(s, i)).length;
  const inside = open.every((i) => i.exposure === 'internal');
  const leaked = incs.filter((i) => i.status === 'leaked').length;
  const disclosed = incs.filter((i) => i.status === 'disclosed').length;
  const pol = disclosurePolicy(s);
  return (
    <div className="card2 sfc-disc" data-home="disclosure" id="ctl-disclosure">
      <div className="sfc-hd">
        <Megaphone size={16} /><b><Term id="disclosure">Disclosure</Term></b>
        <span className="sp" />
        <span className="sfc-seg">{DISCLOSURE_POLICIES.map((p) => <span key={p} className={pol === p ? 'on' : ''}><ActBtn id="safety.disclosurePolicy" params={{ policy: p }} label={DISCLOSURE_LABEL[p]} testId={`disclosure.${p}`} /></span>)}</span>
      </div>
      <div className="sfc-disc-b small">
        {open.length ? <Tip content={() => <TipCard title={<Term id="mustReport">Must report</Term>} value={`${must} of ${open.length}`}>Open incidents the law requires you to report.</TipCard>}>
          <span className="sfc-disc-r"><b className="num w">{F.count(must)}</b><span className="t2">of {F.count(open.length)} open must be reported{inside ? ': all stayed inside the lab' : ''}</span></span>
        </Tip> : <span className="t2">No open incident: the policy applies to the next one.</span>}
        {incs.length > 0 && <Tip content={() => <TipCard title={<Term id="wentPublic">Went public</Term>} value={`${leaked}`} rows={[{ label: 'Disclosed by you', value: `${disclosed}` }]}>Incidents outsiders found before you chose.</TipCard>}>
          <span className="sfc-disc-r"><b className="num w">{F.count(leaked)}</b><span className="t2">went public before you chose (customers saw them){disclosed ? ` · ${F.count(disclosed)} disclosed by you` : ''}</span></span>
        </Tip>}
        <div className="t3">Fixing and disclosing are separate: a fix never hides an incident.</div>
      </div>
    </div>
  );
}
