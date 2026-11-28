// A small ActionDef builder for one-click levers with a cooldown or a once-only rule (security levers, poach, open
// weights, pledges, retire, briefing). Owner: WS4. Last use is kept in player.actionDay by action id.
import type { ActionDef, ActionVerb, GameStateV2, StructureSystem, SystemCtx } from '../types';
import type { Preview } from '../actors/fx';

export type ActionParams = Record<string, number | string | boolean>;

export interface SimpleAction {
  id: string;
  verb: ActionVerb;
  system: StructureSystem;
  title: string;
  sphere?: ActionDef['sphere'];
  /** Days before it can be used again (omitted = always available unless `once`). */
  cooldown?: number;
  once?: boolean;
  available?(s: GameStateV2): boolean | string;
  preview(s: GameStateV2, p: ActionParams): Preview;
  apply(s: GameStateV2, ctx: SystemCtx, p: ActionParams): void;
}

export function simpleAction(x: SimpleAction): ActionDef {
  return {
    id: x.id, verb: x.verb, system: x.system, sphere: x.sphere ?? 'relations', owner: 'WS4', title: x.title,
    available(s) {
      if (s.player.status !== 'active') return 'Company inactive';
      const last = s.player.actionDay[x.id];
      if (last !== undefined && x.once) return 'Already done';
      if (last !== undefined && x.cooldown !== undefined && s.time.day - last < x.cooldown) return `Again in ${x.cooldown - (s.time.day - last)} d`;
      return x.available ? x.available(s) : true;
    },
    preview: x.preview,
    apply(s, ctx, p) {
      x.apply(s, ctx, p);
      s.player.actionDay[x.id] = s.time.day;
    },
  };
}

/** A numeric parameter (a number or a numeric string), else `d`. */
export const numParam = (p: ActionParams, k: string, d: number) => (typeof p[k] === 'number' ? (p[k] as number) : typeof p[k] === 'string' && p[k] !== '' && !Number.isNaN(Number(p[k])) ? Number(p[k]) : d);
/** A string parameter, else `d`. */
export const strParam = (p: ActionParams, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);
