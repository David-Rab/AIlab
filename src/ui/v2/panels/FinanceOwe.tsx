// Finance › What we owe (FINANCE-V3 §0.4, §11; FIN2): HOME of investor credibility, every live promise with its progress,
// tranche conditions, covenants with headroom and contingent liabilities. One card, one selector (engine whatWeOwe). A
// big-tech division (FIN5c) owes no investors: the card lists the parent's goals and any contingent liabilities.
import type { ReactNode } from 'react';
import { ownerFunded } from '../../../engine/v2';
import type { LucideIcon } from 'lucide-react';
import { CRED_RUNGS, credRung, dateOf, describeTarget, fmtDate, fmtMetric, whatWeOwe } from '../../../engine/v2';
import type { GameStateV2, MilestoneType, OweCovenant, PromiseStatus } from '../../../engine/v2';
import { Term, Tip, TipCard, Why } from '../ui';
import { Card, HBar } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';

export const MILESTONE_UI: Record<MilestoneType, { label: string; icon: LucideIcon }> = {
  capability: { label: 'Capability', icon: ICON.L },
  scale: { label: 'Scale', icon: ICON.compute },
  adoption: { label: 'Adoption', icon: ICON.revenue },
};
const STATE_TONE: Record<PromiseStatus['state'], string> = { ahead: 'good', 'on track': '', behind: 'bad' };
const COV_TONE: Record<OweCovenant['state'], string> = { idle: '', ok: 'good', near: 'warn', breach: 'bad' };
const COV_LABEL: Record<OweCovenant['state'], string> = { idle: 'not drawn', ok: 'ok', near: 'near', breach: 'breach' };
const day = (s: GameStateV2, d: number) => fmtDate(dateOf(s, d));
/** Compact metric for the promise rows (units are in the row's text and tooltip). */
const short = (t: MilestoneType, v: number) => fmtMetric(t, v).replace(/^level /, 'L ').replace(' H100e', '').replace('/yr', '');
const signed = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(0)}`;

/** Investor credibility: score, rung and the ladder (the home of the datum). */
export function CredBadge({ s }: { s: GameStateV2 }) {
  const c = s.player.finance.credibility;
  const r = credRung(c);
  const tone = r.mult < 1 ? 'tone-neg' : r.mult > 1 ? 'tone-pos' : '';
  return (
    <span className="row-i small" data-test="investor-cred">
      <span className="dim"><Term id="investorCred">investor credibility</Term></span>
      <Why k="finance.credibility" title={<Term id="investorCred">Investor credibility</Term>} value={`${r.id} · ${Math.round(c)}`} fmt={(x) => x.toFixed(1)}
        rows={[...CRED_RUNGS].reverse().map((x) => ({ label: `${x.id} ≥ ${x.min}`, value: `share weight ×${x.mult}`, tone: x.id === r.id ? ('pos' as const) : ('neutral' as const) }))}
        body="Moved only by promises judged at their deadlines. Aggressive pitches need Credible or better.">
        <b className={`num ${tone}`} data-home="investorCred">{r.id} {Math.round(c)}</b>
      </Why>
    </span>
  );
}

/** One live promise: progress bar from start to target with the needed-by-now mark. */
function PromiseRow({ s, st }: { s: GameStateV2; st: PromiseStatus }) {
  const p = st.p;
  const M = MILESTONE_UI[p.type];
  const j = st.ifJudgedNow;
  const goal = p.by === 'parent';
  return (
    <Tip as="div" content={() => (
      <TipCard title={<><Term id={goal ? 'parentGoal' : 'promise'}>{goal ? 'Parent goal' : 'Promise'}</Term>: {describeTarget(p)}</>} value={st.state} rows={[
        goal ? { label: 'Set', value: `on ${day(s, p.closeDay)} with the ${F.money(p.amount)} budget, on your trend` } : { label: 'Raised', value: `${F.money(p.amount)} on ${day(s, p.closeDay)} (${p.pitch} pitch)` },
        { label: 'Start → target', value: `${fmtMetric(p.type, p.start)} → ${fmtMetric(p.type, p.target)}` },
        { label: 'Now', value: `${fmtMetric(p.type, st.value)} (${F.pct(Math.max(0, st.progress))} of the gain)` },
        { label: <Term id="neededByNow">Needed by now</Term>, value: `${fmtMetric(p.type, st.needed)} (${F.pct(st.neededProgress)})`, tone: st.state === 'behind' ? 'neg' : 'neutral' },
        { label: 'Deadline', value: `${day(s, p.deadline)} · ${st.daysLeft} d left` },
        { label: 'Behind when', value: 'more than 20 points of the gain short of needed-by-now, after the first quarter of the term' },
        goal ? { label: 'Weight', value: `${F.pct(st.weight)} of the year's goals` } : { label: <Term id="promiseWeight">Weight</Term>, value: F.pct(st.weight) },
        { label: 'If judged today', value: j.outcome === 'near' ? 'within 20%: no effect' : goal ? `${j.outcome}: parent confidence ${signed(j.board)}` : `${j.outcome}: credibility ${signed(j.cred)}, board ${signed(j.board)}`, tone: j.outcome === 'met' ? 'pos' : j.outcome === 'missed' ? 'neg' : 'neutral' },
      ]}>{goal ? 'Judged at the parent\x27s review: it moves parent confidence, which sets the next budget; never cash.' : 'An expectation, not a contract: it moves investor credibility and board confidence at its deadline, never cash.'}</TipCard>
    )}>
      <div className="owe-row owe-row4" data-promise={p.id} data-state={st.state}>
        <span className="row-i"><M.icon size={13} /><span className="ellip">{describeTarget(p)}</span></span>
        <HBar v={Math.max(0, st.progress)} max={1} w="100%" h={8} color={st.state === 'behind' ? C.bad : st.state === 'ahead' ? C.good : C.you} mark={Math.min(1, Math.max(0, st.neededProgress))} />
        <span className="owe-num small" data-test="needed-by-now">{short(p.type, st.value)} <span className="dim">/ {short(p.type, st.needed)} needed</span></span>
        <span className="owe-meta"><span className="dim">{st.daysLeft} d</span><span className={`tag2 ${STATE_TONE[st.state]}`}>{st.state}</span></span>
      </div>
    </Tip>
  );
}

