// Model v3 D1 data portfolio (design/MODEL-V3.md §9; research/20 A3; src/engine/v2/production/data.ts). Owner: WS1.
//   The start portfolio sums to v1's U (310T); repetition is unchanged at equal U; quality moves G through U (higher q,
//   less repetition, higher G); the public web is one finite stock shared by every lab; synthetic tokens grow with the
//   synthetic compute (v1's yield at V0) and their quality with the teacher's G; usage tokens come only from live
//   products on eligible channels; saves at schemaRev 20 migrate with the same U.
// Model v3 D3 (the draw): a base draws its tokens from the portfolio by its data mix; the balanced draw reproduces the
//   start, the natural mix reproduces D1's U and repetition, specialisation s_d,data follows the drawn shares (capped), a
//   short domain repeats and loses value, and no V1 data-option offsets are left.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALPHA_DATA, EXPERT_DELIVERY_DAYS, LICENCE_DELIVERY_DAYS, LICENCE_TIERS, PUBLIC_WEB, SPEC_CAP, SYN_Q, USAGE_LEVELS, WEB_LICENCE,
} from '../../src/data/v2/dataAssets';
import { BASE_DATA, REFERENCE_BASE } from '../../src/data/v2/runDesign';
import { EXPERT_PRICE_B_PER_T, SUITE_BUILD } from '../../src/data/v2/suites';
import { actionView } from '../../src/engine/v2';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { act } from '../../src/engine/v2/core/loop';
import { ACTION_BY_ID } from '../../src/engine/v2/core/registry';
import { SCHEMA_REV, deserialize, serialize } from '../../src/engine/v2/core/save';
import { gOfBuild, gV0 } from '../../src/engine/v2/models/capability';
import { effectiveTokens, fData } from '../../src/engine/v2/models/effective';
import { planRun } from '../../src/engine/v2/models/runs';
import { familyDomain, suiteWorkCost } from '../../src/engine/v2/models/suites';
import {
  NATURAL_MIX, REF_SHARE, assetTokensT, dataPortfolioFromV2, deliverData, drawData, expertDomainId, expertStockT, portfolioByKind, portfolioU, publicUse, synTeacher,
  syntheticAccrual, syntheticQuality, synTokensPerH100eDay, uniqueTokens, unlicensedPublicT, usageAccrual, usageTokensPerDay,
} from '../../src/engine/v2/production/data';
import type { BaseDesign, DomainId, GameStateV2, OwnedDataAsset } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish, runTo } from './lib';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const T = 1e12;
const game = (start: 'leader' | 'challenger' | 'bigtech' | 'spinout' = 'leader') => newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, start, tutorial: false }));
/** v1's stock: (licensed + unlicensed) × (1 + 0.5·deals) + 0.5 × synthetic (× 3 with P10). */
const oldU = (a: { licensedTokensT: number; unlicensedTokensT: number; syntheticTokensT: number }, deals: number, p10 = false) =>
  ((a.licensedTokensT + a.unlicensedTokensT) * (1 + 0.5 * deals) + 0.5 * a.syntheticTokensT * (p10 ? 3 : 1)) * T;
const owned = (s: GameStateV2, id: string) => s.player.dataPortfolio.assets.find((a): a is OwnedDataAsset => a.id === id);
const basePlan = (s: GameStateV2, params: number) => planRun(s, { kind: 'base', base: { ...REFERENCE_BASE, params, curation: { ...REFERENCE_BASE.curation } }, poolShare: 0.6 });

