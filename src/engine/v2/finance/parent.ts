// Big-tech division money (FINANCE-V3 §13, FINANCE-BUILD FIN5c; STRUCTURE §4.8; research/18 §3.2). Owner: WS3.
//
// A division of a big-tech parent has no equity and no valuation. The parent sets an annual budget (budget years run
// Jul–Jun) and pays it at each quarter start; product revenue goes to the parent (booked, then transferred: the
// statements still show it). Cash is the budget balance: unspent budget stays for later years; cash below zero is the
// parent's advance (it pays the bills, so a division cannot go broke) and later payments repay it. At each year's review
// (the first quarter start of a budget year):
// 1. the year's goals are judged (finance/promises.ts: the promise mechanism, set by the parent instead of a pitch);
//    met and missed goals move parent confidence (the division's board confidence: one meter, the board machinery);
// 2. the parent minds any overspend it is still covering (cash below zero after the year's last payment, whatever year
//    it came from): parent confidence −30 × overspend ÷ the year's budget, at most −30, × the board's multiplier for
//    setbacks. It keeps covering it: the coming payments repay it first;
// 3. it sets this year's budget = its plan (the capex path, data/v2/starts.ts) × a factor read off parent confidence,
//    min(1, 0.5 + confidence ÷ 120): the full plan at 60 (where confidence drifts) or above, half at 0. This is how
//    misses and overspend cut the budget, and results restore it;
// 4. it sets the new year's goals: capability, scale and adoption on the division's trend at the base pitch (as a
//    raise's base pitch), a third each (adoption is skipped while there is no revenue to extrapolate).
// The government as controller (CORPORATE.md §3.2) is the same machine with two differences: it does not take the
// company's revenue, and its yearly goals are three plain checks (security level at its floor, still ahead of China's lab,
// no incident of severity 4 or more), each ± a third of a promise result on confidence at the next review.
// No outside equity, deals or debt (the parent's treasury borrows); no bankruptcy. No runway distress verdict (board.ts).
// The board's ouster vote is held as under any board (CORPORATE.md §3.3): the parent's seats vote it.
// (Covering an overspend by writing it off would make overspending free money at a bounded confidence cost: the advance
// is repaid from later budgets instead, and minded at every review while it is outstanding.)
//
// Control can change mid-game (CORPORATE.md §3.2, §4): controlCheck (daily, in opex) compares the controller with the
// one last seen; a partner that takes control starts the owner budget at the company's last four quarters of spending.
import { parentBudgetYear } from '../../../data/v2/starts';
import { controllerOf, holderName, ownerFunded } from './control';
import { leadDays } from '../actors/intel';
import { CHINA_ID } from '../models/labs';
import { decimalYear } from '../core/time';
import { wslFloor } from '../security/security';
import { dayOfQuarter } from '../core/time';
import type { Day, DivisionBudget, DivisionReview, FinancePromise, GameStateV2, GovGoalId, Money, SystemCtx } from '../types';
import { cumulativeCapex } from './ext';
import { bookCash, qOf } from './ledger';
import { boardMood, moodWeight } from './mood';
import { livePromises, makeThesis, MILESTONES, PROMISE_RESULT, promiseDeadline, promiseStatus, type PromiseStatus } from './promises';
import { runwayOf } from './runway';

/** Why an equity, deal or debt action is unavailable to a division (undefined for other companies). */
export const DIVISION_REASON = 'A division of the parent: no outside equity, deals or debt (the parent funds you)';
export const divisionBlock = (s: GameStateV2): string | undefined => (ownerFunded(s) ? DIVISION_REASON : undefined);

/** The parent's budget rule [D, FIN5c]: budget = plan × min(1, floor + confidence × (1 − floor) ÷ fullAt); overspend
 *  costs overConf × overspend ÷ budget confidence, at most overConf (overspending a whole year's budget weighs as much as
 *  missing every goal: PROMISE_RESULT ±30 × weight); at most `keep` reviews are kept for display. */
export const DIVISION = { floor: 0.5, fullAt: 60, overConf: 30, keep: 4 } as const;

