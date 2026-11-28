// W6: the China government (design/world/OUTSIDE-WORLD.md §7). Owner: WS4. Small state (s.chinagov): tension 0-4 (a
// ladder climbed by the US lead over China, export controls and provocations, after a hold), talks 0-3 toward a treaty
// (opened by a scare or a small lead once Washington is at the clearances stage, advanced while quiet), the national
// collective (tension 2: China pools more of its compute into its lab). Every beat keys off positions achieved in the
// game (observe.ts usLeadOverChinaMonths, the US stage), never a date (SESSION-HEAD §8); AI 2027's China beats inspire
// only the order (SOURCES.md §4, §10). What reaches labs and markets: weight theft (security/theft.ts), the Taiwan hazard
// (compute/market.ts), China's chip access (npc/china.ts), the war ending (endings.ts) and a verified treaty's compute cap
// (the player's AI R&D pool, compute/power.ts poolsOf; the NPC labs' reference clock, npc/shocks.ts refYear).
import { cadencesDue } from '../core/time';
import { request, ws4r } from '../actors/state';
import { hasCommitment } from '../actors/commitments';
import { centraliseChina } from '../npc/china';
import { poolsOf } from '../compute/power';
import { USGOV, playerAttention } from './usgov';
import { frontier, incidentHeat, publicMilestones, usLeadOverChinaMonths } from './observe';
import { CHINA_ID, PLAYER_ID, otherLabs } from '../models/labs';
import { publicOf } from '../npc/public';
import type { RivalLab, ChinaGovState, ComputeSplit, EngineSystem, GameStateV2, SystemCtx } from '../types';

/** The China government's constants. [D] designer stand-ins unless marked. Registered in balance/params/worldfx.ts. */
export const CHINAGOV = {
  /** Setup: aggression scales the lead thresholds (each ÷ aggression: higher, sooner) [D, default 1]. */
  aggression: 1,
  /** Setup: willingness to bargain scales the talks conditions (the opening lead × it, the quiet periods ÷ it) [D, default 1]. */
  bargaining: 1,
  /** Days a rung's climbing condition must hold [D]. */
  holdDays: 60,
  /** Days the current rung's condition must fail before tension falls one rung (rungs 3-4 do not fall) [D]. */
  downDays: 180,
  /** Smoothed US lead (months; the mean of the last leadQuarters quarterly values, so release timing and report noise do not
   *  swing it) above which rung 1 (acquisition push) and rung 2 (national collective) climb, and rung 4's large lead [D]. */
  lead1: 6,
  leadQuarters: 4,
  /** What is at stake, as milestones the US shows publicly in the game (observe.ts publicMilestones, any US lab; index in
   *  data/world.ts MILESTONES): rung 2 needs milestone collectiveMilestone (Agent-2), rung 3 milestone coerceMilestone (SAR)
   *  or the US at stage coerceStage [D]. */
  collectiveMilestone: 2,
  coerceMilestone: 4,
  coerceStage: 3,
  /** A provocation (a detected theft, or one made public) counts like strict export controls this long (days), and adds
   *  provokeHold days to the climbing hold [D]. */
  provokeDays: 180,
  provokeHold: 30,
  /** The national collective's compute multiplier on China's lab: its AGI share 0.4 → 0.9 (AI 2027 compute forecast,
   *  research/11 #16; the old deepCentCompute rule) [sourced]. */
  centralMult: 2.25,
  /** Talks open (with the US at stage talksStage or more) after a scare (a leaked misalignment memo in the last
   *  scareDays, or incident heat above USGOV.scareHeat) or a US lead below talksLead months [D]. */
  talksStage: 2,
  scareDays: 365,
  talksLead: 3,
  /** Quiet days (no detected Chinese theft, tension at most 2) from talks to restraint, and restraint held to verified [D]. */
  quietDays: 180,
  verifyDays: 180,
  /** E23 Oppose: the public overrides the lab above this concern [D]. */
  overrideConcern: 75,
  /** Weight theft (security/theft.ts): attempts from tension theftRung; intent = theftIntentBase + theftIntentPerRung ×
   *  tension (the old start intent 20 at rung 0) [D]. */
  theftRung: 2, // the old rule's theftMinRung 2: rung 1 is the acquisition push (talent, smuggling, distillation), weight theft starts at the collective
  theftIntentBase: 20,
  theftIntentPerRung: 20,
  /** Taiwan hazard (compute/market.ts): factor 1 + taiwanLowRung × min(tension, 2) + taiwanHighRung × max(0, tension − 2),
   *  plus taiwanCoercion a quarter from rung 3 [D]. Shape intent: a disruption is rare before coercion (a mild lift on the
   *  lower rungs, not none) and likely during a prolonged coercion (0.05 a quarter is about 19% a year, on top of the
   *  steeper factor). */
  taiwanLowRung: 0.25,
  taiwanHighRung: 1.0,
  taiwanCoercion: 0.05,
  /** A verified treaty needs real political will [D]: US concern at least treatyConcern (+ USGOV.concernShift), and the
   *  leading labs accept testing (the player, if Washington attends it, holds a pre-deploy-testing pledge; the frontier-
   *  holding NPC lab, or the best US NPC lab, shows outside access of at least treatyTestAccess in its public posture). */
  treatyConcern: 70,
  treatyTestAccess: 0.45, // the leader kind (0.45) and the safety, bigtech and open-weights kinds pass; upstart (0.3) and racer (0.1) do not (lead, 2026-11-28)
  /** War ending: the quarterly chance at war footing (the old rung-6 roll) [D]. */
  warPerQuarter: 0.25,
  /** US output shock while on war footing, growth a year (the old war term, worldfx/economy.ts) [D]. */
  warShock: 0.05,
  /** China's safety concern (0..100, its lab's safety investment, actors/rivals.ts): the old start 30, + per talks step,
   *  + per tension rung [D]. */
  safetyBase: 30,
  safetyPerTalks: 10,
  safetyPerRung: -5,
  /** E10 Go public: approval push (× attention) [D]. */
  goPublicApproval: 2,
  /** Verified treaty: the reference clock's speed for every NPC lab (the former research-rate multiplier, npc/shocks.ts
   *  TREATY_CLOCK_RATE before W1d) [D]. */
  treatyClockRate: 0.65,
};