// ---------- start: same stock as v1 ----------
const s0 = game();
const rows = portfolioByKind(s0.player.dataPortfolio);
check(rows.length === 5 && rows.every((r) => r.assets >= 1), 'start: the portfolio holds the five kinds (public, licensed, usage, synthetic, expert)', rows.map((r) => `${r.kind} ${r.tokensT}T q${r.quality}`).join(', '));
check(near(uniqueTokens(s0), oldU({ licensedTokensT: 30, unlicensedTokensT: 270, syntheticTokensT: 20 }, 0), 1e3), 'start: U = 270T crawl + 30T licensed + 0.5 × 20T synthetic = v1\'s 310T', `${(uniqueTokens(s0) / T).toFixed(3)}T`);
check(near(s0.player.models.bases[0].epochs!, (REFERENCE_BASE.params * REFERENCE_BASE.tpp) / 310e12, 1e-12), 'start: B0\'s epochs read the portfolio (50T over 310T)', s0.player.models.bases[0].epochs!.toFixed(4));
let sameStart = true;
for (const st of ['challenger', 'bigtech', 'spinout'] as const) if (uniqueTokens(game(st)) !== uniqueTokens(s0)) sameStart = false;
check(sameStart, 'start: every start type keeps the same data as before (U 310T)');

// ---------- repetition at equal U ----------
const big = 8e12; // 8T active × 50 = 400T tokens > 310T
const pBig = basePlan(s0, big);
const L = pBig.limits!;
check(L.epochs > 1 && L.fData < 1 && near(L.fData, fData(big, L.tokens, 310e12), 1e-12), 'repetition: a base beyond U pays v1\'s Muennighoff fraction at the same U (balanced = natural at the start)', `${L.epochs.toFixed(2)} epochs, f_data ${L.fData.toFixed(4)}`);
// The same U from a different portfolio (less crawl, more licensed) gives the same effective tokens on the natural mix.
const sEq = game();
publicUse(sEq.player.dataPortfolio)!.coverage = 0.8; // −30T crawl
owned(sEq, 'lic:start')!.tokensT += 30;
const dEq = drawData(sEq.player.dataPortfolio, L.tokens, NATURAL_MIX);
const d0 = drawData(s0.player.dataPortfolio, L.tokens, NATURAL_MIX);
check(near(uniqueTokens(sEq), uniqueTokens(s0), 1e3) && near(dEq.dEff, d0.dEff, 1e3) && near(dEq.dEff, effectiveTokens(L.tokens, 310e12), 1e3), 'repetition: equal U from a different portfolio gives the same effective tokens on the natural mix', `${(dEq.dEff / T).toFixed(3)}T vs ${(d0.dEff / T).toFixed(3)}T`);

// ---------- quality ----------
const withQ = (q: number) => {
  const s = game();
  owned(s, 'lic:start')!.quality = q;
  return s;
};
const huge = 4e13; // 2000T tokens ≈ 6.5 epochs of 310T
const gRef = basePlan(s0, huge).limits!;
const gHi = basePlan(withQ(3), huge).limits!;
const gLo = basePlan(withQ(0.2), huge).limits!;
check(gHi.gPre.total > gRef.gPre.total && gLo.gPre.total < gRef.gPre.total && gHi.tokensUnique > gRef.tokensUnique,
  'quality: higher-quality data raises U and so G of a base that repeats data; lower quality lowers it (U = Σ q·T, R20 A3)',
  `licensed q 0.2 / 1 / 3: U ${[gLo, gRef, gHi].map((x) => (x.tokensUnique / T).toFixed(0)).join(" / ")}T, G ${[gLo, gRef, gHi].map((x) => x.gPre.total.toFixed(4)).join(" / ")}`);
const small = basePlan(withQ(3), REFERENCE_BASE.params).limits!;
check(small.gPre.total === basePlan(s0, REFERENCE_BASE.params).limits!.gPre.total, 'quality: a base within U is unchanged (quality acts only through repetition, D1\'s rule kept by the draw)');

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
// The old blanket "License data" (D3) is gone; licensing the crawl is data.license 'web'.
check(!ACTION_BY_ID.has('D3') && act(game(), 'D3') === 'unknown action D3', 'D2: the old "License data" action (D3) is removed');
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
check(/U 310 → 312T/.test(g0Txt) && /PHYS 4\.\d% → 5\.\d% of the stock/.test(g0Txt) && /base epochs/.test(g0Txt) && pv0.costs[0]?.currency === 'cash',
  'license preview: before → after of the Blueprint data readouts (U, the domain\'s share and specialisation, base epochs)', g0Txt);
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

