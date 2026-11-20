// Which model a sector's buyers choose for a task: a discrete choice on surplus over bands of task difficulty (task A5;
// design/V3-BUILD.md "A5 notes"). Owner: WS5. Pure: worldfx/mix.ts builds the lineups and reads the result.
//
//   tasks      the coverage function a = σ((fit − θ_s)/s)·p(H_s | h50) (V3) is the share of a sector's tasks a model does
//              alone: tasks differ in difficulty around θ_s with the same spread s, so a model with coverage a does the
//              easiest a of them (one difficulty index for fit and horizon [D]). Adopted task-hours lie on the tasks some
//              model can do (A ≤ F, research/16 step 4), spread evenly over u ∈ [0, a_top] [D], a_top the best coverage on
//              offer; MARKET_BANDS bands of equal hours.
//   adequacy   a tier with coverage a does x_b = clamp((a − u_{b−1}) ÷ (u_b − u_{b−1}), 0, 1) of band b's tasks adequately;
//              the mean over bands is a ÷ a_top exactly, so the work-type coverage is unchanged.
//   surplus    S_b = V·x_b − p per hour: V the value of an adopted task-hour (wage × hours saved), p the tier's price
//              (≤ V). A model with x 0.97 at a tenth of the price beats one with x 1 whenever V·0.03 < Δp.
//   choice     each provider offers on band b its best tier; shares on b ∝ brand·exp(u) among the providers a buyer can
//              reach (access = the share of buyers who can, independently per provider [D]), u = SHARE_SLOPE_G·fit +
//              S_b ÷ μ_b, μ_b = p_min,b ÷ ε (p_min,b the cheapest offer that does the whole band). μ is the old logit's
//              price scale: at the cheapest offer the price response is the old elasticity ε, and for prices near each
//              other −ε(p ÷ p_min − 1) ≈ −ε·ln(p ÷ p_min), the old price term. SHARE_SLOPE_G·fit is V4's quality term,
//              kept: beyond adequacy a better model still does the task better. With equal prices and every offer
//              adequate (and full access) the choice is the old logit exactly; where a cheap tier does the task too, the price difference
//              in units of μ (≫ 1 for a tier 10× cheaper) decides; where it does not, V·(1 − x) ÷ μ keeps the work on the
//              frontier.
//   target     provider share = the mean of its band shares (sums to 1); its customers' tier mix = its band shares.
import { MARKET_BANDS, PRICE_ELASTICITY, SHARE_SLOPE_G } from '../../../data/v2/serving';

/** One model a provider offers on a sector's work: its fit (OOM), coverage of the sector's tasks and price per adopted
 *  task-hour ($, already value-capped). */
export interface Tier { fit: number; a: number; price: number }

export interface Choice {
  /** Upper edge of the coverable range (the best coverage on offer) and the bands' upper edges. */
  aTop: number;
  /** Provider target shares (mean over bands; sum 1 over providers with w > 0). */
  target: number[];
  /** share[i][b]: provider i's share of band b's hours; pick[i][b]: the index of its tier there. */
  share: number[][];
  pick: number[][];
  /** μ_b ($): the band's price scale. */
  mu: number[];
}

/** Share of band [lo, hi] of the tasks a tier with coverage a does adequately. */
export const adequacy = (a: number, lo: number, hi: number) => (hi <= lo ? (a >= hi ? 1 : 0) : Math.max(0, Math.min(1, (a - lo) / (hi - lo))));

/** Utility of a tier on a band (without the provider's access·brand). */
export const tierUtility = (t: Tier, x: number, V: number, mu: number) => SHARE_SLOPE_G * t.fit + (V * x - t.price) / mu;

/** A packed array of n copies of x (faster than new Array(n).fill(x), which is holey). */
function packed(n: number, x: number): number[] {
  const a: number[] = [];
  for (let i = 0; i < n; i++) a.push(x);
  return a;
}
const zeros = (n: number) => packed(n, 0);

/** surplusChoice's scratch buffers (reused across calls; every entry it reads is written first in the same call). */
const S = {
  tq: new Float64Array(64), ta: new Float64Array(64), tp: new Float64Array(64),
  u: new Float64Array(16), e: new Float64Array(16), sh: new Float64Array(16), off: new Int32Array(17),
};

