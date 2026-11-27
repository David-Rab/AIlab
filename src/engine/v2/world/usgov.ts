// W5: the US government (design/world/OUTSIDE-WORLD.md §6). Owner: WS4. Small state (s.usgov): the security stage (world
// level, from what the government sees: observe.ts govMilestones, plus detected thefts), trust in the player's lab,
// oversight and consolidation, and the conditional laws it passes (data/v2/laws.ts COND_LAWS). Every beat keys off
// milestones achieved in the game, never a date (SESSION-HEAD §8); AI 2027's order inspires the ladder: security
// requirements, then clearances, then an oversight committee, then DPA consolidation, each 3-5 months after the matching
// capability (SOURCES.md §10). Lab-directed requirements land only on a lab the government pays attention to (R2).
import { CHINA_ID, PLAYER_ID } from '../models/labs';
import { versionMilestones } from '../departments/workfit';
import { cadencesDue, decimalYear } from '../core/time';
import { clamp } from '../../rng';
import { numParam, simpleAction } from '../core/actionDef';
import { L, pv } from '../actors/fx';
import { request, ws4, ws4r } from '../actors/state';
import { wslFloor } from '../security/security';
import { unemploymentChange12m } from '../worldfx/readouts';
import { worldMix } from '../worldfx/mix';
import { COND_LAWS, lawIdsInForce } from '../../../data/v2/laws';
import { attention, frontier, govMilestones, incidentHeat, type MilestoneBoard } from './observe';
import { provokeChina } from './chinagov';
import type { ActionDef, CondLawId, EngineSystem, GameStateV2, ModelVersion, SystemCtx, UsGovState } from '../types';

/** The US government's constants. [D] designer stand-ins unless marked. Registered in balance/params/worldfx.ts. */
export const USGOV = {
  /** Trust at the start (0..100) [D]. */
  trustStart: 55,
  /** Days a stage's condition must hold before the stage is reached: the government's reaction speed [D]; inside AI
   *  2027's 3-5 months between a capability and the matching step (SOURCES.md §10). */
  lagDays: 90,
  /** Stage 4 needs stage 3 held this long (days) [D]. */
  consolidateAfterDays: 180,
  /** Stage 4 also comes on this much concern (without the superintelligent AI researcher seen) [D]. */
  consolidateConcern: 75,
  /** Lab-directed requirements land on labs with at least this attention (observe.ts) [D]. */
  attentionMin: 0.5,
  /** Monthly trust for meeting / missing the industry security floor (the old rule's values). */
  securityMet: 1.5,
  securityMissed: -1,
  /** Monthly trust under full briefing (the old rule's value). */
  briefingFull: 0.5,
  /** Trust pushes (× attention) [D]: an exposed cover-up, a detected theft from the player, a severity-5 misuse. */
  coverupExposed: -6,
  theftFromYou: -5,
  misuseSev5: -8,
  /** E12 Clearances: Comply morale cost, security target gain, trust; Resist trust, morale [D]. */
  clearMorale: -10,
  clearSecurity: 0.3,
  clearTrust: 10,
  resistTrust: -15,
  resistMorale: 3,
  /** E20 Oversight committee: Accept / Refuse trust [D]. */
  oversightTrust: 10,
  refuseTrust: -10,
  /** Under oversight, an external launch of a version at the superhuman AI researcher level waits this many days [D]. */
  reviewDays: 30,
  /** E22 DPA: offered above this trust to the frontier holder; declining costs trust [D]. */
  softTrust: 60,
  declineTrust: -10,
  /** Share of each US NPC lab's online compute pooled into the player under the DPA (AI 2027's Aug 2027 proposal moved
   *  20% to 50%, SOURCES.md §10) [sourced shape, D value]. */
  dpaShare: 0.5,
  /** Hard path: trust below this for hardHoldDays, or a leaked misalignment memo with concern above hardConcern [D]. */
  hardTrust: 20,
  hardHoldDays: 90,
  hardConcern: 75,
  /** Laws [D] (concern thresholds shift by concernShift). Frontier licensing: on above licensingOn held licensingHoldDays, off
   *  below licensingOff; US friction on LEGAL, HEALTH, FIN (the old rule's value). */
  licensingOn: 70,
  licensingOff: 55,
  licensingHoldDays: 90,
  licensingFriction: 0.1,
  /** Worker relief: 12-month US unemployment rise above reliefRise (points; SOURCES §10, AI 2027's +1 pt), off below
   *  reliefOffRise; basic income after ubiHoldDays of relief with the rise still above reliefRise (sticky). */
  reliefRise: 1,
  reliefOffRise: 0.5,
  ubiHoldDays: 182,
  /** Relief's re-employment boost and basic income's displaced-pool exit multiplier (the old rules' values). */
  reliefRetrain: 0.2,
  ubiExitMult: 3,
  /** Human-in-the-loop mandate: (a misalignment leak or incident heat above scareHeat) and concern above hitlOn; off below
   *  hitlOff; caps AI substitution α at hitlAlphaCap. */
  scareHeat: 6,
  hitlOn: 75,
  hitlOff: 55,
  hitlAlphaCap: 0.5,
  /** California SB 243 (companion-chatbot restriction for minors) scales the companion share by this [D]. */
  companionFactor: 0.8,
  /** Special economic zones: superhuman AI researcher seen and concern below sezOn; off above sezOff. */
  sezOn: 60,
  sezOff: 70,
  /** FDA fast track: health-channel world-tech lag × this (the old rule's value). */
  fdaLagMult: 0.5,
  /** At an aligned superintelligence, a DPA-pooled lab trusted less than this is the government's (the old rule's value). */
  governmentTrust: 40,
  /** Regulatory appetite: added to every law's concern threshold [D]. */
  concernShift: 0,
};

