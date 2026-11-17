// China: meters, presets, ladder, de-escalation, DeepCent lab, geopolitics (V2-SPEC §3.10.4; research/10). Owner: WS4.
import { CHINA_PRESETS } from '../../../data/actors';
import { CHINA_LAB_NAME, CHINA_MODEL_FAMILY } from '../../../data/v2/names';
import { Rng, clamp } from '../../rng';

import { normalizeSplit, shareRefAt } from '../departments/split';
import { CHINA_ID, activeRivals } from '../models/labs';
import { initialSecurity } from '../security/security';
import { drawLineageUModes } from '../world/hidden';
import type { ChinaActor, EngineSystem, GameStateV2, HiddenWorld, StaffByRole, SystemCtx } from '../types';
import { cash, drift } from './fx';
import { goalpostsQ, leadBetween, rivalFinanceQ, simpleModel } from './rivals';
import { request, ws4 } from './state';
import { KOREA_HAZARD_Q, koreaShock, setExportPolicy, taiwanHazardQ, taiwanShock } from '../compute/market';

export const chinaPresetOf = (id: string) => CHINA_PRESETS.find((p) => p.id === id) ?? CHINA_PRESETS[0];

/** China at Jul 2025 (research/10 §1.1). DeepCent starts ≈0.6 progress-years (≈150–200 d) behind (§9 #17). */
export function initialChina(rng: Rng, h: HiddenWorld, playerPm: number, chinaGapYears: number): ChinaActor {
  const p = chinaPresetOf(h.actorPresets.china);
  const pm = playerPm - chinaGapYears;
  const uModes = drawLineageUModes(rng, h, false);
  const staff: StaffByRole = { cap: 1500, saf: 60 };
  const meters: ChinaActor['meters'] = {
    computeShare: 13, computeAbs: 1.5e6, chipSelfSufficiency: 30, domesticFab: 20, distillationAccess: 60,
    intelCapability: 75, theftIntent: 20, centralization: 0, stateSteering: 35, safetyConcern: 30, openWeights: 85,
    taiwanTension: 40, normsDiplomacy: 65, verificationWillingness: 15, econLeverage: 80, hawkDove: p.hawk,
  };
  const total = CHINA_PRESETS.reduce((a, x) => a + x.weight, 0);
  return {
    preset: p.id,
    lab: {
      core: {
        id: CHINA_ID, name: CHINA_LAB_NAME, kind: 'china', status: 'active',
        pa: pm,
        computeOnline: meters.computeAbs * 0.35,
        split: normalizeSplit({ ...shareRefAt(2025.5), safety: h.chinaPosture.safetyInvestment * 0.15 }),
        staff, tasteHire: 1,
        security: initialSecurity(staff, 2.0),
        milestoneDays: {},
      },
      archetype: 'deepcent',
      internal: simpleModel(h, 'china-b1p0', `${CHINA_MODEL_FAMILY}-1`, -30, pm, uModes, false),
      publicModel: simpleModel(h, 'china-b0', `${CHINA_MODEL_FAMILY}-1 open`, -45, pm - 0.15, uModes, true, true),
      nextBaseDay: Math.round(rng.range(60, 240)),
      finance: { cash: 30, revenueRun: 1, valuation: 0, commitments: 0, distress: false },
      visible: { frameworkVersion: 0, clauseType: 'state', testers: [] },
      intel: { leadDaysEst: Math.round(chinaGapYears * 365 * 0.8), leadDaysSd: 75, misalignBand: [0.05, 0.5], knownIncidents: [] },
      meters: { poachAggression: 20, cooperation: 10, lobbyStance: 0, openness: 85 },
      pressure: 0,
      pressureDays: 0,
    },
    meters,
    rung: 0,
    deesc: 0,
    holdDays: {},
    // Quarterly re-weighting starts concentrated on the drawn preset (0.6) plus the population weights (0.4).
    presetWeights: Object.fromEntries(CHINA_PRESETS.map((x) => [x.id, 0.4 * (x.weight / total) + (x.id === p.id ? 0.6 : 0)])),
  };
}

