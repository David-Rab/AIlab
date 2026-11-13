// Public opinion meters and activism ladder (V2-SPEC §3.10.2; research/07 §1.2). Owner: WS4.
import { PUBLIC_PRESETS } from '../../../data/actors';
import { BASELINES } from '../../../data/world';
import { clamp } from '../../rng';
import { dayOfDate } from '../core/time';
import type { BaselineId, GameStateV2, PublicActor, SystemCtx } from '../types';
import { initialBlocs } from './blocs';
import { drift } from './fx';
import { ws4 } from './state';

export const publicPresetOf = (id: string) => PUBLIC_PRESETS.find((p) => p.id === id) ?? PUBLIC_PRESETS[0];

/** Public at Jul 2025 (v1 BASELINES; research/07 §1.2 start column for awareness 55, DC_NIMBY 45, companionship 2).
 *  approval −100..100; other meters 0..100; salience = % naming AI the top problem (0..30). */
export function initialPublic(presetId: string, baseline: BaselineId): PublicActor {
  const b = (BASELINES.find((x) => x.id === baseline) ?? BASELINES[0]).start;
  return {
    preset: publicPresetOf(presetId).id,
    concern: b.concern, approval: b.approval, awareness: 55, jobAnxiety: b.jobAnxiety, xrisk: b.xrisk,
    regDemand: 80, salience: 1, activism: 8, dcNimby: 45, companionship: 2,
    rung: 0,
    blocs: initialBlocs(),
  };
}

/** Election dates for P-ACTIVISM rung 5 (research/07: Nov 2026, Nov 2028). */
const ELECTIONS = ['2026-11-03', '2028-11-07'];

/** P-OPINION + P-ACTIVISM (daily). World feeds (R16 §4.7) read WS5 state; unchanged world = calm public. */
export function publicDaily(s: GameStateV2, ctx: SystemCtx) {
  const p = s.pub;
  const pre = publicPresetOf(p.preset);
  const P = p as unknown as Record<string, number>;
  const milestones = Object.keys(s.player.milestoneDays).length;
  // Concern drifts to a baseline that ratchets up +1 per player milestone (sticky), plus incidents and risk techs.
  const base = 50 + milestones + 0.5 * Math.max(0, s.world.unemployment.US - 4.3) * pre.jobs;
  drift(s, P, 'concern', (base - p.concern) * (Math.LN2 / pre.halfLife), 0, 100, 'pub.concern');
  // JobAnxiety ← unemployment, youth unemployment (R16 §4.7).
  const jobT = clamp(65 + 4 * pre.jobs * (s.world.unemployment.US - 4.3) + 1.5 * (s.world.youthUnemployment - 9), 0, 100);
  drift(s, P, 'jobAnxiety', (jobT - p.jobAnxiety) * 0.01, 0, 100, 'pub.jobAnxiety');
  drift(s, P, 'xrisk', (40 + 0.3 * (p.concern - 50) * pre.xrisk - p.xrisk) * 0.005, 0, 100, 'pub.xrisk');
  drift(s, P, 'salience', (1 - p.salience) * (Math.LN2 / 60), 0, 30, 'pub.salience');
  drift(s, P, 'approval', (-5 - p.approval) * (Math.LN2 / 240), -100, 100, 'pub.approval');
  drift(s, P, 'awareness', (0.5 * (100 - p.awareness)) / 365, 0, 100, 'pub.awareness');
  drift(s, P, 'regDemand', (80 + 0.2 * (p.concern - 50) - p.regDemand) * 0.01, 0, 100, 'pub.regDemand');
  // AI-friend share damps youth activism (R16 §4.7); WS5 owns world.friendShare.
  p.companionship = clamp(100 * s.world.friendShare, 0, 30);
  // DC NIMBY grows toward the 2026 reading (~70) unless the player funds community packages (F1).
  const nimbyT = (s.player.policies.communityBenefits ? 50 : 70) * (pre.mobilization > 1.2 ? 1.1 : 1);
  drift(s, P, 'dcNimby', (nimbyT - p.dcNimby) * 0.002, 0, 100, 'pub.dcNimby');
  // Activism = f(Concern, JobAnxiety, Salience) × mobilization, damped by the AI-friend share.
  const actT = clamp(pre.mobilization * (0.5 * Math.max(0, p.concern - 45) + 0.4 * Math.max(0, p.jobAnxiety - 65) + 1.5 * p.salience) * (1 - 0.5 * s.world.friendShare), 0, 100);
  drift(s, P, 'activism', (actT - p.activism) * 0.02, 0, 100, 'pub.activism');

  // P-ACTIVISM ladder: climb immediately, descend after 60 days below (rung 5 sticky).
  const day = ctx.day;
  const want = (r: number): boolean => {
    switch (r) {
      case 1: return p.dcNimby > 50;
      case 2: return p.activism > 30;
      case 3: return p.activism > 55 && p.salience > 10;
      case 4: return p.activism > 70;
      case 5: return p.salience > 15 && ELECTIONS.some((d) => dayOfDate(s.time.startDate, d) === day);
      default: return true;
    }
  };
  if (p.rung < 5 && want(p.rung + 1) && (p.rung + 1 !== 4 || ctx.rng('actors').chance(0.02))) {
    p.rung = (p.rung + 1) as PublicActor['rung'];
    ctx.log('public', ['', 'Local opposition is delaying data-centre permits.', 'Organized AI protests spread to major cities.', 'A mass movement against AI labs takes to the streets.', 'Violence on the radical fringe: a lab facility is attacked.', 'AI becomes a deciding election issue.'][p.rung], 3);
    ctx.cause('pub.rung', 1, 'activism ladder');
  } else if (p.rung > 0 && p.rung < 5 && !want(p.rung)) {
    const k = `pubDown${p.rung}`;
    const h = (s.gov.holdDays[k] = (s.gov.holdDays[k] ?? 0) + 1);
    if (h >= 60) {
      delete s.gov.holdDays[k];
      p.rung = (p.rung - 1) as PublicActor['rung'];
    }
  } else if (s.gov.holdDays[`pubDown${p.rung}`]) delete s.gov.holdDays[`pubDown${p.rung}`];
}

/** P-LEAK rule (research/07): misalignment memo leaks. */
export function pLeak(s: GameStateV2, ctx: SystemCtx, mult = 1) {
  ctx.bump('pub.concern', 15 * mult, 'leak', 'misalignment memo');
  ctx.bump('pub.salience', Math.min(30, s.pub.salience * 3) - s.pub.salience, 'leak');
  ctx.bump('pub.approval', -20 * mult, 'leak', 'misalignment memo');
  ws4(s).misalignmentLeak = true;
}

/** P-RALLY rule: a credible China threat made public. */
export function pRally(_s: GameStateV2, ctx: SystemCtx) {
  ctx.bump('pub.approval', 5, 'rally', 'China threat');
  ctx.bump('pub.concern', -5, 'rally', 'China threat');
}