/** Providers whose access is partial (0 < acc < 1) are enumerated as choice sets up to this many; beyond it the rest
 *  count as fully available (none of the game's regions has more than six). */
const MAX_PARTIAL = 8;

interface ChoiceSet { p: number; ins: number[] }
const sameList = (a: readonly number[], b: readonly number[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};
const setMemo = new WeakMap<readonly number[], { sig: number[]; sets: ChoiceSet[] }>();
/** Choice sets: every combination of the partially accessible providers that serve, with its probability (memoised on
 *  the access array: mix.ts passes one per region for every sector). */
function choiceSets(acc: readonly number[], lineups: readonly (readonly Tier[])[], brand: readonly number[]): ChoiceSet[] {
  const n = acc.length;
  const partial: number[] = [];
  for (let i = 0; i < n; i++) if (acc[i] > 0 && brand[i] > 0 && lineups[i].length > 0 && acc[i] < 1 - 1e-12 && partial.length < MAX_PARTIAL) partial.push(i);
  const hit = setMemo.get(acc);
  if (hit && sameList(hit.sig, partial)) return hit.sets;
  const sets: ChoiceSet[] = [];
  for (let m = 0; m < 1 << partial.length; m++) {
    let p = 1;
    const out: boolean[] = [];
    for (let i = 0; i < n; i++) out.push(false);
    for (let k = 0; k < partial.length; k++) {
      const i = partial[k];
      if (m & (1 << k)) p *= acc[i];
      else {
        p *= 1 - acc[i];
        out[i] = true;
      }
    }
    const ins: number[] = [];
    for (let i = 0; i < n; i++) if (!out[i]) ins.push(i);
    if (p > 0) sets.push({ p, ins });
  }
  setMemo.set(acc, { sig: partial, sets });
  return sets;
}

/**
 * The surplus choice of one sector's buyers in one region. `lineups[i]` provider i's tiers (empty: not serving),
 * `brand[i]` its brand weight, `acc[i]` the share of the region's buyers who can buy from it at all (access: export
 * controls, data rules, procurement; each provider independently), `V` the value of an adopted task-hour ($), `aTop`
 * the coverable range (default: the best coverage among the serving providers' tiers). Access is a share of buyers, not
 * a utility weight: under the surplus choice a weight would be overwhelmed wherever one model does work no other can
 * (the old logit's weights and these shares agree for small shares) [D].
 */
export function surplusChoice(lineups: readonly (readonly Tier[])[], brand: readonly number[], acc: readonly number[], V: number, aTop?: number, B = MARKET_BANDS): Choice {
  const n = lineups.length;
  // P3: the serving providers' tiers flattened once (offsets per provider), the band-independent parts hoisted (the
  // quality term, the cheapest price), shares accumulated in a flat buffer per band; the same operations in the same
  // order as before, so every value is identical.
  const on: boolean[] = [];
  let nt = 0;
  for (let i = 0; i < n; i++) {
    const ok = acc[i] > 0 && brand[i] > 0 && lineups[i].length > 0;
    on.push(ok);
    if (ok) nt += lineups[i].length;
  }
  let top = aTop ?? 0;
  let fitMax = -Infinity;
  for (let i = 0; i < n; i++) {
    if (!on[i]) continue;
    const L = lineups[i];
    for (let k = 0; k < L.length; k++) {
      const t = L[k];
      if (aTop === undefined && t.a > top) top = t.a;
      if (t.fit > fitMax) fitMax = t.fit;
    }
  }
  const target = zeros(n);
  const share: number[][] = [];
  const pick: number[][] = [];
  for (let i = 0; i < n; i++) {
    share.push(zeros(B));
    pick.push(packed(B, -1));
  }
  const mu = zeros(B);
  if (!(top > 0) || fitMax === -Infinity) return { aTop: top, target, share, pick, mu };
  const sets = choiceSets(acc, lineups, brand);
  if (S.tq.length < nt) S.tq = new Float64Array(2 * nt), S.ta = new Float64Array(2 * nt), S.tp = new Float64Array(2 * nt);
  if (S.u.length < n) S.u = new Float64Array(2 * n), S.e = new Float64Array(2 * n), S.sh = new Float64Array(2 * n), S.off = new Int32Array(2 * n + 1);
  const { tq, ta, tp, u, e, sh, off } = S;
  let pAll = Infinity;
  for (let i = 0, j = 0; i < n; i++) {
    off[i] = j;
    if (!on[i]) continue;
    const L = lineups[i];
    for (let k = 0; k < L.length; k++, j++) {
      const t = L[k];
      tq[j] = SHARE_SLOPE_G * (t.fit - fitMax);
      ta[j] = t.a;
      tp[j] = t.price;
      if (t.price < pAll) pAll = t.price;
    }
  }
  off[n] = nt;
  for (let b = 0; b < B; b++) {
    const lo = (top * b) / B;
    const hi = (top * (b + 1)) / B;
    const w = hi - lo;
    // μ_b: the cheapest offer in the region that does the whole band (else the cheapest offer), over the old elasticity.
    let pAd = Infinity;
    for (let j = 0; j < nt; j++) if (ta[j] >= hi && tp[j] < pAd) pAd = tp[j]; // adequacy 1
    const m = Math.max(1e-12, pAd < Infinity ? pAd : pAll) / PRICE_ELASTICITY;
    mu[b] = m;
    let uMax = -Infinity;
    for (let i = 0; i < n; i++) {
      u[i] = -Infinity;
      if (!on[i]) continue;
      const pk = pick[i];
      const j0 = off[i];
      const j1 = off[i + 1];
      for (let j = j0; j < j1; j++) {
        const a = ta[j];
        const x = tq[j] + (V * (hi <= lo ? (a >= hi ? 1 : 0) : Math.max(0, Math.min(1, (a - lo) / w))) - tp[j]) / m; // tierUtility, adequacy
        if (x > u[i]) {
          u[i] = x;
          pk[b] = j - j0;
        }
      }
      if (u[i] > uMax) uMax = u[i];
    }
    for (let i = 0; i < n; i++) {
      e[i] = u[i] === -Infinity ? 0 : brand[i] * Math.exp(u[i] - uMax);
      sh[i] = 0;
    }
    let tot = 0;
    for (let q = 0; q < sets.length; q++) {
      const set = sets[q];
      const ins = set.ins;
      const ni = ins.length;
      let sum = 0;
      for (let j = 0; j < ni; j++) sum += e[ins[j]];
      if (!(sum > 0)) continue;
      tot += set.p;
      if (sum < 1e-250) {
        // D10: every member of this set is far below the band's best, so e is denormal and p ÷ Σ overflowed to Infinity
        // (seen at day 900 once cheap tiers made μ_b tiny): renormalise on the set's own best utility. The same shares
        // in exact arithmetic; the common path below is unchanged. (M5: this is the one overflow guard. It replaces
        // M3's divide-first fallback, c98f2ed, which fired only once f was infinite and kept the denormal weights, so
        // members that had underflowed to 0 got no share; renormalising also covers that. A set whose every weight
        // underflowed to exactly 0 is still skipped by the check above.)
        let uSet = -Infinity;
        for (let j = 0; j < ni; j++) if (u[ins[j]] > uSet) uSet = u[ins[j]];
        let sum2 = 0;
        for (let j = 0; j < ni; j++) if (u[ins[j]] !== -Infinity) sum2 += brand[ins[j]] * Math.exp(u[ins[j]] - uSet);
        for (let j = 0; j < ni; j++) {
          const i = ins[j];
          if (u[i] !== -Infinity) sh[i] += (set.p * brand[i] * Math.exp(u[i] - uSet)) / sum2;
        }
        continue;
      }
      const f = set.p / sum;
      for (let j = 0; j < ni; j++) {
        const i = ins[j];
        sh[i] += f * e[i];
      }
    }
    if (tot > 0) for (let i = 0; i < n; i++) {
      const x = sh[i] / tot;
      share[i][b] = x;
      target[i] += x / B;
    }
  }
  return { aTop: top, target, share, pick, mu };
}