// Expert data by domain: cash, delivered, and a suite build in that domain uses it before buying.
const sEx = game();
sEx.player.finance.cash = 100;
const famBio = 'bio' as const;
const domBio = familyDomain(famBio);
const errE = act(sEx, 'data.expert', { domain: domBio, tokensT: 0.003 });
deliverAt(sEx, EXPERT_DELIVERY_DAYS);
const exA = owned(sEx, expertDomainId(domBio));
check(!errE && near(sEx.player.finance.cash, 100 - 0.003 * EXPERT_PRICE_B_PER_T, 1e-9) && exA?.tokensT === 0.003 && exA.kind === 'expert' && exA.quality === 3 && portfolioU(sEx.player.dataPortfolio) === portfolioU(s0.player.dataPortfolio),
  'expert: buying 3M BIO expert tokens costs $0.15B and adds them to the domain\'s expert asset (not pretraining data: U unchanged)', errE ?? `${exA?.tokensT}T`);
const cBuild = suiteWorkCost(sEx, famBio, 'build');
const cash0 = sEx.player.finance.cash;
const errB = act(sEx, 'suite.build', { family: famBio });
check(!errB && cBuild.cashB === 0 && cBuild.fromStockT === SUITE_BUILD.tokensT && near(expertStockT(sEx.player.dataPortfolio, domBio), 0.001, 1e-12) && sEx.player.finance.cash === cash0,
  'expert: a suite build in that domain takes the bought data instead of paying (one purchase path)', errB ?? `cost ${cBuild.cashB}, left ${expertStockT(sEx.player.dataPortfolio, domBio)}T`);
const c2 = suiteWorkCost(sEx, 'swe', 'build');
check(c2.fromStockT === 0 && near(c2.cashB, SUITE_BUILD.tokensT * EXPERT_PRICE_B_PER_T, 1e-12), 'expert: a build without bought data in its domain pays as before ($0.1B)');

// ---------- synthetic data ----------
const syn = (share: number) => {
  const s = game();
  s.player.policies.spareTraining = 'research';
  s.player.split.synthetic = share;
  const before = portfolioByKind(s.player.dataPortfolio).find((r) => r.kind === 'synthetic')!.tokensT;
  syntheticAccrual(s);
  return { s, added: portfolioByKind(s.player.dataPortfolio).find((r) => r.kind === 'synthetic')!.tokensT - before };
};
const y1 = syn(0.1);
const y2 = syn(0.2);
check(y1.added > 0 && near(y2.added / y1.added, 2, 1e-9) && syn(0).added === 0, 'synthetic: tokens grow in proportion to the synthetic compute (none without it)', `${y1.added.toFixed(3)}T → ${y2.added.toFixed(3)}T per day`);
check(near(synTokensPerH100eDay(y1.s.player.models.versions[0].fpt!) / 1e12, 4e-6, 4e-8), 'synthetic: V0 as the teacher yields v1\'s 4e-6 T per H100e-day (overgeneration 4.33, R20 A3 2–5×)',
  `${(synTokensPerH100eDay(y1.s.player.models.versions[0].fpt!) / 1e6).toFixed(2)}M tokens per H100e-day`);
const fresh = y1.s.player.dataPortfolio.assets.find((a): a is OwnedDataAsset => a.kind === 'synthetic' && a.teacherId !== undefined);
const g0 = gV0(s0.hidden.timeline);
check(!!fresh && fresh.inheritsTraits === true && near(fresh.quality, SYN_Q.atV0, 0.02) && syntheticQuality(g0 + 2, g0) > syntheticQuality(g0, g0) && syntheticQuality(g0 + 99, g0) === SYN_Q.max,
  'synthetic: the asset keeps its teacher (inherits its traits); quality ≈ 0.5 from V0, rising with the teacher\'s G to 1.5', `teacher ${fresh?.teacherId} q ${fresh?.quality.toFixed(3)}; +2 OOM q ${syntheticQuality(g0 + 2, g0)}`);