/** Blended preset multipliers from the current preset weights (research/10 §1.2 drift). */
export function chinaParams(s: GameStateV2) {
  const out = { centralize: 0, theft: 0, taiwan: 0, treaty: 0, openSource: 0, efficiency: 0, hawk: 0 };
  let tot = 0;
  for (const p of CHINA_PRESETS) {
    const w = s.china.presetWeights[p.id] ?? 0;
    tot += w;
    for (const k of Object.keys(out) as (keyof typeof out)[]) out[k] += w * p[k];
  }
  for (const k of Object.keys(out) as (keyof typeof out)[]) out[k] /= tot || 1;
  return out;
}

/** China's lead deficit in months (positive = player ahead), TRUE internal frontiers. Engine use only. */
export const chinaGapMonths = (s: GameStateV2) => (leadBetween(s, 'player', CHINA_ID) / 365) * 12;

/** Best US frontier (player or active rival) lead over China in months. */
export function usGapMonths(s: GameStateV2): number {
  let best = leadBetween(s, 'player', CHINA_ID);
  for (const r of activeRivals(s)) best = Math.max(best, leadBetween(s, r.core.id, CHINA_ID));
  return (best / 365) * 12;
}

/** Algorithmic offset for the R10 gap formula [fit]: makes the formula agree with the simulated start lead (T3). */
export const GAP_ALGO_OFFSET = 4.0;

/** R10 IFP gap formula (display + T3 check): 10.8·log10(US_eff/CN_eff)·(1 − 0.5·DA/60) + offsets (months). */
export function chinaGapFormulaMonths(s: GameStateV2): number {
  const us = s.player.computeOnline + activeRivals(s).reduce((a, r) => a + r.core.computeOnline, 0);
  const cn = s.china.meters.computeAbs * chinaParams(s).efficiency;
  const da = s.china.meters.distillationAccess;
  return 10.8 * Math.log10(Math.max(1.01, us / cn)) * (1 - (0.5 * da) / 60) + GAP_ALGO_OFFSET;
}

/** KYC-adjusted distillation target: DA × 0.75 per KYC level on the player's API/agent deployments (§3.6). */
export function distillTarget(s: GameStateV2): number {
  let kyc = 0;
  for (const d of s.player.deployments) if (d.status === 'live' && (d.channel === 'api' || d.channel === 'agents')) kyc = Math.max(kyc, d.kyc);
  const shared = s.flags['ws4:threatIntel'] ? 0.85 : 1;
  const restricted = s.flags['ws4:restrictAdversary'] ? 0.85 : 1;
  return 60 * Math.pow(0.75, kyc) * shared * restricted * (s.flags['ws4:kycBan'] ? 0.75 : 1);
}

const RUNG_TEXT = [
  'China returns to competitive coexistence.',
  'Beijing retaliates for chip controls with purchase bans and domestic mandates.',
  'China intensifies acquisition: talent, smuggling, industrial-scale distillation.',
  'China forms a national AI team and centralizes its compute.',
  'Chinese intelligence launches an operation against US frontier labs.',
  'Coercive pressure on Taiwan: an "inspection" regime begins.',
  'China moves to a war footing.',
];

