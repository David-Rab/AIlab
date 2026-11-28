// Finance › Board card, control and the owner (C8; design/corp/CORPORATE.md §7): HOME of the structure label, the
// controller and the powers (one header line), of voting control (the "Who controls you" bar, votes only: the stakes are
// the ownership donut's) and, when a company or the government owns you, of its budget, goals and reviews. Every number
// reads the engine (control.ts, charter.ts, parent.ts).
import { boardSeats, CLASS_RULE, charterHolds, charterRights, controllerOf, dateOf, DIVISION, DIVISION_REASON, describeTarget, divisionOf, dayOfQuarter, fmtDate, fmtMonth, govGoalCheck, holdingsOf, ownerFunded, parentSchedule, structureLabel } from '../../../engine/v2';
import type { BoardSeat, ControlChange, DivisionView, GameStateV2, Holding } from '../../../engine/v2';
import { Term, Tip, TipCard, Why } from '../ui';
import { GoBtn, HBar } from '../kit';
import { MILESTONE_UI } from './FinanceOwe';
import { divisionStatus } from '../shell/selectors';
import * as F from '../fmt';
import { C, SPHERE } from '../theme';
import './financeControl.css';

/** "⅔" for the fixed two thirds, else a whole percent. */
const share = (x: number) => (Math.abs(x - 2 / 3) < 0.004 ? '⅔' : `${Math.round(x * 100)}%`);

const HOLDER_COLOR: Record<Holding['kind'], string> = { founders: SPHERE.sec, investors: SPHERE.prod, partner: SPHERE.cap, public: C.neutral, mission: SPHERE.saf, government: C.rival };
const holderTitle = (h: Pick<Holding, 'id' | 'kind'>) => (h.kind === 'founders' ? 'Founders' : h.kind === 'investors' ? 'Investors' : h.kind === 'public' ? 'Public' : h.kind === 'mission' ? 'Mission body' : h.kind === 'government' ? 'Government' : h.id);
const holderSubject = (h: Pick<Holding, 'id' | 'kind'>) => (h.kind === 'founders' ? 'the founders hold' : h.kind === 'mission' ? 'the mission body holds' : h.kind === 'government' ? 'the government holds' : `${h.id} holds`);

/** The seat's holder, so a holder's elected seats can be counted under its segment; the CEO's own seat is nobody's. */
const seatHolder = (x: BoardSeat): string => (x.kind === 'founder' && x.holder === 'CEO' ? 'CEO' : x.kind === 'founder' ? 'founders' : x.kind === 'financial' ? 'investors' : x.kind === 'independent' ? 'public' : x.kind === 'mission' ? 'mission' : x.kind === 'gov' ? 'government' : x.holder);
const holderKey = (h: Holding): string => (h.kind === 'partner' ? h.id : h.kind);

/** The class rule in words (CORPORATE.md §2.1). */
function classRule(h: Holding): string {
  const r = CLASS_RULE[h.cls];
  if ('fixed' in r) return `a fixed ${share(r.fixed)} of all votes, whatever it holds`;
  return r.mult === 0 ? 'non-voting: its shares carry no votes' : r.mult === 1 ? '×1: one vote a share' : `×${r.mult}: super-voting shares`;
}

const POWER_TERM: Record<string, string> = { safetyCommittee: 'safetyCommittee', trust: 'trustApproval', override: 'override', security: 'securityApproval' };