export const TENSION_NAMES = ['Competition', 'Acquisition push', 'National collective', 'Coercion over Taiwan', 'War footing'] as const;
export const TALKS_NAMES = ['No talks', 'Talks', 'Restraint pact', 'Verified treaty'] as const;

export function initialChinagov(): ChinaGovState {
  return { tension: 0, talks: 0, treaty: 'none', rejected: false, centralised: false, holdDays: {}, leadHist: [], clockLostDays: 0 };
}

/** The split keys that are AI R&D: training, synthetic data, experiments, research agents. */
const AI_RD: readonly (keyof ComputeSplit)[] = ['training', 'synthetic', 'experiments', 'routine', 'frontier'];
/** The player's AI R&D compute in a pool (H100e). */
export const aiRdOf = (p: ComputeSplit) => AI_RD.reduce((a, k) => a + p[k], 0);
/** Under a verified treaty, the player's AI R&D compute is capped at its signing-day level (the rest idles). The one
 *  check, in compute/power.ts poolsOf. */
export function treatyCap(s: GameStateV2, p: ComputeSplit): ComputeSplit {
  const cap = s.chinagov?.treaty === 'verified' ? s.chinagov.cap : undefined;
  const x = aiRdOf(p);
  if (cap === undefined || x <= cap) return p;
  const k = cap / x;
  for (const key of AI_RD) p[key] *= k;
  p.idle += x - cap;
  return p;
}

/** Intent of China's weight theft (0..100) at today's tension. */
export const theftIntent = (s: GameStateV2) => Math.min(100, CHINAGOV.theftIntentBase + CHINAGOV.theftIntentPerRung * s.chinagov.tension);
/** China's safety concern 0..100 (its lab's safety investment). */
export const chinaSafetyConcern = (s: GameStateV2) => Math.max(0, Math.min(100, CHINAGOV.safetyBase + CHINAGOV.safetyPerTalks * s.chinagov.talks + CHINAGOV.safetyPerRung * s.chinagov.tension));

/** A provocation China answers like strict export controls (a detected Chinese theft; E10 making one public). */
export function provokeChina(s: GameStateV2, day: number): void {
  const g = s.chinagov;
  g.provokedDay = day;
  g.holdDays.up = (g.holdDays.up ?? 0) + CHINAGOV.provokeHold;
}

