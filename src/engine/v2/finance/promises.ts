// Round theses, stacking promises and investor credibility (FINANCE-V3 §2.2–§2.4; FINANCE-BUILD FIN2). Owner: WS3.
//
// Every priced round is raised on one milestone (capability: a public model level; scale: compute online; adoption: a
// revenue run-rate) 12 months after it closes, pitched conservative / base / aggressive against your own trend. Each
// round leaves one promise; promises stack and each is judged at its own deadline, weighted by its round's share of
// what was raised in the year to that deadline. Promises are expectations, not contracts: they move investor
// credibility and board confidence, never cash. Credibility (0–100, a four-rung ladder) multiplies the valuation mark
// (interim until FIN5 moves it into the valuation share).
import { dayOfQuarter, quarterIndex } from '../core/time';
import type { Day, FinancePromise, GameStateV2, MilestoneType, Pitch, StartType, SystemCtx, Thesis } from '../types';
import { moodWeight } from './mood';
import { computeFirm, computeOnline, computeSecured, publicLevel, revenueRun } from './observe';

export const MILESTONES: MilestoneType[] = ['capability', 'scale', 'adoption'];
export const PITCHES: Pitch[] = ['conservative', 'base', 'aggressive'];

/** Pitch price (× the valuation mark) and target (× the trend's expected 12-month gain) [D, spec §2.2]. */
export const PITCH: Record<Pitch, { price: number; gain: number }> = {
  conservative: { price: 0.85, gain: 0.8 },
  base: { price: 1, gain: 1 },
  aggressive: { price: 1.2, gain: 1.3 },
};

/** Credibility ladder [D, spec §1, §2.4]: rung floors and the valuation multiplier. */
export const CRED_RUNGS = [
  { id: 'Doubted', min: 0, mult: 0.7 },
  { id: 'Unproven', min: 25, mult: 0.9 },
  { id: 'Credible', min: 50, mult: 1 },
  { id: 'Proven', min: 75, mult: 1.15 },
] as const;

/** Results at the deadline [D, spec §2.4]: met +30 × weight credibility, +10 × weight board; missed by more than 20% of
 *  the promised gain −30 / −15 × weight; within 20% nothing. The board's part is then × the board's multiplier for
 *  promise results (FIN3a, by seat kind: financial ×1.5, independent ×1, mission ×0.5). */
export const PROMISE_RESULT = { metCred: 30, missCred: -30, metBoard: 30, missBoard: -30, band: 0.2 } as const;

/** Start credibility by start type [D, spec §2.4]: leader Credible 60, challenger Credible 50, spinout Unproven 40. A
 *  division raises no equity (50, never read). */
export const START_CREDIBILITY: Record<StartType, number> = { leader: 60, challenger: 50, spinout: 40, bigtech: 50 };

/** Trend floors and caps per year [D]: a flat or falling trend still asks for some progress (+0.2 levels, +10%); a
 *  runaway one is capped (+4 levels, ×8). */
export const TREND = { minLevels: 0.2, maxLevels: 4, minGrowth: 0.1, maxGrowth: 7 } as const;

/** A promise is "behind" once a quarter of its year has passed and its progress trails the needed-by-now path by more
 *  than this share of the promised gain [D]. */
export const BEHIND_GAP = 0.2;
/** A trend needs about a year of quarter-start history (spec: "trend extrapolated 12 months"); shorter spans
 *  annualise lumpy steps (a site going live) into runaway trends [D]. */
export const TREND_MIN_YEARS = 0.9;
/** Below this span there is no trend yet (fallbacks: the market's frontier pace, the contracted pipeline) [D]. */
export const TREND_SHORT_YEARS = 0.45;
/** Judged promises kept for display [D]. */
export const KEEP_JUDGED = 8;

export const credRung = (c: number): (typeof CRED_RUNGS)[number] => [...CRED_RUNGS].reverse().find((r) => c >= r.min) ?? CRED_RUNGS[0];

/** The milestone metric now: public level (capability), H100e online that you own or hold on firm contracts (scale;
 *  FIN4r L6: no spot rentals or cancellable cloud), revenue run-rate $B/yr (adoption). */
export function metricNow(s: GameStateV2, type: MilestoneType): number {
  return type === 'capability' ? publicLevel(s) : type === 'scale' ? computeFirm(s) : revenueRun(s);
}

