// US government: meters, G-SEC / G-CHN ladders, statutes, nationalisation (V2-SPEC §3.10.1; research/07 §1.1). Owner: WS4.
import { GOV_PRESETS } from '../../../data/actors';
import { clamp } from '../../rng';
import { dateOf, dayOfDate } from '../core/time';
import { bestLg, internalVersion } from '../models/labs';
import { wslFloor } from '../security/security';
import type { GameStateV2, GovActor, SystemCtx } from '../types';
import { policyPressure } from './blocs';
import { drift, trust } from './fx';
import { request, ws4 } from './state';

export const govPresetOf = (id: string) => GOV_PRESETS.find((p) => p.id === id) ?? GOV_PRESETS[0];

/** Government at Jul 2025 (research/07 §1.1 start column). Statutes switch on by date (SB 53: 2026-01-01). */
export function initialGov(presetId: string): GovActor {
  const p = govPresetOf(presetId);
  return {
    preset: p.id,
    aiPriority: 55, regStance: -60, securityDemand: 15, hawkishness: Math.round(50 * p.hawk),
    nationalization: 0, congressActivism: 20, stateRegPressure: 35, judicialCheck: 40,
    awareness: 30,
    congressControl: 'R',
    rungSec: 0, rungChn: 0,
    oversight: false, treaty: 'none',
    statutes: { sb53: false, raise: false, euCode: false, federalLicensing: false, preemption: false },
    holdDays: {},
    lastActionDay: {},
  };
}

/** Best measured level among the player's external deployments (what the player has publicly claimed). */
export function claimedL(s: GameStateV2): number {
  let L = 0;
  for (const d of s.player.deployments) {
    if (d.status !== 'live' || d.channel === 'internal') continue;
    const v = s.player.models.versions.find((x) => x.id === d.versionId);
    L = Math.max(L, v?.evals.measuredL ?? 0);
  }
  return L;
}

/** What the government sees (§3.10.1): max(announced, leaked, evaluator-reported, briefed), never truth. */
export function govSeenL(s: GameStateV2): number {
  const w = ws4(s);
  const measured = internalVersion(s)?.evals.measuredL ?? 0;
  const b = s.player.policies.govBriefing;
  const briefed = b >= 2 ? measured : b === 1 ? measured - 1 : 0;
  const evalSeen = s.relations.stocks.evalGov.access >= 3 ? measured : 0;
  return Math.max(w.claimedL, w.leakedL, w.evalL, briefed, evalSeen);
}

/** AI R&D multiplier as seen by government (full at briefing 3 or evaluator rung ≥ 3). */
export function govSeenM(s: GameStateV2): number {
  const M = s.player.prodCache?.M ?? 1;
  const b = s.player.policies.govBriefing;
  if (b >= 3 || s.relations.stocks.evalGov.access >= 3) return M;
  return 1 + (M - 1) * (b >= 2 ? 0.7 : 0.3);
}

const detectedThefts = (s: GameStateV2) => s.player.security.detectedThefts.length;

/** Ladder helper: a condition must hold `hold` consecutive days to climb one rung. */
function holdCheck(g: GovActor, key: string, cond: boolean, hold = 14): boolean {
  if (!cond) {
    delete g.holdDays[key];
    return false;
  }
  g.holdDays[key] = (g.holdDays[key] ?? 0) + 1;
  if (g.holdDays[key] >= hold) {
    delete g.holdDays[key];
    return true;
  }
  return false;
}

const SEC_TEXT = [
  '',
  'Defense contracts now carry security clauses for frontier labs.',
  'Officials are embedded in your security team.',
  'Clearances are now required for frontier work.',
  'Employee monitoring and a DPA contingency plan are in force.',
  'The government moves to take a seat at your table.',
];