export const STAGE_NAMES = ['Business as usual', 'Security expectations', 'Clearances', 'Oversight committee', 'Consolidation'] as const;

export function initialUsgov(): UsGovState {
  return { stage: 0, stageDay: {}, trust: USGOV.trustStart, oversight: false, consolidated: 'none', holdDays: {}, laws: {}, thefts: [], asked: {} };
}

/** The first day the government saw milestone `i` or a later one (milestones are nested), or undefined. */
function seenSince(b: MilestoneBoard, i: number): number | undefined {
  let d: number | undefined;
  for (const k of Object.keys(b)) if (Number(k) >= i && (d === undefined || b[Number(k)]!.day < d)) d = b[Number(k)]!.day;
  return d;
}
const earliest = (...xs: (number | undefined)[]) => xs.reduce<number | undefined>((a, x) => (x === undefined ? a : a === undefined ? x : Math.min(a, x)), undefined);

/** The player's attention (0..1), or 0 when the player is out of the game. */
export function playerAttention(s: GameStateV2, ctx?: SystemCtx): number {
  if (s.player.status !== 'active') return 0;
  return attention(s, PLAYER_ID, frontier(s), ctx ? worldMix(s, ctx) : undefined);
}

/** A trust change: base × the player's attention (`scale`; the event choices pass 1). The one way trust moves. */
export function trustPush(s: GameStateV2, ctx: SystemCtx, base: number, why: string, scale = playerAttention(s, ctx)): number {
  const d = base * scale;
  if (Math.abs(d) < 1e-9) return 0;
  return ctx.bump('usgov.trust', d, why);
}

/** A detected theft from a US lab (security/theft.ts): it counts toward the stage; one from the player costs trust. It
 *  also provokes China (world/chinagov.ts: like strict export controls). */
export function usgovTheftDetected(s: GameStateV2, ctx: SystemCtx, victim: string): void {
  s.usgov.thefts.push(ctx.day);
  provokeChina(s, ctx.day);
  if (victim === PLAYER_ID) trustPush(s, ctx, USGOV.theftFromYou, 'Weights stolen from your lab');
}

/** Under the oversight committee, the reason an external launch of `v` waits (versions at the superhuman AI researcher
 *  level, USGOV.reviewDays from the version's day), or undefined. */
export function oversightBlock(s: GameStateV2, v: ModelVersion): string | undefined {
  if (!s.usgov.oversight || !versionMilestones(s, v)[4]) return undefined;
  const left = USGOV.reviewDays - (s.time.day - v.day);
  return left > 0 ? `the oversight committee reviews a superhuman AI researcher for ${USGOV.reviewDays} days (${left} d left)` : undefined;
}

/** The day each stage-step condition (index 1..4) has held since, from what the government sees (the first day a
 *  milestone showed: with full briefing an internal milestone counts from the day reached) and the detected thefts:
 *  1 the research agent or a theft, 2 the superhuman coder or a second theft, 3 the superhuman AI researcher, 4 the
 *  superintelligent AI researcher or high concern (held since holdDays.concern days ago). */
function stageSince(s: GameStateV2, b: MilestoneBoard): (number | undefined)[] {
  const g = s.usgov;
  const c = g.holdDays.concern ?? 0;
  return [undefined, earliest(seenSince(b, 2), g.thefts[0]), earliest(seenSince(b, 3), g.thefts[1]), seenSince(b, 4), earliest(seenSince(b, 5), c > 0 ? s.time.day - c + 1 : undefined)];
}

