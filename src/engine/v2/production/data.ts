// The data portfolio (model v3 D1: design/MODEL-V3.md §9; research/20 §A3; data in data/v2/dataAssets.ts). Owner: WS1.
//
//   assets     public web (the lab's crawl of the one shared, finite world stock), licensed, usage, synthetic, expert;
//              each with tokens T, a domain mix and a quality q (1 = the web)
//   U          unique-token stock a base trains on = Σ q·T over the pretraining kinds (public, licensed, usage,
//              synthetic; synthetic × 3 with P10) — research/20 A3's D_eff = Σ q_tier·U_tier·(1 + R*·(1 − e^(−(ep−1)/R*))):
//              quality acts through U, so in G only through the repetition fraction f_data (models/effective.ts) [G]
//   draw       (model v3 D3) a base takes its tokens from the slices (asset × domain) by its data mix (drawData):
//              per-slice Muennighoff repetition → D_eff → f_data; drawn effective shares → s_d,data = α·log₁₀(share ÷ ref)
//   synthetic  += pool FLOP ÷ (teacher FLOP per token × overgeneration) per day; q from the teacher's G
//   usage      += live products' output tokens × channel eligibility × the lab's data-policy share per day
//   readout    data adequacy of the next base: Muennighoff's ≈ free 4 epochs of U vs N_req(next base)
import {
  LICENCE_DEAL_SHARE, LICENSED_MIX, LICENSED_QUALITY, LICENSED_START_T, P10_SYN_MULT, PUBLIC_START_COVERAGE, PUBLIC_WEB, SYN_MIX, SYN_OVERGEN, SYN_Q,
  SYN_START_T, USAGE_ELIGIBLE, USAGE_MIX, USAGE_POLICY_SHARE, USAGE_QUALITY, EXPERT_QUALITY, ALPHA_DATA, SPEC_CAP, type DomainMix,
} from '../../../data/v2/dataAssets';
import { PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { BASE_DATA, REFERENCE_BASE } from '../../../data/v2/runDesign';
import { effectiveTokens } from '../models/effective';
import { TOKENS } from '../../../data/v2/serving';
import { PEAK_FLOPS, U_DECODE, U_PREFILL } from '../../../data/v2/workTypes';
import { gOfBuild, gV0 } from '../models/capability';
import { internalVersion, versionById } from '../models/labs';
import { latestBaseFlop } from '../models/stacks';
import { idleTrainingShare } from '../models/runs';
import type { BaseDesign, DataAsset, DataKind, DataPortfolio, Deployment, DomainId, GameStateV2, ModelVersion, OwnedDataAsset } from '../types';

// ───────────────────────────── assets ─────────────────────────────

/** The start portfolio (every start type, as before D1): the public crawl 0.9 × 300T, 30T licensed, 20T synthetic at
 *  q 0.5 (made before the game), no usage or expert data yet. U = 270 + 30 + 0.5·20 = 310T (v1's start stock). */
export function startPortfolio(): DataPortfolio {
  return {
    assets: [
      { id: 'public', kind: 'public', coverage: PUBLIC_START_COVERAGE, licensed: false },
      { id: 'lic:start', kind: 'licensed', tokensT: LICENSED_START_T, mix: { ...LICENSED_MIX }, quality: LICENSED_QUALITY },
      { id: 'usage', kind: 'usage', tokensT: 0, mix: {}, quality: USAGE_QUALITY },
      { id: 'syn:start', kind: 'synthetic', tokensT: SYN_START_T, mix: { ...SYN_MIX }, quality: SYN_Q.atV0, inheritsTraits: true },
      { id: 'expert', kind: 'expert', tokensT: 0, mix: {}, quality: EXPERT_QUALITY },
    ],
    usageShare: USAGE_POLICY_SHARE,
  };
}

/** v2's token counts (schemaRev ≤ 20). */
export interface V2DataAssets { licensedTokensT: number; unlicensedTokensT: number; syntheticTokensT: number; litigationRisk?: number }
/** Save migration 20 → 21: the same U and the same unlicensed tokens as v2's (licensed + unlicensed) × (1 + 0.5·deals) +
 *  0.5 × synthetic — the crawl up to the start coverage, the rest of the human tokens licensed, the deals as a corpus. */
export function dataPortfolioFromV2(a: V2DataAssets, deals: number): DataPortfolio {
  const p = startPortfolio();
  const human = a.licensedTokensT + a.unlicensedTokensT;
  const crawlT = Math.min(PUBLIC_START_COVERAGE * PUBLIC_WEB.stockT, human);
  const pub = publicUse(p)!;
  pub.coverage = crawlT / PUBLIC_WEB.stockT;
  pub.licensed = a.unlicensedTokensT <= 0;
  const set = (id: string, t: number) => {
    const x = p.assets.find((y): y is OwnedDataAsset => y.id === id);
    if (x) x.tokensT = t;
  };
  set('lic:start', human - crawlT);
  set('syn:start', a.syntheticTokensT);
  if (deals > 0) p.assets.push({ id: 'lic:corpus:0', kind: 'licensed', tokensT: (LICENCE_DEAL_SHARE * deals * human) / LICENSED_QUALITY, mix: { ...LICENSED_MIX }, quality: LICENSED_QUALITY, day: 0 });
  return p;
}

/** Tokens of an asset (T). The public web is the lab's crawl of the one shared world stock: coverage (≤ 1) × stock. */
export const assetTokensT = (a: DataAsset) => (a.kind === 'public' ? Math.min(1, Math.max(0, a.coverage)) * PUBLIC_WEB.stockT : a.tokensT);
export const assetQuality = (a: DataAsset) => (a.kind === 'public' ? PUBLIC_WEB.quality : a.quality);
export const assetMix = (a: DataAsset): DomainMix => (a.kind === 'public' ? PUBLIC_WEB.mix : a.mix);
/** Kinds a base pretrains on (expert data feeds RL environments and evals, D5). */
export const PRETRAIN_KINDS: readonly DataKind[] = ['public', 'licensed', 'usage', 'synthetic'];
const isPretrain = (a: DataAsset) => PRETRAIN_KINDS.includes(a.kind);

export const publicUse = (p: DataPortfolio) => p.assets.find((a) => a.kind === 'public') as Extract<DataAsset, { kind: 'public' }> | undefined;

/** Quality-weighted unique tokens of a portfolio (tokens): U = Σ q·T over the pretraining kinds, synthetic × 3 with P10.
 *  A base whose tokens exceed U repeats them (models/effective.ts fData). */
export function portfolioU(p: DataPortfolio, opts: { p10?: boolean } = {}): number {
  let u = 0;
  for (const a of p.assets) {
    if (!isPretrain(a)) continue;
    u += assetQuality(a) * assetTokensT(a) * (a.kind === 'synthetic' && opts.p10 ? P10_SYN_MULT : 1);
  }
  return u * 1e12;
}

const p10 = (s: GameStateV2) => s.player.paradigms.P10?.status === 'adopted';
/** Unique training tokens of the player (tokens): its portfolio's U. Every base plan reads this (models/runs.ts). */
export const uniqueTokens = (s: GameStateV2) => portfolioU(s.player.dataPortfolio, { p10: p10(s) });

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
  /** Effective tokens after repetition, Muennighoff per slice (= tokens when no slice repeats). */
  dEff: number;
  /** Unique tokens this mix can use: the largest base it draws without repeating any slice (= U for the natural mix). */
  uMix: number;
  /** Epochs of the most-repeated slice (tokens ÷ uMix). */
  epochs: number;
  /** Drawn and effective domain shares (each sums to 1), and the specialisation s_d,data (OOM). */
  share: DomainMix;
  effShare: DomainMix;
  sD: DomainMix;
  /** Token-weighted mean quality of the drawn tokens, and tokens drawn per kind (D4's readouts). */
  quality: number;
  byKind: Partial<Record<DataKind, number>>;
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
 *  U_i,d = q_i·T_i·mix_i,d (P10: synthetic ×3). The target sets each domain's share of the base's tokens:
 *  m_d ∝ B_d·tilt_d·K_d/U_d, where B_d is the starting share (reference: REF_SHARE_d; natural: U_d) and K_d/U_d the
 *  kind weights' pull on that domain (K_d = Σ_i U_i,d·k_kind(i)); within a domain the tokens come from its slices in
 *  proportion to U_i,d·k_kind(i). A domain the portfolio holds nothing of draws nothing (its share goes to the others
 *  in proportion). A slice drawn beyond its U_i,d repeats its own tokens and pays Muennighoff on that slice alone,
 *  D_eff = Σ U_i,d·(1 + R*·(1 − e^(−(ep_i,d − 1)/R*))): a short domain repeats and loses value — there is no fallback
 *  to other data. The natural mix (no tilt, no kind weight) gives every slice the same epochs, so D_eff = Muennighoff
 *  on the whole U (D1's rule exactly). Quality enters only through U (D1). Specialisation reads the effective shares
 *  (repeated tokens teach less). `noRepeat` (P10) counts repeated tokens in full. */
export function drawData(p: DataPortfolio, tokens: number, target: MixTarget = NATURAL_MIX, opts: { p10?: boolean; noRepeat?: boolean } = {}): DataDraw {
  const slices: { kind: DataKind; d: DomainId; u: number; k: number; q: number; w: number }[] = [];
  const Ud: DomainMix = {};
  const Kd: DomainMix = {};
  for (const a of p.assets) {
    if (!isPretrain(a)) continue;
    const q = assetQuality(a);
    const u = q * assetTokensT(a) * 1e12 * (a.kind === 'synthetic' && opts.p10 ? P10_SYN_MULT : 1);
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
      slices.push({ kind: a.kind, d, u: ud, k, q, w: 0 });
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
    if (x.w > 0) maxE = Math.max(maxE, x.w / x.u);
  }
  if (!(W > 0) || !(tokens > 0)) return { tokens, dEff: 0, uMix: 0, epochs: tokens > 0 ? Infinity : 0, share: {}, effShare: {}, sD: {}, quality: 0, byKind: {} };
  const share: DomainMix = {};
  const eff: DomainMix = {};
  const byKind: Partial<Record<DataKind, number>> = {};
  let dEff = 0;
  let qSum = 0;
  let repeats = false;
  for (const x of slices) {
    if (!(x.w > 0)) continue;
    const dx = (tokens * x.w) / W;
    const ex = opts.noRepeat || dx <= x.u ? dx : effectiveTokens(dx, x.u);
    if (dx > x.u) repeats = true;
    share[x.d] = (share[x.d] ?? 0) + dx / tokens;
    eff[x.d] = (eff[x.d] ?? 0) + ex;
    byKind[x.kind] = (byKind[x.kind] ?? 0) + dx;
    dEff += ex;
    qSum += dx * x.q;
  }
  if (opts.noRepeat || !repeats) dEff = tokens;
  for (const d of Object.keys(eff) as DomainId[]) eff[d] = (eff[d] ?? 0) / Math.max(1e-30, dEff);
  const uMix = W / maxE;
  return { tokens, dEff, uMix, epochs: tokens / uMix, share, effShare: eff, sD: specialisation(eff), quality: qSum / tokens, byKind };
}

/** The player's draw for a base design (its data option as the mix target; P10: synthetic ×3, no repetition penalty). */
export function playerDraw(s: GameStateV2, d: BaseDesign): DataDraw {
  const t = BASE_DATA[d.data] ?? BASE_DATA.balanced;
  const on = p10(s);
  return drawData(s.player.dataPortfolio, d.params * d.tpp, t, { p10: on, noRepeat: on });
}

/** Public-web tokens the lab trains on without a licence (copyright litigation, actors/china.ts; the D3 deal). */
export function unlicensedPublicT(p: DataPortfolio): number {
  const u = publicUse(p);
  return u && !u.licensed ? assetTokensT(u) : 0;
}
/** Human-written corpora, quality-weighted (T): the public crawl and the licensed corpora (v2's licensed + unlicensed). */
const humanWeightedT = (p: DataPortfolio) => p.assets.filter((a) => a.kind === 'public' || a.kind === 'licensed').reduce((a, x) => a + assetQuality(x) * assetTokensT(x), 0);

/** Action D3 ("License data"): licenses the crawl and adds a licensed corpus of LICENCE_DEAL_SHARE × the lab's human
 *  tokens (v2's × (1 + 0.5·deals) on licensed + unlicensed, as an asset). */
export function licenseCorpus(p: DataPortfolio, day: number) {
  const add = LICENCE_DEAL_SHARE * humanWeightedT(p);
  const u = publicUse(p);
  if (u) u.licensed = true;
  p.assets.push({ id: `lic:corpus:${day}`, kind: 'licensed', tokensT: add / LICENSED_QUALITY, mix: { ...LICENSED_MIX }, quality: LICENSED_QUALITY, day });
}

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

/** Synthetic-data quality from the teacher's G: SYN_Q.atV0 at G_V0, + SYN_Q.perOom per OOM, clamped (data/v2/dataAssets). */
export const syntheticQuality = (gTeacher: number, gRef: number) => Math.min(SYN_Q.max, Math.max(SYN_Q.min, SYN_Q.atV0 + SYN_Q.perOom * (gTeacher - gRef)));
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
  const spare = s.player.policies.spareTraining === 'data' ? idleTrainingShare(s) * s.player.split.training : 0;
  const cSyn = s.player.computeOnline * (s.player.split.synthetic + spare);
  if (cSyn <= 0) return;
  const t = synTeacher(s);
  const tokensT = (cSyn * synTokensPerH100eDay(fptOf(t))) / 1e12;
  const id = `syn:${t?.id ?? 'start'}`;
  const p = s.player.dataPortfolio;
  let a = p.assets.find((x): x is OwnedDataAsset => x.id === id && x.kind === 'synthetic');
  if (!a) {
    const g = t?.build ? gOfBuild(t.build) : gV0(s.hidden.timeline);
    a = { id, kind: 'synthetic', tokensT: 0, mix: { ...SYN_MIX }, quality: syntheticQuality(g, gV0(s.hidden.timeline)), day: s.time.day, teacherId: t?.id, teacherG: g, inheritsTraits: true };
    p.assets.push(a);
  }
  addTo(a, tokensT, SYN_MIX);
}

// ───────────────────────────── usage data ─────────────────────────────

/** Output tokens a product serves per H100e-day at `fpt` FLOP per token, on the assisted token profile (the serving
 *  model's cost chain, worldfx/serving.ts h100eHoursPer). */
export function outputTokensPerH100eDay(fpt: number): number {
  const tok = TOKENS.assisted;
  const h100eHoursPerHour = (Math.max(1, fpt) * (tok.input / U_PREFILL + tok.output / U_DECODE)) / PEAK_FLOPS / 3600;
  return (24 * tok.output) / h100eHoursPerHour;
}
/** Usage tokens (T/day) a deployment adds: its served output tokens × the channel's eligibility × the policy share. */
export function usageTokensPerDay(s: GameStateV2, d: Deployment): number {
  if (d.kind !== 'product' || d.status === 'withdrawn' || !(d.servedH100e! > 0)) return 0;
  const elig = USAGE_ELIGIBLE[d.channel] ?? 0;
  if (elig <= 0) return 0;
  return ((d.servedH100e ?? 0) * outputTokensPerH100eDay(fptOf(versionById(s, d.versionId))) * elig * s.player.dataPortfolio.usageShare) / 1e12;
}
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

/** Tokens required for a base of `flop` FLOP: N_req(C) = 20·sqrt(C/120) (research/13 §1.7). Overtrained ×5. */
export function tokensRequired(flop: number, overtrained = false): number {
  return 20 * Math.sqrt(flop / 120) * (overtrained ? 5 : 1);
}
/** Epochs of the unique stock that cost almost nothing (Muennighoff et al. 2023: ≈ 4, research/20 A3). */
export const FREE_EPOCHS = 4;
/** Data the next base can use at almost no repetition cost (tokens): FREE_EPOCHS × U. */
export const freeStock = (s: GameStateV2) => FREE_EPOCHS * uniqueTokens(s);
/** The lab's next frontier base for the readouts (model v3 V3: physical, not the calendar's F(t)): its latest base × 3,
 *  one generation of compute growth [D]. */
export const nextBaseFlop = (s: GameStateV2) => 3 * latestBaseFlop(s);
/** min(1, free stock / N_req(next base)): adequacy of the player's data for its next frontier base (readout). */
export function dataStockRatio(s: GameStateV2): number {
  return Math.min(1, freeStock(s) / tokensRequired(nextBaseFlop(s)));
}