/** Daily government step: seen capability, priority, security demand, ladders, statutes, nationalisation. */
export function govDaily(s: GameStateV2, ctx: SystemCtx) {
  const g = s.gov;
  const pre = govPresetOf(g.preset);
  const w = ws4(s);
  const G = g as unknown as Record<string, number>;
  const day = ctx.day;
  w.claimedL = Math.max(w.claimedL, claimedL(s));
  const seenL = govSeenL(s);
  w.govSeenL = seenL;
  const seenM = govSeenM(s);
  const trueL = bestLg(s, 'player');

  drift(s, G, 'awareness', (clamp(100 - 30 * Math.max(0, trueL - seenL), 0, 100) - g.awareness) * 0.02, 0, 100, 'gov.awareness');
  const prioT = clamp((55 + 7 * Math.max(0, seenL - 5) + 10 * detectedThefts(s) + (s.pub.salience > 10 ? 10 : 0)) * Math.sqrt(pre.accel), 0, 100);
  drift(s, G, 'aiPriority', (prioT - g.aiPriority) * 0.01, 0, 100, 'gov.aiPriority');
  // Security demand: rises with seen capability, thefts and the China ladder; access speeds it up (§3.9.3 rule 4).
  const a1 = s.commitments.some((c) => c.status === 'live' && c.kind === 'testingAgreement');
  const secT = clamp((15 + 9 * Math.max(0, seenL - 5.5) + 15 * detectedThefts(s) + 5 * g.rungChn + (seenM >= 10 ? 20 : 0)) * pre.security, 0, 100);
  const k = secT > g.securityDemand ? 0.01 * (1 + 0.5 * (a1 ? 1 : 0) + 0.2 * s.player.policies.govBriefing) : 0.003;
  drift(s, G, 'securityDemand', (secT - g.securityDemand) * k, 0, 100, 'gov.securityDemand');
  // China hawkishness.
  const hawkT = clamp(50 * pre.hawk * (1 + 0.1 * s.china.rung) + 10 * detectedThefts(s), 0, 100);
  drift(s, G, 'hawkishness', (hawkT - g.hawkishness) * 0.005, 0, 100, 'gov.hawkishness');
  // Nationalisation pressure: builds at G-SEC ≥ 4 when trust is low or a misalignment leak meets public concern.
  const tr = s.relations.stocks.exec.trust;
  let dNat = -0.01;
  if (g.rungSec >= 4) dNat = 0.03 * (1 + (60 - tr) / 40);
  if (w.misalignmentLeak && s.pub.concern > 65) dNat += 0.05;
  drift(s, G, 'nationalization', dNat, 0, 100, 'gov.nationalization');
  // Congress activism (G-REG): opposition Congress + concern > 60 → +2/week.
  const opp = g.congressControl === 'D';
  drift(s, G, 'congressActivism', s.pub.concern > 60 && opp ? 2 / 7 : (20 - g.congressActivism) * 0.003, 0, 100, 'gov.congressActivism');
  drift(s, G, 'stateRegPressure', ((g.statutes.preemption ? 15 : 35 + 0.3 * (s.pub.concern - 50)) - g.stateRegPressure) * 0.003, 0, 100, 'gov.stateRegPressure');

  // ── G-SEC ladder (research/07; multipliers/levels instead of model names, §3.10.1).
  const cond = [
    false,
    (seenL >= 6.5 || seenM >= 1.5) && g.aiPriority > 60,
    detectedThefts(s) >= 1 || (seenL >= 8.5 && s.player.policies.govBriefing >= 1),
    (seenL >= 10 && s.player.policies.govBriefing >= 1) || g.securityDemand > 70,
    seenM >= 10 || detectedThefts(s) >= 2,
    (w.misalignmentLeak && s.pub.concern > 65) || g.nationalization > pre.natThreshold,
  ];
  if (g.rungSec < 5 && holdCheck(g, `sec${g.rungSec + 1}`, cond[g.rungSec + 1], Math.max(7, Math.round(pre.lag * 0.7)))) {
    g.rungSec = (g.rungSec + 1) as GovActor['rungSec'];
    ctx.log('gov', SEC_TEXT[g.rungSec], 3);
    ctx.cause('gov.rungSec', 1, 'G-SEC ladder');
    if (g.rungSec === 2) g.aiPriority = Math.max(g.aiPriority, 85);
    if (g.rungSec === 3) request(s, 'E12');
    if (g.rungSec === 5 && !g.oversight) request(s, 'E20');
  }
  // 5b DPA consolidation (soft path) at rung ≥ 4 with high trust.
  if (g.rungSec >= 4 && tr > 60 && g.nationalization > pre.natThreshold - 20 && !w.dpaAccepted && s.events.fired.E22 === undefined) request(s, 'E22');
  // Hard path (§3.10.1): nationalization > natThreshold + 10 with trust < 20 → 'nationalized' ending.
  if (g.nationalization > pre.natThreshold + 10 && tr < 20) w.nationalizedHard = true;

  // ── G-CHN ladder.
  const chinaLead = s.china.lab.intel.leadDaysEst;
  const hist = w.chinaLeadHist;
  const shrinking = hist.length >= 8 && hist[hist.length - 1] < hist[hist.length - 8] - 10;
  const chnCond = [
    false,
    chinaLead < 120 || g.hawkishness > 60,
    s.player.security.stolen.some((x) => x.by === 'china' && s.player.security.detectedThefts.includes(x.versionId)),
    chinaLead < 60 || g.hawkishness > 80,
    seenM >= 10 && shrinking,
  ];
  if (g.rungChn < 4 && holdCheck(g, `chn${g.rungChn + 1}`, chnCond[g.rungChn + 1])) {
    g.rungChn = (g.rungChn + 1) as GovActor['rungChn'];
    ctx.log('gov', ['', 'Washington tightens chip licences to China.', 'US cyber operations hit Chinese AI sites.', 'All AI chip exports to China are barred.', 'The Pentagon drafts strike plans on Chinese datacentres.'][g.rungChn], 3);
    ctx.cause('gov.rungChn', 1, 'G-CHN ladder');
    if (g.rungChn === 2) {
      ctx.bump('china.meters.taiwanTension', 10, 'US cyber retaliation');
      ctx.bump('china.meters.centralization', 15, 'US cyber retaliation (R15)');
      w.lastTheftOrCyberDay = day;
    }
  }

  // ── Statutes by date (real laws keep real dates, §9 #16).
  if (!g.statutes.sb53 && day >= dayOfDate(s.time.startDate, '2026-01-01')) {
    g.statutes.sb53 = true;
    ctx.log('gov', 'California SB 53 takes effect: frontier frameworks and 15-day incident reports.', 2);
  }
  if (!g.statutes.raise && day >= dayOfDate(s.time.startDate, '2027-01-01') && s.player.finance.revenueRun >= 0.5) {
    g.statutes.raise = true;
    ctx.log('gov', 'New York RAISE Act takes effect: 72-hour incident reports.', 2);
  }
  if (s.setup.gov === 'realistic' && g.congressControl === 'R' && day >= dayOfDate(s.time.startDate, '2027-01-03')) {
    g.congressControl = 'D';
    ctx.log('gov', 'A new Congress is sworn in under opposition control.', 2);
  }
  // Monthly policy fights (G-REG), driven by bloc pressure (research/08 §1.0).
  if (dateOf(s, day).getUTCDate() === 1) govMonthly(s, ctx);

  // Rung 1–2 demands met → trust (§3.6 last para); unmet → −trust (research/07 rung 1).
  if (g.rungSec >= 1 && day % 30 === 0) {
    const met = s.player.security.wsl >= wslFloor((day / 365) + 0.5) + 0.3;
    trust(s, ctx, 'exec', met ? 1.5 : -1, met ? 'security clauses met' : 'security clauses unmet');
  }
}