/** Budget factor at a parent confidence (0–100). */
export const budgetFactor = (confidence: number) => Math.max(DIVISION.floor, Math.min(1, DIVISION.floor + (confidence * (1 - DIVISION.floor)) / DIVISION.fullAt));

/** Budget year of quarter q (Q3 2025 = 0): quarters 4y … 4y + 3. */
export const budgetYearOf = (q: number) => Math.floor(q / 4);
/** First day of budget year y (its review and first payment). */
export const budgetYearStart = (s: GameStateV2, y: number): Day => dayOfQuarter(s.time.startDate, 4 * y);

/** The owner's plan for budget year `y`: the parent path (data/v2/starts.ts), × the scale an owner that took control
 *  mid-game set it to. */
const planOf = (d: Pick<DivisionBudget, 'planScale'>, y: number): Money => parentBudgetYear(y) * (d.planScale ?? 1);

function newYear(year: number, confidence: number, carryIn: Money, paid: Money, reviews: DivisionReview[], planScale = 1): DivisionBudget {
  const plan = planOf({ planScale }, year);
  const factor = budgetFactor(confidence);
  return { year, plan, budget: plan * factor, factor, confidence, carryIn, paid, reviews, ...(planScale !== 1 ? { planScale } : {}) };
}

/** The parent's goals for the year starting now: one per milestone type at the base pitch on the division's trend. */
function setGoals(s: GameStateV2, budget: Money, ctx?: SystemCtx): FinancePromise[] {
  const day = s.time.day;
  const theses = MILESTONES.map((type) => makeThesis(s, type, 'base')).filter((t) => typeof t !== 'string');
  const w = theses.length ? 1 / theses.length : 0;
  const goals: FinancePromise[] = theses.map((t) => ({ ...t, id: `PG${day}-${t.type}`, amount: budget, closeDay: day, deadline: promiseDeadline(s, day), by: 'parent' as const, goalWeight: w }));
  (s.player.finance.promises ??= []).push(...goals);
  ctx?.log('finance', `The parent sets this year's goals: ${goals.map((g) => g.type).join(', ')} on your trend, judged at the next review.`);
  return goals;
}

/** The government's goals (CORPORATE.md §3.2): each a plain check on today's state. `since` = the day the goals were set. */
export const GOV_GOALS: readonly GovGoalId[] = ['security', 'lead', 'incident'];
export function govGoalCheck(s: GameStateV2, id: GovGoalId, since: Day): { label: string; met: boolean; detail: string } {
  if (id === 'security') {
    const floor = wslFloor(decimalYear(s) - 2025);
    return { label: "Security level at or above the government's floor", met: s.player.security.wsl >= floor - 1e-9, detail: `level ${s.player.security.wsl.toFixed(1)} vs the floor ${floor.toFixed(1)}` };
  }
  if (id === 'lead') {
    const est = leadDays(s, CHINA_ID).est;
    return { label: "Still ahead of China's lab", met: est > 0, detail: `your estimated lead over China: ${Math.round(est)} days` };
  }
  const bad = s.player.safety.incidents.filter((i) => i.day >= since && i.severity >= 4).length;
  return { label: 'No incident of severity 4 or more this year', met: bad === 0, detail: bad === 0 ? 'none this year' : `${bad} this year` };
}

/** Judge last year's government goals at the review: confidence ± the promise result × a third each, as a parent's goal. */
function judgeGovGoals(s: GameStateV2, ctx: SystemCtx, d: DivisionBudget): NonNullable<DivisionReview['gov']> | undefined {
  if (!d.govGoals) return undefined;
  const k = moodWeight(s, 'results');
  return d.govGoals.map((id) => {
    const c = govGoalCheck(s, id, d.govGoalsDay ?? 0);
    const delta = (c.met ? PROMISE_RESULT.metBoard : PROMISE_RESULT.missBoard) * (1 / GOV_GOALS.length) * k;
    ctx.bump('board.confidence', delta, c.met ? 'government goal met' : 'government goal missed', c.label);
    ctx.log('finance', `Government goal ${c.met ? 'met' : 'missed'}: ${c.label} (${c.detail}).`, c.met ? 1 : 2);
    return { id, ...c };
  });
}

