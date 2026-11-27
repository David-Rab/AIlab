// Data actions on the data portfolio (model v3 D2: design/MODEL-V3.md §9; numbers in data/v2/dataAssets.ts). Owner: WS1.
//
//   data.license      buy a licensed corpus in one domain at a price tier (q 1.5 / 2 / 3, research/20 A3), delivered
//                     later; domain 'web' licenses the public crawl instead (v2's blanket "License data": no tokens, ends
//                     the copyright-suit hazard, finance copyrightQ)
//   data.synthesize   a share of the synthetic pool generates with a chosen teacher for some days (tokens from
//                     synTokensPerH100eDay, quality from the teacher's G, the asset inherits the teacher's traits);
//                     days 0 stops the job. The rest of the pool keeps the default teacher (the internal research model)
//   (no expert-data purchase: expert data is only a suite input, bought by "Build suite" in models/suites.ts, DD-07)
//   data.usagePolicy  none / standard / broad: the share of eligible product output kept as usage data (its privacy
//                     side, the Civil Liberties bloc's approval, went with the blocs, W1c)
// Every preview shows the Blueprint's data readouts before → after (dataDelta: U, the domain's share of the stock and
// its specialisation, the latest base design's epochs).
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import {
  LICENCE_DELIVERY_DAYS, LICENCE_SIZE_T, LICENCE_TIERS, SYN_JOB, USAGE_LEVELS, USAGE_MIX, WEB_LICENCE,
  type LicenceTier, type UsageLevel,
} from '../../../data/v2/dataAssets';
import { L, pv } from '../actors/fx';
import { bookCash } from '../finance/ledger';
import { gOfBuild } from '../models/capability';
import { versionById } from '../models/labs';
import type { ActionDef, DataPortfolio, DomainId, GameStateV2, ModelVersion } from '../types';
import {
  addAsset, dataDelta, dataDeltaText, licenceAsset, publicUse, queueData, synAssetFor, synPoolH100e, synTeacher,
  synTokensT, unlicensedPublicT, usageRateAt,
} from './data';

type P = Record<string, number | string | boolean>;
const num = (p: P, k: string, d: number) => (typeof p[k] === 'number' ? (p[k] as number) : typeof p[k] === 'string' && p[k] !== '' && !Number.isNaN(Number(p[k])) ? Number(p[k]) : d);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const r2 = (x: number) => Math.round(x * 100) / 100;
const domainOf = (p: P, d: DomainId = 'CODE'): DomainId => (DOMAIN_IDS.includes(p.domain as DomainId) ? (p.domain as DomainId) : d);
const tierOf = (p: P): LicenceTier => (typeof p.tier === 'string' && p.tier in LICENCE_TIERS ? (p.tier as LicenceTier) : 'bulk');
const active = (s: GameStateV2) => (s.player.status === 'active' ? true : 'Company inactive');
/** Display unit of the data gains (model v3 D4): trillions of quality-weighted unique tokens U, not levels. */
const UNIQUE_T = 'T unique tokens';
const fmtTok = (t: number) => (t >= 1 ? `${t.toFixed(1)}T` : t >= 0.001 ? `${(t * 1000).toFixed(t >= 0.01 ? 0 : 1)}B` : `${(t * 1e6).toFixed(0)}M`);

// ───────────────────────────── licences ─────────────────────────────

/** A licence deal's terms: the domain ('web' = the crawl), tier, tokens and cash. */
export function licenceTerms(s: GameStateV2, p: P): { web: boolean; domain: DomainId; tier: LicenceTier; tokensT: number; cashB: number } {
  if (p.domain === 'web') return { web: true, domain: 'SOCIAL', tier: 'bulk', tokensT: 0, cashB: WEB_LICENCE.baseB + WEB_LICENCE.perTB * unlicensedPublicT(s.player.dataPortfolio) };
  const tier = tierOf(p);
  const tokensT = clamp(num(p, 'tokensT', LICENCE_TIERS[tier].defaultT), LICENCE_SIZE_T.min, LICENCE_SIZE_T.max);
  return { web: false, domain: domainOf(p), tier, tokensT, cashB: tokensT * LICENCE_TIERS[tier].priceBPerT };
}
function licenceBlock(s: GameStateV2, p: P): string | undefined {
  const t = licenceTerms(s, p);
  if (t.web && publicUse(s.player.dataPortfolio)?.licensed) return 'The crawl is already licensed';
  if (t.cashB > s.player.finance.cash) return 'Not enough cash';
  return undefined;
}