/** China meters and posture ladder (daily). The DeepCent lab itself runs through labDaily (rivals.ts). */
export function chinaDaily(s: GameStateV2, ctx: SystemCtx) {
  const c = s.china;
  const m = c.meters;
  const M = m as unknown as Record<string, number>;
  const w = ws4(s);
  const pp = chinaParams(s);
  const day = ctx.day;

  // Compute ≈ ×2/yr (IFP), slower under strict export policy; centralization pools it for DeepCent (R11 #16b).
  const g = Math.pow(2, 1 / 365) - 1;
  const exportF = s.market.exportPolicy === 'strict' ? 0.8 : s.market.exportPolicy === 'open' ? 1.1 : 1;
  m.computeAbs *= 1 + g * exportF;
  c.lab.core.computeOnline = m.computeAbs * (0.4 + 0.5 * Math.min(1, m.centralization / 75)) * 0.6;
  // policy.chinaSez (WS5 POLICY_FLAGS, H32): China opens its own AI zones once the US has SEZs and Beijing has
  // centralised its AI effort [D]; closed again if the US SEZs close or a verified treaty is signed.
  if (day % 30 === 0) {
    const on = !!s.flags['policy.sez'] && m.centralization >= 50 && s.gov.treaty !== 'verified';
    if (on && !s.flags['policy.chinaSez']) {
      s.flags['policy.chinaSez'] = true;
      ctx.log('china', 'China opens special economic zones for AI and robotics.', 3);
    } else if (!on && s.flags['policy.chinaSez']) delete s.flags['policy.chinaSez'];
  }
  drift(s, M, 'chipSelfSufficiency', 5 / 365 * (s.market.exportPolicy === 'strict' ? 1.3 : 1), 0, 100, 'china.meters.chipSelfSufficiency');
  drift(s, M, 'distillationAccess', (distillTarget(s) - m.distillationAccess) * 0.004, 0, 100, 'china.meters.distillationAccess');
  const intentT = clamp(20 * pp.theft + (c.rung >= 2 ? 10 : 0) + (c.rung >= 4 ? 30 : 0), 0, 100);
  drift(s, M, 'theftIntent', (intentT - m.theftIntent) * 0.01, 0, 100, 'china.theftIntent');
  drift(s, M, 'safetyConcern', (30 * (pp.treaty > 1.5 ? 1.5 : 1) - m.safetyConcern) * 0.002, 0, 100, 'china.meters.safetyConcern');
  drift(s, M, 'taiwanTension', (40 * pp.taiwan + 5 * Math.max(0, c.rung - 3) - m.taiwanTension) * 0.003, 0, 100, 'china.meters.taiwanTension');
  m.openWeights = c.rung >= 3 ? Math.min(m.openWeights, 30) : m.openWeights;
  m.hawkDove = clamp(pp.hawk + 5 * c.rung, 0, 100);

  // Secrets / distillation flows close part of the gap (calibrated in security.ts, T3).
  // Posture ladder (research/10 §1.4): climb after 14 d, descend after 60 d false (rungs 5–6 sticky).
  const gap = usGapMonths(s);
  const leap = (s.flags.seenMilestone2 !== undefined) || s.player.models.versions.some((v) => v.flags.cyberOffense && v.status === 'deployed');
  const cond = [
    true,
    s.market.exportPolicy !== 'open' && day > 60,
    (gap > 6 && m.distillationAccess < 50) || leap,
    m.centralization >= 50,
    (c.rung >= 3 && s.player.security.wsl <= 3 && gap > 3) || (gap > 12 && (s.flags.seenMilestone2 !== undefined)),
    (c.rung >= 4 && s.player.security.stolen.some((x) => x.by === CHINA_ID) && gap > 6) || (pp.taiwan >= 1.9 && c.rung >= 4),
    c.rung >= 5 && w.treatyRejected && gap > 6,
  ];
  const up = c.rung < 6 && cond[c.rung + 1];
  const k = `up${c.rung + 1}`;
  if (up) {
    c.holdDays[k] = (c.holdDays[k] ?? 0) + 1;
    if (c.holdDays[k] >= 14) {
      delete c.holdDays[k];
      c.rung = (c.rung + 1) as ChinaActor['rung'];
      ctx.log('china', RUNG_TEXT[c.rung], c.rung >= 4 ? 4 : 2);
      ctx.cause('china.rung', 1, 'posture ladder');
      if (c.rung === 2) ctx.bump('china.theftIntent', 10, 'intensified acquisition');
      if (c.rung === 3) m.openWeights = 30;
      if (c.rung === 5) ctx.bump('china.meters.taiwanTension', 20, 'coercive pressure');
    }
  } else delete c.holdDays[k];
  if (c.rung > 0 && c.rung < 5 && !cond[c.rung]) {
    const kd = `down${c.rung}`;
    c.holdDays[kd] = (c.holdDays[kd] ?? 0) + 1;
    if (c.holdDays[kd] >= 60) {
      delete c.holdDays[kd];
      c.rung = (c.rung - 1) as ChinaActor['rung'];
      ctx.cause('china.rung', -1, 'posture ladder');
    }
  }

  // De-escalation track D1–D5 (research/10 §1.4), climbed when conditions hold.
  const quiet = day - w.lastTheftOrCyberDay >= 180;
  const scare = w.misalignmentLeak || w.rivalIncidents.some((i) => i.severity >= 4 && !i.misuse);
  const dcond = [
    true,
    m.normsDiplomacy > 50 && w.usProposedTalks,
    quiet,
    m.safetyConcern > 50,
    gap < 4 || scare,
    m.verificationWillingness > 50 && (s.gov.preset === 'regulator' || !!s.flags['ws4:lobbyTreaty']),
  ];
  if (c.deesc < 5 && dcond[c.deesc + 1] && (c.deesc === 0 || dcond[c.deesc])) {
    const kk = `d${c.deesc + 1}`;
    c.holdDays[kk] = (c.holdDays[kk] ?? 0) + 1;
    if (c.holdDays[kk] >= 30) {
      delete c.holdDays[kk];
      c.deesc = (c.deesc + 1) as ChinaActor['deesc'];
      ctx.log('china', ['', 'US and Chinese officials issue a joint statement on human control of AI.', 'An AI incident hotline opens between Washington and Beijing.', 'Chinese and US scientists exchange evaluations and red lines.', 'Both sides signal informal restraint on frontier deployment.', 'Talks turn to verification: chips, inspections, a joint system.'][c.deesc], 2);
      if (c.deesc === 2) ctx.bump('china.meters.taiwanTension', -5, 'incident channel');
      if (c.deesc >= 4) request(s, 'E23', {});
    }
  }
  // Verification willingness creeps up while restraint holds.
  if (c.deesc >= 3) drift(s, M, 'verificationWillingness', 0.05 * pp.treaty, 0, 100, 'china.meters.verificationWillingness');

  // Weekly lead history for "widening/shrinking" rules.
  if (day % 7 === 0) {
    w.chinaLeadHist.push(Math.round(leadBetween(s, 'player', CHINA_ID)));
    if (w.chinaLeadHist.length > 26) w.chinaLeadHist.shift();
  }
}

