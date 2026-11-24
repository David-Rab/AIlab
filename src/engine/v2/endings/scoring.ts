// Five-axis scores and verdict (V2-SPEC §5.3). Owner: WS4. Non-judgemental: the verdict is for bots and statistics only.
import { clamp } from '../../rng';
import { bestG, otherLabs } from '../models/labs';
import type { EndingV2, GameStateV2, LabId, PowerOutcome } from '../types';
import { lagDays } from '../models/capability';
import { ws4r } from '../actors/state';
import { pMisOf, projectedMisAtAsi } from './epilogue';

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

/** Scores 0–100 per axis (§5.3). `power` is the ending's power outcome (epilogue power for company-loss/overtaken). */
export function scoreEnding(s: GameStateV2, id: EndingV2['id'], power: PowerOutcome = 'none'): EndingV2['scores'] {
  const w = ws4r(s);
  const lossLike = COMPANY_LOSS.includes(id) || id === 'overtaken' || id === 'retired';
  // Survival
  const survival = SURVIVAL_BASE[id] ?? (lossLike ? epilogueSurvival(s) : 50);
  // Freedom
  let freedom = power !== 'none' ? FREEDOM_BASE[power] : FREEDOM_NONE[id] ?? FREEDOM_BASE.none;
  if (w.unrestrictedDefense) freedom -= 10;
  if ((s.world.control.MIL?.tiers[3] ?? 0) > 0.1) freedom -= 10;
  freedom += Math.min(15, 5 * transparencyKept(s));
  if (s.world.intelligenceCurse) freedom -= 15;
  // Prosperity: the world the ending leads to (a rough judgement table, as Survival's), moved by who holds power and
  // by the economy at the end. By ASI the simulated economy has barely moved, so the economy terms alone cannot
  // spread the score (2026-11-24 end-screen audit: 50 in every ending).
  const m = s.world.macro.US;
  const gdp0 = w.gdp0 || m.gdp;
  const ubi = s.player.policies.transitionFund >= 20 || !!s.flags['ws4:ubi'];
  const economy = (25 * Math.log2(Math.max(1e-6, m.gdp / gdp0))) / Math.log2(3) - 3 * (s.world.unemployment.US - 4.3) - 100 * (m.gini - 0.48) + (ubi ? 10 : 0);
  // Leaving the race: an aligned projected winner (power set) shares its abundance; otherwise scale with survival.
  const base = PROSPERITY_BASE[id] ?? (lossLike ? (power !== 'none' ? 65 : 10 + 0.4 * survival) : 50);
  const prosperity = base + PROSPERITY_POWER[power] + economy;
  // Company
  let company: number;
  if (COMPANY_LOSS.includes(id)) company = 10;
  else if (id === 'overtaken') company = 15;
  else {
    const V = Math.max(1, s.player.finance.valuation);
    const playerFirst = id === 'asiAligned' || id === 'asiTakeover' || (id === 'asiContested' && !otherLabs(s).some((r) => r.core.milestoneDays[6] !== undefined && r.core.milestoneDays[6]! <= (s.player.milestoneDays[6] ?? Infinity)));
    const independent = !s.gov.oversight && !w.dpaAccepted && !w.nationalizedHard && !w.soldControl;
    company = 20 * Math.log10(V / 100) + (playerFirst ? 40 : 0) + (independent ? 20 : 0);
  }
  // Geopolitics
  const leadChina = s.china.lab.core.status === 'active' ? lagDays(s, 'china', 'player') : 180;
  const geo = 50 + clamp(leadChina / 6, -30, 30) + (s.gov.treaty === 'verified' ? 25 : 0) - (id === 'war' ? 30 : 0) - (s.flags['ws4:taiwanEver'] ? 15 : 0) - (s.china.rung >= 5 ? 10 : 0);
  const r = (x: number) => Math.round(clamp(x, 0, 100));
  return { survival: r(survival), freedom: r(freedom), prosperity: r(prosperity), company: r(company), geopolitics: r(geo) };
}

/** Bot verdict (never shown as a moral grade). */
export function verdictOf(sc: EndingV2['scores']): EndingV2['verdict'] {
  if (sc.survival < 40 || sc.company < 15) return 'loss';
  if (sc.survival >= 70 && sc.company >= 40 && sc.freedom >= 40) return 'win';
  return 'mixed';
}
