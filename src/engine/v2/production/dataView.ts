// Output-only selectors for the Data view (model v3 D4: Models › Data, and the Blueprint's drawn-mix row). No state is
// written: every "after" is read from a copy of the portfolio (dataDelta) or from the action terms. Owner: WS1.
import { LICENCE_DELIVERY_DAYS, LICENCE_TIERS, PUBLIC_WEB, USAGE_LEVELS, USAGE_QUALITY, type DomainMix, type LicenceTier, type UsageLevel } from '../../../data/v2/dataAssets';
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import { BASE_DATA, REFERENCE_BASE } from '../../../data/v2/runDesign';
import { RL_FAMILY_LABEL } from '../../../data/v2/suites';
import { gOfBuild, gV0 } from '../models/capability';
import { versionById } from '../models/labs';
import type { DataKind, DomainId, GameStateV2, ModelVersion, RLFamily } from '../types';
import {
  addAsset, dataDelta, drawData, expertStockT, licenceAsset, NATURAL_MIX, portfolioByKind, portfolioU, pretrainMix, publicUse, REF_SHARE, synAssetFor,
  synPoolH100e, syntheticQuality, synTeacher, synTokensT, unlicensedPublicT, usageRateAt, type DataDelta, type DataDraw, type KindRow, type MixTarget,
} from './data';
import { expertTerms, licenceTerms, synJobTerms, usageLevelOf } from './dataActions';

type P = Record<string, number | string | boolean>;
/** Tokens of the lab's latest base design (the size the natural-mix and delta readouts use). */
function latestTokens(s: GameStateV2) {
  const b = s.player.models.bases[s.player.models.bases.length - 1]?.design;
  return b ? b.params * b.tpp : REFERENCE_BASE.params * REFERENCE_BASE.tpp;
}

export interface PendingView { kind: DataKind; domain?: DomainId; tokensT: number; quality: number; due: number; label: string }
export interface DataPortfolioView {
  /** Quality-weighted unique tokens U (T) and raw pretraining tokens (T). */
  uT: number;
  tokensT: number;
  rows: KindRow[];
  pending: PendingView[];
  /** Today's flows (T/day): usage at the policy, synthetic from the pool (job teacher + default). */
  usagePerDayT: number;
  synPerDayT: number;
  synPoolH100e: number;
  defaultTeacher?: string;
  /** The public crawl: coverage of the shared world stock, licensed or not. */
  crawl: { coverage: number; stockT: number; licensed: boolean; unlicensedT: number };
  /** Expert data bought by domain and not yet built into a suite (T), and the tokens held by suites (T). */
  expertUnbuilt: Partial<Record<DomainId, number>>;
  expertInSuitesT: number;
  usageLevel: UsageLevel;
}