/** Header line: structure, controller, powers. Each power's tooltip says what it blocks (charter.ts charterRights). */
export function ControlHeader({ s }: { s: GameStateV2 }) {
  const c = controllerOf(s);
  const holds = charterHolds(s);
  const rights = charterRights(s);
  return (
    <div className="ctl-head" data-test="control-head">
      <Term id="structureLabel"><b data-test="structure">{structureLabel(s)}</b></Term>
      <span className="dim">·</span>
      <Term id="controller"><span data-test="controller">{c ? `${holderSubject(c)} ${share(c.votes)} of the votes` : 'no one holds a majority'}</span></Term>
      {rights.map((r) => {
        const held = r.id === 'safetyCommittee' ? holds : [];
        return (
          <Tip key={r.id} content={() => (
            <TipCard title={<Term id={POWER_TERM[r.id]}>{r.label}</Term>} value={held.length ? <span className="tone-warn">holding {held.length}</span> : undefined} rows={[
              { label: 'Blocks', value: r.blocks },
              ...held.map((h) => ({ label: h.name, value: `held: ${h.reason}`, tone: 'neg' as const })),
              { label: 'Source', value: r.source },
            ]}>{"A hard right of this governance, not a vote: no confidence or force gets past it. See [[charter]]."}</TipCard>
          )}>
            <span className={`power ${held.length ? 'held' : ''}`} data-right={r.id} data-test={held.length ? 'charter-held' : undefined}>{r.label.toLowerCase()}{held.length ? ` · holds ${held.length}` : ''}</span>
          </Tip>
        );
      })}
      {s.player.charter.profitCap && (
        <Tip content={() => <TipCard title={<Term id="profitCap">Profit cap</Term>} rows={[{ label: 'Blocks', value: "Investors' returns are limited: they pay about two thirds of the usual price for a share" }]} />}>
          <span className="power" data-right="profitCap">profit cap</span>
        </Tip>
      )}
    </div>
  );
}

/** "Who controls you": the only home for voting control. Votes by holder with each holder's seats under its segment and the
 *  50% line; the holder's stake is the ownership donut's. */
