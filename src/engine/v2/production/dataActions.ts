// Data actions on the data portfolio (model v3 D2: design/MODEL-V3.md §9; numbers in data/v2/dataAssets.ts). Owner: WS1.
//
//   data.license      buy a licensed corpus in one domain at a price tier (q 1.5 / 2 / 3, research/20 A3), delivered
//                     later; domain 'web' licenses the public crawl instead (v2's blanket "License data": no tokens, ends
//                     the copyright-suit hazard, actors/china.ts)
//   data.synthesize   a share of the synthetic pool generates with a chosen teacher for some days (tokens from
//                     synTokensPerH100eDay, quality from the teacher's G, the asset inherits the teacher's traits);
//                     days 0 stops the job. The rest of the pool keeps the default teacher (the internal research model)
//   data.expert       buy expert data in one domain (for suites and, from D7, evaluations); a suite build of a family in
//                     that domain uses it before buying its own (models/suites.ts)
//   data.usagePolicy  none / standard / broad: the share of eligible product output kept as usage data, against the
//                     Civil Liberties bloc's approval
// Every preview shows the Blueprint's data readouts before → after (dataDelta: U, the domain's share of the stock and
// its specialisation, the latest base design's epochs).
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import {
  EXPERT_DELIVERY_DAYS, EXPERT_SIZE_T, LICENCE_DELIVERY_DAYS, LICENCE_SIZE_T, LICENCE_TIERS, SYN_JOB, USAGE_LEVELS, USAGE_MIX, WEB_LICENCE,
  type LicenceTier, type UsageLevel,
} from '../../../data/v2/dataAssets';
import { EXPERT_PRICE_B_PER_T, EXPERT_START_T, RL_FAMILY_LABEL } from '../../../data/v2/suites';
import { RL_FAMILY_IDS } from '../../../data/v2/runDesign';
import { bloc, L, pv } from '../actors/fx';
import { bookCash } from '../finance/ledger';
import { gOfBuild } from '../models/capability';
import { versionById } from '../models/labs';
import { familyDomain } from '../models/suites';
import type { ActionDef, DataPortfolio, DomainId, GameStateV2, ModelVersion } from '../types';
import {
  addAsset, dataDelta, dataDeltaText, expertDomainAsset, expertStockT, licenceAsset, publicUse, queueData, synAssetFor, synPoolH100e, synTeacher,
  synTokensT, unlicensedPublicT, usageRateAt,
} from './data';

