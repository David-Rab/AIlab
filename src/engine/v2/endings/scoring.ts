// Five-axis scores and verdict (V2-SPEC §5.3). Owner: WS4. Non-judgemental: the verdict is for bots and statistics only.
import { clamp } from '../../rng';
import { bestG, otherLabs } from '../models/labs';
import type { EndingV2, GameStateV2, LabId, PowerOutcome } from '../types';
import { lagDays } from '../models/capability';
import { ws4r } from '../actors/state';
import { pMisOf, projectedMisAtAsi } from './epilogue';
import { lawsInForce } from '../../../data/v2/laws';

export const COMPANY_LOSS: EndingV2['id'][] = ['insolvent', 'ousted', 'nationalized', 'acquired'];

const SURVIVAL_BASE: Partial<Record<EndingV2['id'], number>> = {
  asiAligned: 95, rivalAligned: 85, chinaAligned: 70, asiContested: 45, catastropheCyber: 50, war: 30, catastropheBio: 25, rogue: 10,
  asiTakeover: 3, rivalTakeover: 3, chinaTakeover: 3,
};

const FREEDOM_BASE: Record<PowerOutcome, number> = { democratic: 85, treaty: 75, multipolar: 65, committee: 60, government: 40, corporate: 35, beijing: 15, none: 10 };
const FREEDOM_NONE: Partial<Record<EndingV2['id'], number>> = { asiTakeover: 5, rivalTakeover: 5, chinaTakeover: 5, rogue: 10, war: 30, catastropheBio: 40, catastropheCyber: 45, asiContested: 35 };

/** Prosperity of the world each ending leads to (rough), before power and the economy at the end. */
const PROSPERITY_BASE: Partial<Record<EndingV2['id'], number>> = {
  asiAligned: 80, rivalAligned: 70, chinaAligned: 55, asiContested: 40, catastropheCyber: 30, war: 20, catastropheBio: 20, rogue: 15,
  asiTakeover: 5, rivalTakeover: 5, chinaTakeover: 5,
};
/** Who holds an aligned superintelligence: how widely its abundance is shared. */
const PROSPERITY_POWER: Record<PowerOutcome, number> = { democratic: 10, treaty: 5, multipolar: 5, committee: 0, government: -5, corporate: -10, beijing: -10, none: 0 };

/** Epilogue survival: 100·(1 − Σ_X w_X·P_mis(X)) over active labs, w_X ∝ exp(−leadBehindLeader/180 d); the lead behind
 *  the leader is the one lead clock lagDays (RD-L02, DD-10: no progress-year pace, no (1 − share) term). */
export function epilogueSurvival(s: GameStateV2): number {
  const ids: LabId[] = [...otherLabs(s).filter((r) => r.core.status === 'active').map((r) => r.core.id)];
  if (s.player.status === 'active') ids.push('player');
  if (!ids.length) return 50;
  let leader = ids[0];
  for (const id of ids) if (bestG(s, id) > bestG(s, leader)) leader = id;
  let wsum = 0;
  let acc = 0;
  for (const id of ids) {
    const behind = Math.max(0, lagDays(s, id, leader));
    const w = Math.exp(-behind / 180);
    wsum += w;
    acc += w * pMisOf(s, projectedMisAtAsi(s, id).mis);
  }
  return clamp(100 * (1 - acc / wsum), 0, 100);
}

function transparencyKept(s: GameStateV2): number {
  const kinds = ['framework', 'testingAgreement', 'voluntaryAccord', 'whistleblower', 'monitorabilityPledge'];
  return s.commitments.filter((c) => kinds.includes(c.kind) && (c.status === 'live' || c.status === 'kept')).length;
}

export type ScoreKey = 'survival' | 'freedom' | 'prosperity' | 'company' | 'geopolitics';
export const SCORE_KEYS: ScoreKey[] = ['survival', 'freedom', 'prosperity', 'company', 'geopolitics'];
/** One signed contribution to a score (the end screen's score tooltips list them). */
export interface ScoreTerm { label: string; value: number }

const POWER_LABEL: Record<PowerOutcome, string> = {
  democratic: 'democratic control', treaty: 'a verified treaty', multipolar: 'several powers', committee: 'an oversight committee',
  government: 'the government', corporate: 'one company', beijing: 'Beijing', none: 'no one',
};

/** The terms of each score (§5.3); a score is round(clamp(Σ terms, 0, 100)) (scoreOf). `power` is the ending's power
 *  outcome (epilogue power for company-loss/overtaken). */