const LICENSE: ActionDef = {
  id: 'data.license', verb: 'deal', system: 'models', sphere: 'models', owner: 'WS1', title: 'License data',
  available: active,
  preview(s, p) {
    const t = licenceTerms(s, p);
    if (t.web) {
      return pv([L('cash', -r2(t.cashB), `licence on ${unlicensedPublicT(s.player.dataPortfolio).toFixed(0)}T crawled tokens`)], [], [L('cash', 0, 'copyright-suit hazard → 0')]);
    }
    const tier = LICENCE_TIERS[t.tier];
    const d = dataDelta(s, (x) => addAsset(x, licenceAsset(t.domain, t.tier, t.tokensT, s.time.day)), t.domain);
    return pv(
      [L('cash', -r2(t.cashB), `${fmtTok(t.tokensT)} ${t.domain} tokens at $${tier.priceBPerT}B/T, paid now`)],
      [L('progress', r2(d.u[1] - d.u[0]), `${tier.label} q ${tier.quality}, delivered in ${LICENCE_DELIVERY_DAYS} d: ${dataDeltaText(d)}`, { lagDays: LICENCE_DELIVERY_DAYS, unit: UNIQUE_T })],
    );
  },
  apply(s, ctx, p) {
    const why = licenceBlock(s, p);
    if (why) throw new Error(why);
    const t = licenceTerms(s, p);
    bookCash(s, ctx, -t.cashB, 'training', t.web ? 'licence on the web crawl' : 'data licence', t.web ? 'web' : t.domain);
    if (t.web) {
      publicUse(s.player.dataPortfolio)!.licensed = true;
      ctx.log('company', 'You licensed the crawled web text from publishers and authors: no more copyright suits over it.', 2);
      return;
    }
    queueData(s.player.dataPortfolio, licenceAsset(t.domain, t.tier, t.tokensT, s.time.day + LICENCE_DELIVERY_DAYS), s.time.day + LICENCE_DELIVERY_DAYS);
    ctx.log('company', `Data licence signed: ${fmtTok(t.tokensT)} tokens of ${t.domain} data (${LICENCE_TIERS[t.tier].label.toLowerCase()}), delivered in ${LICENCE_DELIVERY_DAYS} days.`, 1, t.domain);
  },
};

// ───────────────────────────── synthetic generation ─────────────────────────────

/** Default teacher for a job: the lab's version with the highest G. */
const strongest = (s: GameStateV2): ModelVersion | undefined =>
  s.player.models.versions.reduce<ModelVersion | undefined>((a, v) => (v.build && (!a?.build || gOfBuild(v.build) > gOfBuild(a.build)) ? v : a), undefined);
/** A job's terms: teacher, share of the pool, days, its H100e-days and kept tokens, and the default teacher's tokens on
 *  the same compute. */
export function synJobTerms(s: GameStateV2, p: P) {
  const teacher = (typeof p.teacher === 'string' ? versionById(s, p.teacher) : undefined) ?? strongest(s) ?? synTeacher(s);
  const share = clamp(num(p, 'share', SYN_JOB.share), 0, 1);
  const days = Math.round(clamp(num(p, 'days', SYN_JOB.days), 0, SYN_JOB.maxDays));
  const h100eDays = synPoolH100e(s) * share * days;
  const dflt = synTeacher(s);
  return { teacher, share, days, h100eDays, tokensT: synTokensT(teacher, h100eDays), defaultTokensT: synTokensT(dflt, h100eDays), dflt };
}

