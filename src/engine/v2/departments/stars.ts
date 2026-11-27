// Stars: named researchers above the 99.9th percentile (LABOUR-ROUND §6). Hiring an outside star and poaching a rival's.
// Taste: a star joins the lab's researchers' mean (departments/workfit.ts humanTasteMean); pay: the star's $M/yr enters
// payroll (departments/teams.ts payrollOf). No star departures, no star attrition (left out by design, §6.3).
import { PREMIUM_STEPS, STAR_POACH_COOPERATION } from '../../../data/v2/labourMarket';
import type { ActionDef, GameStateV2, LabId, Star, SystemCtx } from '../types';
import { starGain } from './teamActions';

type Params = Record<string, number | string | boolean>;
const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);
const num = (p: Params, k: string, d: number) => (typeof p[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : d);

/** The poach premium's default: the first PREMIUM_STEPS step above the market wage (a rival's star leaves for a raise). */
export const DEFAULT_POACH_STEP = 1;

/** The stars the player employs. */
export const playerStars = (s: GameStateV2): Star[] => s.labour.stars.filter((x) => x.employer === 'player');
/** The stars the player could hire or poach: outside or at a rival (China's cannot be hired; the player's own are done). */
export const hirableStars = (s: GameStateV2): Star[] => s.labour.stars.filter((x) => x.employer !== 'player' && x.employer !== 'china');

/** The premium of a poach as a step of PREMIUM_STEPS (the nearest step to the asked value; default the first above 0).
 *  An outside star takes none. */
export function premiumOf(star: Star, asked?: number): number {
  if (star.employer === 'outside') return 0;
  if (asked === undefined || !Number.isFinite(asked)) return PREMIUM_STEPS[Math.min(DEFAULT_POACH_STEP, PREMIUM_STEPS.length - 1)];
  return PREMIUM_STEPS.reduce((best, x) => (Math.abs(x - asked) < Math.abs(best - asked) ? x : best), PREMIUM_STEPS[0]);
}
/** The pay the star asks to join, $M/yr: its pay × (1 + premium). Hook for the later task where star pay follows the
 *  market (the star pool's wage): until then a star's own `pay` (W_STAR0 at the start). */
export const askingPay = (star: Star, premium: number): number => star.pay * (1 + premium);

/** Why a star cannot be hired, or undefined. */
export function whyNotHirable(star: Star | undefined): string | undefined {
  if (!star) return 'No such star';
  if (star.employer === 'player') return 'Already on staff';
  if (star.employer === 'china') return "China's researchers cannot be hired";
  return undefined;
}

/** The star a call names: `star` (an id), else the best-taste hirable one. */
function pick(s: GameStateV2, p: Params): Star | undefined {
  const id = str(p, 'star', '');
  if (id) return s.labour.stars.find((x) => x.id === id);
  return [...hirableStars(s)].sort((a, b) => b.taste - a.taste)[0];
}

/** Move a star to the player at its asking pay. A rival's star also costs that rival's cooperation (STAR_POACH_COOPERATION).
 *  Returns the reason it did not go through, if any. */
export function hireStar(s: GameStateV2, star: Star | undefined, premium?: number): string | undefined {
  const why = whyNotHirable(star);
  if (why || !star) return why;
  const from = star.employer;
  star.pay = askingPay(star, premiumOf(star, premium));
  star.employer = 'player';
  if (from !== 'outside' && from !== 'player' && from !== 'china') {
    const r = s.rivals.find((x) => x.core.id === from);
    if (r && r.core.status === 'active') r.meters.cooperation = Math.max(-100, r.meters.cooperation + STAR_POACH_COOPERATION);
  }
  return undefined;
}

const labName = (s: GameStateV2, id: LabId | 'china' | 'outside' | 'player') => s.rivals.find((r) => r.core.id === id)?.core.name ?? id;

export const STAR_ACTIONS: ActionDef[] = [
  {
    id: 'starHire', verb: 'hire', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Hire a star',
    available: (s) => (hirableStars(s).length ? true : 'No star is available to hire'),
    preview: (s, p) => {
      const star = pick(s, p);
      if (!star || whyNotHirable(star)) return { costs: [], gains: [], exposure: [] };
      const prem = premiumOf(star, num(p, 'premium', NaN));
      const costs: ReturnType<ActionDef['preview']>['costs'] = [{ currency: 'cash', amount: askingPay(star, prem) / 1000, target: `$B/yr payroll (${star.name})` }];
      if (star.employer !== 'outside') costs.push({ currency: 'trust', amount: STAR_POACH_COOPERATION, target: labName(s, star.employer) });
      return { costs, gains: [starGain(s, star.id)], exposure: [] };
    },
    apply: (s: GameStateV2, ctx: SystemCtx, p: Params) => {
      const star = pick(s, p);
      const from = star?.employer;
      const why = hireStar(s, star, num(p, 'premium', NaN));
      if (why) return why;
      ctx.log('company', from === 'outside' ? `${star!.name}, a star researcher, joins.` : `${star!.name} is poached from ${labName(s, from!)}.`, 1);
      return undefined;
    },
  },
];