/** Quarterly preset re-weighting (research/10 §1.2 drift rules). */
function reweight(s: GameStateV2, ctx: SystemCtx) {
  const c = s.china;
  const W = c.presetWeights;
  const gap = usGapMonths(s);
  const hist = ws4(s).chinaLeadHist;
  const widening = hist.length >= 13 && hist[hist.length - 1] > hist[hist.length - 13] + 15;
  const mul = (id: string, f: number) => (W[id] = (W[id] ?? 0) * f);
  if ((gap > 12 && widening) || s.flags.seenMilestone2 !== undefined) {
    mul('nationalizer', 1.3);
    mul('gambler', 1.15);
    mul('fastfollower', 0.85);
  }
  if (s.market.exportPolicy === 'open') mul('selfreliant', 1.3);
  if (ws4(s).misalignmentLeak || ws4(s).rivalIncidents.some((i) => i.severity >= 4 && !i.misuse && s.time.day - i.day < 120)) mul('bargainer', 2.5);
  if (c.meters.chipSelfSufficiency > 70) {
    W.fastfollower = (W.fastfollower ?? 0) + (W.selfreliant ?? 0) * 0.5;
    W.selfreliant = (W.selfreliant ?? 0) * 0.5;
  }
  if (gap < 3) mul('diffuser', 1.5);
  const tot = Object.values(W).reduce((a, x) => a + x, 0) || 1;
  for (const k of Object.keys(W)) W[k] /= tot;
  const top = Object.entries(W).sort((a, b) => b[1] - a[1])[0][0];
  if (top !== c.preset && W[top] > 0.45) {
    c.preset = top;
    ctx.log('china', `Analysts see a shift in Beijing's AI strategy: ${chinaPresetOf(top).name}.`, 2);
  }
}