/** Count consecutive days a condition holds (reset when it fails). */
const hold = (g: UsGovState, k: string, on: boolean) => (g.holdDays[k] = on ? (g.holdDays[k] ?? 0) + 1 : 0);

function reach(s: GameStateV2, ctx: SystemCtx, stage: 1 | 2 | 3 | 4) {
  const g = s.usgov;
  g.stage = stage;
  g.stageDay[stage] ??= ctx.day;
  const text = ['', 'Washington sets security expectations for frontier AI labs.', 'Washington requires security clearances and embedded officials at frontier AI labs.',
    'Washington sets up an oversight committee over frontier AI.', 'Washington consolidates the frontier AI labs under the Defense Production Act.'][stage];
  ctx.log('gov', text, 3);
  ctx.headline(`usgovStage${stage}`, text);
}

/** The hard path: the player's lab is taken (the 'nationalized' ending). */
function nationalize(s: GameStateV2, ctx: SystemCtx) {
  const g = s.usgov;
  if (g.stage < 4) reach(s, ctx, 4);
  g.consolidated = 'nationalized';
  ws4(s).nationalizedHard = true;
  ctx.log('gov', 'The government takes control of your lab.', 5);
}

/** E22 Accept: the US NPC labs' compute is pooled into the player as rent-free cloud capacity (USGOV.dpaShare of each
 *  lab's online compute, for as long as consolidation holds). */
export function acceptDpa(s: GameStateV2, ctx: SystemCtx): number {
  const g = s.usgov;
  let pooled = 0;
  for (const r of s.rivals) {
    if (r.core.status !== 'active' || r.core.id === CHINA_ID) continue;
    const x = r.core.computeOnline * USGOV.dpaShare;
    r.core.computeOnline -= x;
    pooled += x;
  }
  g.consolidated = 'dpa';
  ws4(s).dpaAccepted = true;
  if (pooled > 0) s.player.cloud.push({ id: `DPA-${ctx.day}`, provider: 'DPA pool', h100e: pooled, costPerYear: 0, startDay: ctx.day, endDay: ctx.day + 36500, cancellableNoticeQ: null });
  ctx.log('gov', 'Under the Defense Production Act, the American labs pool their compute into your lab.', 4);
  return pooled;
}

/** The compute E22 would pool today (preview). */
export const dpaPoolPreview = (s: GameStateV2) => s.rivals.filter((r) => r.core.status === 'active' && r.core.id !== CHINA_ID).reduce((a, r) => a + r.core.computeOnline * USGOV.dpaShare, 0);

/** Monthly: switch the conditional laws by their on and off rules (hysteresis; COND_LAWS). */
function lawRules(s: GameStateV2, ctx: SystemCtx, sarSeen: boolean) {
  const g = s.usgov;
  const L = g.laws;
  const c = s.public.concern;
  const sh = USGOV.concernShift;
  const rise = unemploymentChange12m(s);
  const leak = ws4r(s).misalignLeakDay !== undefined;
  const scare = leak || incidentHeat(s) > USGOV.scareHeat;
  const want: Record<CondLawId, boolean> = {
    exportStrict: g.stage >= 2 || g.thefts.length >= 1,
    licensing: L.licensing !== undefined ? c >= USGOV.licensingOff + sh : (g.holdDays.licensing ?? 0) >= USGOV.licensingHoldDays,
    relief: L.relief !== undefined ? rise >= USGOV.reliefOffRise : rise > USGOV.reliefRise,
    ubi: L.ubi !== undefined || (L.relief !== undefined && ctx.day - L.relief >= USGOV.ubiHoldDays && rise > USGOV.reliefRise),
    hitl: L.hitl !== undefined ? c >= USGOV.hitlOff + sh : scare && c > USGOV.hitlOn + sh,
    sez: L.sez !== undefined ? c <= USGOV.sezOff + sh : sarSeen && c < USGOV.sezOn + sh,
    fdaFastTrack: L.fdaFastTrack !== undefined || (s.world.techs.W03?.discoveredDay !== undefined && g.stage >= 1),
  };
  for (const row of COND_LAWS) {
    const on = L[row.id] !== undefined;
    if (want[row.id] === on) continue;
    if (want[row.id]) {
      L[row.id] = ctx.day;
      ctx.log('gov', `New US law: ${row.name}.`, 2);
    } else {
      delete L[row.id];
      ctx.log('gov', `US law repealed: ${row.name}.`, 2);
    }
  }
}

