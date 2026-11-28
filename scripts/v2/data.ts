// Model v3 D1 data portfolio (design/MODEL-V3.md §9; research/20 A3; src/engine/v2/production/data.ts). Owner: WS1.
// Cost: ~40 sim days (two 20-day runs), one newGame per start type cloned, day-400 fixture reads; tier quick.
//   The start portfolio sums to v1's U (310T); repetition is unchanged at equal U; quality moves G through U (higher q,
//   less repetition, higher G); the public web is one finite stock shared by every lab; synthetic tokens grow with the
//   synthetic compute (v1's yield at V0) and their quality with the teacher's G; usage tokens come only from live
//   products on eligible channels.
// Model v3 D3 (the draw): a base draws its tokens from the portfolio by its data mix; the balanced draw reproduces the
//   start, the natural mix reproduces D1's U and repetition, specialisation s_d,data follows the drawn shares (capped), a
//   short domain repeats and loses value.
// Model v3 D11 (quality of the drawn tokens): D_eff = Σ q·Muennighoff(D_slice, T_slice) ÷ Q_REF in the loss law; the
//   reference draw reproduces G exactly, premium data raises G by a small sourced amount, a low-quality synthetic-heavy
//   draw lowers it, quality is counted once (it scales tokens, not epochs), and the teacher comparison is reported.
// Model v3 D9: P10 raises the synthetic-quality ceiling (U does not jump), P21 multiplies the drawn tokens' worth in the
//   loss law, both by the adopted result's x; the D2 teacher finding is re-checked under the final rules.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALPHA_DATA, LICENCE_DELIVERY_DAYS, LICENCE_TIERS, P10_SYN_Q_RAISE, P21_WORTH_OOM, PUBLIC_WEB, SPEC_CAP, SYN_Q, USAGE_LEVELS, WEB_LICENCE,
} from '../../src/data/v2/dataAssets';
import { TREE_BY_ID } from '../../src/data/v2/tree';
import { candidateTruth, completeAdoption, freshCap } from '../../src/engine/v2/models/research';
import { versionById } from '../../src/engine/v2/models/labs';
import { chatFreeTier } from '../../src/engine/v2/worldfx/serving';
import { flopPerToken } from '../../src/engine/v2/departments/workfit';
import { REFERENCE_BASE, REFERENCE_POST } from '../../src/data/v2/runDesign';
import { EXPERT_PRICE_B_PER_T, SUITE_BUILD } from '../../src/data/v2/suites';
import { actionView } from '../../src/engine/v2';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { act, makeCtx } from '../../src/engine/v2/core/loop';
import { deserialize, serialize } from '../../src/engine/v2/core/save';
import { gOfBuild, gV0 } from '../../src/engine/v2/models/capability';
import { effectiveTokens, fDataEff } from '../../src/engine/v2/models/effective';
import { launchRun, planRun, runsSystem } from '../../src/engine/v2/models/runs';
import { suiteWorkCost } from '../../src/engine/v2/models/suites';
import { DATA_ACTIONS } from '../../src/engine/v2/production/dataActions';
import {
  NATURAL_MIX, Q_REF, REF_SHARE, addAsset, assetQuality, assetTokensT, licenceAsset, playerDraw, deliverData, drawData, portfolioByKind, portfolioU, publicUse, synTeacher,
  syntheticAccrual, syntheticQuality, synAssetFor, synQualityCap, synTokensPerH100eDay, tokenWorth, uniqueTokens, unlicensedPublicT, usageAccrual, usageTokensPerDay,
} from '../../src/engine/v2/production/data';
import { teacherRows } from '../../src/engine/v2/production/dataView';
import type { BaseDesign, Candidate, DataPortfolio, DomainId, GameStateV2, OwnedDataAsset } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish, runTo } from './lib';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const T = 1e12;
// One newGame per start type, cloned per case (TESTING.md section 2).
const protos: Record<string, GameStateV2> = {};
const game = (start: 'leader' | 'challenger' | 'bigtech' | 'spinout' = 'leader'): GameStateV2 => structuredClone(protos[start] ??= newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, start, tutorial: false })));
/** v1's stock: (licensed + unlicensed) × (1 + 0.5·deals) + 0.5 × synthetic. */
const oldU = (a: { licensedTokensT: number; unlicensedTokensT: number; syntheticTokensT: number }, deals: number) =>
  ((a.licensedTokensT + a.unlicensedTokensT) * (1 + 0.5 * deals) + 0.5 * a.syntheticTokensT) * T;
const owned = (s: GameStateV2, id: string) => s.player.dataPortfolio.assets.find((a): a is OwnedDataAsset => a.id === id);
/** The quality checks' base: 1T active × 50 tokens per parameter (50T, V1's B0), a base well within the 310T stock that
 *  repeats no domain slice. Since A6b the reference base draws 141T (400 tokens per parameter), where the small premium
 *  and synthetic slices repeat, which these checks are not about. */
const DRAW_BASE: BaseDesign = { ...REFERENCE_BASE, params: 1e12, tpp: 50, curation: { ...REFERENCE_BASE.curation } };
const basePlan = (s: GameStateV2, params: number) => planRun(s, { kind: 'base', base: { ...DRAW_BASE, params, curation: { ...DRAW_BASE.curation } }, poolShare: 0.6 });

// ---------- start: same stock as v1 ----------
const s0 = game();
const rows = portfolioByKind(s0.player.dataPortfolio);
check(rows.length === 5 && rows.every((r) => r.assets >= 1), 'start: the portfolio holds the five kinds (public, licensed, usage, synthetic, expert)', rows.map((r) => `${r.kind} ${r.tokensT}T q${r.quality}`).join(', '));
check(near(uniqueTokens(s0), oldU({ licensedTokensT: 30, unlicensedTokensT: 270, syntheticTokensT: 20 }, 0), 1e3), 'start: U = 270T crawl + 30T licensed + 0.5 × 20T synthetic = v1\'s 310T', `${(uniqueTokens(s0) / T).toFixed(3)}T`);
check(near(s0.player.models.bases[0].epochs!, (REFERENCE_BASE.params * REFERENCE_BASE.tpp) / 310e12, 1e-12), 'start: B0\'s epochs read the portfolio (141T over 310T)', s0.player.models.bases[0].epochs!.toFixed(4));
let sameStart = true;
for (const st of ['challenger', 'bigtech', 'spinout'] as const) if (uniqueTokens(game(st)) !== uniqueTokens(s0)) sameStart = false;
check(sameStart, 'start: every start type keeps the same data as before (U 310T)');

// ---------- repetition at equal U ----------
const big = 8e12; // 8T active × 50 = 400T tokens > 310T
const pBig = basePlan(s0, big);
const L = pBig.limits!;
// D11: each slice repeats on its own tokens. At the start the q 1 slices (crawl + licensed, 300T) get 300/310 of the
// tokens at D/310T epochs, the q 0.5 synthetic (20T, drawn ∝ q·T = 10/310) half those epochs.
const startDEff = (D: number) => (effectiveTokens((D * 300) / 310, 300e12) + 0.5 * effectiveTokens((D * 10) / 310, 20e12)) / Q_REF;
// CP3 rewrite (RD-T08): the quality filter changed the slices (U 310T → ≈ 235T), so the hand-built 300/310 split is gone;
// the invariant stays: beyond U the draw repeats (D_rep < D) and f_data × f_quality = Besiroglu(D_eff).
check(L.epochs > 1 && near(L.epochs, L.tokens / L.draw.uMix, 1e-9) && L.fData < 1 && L.draw.dRep < L.tokens
  && near(L.fData * L.fQual, fDataEff(big, L.tokens, L.draw.dEff), 1e-9),
  'repetition: a base beyond U repeats its slices (D_rep < D, epochs = D ÷ the mix\'s U); f_data × f_quality = Besiroglu(D_eff)',
  `${L.epochs.toFixed(2)} epochs, f_data ${L.fData.toFixed(4)}, f_quality ${L.fQual.toFixed(4)}`);
// The same U from a different portfolio (less crawl, more licensed) gives the same effective tokens on the natural mix.
const sEq = game();
publicUse(sEq.player.dataPortfolio)!.coverage = 0.8; // −30T crawl
owned(sEq, 'lic:start')!.tokensT += 30;
const dEq = drawData(sEq.player.dataPortfolio, L.tokens, NATURAL_MIX);
const d0 = drawData(s0.player.dataPortfolio, L.tokens, NATURAL_MIX);
check(near(uniqueTokens(sEq), uniqueTokens(s0), 1e3) && near(dEq.dEff, d0.dEff, 1e3) && near(dEq.dEff / startDEff(L.tokens), 1, 1e-9), 'repetition: equal U from a different portfolio (same tokens per quality) gives the same effective tokens on the natural mix', `${(dEq.dEff / T).toFixed(3)}T vs ${(d0.dEff / T).toFixed(3)}T`);