/** Record the quarter-start values of the capability and scale metrics (newGame for day 0, then capitalQ; revenue keeps
 *  its own history). */
export function recordThesisHist(s: GameStateV2): void {
  const h = (s.player.finance.ws3.thesisHist ??= { L: [], H: [] });
  h.L.push(publicLevel(s));
  h.H.push(computeFirm(s));
  if (h.L.length > 5) h.L.shift();
  if (h.H.length > 5) h.H.shift();
}

/** Years between the oldest usable entry of a quarter-start history (≈ 4 quarters back) and now. The last entry is the
 *  latest quarter start. The seeded revenue history starts with the four quarters before day 0 (`seededBefore`): its
 *  last entry in the first quarter is the quarter before day 0. */
function span(s: GameStateV2, n: number, seededBefore = false): { k: number; years: number } {
  const k = Math.max(0, n - 5);
  const q = quarterIndex(s.time.startDate, s.time.day);
  const lastPush = seededBefore && q < 1 ? -91 : dayOfQuarter(s.time.startDate, q);
  return { k, years: (n - 1 - k) / 4 + (s.time.day - lastPush) / 365 };
}

export interface Trend {
  type: MilestoneType;
  /** Metric now and its expected gain over the next 12 months on the current trend (floored, capped). */
  now: number;
  gain: number;
  /** How the trend was read (tooltip). */
  basis: string;
  /** Why this milestone cannot be pitched now. */
  blocked?: string;
}

/** The current trend of a milestone metric extrapolated 12 months (spec §2.2 "your current trend"). */
export function trendOf(s: GameStateV2, type: MilestoneType): Trend {
  const now = metricNow(s, type);
  if (type === 'capability') {
    const h = s.player.finance.ws3.thesisHist?.L ?? [];
    const { k, years } = span(s, h.length);
    let perYear: number;
    let basis: string;
    if (h.length >= 2 && years >= TREND_SHORT_YEARS) {
      perYear = (now - h[k]) / years;
      basis = `public level ${h[k].toFixed(1)} → ${now.toFixed(1)} over ${(years * 12).toFixed(0)} months`;
    } else {
      perYear = 4 * (s.capital.ws3?.expectedDL ?? 0.3);
      basis = 'no track record yet: the market\'s expected frontier pace';
    }
    const gain = Math.max(TREND.minLevels, Math.min(TREND.maxLevels, perYear));
    return { type, now, gain, basis };
  }
  if (type === 'adoption' && now < 0.1) return { type, now, gain: 0, basis: 'no revenue yet', blocked: 'No revenue to extrapolate yet' };
  const hist = type === 'scale' ? s.player.finance.ws3.thesisHist?.H ?? [] : s.player.finance.revenueHistory;
  const { k, years } = span(s, hist.length, type === 'adoption');
  let growth: number = TREND.minGrowth;
  let basis = 'no track record yet';
  const what = type === 'scale' ? 'owned and firm compute online' : 'revenue run-rate';
  if (hist.length >= 2 && years >= TREND_SHORT_YEARS && hist[k] > 0) {
    // A full year: compound growth. Half a year or more: linear (compounding a short, lumpy span overshoots).
    growth = years >= TREND_MIN_YEARS ? Math.pow(now / hist[k], 1 / years) - 1 : (now / hist[k] - 1) / years;
    basis = `${what} ×${(now / hist[k]).toFixed(2)} over ${(years * 12).toFixed(0)} months`;
  }
  if (type === 'scale' && now > 0) {
    // A CEO never pitches less than the compute already contracted: half of what is secured for the next 8 quarters
    // arrives within the year.
    const pipe = (computeSecured(s) - computeOnline(s)) / now / 2;
    if (pipe > growth) {
      growth = pipe;
      basis = 'half of the compute contracted for the next 8 quarters';
    }
  }
  const g = Math.max(TREND.minGrowth, Math.min(TREND.maxGrowth, growth));
  return { type, now, gain: now * g, basis };
}

/** Whether a pitch is open: aggressive needs Credible or Proven (spec §2.2). */
export function pitchAvailable(s: GameStateV2, pitch: Pitch): true | string {
  if (pitch !== 'aggressive') return true;
  const r = credRung(s.player.finance.credibility);
  return r.min >= 50 ? true : `Aggressive pitches need Credible or Proven credibility (you: ${r.id})`;
}

