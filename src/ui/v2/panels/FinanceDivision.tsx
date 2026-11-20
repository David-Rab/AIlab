// Finance › Parent budget (big-tech division, FINANCE-V3 §13, FIN5c): HOME of the budget year (budget, spent so far,
// over / within budget), parent confidence and the payment schedule. The parent's goals live in What we owe (one home);
// this card links there. Every number reads the engine's divisionView.
import { budgetFactor, dateOf, DIVISION, DIVISION_REASON, divisionView, fmtDate, fmtMonth, parentSchedule } from '../../../engine/v2';
import type { DivisionView, GameStateV2 } from '../../../engine/v2';
import { dayOfQuarter } from '../../../engine/v2';
import { Term, Tip, TipCard, Why } from '../ui';
import { Card, GoBtn, HBar } from '../kit';
import * as F from '../fmt';
import { C } from '../theme';
import './financeDivision.css';
import { divisionStatus } from '../shell/selectors';

const qLabel = (s: GameStateV2, q: number) => {
  const d = dateOf(s, dayOfQuarter(s.time.startDate, q));
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${String(d.getUTCFullYear()).slice(2)}`;
};
const yearLabel = (s: GameStateV2, v: DivisionView) => `${fmtMonth(dateOf(s, v.reviewDay - 365))} – ${fmtMonth(dateOf(s, v.reviewDay - 1))}`;

/** Parent confidence (the division's board confidence): its home on a division's Finance tab. */
export function ParentConf({ v }: { v: DivisionView }) {
  return (
    <span className="row-i">
      <span className="dim small"><Term id="parentConf">parent confidence</Term></span>
      <Why k="board.confidence" title={<Term id="parentConf">Parent confidence</Term>} value={F.idx(v.confidence)}
        rows={[{ label: 'Next budget at this confidence', value: `${F.pct(v.next.factor)} of plan` }, { label: 'Full plan at', value: `${DIVISION.fullAt}+` }, { label: 'Floor', value: `${F.pct(DIVISION.floor)} of plan at 0` }]}
        body="Moves on the parent's goals, overspend it is covering at a review, and public incidents; drifts toward 60. It sets the next budget at the review. See [[parentConf]].">
        <b className={`num big ${v.confidence < 40 ? 'tone-neg' : ''}`} data-home="parentConf">{F.idx(v.confidence)}</b>
      </Why>
    </span>
  );
}

export function ParentBudget({ s }: { s: GameStateV2 }) {
  const v = divisionView(s);
  if (!v) return null;
  const st = divisionStatus(v);
  const sched = parentSchedule(s, 8);
  const maxPay = Math.max(...sched.map((x) => x.amount), 1e-9);
  const avail = Math.max(0, v.available);
  const scale = Math.max(avail, v.spent, 1e-6);
  const elapsed = Math.max(0, Math.min(1, 1 - (v.reviewDay - s.time.day) / 365));
  const review = fmtDate(dateOf(s, v.reviewDay));
  const col = st.tone === 'bad' ? C.bad : st.tone === 'watch' ? C.watch : C.good;
  return (
    <Card title={<Term id="parentBudget">Parent budget</Term>} home="parentBudget" id="ctl-parent" right={<ParentConf v={v} />}>
      <Tip as="div" content={() => (
        <TipCard title={<><Term id="parentBudget">Budget</Term> {yearLabel(s, v)}</>} value={F.money(v.budget)} rows={[
          { label: "Parent's plan", value: F.money(v.plan) },
          { label: 'Factor', value: `${F.pct(v.factor)} at confidence ${F.idx(v.setAt)}` },
          { label: v.carryIn < 0 ? 'Advance carried in' : 'Savings carried in', value: F.money(v.carryIn, { signed: true }), tone: v.carryIn < 0 ? 'neg' : 'neutral' },
          { label: 'Paid so far', value: F.money(v.paid) },
          { label: 'Spent so far', value: F.money(v.spent) },
          { label: 'Cash at the review (projected)', value: F.money(v.projectedEnd, { signed: true }), tone: v.projectedEnd < 0 ? 'neg' : 'pos' },
        ]} footer="Spent = carried in + paid so far − cash. The mark is how far through the year you are.">{"Paid in four quarterly payments. Unspent budget stays as cash; past it the parent pays the bills and its later payments repay it first. See [[parentBudget]]."}</TipCard>
      )}>
        <div className="div-year" data-test="division-year">
          <span className="small"><span className="dim">Budget {yearLabel(s, v)}</span> <b className="num">{F.money(v.budget)}</b>{v.carryIn !== 0 && <span className="dim"> {v.carryIn > 0 ? '+' : '−'} {F.money(Math.abs(v.carryIn))} {v.carryIn > 0 ? 'saved' : 'advance'}</span>}</span>
          <HBar v={v.spent} max={scale} w="100%" h={10} color={col} mark={elapsed * avail} />
          <span className="small num"><span className="dim">spent</span> {F.money(v.spent)}</span>
        </div>
      </Tip>
      <Tip as="div" content={() => (
        <TipCard title={<Term id="parentReview">At the review</Term>} value={review} rows={[
          { label: 'Overspend the parent would be covering', value: F.money(v.coverAtReview), tone: v.coverAtReview > 0 ? 'neg' : 'neutral' },
          { label: <Term id="parentConf">Confidence</Term>, value: v.coverConf < 0 ? `${Math.round(v.coverConf)} for it` : 'no cost' },
        ]} footer={`Confidence −${DIVISION.overConf} × overspend ÷ budget, at most −${DIVISION.overConf}, at every review while the parent is still covering it.`}>{"Over budget = spent more than this year's budget and savings. A division cannot go broke: the parent pays the bills."}</TipCard>
      )}>
        <div className={`div-status tone-${st.tone === 'bad' ? 'neg' : st.tone === 'watch' ? 'warn' : 'pos'}`} data-test="division-status" data-status={v.status}>{st.text}</div>
      </Tip>
      <div className="div-facts small">
        <Tip content={() => <TipCard title={<Term id="parentReview">Parent review</Term>} value={review}>{"The parent judges the goals, minds any overspend and sets the next budget."}</TipCard>}>
          <span><span className="dim">review</span> {review} <span className="dim">· in {Math.max(0, v.reviewDay - s.time.day)} d</span></span>
        </Tip>
        <Tip content={() => <TipCard title={<Term id="parentGoal">Parent goals</Term>} rows={[{ label: 'Live', value: String(v.goals.length) }, { label: 'Behind', value: String(v.behind), tone: v.behind ? 'neg' : 'neutral' }]}>{"Each with its progress in What we owe."}</TipCard>}>
          <span data-ref="whatWeOwe" data-test="division-goals"><span className="dim"><Term id="parentGoal">goals</Term></span> {v.goals.length}{v.behind ? <span className="tone-neg"> · {v.behind} behind</span> : null}</span>
        </Tip>
        <Tip content={() => <TipCard title="Next year's budget" value={F.money(v.next.budget)} rows={[{ label: "Parent's plan", value: F.money(v.next.plan) }, { label: 'Factor at today\'s confidence', value: `${F.pct(v.next.factor)} (${F.idx(v.confidence)})` }, { label: 'Rule', value: `min(100%, ${F.pct(DIVISION.floor)} + confidence ÷ ${Math.round(DIVISION.fullAt / (1 - DIVISION.floor))})` }, { label: 'At confidence 60', value: F.money(v.next.plan * budgetFactor(60)) }]}>{"Set at the review from parent confidence then: missed goals and overspend cut it, results restore it."}</TipCard>}>
          <span data-test="division-next"><span className="dim">next year ≈</span> <b className="num">{F.money(v.next.budget)}</b></span>
        </Tip>
        <span className="sp" />
        <GoBtn to={{ panel: 'finance', tab: 'owe' }} label="Goals" testId="fin.go.goals" />
      </div>
      <div className="lim-rows">
        {sched.map((x) => (
          <div className={`lim-row ${x.estimate ? 'dim' : ''}`} key={x.q} data-q={x.q}>
            <span className="small">{qLabel(s, x.q)}{x.estimate ? ' · est.' : ''}</span>
            <HBar v={x.amount} max={maxPay} w="100%" h={8} color={x.estimate ? '#6b7c91' : C.good} />
            <Tip content={() => <TipCard title={`Budget ${qLabel(s, x.q)}`}>{x.estimate ? `Paid on ${fmtDate(dateOf(s, x.day))}. Estimate: the parent sets that year's budget at its review (plan × the factor at today's confidence).` : `Paid on ${fmtDate(dateOf(s, x.day))}: a quarter of this year's budget.`}</TipCard>}>
              <span className="num">{F.money(x.amount)}</span>
            </Tip>
          </div>
        ))}
      </div>
      <div className="fin-foot">
        <span className="dim small" data-test="division-reason">{DIVISION_REASON}</span>
      </div>
    </Card>
  );
}