/** A division's budget state (newGame creates it, startDivision). */
export function divisionOf(s: GameStateV2): DivisionBudget | undefined {
  return ownerFunded(s) ? s.player.finance.ws3.division : undefined;
}

/** newGame: budget year 0 at the plan (the Q3 2025 payment is in the starting cash) and its goals. */
export function startDivision(s: GameStateV2): void {
  if (!ownerFunded(s)) return;
  const d = newYear(0, s.player.board.confidence, 0, 0, []);
  d.paid = d.budget / 4;
  d.carryIn = s.player.finance.cash - d.paid;
  s.player.finance.ws3.division = d;
  setGoals(s, d.budget);
}

/** The company's spending over the last four quarters ($B): operating costs (the quarter tallies capitalQ rolls into
 *  `opCost4q`) plus capex (`capex4q`). With fewer than four quarters on record: those and the quarter so far, scaled to
 *  a year. */
export function spendLastYear(s: GameStateV2): Money {
  const fx = s.player.finance.ws3;
  const op = fx.opCost4q ?? [];
  const cx = fx.capex4q;
  const n = Math.min(4, op.length, cx.length);
  const last = (xs: Money[]) => xs.slice(xs.length - n).reduce((a, b) => a + b, 0);
  if (n >= 4) return last(op) + last(cx);
  const days = n * 91.25 + Math.max(0, s.time.day - dayOfQuarter(s.time.startDate, qOf(s)));
  const total = last(op) + last(cx) + fx.accQ.opCosts + (cumulativeCapex(s) - fx.capexCumAtQ);
  return days > 0 ? (total * 365) / days : 0;
}

/** A partner that took control mid-game starts the owner budget (CORPORATE.md §3.2): this budget year's plan is the
 *  company's spending over the last four quarters, later years grow on the parent path from there; the cash on hand
 *  carries in, the quarter payments start at the next quarter, and the parent sets its goals at the next review. */
export function startOwnerBudget(s: GameStateV2, ctx: SystemCtx): void {
  const y = budgetYearOf(qOf(s));
  const spend = spendLastYear(s);
  const d = newYear(y, s.player.board.confidence, s.player.finance.cash, 0, [], spend / parentBudgetYear(y));
  s.player.finance.ws3.division = d;
  ctx.log('finance', `The owner budget starts: $${d.budget.toFixed(1)}B this year (your last four quarters' spending, $${spend.toFixed(1)}B, × ${Math.round(d.factor * 100)}% at confidence ${d.confidence.toFixed(0)}), paid at each quarter start. ${controllerOf(s)?.kind === 'government' ? 'You keep your revenue' : 'Revenue now goes to the owner'}; it sets your goals at its review.`, 3);
}

/** Daily (opex): has the controller changed since last seen (a rescue, a tranche, a sale)? Log and headline it; a
 *  partner that now controls and funds the company starts the owner budget; a company no longer owner-funded stops it.
 *  The first look only records the controller (a new game, or a save made before this was stored). */
export function controlCheck(s: GameStateV2, ctx: SystemCtx): void {
  const fx = s.player.finance.ws3;
  const c = controllerOf(s);
  const id = c?.id ?? null;
  if (fx.controllerId === undefined) {
    fx.controllerId = id;
    return;
  }
  if (fx.controllerId === id) return;
  fx.controllerId = id;
  if (c) {
    const who = holderName(c);
    const verb = c.kind === 'founders' ? 'control' : 'controls';
    ctx.log('alert', `${who} now ${verb} ${s.player.name}: more than half of all votes.`, 4);
    ctx.headline('control', `${who} now ${verb} ${s.player.name}`);
  } else ctx.log('alert', `No single holder controls ${s.player.name} any more: the board runs by vote.`, 3);
  if ((c?.kind === 'partner' || c?.kind === 'government') && ownerFunded(s)) startOwnerBudget(s, ctx);
  else if (!ownerFunded(s) && fx.division) {
    delete fx.division;
    ctx.log('finance', 'The owner budget stops: the company funds itself again.', 2);
  }
}

/** Payment ($B) at the start of quarter q: a quarter of that year's budget; later years at the plan × today's factor
 *  (an estimate: the parent sets them at their reviews). */
