// Stars: named researchers above the 99.9th percentile (LABOUR-ROUND §6). The player hires them from one outside group: NPC
// labs hold no stars (designer, 2026-11-27), so a hire affects no NPC lab.
// Taste: a star joins the lab's researchers' mean (departments/workfit.ts humanTasteMean); pay: the star's $M/yr enters
// payroll (departments/teams.ts payrollOf). No star departures, no star attrition (left out by design, §6.3).
import type { ActionDef, GameStateV2, Star, SystemCtx } from '../types';
import { starGain } from './teamActions';
import { Phi, tasteSigma } from '../production/ces';

type Params = Record<string, number | string | boolean>;
const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);

/** The stars the player employs. */
export const playerStars = (s: GameStateV2): Star[] => s.labour.stars.filter((x) => x.employer === 'player');
/** The stars the player could hire: the outside group. */
export const hirableStars = (s: GameStateV2): Star[] => s.labour.stars.filter((x) => x.employer === 'outside');

/** Why a star cannot be hired, or undefined. */
export function whyNotHirable(star: Star | undefined): string | undefined {
  if (!star) return 'No such star';
  if (star.employer === 'player') return 'Already on staff';
  return undefined;
}

/** The star a call names: `star` (an id), else the best-taste hirable one. */
function pick(s: GameStateV2, p: Params): Star | undefined {
  const id = str(p, 'star', '');
  if (id) return s.labour.stars.find((x) => x.id === id);
  return [...hirableStars(s)].sort((a, b) => b.taste - a.taste)[0];
}

/** Move a star to the player at its pay. Returns the reason it did not go through, if any. */
export function hireStar(star: Star | undefined): string | undefined {
  const why = whyNotHirable(star);
  if (why || !star) return why;
  star.employer = 'player';
  return undefined;
}

/** How far up the researcher distribution a star stands, as the share of researchers above it (0.0003 = "top 0.03%"): the
 *  star's taste T = exp(-sigma^2/2 + sigma z) read back to its z, then 1 - Phi(z). The same sigma that made the taste. */
export function starTopShare(s: GameStateV2, star: Star): number {
  const sigma = tasteSigma(s.hidden.timeline.prod.m2b);
  const z = (Math.log(star.taste) + 0.5 * sigma * sigma) / sigma;
  return Math.max(0, 1 - Phi(z));
}

/** The lab's human taste mean (workfit.ts humanTasteMean) with one more star on staff: (S b + sum T + T_star) / (S + n + 1). */
export function humanTasteWith(s: GameStateV2, star: Star): number {
  let S = 0;
  for (const t of s.player.teams) if (t.role === 'sci' && t.dept === 'cap') S += t.heads;
  let sum = 0, n = 0;
  for (const x of s.labour.stars) if (x.employer === 'player') { sum += x.taste; n++; }
  return (S * s.labour.teamTaste + sum + star.taste) / (S + n + 1);
}

export const STAR_ACTIONS: ActionDef[] = [
  {
    id: 'starHire', verb: 'hire', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Hire a star',
    available: (s) => (hirableStars(s).length ? true : 'No star is available to hire'),
    preview: (s, p) => {
      const star = pick(s, p);
      if (!star || whyNotHirable(star)) return { costs: [], gains: [], exposure: [] };
      return { costs: [{ currency: 'cash', amount: star.pay / 1000, target: `$B/yr payroll (${star.name})` }], gains: [starGain(s, star.id)], exposure: [] };
    },
    apply: (s: GameStateV2, ctx: SystemCtx, p: Params) => {
      const star = pick(s, p);
      const why = hireStar(star);
      if (why) return why;
      ctx.log('company', `${star!.name}, a star researcher, joins.`, 1);
      return undefined;
    },
  },
];