/** The portfolio by kind with its pending deliveries and today's flows. */
export function dataPortfolioView(s: GameStateV2): DataPortfolioView {
  const p = s.player.dataPortfolio;
  const rows = portfolioByKind(p);
  const pending = (p.pending ?? []).map((d): PendingView => {
    const a = d.asset;
    const tier = a.kind === 'licensed' ? (Object.entries(LICENCE_TIERS) as [LicenceTier, (typeof LICENCE_TIERS)[LicenceTier]][]).find(([, t]) => t.quality === a.quality)?.[1].label : undefined;
    return { kind: a.kind, domain: a.domain, tokensT: a.tokensT, quality: a.quality, due: d.due, label: a.kind === 'expert' ? 'Expert data' : (tier ?? 'Licensed') };
  });
  const job = p.synJob;
  const pool = synPoolH100e(s);
  const jobT = job ? versionById(s, job.teacherId) : undefined;
  const f = job && jobT ? Math.min(1, Math.max(0, job.share)) : 0;
  const synPerDayT = synTokensT(jobT, pool * f) + synTokensT(synTeacher(s), pool * (1 - f));
  const pub = publicUse(p);
  const expertUnbuilt: Partial<Record<DomainId, number>> = {};
  let inSuites = 0;
  for (const a of p.assets) {
    if (a.kind !== 'expert') continue;
    if (a.id.startsWith('expert:dom:') && a.domain) expertUnbuilt[a.domain] = (expertUnbuilt[a.domain] ?? 0) + a.tokensT;
    else inSuites += a.tokensT;
  }
  return {
    uT: portfolioU(p) / 1e12,
    tokensT: rows.filter((r) => r.kind !== 'expert').reduce((a, r) => a + r.tokensT, 0),
    rows, pending,
    usagePerDayT: usageRateAt(s, p.usageShare),
    synPerDayT, synPoolH100e: pool, defaultTeacher: synTeacher(s)?.name,
    crawl: { coverage: pub ? Math.min(1, Math.max(0, pub.coverage)) : 0, stockT: PUBLIC_WEB.stockT, licensed: !!pub?.licensed, unlicensedT: unlicensedPublicT(p) },
    expertUnbuilt, expertInSuitesT: inSuites,
    usageLevel: usageLevelOf(p.usageShare),
  };
}

export interface DomainMixRow { domain: DomainId; share: number; ref: number; s: number }
/** The portfolio's natural mix (quality-weighted shares of the pretraining stock) against the reference shares, and the
 *  specialisation a natural-mix base of the latest base's size would get (where the stock drifts). */
export function naturalMixView(s: GameStateV2): DomainMixRow[] {
  const p = s.player.dataPortfolio;
  const nat = drawData(p, latestTokens(s), NATURAL_MIX);
  const mix = pretrainMix(p);
  return DOMAIN_IDS.map((d) => ({ domain: d, share: mix[d] ?? 0, ref: REF_SHARE[d] ?? 0, s: nat.sD[d] ?? 0 }));
}

export interface DrawDomainRow { domain: DomainId; share: number; effShare: number; ref: number; s: number; epochs: number }
/** A draw by domain (the Blueprint's drawn-mix row): drawn and effective shares vs the reference, specialisation, and
 *  each domain's epochs (its most-repeated slice's drawn tokens ÷ that slice's own tokens, the D11 count that
 *  Muennighoff reads). */
export function drawByDomain(_s: GameStateV2, draw: DataDraw): { rows: DrawDomainRow[]; most?: DrawDomainRow } {
  const ep: DomainMix = draw.epochsD ?? {}; // a draw saved before F6 has none
  const rows = DOMAIN_IDS.map((d): DrawDomainRow => {
    return { domain: d, share: draw.share[d] ?? 0, effShare: draw.effShare[d] ?? 0, ref: REF_SHARE[d] ?? 0, s: draw.sD[d] ?? 0, epochs: ep[d] ?? 0 };
  });
  const most = rows.reduce<DrawDomainRow | undefined>((a, r) => (!a || r.epochs > a.epochs ? r : a), undefined);
  return { rows, most };
}
/** A preset's mix target (Blueprint tooltips). */
export const mixTargetOf = (preset: string): MixTarget | undefined => BASE_DATA[preset as keyof typeof BASE_DATA];

// ───────── action forms (structured before → after) ─────────

export interface LicenceForm { web: boolean; domain: DomainId; tier: LicenceTier; tokensT: number; cashB: number; quality: number; priceBPerT: number; days: number; delta?: DataDelta; licensed: boolean; unlicensedT: number }
export function licenceForm(s: GameStateV2, p: P): LicenceForm {
  const t = licenceTerms(s, p);
  const tier = LICENCE_TIERS[t.tier];
  const pub = publicUse(s.player.dataPortfolio);
  return {
    ...t, quality: tier.quality, priceBPerT: tier.priceBPerT, days: LICENCE_DELIVERY_DAYS, licensed: !!pub?.licensed, unlicensedT: unlicensedPublicT(s.player.dataPortfolio),
    delta: t.web ? undefined : dataDelta(s, (x) => addAsset(x, licenceAsset(t.domain, t.tier, t.tokensT, s.time.day)), t.domain),
  };
}