export function scoreTerms(s: GameStateV2, id: EndingV2['id'], power: PowerOutcome = 'none'): Record<ScoreKey, ScoreTerm[]> {
  const w = ws4r(s);
  const lossLike = COMPANY_LOSS.includes(id) || id === 'overtaken' || id === 'retired';
  // Survival
  const sBase = SURVIVAL_BASE[id];
  const survival: ScoreTerm[] = [sBase !== undefined ? { label: 'This ending', value: sBase }
    : lossLike ? { label: 'Odds the labs still racing keep control', value: epilogueSurvival(s) } : { label: 'This ending', value: 50 }];
  // Freedom
  const freedom: ScoreTerm[] = [power !== 'none' ? { label: `Power held by ${POWER_LABEL[power]}`, value: FREEDOM_BASE[power] } : { label: 'This ending', value: FREEDOM_NONE[id] ?? FREEDOM_BASE.none }];
  if ((s.world.control.MIL?.tiers[3] ?? 0) > 0.1) freedom.push({ label: 'AI makes military decisions', value: -10 });
  const kept = transparencyKept(s);
  if (kept) freedom.push({ label: `Transparency commitments kept (${kept})`, value: Math.min(15, 5 * kept) });
  // Prosperity: the world the ending leads to (a rough judgement table, as Survival's), moved by who holds power and
  // by the economy at the end. By ASI the simulated economy has barely moved, so the economy terms alone cannot
  // spread the score (2026-11-24 end-screen audit: 50 in every ending).
  const m = s.world.macro.US;
  const gdp0 = w.gdp0 || m.gdp;
  const fund = s.player.policies.transitionFund >= 20;
  const ubi = lawsInForce(s).ubi;
  // Leaving the race: an aligned projected winner (power set) shares its abundance; otherwise scale with survival.
  const base = PROSPERITY_BASE[id] ?? (lossLike ? (power !== 'none' ? 65 : 10 + 0.4 * survival[0].value) : 50);
  const prosperity: ScoreTerm[] = [{ label: 'This ending', value: base }];
  if (PROSPERITY_POWER[power]) prosperity.push({ label: `Power held by ${POWER_LABEL[power]}`, value: PROSPERITY_POWER[power] });
  prosperity.push(
    { label: 'GDP growth since the start', value: (25 * Math.log2(Math.max(1e-6, m.gdp / gdp0))) / Math.log2(3) },
    { label: 'Unemployment', value: -3 * (s.world.unemployment.US - 4.3) },
  );
  if (fund) prosperity.push({ label: 'Transition fund', value: 10 });
  if (ubi) prosperity.push({ label: 'Basic income', value: 10 });
  // Company
  let company: ScoreTerm[];
  if (COMPANY_LOSS.includes(id)) company = [{ label: 'You lost the company', value: 10 }];
  else if (id === 'overtaken') company = [{ label: 'Overtaken', value: 15 }];
  else {
    const V = Math.max(1, s.player.finance.valuation);
    const playerFirst = id === 'asiAligned' || id === 'asiTakeover' || (id === 'asiContested' && !otherLabs(s).some((r) => r.core.milestoneDays[6] !== undefined && r.core.milestoneDays[6]! <= (s.player.milestoneDays[6] ?? Infinity)));
    const independent = !s.usgov.oversight && s.usgov.consolidated !== 'nationalized' && !w.dpaAccepted && !w.soldControl;
    company = [{ label: 'Valuation', value: 20 * Math.log10(V / 100) }];
    if (playerFirst) company.push({ label: 'First to superintelligence', value: 40 });
    if (independent) company.push({ label: 'Independent at the end', value: 20 });
  }
  // Geopolitics
  const leadChina = s.china.lab.core.status === 'active' ? lagDays(s, 'china', 'player') : 180;
  const geopolitics: ScoreTerm[] = [{ label: 'Starting point', value: 50 }, { label: leadChina >= 0 ? 'Lead over China' : 'Behind China', value: clamp(leadChina / 6, -30, 30) }];
  if (s.flags['ws4:taiwanEver']) geopolitics.push({ label: 'Taiwan crisis', value: -15 });
  return { survival, freedom, prosperity, company, geopolitics };
}

/** Σ of a score's terms, before the 0–100 clamp and rounding. */
export const termSum = (ts: ScoreTerm[]) => ts.reduce((a, t) => a + t.value, 0);
/** A score from its terms: round(clamp(Σ, 0, 100)). */
export const scoreOf = (ts: ScoreTerm[]) => Math.round(clamp(termSum(ts), 0, 100));

/** Scores 0–100 per axis (§5.3): each the clamped, rounded sum of its terms (scoreTerms). */
export function scoreEnding(s: GameStateV2, id: EndingV2['id'], power: PowerOutcome = 'none'): EndingV2['scores'] {
  const t = scoreTerms(s, id, power);
  return { survival: scoreOf(t.survival), freedom: scoreOf(t.freedom), prosperity: scoreOf(t.prosperity), company: scoreOf(t.company), geopolitics: scoreOf(t.geopolitics) };
}

/** Bot verdict (never shown as a moral grade). */
export function verdictOf(sc: EndingV2['scores']): EndingV2['verdict'] {
  if (sc.survival < 40 || sc.company < 15) return 'loss';
  if (sc.survival >= 70 && sc.company >= 40 && sc.freedom >= 40) return 'win';
  return 'mixed';
}