function say(ctx: SystemCtx, key: string, text: string, sev: 3 | 4 = 3) {
  ctx.log('world', text, sev);
  ctx.headline(key, text);
}

function setTension(s: GameStateV2, ctx: SystemCtx, t: ChinaGovState['tension']) {
  const g = s.chinagov;
  const up = t > g.tension;
  g.tension = t;
  g.holdDays.up = 0;
  g.holdDays.down = 0;
  if (up) say(ctx, `chinaTension${t}`, ['', 'Beijing orders a push to acquire chips and AI know-how by any means.', 'Beijing merges its AI labs into a national collective.',
    'Beijing escalates pressure on Taiwan over the AI race.', 'China moves to a war footing.'][t], t >= 3 ? 4 : 3);
  else ctx.log('world', `Tension with China eases: ${TENSION_NAMES[t].toLowerCase()}.`, 2);
  if (t >= 2 && !g.centralised) {
    g.centralised = true;
    g.centralisedDay = ctx.day;
    centraliseChina(s, CHINAGOV.centralMult);
  }
}

function setTalks(s: GameStateV2, ctx: SystemCtx, t: ChinaGovState['talks']) {
  const g = s.chinagov;
  if (t === 3) { // the cap: the player's AI R&D pool on the signing day (read before the treaty is in force)
    g.signedDay = ctx.day;
    g.cap = aiRdOf(poolsOf(s));
  }
  g.talks = t;
  g.treaty = t === 3 ? 'verified' : t === 2 ? 'restraint' : 'none';
  g.holdDays.quiet = 0;
  g.holdDays.held = 0;
  const text = ['The treaty is rejected; US–China AI talks end.', 'Washington and Beijing open talks on frontier AI.', 'Washington and Beijing agree to restrain frontier AI.', 'Washington and Beijing sign a verified treaty: AI R&D compute is capped at today’s level.'][t];
  say(ctx, `chinaTalks${t}`, text, t === 3 ? 4 : 3);
}

/** E23 resolved: Back (restraint) or Oppose (rejected, unless the public's concern overrides the lab). */
export function resolveTreaty(s: GameStateV2, ctx: SystemCtx, back: boolean): void {
  const g = s.chinagov;
  if (g.talks !== 1) return;
  if (back || s.public.concern > CHINAGOV.overrideConcern) return setTalks(s, ctx, 2);
  g.rejected = true;
  setTalks(s, ctx, 0);
}

/** The NPC lab whose testing stance counts for a treaty: the frontier holder when it is an NPC lab, else the best US NPC lab. */
export function treatyNpcLab(s: GameStateV2): RivalLab | undefined {
  const f = frontier(s);
  const ok = (id: string) => id !== PLAYER_ID && id !== CHINA_ID;
  let id: string | undefined = f.lab && ok(f.lab) ? f.lab : undefined;
  if (!id) for (const k of Object.keys(f.lagMonths)) if (ok(k) && (id === undefined || f.lagMonths[k]! < f.lagMonths[id]!)) id = k;
  return id ? otherLabs(s).find((r) => r.core.id === id) : undefined;
}

/** Political will for a verified treaty: US concern high enough, the player (when Washington attends it) pledged to
 *  pre-deploy testing, and the leading NPC lab shows external testing. */
export function treatyWill(s: GameStateV2, ctx?: SystemCtx): boolean {
  if (s.public.concern < CHINAGOV.treatyConcern + USGOV.concernShift) return false;
  if (playerAttention(s, ctx) >= USGOV.attentionMin && !hasCommitment(s, 'preDeployTesting')) return false;
  const npc = treatyNpcLab(s);
  return !npc || publicOf(s, npc).safetyPosture.externalAccess >= CHINAGOV.treatyTestAccess;
}