type P = Record<string, number | string | boolean>;
const num = (p: P, k: string, d: number) => (typeof p[k] === 'number' ? (p[k] as number) : typeof p[k] === 'string' && p[k] !== '' && !Number.isNaN(Number(p[k])) ? Number(p[k]) : d);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const r2 = (x: number) => Math.round(x * 100) / 100;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const domainOf = (p: P, d: DomainId = 'CODE'): DomainId => (DOMAIN_IDS.includes(p.domain as DomainId) ? (p.domain as DomainId) : d);
const tierOf = (p: P): LicenceTier => (typeof p.tier === 'string' && p.tier in LICENCE_TIERS ? (p.tier as LicenceTier) : 'bulk');
const active = (s: GameStateV2) => (s.player.status === 'active' ? true : 'Company inactive');
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
      return pv([L('cash', -r2(t.cashB), `licence on ${unlicensedPublicT(s.player.dataPortfolio).toFixed(0)}T crawled tokens`)], [L('approval', WEB_LICENCE.creatives, 'bloc:creatives')], [L('cash', 0, 'copyright-suit hazard → 0')]);
    }
    const tier = LICENCE_TIERS[t.tier];
    const d = dataDelta(s, (x) => addAsset(x, licenceAsset(t.domain, t.tier, t.tokensT, s.time.day)), t.domain);
    return pv(
      [L('cash', -r2(t.cashB), `${fmtTok(t.tokensT)} ${t.domain} tokens at $${tier.priceBPerT}B/T, paid now`)],
      [L('progress', r2(d.u[1] - d.u[0]), `${tier.label} q ${tier.quality}, delivered in ${LICENCE_DELIVERY_DAYS} d: ${dataDeltaText(d)}`, { lagDays: LICENCE_DELIVERY_DAYS })],
    );
  },
  apply(s, ctx, p) {
    const why = licenceBlock(s, p);
    if (why) throw new Error(why);
    const t = licenceTerms(s, p);
    bookCash(s, ctx, -t.cashB, 'training', t.web ? 'licence on the web crawl' : 'data licence', t.web ? 'web' : t.domain);
    if (t.web) {
      publicUse(s.player.dataPortfolio)!.licensed = true;
      s.relations.dataLicences.push('web');
      bloc(s, ctx, 'creatives', WEB_LICENCE.creatives, 0, 'data.license web');
      ctx.log('company', 'You licensed the crawled web text from publishers and authors: no more copyright suits over it.', 2);
      return;
    }
    queueData(s.player.dataPortfolio, licenceAsset(t.domain, t.tier, t.tokensT, s.time.day + LICENCE_DELIVERY_DAYS), s.time.day + LICENCE_DELIVERY_DAYS);
    s.relations.dataLicences.push(`${t.domain}:${t.tier}`);
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
      return pv([L('compute', 0, cur ? `the pool goes back to ${j.dflt?.id ?? 'the default teacher'}` : 'no job running')], [L('progress', 0, 'stop the generation job')]);
    }
    const a = synAssetFor(s, j.teacher, j.tokensT);
    const dflt = synAssetFor(s, j.dflt, j.defaultTokensT);
    const d = dataDelta(s, (x) => addAsset(x, a), 'CODE');
    const dD = dataDelta(s, (x) => addAsset(x, dflt), 'CODE');
    return pv(
      [L('compute', -r2(j.h100eDays / 1e6), `M H100e-days: ${Math.round(j.share * 100)}% of the synthetic pool for ${j.days} d`)],
      [L('progress', r2(d.u[1] - d.u[0]), `${fmtTok(j.tokensT)} tokens from ${j.teacher?.id ?? 'the start model'} at q ${a.quality.toFixed(2)} (default ${j.dflt?.id ?? '–'}: ${fmtTok(j.defaultTokensT)} at q ${dflt.quality.toFixed(2)}, U +${(dD.u[1] - dD.u[0]).toFixed(1)}T): ${dataDeltaText(d)}`)],
      [L('alignment', 0, `the data carries ${j.teacher?.id ?? 'its teacher'}'s traits into bases trained on it`)],
    );
  },
  apply(s, ctx, p) {
    const j = synJobTerms(s, p);
    const pf = s.player.dataPortfolio;
    if (j.days === 0) {
      if (!pf.synJob) throw new Error('No generation job running');
      delete pf.synJob;
      ctx.log('research', 'The synthetic pool goes back to the default teacher.', 1);
      return;
    }
    if (!j.teacher) throw new Error('No teacher model');
    pf.synJob = { teacherId: j.teacher.id, share: j.share, until: s.time.day + j.days };
    ctx.log('research', `${Math.round(j.share * 100)}% of the synthetic pool generates data with ${j.teacher.id} for ${j.days} days.`, 1, j.teacher.id);
  },
};

// ───────────────────────────── expert data ─────────────────────────────

/** An expert order's terms: domain, tokens, cash, and the suite families in that domain (their builds use it). */
export function expertTerms(_s: GameStateV2, p: P) {
  const domain = domainOf(p);
  const tokensT = clamp(num(p, 'tokensT', EXPERT_START_T), EXPERT_SIZE_T.min, EXPERT_SIZE_T.max);
  return { domain, tokensT, cashB: tokensT * EXPERT_PRICE_B_PER_T, families: RL_FAMILY_IDS.filter((f) => familyDomain(f) === domain) };
}