/** The thesis a round would sign now: start value and target for a milestone and pitch, or why not. */
export function makeThesis(s: GameStateV2, type: MilestoneType, pitch: Pitch): Thesis | string {
  const t = trendOf(s, type);
  if (t.blocked) return t.blocked;
  const ok = pitchAvailable(s, pitch);
  if (ok !== true) return ok;
  return { type, pitch, start: t.now, target: t.now + PITCH[pitch].gain * t.gain };
}

/** Deadline of a promise from a round closing on `closeDay`: four quarter starts later (12 months). */
export const promiseDeadline = (s: GameStateV2, closeDay: Day) => dayOfQuarter(s.time.startDate, quarterIndex(s.time.startDate, closeDay) + 4);

/** Weight of a promise (spec §2.3): its round's amount ÷ the amount raised in the year to its deadline (this round and
 *  every later one closed before the deadline). Before the deadline it reads the rounds so far; it can only fall.
 *  FIN4r (H2): ÷ at least a typical round at the close (`typical`: d_max · pre-money ÷ (1 − d_max), stored at the
 *  close), so a $0.1B round no longer buys a full-weight promise; stacking stays weight-neutral for normal rounds (four
 *  ceiling-sized rounds in a year weigh about 25% each, one about 100%). */
export function promiseWeight(s: GameStateV2, p: FinancePromise): number {
  if (p.goalWeight !== undefined) return p.goalWeight; // a parent goal: its fixed share of the year (FIN5c)
  const end = Math.min(p.deadline, s.time.day + 1);
  const raised = s.player.finance.rounds.filter((r) => r.day >= p.closeDay && r.day < end).reduce((a, r) => a + r.amount, 0);
  return Math.min(1, p.amount / Math.max(p.amount, raised, p.typical ?? 0));
}

/** A typical round at a close (FIN4r, H2): what the dilution limit allows at that pre-money, d·pre/(1 − d). */
export const typicalRound = (pre: number, dMax: number) => (dMax * Math.max(0, pre)) / (1 - dMax);

/** Progress of a value from start (0) to target (1). */
export const progressOf = (p: Thesis, v: number) => (v - p.start) / Math.max(1e-9, p.target - p.start);

/** Value needed by `day` on the path from start to target: geometric for scale and adoption, linear for levels. */
export function neededBy(p: Thesis & { closeDay: Day; deadline: Day }, day: Day): number {
  const tau = Math.max(0, Math.min(1, (day - p.closeDay) / Math.max(1, p.deadline - p.closeDay)));
  if (p.type === 'capability' || p.start <= 0) return p.start + (p.target - p.start) * tau;
  return p.start * Math.pow(p.target / p.start, tau);
}

export interface PromiseStatus {
  p: FinancePromise;
  value: number;
  progress: number;
  needed: number;
  neededProgress: number;
  daysLeft: number;
  weight: number;
  state: 'ahead' | 'on track' | 'behind';
  /** What judging it today would do (credibility, board) at today's weight. */
  ifJudgedNow: { outcome: 'met' | 'near' | 'missed'; cred: number; board: number };
}

export function outcomeOf(progress: number): 'met' | 'near' | 'missed' {
  return progress >= 1 ? 'met' : progress >= 1 - PROMISE_RESULT.band ? 'near' : 'missed';
}
/** Credibility and board effects of an outcome at weight w; the board part includes this board's multiplier. A
 *  parent goal (FIN5c) moves parent confidence (the division's board) the same way and no credibility (no investors). */
const effects = (s: GameStateV2, o: 'met' | 'near' | 'missed', w: number, p?: FinancePromise) => {
  const k = moodWeight(s, 'results');
  const c = p?.by === 'parent' ? 0 : 1;
  return o === 'met' ? { cred: c * PROMISE_RESULT.metCred * w, board: PROMISE_RESULT.metBoard * w * k } : o === 'missed' ? { cred: c * PROMISE_RESULT.missCred * w, board: PROMISE_RESULT.missBoard * w * k } : { cred: 0, board: 0 };
};