// ---------- quality (model v3 D11: the drawn tokens' quality in the loss law) ----------
const withQ = (q: number) => {
  const s = game();
  owned(s, 'lic:start')!.quality = q;
  return s;
};
const N0 = DRAW_BASE.params;
const D0 = DRAW_BASE.params * DRAW_BASE.tpp;
const refL = basePlan(s0, N0).limits!;
// CP3 rewrite (RD-T08): Q_REF is the reference draw's mean quality (≈ 1.2 with the quality filter on, not 305/310).
check(Q_REF > 1 && refL.fQual === 1 && refL.gPre.quality === 0 && refL.fData === 1 && near(refL.draw.dEff, D0, 1e-9 * D0) && near(refL.draw.qRel, 1, 1e-12),
  'quality: the reference draw defines q = 1 (Q_REF = its mean drawn quality, above 1 with the quality filter, RD-T08): D_eff = D, no quality term, G as before', `Q_REF ${Q_REF.toFixed(4)}, quality ${refL.gPre.quality} OOM`);
// A premium licence in a drawn domain: the default deal (0.05T of REASON books at q 3, $1.5B) and a 1T one ($30B).
const premG: string[] = [];
let premOk = true;
for (const t of [LICENCE_TIERS.premium.defaultT, 1]) {
  const s = game();
  addAsset(s.player.dataPortfolio, licenceAsset('REASON', 'premium', t, 0));
  const l = basePlan(s, N0).limits!;
  // CP3 rewrite (RD-T08): the drawn quality is the engine's qRel (the hand sum ignored the quality filter).
  const want = Math.log10(fDataEff(N0, D0, D0 * l.draw.qRel));
  const dG = l.gPre.total - refL.gPre.total;
  if (!(dG > 0) || !near(l.gPre.quality, want, 1e-9) || !near(dG, want, 1e-9) || l.fData !== 1) premOk = false;
  premG.push(`${t}T → +${dG.toFixed(5)} OOM (mean q ×${l.draw.qRel.toFixed(4)})`);
}
check(premOk, 'quality: a premium licence in a drawn domain raises G of a base that does not repeat by the Besiroglu value of the drawn quality (small at deal sizes)', premG.join(', '));
// The sourced size: tokens 3× better (research/20 A3 curated q 1.5–3; Gundlach's ×3 data selection) are worth ≈ ×2.5
// compute at 20 tokens/parameter, less when overtrained (Besiroglu: the data term is about half the reducible loss).
const f3 = fDataEff(N0, 20 * N0, 60 * N0);
const f3b = fDataEff(N0, 50 * N0, 150 * N0);
const fHalf = fDataEff(N0, 50 * N0, 25 * N0);
check(f3 > 2.3 && f3 < 2.8 && f3b > 1.9 && f3b < f3 && fHalf > 0.45 && fHalf < 0.65,
  'quality: 3× better tokens ≈ ×2.5 effective compute at 20 tokens/param, less overtrained; half-quality tokens ≈ ×0.55 at 50 (Besiroglu law)', `×${f3.toFixed(2)} at 20, ×${f3b.toFixed(2)} at 50, ×${fHalf.toFixed(2)} for q 0.5`);
// Licensed start data at q 0.2 / 1 / 3 on a base that does not repeat: G follows the drawn quality.
const qs = [0.2, 1, 3];
const gQ = qs.map((q) => basePlan(withQ(q), N0).limits!);
check(gQ[0].gPre.total < gQ[1].gPre.total && gQ[2].gPre.total > gQ[1].gPre.total && gQ[1].gPre.total === refL.gPre.total
  && gQ.every((x) => near(x.gPre.quality, Math.log10(fDataEff(N0, D0, D0 * x.draw.qRel)), 1e-9)) && gQ[0].draw.qRel < gQ[1].draw.qRel && gQ[2].draw.qRel > gQ[1].draw.qRel,
  'quality: a base within U now gains from better drawn tokens and loses from worse (replaces D1\'s "quality only through U")', `licensed q 0.2 / 1 / 3: G ${gQ.map((x) => x.gPre.total.toFixed(4)).join(' / ')}`);
// No double counting: quality scales the tokens, not the epochs. Doubling every asset's quality at the same tokens doubles
// D_eff exactly and leaves the epochs and the repetition alone, below and beyond the stock (D1/D3's rule would have
// doubled U and halved the epochs, counting quality a second time for a base that repeats).
const toy = (q: number): DataPortfolio => ({ assets: [
  { id: 'lic:a', kind: 'licensed', tokensT: 100, mix: { SOCIAL: 0.6, CODE: 0.4 }, quality: q },
  { id: 'syn:b', kind: 'synthetic', tokensT: 50, mix: { CODE: 0.5, REASON: 0.5 }, quality: 0.5 * q },
], usageShare: 0, pending: [] });
let dcOk = true;
const dcRows: string[] = [];
for (const D of [60e12, 900e12]) {
  const a = drawData(toy(1), D, NATURAL_MIX);
  const b = drawData(toy(2), D, NATURAL_MIX);
  // natural mix: the q 1 asset gets D·100/125 from its 100T, the q 0.5 one D·25/125 from its 50T (half the epochs)
  const want = (effectiveTokens((D * 100) / 125, 100e12) + 0.5 * effectiveTokens((D * 25) / 125, 50e12)) / Q_REF;
  if (!near(b.dEff / a.dEff, 2, 1e-9) || !near(b.epochs, a.epochs, 1e-12) || !near(b.dRep / a.dRep, 1, 1e-12) || !near(a.dEff / want, 1, 1e-9)) dcOk = false;
  dcRows.push(`D ${(D / T).toFixed(0)}T: epochs ${a.epochs.toFixed(2)} → ${b.epochs.toFixed(2)}, D_eff ${(a.dEff / T).toFixed(1)} → ${(b.dEff / T).toFixed(1)}T`);
}
check(dcOk, 'quality: counted once — ×2 quality at the same tokens doubles D_eff, epochs and repetition unchanged (D_eff = Σ q·Muennighoff(D, T))', dcRows.join('; '));
// A q 3 corpus repeats after its own tokens, not after 3× them: one 10T premium slice drawn 60T deep (6 epochs).
const one: DataPortfolio = { assets: [{ id: 'lic:p', kind: 'licensed', tokensT: 10, mix: { REASON: 1 }, quality: 3 }], usageShare: 0, pending: [] };
const oneD = drawData(one, 60e12, NATURAL_MIX);
check(near(oneD.epochs, 6, 1e-9) && near(oneD.dEff, (3 * effectiveTokens(60e12, 10e12)) / Q_REF, 1e3) && near(oneD.dRep, effectiveTokens(60e12, 10e12), 1e3),
  'quality: a q 3 corpus of 10T drawn 60T deep is 6 epochs of its own tokens, worth 3 × Muennighoff(60T, 10T), not 3 × Muennighoff(60T, 30T)',
  `${oneD.epochs.toFixed(1)} epochs, D_eff ${(oneD.dEff / T).toFixed(1)}T vs ${((3 * effectiveTokens(60e12, 30e12)) / Q_REF / T).toFixed(1)}T if counted twice`);

// ---------- the public web: finite and shared ----------
const sA = game();
const sB = game('challenger');
const pubA = publicUse(sA.player.dataPortfolio)!;
pubA.coverage = 5; // a lab cannot crawl more than the world has
check(assetTokensT(pubA) === PUBLIC_WEB.stockT && assetTokensT(publicUse(sB.player.dataPortfolio)!) === 0.9 * PUBLIC_WEB.stockT,
  'public web: one finite world stock (300T, Villalobos et al. 2024) that every lab reads; no crawl exceeds it', `${assetTokensT(pubA)}T cap, other lab ${assetTokensT(publicUse(sB.player.dataPortfolio)!)}T`);
check(!('tokensT' in pubA) && !('quality' in pubA), 'public web: labs hold a crawl share, not tokens (mix and quality are the world\'s)');
// ---------- data actions (model v3 D2) ----------
const deliverAt = (s: GameStateV2, day: number) => {
  const d0 = s.time.day;
  s.time.day = day;
  deliverData(s);
  s.time.day = d0;
};
const sW = game();
sW.player.finance.cash = 100;
const pubBefore = assetTokensT(publicUse(sW.player.dataPortfolio)!);
const uW = uniqueTokens(sW);
const errW = act(sW, 'data.license', { domain: 'web' });
check(!errW && unlicensedPublicT(sW.player.dataPortfolio) === 0 && unlicensedPublicT(s0.player.dataPortfolio) === 270 && assetTokensT(publicUse(sW.player.dataPortfolio)!) === pubBefore && uniqueTokens(sW) === uW
  && near(sW.player.finance.cash, 100 - (WEB_LICENCE.baseB + WEB_LICENCE.perTB * 270), 1e-9) && act(sW, 'data.license', { domain: 'web' }) === 'The crawl is already licensed',
  'license web: licenses the crawl (no unlicensed tokens: the suit hazard reads 0) for $1B + $0.005B/T, adds no tokens, once', errW ?? `cash ${sW.player.finance.cash.toFixed(2)}`);