/** Daily (123): the lead history (quarterly), the tension ladder, the talks track and a verified treaty's clock. */
export function stepChinagov(s: GameStateV2, ctx: SystemCtx): void {
  const g = s.chinagov;
  const day = ctx.day;
  const lead = usLeadOverChinaMonths(s, frontier(s)) ?? 0;
  if (cadencesDue(s.time.startDate, day).includes('quarterly')) {
    g.leadHist.push(lead);
    if (g.leadHist.length > CHINAGOV.leadQuarters) g.leadHist.shift();
  }
  // Tension reads the smoothed lead (the mean of the last quarters), never the noisy day's.
  const hist = g.leadHist.slice(-CHINAGOV.leadQuarters);
  const sLead = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : lead;
  const board = publicMilestones(s);
  const us = (i: number) => board[i] !== undefined && board[i]!.lab !== CHINA_ID; // a US lab shows milestone i publicly
  const T = (m: number) => m / CHINAGOV.aggression;
  const long = sLead > T(CHINAGOV.lead1);
  const pushed = long || s.market.exportPolicy === 'strict' || (g.provokedDay !== undefined && day - g.provokedDay < CHINAGOV.provokeDays);
  const t = g.tension;
  // Climbing: the condition for the next rung, held CHINAGOV.holdDays.
  const climb = [
    pushed,
    us(CHINAGOV.collectiveMilestone) && long,
    us(CHINAGOV.coerceMilestone) || s.usgov.stage >= CHINAGOV.coerceStage,
    g.rejected && long,
    false,
  ][t];
  g.holdDays.up = climb ? (g.holdDays.up ?? 0) + 1 : 0;
  // Descending: rungs 1-2 fall after CHINAGOV.downDays without their condition (rung 2 holds on the long lead).
  const keep = t === 1 ? pushed : t === 2 ? long : true;
  g.holdDays.down = keep ? 0 : (g.holdDays.down ?? 0) + 1;
  if (t < 4 && g.holdDays.up >= CHINAGOV.holdDays) setTension(s, ctx, (t + 1) as ChinaGovState['tension']);
  else if (t >= 1 && t <= 2 && g.holdDays.down >= CHINAGOV.downDays) setTension(s, ctx, (t - 1) as ChinaGovState['tension']);

  // Talks: they advance only while quiet (no detected Chinese theft today, tension at most 2); a rejected treaty ends them.
  const b = CHINAGOV.bargaining;
  const quiet = s.usgov.thefts[s.usgov.thefts.length - 1] !== day && g.tension <= 2;
  g.holdDays.quiet = quiet ? (g.holdDays.quiet ?? 0) + 1 : 0;
  if (g.talks === 0) {
    const leak = ws4r(s).misalignLeakDay;
    const scare = (leak !== undefined && day - leak < CHINAGOV.scareDays) || incidentHeat(s) > USGOV.scareHeat;
    if (!g.rejected && s.usgov.stage >= CHINAGOV.talksStage && (scare || lead < CHINAGOV.talksLead * b)) setTalks(s, ctx, 1);
  } else if (g.talks === 1 && g.holdDays.quiet >= CHINAGOV.quietDays / b) {
    // Restraint: the player decides (E23) only when Washington pays it attention; otherwise it happens without it.
    if (playerAttention(s, ctx) < USGOV.attentionMin) setTalks(s, ctx, 2);
    else if (g.asked === undefined) { g.asked = day; request(s, 'E23'); }
  } else if (g.talks === 2) {
    g.holdDays.held = quiet && s.usgov.stage >= CHINAGOV.talksStage ? (g.holdDays.held ?? 0) + 1 : 0;
    if (g.holdDays.held >= CHINAGOV.verifyDays / b && treatyWill(s, ctx)) setTalks(s, ctx, 3);
  }
  // A verified treaty holds the NPC labs' reference clock back (npc/shocks.ts refYear).
  if (g.treaty === 'verified') g.clockLostDays += 1 - CHINAGOV.treatyClockRate;
}

export const chinagovDailySystem: EngineSystem = {
  id: 'chinagovDaily', owner: 'WS4', cadence: 'daily', order: 123, system: 'relations',
  run(s, ctx) { stepChinagov(s, ctx); },
};

/** The Relations panel's and the readout's China view: tension and its name, talks and their name, the treaty, whether the
 *  national collective formed, and China's lab compute. */
export function chinagovView(s: GameStateV2): { tension: number; tensionName: string; talks: number; talksName: string; treaty: ChinaGovState['treaty']; rejected: boolean; centralised: boolean; labCompute: number; cap?: number } {
  const g = s.chinagov;
  return {
    tension: g.tension, tensionName: TENSION_NAMES[g.tension], talks: g.talks, talksName: TALKS_NAMES[g.talks], treaty: g.treaty, rejected: g.rejected,
    centralised: g.centralised, labCompute: s.china.lab.core.computeOnline, ...(g.cap !== undefined ? { cap: g.cap } : {}),
  };
}