function govMonthly(s: GameStateV2, ctx: SystemCtx) {
  const g = s.gov;
  const pre = govPresetOf(g.preset);
  const r = ctx.rng('actors');
  const day = ctx.day;
  // Preemption suit (DOJ task force): resolves 90–180 d later with P(win) = 1 − judicialCheck/100.
  const due = g.holdDays.preemptSuit;
  if (due !== undefined && day >= due) {
    delete g.holdDays.preemptSuit;
    if (r.chance(1 - g.judicialCheck / 100)) {
      g.statutes.preemption = true;
      ctx.log('gov', 'Courts uphold federal preemption of state AI laws.', 2);
    } else ctx.log('gov', 'Courts block the federal preemption push.', 2);
  } else if (due === undefined && !g.statutes.preemption && pre.id !== 'regulator' && g.stateRegPressure > 50 && policyPressure(s, 'preemption', 'exec') > 0) {
    g.holdDays.preemptSuit = day + Math.round(r.range(90, 180));
    ctx.log('gov', 'The Justice Department sues to preempt state AI laws.', 2);
  }
  // Federal licensing: Congress activism ≥ 70 and positive pressure → floor fight; presidential veto unless
  // Cautious Regulator, or Populist with concern > 70.
  if (!g.statutes.federalLicensing && g.congressActivism >= 70 && policyPressure(s, 'licensing', 'congress') > 0) {
    const veto = !(pre.id === 'regulator' || (pre.id === 'populist' && s.pub.concern > 70));
    if (!veto && r.chance(0.3)) {
      g.statutes.federalLicensing = true;
      ctx.log('gov', 'Congress passes federal frontier-AI licensing.', 3);
      ctx.bump('relations.scrutiny', 10, 'licensing law');
    }
  }
  // Reg stance follows net bloc pressure on evals/licensing vs preemption.
  const net = policyPressure(s, 'evals', 'exec') + policyPressure(s, 'licensing', 'exec') - policyPressure(s, 'preemption', 'exec');
  const target = clamp(-60 + 0.3 * net * pre.reg, -100, 100);
  const d = (target - g.regStance) * 0.1;
  g.regStance = clamp(g.regStance + d, -100, 100);
  ctx.cause('gov.regStance', d, 'bloc pressure');
}
