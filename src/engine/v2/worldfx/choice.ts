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
  /** RD-P03: for a provider with seller groups (`groups[i]`), sub[i][b][k] = tier k's part of its band-b share (each
   *  group's best tier for the band, split by the logit among the groups); undefined for the others. */
  sub: (number[][] | undefined)[];
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
  tq: new Float64Array(64), ta: new Float64Array(64), tp: new Float64Array(64), tr: new Uint8Array(64),
  u: new Float64Array(16), e: new Float64Array(16), sh: new Float64Array(16), off: new Int32Array(17),
  sums: new Float64Array(256), f: new Float64Array(256), gU: new Float64Array(256), gS: new Float64Array(256),
};

/** Providers whose access is partial (0 < acc < 1) are enumerated as choice sets up to this many; beyond it the rest
 *  count as fully available (none of the game's regions has more than six). */
const MAX_PARTIAL = 8;

/** A choice set: its probability and its mask over the partial providers (bit k: partial[k]); its members (ascending:
 *  every provider except the partial ones whose bit is off) are built when the plain loop first needs them (insOf). */
interface ChoiceSet { p: number; m: number; ins?: number[] }
/** The choice sets of one access array (and partial list): the partial providers, the sets in mask order (those of
 *  probability > 0), the provider count and, built on first use, per partial provider the sets that contain it. */