const synW = portfolioByKind(y1.s.player.dataPortfolio).find((r) => r.kind === 'synthetic')!.weightedT;
check(near(portfolioU(y1.s.player.dataPortfolio, { p10: true }) - portfolioU(y1.s.player.dataPortfolio), 2 * synW * T, 1e6), 'synthetic: P10 counts synthetic tokens ×3 (v1, until D9)');

// ---------- usage data ----------
const sU = game();
runTo(sU, 20, { skip: ['endings'] });
const consumer = sU.player.deployments.find((d) => d.channel === 'consumer')!;
const api = sU.player.deployments.find((d) => d.channel === 'api')!;
const usageT = owned(sU, 'usage')!.tokensT;
check(usageT > 0 && usageTokensPerDay(sU, consumer) > 0 && usageTokensPerDay(sU, api) === 0, 'usage: live consumer products add usage tokens; API traffic is not trained on by default',
  `${usageT.toFixed(2)}T in 20 days; consumer ${(usageTokensPerDay(sU, consumer) * 1000).toFixed(1)}B/day on ${consumer.servedH100e?.toFixed(0)} H100e, API 0`);
const startUsage = owned(s0, 'usage')!.tokensT;
for (const d of sU.player.deployments) d.status = 'withdrawn';
const u0 = owned(sU, 'usage')!.tokensT;
usageAccrual(sU);
check(startUsage === 0 && owned(sU, 'usage')!.tokensT === u0, 'usage: none before products serve and none from withdrawn products');
const mixSum = Object.values(owned(sU, 'usage')!.mix).reduce((a, x) => a + (x ?? 0), 0);
check(near(mixSum, 1, 1e-9), 'usage: the asset has a domain mix (consumer chat\'s work weights)', JSON.stringify(owned(sU, 'usage')!.mix));
// Usage-data policy (model v3 D2): the share kept changes the accrual; the Civil Liberties bloc reacts.
const sP = game();
runTo(sP, 20, { skip: ['endings'] });
const cons = sP.player.deployments.find((d) => d.channel === 'consumer')!;
const civ = () => sP.pub.blocs.civlib.approval;
const r0 = usageTokensPerDay(sP, cons);
const a0 = civ();
const eBroad = act(sP, 'data.usagePolicy', { level: 'broad' });
const rB = usageTokensPerDay(sP, cons);
const aB = civ();
const eNone = act(sP, 'data.usagePolicy', { level: 'none' });
const uN0 = owned(sP, 'usage')!.tokensT;
usageAccrual(sP);
check(!eBroad && !eNone && near(rB / r0, USAGE_LEVELS.broad.share / USAGE_LEVELS.standard.share, 1e-9) && near(aB - a0, USAGE_LEVELS.broad.civlib, 1e-9) && near(civ() - aB, USAGE_LEVELS.none.civlib - USAGE_LEVELS.broad.civlib, 1e-9)
  && usageTokensPerDay(sP, cons) === 0 && owned(sP, 'usage')!.tokensT === uN0 && sP.player.dataPortfolio.usageShare === 0,
  'usage policy: broad keeps 2.5× the usage tokens and costs Civil Liberties approval (−6); none keeps none (+10 back from broad)', `${(r0 * 1000).toFixed(1)} → ${(rB * 1000).toFixed(1)}B/day; civlib ${a0.toFixed(0)} → ${aB.toFixed(0)} → ${civ().toFixed(0)}`);
check(act(sP, 'data.usagePolicy', { level: 'none' }) === 'Already no training on users' && actionView(sP, 'data.usagePolicy', {}).gains.some((g) => /usage data 0\.0 → \d/.test(g.target ?? '')),
  'usage policy: no change to the same level; the preview shows the usage rate before → after', actionView(sP, 'data.usagePolicy', {}).gains.map((g) => g.target).join(' | '));