export function parentPaymentQ(s: GameStateV2, q: number): Money {
  const d = divisionOf(s);
  if (!d || q < 0) return 0;
  const y = budgetYearOf(q);
  if (y <= d.year) return (y === d.year ? d.budget : planOf(d, y)) / 4;
  return (planOf(d, y) * budgetFactor(s.player.board.confidence)) / 4;
}

export interface ParentPayment { q: number; day: Day; amount: Money; /** Set at a later review: an estimate today. */ estimate: boolean }

/** The next `n` payments (the schedule the Finance panel shows). */
export function parentSchedule(s: GameStateV2, n = 8): ParentPayment[] {
  const q0 = qOf(s) + 1;
  const y = divisionOf(s)?.year ?? 0;
  return Array.from({ length: n }, (_, i) => ({ q: q0 + i, day: dayOfQuarter(s.time.startDate, q0 + i), amount: parentPaymentQ(s, q0 + i), estimate: budgetYearOf(q0 + i) > y }));
}

/** The year's review (the first quarter start of a budget year, after the goals were judged in capitalQ). */
function review(s: GameStateV2, ctx: SystemCtx, d: DivisionBudget, year: number): void {
  const f = s.player.finance;
  const spent = d.carryIn + d.paid - f.cash;
  const over = Math.max(0, -f.cash);
  let overConf = 0;
  if (over > 0) {
    overConf = boardMood(s, ctx, 'setbacks', -DIVISION.overConf * Math.min(1, over / Math.max(1e-6, d.budget)), 'over budget', `$${over.toFixed(1)}B over the $${d.budget.toFixed(1)}B budget`);
  }
  const govCtl = controllerOf(s)?.kind === 'government';
  const gov = govCtl ? judgeGovGoals(s, ctx, d) : undefined;
  const judged = (f.promises ?? []).filter((p) => p.by === 'parent' && p.result && p.result.day === s.time.day);
  const count = (o: 'met' | 'near' | 'missed') => judged.filter((p) => p.result!.outcome === o).length;
  const goals = gov ? { met: gov.filter((x) => x.met).length, near: 0, missed: gov.filter((x) => !x.met).length } : { met: count('met'), near: count('near'), missed: count('missed') };
  const rv: DivisionReview = { year: d.year, day: s.time.day, budget: d.budget, spent, over, overConf, goals, ...(gov ? { gov } : {}) };
  const next = newYear(year, s.player.board.confidence, 0, 0, [...d.reviews, rv].slice(-DIVISION.keep), d.planScale);
  next.carryIn = f.cash; // signed: an outstanding advance is repaid from this year's payments first
  f.ws3.division = next;
  ctx.log('finance', `${govCtl ? 'Government' : 'Parent'} review: goals ${goals.met} met, ${goals.missed} missed${over > 0 ? `; it is covering $${over.toFixed(1)}B of overspend (confidence ${overConf.toFixed(0)}), repaid from this year's payments first` : ''}. This year's budget: $${next.budget.toFixed(1)}B (plan $${next.plan.toFixed(1)}B × ${Math.round(next.factor * 100)}% at confidence ${next.confidence.toFixed(0)}).`, goals.missed || over > 0 ? 2 : 1);
  if (govCtl) {
    next.govGoals = [...GOV_GOALS];
    next.govGoalsDay = s.time.day;
    ctx.log('finance', `The government sets this year's goals: ${GOV_GOALS.map((id) => govGoalCheck(s, id, s.time.day).label.toLowerCase()).join('; ')}. Judged at the next review.`);
  } else setGoals(s, next.budget, ctx);
}

/** Quarterly (capitalQ, after the goals are judged and the histories roll): the year's review at a budget-year start,
 *  then the quarter's payment. */
export function divisionQ(s: GameStateV2, ctx: SystemCtx): void {
  const d = divisionOf(s);
  if (!d) return;
  const q = qOf(s);
  if (budgetYearOf(q) > d.year) review(s, ctx, d, budgetYearOf(q));
  const cur = s.player.finance.ws3.division!;
  const amt = cur.budget / 4;
  if (amt > 0) {
    bookCash(s, ctx, amt, 'financing', 'parent budget', `quarter ${q}`);
    cur.paid += amt;
  }
}