interface ChoiceSets { sig: number[]; sets: ChoiceSet[]; n: number; withK?: Int32Array[] }
const sameList = (a: readonly number[], b: readonly number[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};
const setMemo = new WeakMap<readonly number[], ChoiceSets>();
/** Choice sets: every combination of the partially accessible providers that serve, with its probability (memoised on
 *  the access array: mix.ts passes one per region for every sector). */
function choiceSets(acc: readonly number[], lineups: readonly (readonly Tier[])[], brand: readonly number[]): ChoiceSets {
  const n = acc.length;
  const partial: number[] = [];
  for (let i = 0; i < n; i++) if (acc[i] > 0 && brand[i] > 0 && lineups[i].length > 0 && acc[i] < 1 - 1e-12 && partial.length < MAX_PARTIAL) partial.push(i);
  const hit = setMemo.get(acc);
  if (hit && sameList(hit.sig, partial)) return hit;
  const sets: ChoiceSet[] = [];
  for (let m = 0; m < 1 << partial.length; m++) {
    let p = 1;
    for (let k = 0; k < partial.length; k++) {
      const i = partial[k];
      if (m & (1 << k)) p *= acc[i];
      else p *= 1 - acc[i];
    }
    if (p > 0) sets.push({ p, m });
  }
  const out: ChoiceSets = { sig: partial, sets, n };
  setMemo.set(acc, out);
  return out;
}
/** A set's members in ascending order (every provider but the partial ones left out by its mask). */
function insOf(cs: ChoiceSets, set: ChoiceSet): number[] {
  if (set.ins) return set.ins;
  const ins: number[] = [];
  for (let i = 0, k = 0; i < cs.n; i++) {
    if (k < cs.sig.length && cs.sig[k] === i) {
      if (set.m & (1 << k)) ins.push(i);
      k++;
    } else ins.push(i);
  }
  return (set.ins = ins);
}
/** The indices of the sets that contain partial provider k (built on first use: only when a set has probability 0). */
function withK(cs: ChoiceSets, k: number): Int32Array {
  const all = (cs.withK ??= []);
  let a = all[k];
  if (a) return a;
  const { sets } = cs;
  let c = 0;
  for (let q = 0; q < sets.length; q++) if (sets[q].m & (1 << k)) c++;
  a = new Int32Array(c);
  c = 0;
  for (let q = 0; q < sets.length; q++) if (sets[q].m & (1 << k)) a[c++] = q;
  return (all[k] = a);
}

/** One band's shares by the definition (every set's sum over its members in member order, then each member's p·e ÷ Σ in
 *  set order), with the D10 overflow guard. sh is zeroed here; returns Σ p over the sets with Σ > 0. */
function bandSharesPlain(cs: ChoiceSets, e: Float64Array, u: Float64Array, brand: readonly number[], sh: Float64Array, n: number): number {
  for (let i = 0; i < n; i++) sh[i] = 0;
  let tot = 0;
  const sets = cs.sets;
  for (let q = 0; q < sets.length; q++) {
    const set = sets[q];
    const ins = insOf(cs, set);
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
  return tot;
}

/**
 * P4: the same band shares with identical floating-point values, cheaper. (1) The per-set sums Σ e over the members in
 * ascending provider order share their prefixes: walking the providers in order, a provider every set contains adds its
 * e to every partial sum so far, a partial provider k doubles them (sums[m + 2^k] = sums[m] + e), so sums[m] is the same
 * left-to-right sum as the member loop's. (2) Each member's accumulation runs per provider over the sets that contain
 * it, in set order (the same additions into sh[i] in the same order); a set skipped for Σ ≤ 0 contributes 0·e = +0,
 * which leaves sh[i] unchanged (e finite). Needs every e finite (else, or when a set needs the D10 guard, the plain loop
 * runs). Returns tot, or NaN to ask for the plain loop.
 */
function bandSharesFast(cs: ChoiceSets, e: Float64Array, u: Float64Array, brand: readonly number[], sh: Float64Array, n: number): number {
  const { sets, sig } = cs;
  const K = sig.length;
  const Q = sets.length;
  if (S.sums.length < 1 << K) S.sums = new Float64Array(2 << K);
  if (S.f.length < Q) S.f = new Float64Array(2 * Q);
  const sums = S.sums;
  const f = S.f;
  for (let i = 0; i < n; i++) if (!Number.isFinite(e[i])) return NaN;
  sums[0] = 0;
  let size = 1;
  for (let i = 0, k = 0; i < n; i++) {
    const ei = e[i];
    if (k < K && sig[k] === i) {
      for (let m = 0; m < size; m++) sums[m + size] = sums[m] + ei;
      size <<= 1;
      k++;
    } else for (let m = 0; m < size; m++) sums[m] += ei;
  }
  let tot = 0;
  let guarded = false;
  for (let q = 0; q < Q; q++) {
    const set = sets[q];
    const sum = sums[set.m];
    if (!(sum > 0)) {
      f[q] = 0;
      continue;
    }
    tot += set.p;
    if (sum < 1e-250) {
      guarded = true;
      f[q] = NaN; // a D10 set: bandSharesGuarded
      continue;
    }
    f[q] = set.p / sum;
  }
  if (guarded) return bandSharesGuarded(cs, e, u, brand, sh, n, tot);
  // Every mask present (no set of probability 0, the usual case): set q is mask q, so the sets that contain partial k
  // are the blocks [base + 2^k, base + 2^(k+1)) in ascending order.
  const dense = Q === 1 << K;
  for (let i = 0, k = 0; i < n; i++) {
    const ei = e[i];
    let x = 0;
    if (k < K && sig[k] === i) {
      if (ei !== 0) {
        if (dense) {
          const h = 1 << k;
          for (let base = 0; base < Q; base += 2 * h) for (let q = base + h; q < base + 2 * h; q++) x += f[q] * ei;
        } else {
          const qs = withK(cs, k);
          for (let j = 0; j < qs.length; j++) x += f[qs[j]] * ei;
        }
      }
      k++;
    } else if (ei !== 0) for (let q = 0; q < Q; q++) x += f[q] * ei;
    sh[i] = x;
  }
  return tot;
}

/** bandSharesFast's accumulation when some sets need the D10 guard (S.f[q] NaN): those sets' terms are the plain loop's
 *  renormalised ones (uSet and Σ over the members in member order), the others f·e; per provider over its sets in set
 *  order, so every sh[i] receives the same additions in the same order. Providers with e = 0 are not skipped here (a
 *  guarded set can still give them a share). */
function bandSharesGuarded(cs: ChoiceSets, e: Float64Array, u: Float64Array, brand: readonly number[], sh: Float64Array, n: number, tot: number): number {
  const { sets, sig } = cs;
  const K = sig.length;
  const Q = sets.length;
  const f = S.f;
  if (S.gU.length < Q) S.gU = new Float64Array(2 * Q), S.gS = new Float64Array(2 * Q);
  const gU = S.gU;
  const gS = S.gS;
  for (let q = 0; q < Q; q++) {
    if (!Number.isNaN(f[q])) continue;
    const ins = insOf(cs, sets[q]);
    const ni = ins.length;
    let uSet = -Infinity;
    for (let j = 0; j < ni; j++) if (u[ins[j]] > uSet) uSet = u[ins[j]];
    let sum2 = 0;
    for (let j = 0; j < ni; j++) if (u[ins[j]] !== -Infinity) sum2 += brand[ins[j]] * Math.exp(u[ins[j]] - uSet);
    gU[q] = uSet;
    gS[q] = sum2;
  }
  for (let i = 0, k = 0; i < n; i++) {
    const ei = e[i];
    const ui = u[i];
    const bit = k < K && sig[k] === i ? 1 << k++ : 0;
    let x = 0;
    for (let q = 0; q < Q; q++) {
      const set = sets[q];
      if (bit && !(set.m & bit)) continue;
      const fq = f[q];
      if (Number.isNaN(fq)) {
        if (ui !== -Infinity) x += (set.p * brand[i] * Math.exp(ui - gU[q])) / gS[q];
      } else x += fq * ei;
    }
    sh[i] = x;
  }
  return tot;
}

/**
 * The surplus choice of one sector's buyers in one region. `lineups[i]` provider i's tiers (empty: not serving),
 * `brand[i]` its brand weight, `acc[i]` the share of the region's buyers who can buy from it at all (access: export
 * controls, data rules, procurement; each provider independently), `V` the value of an adopted task-hour ($), `aTop`
 * the coverable range (default: the best coverage among the serving providers' tiers). Access is a share of buyers, not
 * a utility weight: under the surplus choice a weight would be overwhelmed wherever one model does work no other can
 * (the old logit's weights and these shares agree for small shares) [D].
 * RD-P03 (DD-02): `groups[i][k]` (optional) puts provider i's tier k in seller group g. Each group is its own seller in
 * the logit (its best tier for the band), sharing the provider's brand and access (a buyer who can buy from the lab can
 * buy each of its products). RF-P5: the provider is one nest: its band utility is its best group's (as with one
 * product), so a second product with the same offer adds no share (the log-sum ln Σ_g e^u_g did: a duplicate-seller
 * artefact); its band share splits e^u_g ÷ Σ e^u among its products (Choice.sub).
 * MK-5 (design/MARKET.md M2): `reach[i][k]` (optional; absent = every tier) false leaves provider i's tier k out of this
 * buyer group's choice (the ladder: a small firm cannot buy the player's Enterprise). A provider with no reachable tier
 * gets e = 0 but stays in the choice sets, so the sets (memoised on `acc`) are the same for every group and its share is
 * exactly as if it were absent. μ_b, a_top and the quality reference stay the market's (every tier's), so the groups'
 * bands and price scales are the same and their shares add band by band [D].
 */
export function surplusChoice(lineups: readonly (readonly Tier[])[], brand: readonly number[], acc: readonly number[], V: number, aTop?: number, B = MARKET_BANDS, groups?: readonly (readonly number[] | undefined)[], reach?: readonly (readonly boolean[] | undefined)[]): Choice {
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
  const sub: (number[][] | undefined)[] = [];
  for (let i = 0; i < n; i++) sub.push(groups?.[i] ? [] : undefined);
  if (!(top > 0) || fitMax === -Infinity) return { aTop: top, target, share, pick, mu, sub };
  const cs = choiceSets(acc, lineups, brand);
  if (S.tq.length < nt) S.tq = new Float64Array(2 * nt), S.ta = new Float64Array(2 * nt), S.tp = new Float64Array(2 * nt), S.tr = new Uint8Array(2 * nt);
  if (S.u.length < n) S.u = new Float64Array(2 * n), S.e = new Float64Array(2 * n), S.sh = new Float64Array(2 * n), S.off = new Int32Array(2 * n + 1);
  const { tq, ta, tp, tr, u, e, sh, off } = S;
  let pAll = Infinity;
  for (let i = 0, j = 0; i < n; i++) {
    off[i] = j;
    if (!on[i]) continue;
    const L = lineups[i];
    const ri = reach?.[i];
    for (let k = 0; k < L.length; k++, j++) {
      const t = L[k];
      tr[j] = ri && !ri[k] ? 0 : 1;
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
      const gi = groups?.[i];
      const gu: number[] = [];
      const gk: number[] = [];
      for (let j = j0; j < j1; j++) {
        if (!tr[j]) continue; // MK-5: not on this buyer group's rungs
        const a = ta[j];
        // tierUtility, adequacy (P4: a ≥ hi gives (a − lo)/w ≥ 1 and a ≤ lo gives ≤ 0 under rounding, so the clamp's
        // value is taken without the division there)
        const x = tq[j] + (V * (hi <= lo ? (a >= hi ? 1 : 0) : a >= hi ? 1 : a <= lo ? 0 : Math.max(0, Math.min(1, (a - lo) / w))) - tp[j]) / m;
        if (x > u[i]) {
          u[i] = x;
          pk[b] = j - j0;
        }
        if (gi) {
          const g = gi[j - j0];
          if (gu[g] === undefined || x > gu[g]) {
            gu[g] = x;
            gk[g] = j - j0;
          }
        }
      }
      if (gi) {
        // RD-P03 / RF-P5: one nest per provider: its utility stays its best group's (u1); the band's share splits by e^u_g.
        const tw = packed(j1 - j0, 0);
        const u1 = u[i];
        if (u1 > -Infinity) {
          let z = 0;
          for (let g = 0; g < gu.length; g++) if (gu[g] > -Infinity) z += Math.exp(gu[g] - u1);
          for (let g = 0; g < gu.length; g++) if (gu[g] > -Infinity) tw[gk[g]] += Math.exp(gu[g] - u1) / z;
        }
        sub[i]![b] = tw;
      }
      if (u[i] > uMax) uMax = u[i];
    }
    for (let i = 0; i < n; i++) e[i] = u[i] === -Infinity ? 0 : brand[i] * Math.exp(u[i] - uMax);
    let tot = bandSharesFast(cs, e, u, brand, sh, n);
    if (Number.isNaN(tot)) tot = bandSharesPlain(cs, e, u, brand, sh, n);
    if (tot > 0) for (let i = 0; i < n; i++) {
      const x = sh[i] / tot;
      share[i][b] = x;
      target[i] += x / B;
    }
  }
  return { aTop: top, target, share, pick, mu, sub };
}

/**
 * MK-5 (design/MARKET.md M2): one market's choice from its buyer groups' choices (`w` the group's share of the buyers;
 * weights sum 1; every part on the same bands and μ, as surplusChoice gives with `reach`): target and band shares are the
 * weighted sums; a provider's tier split per band (sub) is the groups' splits weighted by their hours there (by the
 * group weights where no group buys from it); pick is the tier of the group with the most of its hours on the band. A
 * single part is returned as is.
 */
export function mergeChoices(parts: readonly { w: number; ch: Choice }[]): Choice {
  if (parts.length === 1) return parts[0].ch;
  const c0 = parts[0].ch;
  const n = c0.target.length;
  const B = c0.mu.length;
  const target = zeros(n);
  const share: number[][] = [];
  const pick: number[][] = [];
  const sub: (number[][] | undefined)[] = [];
  for (let i = 0; i < n; i++) {
    for (const { w, ch } of parts) target[i] += w * ch.target[i];
    const sh = zeros(B);
    const pk = packed(B, -1);
    const hasSub = (c0.sub[i]?.length ?? 0) > 0;
    const sb: number[][] = [];
    for (let b = 0; b < B; b++) {
      let best = -1;
      let tw: number[] | undefined;
      let fb: number[] | undefined;
      for (const { w, ch } of parts) {
        const x = w * (ch.share[i]?.[b] ?? 0);
        sh[b] += x;
        if (ch.pick[i][b] >= 0 && (pk[b] < 0 || x > best)) {
          best = x;
          pk[b] = ch.pick[i][b];
        }
        const g = ch.sub[i]?.[b];
        if (hasSub && g) {
          tw ??= packed(g.length, 0);
          fb ??= packed(g.length, 0);
          for (let k = 0; k < g.length; k++) {
            tw[k] += x * g[k];
            fb[k] += w * g[k];
          }
        }
      }
      if (hasSub) {
        let row = tw ?? [];
        if (tw && fb) {
          if (sh[b] > 0) for (let k = 0; k < tw.length; k++) tw[k] /= sh[b];
          else {
            let z = 0;
            for (const x of fb) z += x;
            for (let k = 0; k < fb.length; k++) fb[k] = z > 0 ? fb[k] / z : 0;
            row = fb;
          }
        }
        sb.push(row);
      }
    }
    share.push(sh);
    pick.push(pk);
    sub.push(hasSub ? sb : c0.sub[i] ? [] : undefined);
  }
  return { aTop: c0.aTop, target, share, pick, mu: c0.mu, sub };
}