// ---------- the draw (model v3 D3) ----------
const plan = (s: GameStateV2, data: BaseDesign['data'], params = REFERENCE_BASE.params) =>
  planRun(s, { kind: 'base', base: { ...REFERENCE_BASE, params, data, curation: { ...REFERENCE_BASE.curation } }, poolShare: 0.6, ...(data === 'synthetic' ? { teacherVersionId: s.player.models.versions[0].id } : {}) });
const fmtS = (x: Partial<Record<string, number>>) => Object.entries(x).filter(([, v]) => Math.abs(v ?? 0) >= 0.005).map(([d, v]) => `${d} ${(v ?? 0) >= 0 ? '+' : ''}${(v ?? 0).toFixed(2)}`).join(' ');
// Start: the reference recipe's balanced draw is the start portfolio's natural mix, so it reproduces the start numbers.
const refPlan = plan(s0, 'balanced');
const refDraw = refPlan.limits!.draw;
check(Object.keys(refPlan.limits!.sD).length === 0 && refPlan.limits!.fData === 1 && near(refDraw.uMix, 310e12, 1e3) && near(refPlan.limits!.epochs, s0.player.models.bases[0].epochs!, 1e-12),
  'draw: the reference recipe\'s balanced draw at the start reproduces the start (no specialisation, no repetition, U 310T, B0\'s epochs)', `s ${fmtS(refPlan.limits!.sD) || 'none'}, U ${(refDraw.uMix / T).toFixed(2)}T, ${refPlan.limits!.epochs.toFixed(4)} epochs`);
check(near(refPlan.limits!.gPre.total, s0.player.models.bases[0].gPre + (refPlan.limits!.gPre.recipe - s0.player.models.bases[0].ePre), 1e-9),
  'draw: the reference base\'s pretraining G differs from B0\'s by its recipe only (no data term)', `${refPlan.limits!.gPre.total.toFixed(4)}`);
check(Object.values(REF_SHARE).every((v) => v! > 0) && near(Object.values(REF_SHARE).reduce((a, x) => a + (x ?? 0), 0), 1, 1e-12) && near(REF_SHARE.CODE!, (270 * 0.08 + 30 * 0.15 + 10 * 0.35) / 310, 1e-12),
  'draw: the reference shares are the start portfolio\'s quality-weighted mix (code 9.6%)', fmtS(REF_SHARE));
// Natural mix: the drawn U is the portfolio's U and the repetition is D1's single-pool Muennighoff.
const sFx = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
let natOk = true;
const natRows: string[] = [];
for (const [name, st] of [['start', s0], ['day 400', sFx]] as const) {
  for (const p10 of [false, true]) {
    const U = portfolioU(st.player.dataPortfolio, { p10 });
    for (const D of [50e12, 3 * U]) {
      const dr = drawData(st.player.dataPortfolio, D, NATURAL_MIX, { p10 });
      if (!near(dr.uMix / U, 1, 1e-9) || !near(dr.dEff / effectiveTokens(D, U), 1, 1e-9) || (Object.keys(dr.sD).length > 0 && name === 'start' && !p10)) natOk = false;
      if (!natOk && !natRows.some((r) => r.startsWith('BAD'))) natRows.push(`BAD ${name} p10 ${p10} D ${(D / T).toFixed(0)}T: uMix ${(dr.uMix / T).toFixed(3)} dEff ${(dr.dEff / T).toFixed(3)} vs ${(effectiveTokens(D, U) / T).toFixed(3)} s ${fmtS(dr.sD)}`);
    }
    natRows.push(`${name}${p10 ? ' P10' : ''} U ${(U / T).toFixed(0)}T`);
  }
}
check(natOk, 'draw: the drawn U equals uniqueTokens (and D_eff Muennighoff on U) when the mix is natural', natRows.join(', '));
// Specialisation follows the mix: code & math raises CODE and RSCH and lowers SOCIAL, in the base and in its predicted domains.
const sO = game(); // options unlocked
const unlock = (id: string) => { sO.player.tree[id] = { ...(sO.player.tree[id] ?? {}), status: 'known' } as never; };
unlock('codeMath');
const cmPlan = plan(sO, 'codeMath');
const cm = cmPlan.limits!.sD;
const dG = (p: ReturnType<typeof plan>, d: DomainId) => (p.g.gD?.[d] ?? 0) - (refPlan.g.gD?.[d] ?? 0);
check(!cmPlan.reason && (cm.CODE ?? 0) > 0.3 && (cm.RSCH ?? 0) > 0.1 && (cm.SOCIAL ?? 0) < -0.1 && dG(cmPlan, 'CODE') > 0.3 && dG(cmPlan, 'SOCIAL') < -0.1 && near(cmPlan.g.G, refPlan.g.G, 1e-9),
  'draw: specialisation follows the drawn mix — code & math raises CODE/RSCH, lowers SOCIAL (general G unchanged)', `${cmPlan.reason ?? ''} s ${fmtS(cm)}; domain G vs balanced CODE ${dG(cmPlan, 'CODE').toFixed(2)}, SOCIAL ${dG(cmPlan, 'SOCIAL').toFixed(2)}`);