// Licensing by domain: tokens in the domain at the tier's quality, cash at signing, delivered after 60 days.
const sLic = game();
sLic.player.finance.cash = 100;
const uL0 = uniqueTokens(sLic);
const pv0 = actionView(sLic, 'data.license', { domain: 'PHYS', tier: 'curated', tokensT: 1 });
const errL = act(sLic, 'data.license', { domain: 'PHYS', tier: 'curated', tokensT: 1 });
const pend = sLic.player.dataPortfolio.pending;
check(!errL && near(sLic.player.finance.cash, 100 - 1 * LICENCE_TIERS.curated.priceBPerT, 1e-9) && pend.length === 1 && pend[0].due === LICENCE_DELIVERY_DAYS && uniqueTokens(sLic) === uL0 && unlicensedPublicT(sLic.player.dataPortfolio) === 270,
  'license by domain: cash at signing ($2B for 1T curated), delivered later (pending), the crawl stays unlicensed (suits as before)', errL ?? JSON.stringify(pend));
deliverAt(sLic, LICENCE_DELIVERY_DAYS - 1);
const early = owned(sLic, 'lic:PHYS:curated');
deliverAt(sLic, LICENCE_DELIVERY_DAYS);
const lic = owned(sLic, 'lic:PHYS:curated');
const natPhys = (s: GameStateV2) => drawData(s.player.dataPortfolio, 50e12, NATURAL_MIX);
check(!early && !!lic && lic.tokensT === 1 && lic.quality === LICENCE_TIERS.curated.quality && lic.mix.PHYS === 1 && lic.domain === 'PHYS' && sLic.player.dataPortfolio.pending.length === 0
  && near(uniqueTokens(sLic) - uL0, 2 * T, 1e3) && (natPhys(sLic).share.PHYS ?? 0) > (natPhys(s0).share.PHYS ?? 0) && (natPhys(sLic).sD.PHYS ?? 0) > 0.05,
  'license by domain: on delivery the domain gains its tokens at the tier quality (1T PHYS q 2 → U +2T); PHYS\'s share and specialisation rise on the natural mix',
  `U ${(uL0 / T).toFixed(1)} → ${(uniqueTokens(sLic) / T).toFixed(1)}T, PHYS share ${((natPhys(s0).share.PHYS ?? 0) * 100).toFixed(2)}% → ${((natPhys(sLic).share.PHYS ?? 0) * 100).toFixed(2)}%, s ${(natPhys(sLic).sD.PHYS ?? 0).toFixed(3)} OOM`);
const g0Txt = pv0.gains.map((g) => g.target).join(' ');
check(/unique tokens 310 → 312T/.test(g0Txt) && /physical 4\.\d% → 5\.\d% of the stock/.test(g0Txt) && /re-reads its data/.test(g0Txt) && /data quality ×1\.000 → ×1\.00[1-9]/.test(g0Txt) && pv0.costs[0]?.currency === 'cash',
  'license preview: before → after of the Blueprint data readouts (U, the domain\'s share and specialisation, base epochs, the quality term in G)', g0Txt);
act(sLic, 'data.license', { domain: 'PHYS', tier: 'curated', tokensT: 1 });
deliverAt(sLic, 2 * LICENCE_DELIVERY_DAYS);
check(owned(sLic, 'lic:PHYS:curated')?.tokensT === 2 && sLic.player.dataPortfolio.assets.filter((a) => a.id === 'lic:PHYS:curated').length === 1, 'license: a second deal of the same domain and tier joins the same asset');
const prem = actionView(sLic, 'data.license', { domain: 'REASON', tier: 'premium' });
check(near(-prem.costs[0].amount, LICENCE_TIERS.premium.defaultT * LICENCE_TIERS.premium.priceBPerT, 0.01) && LICENCE_TIERS.bulk.quality === 1.5 && LICENCE_TIERS.premium.quality === 3,
  'license tiers: quality 1.5 / 2 / 3 (research/20 A3 curated range); premium books at $30B/T (Bartz ≈ $3,000 a book)', prem.costs[0].target);

// Synthetic generation: a chosen teacher and a share of the pool; quality from its G; the asset carries the teacher.
const sSy = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
sSy.player.split.synthetic = Math.max(0.05, sSy.player.split.synthetic);
const withG = sSy.player.models.versions.filter((v) => v.build).map((v) => ({ v, g: gOfBuild(v.build!) })).sort((a, b) => a.g - b.g);
const weak = withG[0];
const strong = withG[withG.length - 1];
const synOf = (s: GameStateV2, id: string) => owned(s, `syn:${id}`);
const jobRun = (teacher: string, share: number) => {
  const s = deserialize(serialize(sSy));
  const before = Object.fromEntries(s.player.dataPortfolio.assets.filter((a) => a.kind === 'synthetic').map((a) => [a.id, assetTokensT(a)]));
  const e = act(s, 'data.synthesize', { teacher, share, days: 30 });
  syntheticAccrual(s);
  const grew = (id: string) => assetTokensT(owned(s, id) ?? { kind: 'licensed', tokensT: 0 } as OwnedDataAsset) - (before[id] ?? 0);
  return { s, e, grew };
};
const jS = jobRun(strong.v.id, 1);
const jW = jobRun(weak.v.id, 1);
const aS = synOf(jS.s, strong.v.id);
const aW = synOf(jW.s, weak.v.id);
check(!jS.e && !jW.e && strong.g > weak.g + 0.5 && !!aS && !!aW && aS.quality > aW.quality && aS.teacherId === strong.v.id && aS.inheritsTraits === true && near(aS.quality, syntheticQuality(strong.g, gV0(sSy.hidden.timeline)), 1e-12)
  && jS.grew(`syn:${strong.v.id}`) > 0 && jS.s.player.dataPortfolio.synJob?.until === sSy.time.day + 30,
  'synthesize: a stronger teacher gives higher-quality data; the asset carries the teacher (inherits its traits)', `${weak.v.id} G ${weak.g.toFixed(2)} q ${aW?.quality.toFixed(3)} vs ${strong.v.id} G ${strong.g.toFixed(2)} q ${aS?.quality.toFixed(3)}`);
const fptS = strong.v.fpt ?? 1;
const fptW = weak.v.fpt ?? 1;
check(near(jS.grew(`syn:${strong.v.id}`) / jW.grew(`syn:${weak.v.id}`), fptW / fptS, 1e-6 * (fptW / fptS)), 'synthesize: tokens = synTokensPerH100eDay × compute (a teacher with more FLOP per token yields fewer)',
  `${(jS.grew(`syn:${strong.v.id}`) * 1000).toFixed(2)}B vs ${(jW.grew(`syn:${weak.v.id}`) * 1000).toFixed(2)}B tokens/day`);
// Half the pool: the other half keeps the default teacher (the internal research model); the job ends on its day.
const dflt = synTeacher(sSy)!;
const half = jobRun(strong.v.id === dflt.id ? weak.v.id : strong.v.id, 0.5);
const other = strong.v.id === dflt.id ? weak : strong;
const full = deserialize(serialize(sSy));
const fullBefore = assetTokensT(owned(full, `syn:${dflt.id}`) ?? { kind: 'licensed', tokensT: 0 } as OwnedDataAsset);
syntheticAccrual(full);
const fullGrew = assetTokensT(owned(full, `syn:${dflt.id}`)!) - fullBefore;
check(near(half.grew(`syn:${dflt.id}`), 0.5 * fullGrew, 1e-9 * fullGrew) && half.grew(`syn:${other.v.id}`) > 0, 'synthesize: with half the pool on the job the default teacher (internal research model) keeps the other half',
  `default ${dflt.id} ${(half.grew(`syn:${dflt.id}`) * 1000).toFixed(2)}B vs ${(fullGrew * 1000).toFixed(2)}B tokens/day without a job`);