function Section({ title, term, n, children }: { title: string; term: string; n?: ReactNode; children: ReactNode }) {
  return (
    <div className="owe-sec">
      <div className="owe-cap"><Term id={term}>{title}</Term>{n !== undefined && <Tip content={() => <TipCard title={<Term id={term}>{title}</Term>} value={n} />}><span className="dim"> · {n}</span></Tip>}</div>
      {children}
    </div>
  );
}

export function OweCard({ s }: { s: GameStateV2 }) {
  const o = whatWeOwe(s);
  const f = s.player.finance;
  const division = ownerFunded(s);
  return (
    <Card title={<Term id="whatWeOwe">What we owe</Term>} home="whatWeOwe" id="ctl-owe" right={division ? undefined : <CredBadge s={s} />}>
      <Section title={division ? 'Parent goals' : 'Promises'} term={division ? 'parentGoal' : 'promise'} n={`${o.promises.length} live${o.behind.length ? `, ${o.behind.length} behind` : ''}`}>
        {o.promises.map((st) => <PromiseRow key={st.p.id} s={s} st={st} />)}
        {o.pending && (
          <Tip as="div" content={() => <TipCard title="Round in progress" rows={[{ label: 'Ask', value: F.money(o.pending!.ask) }, { label: 'Closes', value: day(s, o.pending!.closesDay) }, { label: 'Promise due', value: day(s, o.pending!.deadline) }]}>Its promise starts when the round closes.</TipCard>}>
            <div className="owe-row dim" data-test="owe-pending"><span className="row-i"><ICON.raise size={13} /><span className="ellip">{describeTarget(o.pending.thesis)}</span></span><span className="small">starts at the close, {day(s, o.pending.closesDay)}</span><span className="owe-meta"><span className="tag2">pending</span></span></div>
          </Tip>
        )}
        {!o.promises.length && !o.pending && <div className="dim small">{division ? 'None until the parent sets the year\x27s goals at its review.' : 'None. You owe investors a milestone only after you raise.'}</div>}
        {o.judged.length > 0 && (
          <div className="owe-judged">
            {o.judged.map((p) => {
              const r = p.result!;
              const goal = p.by === 'parent';
              return (
                <Tip key={p.id} content={() => <TipCard title={describeTarget(p)} value={r.outcome} rows={[{ label: 'Judged', value: day(s, r.day) }, { label: 'Reached', value: `${fmtMetric(p.type, r.value)} (${F.pct(Math.max(0, r.progress))} of the gain)` }, { label: <Term id="promiseWeight">Weight</Term>, value: F.pct(r.weight) }, ...(goal ? [] : [{ label: 'Credibility', value: signed(r.cred) }]), { label: goal ? 'Parent confidence' : 'Board', value: signed(r.board) }]} />}>
                  <span className={`tag2 ${r.outcome === 'met' ? 'good' : r.outcome === 'missed' ? 'bad' : ''}`} data-judged={r.outcome}>{MILESTONE_UI[p.type].label} {r.outcome} {signed(goal ? r.board : r.cred)}</span>
                </Tip>
              );
            })}
          </div>
        )}
      </Section>
      {!division && <Section title="Tranche conditions" term="trancheCondition" n={o.tranches.length || undefined}>
        {o.tranches.map((t, i) => (
          <Tip as="div" key={i} content={() => <TipCard title={t.source} value={F.money(t.amount)} rows={[{ label: 'Condition', value: t.label }, { label: 'Due', value: day(s, t.dueDay) }, ...(t.deadline !== undefined ? [{ label: 'Lapses', value: `${day(s, t.deadline)} · ${t.daysLeft} d left` }] : [])]}>{t.cancels ? 'A contract: miss the condition by the deadline and the tranche lapses; the shares issued for it at the close are cancelled.' : 'A contract: miss the condition by the deadline and the tranche lapses.'}</TipCard>}>
            <div className="owe-row" data-tranche={i}>
              <span className="row-i owe-two"><ICON.cash size={13} /><span><span>{t.source} · <b className="num">{F.money(t.amount)}</b></span><span className="dim small">{t.label}</span></span></span>
              <HBar v={t.progress} max={1} w="100%" h={8} color={t.met ? C.good : C.watch} />
              <span className="owe-meta">{t.daysLeft !== undefined && <span className="dim">{t.daysLeft} d</span>}<span className={`tag2 ${t.met ? 'good' : ''}`}>{t.met ? 'met' : 'open'}</span></span>
            </div>
          </Tip>
        ))}
        {!o.tranches.length && <div className="dim small">No conditional money outstanding.</div>}
      </Section>}
      {!division && <Section title="Covenants" term="covenant" n={o.covenants.length || undefined}>
        {o.covenants.map((c) => (
          <Tip as="div" key={c.id} content={() => <TipCard title={c.label} value={COV_LABEL[c.state]} rows={[{ label: 'Rule', value: c.rule }, { label: 'Required', value: c.unit === '×' ? F.mult(c.required) : F.money(c.required) }, ...(c.state === 'idle' ? [] : [{ label: 'You have', value: c.unit === '×' ? F.mult(c.actual) : F.money(c.actual) }])]}>{c.state === 'idle' ? 'Tested at each quarter end while the line is drawn; nothing is drawn now.' : 'Tested at each quarter end. A breach is distress.'}</TipCard>}>
            <div className="owe-row" data-covenant={c.id} data-state={c.state}>
              <span className="row-i"><ICON.debt size={13} /><span className="ellip">{c.label}</span></span>
              {/* FIN6b: an undrawn line tests nothing; its "actual" would only repeat cash (home: the top strip). */}
              {c.state === 'idle' ? <span className="dim small">tested once you draw</span> : <HBar v={c.actual} max={Math.max(c.actual, c.required * 2, 1e-6)} w="100%" h={8} color={c.state === 'breach' ? C.bad : c.state === 'near' ? C.watch : '#6b7c91'} mark={c.required} />}
              <span className="owe-meta">{c.state !== 'idle' && <span className="dim">{c.unit === '×' ? F.mult(c.actual) : F.money(c.actual)}</span>}<span className={`tag2 ${COV_TONE[c.state]}`}>{COV_LABEL[c.state]}</span></span>
            </div>
          </Tip>
        ))}
        {!o.covenants.length && <div className="dim small">No debt with covenants.</div>}
      </Section>}
      <Section title="Contingent liabilities" term="contingentLiability" n={o.contingent.length ? F.money(o.contingentTotal) : undefined}>
        {o.contingent.filter((c) => c.kind === 'litigation').map((c) => (
          <Tip as="div" key={c.id} content={() => <TipCard title={c.label} value={F.money(c.amount)} rows={[{ label: 'Odds a quarter', value: F.pct(c.pQ ?? 0) }]}>{c.detail}</TipCard>}>
            <div className="owe-row" data-contingent="litigation"><span className="row-i"><ICON.alert size={13} /><span className="ellip">{c.label}</span></span><span className="small">{F.money(c.amount)} <span className="dim">· {F.pct(c.pQ ?? 0)}/q</span></span><span /></div>
          </Tip>
        ))}
        {(() => {
          const rvg = o.contingent.filter((c) => c.kind === 'rvg');
          if (!rvg.length) return null;
          const tot = rvg.reduce((a, c) => a + c.amount, 0);
          return (
            <Tip as="div" content={() => <TipCard title={<Term id="rvg">Residual-value guarantees</Term>} value={F.money(tot)} rows={rvg.slice(0, 8).map((c) => ({ label: c.label, value: F.money(c.amount) }))}>Half of each lease's unpaid balance, owed only if you walk away from the asset.</TipCard>}>
              <div className="owe-row" data-contingent="rvg"><span className="row-i"><ICON.sites size={13} /><span className="ellip"><Term id="rvg">Lease guarantees</Term> · {rvg.length} lease{rvg.length > 1 ? 's' : ''}</span></span><span className="small">{F.money(tot)}</span><span /></div>
            </Tip>
          );
        })()}
        {!o.contingent.length && <div className="dim small">None.</div>}
      </Section>
      {f.dualClass && <div className="dim small" style={{ marginTop: 6 }}><Term id="dualClass">Dual-class shares</Term>: founder votes keep control.</div>}
    </Card>
  );
}

/** Compact link for the Raise card: how many promises are live and behind; the numbers live in What we owe. */
export function OweLink({ s }: { s: GameStateV2 }) {
  const o = whatWeOwe(s);
  if (!o.promises.length && !o.pending) return null;
  return (
    <Tip content={() => <TipCard title={<Term id="promise">Promises</Term>} rows={[{ label: 'Live', value: String(o.promises.length) }, { label: 'Behind', value: String(o.behind.length), tone: o.behind.length ? 'neg' : 'neutral' }, ...(o.pending ? [{ label: 'Pending close', value: '1' }] : [])]}>Each with its progress in What we owe.</TipCard>}>
      <span className="small" data-ref="whatWeOwe">
        <span className="dim"><Term id="promise">promises</Term></span> {o.promises.length} live{o.behind.length ? <span className="tone-neg"> · {o.behind.length} behind</span> : null}
      </span>
    </Tip>
  );
}