const shareCode = cmPlan.limits!.draw.share.CODE ?? 0;
check(near(cm.CODE ?? 0, Math.min(SPEC_CAP, ALPHA_DATA * Math.log10(shareCode / REF_SHARE.CODE!)), 1e-9), 's_d,data = α_data · log₁₀(drawn share ÷ reference share) (α 1.5, cap ±1.3 OOM, research/20 A2)', `code share ${(shareCode * 100).toFixed(1)}% vs ${(REF_SHARE.CODE! * 100).toFixed(1)}%`);
const capDraw = drawData(s0.player.dataPortfolio, 10e12, { base: 'reference', tilt: { CODE: 1000 }, kinds: {} });
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
const tiny = drawData(s0.player.dataPortfolio, 400e12, { base: 'reference', tilt: { PHYS: 6 }, kinds: {} });
const sNaive = ALPHA_DATA * Math.log10((tiny.share.PHYS ?? 0) / REF_SHARE.PHYS!);
check(tiny.epochs > 4 && tiny.dEff < 0.98 * tiny.tokens && sNaive < SPEC_CAP && (tiny.sD.PHYS ?? 0) < sNaive - 0.03,
  'draw: a domain drawn beyond its tokens (PHYS ×6 on 400T) is worth less: specialisation reads the effective share', `PHYS ${tiny.epochs.toFixed(1)} epochs, s ${tiny.sD.PHYS?.toFixed(2)} OOM vs ${sNaive.toFixed(2)} on the drawn share; D_eff ${(tiny.dEff / T).toFixed(0)}T of 400T`);
// Synthetic-heavy draws more synthetic tokens; a domain the portfolio lacks draws nothing.
unlock('P10');
const synPlan = plan(sO, 'synthetic').limits!;
check(((synPlan.draw.byKind.synthetic ?? 0) / synPlan.tokens) > 2 * ((refDraw.byKind.synthetic ?? 0) / refDraw.tokens) && (synPlan.sD.CODE ?? 0) > 0,
  'draw: synthetic-heavy draws synthetic data ×4 (more code and math)', `synthetic ${(100 * (synPlan.draw.byKind.synthetic ?? 0) / synPlan.tokens).toFixed(1)}% vs ${(100 * (refDraw.byKind.synthetic ?? 0) / refDraw.tokens).toFixed(1)}% of the tokens; s ${fmtS(synPlan.sD)}`);
// Balanced keeps the reference shares when the portfolio drifts (lots of code-heavy synthetic data, RefBot's path); the
// natural mix specialises with it. The reference recipe's shares were what o_d was fitted to (design/notes/D3.md).
const drift = drawData(sFx.player.dataPortfolio, 100e12, BASE_DATA.balanced);
const driftNat = drawData(sFx.player.dataPortfolio, 100e12, NATURAL_MIX);
check(Object.keys(drift.sD).length === 0 && (driftNat.sD.CODE ?? 0) > 0.2, 'draw: on the day-400 portfolio balanced keeps the reference shares (no specialisation while no domain repeats); the natural mix specialises in code',
  `balanced ${fmtS(drift.sD) || 'none'}; natural ${fmtS(driftNat.sD)}`);
