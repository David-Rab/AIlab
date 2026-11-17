// Event director: triggers, storyteller limits, deadlines (V2-SPEC §4.1; research/17 §2.6). Owner: WS4.
//
// - Every catalog event is a state predicate (`when`); WS4 systems also raise request-only events via
//   actors/state.ts `request()`. Both are fired here, crisis events first, then by id order.
// - Each event fires at most once per `cooldown` (once per game if omitted), requests included, and at most once
//   per game for each `onceKey` of its trigger data.
// - Storyteller limits (E4): at most `maxCrises` crisis decisions pending; no new crisis during the quiet period
//   that follows the end of a crisis; trigger probability multiplier by storyteller.
// - Deadlines: the default choice applies at the deadline (neglect is a choice).
// - Subjects are active labs only; pending decisions whose subject became inactive are dropped (E2).
//
// Events are rare by design: only decisions the regular mechanisms do not model (2026-11-15 cut: 37 → 15 events).
// Situations the panels already handle (cash crunch, capacity crunch, offers, eval results) are alerts, not decisions.
import { clamp } from '../../rng';
import { EVENT_BY_ID, EVENTS } from '../core/registry';
import { decisionSnapshot } from '../core/selectors';
import type { EngineSystem, EventDefV2, GameStateV2, PendingDecision, StorytellerId, SystemCtx } from '../types';
import { ws4 } from '../actors/state';

export interface Storyteller { maxCrises: number; quietDays: number; mult(s: GameStateV2, noise: number): number }

/** Storyteller table (§4.1). */
export const STORYTELLERS: Record<StorytellerId, Storyteller> = {
  measured: { maxCrises: 1, quietDays: 21, mult: () => 0.8 },
  rising: { maxCrises: 2, quietDays: 14, mult: (s) => 0.7 + 0.2 * (s.tutorial.act - 1) },
  chaotic: { maxCrises: 2, quietDays: 7, mult: (_s, n) => 1.2 * n },
};

/** Daily chance that a non-crisis event fires while its predicate holds, before the storyteller multiplier [D]. */
export const BASE_FIRE_P = 0.35;
/** At most this many non-crisis decisions pending at once (keeps the queue readable) [D]. */
export const MAX_PENDING = 4;

const isActiveLab = (s: GameStateV2, id: string) => id === 'china' ? s.china.lab.core.status === 'active' : id === 'player' || s.rivals.some((r) => r.core.id === id && r.core.status === 'active');

/** Drop pending decisions/requests whose subject lab is no longer active (never name inactive labs). */
export function purgeInactive(s: GameStateV2) {
  const ok = (d: Record<string, number | string>) => typeof d.lab !== 'string' || isActiveLab(s, d.lab);
  s.events.pending = s.events.pending.filter((p) => ok(p.data) && EVENT_BY_ID.has(p.id)); // and events since removed
  const w = ws4(s);
  w.requests = w.requests.filter((r) => ok(r.data));
}

/** Apply the default choice of an expired decision and record it (tag 'default'). */
export function expire(s: GameStateV2, ctx: SystemCtx, p: PendingDecision) {
  const def = EVENT_BY_ID.get(p.id);
  s.events.pending.splice(s.events.pending.indexOf(p), 1);
  if (!def) return;
  const c = def.choices[def.defaultChoice] ?? def.choices[0];
  c.apply(s, ctx, p.data);
  s.decisions.push({ day: ctx.day, eventId: p.id, choice: c.label, tags: [...c.tags, 'default'], snapshot: decisionSnapshot(s) });
  ctx.log('alert', `No decision on "${def.title}": default applied (${c.label}).`, 2);
}