const EXPERT: ActionDef = {
  id: 'data.expert', verb: 'deal', system: 'models', sphere: 'models', owner: 'WS1', title: 'Buy expert data',
  available: active,
  preview(s, p) {
    const t = expertTerms(s, p);
    const have = expertStockT(s.player.dataPortfolio, t.domain);
    const use = t.families.length ? `suite builds for ${t.families.map((f) => RL_FAMILY_LABEL[f]).join(', ')} use it before buying` : 'no suite family in this domain yet (evaluations, D7)';
    return pv(
      [L('cash', -r2(t.cashB), `${fmtTok(t.tokensT)} ${t.domain} expert tokens at $${EXPERT_PRICE_B_PER_T / 1000} a token`)],
      [L('progress', r3(t.tokensT * 1000), `B ${t.domain} expert tokens in ${EXPERT_DELIVERY_DAYS} d: ${fmtTok(have)} → ${fmtTok(have + t.tokensT)} unbuilt; ${use}`, { lagDays: EXPERT_DELIVERY_DAYS })],
    );
  },
  apply(s, ctx, p) {
    const t = expertTerms(s, p);
    if (t.cashB > s.player.finance.cash) throw new Error('Not enough cash');
    bookCash(s, ctx, -t.cashB, 'training', 'expert data', t.domain);
    queueData(s.player.dataPortfolio, expertDomainAsset(t.domain, t.tokensT, s.time.day + EXPERT_DELIVERY_DAYS), s.time.day + EXPERT_DELIVERY_DAYS);
    ctx.log('research', `Expert data ordered: ${fmtTok(t.tokensT)} tokens of ${t.domain} tasks and rubrics, delivered in ${EXPERT_DELIVERY_DAYS} days.`, 1, t.domain);
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
    const dApp = USAGE_LEVELS[lvl].civlib - USAGE_LEVELS[cur].civlib;
    const yearT = 365 * (next - now);
    const d = dataDelta(s, (x: DataPortfolio) => {
      const a = x.assets.find((y) => y.kind === 'usage');
      if (a && a.kind !== 'public') a.tokensT = Math.max(0, a.tokensT + yearT);
      else if (yearT > 0) addAsset(x, { id: 'usage', kind: 'usage', tokensT: yearT, mix: { ...(USAGE_MIX.consumer ?? {}) }, quality: 0.5 });
    }, USAGE_DOMAIN);
    const usageLine = L('progress', r2(d.u[1] - d.u[0]), `usage data ${(now * 1000).toFixed(1)} → ${(next * 1000).toFixed(1)}B tokens/day (a year at today's traffic: ${dataDeltaText(d)})`);
    const appLine = L('approval', Math.abs(dApp), 'bloc:civlib');
    if (lvl === cur) return pv([L('progress', 0, `already ${USAGE_LEVELS[lvl].label.toLowerCase()}`)]);
    return dApp < 0 ? pv([appLine], [usageLine], []) : pv([{ ...usageLine, amount: -Math.abs(usageLine.amount) }], [appLine]);
  },
  apply(s, ctx, p) {
    const lvl = levelParam(s, p);
    const pf = s.player.dataPortfolio;
    const cur = usageLevelOf(pf.usageShare);
    if (lvl === cur) throw new Error(`Already ${USAGE_LEVELS[lvl].label.toLowerCase()}`);
    pf.usageShare = USAGE_LEVELS[lvl].share;
    bloc(s, ctx, 'civlib', USAGE_LEVELS[lvl].civlib - USAGE_LEVELS[cur].civlib, 0, 'usage-data policy');
    ctx.log('company', `Usage-data policy: ${USAGE_LEVELS[lvl].label.toLowerCase()} (${Math.round(USAGE_LEVELS[lvl].share * 100)}% of eligible chats kept for training).`, 1);
  },
};

export const DATA_ACTIONS: ActionDef[] = [LICENSE, SYNTHESIZE, EXPERT, USAGE];
