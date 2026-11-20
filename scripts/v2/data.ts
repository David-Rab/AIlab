// Model v3 D1 data portfolio (design/MODEL-V3.md §9; research/20 A3; src/engine/v2/production/data.ts). Owner: WS1.
//   The start portfolio sums to v1's U (310T); repetition is unchanged at equal U; quality moves G through U (higher q,
//   less repetition, higher G); the public web is one finite stock shared by every lab; synthetic tokens grow with the
//   synthetic compute (v1's yield at V0) and their quality with the teacher's G; usage tokens come only from live
//   products on eligible channels; saves at schemaRev 20 migrate with the same U.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_WEB, SYN_Q } from '../../src/data/v2/dataAssets';
import { REFERENCE_BASE } from '../../src/data/v2/runDesign';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { act } from '../../src/engine/v2/core/loop';
import { deserialize } from '../../src/engine/v2/core/save';
import { gV0 } from '../../src/engine/v2/models/capability';
import { fData } from '../../src/engine/v2/models/effective';
import { planRun } from '../../src/engine/v2/models/runs';
import {
  assetTokensT, dataPortfolioFromV2, portfolioByKind, portfolioU, publicUse, syntheticAccrual, syntheticQuality, synTokensPerH100eDay,
  uniqueTokens, unlicensedPublicT, usageAccrual, usageTokensPerDay,
} from '../../src/engine/v2/production/data';
import type { GameStateV2, OwnedDataAsset } from '../../src/engine/v2/types';
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
check(L.epochs > 1 && L.fData < 1 && L.fData === fData(big, L.tokens, 310e12), 'repetition: a base beyond U pays v1\'s Muennighoff fraction at the same U', `${L.epochs.toFixed(2)} epochs, f_data ${L.fData.toFixed(4)}`);
// The same U from a different portfolio (less crawl, more licensed) gives the same G.
const sEq = game();
publicUse(sEq.player.dataPortfolio)!.coverage = 0.8; // −30T crawl
owned(sEq, 'lic:start')!.tokensT += 30;
const pEq = basePlan(sEq, big);
check(near(uniqueTokens(sEq), uniqueTokens(s0), 1e3) && pEq.limits!.gPre.total === L.gPre.total, 'repetition: equal U from a different portfolio gives the same G', `${pEq.limits!.gPre.total.toFixed(5)} vs ${L.gPre.total.toFixed(5)}`);

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
check(small.gPre.total === basePlan(s0, REFERENCE_BASE.params).limits!.gPre.total, 'quality: a base within U is unchanged (quality acts only through repetition until D3\'s draw)');

// ---------- the public web: finite and shared ----------
const sA = game();
const sB = game('challenger');
const pubA = publicUse(sA.player.dataPortfolio)!;
pubA.coverage = 5; // a lab cannot crawl more than the world has
check(assetTokensT(pubA) === PUBLIC_WEB.stockT && assetTokensT(publicUse(sB.player.dataPortfolio)!) === 0.9 * PUBLIC_WEB.stockT,
  'public web: one finite world stock (300T, Villalobos et al. 2024) that every lab reads; no crawl exceeds it', `${assetTokensT(pubA)}T cap, other lab ${assetTokensT(publicUse(sB.player.dataPortfolio)!)}T`);
check(!('tokensT' in pubA) && !('quality' in pubA), 'public web: labs hold a crawl share, not tokens (mix and quality are the world\'s)');
// Licensing (D3) adds a licensed corpus and licenses the crawl; the public stock stays the world's.
const sL = game();
sL.player.finance.cash = 100;
const pubBefore = assetTokensT(publicUse(sL.player.dataPortfolio)!);
const err = act(sL, 'D3');
check(!err && assetTokensT(publicUse(sL.player.dataPortfolio)!) === pubBefore && unlicensedPublicT(sL.player.dataPortfolio) === 0 && unlicensedPublicT(s0.player.dataPortfolio) === 270,
  'D3 "License data": the crawl is licensed (no unlicensed tokens left), the public stock is unchanged', err ?? `unlicensed 270T → ${unlicensedPublicT(sL.player.dataPortfolio)}T`);
check(near(uniqueTokens(sL), oldU({ licensedTokensT: 300, unlicensedTokensT: 0, syntheticTokensT: 20 }, 1), 1e3), 'D3: U = v1\'s (licensed + unlicensed) × 1.5 + synthetic = 460T', `${(uniqueTokens(sL) / T).toFixed(2)}T`);

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

finish('data');