/** geoQ (440, quarterly): Taiwan/Korea rolls, export policy, China preset re-weighting, rival finance and orders. */
export const geoQSystem: EngineSystem = {
  id: 'geoQ', owner: 'WS4', cadence: 'quarterly', order: 440, system: 'relations',
  run(s, ctx) {
    const w = ws4(s);
    const c = s.china;
    const r = ctx.rng('china');
    const pp = chinaParams(s);
    reweight(s, ctx);
    // Centralization (R7): gap > 9 months and widening for 90+ days, player past the first agent milestone.
    const hist = w.chinaLeadHist;
    const widening = hist.length >= 13 && hist[hist.length - 1] > hist[hist.length - 13];
    if (c.meters.centralization < 50 && usGapMonths(s) > 9 && widening && s.flags.seenMilestone1 !== undefined && r.chance(0.5 * pp.centralize)) {
      ctx.bump('china.meters.centralization', 50, 'national AI team (R7)');
      ctx.log('china', 'Beijing pools its AI labs and compute into a national collective.', 3);
    }
    // Export policy follows the G-CHN ladder (and player lobbying, E3).
    const lobby = Number(s.flags['ws4:exportLobby'] ?? 0);
    const want = s.gov.rungChn >= 3 || lobby > 0 ? 'strict' : s.gov.rungChn >= 1 || lobby === 0 ? 'caseByCase' : 'open';
    if (want !== s.market.exportPolicy) {
      setExportPolicy(s, want);
      ctx.log('gov', `US chip export policy toward China: ${want === 'strict' ? 'strict denial' : want === 'open' ? 'open sales' : 'case-by-case'}.`, 2);
      if (want === 'strict') {
        ctx.bump('china.meters.domesticFab', 5, 'export controls (R1)');
        if (r.chance(0.4)) ctx.log('china', 'China retaliates with rare-earth controls.', 2);
      }
    }
    // Taiwan: disruption roll (quarterly) = WS3's R15 hazard (tension × salience) × the China preset's Taiwan
    // propensity, plus the ladder (research/10 R9, rung 5). Applied through WS3's taiwanShock (supply, prices,
    // chips in transit); WS3's marketQ decays it.
    const day = ctx.day;
    if (w.taiwanDisrupted && s.market.disruptTW === 0) {
      w.taiwanDisrupted = false;
      ctx.log('world', 'Taiwan shipping normalises.', 2);
    }
    s.market.geoTW = c.meters.taiwanTension / 100;
    const pTW = clamp(taiwanHazardQ(s) * pp.taiwan + (c.rung >= 5 ? 0.15 : 0), 0, 0.5);
    if (!w.taiwanDisrupted && s.market.disruptTW === 0 && r.chance(pTW)) {
      const quarters = 1 + Math.floor(r.float() * 4);
      w.taiwanDisrupted = true;
      w.taiwanUntil = day + quarters * 91;
      taiwanShock(s, ctx, r.range(0.3, 0.5), quarters);
      s.flags['ws4:taiwanEver'] = true;
      ctx.log('world', 'Taiwan crisis: chip shipments from TSMC are disrupted.', 4);
      ctx.headline('taiwan', 'Taiwan crisis: chip shipments from TSMC disrupted');
    }
    if (s.market.disruptKR === 0 && r.chance(KOREA_HAZARD_Q)) koreaShock(s, ctx, r.range(0.3, 0.7), 2 + Math.floor(r.float() * 3));
    // Treaty track: talks → restraint (D4) → verified (D5) (research/10 §1.4).
    if (s.gov.treaty === 'talks' && c.deesc >= 4) s.gov.treaty = 'restraint';
    if ((s.gov.treaty === 'talks' || s.gov.treaty === 'restraint') && c.deesc >= 5 && c.meters.verificationWillingness > 50) {
      s.gov.treaty = 'verified';
      ctx.log('china', 'The US and China sign a verified agreement on frontier AI.', 4);
    }
    // Copyright litigation hazard 0.02·unlicensedT/100 per quarter (§3.9.1 data licences; R17 D3). A suit settles
    // automatically ($1.5B per 270T unlicensed tokens, the Bartz v. Anthropic scale), at most once a year; licensing
    // the data (D3) is the way to avoid it.
    const d = s.player.dataAssets;
    const lit = 0.02 * d.unlicensedTokensT / 100;
    const lastSuit = Number(s.flags['ws4:lastSuitDay'] ?? -1e9);
    if (lit > 0 && day - lastSuit >= 365 && ctx.rng('actors').chance(Math.min(0.5, lit))) {
      s.flags['ws4:lastSuitDay'] = day;
      const amt = 1.5 * clamp(d.unlicensedTokensT / 270, 0.2, 3);
      cash(s, ctx, -amt, 'copyright settlement');
      ctx.log('company', `Authors and publishers sued over ${Math.round(d.unlicensedTokensT)}T tokens of unlicensed training data; you settled for $${amt.toFixed(1)}B. Licensing the data stops further suits.`, 3);
    }
    rivalFinanceQ(s, ctx);
    goalpostsQ(s, ctx);
  },
};