half.s.time.day += 30;
syntheticAccrual(half.s);
check(!half.s.player.dataPortfolio.synJob && act(half.s, 'data.synthesize', { days: 0 }) === 'No generation job running', 'synthesize: the job ends on its last day (the whole pool goes back to the default teacher)');
// D11: D2 found that a stronger teacher yields fewer quality-weighted tokens (q·T) per H100e-day. With quality in the
// loss law the teacher's q also sets what each drawn token is worth. 30 days of the whole pool per teacher, then the
// lab's latest base design drawn from the result (day-400 fixture). Reported; the check is only the ranking.
const latest = sSy.player.models.bases[sSy.player.models.bases.length - 1].design!;
const synT = (s: GameStateV2, id: string) => assetTokensT(owned(s, `syn:${id}`) ?? ({ kind: 'licensed', tokensT: 0 } as OwnedDataAsset));
const gAfter = (teacher?: string) => {
  const s = deserialize(serialize(sSy));
  if (teacher) act(s, 'data.synthesize', { teacher, share: 1, days: 30 });
  else s.player.split.synthetic = 0;
  for (let i = 0; i < 30; i++) syntheticAccrual(s);
  const p = planRun(s, { kind: 'base', base: { ...latest, curation: { ...latest.curation } }, poolShare: 0.6 }).limits!;
  const q = teacher ? (owned(s, `syn:${teacher}`)?.quality ?? 0) : 0;
  return { G: p.gPre.total, qRel: playerDraw(s, latest).qRel, q, qT: teacher ? q * (synT(s, teacher) - synT(sSy, teacher)) : 0 };
};
const gNone = gAfter();
const tRows = withG.map((x) => ({ x, r: gAfter(x.v.id) }));
const bestQT = tRows.reduce((a, b) => (b.r.qT > a.r.qT ? b : a));
const bestG = tRows.reduce((a, b) => (b.r.G > a.r.G ? b : a));
const sgn = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(4)}`;
// TEST-BUG fix: the top two teachers (V25, V27) have the same G to 6e-7 and their next-base G differs by 9e-7, so 'the best is exactly the
// strongest' was a coin flip; the strongest must be best to within 1e-4 OOM (a tie).
check(tRows[tRows.length - 1].r.G >= bestG.r.G - 1e-4 && tRows[0].r.G < tRows[tRows.length - 1].r.G && syntheticQuality(strong.g, gV0(sSy.hidden.timeline)) < SYN_Q.max,
  'D11 teacher: with quality in the loss law the strongest teacher\'s data gives the next base the most G below the quality cap (D2 ranked teachers by q·T)',
  `latest base ${((latest.params * latest.tpp) / T).toFixed(0)}T, mean q ×${gNone.qRel.toFixed(3)} with no generation; 30 d of the pool: `
  + tRows.map(({ x, r }) => `${x.v.id} (G ${x.g.toFixed(2)}, q ${r.q.toFixed(2)}) q·T ${r.qT.toFixed(0)}T ΔG ${sgn(r.G - gNone.G)}`).join(', ') + `; best by q·T ${bestQT.x.v.id}`);
// At the cap (the web's q 1, 2 OOM above V0) a stronger teacher's tokens are worth no more per token, so beyond it only
// tokens per H100e-day separate teachers (D2's finding: the distilled mini of a strong model wins again).
const g0f = gV0(sSy.hidden.timeline);
check(syntheticQuality(g0f + 2, g0f) === 1 && syntheticQuality(g0f + 4, g0f) === 1 && syntheticQuality(g0f + 1.5, g0f) < 1,
  'D11 teacher: synthetic quality stops at the web\'s 1 (cap [D]: no source for synthetic tokens beating human text)', `q at V0 + 1 / 2 / 4 OOM: ${[1, 2, 4].map((x) => syntheticQuality(g0f + x, g0f)).join(' / ')}`);

// RD-T06 (DD-07): expert data is bought only by suite builds (no purchase by domain).
check(!DATA_ACTIONS.some((x) => x.id === 'data.expert'), 'expert: no expert-data purchase by domain (suite builds buy it)');
const c2 = suiteWorkCost(game(), 'swe', 'build');
check(c2.tokensT === SUITE_BUILD.tokensT && near(c2.cashB, SUITE_BUILD.tokensT * EXPERT_PRICE_B_PER_T, 1e-12), 'expert: a build pays for the expert data it builds in ($0.1B)');

// ---------- synthetic data ----------
const syn = (share: number) => {
  const s = game();
  s.player.split.synthetic = share;
  const before = portfolioByKind(s.player.dataPortfolio).find((r) => r.kind === 'synthetic')!.tokensT;
  syntheticAccrual(s);
  return { s, added: portfolioByKind(s.player.dataPortfolio).find((r) => r.kind === 'synthetic')!.tokensT - before };
};
const y1 = syn(0.1);
const y2 = syn(0.2);
check(y1.added > 0 && near(y2.added / y1.added, 2, 1e-9) && syn(0).added === 0, 'synthetic: tokens grow in proportion to the synthetic compute (none without it)', `${y1.added.toFixed(3)}T → ${y2.added.toFixed(3)}T per day`);
// A6b: V0 is 354B active (was 1T), so as a teacher it yields ×2.8 the tokens per H100e-day (generation FLOP ∝ its FLOP
// per token); the overgeneration fit stays at v1's rate for a 1T-active teacher.
const fptV0 = y1.s.player.models.versions[0].fpt!;
check(near(synTokensPerH100eDay(2e12) / 1e12, 4e-6, 4e-8) && near(synTokensPerH100eDay(fptV0) / synTokensPerH100eDay(2e12), 2e12 / fptV0, 1e-9),
  'synthetic: a 1T-active teacher yields v1\'s 4e-6 T per H100e-day (overgeneration 4.33, R20 A3 2–5×); V0 (354B active) ∝ 1 ÷ its FLOP per token',
  `V0 ${(synTokensPerH100eDay(fptV0) / 1e6).toFixed(2)}M tokens per H100e-day`);
const fresh = y1.s.player.dataPortfolio.assets.find((a): a is OwnedDataAsset => a.kind === 'synthetic' && a.teacherId !== undefined);
const g0 = gV0(s0.hidden.timeline);
check(!!fresh && fresh.inheritsTraits === true && near(fresh.quality, SYN_Q.atV0, 0.02) && syntheticQuality(g0 + 2, g0) > syntheticQuality(g0, g0) && syntheticQuality(g0 + 99, g0) === SYN_Q.max && SYN_Q.max === 1 && syntheticQuality(g0 + 1, g0) === 0.75,
  'synthetic: the asset keeps its teacher (inherits its traits); quality ≈ 0.5 from V0, rising with the teacher\'s G to the web\'s 1 (cap [D], D11)', `teacher ${fresh?.teacherId} q ${fresh?.quality.toFixed(3)}; +2 OOM q ${syntheticQuality(g0 + 2, g0)}`);

// ---------- usage data ----------
const sU = game();
runTo(sU, 20, { skip: ['endings'] });
const consumer = sU.player.deployments.find((d) => d.channel === 'consumer')!;
const api = sU.player.deployments.find((d) => d.channel === 'api')!;
const usageT = owned(sU, 'usage')!.tokensT;
check(usageT > 0 && usageTokensPerDay(sU, consumer) > 0 && usageTokensPerDay(sU, api) === 0, 'usage: live consumer products add usage tokens; API traffic is not trained on by default',
  `${usageT.toFixed(2)}T in 20 days; consumer ${(usageTokensPerDay(sU, consumer) * 1000).toFixed(1)}B/day on ${consumer.servedH100e?.toFixed(0)} H100e, API 0`);
// A6: Chat's free users run on its free tier, so served compute beyond the paying need counts the free tier's tokens
// (×8 per H100e for an eighth-size mini; RD-P02: ×1/r for the free-tier slot model),
// the paying need's the main model's.
{
  const c = { ...consumer, servedH100e: 1000, needH100e: 1000, needPaidH100e: 400 };
  const flat = usageTokensPerDay(sU, { ...c, needPaidH100e: 1000 });
  const auto = usageTokensPerDay(sU, c);
  const vMain = versionById(sU, consumer.versionId);
  const rAuto = vMain ? (chatFreeTier(sU, consumer)?.fpt ?? 1) / flopPerToken(sU, vMain) : 1; // RD-P02: the Chat free-tier slot's real model
  const V0 = sU.player.models.versions[0];
  const mini = { ...V0, id: 'A6mini', variant: 'mini' as const, fpt: (V0.fpt ?? 2e12) / 8 };
  sU.player.models.versions.push(mini);
  const tiered = usageTokensPerDay(sU, { ...c, lineup: ['A6mini'] });
  const allPaid = usageTokensPerDay(sU, { ...c, lineup: ['A6mini'], needPaidH100e: 1000 });
  sU.player.models.versions.pop();
  check(near(tiered / flat, 0.4 + 0.6 * 8, 1e-3) && near(allPaid, flat, 1e-9) && near(auto / flat, 0.4 + 0.6 / rAuto, 1e-3), 'usage: the free tier (a Chat mini, else the cheapest lineup model, RD-P01a) serves the free users\' tokens at its own FLOP per token (A6)',
    `all paying ${(flat * 1e3).toFixed(2)} → mini ${(tiered * 1e3).toFixed(2)} / auto free tier ${(auto * 1e3).toFixed(2)}B/day on 1000 H100e (400 paying need)`);
}
const startUsage = owned(s0, 'usage')!.tokensT;
for (const d of sU.player.deployments) d.status = 'withdrawn';
const u0 = owned(sU, 'usage')!.tokensT;
usageAccrual(sU);
check(startUsage === 0 && owned(sU, 'usage')!.tokensT === u0, 'usage: none before products serve and none from withdrawn products');
const mixSum = Object.values(owned(sU, 'usage')!.mix).reduce((a, x) => a + (x ?? 0), 0);
check(near(mixSum, 1, 1e-9), 'usage: the asset has a domain mix (consumer chat\'s work weights)', JSON.stringify(owned(sU, 'usage')!.mix));
// Usage-data policy (model v3 D2): the share kept changes the accrual.
const sP = game();
runTo(sP, 20, { skip: ['endings'] });
const cons = sP.player.deployments.find((d) => d.channel === 'consumer')!;
const r0 = usageTokensPerDay(sP, cons);
const eBroad = act(sP, 'data.usagePolicy', { level: 'broad' });
const rB = usageTokensPerDay(sP, cons);
const eNone = act(sP, 'data.usagePolicy', { level: 'none' });
const uN0 = owned(sP, 'usage')!.tokensT;
usageAccrual(sP);
check(!eBroad && !eNone && near(rB / r0, USAGE_LEVELS.broad.share / USAGE_LEVELS.standard.share, 1e-9)
  && usageTokensPerDay(sP, cons) === 0 && owned(sP, 'usage')!.tokensT === uN0 && sP.player.dataPortfolio.usageShare === 0,
  'usage policy: broad keeps 2.5× the usage tokens; none keeps none', `${(r0 * 1000).toFixed(1)} → ${(rB * 1000).toFixed(1)}B/day`);
check(act(sP, 'data.usagePolicy', { level: 'none' }) === 'Already no training on users' && actionView(sP, 'data.usagePolicy', {}).gains.some((g) => /usage data 0\.0 → \d/.test(g.target ?? '')),
  'usage policy: no change to the same level; the preview shows the usage rate before → after', actionView(sP, 'data.usagePolicy', {}).gains.map((g) => g.target).join(' | '));

// ---------- the draw (model v3 D3) ----------
const plan = (s: GameStateV2, data: BaseDesign['data'], params = REFERENCE_BASE.params) =>
  planRun(s, { kind: 'base', base: { ...REFERENCE_BASE, params, data, curation: { ...REFERENCE_BASE.curation } }, poolShare: 0.6 });
const fmtS = (x: Partial<Record<string, number>>) => Object.entries(x).filter(([, v]) => Math.abs(v ?? 0) >= 0.005).map(([d, v]) => `${d} ${(v ?? 0) >= 0 ? '+' : ''}${(v ?? 0).toFixed(2)}`).join(' ');
// Start: the reference recipe's balanced draw is the start portfolio's natural mix, so it reproduces the start numbers.
const refPlan = plan(s0, 'balanced');
const refDraw = refPlan.limits!.draw;
// CP3 rewrite (RD-T08): the reference recipe has the quality filter on, so its U is below the portfolio's (a quarter of
// the raw crawl / usage dropped); still no specialisation and no repetition.
check(Math.max(0, ...Object.values(refPlan.limits!.sD).map((x) => Math.abs(x ?? 0))) < 0.005 && refPlan.limits!.fData === 1 && refDraw.uMix < portfolioU(s0.player.dataPortfolio) && near(refPlan.limits!.epochs, refPlan.limits!.tokens / refDraw.uMix, 1e-12),
  'draw: the reference recipe\'s balanced draw at the start does not specialise or repeat (filtered U below the portfolio\'s; RD-T08)', `s ${fmtS(refPlan.limits!.sD) || 'none'}, U ${(refDraw.uMix / T).toFixed(2)}T, ${refPlan.limits!.epochs.toFixed(4)} epochs`);
check(near(refPlan.limits!.gPre.total, s0.player.models.bases[0].gPre + (refPlan.limits!.gPre.recipe - s0.player.models.bases[0].ePre), 1e-9),
  'draw: the reference base\'s pretraining G differs from B0\'s by its recipe only (no data term)', `${refPlan.limits!.gPre.total.toFixed(4)}`);
// CP3 rewrite (RD-T08 / T09): the hand formula used SYN_MIX (deleted) and no filter; the reference shares are the start
// portfolio's mix, which the reference recipe's (filtered) draw reproduces within 1%.
check(Object.values(REF_SHARE).every((v) => v! > 0) && near(Object.values(REF_SHARE).reduce((a, x) => a + (x ?? 0), 0), 1, 1e-12) && Object.entries(REF_SHARE).every(([d, v]) => Math.abs((refDraw.share[d as DomainId] ?? 0) / v! - 1) < 0.01),
  'draw: the reference shares are the start portfolio\'s mix; the reference recipe\'s draw reproduces them (±1%)', fmtS(REF_SHARE));
// Natural mix: the drawn U is the portfolio's U and the repetition is D1's single-pool Muennighoff.
const sFx = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
let natOk = true;
const natRows: string[] = [];
for (const [name, st] of [['start', s0], ['day 400', sFx]] as const) {
  {
    const U = portfolioU(st.player.dataPortfolio);
    for (const D of [50e12, 3 * U]) {
      const dr = drawData(st.player.dataPortfolio, D, NATURAL_MIX);
      // D11: on the natural mix asset a gets D·u_a/U of the tokens from its own T_a, so
      // D_eff = Σ q_a·Muennighoff(D·q_a·T_a/U, T_a) ÷ Q_REF.
      let want = 0;
      for (const a of st.player.dataPortfolio.assets) {
        if (a.kind === 'expert') continue;
        const t = assetTokensT(a) * 1e12;
        if (t > 0) want += assetQuality(a) * effectiveTokens((D * assetQuality(a) * t) / U, t);
      }
      want /= Q_REF;
      // At the start no specialisation; beyond U (3U) a trace (< 0.005 OOM): the q 0.5 synthetic repeats at half the web's
      // epochs, so its code share teaches a little more than the repeated web's.
      const sMax = Math.max(0, ...Object.values(dr.sD).map((x) => Math.abs(x ?? 0)));
      if (!near(dr.uMix / U, 1, 1e-9) || !near(dr.dEff / want, 1, 1e-9) || (name === 'start' && sMax > (D > U ? 0.005 : 0))) natOk = false;
      if (!natOk && !natRows.some((r) => r.startsWith('BAD'))) natRows.push(`BAD ${name} D ${(D / T).toFixed(0)}T: uMix ${(dr.uMix / T).toFixed(3)} dEff ${(dr.dEff / T).toFixed(3)} vs ${(want / T).toFixed(3)} s ${fmtS(dr.sD)}`);
    }
    natRows.push(`${name} U ${(U / T).toFixed(0)}T`);
  }
}
check(natOk, 'draw: the drawn U equals uniqueTokens when the mix is natural (the web, q 1, is the best data); D_eff = Σ q·Muennighoff on each asset\'s own tokens', natRows.join(', '));
// Specialisation follows the mix: code & math raises CODE and RSCH and lowers SOCIAL, in the base and in its predicted domains.
const sO = game(); // options unlocked
const unlock = (id: string) => { sO.player.tree[id] = { ...(sO.player.tree[id] ?? {}), status: 'known' } as never; };
unlock('codeMath');
const cmPlan = plan(sO, 'codeMath');
const cm = cmPlan.limits!.sD;
const dG = (p: ReturnType<typeof plan>, d: DomainId) => (p.g.gD?.[d] ?? 0) - (refPlan.g.gD?.[d] ?? 0);
const cmQ = cmPlan.limits!.gPre.quality;
check(!cmPlan.reason && (cm.CODE ?? 0) > 0.3 && (cm.RSCH ?? 0) > 0.1 && (cm.SOCIAL ?? 0) < -0.1 && dG(cmPlan, 'CODE') > 0.3 && dG(cmPlan, 'SOCIAL') < -0.1 && cmQ < 0 && cmQ > -0.01 && near(cmPlan.g.G - refPlan.g.G, cmQ + cmPlan.limits!.gPre.data, 1e-9),
  'draw: specialisation follows the drawn mix — code & math raises CODE/RSCH, lowers SOCIAL (general G moves only by the drawn data: quality and, at the filtered U, repetition; RD-T08)',
  `${cmPlan.reason ?? ''} s ${fmtS(cm)}; domain G vs balanced CODE ${dG(cmPlan, 'CODE').toFixed(2)}, SOCIAL ${dG(cmPlan, 'SOCIAL').toFixed(2)}; quality ${cmQ.toFixed(4)} OOM`);
const shareCode = cmPlan.limits!.draw.share.CODE ?? 0;
const effCode = cmPlan.limits!.draw.effShare.CODE ?? 0; // CP3 rewrite: s_d reads the effective (after-repetition) share
check(near(cm.CODE ?? 0, Math.min(SPEC_CAP, ALPHA_DATA * Math.log10(effCode / REF_SHARE.CODE!)), 1e-9), 's_d,data = α_data · log₁₀(effective drawn share ÷ reference share) (α 1.5, cap ±1.3 OOM, research/20 A2)', `code share ${(shareCode * 100).toFixed(1)}% vs ${(REF_SHARE.CODE! * 100).toFixed(1)}%`);
const capDraw = drawData(s0.player.dataPortfolio, 10e12, { shares: REF_SHARE, weights: { CODE: 1000 }, kinds: {} });
check(capDraw.sD.CODE === SPEC_CAP && Object.values(capDraw.sD).every((x) => Math.abs(x ?? 0) <= SPEC_CAP), 'draw: specialisation is capped at ±1.3 OOM', fmtS(capDraw.sD));
// The other presets specialise their domains.
for (const [opt, node, up] of [['science', 'scienceData', 'BIO'], ['multimodal', 'multimodal', 'PHYS']] as const) {
  unlock(node);
  const x = plan(sO, opt).limits!.sD;
  check((x[up] ?? 0) > 0.3 && (x.SOCIAL ?? 0) < 0, `draw: ${opt} raises ${up} and lowers SOCIAL`, fmtS(x));
}
// A short domain repeats and loses value: PHYS ×3 (multimodal) on a 400T base repeats PHYS; at the same size the
// balanced draw does not repeat as much, keeps more effective compute, and PHYS's effective share is below its drawn share.
const mmBig = plan(sO, 'multimodal', big).limits!;
const balBig = plan(s0, 'balanced', big).limits!;
check(mmBig.epochs > 2 && mmBig.epochs > balBig.epochs && mmBig.fData < balBig.fData && (mmBig.draw.effShare.PHYS ?? 0) < (mmBig.draw.share.PHYS ?? 0) - 1e-3,
  'draw: a short domain repeats (Muennighoff per domain) and loses value', `multimodal ${mmBig.epochs.toFixed(2)} epochs (PHYS), f_data ${mmBig.fData.toFixed(4)} vs balanced ${balBig.epochs.toFixed(2)} / ${balBig.fData.toFixed(4)}; PHYS share drawn ${((mmBig.draw.share.PHYS ?? 0) * 100).toFixed(1)}% → effective ${((mmBig.draw.effShare.PHYS ?? 0) * 100).toFixed(1)}%`);
const tiny = drawData(s0.player.dataPortfolio, 400e12, { shares: REF_SHARE, weights: { PHYS: 6 }, kinds: {} });
const sNaive = ALPHA_DATA * Math.log10((tiny.share.PHYS ?? 0) / REF_SHARE.PHYS!);
check(tiny.epochs > 4 && tiny.dEff < 0.98 * tiny.tokens && sNaive < SPEC_CAP && (tiny.sD.PHYS ?? 0) < sNaive - 0.03,
  'draw: a domain drawn beyond its tokens (PHYS ×6 on 400T) is worth less: specialisation reads the effective share', `PHYS ${tiny.epochs.toFixed(1)} epochs, s ${tiny.sD.PHYS?.toFixed(2)} OOM vs ${sNaive.toFixed(2)} on the drawn share; D_eff ${(tiny.dEff / T).toFixed(0)}T of 400T`);
// Synthetic-heavy draws more synthetic tokens; a domain the portfolio lacks draws nothing.
// RD-B01 (B01): a synthetic-heavy base needs P10 and no teacher (its synthetic tokens carry their own teachers); before
// P10 the plan keeps the lock reason, after it the launch action starts the run.
const synLocked = plan(sO, 'synthetic').reason;
unlock('P10');
{
  const sL = deserialize(serialize(sO));
  const before = sL.player.models.runs.length;
  const err = act(sL, 'launchBase', { data: 'synthetic' }); // the rest at the reference recipe
  const run = sL.player.models.runs[sL.player.models.runs.length - 1];
  check(synLocked === `Needs ${TREE_BY_ID.P10.name} (Research)` && plan(sO, 'synthetic').reason === undefined && !err && sL.player.models.runs.length === before + 1
    && run.kind === 'base' && run.base?.data === 'synthetic' && !run.teacherVersionId,
    'RD-B01: a synthetic-heavy base keeps the P10 lock reason before P10, and launches with no teacher after it', `before P10 "${synLocked}"; after: ${err ?? `run ${run?.id} (${run?.base?.data})`}`);
}
const synPlan = plan(sO, 'synthetic').limits!;
check(((synPlan.draw.byKind.synthetic ?? 0) / synPlan.tokens) > 2 * ((refDraw.byKind.synthetic ?? 0) / refDraw.tokens) && (synPlan.sD.CODE ?? 0) > 0,
  'draw: synthetic-heavy draws synthetic data ×4 (more code and math)', `synthetic ${(100 * (synPlan.draw.byKind.synthetic ?? 0) / synPlan.tokens).toFixed(1)}% vs ${(100 * (refDraw.byKind.synthetic ?? 0) / refDraw.tokens).toFixed(1)}% of the tokens; s ${fmtS(synPlan.sD)}`);
// D11: at the start the synthetic stock is V0's q 0.5, so the synthetic-heavy draw is a low-quality draw: G falls by the
// Besiroglu value of its mean quality (the domain specialisation is separate). On the 400-tokens-per-parameter reference
// base (A6b) the data term weighs less than at 50, so the fall is ≈ −0.009 OOM (the threshold was −0.01).
const synQ = synPlan.gPre.quality;
check(synQ < -0.005 &&synPlan.draw.qRel < 0.97 && near(synQ, Math.log10(fDataEff(synPlan.params, synPlan.tokens, synPlan.tokens * synPlan.draw.qRel)), 1e-9)
  && near(synPlan.gPre.total - refPlan.limits!.gPre.total, synQ + synPlan.gPre.design - refPlan.limits!.gPre.design, 1e-9),
  'quality: a synthetic-heavy draw of q 0.5 data lowers G (mean quality below the reference draw\'s)', `mean q ×${synPlan.draw.qRel.toFixed(3)} → ${synQ.toFixed(4)} OOM`);
// Balanced keeps the reference shares when the portfolio drifts (lots of code-heavy synthetic data, RefBot's path); the
// natural mix specialises with it. The reference recipe's shares were what o_d was fitted to (design/archive/notes/D3.md).
const drift = drawData(sFx.player.dataPortfolio, 100e12, { shares: REF_SHARE, weights: {}, kinds: {} }); // RefBot's fixed target (RD-T08)
const driftNat = drawData(sFx.player.dataPortfolio, 100e12, NATURAL_MIX);
// Shape, not the old 'CODE > 0.2' pin (a magnitude of the fixture's portfolio): the natural mix specialises (some domain moves by > 0.2,
// CODE up), the balanced draw does not.
check(Object.keys(drift.sD).length === 0 && (driftNat.sD.CODE ?? 0) > 0.05 && Math.max(...Object.values(driftNat.sD).map((x) => Math.abs(x ?? 0))) > 0.2, 'draw: on the day-400 portfolio balanced keeps the reference shares (no specialisation while no domain repeats); the natural mix specialises (code up)',
  `balanced ${fmtS(drift.sD) || 'none'}; natural ${fmtS(driftNat.sD)}`);

// ---------- model v3 D9: P10 and P21 as typed data-efficiency effects ----------
// A finished result is built in (completeAdoption, the engine's adoption path) with the project's realised effect x
// (1 = as designed); the effect enters through the data mechanisms, not as a flat bonus.
const C9: Candidate = { k: 1, gen: 1, nov: 0.5, b: 1, q: 1, mu: 1, sd: 0.2, muS: 0, sdS: 0 };
const adoptResult = (s: GameStateV2, id: string) => {
  s.hidden.paradigmSuccess[id] = true;
  const x = candidateTruth(s, TREE_BY_ID[id], freshCap(), C9).x;
  s.player.tree[id] = { status: 'researching', progress: 0, attempts: 1, cap: { ...freshCap(), stage: 'adopting', result: { c: C9, xTest: x, sHat: 0, fTest: 1e24, est: 1, estSd: 0.1, buildId: 'd9', day: s.time.day } } } as never;
  completeAdoption(s, makeCtx(s), id, 'd9');
  return x;
};
{
  // P10: the synthetic-quality ceiling rises by x × 0.5 (1 → 1.5 as designed); U does not jump at adoption (no ×3).
  const a = game();
  const b = game();
  const x = adoptResult(b, 'P10');
  const cap = synQualityCap(b);
  const g0b = gV0(b.hidden.timeline);
  check(x > 0 && b.player.tree.P10?.status === 'known' && near(b.player.research.dataFx?.synQMax ?? 0, x * P10_SYN_Q_RAISE, 1e-12) && near(cap, 1 + x * P10_SYN_Q_RAISE, 1e-12) && synQualityCap(a) === 1
    && uniqueTokens(b) === uniqueTokens(a) && syntheticQuality(g0b + 4, g0b, cap) === Math.min(cap, 1.5) && syntheticQuality(g0b + 1, g0b, cap) === 0.75,
    'P10: adoption raises the synthetic-quality ceiling by x × 0.5 (q 1 → 1.5 as designed; Maini et al. 2024, phi-4, research/20 A3), U unchanged (no ×3)',
    `x ${x.toFixed(3)}, ceiling ${cap.toFixed(3)}; q at V0 + 1 / 2 / 3 / 4 OOM ${[1, 2, 3, 4].map((k) => syntheticQuality(g0b + k, g0b, cap).toFixed(3)).join(' / ')}`);
  // Through the mechanism: a teacher 3 OOM above V0 writes q 1 data without P10, q min(cap, 1.25) with it, and a base
  // that draws 100T of it gains G from the quality term (the loss law), nothing else.
  const strongT = (s: GameStateV2) => {
    const v = s.player.models.versions[0];
    return { ...v, id: 'Vx', build: { ...v.build!, gPre: v.build!.gPre + 3 } };
  };
  const qa = synAssetFor(a, strongT(a), 100);
  const qb = synAssetFor(b, strongT(b), 100);
  addAsset(a.player.dataPortfolio, qa);
  addAsset(b.player.dataPortfolio, qb);
  const pa = basePlan(a, DRAW_BASE.params * 2).limits!;
  const pb = basePlan(b, DRAW_BASE.params * 2).limits!;
  check(qa.quality === 1 && near(qb.quality, Math.min(cap, 1.25), 1e-12) && pb.gPre.quality > pa.gPre.quality && near(pb.gPre.total - pa.gPre.total, pb.gPre.quality - pa.gPre.quality, 1e-9),
    'P10: a strong teacher\'s data is worth more per token in the loss law (quality term), only with P10',
    `teacher V0 + 3 OOM: q ${qa.quality.toFixed(3)} → ${qb.quality.toFixed(3)}; 100T of it, base ${((DRAW_BASE.params * 2 * DRAW_BASE.tpp) / T).toFixed(0)}T: quality term ${pa.gPre.quality.toFixed(4)} → ${pb.gPre.quality.toFixed(4)} OOM`);
  // RD-B01 (B43): the Data panel's teacher table shows the quality generation writes (the P10 cap included).
  const rowQ = (s: GameStateV2) => {
    const t = deserialize(serialize(s));
    const v = t.player.models.versions[0];
    v.build = { ...v.build!, gPre: v.build!.gPre + 3 };
    return { row: teacherRows(t).find((r) => r.id === v.id)!.quality, gen: synAssetFor(t, v, 100).quality };
  };
  const ra = rowQ(a);
  const rb = rowQ(b);
  check(near(ra.row, ra.gen, 1e-12) && near(rb.row, rb.gen, 1e-12) && rb.row > 1,
    'RD-B01: the teacher table\'s quality is the quality generation writes, P10 cap included', `V0 + 3 OOM: no P10 ${ra.row.toFixed(3)} (gen ${ra.gen.toFixed(3)}); P10 ${rb.row.toFixed(3)} (gen ${rb.gen.toFixed(3)})`);
  // New tokens from a teacher whose asset began before P10 carry today's quality (token-weighted mean).
  const c = game();
  const vS = strongT(c);
  c.player.models.versions.push(vS);
  c.player.split.synthetic = 0.1;
  c.player.dataPortfolio.synJob = { teacherId: vS.id, share: 1, until: c.time.day + 30 };
  syntheticAccrual(c);
  const t1 = owned(c, 'syn:Vx')!.tokensT;
  adoptResult(c, 'P10');
  syntheticAccrual(c);
  const aC = owned(c, 'syn:Vx')!;
  const qNew = Math.min(synQualityCap(c), 1.25);
  check(near(aC.quality, (1 * t1 + qNew * (aC.tokensT - t1)) / aC.tokensT, 1e-12) && aC.quality > 1,
    'P10: data generated after adoption carries the higher quality (the asset\'s quality is the token-weighted mean)', `q ${aC.quality.toFixed(4)} after ${t1.toFixed(2)}T at q 1 and ${(aC.tokensT - t1).toFixed(2)}T at q ${qNew.toFixed(3)}`);
}
{
  // P21: every drawn token is worth 10^(x × 0.3) in the loss law (×2 as designed); the quality term carries it.
  const a = game();
  const b = game();
  const x = adoptResult(b, 'P21');
  const w = Math.pow(10, x * P21_WORTH_OOM);
  const rows: string[] = [];
  let ok = x > 0 && near(tokenWorth(b), w, 1e-12) && tokenWorth(a) === 1 && near(b.player.research.dataFx?.worthOom ?? 0, x * P21_WORTH_OOM, 1e-12);
  let prev = Infinity;
  for (const tpp of [20, 50, 200]) {
    const d = { ...REFERENCE_BASE, tpp, curation: { ...REFERENCE_BASE.curation } };
    const pa = planRun(a, { kind: 'base', base: d, poolShare: 0.6 }).limits!;
    const pb = planRun(b, { kind: 'base', base: d, poolShare: 0.6 }).limits!;
    const D = d.params * tpp;
    const want = Math.log10(fDataEff(d.params, D, pa.draw.dEff * w)) - Math.log10(fDataEff(d.params, D, pa.draw.dEff));
    const dG = pb.gPre.total - pa.gPre.total;
    if (!near(dG, want, 1e-9) || !near(pb.draw.dEff / pa.draw.dEff, w, 1e-9) || pb.draw.uMix !== pa.draw.uMix || !(dG > 0) || !(dG < prev)) ok = false;
    prev = dG;
    rows.push(`${tpp} tokens/param +${dG.toFixed(3)} OOM`);
  }
  check(ok, 'P21: drawn tokens are worth ×10^(x·0.3) in the loss law (D_eff × worth; same draw, same epochs); worth most at few tokens per parameter',
    `x ${x.toFixed(3)}, worth ×${w.toFixed(3)}; B0-size base: ${rows.join(', ')}`);
}
{
  // D2's finding re-checked under the final rules (D11 quality in the loss law, the web's cap, P10's ceiling): day-400
  // teachers, 30 days of the whole pool each, then the latest base design (as the D11 check above). Below the cap
  // (every day-400 teacher, q ≤ 0.75) P10 changes nothing and the strongest teacher pays; a later lab whose teachers are
  // 2.5 OOM stronger (same FLOP per token) hits the web's cap without P10, so tokens per H100e-day decide again (the
  // smallest teacher wins, D2's distilled-mini finding); with P10 quality keeps ranking them.
  const run = (p10: boolean, dG: number, fptMul = 1, only?: string) => {
    const base = deserialize(serialize(sSy));
    base.player.split.synthetic = Math.max(0.05, base.player.split.synthetic);
    for (const v of base.player.models.versions) if (v.build) { v.build = { ...v.build, gPre: v.build.gPre + dG }; v.fpt = (v.fpt ?? 1) * fptMul; }
    if (p10) adoptResult(base, 'P10');
    const none = deserialize(serialize(base));
    none.player.split.synthetic = 0;
    for (let i = 0; i < 30; i++) syntheticAccrual(none);
    const g0n = planRun(none, { kind: 'base', base: { ...latest, curation: { ...latest.curation } }, poolShare: 0.6 }).limits!.gPre.total;
    return withG.filter(({ v }) => !only || v.id === only).map(({ v }) => {
      const s = deserialize(serialize(base));
      act(s, 'data.synthesize', { teacher: v.id, share: 1, days: 30 });
      for (let i = 0; i < 30; i++) syntheticAccrual(s);
      const q = synAssetFor(s, versionById(s, v.id)).quality;
      return { id: v.id, fpt: v.fpt ?? 1, q, dG: planRun(s, { kind: 'base', base: { ...latest, curation: { ...latest.curation } }, poolShare: 0.6 }).limits!.gPre.total - g0n };
    });
  };
  const best = (r: ReturnType<typeof run>) => r.reduce((a, b) => (b.dG > a.dG ? b : a));
  const fmt = (r: ReturnType<typeof run>) => r.map((x) => `${x.id} q ${x.q.toFixed(2)} ΔG ${sgn(x.dG)}`).join(', ');
  const now0 = run(false, 0);
  const now1 = run(true, 0);
  const late0 = run(false, 2.5);
  const late1 = run(true, 2.5);
  // M10 (fixture drift): since MKT the day-400 lineup holds RefBot's API cheap-tier students (a year of progress below
  // the API model), whose G stays under the web's cap even 2.5 OOM up (q 0.83); the finding is about teachers AT the cap,
  // so the smallest teacher is sought among those (and at least most teachers must be capped).
  // M11 (fixture drift): since TIERS RefBot distils no API cheap tier, so the day-400 lineup's smallest teachers are the
  // five B0 versions (V0–V8, one FLOP per token; they differ only in post-training): the winner must be of the smallest
  // size, not one particular version of it.
  const capped = late0.filter((x) => x.q === 1);
  const minFpt = Math.min(...capped.map((x) => x.fpt));
  // M12 (fixture drift): among teachers of one size the version-specific part of the draw (domain mix) moves the next base's G by +-10%,
  // more than the 9% FLOP-per-token gap between the day-400 sizes, so 'the best capped teacher is a smallest one' can no longer be read off
  // the lineup. The mechanism is isolated instead: the same capped teacher at half the FLOP per token yields more tokens and so more G.
  const probe = capped[0].id;
  const wide = run(false, 2.5, 0.5, probe)[0];
  const fptWins = wide.q === 1 && wide.dG > capped[0].dG;
  const smallest = capped.filter((x) => x.fpt <= minFpt * (1 + 1e-9)).map((x) => x.id).join(' / ');
  check(now0[now0.length - 1].dG >= best(now0).dG - 1e-4 && now0.every((x, i) => near(x.dG, now1[i].dG, 1e-12)) && capped.length >= late0.length / 2 && fptWins && late1.some((x) => x.q > 1),
    'D9 teacher re-check: below the cap the strongest teacher pays (P10 changes nothing at day 400); at the web\'s cap a teacher with less FLOP per token wins again; P10 lets quality rank them',
    `day 400: ${fmt(now0)}; teachers +2.5 OOM, no P10: ${fmt(late0)} (best ${best(late0).id}; at the cap ${capped.length} of ${late0.length}, best ${best(capped).id}, smallest ${smallest}; ${probe} at half the FLOP per token ΔG ${sgn(capped[0].dG)} → ${sgn(wide.dG)}); with P10: ${fmt(late1)} (best ${best(late1).id})`);
}

// ---------- RD-B02: a run's inputs are frozen at launch ----------
// B02 / B03: data delivered, ideas adopted (P07, domain effects; P24 is a line since round 2 item 9, its stack gain is the pre.base bump below) and stacks grown while a run trains leave its result
// unchanged; the same changes do move a plan made today (so the check is not vacuous).
{
  const finishRun = (st: GameStateV2, id: string) => {
    const r = st.player.models.runs.find((x) => x.id === id)!;
    r.readyDay ??= st.time.day;
    r.flopDone = r.flopNeeded;
    runsSystem.run(st, makeCtx(st));
  };
  const midRun = (st: GameStateV2) => {
    addAsset(st.player.dataPortfolio, licenceAsset('CODE', 'curated', 200, st.time.day)); // +200T of q 2 code
    adoptResult(st, 'P07');
    st.player.research.domainG.CODE = (st.player.research.domainG.CODE ?? 0) + 0.3; // a domain idea's effect
    const k = st.player.research.stacks;
    k.pre.base += 0.2;
    k.rlMid.base += 0.2;
    k.serve.base += 1; // past D10's utilisation part: a FLOP-per-token part for new versions
  };
  const pick = (o: object, keys: string[]) => JSON.stringify(Object.fromEntries(keys.map((k) => [k, (o as Record<string, unknown>)[k]])));
  // Base run.
  const s0 = game();
  s0.player.finance.cash += 1e3;
  const baseP = { kind: 'base' as const, base: { ...REFERENCE_BASE, curation: { ...REFERENCE_BASE.curation } }, poolShare: 0.6 };
  const r0 = launchRun(s0, makeCtx(s0), baseP);
  const rid = typeof r0 === 'string' ? '' : r0.id;
  const A = deserialize(serialize(s0));
  const B = deserialize(serialize(s0));
  const planA = planRun(A, baseP).limits!.gPre.total;
  midRun(B);
  const planB = planRun(B, baseP).limits!.gPre.total;
  finishRun(A, rid);
  finishRun(B, rid);
  const keysB = ['flop', 'tokens', 'gPre', 'ePre', 'sD', 'epochs', 'serve', 'signals', 'traitsTrue', 'uModes', 'teacherData'];
  const bA = A.player.models.bases.at(-1)!;
  const bB = B.player.models.bases.at(-1)!;
  check(!!rid && typeof r0 !== 'string' && !!r0.recipe?.draw && A.player.models.bases.length === s0.player.models.bases.length + 1
    && pick(bA, keysB) === pick(bB, keysB) && planB - planA > 0.01,
    'RD-B02: a base frozen at launch: data delivered and stacks adopted while it trains leave the finished base unchanged (traits included); a plan today moves',
    `${typeof r0 === 'string' ? r0 : ''} gPre ${bA.gPre.toFixed(4)} vs ${bB.gPre.toFixed(4)}; epochs ${bA.epochs?.toFixed(3)} vs ${bB.epochs?.toFixed(3)}; plan today ${planA.toFixed(4)} → ${planB.toFixed(4)}`);
  // Post-training run on B0.
  const s1 = game();
  const postP = { kind: 'post' as const, baseId: s1.player.models.bases[0].id, post: { ...REFERENCE_POST, methods: [] }, poolShare: 0.2 };
  const r1 = launchRun(s1, makeCtx(s1), postP);
  const pid = typeof r1 === 'string' ? '' : r1.id;
  const C = deserialize(serialize(s1));
  const D = deserialize(serialize(s1));
  const planC = planRun(C, postP);
  midRun(D);
  const planD = planRun(D, postP);
  finishRun(C, pid);
  finishRun(D, pid);
  const vC = C.player.models.versions.at(-1)!;
  const vD = D.player.models.versions.at(-1)!;
  const keysV = ['G', 'Lg', 'domains', 'fpt', 'monitorability', 'traitsTrue'];
  check(!!pid && vC.id === vD.id && vC.baseId === postP.baseId && pick(vC, keysV) === pick(vD, keysV) && JSON.stringify(vC.build) === JSON.stringify(vD.build)
    && (planD.g.gD?.CODE ?? 0) - (planC.g.gD?.CODE ?? 0) > 0.25 && planD.prediction.fpt < planC.prediction.fpt,
    'RD-B02: a post-train frozen at launch: domain effects, P07, the RL and serving stacks adopted while it trains leave the version unchanged; a plan today moves',
    `${typeof r1 === 'string' ? r1 : ''} G ${vC.G.toFixed(4)} vs ${vD.G.toFixed(4)}; fpt ${vC.fpt.toExponential(4)} vs ${vD.fpt.toExponential(4)}; plan CODE ${(planC.g.gD?.CODE ?? 0).toFixed(3)} → ${(planD.g.gD?.CODE ?? 0).toFixed(3)}; plan fpt ${planC.prediction.fpt.toExponential(4)} → ${planD.prediction.fpt.toExponential(4)}; differs: ${[...keysV.filter((k) => pick(vC, [k]) !== pick(vD, [k])), ...(JSON.stringify(vC.build) === JSON.stringify(vD.build) ? [] : ['build'])].join(', ') || 'none'}`);
}

// ---------- saves ----------
// RD-C03 (DD-20): saves below schemaRev 33 no longer load (hygiene checks the refusal); the 20 → 21 and 23 → 24 data
// migrations went with them. A current save round-trips its portfolio, deals and jobs.
const rt = deserialize(serialize(sLic));
check(uniqueTokens(rt) === uniqueTokens(sLic) && deserialize(serialize(jS.s)).player.dataPortfolio.synJob?.teacherId === strong.v.id,
  'save: deals and jobs round-trip');
const fx400 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
check(Array.isArray(fx400.player.dataPortfolio.pending) && !fx400.player.research.dataFx, 'save: the day-400 fixture loads at the current rev (no data-efficiency effects adopted)');

finish('data');
