// Theft, secrets leak, distillation, insider leaks (V2-SPEC §3.6; research/11 #16, #24; research/02 §1.7–1.10). Owner: WS4.
import { clamp } from '../../rng';
import { frontierLevelAt, gOfPm } from '../models/capability';
import { pmOfLevel } from '../world/calibration';
import { REF_TPP } from '../../../data/v2/runDesign';
import { baseParams, fptOfBase, gOfSimple, rlOnBase, setModelG } from '../actors/rivalModel';
import { bestPlayerVersion, bestPm, CHINA_ID } from '../models/labs';
import type { GameStateV2, LabId, RivalBase, RivalLab, SecurityState, SimpleModel, SystemCtx } from '../types';
import { leadBetween, rateOf } from '../actors/rivals';
import { request, ws4 } from '../actors/state';
import { WS4_TUNING } from '../actors/tuning';

/** P(successful theft in 2 months) = 1/(1 + 19·6^(d−a)) (R11 #24: 5% at d = a, base 6 per level). */
export function theftP2mo(defence: number, attacker: number): number {
  return 1 / (1 + 19 * Math.pow(6, defence - attacker));
}

/** Attacker level a = 4 + [China rung ≥ 3] + 0.5·min(1, theftIntent/50), capped at 5 (R11 #24). */
export function attackerLevel(s: GameStateV2): number {
  return Math.min(5, 4 + (s.china.rung >= 3 ? 1 : 0) + 0.5 * Math.min(1, s.china.meters.theftIntent / 50));
}

/** Share of the player's compute hosted at Gulf sites (sovereign strings lower effective WSL by 0.3 there). */
function gulfShare(s: GameStateV2): number {
  const live = s.player.sites.filter((x) => x.stage === 'live');
  const tot = live.reduce((a, x) => a + x.installed, 0);
  return tot > 0 ? live.filter((x) => x.region === 'Gulf').reduce((a, x) => a + x.installed, 0) / tot : 0;
}

/** Effective defence d = wsl − 0.3·min(1, spies/5) if wsl < 3 (insider tier); Gulf hosting −0.3 on that share. */
export function effectiveDefence(sec: SecurityState, gulf = 0): number {
  const d = sec.wsl < 3 ? sec.wsl - 0.3 * Math.min(1, sec.spies / 5) : sec.wsl;
  return d - 0.3 * gulf;
}

/** Daily theft hazard on a target with security `sec` holding a model `leadDays` ahead of China (§3.6). */
export function theftHazardOn(s: GameStateV2, sec: SecurityState, leadDays: number, gulf = 0): number {
  if (leadDays <= 90 || s.china.lab.core.status !== 'active' || s.china.rung < WS4_TUNING.theftMinRung) return 0; // China holds nothing worth stealing
  // P25 Formal verification at scale (model v3 V2): verified infrastructure, +0.5 defence level for the player.
  const p = theftP2mo(effectiveDefence(sec, gulf) + (sec === s.player.security && s.player.paradigms.P25?.status === 'adopted' ? 0.5 : 0), attackerLevel(s));
  return (-Math.log(1 - Math.min(0.999, p)) / 61) * (s.china.meters.theftIntent / 100);
}

/** Daily theft hazard against the player (§3.6). */
export function theftHazardDaily(s: GameStateV2): number {
  return theftHazardOn(s, s.player.security, leadBetween(s, 'player', CHINA_ID), gulfShare(s));
}

/** Secrets leak coefficient [fit] (R11 #16c: "≈ 0.00015, tuned so the lead stays 150–200 d until the theft"). The
 *  spec's spies scale (privileged·0.005 ≈ 10) is ~10× v1's, so the per-spy coefficient is scaled to match T3. */
export const LEAK_K = () => WS4_TUNING.leakK;

/** Daily China know-how gain from leaked secrets: k·spies·clamp(3.5 − ssl, 0, 2)·gapYears (§3.6). */
export function secretsLeakDaily(s: GameStateV2): number {
  // Secrets are know-how: the gap is in know-how (pa) terms, not model capability (pm includes the compute term).
  const gapYears = Math.max(0, s.player.pa - s.china.lab.core.pa);
  const sec = s.player.security;
  return WS4_TUNING.leakK * sec.spies * clamp(3.5 - sec.ssl, 0, 2) * gapYears;
}

/** Distillation of US RIVALS' public models by China [fit]: China recovers a share of the gap to the best rival
 *  public model each day, scaled by distillation access. The player's deployments leak through WS1's
 *  distillationLeak (§3.3.5), applied by the security system for every lab. */
export const DISTILL_K = () => WS4_TUNING.distillK;

export function distillFlowDaily(s: GameStateV2): number {
  let pub = -Infinity;
  for (const r of s.rivals) if (r.core.status === 'active' && r.publicModel) pub = Math.max(pub, r.publicModel.pm);
  const gap = Math.max(0, pub - bestPm(s, 'china')); // model vs model (pm), like WS1's distillationLeak
  return WS4_TUNING.distillK * (s.china.meters.distillationAccess / 60) * gap;
}