/** Daily (122): the stage ladder, the player's requirements, the hard path, and (monthly) trust checks and the laws. */
export function stepUsgov(s: GameStateV2, ctx: SystemCtx): void {
  const g = s.usgov;
  const board = govMilestones(s);
  hold(g, 'concern', s.public.concern > USGOV.consolidateConcern);
  hold(g, 'lowTrust', g.trust < USGOV.hardTrust);
  hold(g, 'licensing', s.public.concern > USGOV.licensingOn + USGOV.concernShift);

  // The ladder, one step at a time, each once its condition has held USGOV.lagDays.
  const since = stageSince(s, board);
  const next = (g.stage + 1) as 1 | 2 | 3 | 4;
  const held = since[next] !== undefined && ctx.day - since[next]! >= USGOV.lagDays;
  if (next <= 3 && held) reach(s, ctx, next);
  else if (next === 4 && held && ctx.day - (g.stageDay[3] ?? ctx.day) >= USGOV.consolidateAfterDays) {
    reach(s, ctx, 4);
    g.consolidated = 'dpa'; // the frontier labs; the player joins only through E22
  }

  // What lands on the player: only with the government's attention.
  const att = playerAttention(s, ctx);
  const seen = att >= USGOV.attentionMin;
  if (seen && g.consolidated !== 'nationalized' && !ws4r(s).dpaAccepted) {
    if (g.stage >= 2 && g.asked.E12 === undefined) { g.asked.E12 = ctx.day; request(s, 'E12'); }
    if (g.stage >= 3 && g.asked.E20 === undefined) { g.asked.E20 = ctx.day; request(s, 'E20'); }
    if (g.stage >= 4 && g.asked.E22 === undefined && g.trust > USGOV.softTrust && frontier(s).lab === PLAYER_ID) { g.asked.E22 = ctx.day; request(s, 'E22'); }
    const leakScare = ws4r(s).misalignLeakDay !== undefined && s.public.concern > USGOV.hardConcern;
    if (g.stage >= 3 && (g.holdDays.lowTrust >= USGOV.hardHoldDays || leakScare)) nationalize(s, ctx);
  }

  if (!cadencesDue(s.time.startDate, ctx.day).includes('monthly')) return;
  if (seen && g.stage >= 1) {
    const met = s.player.security.wsl >= wslFloor(decimalYear(s) - 2025) - 1e-9;
    trustPush(s, ctx, met ? USGOV.securityMet : USGOV.securityMissed, met ? 'Met the security expectations' : 'Below the security expectations', att);
  }
  if (s.player.policies.govBriefing >= 2) trustPush(s, ctx, USGOV.briefingFull, 'Full briefing', att);
  lawRules(s, ctx, seenSince(board, 4) !== undefined);
}

export const usgovDailySystem: EngineSystem = {
  id: 'usgovDaily', owner: 'WS4', cadence: 'daily', order: 122, system: 'relations',
  run(s, ctx) { stepUsgov(s, ctx); },
};

// Brief officials (B7): how much the government sees of the lab's own evaluations (observe.ts govMilestones: briefing 1
// shows internal milestones 90 days late, 2 or more from the day reached; full briefing also earns trust monthly).
// Every preview shows what apply() does (§2.7 preview truth, lint-tradeoffs).
export const BRIEF_OFFICIALS: ActionDef = simpleAction({
  id: 'B7', verb: 'deal', system: 'relations', title: 'Brief officials',
  preview: (s, p) => {
    const lvl = clamp(Math.round(numParam(p, 'level', Math.min(3, s.player.policies.govBriefing + 1))), 0, 3);
    const up = lvl - s.player.policies.govBriefing;
    return up >= 0
      ? pv([L('freedom', Math.max(1, up) * 0.5)])
      : pv([], [L('freedom', 1)]);
  },
  apply(s, _ctx, p) {
    const lvl = clamp(Math.round(numParam(p, 'level', Math.min(3, s.player.policies.govBriefing + 1))), 0, 3) as 0 | 1 | 2 | 3;
    s.player.policies.govBriefing = lvl;
  },
});

/** The Relations panel's US-government readout: the stage and its name, trust, whether its requirements reach the player
 *  (attention at least USGOV.attentionMin), oversight and consolidation, and the law ids in force. */
export function usgovView(s: GameStateV2): { stage: number; stageName: string; trust: number; applies: boolean; oversight: boolean; consolidated: UsGovState['consolidated']; dpaAccepted: boolean; laws: string[] } {
  const g = s.usgov;
  return {
    stage: g.stage, stageName: STAGE_NAMES[g.stage], trust: g.trust, applies: playerAttention(s) >= USGOV.attentionMin,
    oversight: g.oversight, consolidated: g.consolidated, dpaAccepted: ws4r(s).dpaAccepted, laws: lawIdsInForce(s),
  };
}