/** Revenue goes to a parent company: book the day's revenue, then hand it over (both lines stay on the statement). The
 *  government, unlike a parent, does not take it: the company keeps its revenue on top of the budget. */
export function revenueToParent(s: GameStateV2, ctx: SystemCtx, amount: Money): void {
  if (amount > 0 && controllerOf(s)?.kind === 'partner') bookCash(s, ctx, -amount, 'financing', 'revenue to the parent');
}

export interface DivisionView {
  year: number;
  /** The review that closes this year (and sets the next budget). */
  reviewDay: Day;
  plan: Money;
  budget: Money;
  factor: number;
  /** Confidence when this year's budget was set. */
  setAt: number;
  carryIn: Money;
  paid: Money;
  /** Net spending since the year start (savings carried in + budget paid − cash). */
  spent: Money;
  /** Carried in (savings, or an advance still outstanding when negative) + this year's budget. */
  available: Money;
  /** Spent beyond everything this year can pay: the parent's advance past this year's payments still to come. */
  over: Money;
  /** Cash projected at the review, before its payment (the cash projection: spending held flat, known payments). */
  projectedEnd: Money;
  /** 'over': spent past this year's budget and savings; 'course': on course to (projected); 'within'. */
  status: 'over' | 'course' | 'within';
  /** Overspend the parent would still be covering at the review on the projection, and the confidence it would cost. */
  coverAtReview: Money;
  coverConf: number;
  confidence: number;
  /** Next year's budget at today's confidence (the parent sets it at the review). */
  next: { year: number; plan: Money; factor: number; budget: Money };
  goals: PromiseStatus[];
  behind: number;
  last?: DivisionReview;
}

/** Everything the division readouts show (Finance › Parent budget, top strip, core loop, Watch). */
export function divisionView(s: GameStateV2): DivisionView | undefined {
  const d = divisionOf(s);
  if (!d) return undefined;
  const f = s.player.finance;
  const reviewDay = budgetYearStart(s, d.year + 1);
  const spent = d.carryIn + d.paid - f.cash;
  const available = d.carryIn + d.budget;
  const over = Math.max(0, spent - available);
  const pt = runwayOf(s).path.find((p) => p.day >= reviewDay);
  const projectedEnd = pt ? pt.cash : f.cash;
  const coverAtReview = Math.max(0, -projectedEnd, over);
  const coverConf = -DIVISION.overConf * Math.min(1, coverAtReview / Math.max(1e-6, d.budget)) * moodWeight(s, 'setbacks');
  const confidence = s.player.board.confidence;
  const plan = planOf(d, d.year + 1);
  const factor = budgetFactor(confidence);
  const goals = livePromises(s).filter((p) => p.by === 'parent').map((p) => promiseStatus(s, p));
  return {
    year: d.year, reviewDay, plan: d.plan, budget: d.budget, factor: d.factor, setAt: d.confidence, carryIn: d.carryIn, paid: d.paid,
    spent, available, over, projectedEnd, status: over > 0 ? 'over' : coverAtReview > 0 ? 'course' : 'within', coverAtReview, coverConf, confidence,
    next: { year: d.year + 1, plan, factor, budget: plan * factor }, goals, behind: goals.filter((g) => g.state === 'behind').length,
    ...(d.reviews.length ? { last: d.reviews[d.reviews.length - 1] } : {}),
  };
}

/** Budget room ($B) for a division head who keeps to the budget (the bots' guard, finance/plan.ts): the lowest cash the
 *  projection shows at the next two reviews (below zero = an overspend the parent would be covering), less a quarter's
 *  payment of margin (the projection holds spending flat and misses one-off costs) [D]. +∞ for other companies. */
export function budgetRoom(s: GameStateV2): Money {
  const d = divisionOf(s);
  if (!d) return Number.POSITIVE_INFINITY;
  const margin = d.budget / 4;
  const reviews = [budgetYearStart(s, d.year + 1), budgetYearStart(s, d.year + 2)];
  const path = runwayOf(s).path;
  let low = Number.POSITIVE_INFINITY;
  for (const r of reviews) {
    const pt = path.find((p) => p.day >= r);
    if (pt) low = Math.min(low, pt.cash);
  }
  return low - margin;
}