// Lint: the V1 data-option design offsets are gone (no general ΔG, no level offsets, no repetition exemption).
const v1Keys = Object.values(BASE_DATA).flatMap((x) => Object.keys(x).filter((k) => ['dg', 'off', 'noWall'].includes(k)));
const srcHits: string[] = [];
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f)) readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (/\bnoWall\b|\bdeltaRsch\b|designOffset|Research boost|BASE_DATA\[[^\]]+\]\.(off|dg)\b/.test(l)) srcHits.push(`${p}:${i + 1}`); });
  }
};
walk(join(FIXTURE_DIR, '..', '..', '..', 'src'));
check(v1Keys.length === 0 && srcHits.length === 0, 'lint: no V1 data-option offsets left (BASE_DATA has no dg/off/noWall; no deltaRsch / "Research boost" readers)', [...v1Keys, ...srcHits].slice(0, 5).join(', '));

// ---------- saves ----------
const migA = dataPortfolioFromV2({ licensedTokensT: 30, unlicensedTokensT: 270, syntheticTokensT: 812.5 }, 0);
const migB = dataPortfolioFromV2({ licensedTokensT: 300, unlicensedTokensT: 0, syntheticTokensT: 812.5 }, 1);
check(near(portfolioU(migA), oldU({ licensedTokensT: 30, unlicensedTokensT: 270, syntheticTokensT: 812.5 }, 0), 1e3) && near(portfolioU(migB), oldU({ licensedTokensT: 300, unlicensedTokensT: 0, syntheticTokensT: 812.5 }, 1), 1e3)
  && unlicensedPublicT(migA) === 270 && unlicensedPublicT(migB) === 0, 'save: migration 20 → 21 keeps U and the unlicensed tokens (before and after a licence deal)');
const raw = readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8');
const old = (JSON.parse(raw) as { player: { dataAssets?: { licensedTokensT: number; unlicensedTokensT: number; syntheticTokensT: number } } }).player.dataAssets;
if (old) {
  const fx = deserialize(raw);
  check(near(uniqueTokens(fx), oldU(old, fx.relations.dataLicences.length, fx.player.paradigms.P10?.status === 'adopted'), 1e3) && !('dataAssets' in fx.player),
    'save: the day-400 fixture loads with the same U', `${(uniqueTokens(fx) / T).toFixed(1)}T`);
}

// Model v3 D2 (schemaRev 24 after M2, built as 23): a schemaRev-23 save (no pending deals, no job) migrates; saved deals and jobs round-trip.
const raw22 = JSON.parse(serialize(game())) as { schemaRev: number; player: { dataPortfolio: { pending?: unknown } } };
raw22.schemaRev = 23;
delete raw22.player.dataPortfolio.pending;
const mig22 = deserialize(JSON.stringify(raw22));
const rt = deserialize(serialize(sLic));
check(mig22.schemaRev === SCHEMA_REV && SCHEMA_REV >= 24 && Array.isArray(mig22.player.dataPortfolio.pending) && mig22.player.dataPortfolio.pending.length === 0 && !mig22.player.dataPortfolio.synJob
  && near(uniqueTokens(mig22), uniqueTokens(s0), 1e3) && uniqueTokens(rt) === uniqueTokens(sLic) && deserialize(serialize(jS.s)).player.dataPortfolio.synJob?.teacherId === strong.v.id,
  'save: a schemaRev-23 save migrates to the current rev (nothing pending, no job, same U); deals and jobs round-trip');
const fx400 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
check(Array.isArray(fx400.player.dataPortfolio.pending), 'save: the day-400 fixture migrates through 24');

finish('data');
