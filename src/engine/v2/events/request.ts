// Asking the event director to raise a decision. Owner: events.
import type { Day } from '../types';

/** Ask the director to raise decision `id` (deduplicated against open requests and pending decisions). */
export function request(s: { time: { day: Day }; events: { requests: { id: string; day: Day; data: Record<string, number | string> }[]; pending: { id: string; data: Record<string, number | string> }[] } }, id: string, data: Record<string, number | string> = {}) {
  const q = s.events;
  const same = (d: Record<string, number | string>) => JSON.stringify(d) === JSON.stringify(data);
  if (q.requests.some((r) => r.id === id && same(r.data)) || q.pending.some((p) => p.id === id && same(p.data))) return;
  q.requests.push({ id, day: s.time.day, data });
}