/** Live state of a promise (What we owe, Watch). */
export function promiseStatus(s: GameStateV2, p: FinancePromise): PromiseStatus {
  const value = metricNow(s, p.type);
  const progress = progressOf(p, value);
  const needed = neededBy(p, s.time.day);
  const neededProgress = progressOf(p, needed);
  const tau = (s.time.day - p.closeDay) / Math.max(1, p.deadline - p.closeDay);
  const state = progress >= 1 ? 'ahead' : tau >= 0.25 && progress < neededProgress - BEHIND_GAP ? 'behind' : 'on track';
  const weight = promiseWeight(s, p);
  const o = outcomeOf(progress);
  return { p, value, progress, needed, neededProgress, daysLeft: Math.max(0, p.deadline - s.time.day), weight, state, ifJudgedNow: { outcome: o, ...effects(s, o, weight, p) } };
}

export const livePromises = (s: GameStateV2) => (s.player.finance.promises ?? []).filter((p) => !p.result);

/** A round closed: its thesis becomes a promise due four quarter starts later. */
export function addPromise(s: GameStateV2, ctx: SystemCtx, thesis: Thesis, amount: number, typical?: number): FinancePromise {
  const f = s.player.finance;
  const p: FinancePromise = { ...thesis, id: `PR${s.time.day}-${(f.promises ??= []).length}`, amount, closeDay: s.time.day, deadline: promiseDeadline(s, s.time.day), ...(typical !== undefined ? { typical } : {}) };
  f.promises.push(p);
  ctx.log('finance', `Promised investors ${describeTarget(p)} by ${new Date(Date.parse(s.time.startDate) + p.deadline * 864e5).toISOString().slice(0, 10)} (${p.pitch} pitch).`);
  return p;
}

/** Judge every promise whose deadline has come (capitalQ, before rounds close). */
export function judgePromises(s: GameStateV2, ctx: SystemCtx): void {
  const f = s.player.finance;
  for (const p of livePromises(s)) {
    if (p.deadline > s.time.day) continue;
    const value = metricNow(s, p.type);
    const progress = progressOf(p, value);
    const weight = promiseWeight(s, p);
    const outcome = outcomeOf(progress);
    const fx = effects(s, outcome, weight, p);
    p.result = { day: s.time.day, value, progress, outcome, weight, ...fx };
    const goal = p.by === 'parent';
    const what = `${describeTarget(p)} (${Math.round(progress * 100)}% of the ${goal ? 'goal' : 'promised'} gain, weight ${Math.round(weight * 100)}%)`;
    const word = goal ? 'goal' : 'promise';
    if (fx.cred) ctx.bump('finance.credibility', fx.cred, outcome === 'met' ? 'promise met' : 'promise missed', what);
    // The board part already carries this board's multiplier for promise results (effects).
    if (fx.board) ctx.bump('board.confidence', fx.board, `${word} ${outcome === 'met' ? 'met' : 'missed'}`, what);
    ctx.log('finance', `${goal ? 'Parent goal' : 'Investor promise'} ${outcome === 'met' ? 'met' : outcome === 'missed' ? 'missed' : 'nearly met (no effect)'}: ${what}.`, outcome === 'missed' ? 2 : 1);
  }
  const judged = f.promises.filter((p) => p.result);
  if (judged.length > KEEP_JUDGED) {
    const drop = new Set(judged.slice(0, judged.length - KEEP_JUDGED).map((p) => p.id));
    f.promises = f.promises.filter((p) => !drop.has(p.id));
  }
}

/** Metric formatted for text: level, H100e or $B/yr. */
export function fmtMetric(type: MilestoneType, v: number): string {
  if (type === 'capability') return `level ${v.toFixed(1)}`;
  if (type === 'scale') return v >= 1e6 ? `${(v / 1e6).toFixed(2)}M H100e` : `${Math.round(v / 1e3)}K H100e`;
  return `$${v >= 10 ? v.toFixed(0) : v.toFixed(1)}B/yr`;
}

/** "a public model at level 7.4" / "2.40M H100e online" / "$48B/yr revenue run-rate". */
export function describeTarget(p: Thesis): string {
  if (p.type === 'capability') return `a public model at ${fmtMetric('capability', p.target)}`;
  if (p.type === 'scale') return `${fmtMetric('scale', p.target)} online (owned or firm)`;
  return `a ${fmtMetric('adoption', p.target)} revenue run-rate`;
}