/** A successful theft of `victim`'s best internal model by China (§3.6 outcome; R11 #16d). */
export function executeTheft(s: GameStateV2, ctx: SystemCtx, victim: LabId) {
  const w = ws4(s);
  const cn = s.china.lab;
  const tw = s.hidden.timeline;
  // A stolen model is ≈ 60 d behind its source once adapted and deployed (§3.6, T3): China's internal model is the
  // stolen copy 60 d of the victim's model-frontier rate behind. Against the player the lead is WS1's trueLeadDays (time
  // since the player's frontier line stood at China's level), so the stolen copy sits where that line stood 60 d ago —
  // exactly 60 lead-days, never above the source. Rival victims (and a player history too short) use the gap/rate
  // conversion of the rival-vs-rival lead.
  const adoptG = (src: { pm: number; Lg: number }, srcLab: LabId) => {
    let pm = src.pm - (60 / 365) * rateOf(s, srcLab);
    if (srcLab === 'player') {
      const L = frontierLevelAt(s, 'player', ctx.day - 60, src.Lg);
      if (L !== undefined) pm = Math.min(src.pm, pmOfLevel(tw, L, src.pm - 3, src.pm));
    }
    return gOfPm(tw, pm);
  };
  // Model v3 F1: weights, not a recipe. China holds the stolen base (its FLOP, size and the G_pre that copy embodies) and
  // post-trains it at its own recipe; its own next base replaces it only if better (actors/rivals.ts labDaily). Its
  // know-how (recipe) does not jump: the secrets leak (secretsLeakDaily) is the recipe channel.
  const holdStolen = (m: SimpleModel, G: number, flop: number, params: number) => {
    const rec = cn.phys.rec;
    const base: RivalBase = { gen: cn.phys.base.gen, day: ctx.day, flop, params, tpp: REF_TPP, gPre: G - rlOnBase(flop, rec.mid, rec.ceil), ePre: rec.pre };
    cn.phys.base = base;
    cn.phys.clDay = ctx.day;
    setModelG(tw, m, G, base);
    m.fpt = fptOfBase(base);
  };
  if (victim === 'player') {
    const v = bestPlayerVersion(s);
    if (!v) return;
    const sec = s.player.security;
    sec.stolen.push({ day: ctx.day, versionId: v.id, by: CHINA_ID });
    // China gets a copy of the best internal version, traits included (U21 shared-misalignment route).
    const b = s.player.models.bases.find((x) => x.id === v.baseId);
    const flop = b?.flop ?? v.build?.flopPre ?? 3e26;
    cn.internal = { id: `china-st${sec.stolen.length}`, name: `${cn.internal.name.split('-')[0]}-S${sec.stolen.length}`, day: ctx.day, pm: 0, Lg: 0, domains: cn.internal.domains, traitsTrue: { ...v.traitsTrue }, uModes: [...v.uModes], isPublic: false, openWeights: false, stolenFrom: 'player' };
    holdStolen(cn.internal, adoptG(v, 'player'), flop, v.params ?? b?.params ?? baseParams(flop));
    if (v.fpt) cn.internal.fpt = v.fpt;
    w.internalDay[CHINA_ID] = ctx.day;
    const pDetect = clamp(0.5 + 0.1 * (sec.wsl - 2) + 0.3 * sec.counterIntel, 0, 1);
    if (ctx.rng('security').chance(pDetect)) {
      sec.detectedThefts.push(v.id);
      w.lastTheftOrCyberDay = ctx.day;
      ctx.log('alert', `Security detects that the weights of ${v.name} were stolen.`, 5, v.id);
      request(s, 'E10', { versionId: v.id });
    }
    ctx.bump('china.theftIntent', -15, 'theft succeeded');
  } else {
    const r = s.rivals.find((x) => x.core.id === victim) as RivalLab | undefined;
    if (!r || r.core.status !== 'active') return;
    const G = Math.min(gOfSimple(tw, r.internal), adoptG(r.internal, victim));
    cn.internal = { ...r.internal, id: `china-st-${victim}-${ctx.day}`, traitsTrue: { ...r.internal.traitsTrue }, uModes: [...r.internal.uModes], isPublic: false, openWeights: false, stolenFrom: victim };
    holdStolen(cn.internal, G, r.internal.flop ?? r.phys.base.flop, r.internal.params ?? r.phys.base.params);
    w.internalDay[CHINA_ID] = ctx.day;
    r.core.security.stolen.push({ day: ctx.day, versionId: r.internal.id, by: CHINA_ID });
    if (ctx.rng('security').chance(0.5)) {
      ctx.log('rival', `${r.core.name} reports that its model weights were stolen.`, 4, victim);
      ctx.bump('gov.securityDemand', 8, 'rival theft');
    }
  }
}
