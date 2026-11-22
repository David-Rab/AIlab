// The data portfolio (model v3 D1: design/MODEL-V3.md §9; research/20 §A3; data in data/v2/dataAssets.ts). Owner: WS1.
//
//   assets     public web (the lab's crawl of the one shared, finite world stock), licensed, usage, synthetic, expert
//              (one `expert:<family>` asset per suite, made and filled only by suite builds: models/suites.ts, DD-07);
//              each with tokens T, a domain mix and a quality q (1 = the web)
//   U          unique-token stock a base trains on = Σ q·T over the pretraining kinds (public, licensed, usage,
//              synthetic): the stock in web-equivalent tokens (readouts, the draw's weights)
//   draw       (model v3 D3) a base takes its tokens from the slices (asset × domain) by its data mix (drawData):
//              per-slice Muennighoff repetition; drawn effective shares → s_d,data = α·log₁₀(share ÷ ref)
//   quality    (model v3 D11) research/20 A3's D_eff = Σ q_tier·U_tier·(1 + R*·(1 − e^(−(ep−1)/R*))) with each slice's
//              epochs on its own tokens, ÷ the 2025 reference draw's mean quality Q_REF: the loss law's data term
//              (models/effective.ts fDataEff), so better drawn tokens raise G even when nothing repeats [G]
//   synthetic  += pool FLOP ÷ (teacher FLOP per token × overgeneration) per day; q from the teacher's G, up to the
//              ceiling (the web's 1; P10, the synthetic data flywheel, raises it: model v3 D9)
//   worth      (model v3 D9) adopted data-efficiency ideas (P21) multiply every drawn token's worth in the loss law
//   usage      += live products' output tokens × channel eligibility × the lab's data-policy share per day
//   deals      (model v3 D2, actions in production/dataActions.ts) licences by domain are paid at signing and
//              delivered later (`pending`); a synthetic job sends a share of the pool to a chosen teacher
//   readout    data adequacy of the next base: Muennighoff's ≈ free 4 epochs of U vs N_req(next base)
import {
  LICENCE_TIERS, LICENSED_MIX, LICENSED_QUALITY, LICENSED_START_T, PUBLIC_START_COVERAGE, PUBLIC_WEB, SYN_MIX, SYN_OVERGEN, SYN_Q,
  SYN_START_T, USAGE_ELIGIBLE, USAGE_MIX, USAGE_POLICY_SHARE, USAGE_QUALITY, ALPHA_DATA, SPEC_CAP, type DomainMix, type LicenceTier,
} from '../../../data/v2/dataAssets';
import { PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { BASE_DATA, REFERENCE_BASE } from '../../../data/v2/runDesign';
import { effectiveTokens, fDataEff } from '../models/effective';
import { TOKENS } from '../../../data/v2/serving';
import { chatFreeTier } from '../worldfx/serving';
import { PEAK_FLOPS, U_DECODE, U_PREFILL } from '../../../data/v2/workTypes';
import { gOfBuild, gV0 } from '../models/capability';
import { internalVersion, versionById } from '../models/labs';
import type { BaseDesign, DataAsset, DataKind, DataPortfolio, Deployment, DomainId, GameStateV2, ModelVersion, OwnedDataAsset, SystemCtx } from '../types';

// ───────────────────────────── assets ─────────────────────────────

/** The start portfolio (every start type, as before D1): the public crawl 0.9 × 300T, 30T licensed, 20T synthetic at
 *  q 0.5 (made before the game), no usage data yet (expert data lives only in the suites' assets, models/suites.ts). U = 270 + 30 + 0.5·20 = 310T (v1's start stock). */
export function startPortfolio(): DataPortfolio {
  return {
    assets: [
      { id: 'public', kind: 'public', coverage: PUBLIC_START_COVERAGE, licensed: false },
      { id: 'lic:start', kind: 'licensed', tokensT: LICENSED_START_T, mix: { ...LICENSED_MIX }, quality: LICENSED_QUALITY },
      { id: 'usage', kind: 'usage', tokensT: 0, mix: {}, quality: USAGE_QUALITY },
      { id: 'syn:start', kind: 'synthetic', tokensT: SYN_START_T, mix: { ...SYN_MIX }, quality: SYN_Q.atV0, inheritsTraits: true },
    ],
    usageShare: USAGE_POLICY_SHARE,
    pending: [],
  };
}

/** Tokens of an asset (T). The public web is the lab's crawl of the one shared world stock: coverage (≤ 1) × stock. */
export const assetTokensT = (a: DataAsset) => (a.kind === 'public' ? Math.min(1, Math.max(0, a.coverage)) * PUBLIC_WEB.stockT : a.tokensT);
export const assetQuality = (a: DataAsset) => (a.kind === 'public' ? PUBLIC_WEB.quality : a.quality);
export const assetMix = (a: DataAsset): DomainMix => (a.kind === 'public' ? PUBLIC_WEB.mix : a.mix);
/** Kinds a base pretrains on (expert data feeds only RL environments, the suites, D5 / DD-07). */
export const PRETRAIN_KINDS: readonly DataKind[] = ['public', 'licensed', 'usage', 'synthetic'];
const isPretrain = (a: DataAsset) => PRETRAIN_KINDS.includes(a.kind);

export const publicUse = (p: DataPortfolio) => p.assets.find((a) => a.kind === 'public') as Extract<DataAsset, { kind: 'public' }> | undefined;

/** Quality-weighted unique tokens of a portfolio (tokens): U = Σ q·T over the pretraining kinds.
 *  A base whose tokens exceed U repeats them (models/effective.ts fData). */
export function portfolioU(p: DataPortfolio): number {
  let u = 0;
  for (const a of p.assets) if (isPretrain(a)) u += assetQuality(a) * assetTokensT(a);
  return u * 1e12;
}

/** Unique training tokens of the player (tokens): its portfolio's U. Every base plan reads this (models/runs.ts). */
export const uniqueTokens = (s: GameStateV2) => portfolioU(s.player.dataPortfolio);

/** Model v3 D9: the synthetic-quality ceiling, the web's SYN_Q.max = 1 plus adopted data-flywheel effects (P10). */
export const synQualityCap = (s: GameStateV2) => SYN_Q.max + Math.max(0, s.player.research.dataFx?.synQMax ?? 0);
/** Model v3 D9: worth of a drawn token in the loss law (× effective tokens; 1 = the 2025 learner) = 10^(adopted
 *  data-efficiency OOM) (P21, brain-like sample efficiency). */
export const tokenWorth = (s: GameStateV2) => Math.pow(10, Math.max(0, s.player.research.dataFx?.worthOom ?? 0));

/** Per-kind readout (D4's portfolio view): tokens (T), quality-weighted tokens (T), mean quality, domain mix. */
export interface KindRow { kind: DataKind; tokensT: number; weightedT: number; quality: number; mix: DomainMix; assets: number }
export function portfolioByKind(p: DataPortfolio): KindRow[] {
  const kinds: DataKind[] = ['public', 'licensed', 'usage', 'synthetic', 'expert'];
  return kinds.map((kind) => {
    const xs = p.assets.filter((a) => a.kind === kind);
    const tokensT = xs.reduce((a, x) => a + assetTokensT(x), 0);
    const weightedT = xs.reduce((a, x) => a + assetQuality(x) * assetTokensT(x), 0);
    return { kind, tokensT, weightedT, quality: tokensT > 0 ? weightedT / tokensT : 0, mix: mixOf(xs), assets: xs.length };
  });
}

/** Quality-weighted domain mix of a set of assets (shares sum to 1; empty if no tokens). */
export function mixOf(xs: DataAsset[]): DomainMix {
  const out: DomainMix = {};
  let tot = 0;
  for (const a of xs) {
    const w = assetQuality(a) * assetTokensT(a);
    if (w <= 0) continue;
    for (const [d, v] of Object.entries(assetMix(a)) as [DomainId, number][]) out[d] = (out[d] ?? 0) + w * v;
    tot += w;
  }
  if (tot > 0) for (const d of Object.keys(out) as DomainId[]) out[d] = (out[d] ?? 0) / tot;
  return out;
}
/** Domain mix of the pretraining stock (quality-weighted): the natural mix a "balanced" draw takes. */
export const pretrainMix = (p: DataPortfolio) => mixOf(p.assets.filter(isPretrain));

// ───────────────────────────── the draw (model v3 D3) ─────────────────────────────

/** Reference shares of the domain specialisation: the reference recipe's draw at the start (the start portfolio's
 *  natural mix), which the 2025 domain profile o_d was fitted with. */
export const REF_SHARE: DomainMix = pretrainMix(startPortfolio());

/** A mix target (the blueprint's data option, runDesign BASE_DATA): the domain shares it starts from — `reference`, the
 *  2025 recipe's shares (REF_SHARE), or `natural`, the portfolio's own quality-weighted mix — times domain tilts and
 *  kind weights (absent = 1). */
export interface MixTarget { base: 'reference' | 'natural'; tilt: DomainMix; kinds: Partial<Record<DataKind, number>> }
export const NATURAL_MIX: MixTarget = { base: 'natural', tilt: {}, kinds: {} };

/** What a base of `tokens` tokens draws from a portfolio (tokens are counts, not trillions). */
export interface DataDraw {
  tokens: number;
  /** Effective tokens in the loss law (model v3 D11): D_eff = Σ q_i,d · Muennighoff(D_i,d, T_i,d) ÷ Q_REF — quality times
   *  what is left after each slice's repetition, against the 2025 reference draw (= tokens for that draw). */
  dEff: number;
  /** The same without repetition, Σ q·D ÷ Q_REF (the quality part alone), and without quality, Σ Muennighoff(D, T)
   *  (the repetition part alone; = tokens when no slice repeats). */
  dQual: number;
  dRep: number;
  /** Unique tokens this mix can use: the largest base it draws without repeating any slice. For the natural mix it is
   *  U ÷ the best drawn quality (= U while the web, q 1, is the best data): a slice is drawn ∝ q·T, i.e. q× per own
   *  token, so a q 3 corpus repeats first (model v3 D11). */
  uMix: number;
  /** Epochs of the most-repeated slice (tokens ÷ uMix; a slice's epochs = its drawn tokens ÷ its own tokens). */
  epochs: number;
  /** Per domain, the epochs of its most-repeated slice (drawn tokens ÷ the slice's own tokens, D11; F6: the drawn-mix
   *  row's readout, which divided by the domain's quality-weighted U before). */
  epochsD: DomainMix;
  /** Drawn and effective domain shares (each sums to 1), and the specialisation s_d,data (OOM). */
  share: DomainMix;
  effShare: DomainMix;
  sD: DomainMix;
  /** Token-weighted mean quality of the drawn tokens and the same ÷ Q_REF (1 = the 2025 reference draw), and tokens
   *  drawn per kind (D4's readouts). */
  quality: number;
  qRel: number;
  /** Worth of a drawn token in the loss law (model v3 D9, P21; 1 = the 2025 learner): dEff and dQual include it. */
  worth: number;
  byKind: Partial<Record<DataKind, number>>;
  /** Synthetic tokens drawn per teacher (the asset's teacherId; '' = the start stock, written by the start model's
   *  generation). Model v3 AF2: a new base imitates what its teachers' outputs show (safety/traits.ts imitatedStart). */
  bySynTeacher?: Record<string, number>;
}

/** s_d,data = ALPHA_DATA · log₁₀(share_d ÷ REF_SHARE_d), capped at ±SPEC_CAP (MODEL-V3 §2.3, research/20 A2). */
export function specialisation(share: DomainMix): DomainMix {
  const out: DomainMix = {};
  for (const [d, ref] of Object.entries(REF_SHARE) as [DomainId, number][]) {
    if (!(ref > 0)) continue;
    const x = share[d] ?? 0;
    const v = x > 0 ? Math.max(-SPEC_CAP, Math.min(SPEC_CAP, ALPHA_DATA * Math.log10(x / ref))) : -SPEC_CAP;
    if (Math.abs(v) > 1e-9) out[d] = v;
  }
  return out;
}

/** The draw rule (model v3 D3). Slices are (pretraining asset i × domain d) with quality-weighted unique tokens
 *  U_i,d = q_i·T_i·mix_i,d. The target sets each domain's share of the base's tokens:
 *  m_d ∝ B_d·tilt_d·K_d/U_d, where B_d is the starting share (reference: REF_SHARE_d; natural: U_d) and K_d/U_d the
 *  kind weights' pull on that domain (K_d = Σ_i U_i,d·k_kind(i)); within a domain the tokens come from its slices in
 *  proportion to U_i,d·k_kind(i). A domain the portfolio holds nothing of draws nothing (its share goes to the others
 *  in proportion). A slice drawn beyond its own tokens repeats them and pays Muennighoff on that slice alone: a short
 *  domain repeats and loses value — there is no fallback to other data. (D3 compared a slice's draw with U_i,d and let
 *  quality act only through U, D1's rule; D11 below replaces that.) Specialisation reads the effective shares (repeated
 *  tokens teach less). (v1's P10 flags, synthetic ×3 and no repetition penalty, are gone since model v3 D9.)
 *
 *  Model v3 D11 (quality of the drawn tokens, research/20 A3 / A1): the loss law reads D_eff = Σ q_i·D'_i,d ÷ Q_REF,
 *  where D'_i,d = Muennighoff on the slice's own tokens: D'_i,d = T_i,d·(1 + R*·(1 − e^(−(ep − 1)/R*))) with ep =
 *  D_i,d ÷ T_i,d (T_i,d = U_i,d ÷ q_i, the raw tokens). No double counting: quality multiplies the
 *  tokens once (q·Muennighoff(D, T) = Muennighoff(q·D, q·U)), so it no longer also stretches a slice's epochs — a q 3
 *  corpus is worth 3× per token and repeats after its own T tokens, not after 3T. The draw weights (∝ q·T: better data
 *  is sampled more) and the domain shares are D3's, unchanged; specialisation reads repetition only (quality acts on
 *  general G). Q_REF = the 2025 reference draw's mean quality (the start portfolio's, 0.984), so that draw has
 *  D_eff = D and only deviations from the reference mix move G (models/runs.ts baseG).
 *
 *  Model v3 D9: `worth` (adopted data efficiency, P21; default 1) multiplies dEff and dQual: each token teaches the
 *  learner `worth`× as much, repeated or not (repetition still follows each slice's own epochs). */
export function drawData(p: DataPortfolio, tokens: number, target: MixTarget = NATURAL_MIX, opts: { worth?: number } = {}): DataDraw {
  return drawWith(p, tokens, target, opts, Q_REF);
}
function drawWith(p: DataPortfolio, tokens: number, target: MixTarget, opts: { worth?: number }, qRef: number): DataDraw {
  // u: the slice's quality-weighted unique tokens (its draw weight, D3); r: its own tokens (its epochs, D11).
  const slices: { kind: DataKind; d: DomainId; u: number; r: number; k: number; q: number; w: number; teacher?: string }[] = [];
  const Ud: DomainMix = {};
  const Kd: DomainMix = {};
  for (const a of p.assets) {
    if (!isPretrain(a)) continue;
    const q = assetQuality(a);
    const u = q * assetTokensT(a) * 1e12;
    if (!(u > 0)) continue;
    const k = target.kinds[a.kind] ?? 1;
    if (!(k > 0)) continue;
    const mix = assetMix(a);
    let ms = 0;
    for (const v of Object.values(mix)) ms += v ?? 0;
    const m: DomainMix = ms > 0 ? mix : PUBLIC_WEB.mix;
    if (!(ms > 0)) ms = 1;
    for (const [d, v] of Object.entries(m) as [DomainId, number][]) {
      if (!(v > 0)) continue;
      const ud = (u * v) / ms;
      slices.push({ kind: a.kind, d, u: ud, r: ud / q, k, q, w: 0, ...(a.kind === 'synthetic' ? { teacher: a.teacherId ?? '' } : {}) });
      Ud[d] = (Ud[d] ?? 0) + ud;
      Kd[d] = (Kd[d] ?? 0) + ud * k;
    }
  }
  // Domain weight M_d and slice weight w = M_d · U_i,d·k / K_d; the slice's epochs ∝ w/U_i,d = M_d·k/K_d.
  const M: DomainMix = {};
  for (const d of Object.keys(Ud) as DomainId[]) {
    const B = target.base === 'natural' ? (Ud[d] ?? 0) : (REF_SHARE[d] ?? 0);
    M[d] = (Ud[d] ?? 0) > 0 ? (B * (target.tilt[d] ?? 1) * (Kd[d] ?? 0)) / (Ud[d] ?? 1) : 0;
  }
  let W = 0;
  let maxE = 0;
  for (const x of slices) {
    x.w = ((M[x.d] ?? 0) * x.u * x.k) / Math.max(1e-300, Kd[x.d] ?? 0);
    W += x.w;
    if (x.w > 0) maxE = Math.max(maxE, x.w / x.r);
  }
  const worth = opts.worth ?? 1;
  if (!(W > 0) || !(tokens > 0)) return { tokens, dEff: 0, dQual: 0, dRep: 0, uMix: 0, epochs: tokens > 0 ? Infinity : 0, epochsD: {}, share: {}, effShare: {}, sD: {}, quality: 0, qRel: 0, worth, byKind: {} };
  const share: DomainMix = {};
  const eff: DomainMix = {};
  const byKind: Partial<Record<DataKind, number>> = {};
  const epochsD: DomainMix = {};
  const bySyn: Record<string, number> = {};
  let dRep = 0;
  let dEff = 0;
  let qSum = 0;
  let repeats = false;
  for (const x of slices) {
    if (!(x.w > 0)) continue;
    const dx = (tokens * x.w) / W;
    // Repetition on the slice's own tokens (epochs = dx ÷ raw tokens); its quality then scales what is left (D11).
    const ex = dx <= x.r ? dx : effectiveTokens(dx, x.r);
    if (dx > x.r) repeats = true;
    epochsD[x.d] = Math.max(epochsD[x.d] ?? 0, dx / x.r);
    share[x.d] = (share[x.d] ?? 0) + dx / tokens;
    eff[x.d] = (eff[x.d] ?? 0) + ex;
    byKind[x.kind] = (byKind[x.kind] ?? 0) + dx;
    if (x.teacher !== undefined) bySyn[x.teacher] = (bySyn[x.teacher] ?? 0) + dx;
    dRep += ex;
    dEff += x.q * ex;
    qSum += dx * x.q;
  }
  if (!repeats) {
    dRep = tokens;
    dEff = qSum;
  }
  for (const d of Object.keys(eff) as DomainId[]) eff[d] = (eff[d] ?? 0) / Math.max(1e-30, dRep);
  const uMix = W / maxE;
  const quality = qSum / tokens;
  return {
    tokens, dEff: (worth * dEff) / qRef, dQual: (worth * qSum) / qRef, dRep, uMix, epochs: tokens / uMix, epochsD, share, effShare: eff, sD: specialisation(eff), quality, qRel: quality / qRef, worth, byKind,
    ...(Object.keys(bySyn).length ? { bySynTeacher: bySyn } : {}),
  };
}

/** Q_REF: mean quality of the 2025 reference draw — the reference recipe (balanced, B0's size) on the start portfolio,
 *  (270·1 + 30·1 + 10·0.5)/310 = 0.984 — which the start G and the golden dates were fitted with. It defines q = 1 in
 *  the loss law (model v3 D11), so only a mix better or worse than 2025's moves G. */
export const Q_REF: number = drawWith(startPortfolio(), REFERENCE_BASE.params * REFERENCE_BASE.tpp, BASE_DATA.balanced, {}, 1).quality;

/** The player's draw for a base design (its data option as the mix target; adopted data efficiency as the tokens' worth);
 *  `tokens` defaults to the design's (a continue run draws its parent's plus its added tokens, RD-T02). */
export function playerDraw(s: GameStateV2, d: BaseDesign, tokens: number = d.params * d.tpp): DataDraw {
  const t = BASE_DATA[d.data] ?? BASE_DATA.balanced;
  return drawData(s.player.dataPortfolio, tokens, t, { worth: tokenWorth(s) });
}

/** Public-web tokens the lab trains on without a licence (copyright litigation, actors/china.ts; data.license 'web'). */
export function unlicensedPublicT(p: DataPortfolio): number {
  const u = publicUse(p);
  return u && !u.licensed ? assetTokensT(u) : 0;
}

// ───────────────────────────── deals (model v3 D2: licences) ─────────────────────────────

/** The licensed corpus a deal adds: `tokensT` of one domain at the tier's quality (one asset per domain and tier). */
export const licenceAsset = (domain: DomainId, tier: LicenceTier, tokensT: number, day: number): OwnedDataAsset => ({
  id: `lic:${domain}:${tier}`, kind: 'licensed', tokensT, mix: { [domain]: 1 }, quality: LICENCE_TIERS[tier].quality, domain, day,
});
const ownedById = (p: DataPortfolio, id: string) => p.assets.find((a): a is OwnedDataAsset => a.kind !== 'public' && a.id === id);

/** Add a delivered asset: merged into the asset with the same id (tokens summed, mix blended), else appended. */
export function addAsset(p: DataPortfolio, x: OwnedDataAsset) {
  const a = ownedById(p, x.id);
  if (!a) p.assets.push({ ...x, mix: { ...x.mix } });
  else {
    addTo(a, x.tokensT, x.mix);
    if (x.day !== undefined) a.day = x.day;
  }
}
/** Queue a paid deal: the asset arrives on `due`. */
export function queueData(p: DataPortfolio, asset: OwnedDataAsset, due: number) {
  (p.pending ??= []).push({ asset, due });
}
/** Daily: deals whose day has come join the portfolio (production system). */
export function deliverData(s: GameStateV2, ctx?: SystemCtx) {
  const p = s.player.dataPortfolio;
  if (!p.pending?.length) return;
  const keep: typeof p.pending = [];
  for (const d of p.pending) {
    if (d.due > s.time.day) { keep.push(d); continue; }
    addAsset(p, d.asset);
    ctx?.log('research', `Licensed data delivered: ${fmtT(d.asset.tokensT)} of ${d.asset.domain ?? 'mixed'} data at quality ${d.asset.quality}.`, 1, d.asset.domain);
  }
  p.pending = keep;
}
const fmtT = (t: number) => (t >= 1 ? `${t.toFixed(1)}T` : `${(t * 1000).toFixed(t >= 0.01 ? 0 : 1)}B`) + ' tokens';

/** Add `tokensT` of mix `mix` to an owned asset (the mix becomes the token-weighted blend). */
function addTo(a: OwnedDataAsset, tokensT: number, mix: DomainMix) {
  if (tokensT <= 0) return;
  const t0 = a.tokensT;
  const t1 = t0 + tokensT;
  const ds = new Set([...Object.keys(a.mix), ...Object.keys(mix)]) as Set<DomainId>;
  for (const d of ds) a.mix[d] = ((a.mix[d] ?? 0) * t0 + (mix[d] ?? 0) * tokensT) / t1;
  a.tokensT = t1;
}

// ───────────────────────────── synthetic data ─────────────────────────────

/** Synthetic-data quality from the teacher's G: SYN_Q.atV0 at G_V0, + SYN_Q.perOom per OOM, clamped to [SYN_Q.min, cap]
 *  (data/v2/dataAssets); cap = the web's 1 unless P10 raised it (synQualityCap, model v3 D9). */
export const syntheticQuality = (gTeacher: number, gRef: number, cap: number = SYN_Q.max) => Math.min(cap, Math.max(SYN_Q.min, SYN_Q.atV0 + SYN_Q.perOom * (gTeacher - gRef)));
/** Kept synthetic tokens per H100e-day from a teacher with `fpt` FLOP per token: the pool's FLOP per H100e-day ÷
 *  (FLOP per token × overgeneration) (research/20 A3). */
export const synTokensPerH100eDay = (fpt: number) => PHI_FLOP_PER_H100E_DAY / (Math.max(1, fpt) * SYN_OVERGEN);
const fptOf = (v: ModelVersion | undefined) => v?.fpt ?? 2 * REFERENCE_BASE.params;
/** The teacher of the lab's data generation: its internal research model (until D2 lets the player pick one). */
export const synTeacher = (s: GameStateV2) => internalVersion(s) ?? s.player.models.versions[s.player.models.versions.length - 1];

/** Daily synthetic generation from the synthetic pool (player), plus the spare training compute when the spare-training
 *  policy sends it to data generation (R5). The tokens go to the teacher's synthetic asset (q from its G; inherits its
 *  traits). */
export function syntheticAccrual(s: GameStateV2) {
  const p = s.player.dataPortfolio;
  if (p.synJob && (p.synJob.until <= s.time.day || !versionById(s, p.synJob.teacherId))) delete p.synJob;
  const cSyn = synPoolH100e(s);
  if (cSyn <= 0) return;
  const job = p.synJob;
  if (!job) {
    generate(s, synTeacher(s), cSyn);
    return;
  }
  const f = Math.min(1, Math.max(0, job.share));
  generate(s, versionById(s, job.teacherId), cSyn * f);
  if (f < 1) generate(s, synTeacher(s), cSyn * (1 - f));
}
/** H100e generating synthetic data today: the synthetic pool (idle training compute stays idle, DD-19). */
export function synPoolH100e(s: GameStateV2): number {
  return s.player.computeOnline * s.player.split.synthetic;
}
/** The synthetic asset a teacher's data goes to (`syn:<versionId>`; q from its G, inherits its traits). */
export function synAssetFor(s: GameStateV2, t: ModelVersion | undefined, tokensT = 0): OwnedDataAsset {
  const g = t?.build ? gOfBuild(t.build) : gV0(s.hidden.timeline);
  return { id: `syn:${t?.id ?? 'start'}`, kind: 'synthetic', tokensT, mix: { ...SYN_MIX }, quality: syntheticQuality(g, gV0(s.hidden.timeline), synQualityCap(s)), day: s.time.day, teacherId: t?.id, teacherG: g, inheritsTraits: true };
}
/** Kept synthetic tokens (T) from `h100eDays` of generation with teacher `t`. */
export const synTokensT = (t: ModelVersion | undefined, h100eDays: number) => (h100eDays * synTokensPerH100eDay(fptOf(t))) / 1e12;
function generate(s: GameStateV2, t: ModelVersion | undefined, h100e: number) {
  if (!(h100e > 0)) return;
  const id = `syn:${t?.id ?? 'start'}`;
  const p = s.player.dataPortfolio;
  let a = p.assets.find((x): x is OwnedDataAsset => x.id === id && x.kind === 'synthetic');
  const fresh = synAssetFor(s, t);
  if (!a) p.assets.push((a = fresh));
  const dT = synTokensT(t, h100e);
  // Model v3 D9: new tokens carry today's quality (P10 may have raised the ceiling since the asset began, or a
  // continual-learning stream raised the teacher's G); the asset's quality becomes the token-weighted mean [D].
  // Unchanged while the quality is the same.
  if (a.quality !== fresh.quality && a.tokensT + dT > 0) a.quality = (a.quality * a.tokensT + fresh.quality * dT) / (a.tokensT + dT);
  addTo(a, dT, SYN_MIX);
}

// ───────────────────────────── usage data ─────────────────────────────

/** Output tokens a product serves per H100e-day at `fpt` FLOP per token, on the assisted token profile (the serving
 *  model's cost chain, worldfx/serving.ts h100eHoursPer). */
export function outputTokensPerH100eDay(fpt: number): number {
  const tok = TOKENS.assisted;
  const h100eHoursPerHour = (Math.max(1, fpt) * (tok.input / U_PREFILL + tok.output / U_DECODE)) / PEAK_FLOPS / 3600;
  return (24 * tok.output) / h100eHoursPerHour;
}
/** Usage tokens (T/day) a deployment adds: its served output tokens × the channel's eligibility × the policy share.
 *  Served = the compute that met demand, min(served, need): headroom kept on a product (spare serving 'headroom')
 *  serves no tokens (model v3 F6: it counted, ×1.9 at day 400). */
export function usageTokensPerDay(s: GameStateV2, d: Deployment, share = s.player.dataPortfolio.usageShare): number {
  if (d.kind !== 'product' || d.status === 'withdrawn' || !(d.servedH100e! > 0)) return 0;
  const elig = USAGE_ELIGIBLE[d.channel] ?? 0;
  if (elig <= 0) return 0;
  const h = Math.min(d.servedH100e ?? 0, d.needH100e ?? Infinity);
  const main = outputTokensPerH100eDay(fptOf(versionById(s, d.versionId)));
  // A6: Chat's free users run on its free tier (worldfx/revenue.ts: paying users are served first, on the main model),
  // so the served compute beyond the paying need serves the free tier's tokens (×N_main/N_free per H100e). A7: the free
  // tier is its mini, else the cheapest student of its model (worldfx/serving.ts chatFreeTier).
  const free = d.needPaidH100e !== undefined && d.channel === 'consumer' ? chatFreeTier(s, d) : undefined;
  if (!free) return (h * main * elig * share) / 1e12;
  const paid = Math.min(h, d.needPaidH100e!);
  return ((paid * main + (h - paid) * outputTokensPerH100eDay(free.fpt)) * elig * share) / 1e12;
}
/** Usage tokens (T/day) all live products add at policy share `share` (today's traffic; the usage-policy preview). */
export const usageRateAt = (s: GameStateV2, share: number) => s.player.deployments.reduce((a, d) => a + usageTokensPerDay(s, d, share), 0);
/** Daily usage data from the live products (served H100e from the revenue system's last day). */
export function usageAccrual(s: GameStateV2) {
  const p = s.player.dataPortfolio;
  let a = p.assets.find((x): x is OwnedDataAsset => x.kind === 'usage');
  for (const d of s.player.deployments) {
    const t = usageTokensPerDay(s, d);
    if (t <= 0) continue;
    if (!a) p.assets.push((a = { id: 'usage', kind: 'usage', tokensT: 0, mix: {}, quality: USAGE_QUALITY }));
    addTo(a, t, USAGE_MIX[d.channel] ?? {});
  }
}

// ───────────────────────────── readouts ─────────────────────────────

/** Before → after of the Blueprint's data readouts for a change to the portfolio (model v3 D2 previews, D4's view):
 *  U (T), the domain's share of the natural mix (where the stock drifts) and its specialisation on that mix (OOM), and
 *  for the lab's latest base design the unique tokens its mix can use (T), its epochs (the Data tile) and the drawn
 *  tokens' quality term in G (OOM vs the 2025 reference draw, model v3 D11: what a licence buys a base that does not
 *  repeat). */
export interface DataDelta { domain: DomainId; u: [number, number]; share: [number, number]; s: [number, number]; uMix: [number, number]; epochs: [number, number]; qG: [number, number] }
export function dataDelta(s: GameStateV2, change: (p: DataPortfolio) => void, domain: DomainId): DataDelta {
  const p0 = s.player.dataPortfolio;
  const p1: DataPortfolio = { ...p0, assets: p0.assets.map((a) => (a.kind === 'public' ? { ...a } : { ...a, mix: { ...a.mix } })), pending: [...(p0.pending ?? [])] };
  change(p1);
  const worth = tokenWorth(s);
  const b = s.player.models.bases[s.player.models.bases.length - 1]?.design;
  const params = b ? b.params : REFERENCE_BASE.params;
  const tokens = b ? b.params * b.tpp : REFERENCE_BASE.params * REFERENCE_BASE.tpp;
  const target = (b && BASE_DATA[b.data]) ?? BASE_DATA.balanced;
  const read = (p: DataPortfolio) => {
    const nat = drawData(p, tokens, NATURAL_MIX, { worth });
    const bp = drawData(p, tokens, target, { worth });
    return { u: portfolioU(p) / 1e12, share: pretrainMix(p)[domain] ?? 0, s: nat.sD[domain] ?? 0, uMix: bp.uMix / 1e12, epochs: bp.epochs, qG: Math.log10(fDataEff(params, tokens, bp.dQual)) };
  };
  const x = read(p0);
  const y = read(p1);
  return { domain, u: [x.u, y.u], share: [x.share, y.share], s: [x.s, y.s], uMix: [x.uMix, y.uMix], epochs: [x.epochs, y.epochs], qG: [x.qG, y.qG] };
}
/** One line of text for a preview: "U 310.0 → 317.5T · PHYS 4.6% → 6.8% of the stock (s +0.00 → +0.25 OOM) · base epochs 0.16 → 0.16 ·
 *  data quality +0.000 → +0.004 OOM". */
export function dataDeltaText(d: DataDelta): string {
  const f1 = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
  const pc = (x: number) => `${(100 * x).toFixed(1)}%`;
  const sg = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`;
  const sg3 = (x: number) => `${x >= -5e-4 ? '+' : ''}${(Math.abs(x) < 5e-4 ? 0 : x).toFixed(3)}`;
  return `unique tokens ${f1(d.u[0])} → ${f1(d.u[1])}T · ${d.domain} ${pc(d.share[0])} → ${pc(d.share[1])} of the stock (s ${sg(d.s[0])} → ${sg(d.s[1])} OOM) · base epochs ${d.epochs[0].toFixed(2)} → ${d.epochs[1].toFixed(2)} · data quality ${sg3(d.qG[0])} → ${sg3(d.qG[1])} OOM`;
}