const onCooldown = (s: GameStateV2, e: EventDefV2, day: number) => {
  const last = s.events.fired[e.id];
  if (last === undefined) return false;
  return e.cooldown === undefined ? true : day - last < e.cooldown;
};
/** `fired` key of an event's once-per-game trigger key, if it has one. */
const onceKeyOf = (e: EventDefV2, data: Record<string, number | string>) => (e.onceKey ? `${e.id}#${e.onceKey(data)}` : undefined);
const spent = (s: GameStateV2, e: EventDefV2, data: Record<string, number | string>) => {
  const k = onceKeyOf(e, data);
  return k !== undefined && s.events.fired[k] !== undefined;
};

/** Can a crisis fire now under the storyteller limits? */
export function crisisAllowed(s: GameStateV2, st: Storyteller, day: number): boolean {
  const n = s.events.pending.filter((p) => p.crisis).length;
  return n < st.maxCrises && day >= s.events.director.quietUntil;
}

/** director (140, daily): Evaluate event triggers; queue decisions under storyteller limits; expire deadlines. */
export const directorSystem: EngineSystem = {
  id: 'director', owner: 'WS4', cadence: 'daily', order: 140, system: 'core',
  run(s, ctx) {
    const day = ctx.day;
    const w = ws4(s);
    const st = STORYTELLERS[s.setup.storyteller] ?? STORYTELLERS.rising;
    const dir = s.events.director;
    const rng = ctx.rng('events');
    purgeInactive(s);

    // Deadlines → default choice.
    for (const p of [...s.events.pending]) if (day >= p.deadline) expire(s, ctx, p);

    // Quiet period starts when a crisis ends.
    const crises = s.events.pending.filter((p) => p.crisis).length;
    if (crises < dir.concurrentCrises) dir.quietUntil = Math.max(dir.quietUntil, day + st.quietDays);
    dir.concurrentCrises = crises;
    if (s.setup.storyteller === 'chaotic' && day % 30 === 0) w.storyNoise = clamp(1 + rng.normal(0, 0.3), 0.4, 1.6);
    const mult = st.mult(s, w.storyNoise);

    // Candidates: requests from WS4 systems (fire when limits allow), then catalog predicates.
    type Cand = { def: EventDefV2; data: Record<string, number | string>; req?: number };
    const cands: Cand[] = [];
    // Requests obey the same cooldown and once-per-key rules as predicates (a once-per-game event stays once).
    w.requests = w.requests.filter((r) => {
      const def = EVENT_BY_ID.get(r.id);
      return day - r.day <= 60 && !!def && !onCooldown(s, def, day) && !spent(s, def, r.data);
    });
    w.requests.forEach((r, i) => cands.push({ def: EVENT_BY_ID.get(r.id)!, data: r.data, req: i }));
    for (const e of EVENTS) {
      if (onCooldown(s, e, day) || s.events.pending.some((p) => p.id === e.id)) continue;
      const data = e.when(s);
      if (data && !spent(s, e, data)) cands.push({ def: e, data });
    }
    cands.sort((a, b) => (a.def.crisis === b.def.crisis ? a.def.id.localeCompare(b.def.id) : a.def.crisis ? -1 : 1));
    const fired = new Set<number>();
    for (const c of cands) {
      if (s.events.pending.some((p) => p.id === c.def.id) || onCooldown(s, c.def, day)) continue; // one fired this pass
      if (c.def.crisis) {
        if (!crisisAllowed(s, st, day)) continue;
      } else {
        if (s.events.pending.filter((p) => !p.crisis).length >= MAX_PENDING) continue;
        if (c.req === undefined && !rng.chance(clamp(BASE_FIRE_P * mult, 0, 1))) continue;
      }
      ctx.queue(c.def.id, c.data);
      const k = onceKeyOf(c.def, c.data);
      if (k) s.events.fired[k] = day;
      if (c.def.crisis) {
        dir.lastCrisisDay = day;
        dir.concurrentCrises++;
      }
      if (c.req !== undefined) fired.add(c.req);
    }
    if (fired.size) w.requests = w.requests.filter((_r, i) => !fired.has(i));
    dir.tension = clamp(0.5 * dir.tension + 0.25 * s.events.pending.length + (dir.concurrentCrises ? 0.5 : 0), 0, 5);
  },
};