const SYNTHESIZE: ActionDef = {
  id: 'data.synthesize', verb: 'train', system: 'models', sphere: 'models', owner: 'WS1', title: 'Generate data',
  available: (s) => (active(s) === true ? (s.player.models.versions.length ? true : 'No model to teach') : active(s)),
  preview(s, p) {
    const j = synJobTerms(s, p);
    if (j.days === 0) {
      const cur = s.player.dataPortfolio.synJob;
      return pv([L('compute', 0, cur ? `data generation goes back to ${j.dflt?.name ?? 'the default teacher'}` : 'no job running', { unit: 'M H100e-days' })], [L('progress', 0, 'stop the generation job', { unit: UNIQUE_T })]);
    }
    const a = synAssetFor(s, j.teacher, j.tokensT);
    const dflt = synAssetFor(s, j.dflt, j.defaultTokensT);
    const d = dataDelta(s, (x) => addAsset(x, a), 'CODE');
    const dD = dataDelta(s, (x) => addAsset(x, dflt), 'CODE');
    return pv(
      [L('compute', -r2(j.h100eDays / 1e6), `${Math.round(j.share * 100)}% of data generation compute for ${j.days} d`, { unit: 'M H100e-days' })],
      [L('progress', r2(d.u[1] - d.u[0]), `${fmtTok(j.tokensT)} tokens from ${j.teacher?.name ?? 'the start model'} at quality ${a.quality.toFixed(2)} (default ${j.dflt?.name ?? '–'}: ${fmtTok(j.defaultTokensT)} at quality ${dflt.quality.toFixed(2)}, unique +${(dD.u[1] - dD.u[0]).toFixed(1)}T): ${dataDeltaText(d)}`, { unit: UNIQUE_T })],
      [L('alignment', 0, `the data carries ${j.teacher?.name ?? 'its teacher'}'s traits into bases trained on it`)],
    );
  },
  apply(s, ctx, p) {
    const j = synJobTerms(s, p);
    const pf = s.player.dataPortfolio;
    if (j.days === 0) {
      if (!pf.synJob) throw new Error('No generation job running');
      delete pf.synJob;
      ctx.log('research', 'Data generation goes back to the default teacher.', 1);
      return;
    }
    if (!j.teacher) throw new Error('No teacher model');
    pf.synJob = { teacherId: j.teacher.id, share: j.share, until: s.time.day + j.days };
    ctx.log('research', `${Math.round(j.share * 100)}% of data generation compute writes data with ${j.teacher.name} for ${j.days} days.`, 1, j.teacher.id);
  },
};

// ───────────────────────────── usage-data policy ─────────────────────────────

/** The policy level a usage share reads as (the nearest level). */
export function usageLevelOf(share: number): UsageLevel {
  return (Object.keys(USAGE_LEVELS) as UsageLevel[]).reduce((a, k) => (Math.abs(USAGE_LEVELS[k].share - share) < Math.abs(USAGE_LEVELS[a].share - share) ? k : a), 'standard');
}
const levelParam = (s: GameStateV2, p: P): UsageLevel => {
  if (typeof p.level === 'string' && p.level in USAGE_LEVELS) return p.level as UsageLevel;
  return usageLevelOf(s.player.dataPortfolio.usageShare) === 'standard' ? 'broad' : 'standard';
};
const USAGE_DOMAIN = (Object.entries(USAGE_MIX.consumer ?? {}) as [DomainId, number][]).reduce((a, x) => (x[1] > a[1] ? x : a), ['SOCIAL', 0] as [DomainId, number])[0];

const USAGE: ActionDef = {
  id: 'data.usagePolicy', verb: 'policy', system: 'products', sphere: 'models', owner: 'WS1', title: 'Usage-data policy',
  available: active,
  preview(s, p) {
    const lvl = levelParam(s, p);
    const cur = usageLevelOf(s.player.dataPortfolio.usageShare);
    const now = usageRateAt(s, USAGE_LEVELS[cur].share);
    const next = usageRateAt(s, USAGE_LEVELS[lvl].share);
    const yearT = 365 * (next - now);
    const d = dataDelta(s, (x: DataPortfolio) => {
      const a = x.assets.find((y) => y.kind === 'usage');
      if (a && a.kind !== 'public') a.tokensT = Math.max(0, a.tokensT + yearT);
      else if (yearT > 0) addAsset(x, { id: 'usage', kind: 'usage', tokensT: yearT, mix: { ...(USAGE_MIX.consumer ?? {}) }, quality: 0.5 });
    }, USAGE_DOMAIN);
    const usageLine = L('progress', r2(d.u[1] - d.u[0]), `usage data ${(now * 1000).toFixed(1)} → ${(next * 1000).toFixed(1)}B tokens/day (a year at today's traffic: ${dataDeltaText(d)})`, { unit: `${UNIQUE_T} a year` });
    if (lvl === cur) return pv([L('progress', 0, `already ${USAGE_LEVELS[lvl].label.toLowerCase()}`, { unit: UNIQUE_T })]);
    return next > now ? pv([], [usageLine]) : pv([{ ...usageLine, amount: -Math.abs(usageLine.amount) }]);
  },
  apply(s, ctx, p) {
    const lvl = levelParam(s, p);
    const pf = s.player.dataPortfolio;
    const cur = usageLevelOf(pf.usageShare);
    if (lvl === cur) throw new Error(`Already ${USAGE_LEVELS[lvl].label.toLowerCase()}`);
    pf.usageShare = USAGE_LEVELS[lvl].share;
    ctx.log('company', `Usage-data policy: ${USAGE_LEVELS[lvl].label.toLowerCase()} (${Math.round(USAGE_LEVELS[lvl].share * 100)}% of eligible chats kept for training).`, 1);
  },
};

export const DATA_ACTIONS: ActionDef[] = [LICENSE, SYNTHESIZE, USAGE];
