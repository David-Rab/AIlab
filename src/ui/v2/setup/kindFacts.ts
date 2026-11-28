// Setup: a start position's numbers as one tooltip line (lab-kind cards and the Custom position picker).
import { TEAM_SIZE } from '../../../data/v2/teams';
import type { PositionDef } from '../../../data/v2/starts';

const kH = (h: number) => (h >= 1e6 ? `${(h / 1e6).toFixed(1)}M` : `${Math.round(h / 1e3)}K`);
export const staffOfStart = (d: PositionDef) => d.teams.eng * TEAM_SIZE.eng + (d.teams['re.cap'] + d.teams['re.saf']) * TEAM_SIZE.re + (d.teams['sci.cap'] + d.teams['sci.saf']) * TEAM_SIZE.sci;

/** Cash, staff, compute, model lag and products of a position, for a tooltip. `cash` overrides the money wording. */
export function positionNumbers(d: PositionDef, cash = `$${d.cash}B`): string {
  const lag = d.lagMonths ? `${d.lagMonths} months behind the leader${d.imported ? ' (an imported open-weight model)' : ''}` : 'at the frontier';
  const products = d.products.length ? `${d.products.length} live product${d.products.length > 1 ? 's' : ''}` : 'no product yet';
  return `Cash ${cash}; staff ${staffOfStart(d).toLocaleString('en-US')}; compute ${kH(d.owned)} owned / ${kH(d.rented)} rented H100e; model ${lag}; ${products}.`;
}
