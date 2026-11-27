// Named RNG streams (V2-SPEC §2.4). Owner: WS1.
// Each stream is a mulberry32 state seeded from hash32(seed, streamName) and stored in s.rng[stream], so a
// workstream adding a draw in its own stream never perturbs another stream's sequence (stream-isolation test).
import { Rng } from '../../rng';
import type { GameStateV2, RngLike, StreamId } from '../types';

export const STREAMS: readonly StreamId[] = [
  'world', 'prod', 'runs', 'safety', 'incidents', 'security', 'market', 'finance',
  'actors', 'rivals', 'china', 'worldfx', 'events', 'endings', 'labour',
];

/** 32-bit FNV-1a of `${seed}:${name}` followed by a murmur3 finaliser. Never returns 0. */
export function hash32(seed: number, name: string): number {
  let h = 0x811c9dc5;
  const str = `${seed >>> 0}:${name}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0 || 0x9e3779b9;
}

export function seedStreams(seed: number): Record<StreamId, number> {
  const out = {} as Record<StreamId, number>;
  for (const id of STREAMS) out[id] = hash32(seed, id);
  return out;
}

/**
 * Wrapper around the v1 Rng that reads its state from `holder.rng[id]` before each draw and writes it back after.
 * Safe to hold across calls within a tick; state always lives in the (serialisable) game state.
 */
export class StreamRng implements RngLike {
  private r = new Rng(0);
  constructor(private holder: { rng: Record<StreamId, number> }, readonly id: StreamId) {}
  private load() {
    this.r.state = this.holder.rng[this.id];
    return this.r;
  }
  private save<T>(v: T): T {
    this.holder.rng[this.id] = this.r.state;
    return v;
  }
  float() { return this.save(this.load().float()); }
  range(lo: number, hi: number) { return this.save(this.load().range(lo, hi)); }
  chance(p: number) { return this.save(this.load().chance(p)); }
  normal(mean = 0, sd = 1) { return this.save(this.load().normal(mean, sd)); }
  normal80(p10: number, p90: number) { return this.save(this.load().normal80(p10, p90)); }
  lognormal80(p10: number, p90: number) { return this.save(this.load().lognormal80(p10, p90)); }
  gamma(shape: number) { return this.save(this.load().gamma(shape)); }
  beta(a: number, b: number) { return this.save(this.load().beta(a, b)); }
  pick<T>(xs: readonly T[]): T { return this.save(this.load().pick(xs)); }
  weighted<T>(xs: readonly { item: T; weight: number }[]): T { return this.save(this.load().weighted(xs)); }
  /** Integer in [lo, hi] inclusive. */
  int(lo: number, hi: number) { return this.save(lo + Math.floor(this.load().float() * (hi - lo + 1))); }
}

/** Stream accessor for code outside a tick (newGame, actions). Inside systems use ctx.rng(stream). */
export function stream(s: Pick<GameStateV2, 'rng'>, id: StreamId): StreamRng {
  return new StreamRng(s, id);
}
