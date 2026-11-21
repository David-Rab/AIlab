// Event-building kit for the decision catalog (V2-SPEC §4.2). Owner: WS4.
import { activeRivals, internalVersion } from '../models/labs';
import type { BoardVote, ChoiceV2, CostLine, EventDefV2, GameStateV2, RivalLab, SystemCtx } from '../types';
import { pv, type Preview } from '../actors/fx';

export { L, pv } from '../actors/fx';

/** Choice with a preview and an effect. `label` ≤ 3 words; tags drive bots and replay. */
export function ch(
  label: string, tags: string[], preview: (s: GameStateV2, data?: Data) => Preview,
  apply: (s: GameStateV2, ctx: SystemCtx, data: Data) => void,
  available?: (s: GameStateV2, data?: Data) => boolean | string,
  vote?: (s: GameStateV2, data?: Data) => BoardVote | undefined,
): ChoiceV2 {
  const c: ChoiceV2 = { label, tags, preview, apply };
  if (available) c.available = available;
  if (vote) c.vote = vote;
  return c;
}
type Data = Record<string, number | string>;

/** Shorthand for a static preview. */
export const P = (costs: CostLine[], gains: CostLine[] = [], exposure: CostLine[] = []) => () => pv(costs, gains, exposure);

export function ev(e: Omit<EventDefV2, 'owner'>): EventDefV2 {
  return { owner: 'WS4', ...e };
}

/** Request-only events (fired by WS4 systems through the director, never by a `when` predicate). */
export const requestOnly = () => false as const;

/** Active rival by id, or undefined if it is no longer active (E2: inactive labs are never named). */
export function activeLab(s: GameStateV2, id: string | number | undefined): RivalLab | undefined {
  if (id === 'china') return s.china.lab.core.status === 'active' ? s.china.lab : undefined;
  return activeRivals(s).find((r) => r.core.id === id);
}

export const labName = (s: GameStateV2, id: string | number | undefined) => activeLab(s, id)?.core.name ?? 'A rival';

/** Measured level of the internal-agent version (what the player sees). */
export const measured = (s: GameStateV2) => internalVersion(s)?.evals.measuredL ?? 0;

/** Days formatted for text. */
export const days = (d: number) => `${Math.round(Math.abs(d))} days`;