export function ControlRow({ s }: { s: GameStateV2 }) {
  const hs = holdingsOf(s).filter((h) => h.votes > 0.0005).sort((a, b) => b.votes - a.votes);
  const seats = boardSeats(s);
  const c = controllerOf(s);
  const fixed = holdingsOf(s).find((h) => h.cls === 'state' || h.cls === 'mission');
  const seatsOf = (h: Holding) => seats.filter((x) => seatHolder(x) === holderKey(h)).length;
  return (
    <div className="ctl-who" data-test="who-controls" data-home="votes">
      <span className="dim small"><Term id="votes">Who controls you</Term></span>
      <div className="vbar">
        {hs.map((h) => (
          <Tip key={h.id} className="vtip" style={{ flex: `0 0 ${h.votes * 100}%` }} content={() => (
            <TipCard title={holderTitle(h)} value={`${share(h.votes)} of the votes`} rows={[
              { label: <Term id="shareClass">Share class</Term>, value: classRule(h) },
              { label: 'Board seats', value: `${seatsOf(h)} elected` },
              ...(c?.id === h.id ? [{ label: <Term id="controller">Controller</Term>, value: 'more than half of the votes' }] : []),
            ]}>{"Seats follow votes: the CEO's own seat plus six elected by the holders' votes. The share of the company each holds is in Who owns you."}</TipCard>
          )}>
            <div className={`vseg ${c?.id === h.id ? 'ctrl' : ''}`} data-holder={h.id} style={{ background: HOLDER_COLOR[h.kind] }}>{h.votes >= 0.14 ? holderTitle(h) : ''}</div>
          </Tip>
        ))}
        <i className="vline" /><span className="vline-lbl">50%</span>
      </div>
      <div className="vseats">
        {hs.map((h) => <span key={h.id} data-seats={h.id} style={{ flex: `0 0 ${h.votes * 100}%` }}>{seatsOf(h)}{h.votes >= 0.1 ? (seatsOf(h) === 1 ? ' seat' : ' seats') : ''}</span>)}
      </div>
      <Tip content={() => <TipCard title="Your CEO seat">You hold one seat as CEO in every structure. No holder elects it.</TipCard>}><div className="dim small" data-seats="CEO" style={{ textAlign: 'right' }}>+ your CEO seat</div></Tip>
      {!ownerFunded(s) && !c && !fixed && <div className="dim small" data-test="control-rule">If a company passes 50% of the votes it becomes your parent: it sets a yearly budget and goals and can oust you.</div>}
      {!ownerFunded(s) && fixed?.kind === 'mission' && <div className="dim small" data-test="control-rule">The mission body's ⅔ is fixed: no holder can pass 50% while it stands.</div>}
    </div>
  );
}

/** The preview line of what a change does to control (control.ts controlAfter); nothing when control does not change. */
export function ControlAfter({ c }: { c: ControlChange | undefined }) {
  if (!c) return null;
  return (
    <Tip as="div" content={() => <TipCard title={<Term id="controller">Control after</Term>}>{"The board and controller once this has gone through, on today's cap table. See [[votes]]."}</TipCard>}>
      <div className="ctl-after small" data-test="control-after">{c.line}</div>
    </Tip>
  );
}

const qLabel = (s: GameStateV2, q: number) => {
  const d = dateOf(s, dayOfQuarter(s.time.startDate, q));
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${String(d.getUTCFullYear()).slice(2)}`;
};
const yearLabel = (s: GameStateV2, v: DivisionView) => `${fmtMonth(dateOf(s, v.reviewDay - 365))} – ${fmtMonth(dateOf(s, v.reviewDay - 1))}`;

/** Owner confidence (the board confidence of a division or a government-run company): its home while an owner funds you. */
export function ParentConf({ s, v }: { s: GameStateV2; v: DivisionView }) {
  const gov = controllerOf(s)?.kind === 'government';
  return (
    <span className="row-i">
      <span className="dim small"><Term id="parentConf">{gov ? 'government confidence' : 'parent confidence'}</Term></span>
      <Why k="board.confidence" title={<Term id="parentConf">{gov ? 'Government confidence' : 'Parent confidence'}</Term>} value={F.idx(v.confidence)}
        rows={[{ label: 'Next budget at this confidence', value: `${F.pct(v.next.factor)} of plan` }, { label: 'Full plan at', value: `${DIVISION.fullAt}+` }, { label: 'Floor', value: `${F.pct(DIVISION.floor)} of plan at 0` }]}
        body="Moves on the owner's goals, overspend it is covering at a review, and public incidents; drifts toward 60. It sets the next budget at the review. See [[parentConf]].">
        <b className={`num big ${v.confidence < 40 ? 'tone-neg' : ''}`} data-home="parentConf">{F.idx(v.confidence)}</b>
      </Why>
    </span>
  );
}

/** The owner's budget year, goals and reviews, inside the Board card (a company or the government owns you). */
export function OwnerBudget({ s, v }: { s: GameStateV2; v: DivisionView }) {
  const gov = controllerOf(s)?.kind === 'government';
  const d = divisionOf(s);
  const st = divisionStatus(v);
  const sched = parentSchedule(s, 8);
  const avail = Math.max(0, v.available);
  const scale = Math.max(avail, v.spent, 1e-6);
  const elapsed = Math.max(0, Math.min(1, 1 - (v.reviewDay - s.time.day) / 365));
  const review = fmtDate(dateOf(s, v.reviewDay));
  const col = st.tone === 'bad' ? C.bad : st.tone === 'watch' ? C.watch : C.good;
  const last = v.last;
  const govGoals = gov && d?.govGoals ? d.govGoals.map((id) => ({ id, ...govGoalCheck(s, id, d.govGoalsDay ?? 0) })) : [];
  return (
    <div className="ctl-owner" data-test="owner-budget" data-home="parentBudget">
      <Tip as="div" content={() => (
        <TipCard title={<><Term id="ownerBudget">Budget</Term> {yearLabel(s, v)}</>} value={F.money(v.budget)} rows={[
          { label: gov ? "The government's plan" : "Parent's plan", value: F.money(v.plan) },
          { label: <Term id="parentConf">Factor from confidence</Term>, value: `${F.pct(v.factor)} at confidence ${F.idx(v.setAt)}` },
          { label: v.carryIn < 0 ? 'Advance carried in' : 'Savings carried in', value: F.money(v.carryIn, { signed: true }), tone: v.carryIn < 0 ? 'neg' : 'neutral' },
          { label: 'Paid so far', value: F.money(v.paid) },
          { label: 'Spent so far', value: F.money(v.spent) },
          { label: 'Overspend at the review (projected)', value: F.money(v.coverAtReview), tone: v.coverAtReview > 0 ? 'neg' : 'neutral' },
          ...sched.map((x) => ({ label: `Payment ${qLabel(s, x.q)}${x.estimate ? ' (estimate)' : ''}`, value: F.money(x.amount) })),
        ]} footer="Spent = carried in + paid so far − cash. The mark is how far through the year you are.">{"Paid in four quarterly payments. Unspent budget stays as cash; past it the owner pays the bills and its later payments repay it first. See [[ownerBudget]]."}</TipCard>
      )}>
        <div className="div-year" data-test="division-year">
          <span className="small"><span className="dim"><Term id="ownerBudget">Budget</Term> {yearLabel(s, v)}</span> <b className="num">{F.money(v.budget)}</b> <span className="dim">× {F.pct(v.factor)} of plan</span>{v.carryIn !== 0 && <span className="dim"> {v.carryIn > 0 ? '+' : '−'} {F.money(Math.abs(v.carryIn))} {v.carryIn > 0 ? 'saved' : 'advance'}</span>}</span>
          <HBar v={v.spent} max={scale} w="100%" h={10} color={col} mark={elapsed * avail} />
          <span className="small num"><span className="dim">spent</span> {F.money(v.spent)}</span>
        </div>
      </Tip>
      <Tip as="div" content={() => (
        <TipCard title={<Term id="parentReview">At the review</Term>} value={review} rows={[
          { label: 'Overspend the owner would be covering', value: F.money(v.coverAtReview), tone: v.coverAtReview > 0 ? 'neg' : 'neutral' },
          { label: <Term id="parentConf">Confidence</Term>, value: v.coverConf < 0 ? `${Math.round(v.coverConf)} for it` : 'no cost' },
        ]} footer={`Confidence −${DIVISION.overConf} × overspend ÷ budget, at most −${DIVISION.overConf}, at every review while the owner is still covering it.`}>{"Over budget = spent more than this year's budget and savings. You cannot go broke: the owner pays the bills."}</TipCard>
      )}>
        <div className={`div-status tone-${st.tone === 'bad' ? 'neg' : st.tone === 'watch' ? 'warn' : 'pos'}`} data-test="division-status" data-status={v.status}>{st.text}</div>
      </Tip>
      <div className="ctl-goal small" data-test="division-goals">
        <span className="dim"><Term id={gov ? 'governmentGoals' : 'parentGoals'}>goals</Term> judged {review} (in {Math.max(0, v.reviewDay - s.time.day)} d):</span>
        {gov
          ? govGoals.map((g) => <Tip key={g.id} content={() => <TipCard title={g.label} value={g.met ? 'met so far' : 'not met'}>{g.detail}</TipCard>}><span className={`tag2 ${g.met ? 'good' : 'warn'}`} data-goal={g.id}>{g.id === 'security' ? 'security floor' : g.id === 'lead' ? 'lead over China' : 'no serious incident'}</span></Tip>)
          : v.goals.map((g) => {
            const M = MILESTONE_UI[g.p.type];
            return <Tip key={g.p.id} content={() => <TipCard title={M.label} value={g.state}>{`${describeTarget(g.p)}. Progress is in What we owe.`}</TipCard>}><span className={`tag2 ${g.state === 'behind' ? 'bad' : g.state === 'ahead' ? 'good' : ''}`} data-goal={g.p.type}>{M.label.toLowerCase()} · {g.state}</span></Tip>;
          })}
        {!gov && <GoBtn to={{ panel: 'finance', tab: 'owe' }} label="Progress" testId="fin.go.goals" />}
      </div>
      {last && (
        <div className="small" data-test="last-review">
          <span className="dim">last review {fmtMonth(dateOf(s, last.day))}:</span> <Term id="ownerBudget">budget {F.money(last.budget)}</Term>
          {last.gov ? <> · {last.gov.map((g) => <span key={g.id} className={g.met ? 'tone-pos' : 'tone-neg'}> {g.met ? '✓' : '✗'} {g.id === 'security' ? 'security floor' : g.id === 'lead' ? 'lead over China' : 'no serious incident'}</span>)}</> : <> · goals {last.goals.met} met, {last.goals.missed} missed</>}
          {last.overConf < 0 && <span className="tone-neg"> · overspend {Math.round(last.overConf)} confidence</span>}
        </div>
      )}
      <div className="fin-foot">
        <span className="dim small" data-test="division-reason">{DIVISION_REASON}</span>
      </div>
    </div>
  );
}
