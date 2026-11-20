// The tick loop, system context, actions and decision resolution (V2-SPEC §2.2). Owner: WS1.
//
// Determinism: tick(s) is a pure function of s (mutating s). All randomness via ctx.rng(stream). Fixed order.
// Bots and the UI call act()/resolve() only between ticks.
import type {
  Cadence, EngineSystem, GameStateV2, LogEntry, PendingDecision, StreamId, SystemCtx, TickOptions,
} from '../types';
import { bumpMeter, recordCause } from './causes';
import { HEADLINE_CAP, LOG_CAP } from './record';
import { ACTION_BY_ID, EVENT_BY_ID, SYSTEMS, validateRegistry } from './registry';
import { StreamRng } from './rng';
import { decisionSnapshot } from './selectors';
import { cadencesDue } from './time';

validateRegistry();

const scheduleCache = new Map<string, EngineSystem[]>();

/** Systems due for a set of cadences, in ascending order. Cached by cadence set. */
export function schedule(due: readonly Cadence[], opts?: TickOptions): EngineSystem[] {
  if (!opts?.extraSystems?.length && !opts?.skip?.length) {
    const key = due.join(',');
    let list = scheduleCache.get(key);
    if (!list) {
      list = SYSTEMS.filter((s) => due.includes(s.cadence));
      scheduleCache.set(key, list);
    }
    return list;
  }
  const skip = new Set(opts.skip ?? []);
  return [...SYSTEMS, ...(opts.extraSystems ?? [])]
    .filter((s) => due.includes(s.cadence) && !skip.has(s.id))
    .sort((a, b) => a.order - b.order);
}

export function makeCtx(s: GameStateV2): SystemCtx {
  const streams = new Map<StreamId, StreamRng>();
  return {
    get day() {
      return s.time.day;
    },
    rng(id) {
      let r = streams.get(id);
      if (!r) {
        r = new StreamRng(s, id);
        streams.set(id, r);
      }
      return r;
    },
    cause(key, delta, source, detail) {
      recordCause(s, key, delta, source, detail);
    },
    bump(key, delta, source, detail) {
      return bumpMeter(s, key, delta, source, detail);
    },
    log(kind, text, severity, ref) {
      const e: LogEntry = { day: s.time.day, kind, text };
      if (severity !== undefined) e.severity = severity;
      if (ref !== undefined) e.ref = ref;
      s.log.push(e);
      if (s.log.length > LOG_CAP) s.log.splice(0, s.log.length - LOG_CAP);
    },
    headline(id, text, sector) {
      s.headlines.push(sector ? { day: s.time.day, id, text, sector } : { day: s.time.day, id, text });
      if (s.headlines.length > HEADLINE_CAP) s.headlines.splice(0, s.headlines.length - HEADLINE_CAP);
    },
    queue(eventId, data = {}) {
      const def = EVENT_BY_ID.get(eventId);
      let instance = `${eventId}@${s.time.day}`;
      for (let n = 2; s.events.pending.some((p) => p.instance === instance); n++) instance = `${eventId}@${s.time.day}#${n}`;
      const p: PendingDecision = { id: eventId, instance, day: s.time.day, deadline: s.time.day + (def?.deadlineDays ?? 14), data, crisis: def?.crisis ?? false };
      s.events.pending.push(p);
      s.events.fired[eventId] = s.time.day;
    },
    memo: new Map(),
  };
}

/** Advance one day: every daily system, then each cadence due on the new date, in ascending order. */
export function tick(s: GameStateV2, opts?: TickOptions): void {
  if (s.ending) return;
  const due = cadencesDue(s.time.startDate, s.time.day + 1);
  const ctx = makeCtx(s);
  const day0 = s.time.day;
  for (const sys of schedule(due, opts)) {
    sys.run(s, ctx);
    if (s.ending) break;
  }
  if (s.time.day !== day0 + 1) throw new Error(`tick: clock did not advance exactly one day (${day0} → ${s.time.day})`);
}

/** Player/bot action by id (ActionDef registry). Returns an error string if unavailable. */
export function act(s: GameStateV2, actionId: string, params: Record<string, number | string | boolean> = {}): string | undefined {
  const a = ACTION_BY_ID.get(actionId);
  if (!a) return `unknown action ${actionId}`;
  const ok = a.available(s);
  if (ok !== true) return typeof ok === 'string' ? ok : 'unavailable';
  try {
    const no = a.apply(s, makeCtx(s), params);
    if (typeof no === 'string') return no; // did not go through (e.g. a board veto); its side effects stand
  } catch (e) {
    return e instanceof Error ? e.message : String(e); // apply() validates before mutating
  }
  s.decisions.push({ day: s.time.day, actionId, choice: JSON.stringify(params), tags: [a.sphere], snapshot: decisionSnapshot(s) });
  return undefined;
}

/** Resolve a pending decision instance with choice index. Returns an error string on failure. */
export function resolve(s: GameStateV2, instance: string, choice: number): string | undefined {
  const i = s.events.pending.findIndex((p) => p.instance === instance);
  if (i < 0) return `no pending decision ${instance}`;
  const p = s.events.pending[i];
  const def = EVENT_BY_ID.get(p.id);
  const c = def?.choices[choice];
  if (!def || !c) return `bad choice ${choice} for ${p.id}`;
  const ok = c.available?.(s, p.data) ?? true;
  if (ok !== true) return typeof ok === 'string' ? ok : 'unavailable';
  s.events.pending.splice(i, 1);
  c.apply(s, makeCtx(s), p.data);
  s.decisions.push({ day: s.time.day, eventId: p.id, choice: c.label, tags: c.tags, snapshot: decisionSnapshot(s) });
  return undefined;
}
