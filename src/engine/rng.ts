// Seeded PRNG (mulberry32) + distribution helpers. `state` is a plain number so it can live in save games.

export class Rng {
  constructor(public state: number) {}
  private next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float() {
    return this.next();
  }
  range(lo: number, hi: number) {
    return lo + (hi - lo) * this.next();
  }
  chance(p: number) {
    return this.next() < p;
  }
  normal(mean = 0, sd = 1) {
    const u = Math.max(1e-12, this.next());
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** Lognormal specified by its 10th and 90th percentiles (as AI 2027's forecasts usually are). */
  lognormal80(p10: number, p90: number) {
    const z90 = 1.2815515655446004;
    const mu = (Math.log(p10) + Math.log(p90)) / 2;
    const sigma = (Math.log(p90) - Math.log(p10)) / (2 * z90);
    return Math.exp(this.normal(mu, sigma));
  }
  /** Normal specified by 10th/90th percentiles. */
  normal80(p10: number, p90: number) {
    const z90 = 1.2815515655446004;
    return this.normal((p10 + p90) / 2, (p90 - p10) / (2 * z90));
  }
  /** Gamma(shape, 1) by Marsaglia–Tsang (2000); shape < 1 via the u^(1/shape) boost. (v2 addition) */
  gamma(shape: number): number {
    if (shape <= 0) return 0;
    if (shape < 1) return this.gamma(shape + 1) * Math.pow(Math.max(1e-12, this.next()), 1 / shape);
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number;
      let v: number;
      do {
        x = this.normal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = Math.max(1e-12, this.next());
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
  /** Beta(a, b) from two gammas. (v2 addition) */
  beta(a: number, b: number): number {
    const x = this.gamma(a);
    const y = this.gamma(b);
    return x + y > 0 ? x / (x + y) : 0.5;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  weighted<T>(items: readonly { item: T; weight: number }[]): T {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = this.next() * total;
    for (const i of items) {
      r -= i.weight;
      if (r <= 0) return i.item;
    }
    return items[items.length - 1].item;
  }
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