export interface ExpertForm { domain: DomainId; tokensT: number; cashB: number; families: { id: RLFamily; label: string }[]; stockT: [number, number] }
export function expertForm(s: GameStateV2, p: P): ExpertForm {
  const t = expertTerms(s, p);
  const h = expertStockT(s.player.dataPortfolio, t.domain);
  return { domain: t.domain, tokensT: t.tokensT, cashB: t.cashB, families: t.families.map((f) => ({ id: f, label: RL_FAMILY_LABEL[f] })), stockT: [h, h + t.tokensT] };
}

export interface TeacherRow { id: string; name: string; g: number; quality: number; tokensPerH100eDay: number; weightedPerH100eDay: number; isDefault: boolean }
/** Every non-retired version as a teacher: G, the quality of its data, tokens and quality-weighted tokens per H100e-day. */
export function teacherRows(s: GameStateV2): TeacherRow[] {
  const g0 = gV0(s.hidden.timeline);
  const dflt = synTeacher(s)?.id;
  return s.player.models.versions.filter((v) => v.status !== 'retired' && v.build).map((v: ModelVersion) => {
    const g = gOfBuild(v.build!);
    const q = syntheticQuality(g, g0);
    const tok = synTokensT(v, 1) * 1e12;
    return { id: v.id, name: v.name, g, quality: q, tokensPerH100eDay: tok, weightedPerH100eDay: q * tok, isDefault: v.id === dflt };
  });
}
export interface SynForm {
  teacher?: string; teacherName?: string; share: number; days: number; h100eDays: number; tokensT: number; quality: number; defaultTokensT: number; defaultQuality: number;
  defaultName?: string; delta: DataDelta; defaultDelta: DataDelta; job?: { teacher: string; share: number; until: number };
}
export function synForm(s: GameStateV2, p: P): SynForm {
  const j = synJobTerms(s, p);
  const a = synAssetFor(s, j.teacher, j.tokensT);
  const b = synAssetFor(s, j.dflt, j.defaultTokensT);
  const job = s.player.dataPortfolio.synJob;
  return {
    teacher: j.teacher?.id, teacherName: j.teacher?.name, share: j.share, days: j.days, h100eDays: j.h100eDays, tokensT: j.tokensT, quality: a.quality,
    defaultTokensT: j.defaultTokensT, defaultQuality: b.quality, defaultName: j.dflt?.name,
    delta: dataDelta(s, (x) => addAsset(x, a), 'CODE'), defaultDelta: dataDelta(s, (x) => addAsset(x, b), 'CODE'),
    job: job ? { teacher: versionById(s, job.teacherId)?.name ?? job.teacherId, share: job.share, until: job.until } : undefined,
  };
}

export interface UsageLevelRow { level: UsageLevel; label: string; share: number; perDayT: number; civlib: number; current: boolean; yearUT: number }
/** The three usage-data levels: share kept, usage tokens per day at today's traffic, the Civil Liberties approval of
 *  the level and the unique tokens a year at that level adds (T). */
export function usageLevels(s: GameStateV2): UsageLevelRow[] {
  const cur = usageLevelOf(s.player.dataPortfolio.usageShare);
  const q = USAGE_QUALITY;
  return (Object.keys(USAGE_LEVELS) as UsageLevel[]).map((k) => {
    const perDay = usageRateAt(s, USAGE_LEVELS[k].share);
    return { level: k, label: USAGE_LEVELS[k].label, share: USAGE_LEVELS[k].share, perDayT: perDay, civlib: USAGE_LEVELS[k].civlib, current: k === cur, yearUT: 365 * perDay * q };
  });
}
export type { DomainMix };
