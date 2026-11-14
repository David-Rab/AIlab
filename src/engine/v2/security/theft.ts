// Theft, secrets leak, distillation, insider leaks (V2-SPEC §3.6; research/11 #16, #24; research/02 §1.7–1.10). Owner: WS4.
import { clamp } from '../../rng';
import { domainsOf, levelOf, simplePaFor } from '../models/capability';
import { bestPlayerVersion, bestPm, CHINA_ID } from '../models/labs';
import type { GameStateV2, LabId, RivalLab, SecurityState, SimpleModel, SystemCtx } from '../types';
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
  const p = theftP2mo(effectiveDefence(sec, gulf), attackerLevel(s));
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
  // A stolen model is ≈ 60 d behind its source once adapted and deployed (§3.6, T3): China's internal model is the
  // stolen copy 60 d of the victim's model-frontier rate behind (pm), and China's know-how jumps (if higher) to the pa
  // at which its own frontier (WS1 simpleFrontierPm, with China's compute) equals that model — pm and pa are different
  // coordinates (pm = pa + compute term + design, §3.1.4).
  const adopt = (src: { pm: number; Lg: number; domains: SimpleModel['domains'] }, srcLab: LabId) => {
    const w = s.hidden.timeline;
    const pm = src.pm - (60 / 365) * rateOf(s, srcLab);
    return { pm, Lg: levelOf(w, pm), domains: domainsOf(w, pm) };
  };
  const knowHow = (pm: number) => simplePaFor(s, CHINA_ID, pm);
  if (victim === 'player') {
    const v = bestPlayerVersion(s);
    if (!v) return;
    const sec = s.player.security;
    sec.stolen.push({ day: ctx.day, versionId: v.id, by: CHINA_ID });
    // China gets a copy of the best internal version, traits included (U21 shared-misalignment route).
    cn.internal = { id: `china-st${sec.stolen.length}`, name: `${cn.internal.name.split('-')[0]}-S${sec.stolen.length}`, day: ctx.day, ...adopt(v, 'player'), traitsTrue: { ...v.traitsTrue }, uModes: [...v.uModes], isPublic: false, openWeights: false, stolenFrom: 'player' };
    w.internalDay[CHINA_ID] = ctx.day;
    const target = knowHow(cn.internal.pm);
    if (target > cn.core.pa) {
      ctx.cause('china.pa', target - cn.core.pa, 'weights stolen', v.name);
      cn.core.pa = target;
    }
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
    cn.internal = { ...r.internal, id: `china-st-${victim}-${ctx.day}`, ...adopt(r.internal, victim), traitsTrue: { ...r.internal.traitsTrue }, uModes: [...r.internal.uModes], isPublic: false, openWeights: false, stolenFrom: victim };
    w.internalDay[CHINA_ID] = ctx.day;
    const target = knowHow(cn.internal.pm);
    if (target > cn.core.pa) {
      ctx.cause('china.pa', target - cn.core.pa, 'weights stolen', r.core.name);
      cn.core.pa = target;
    }
    r.core.security.stolen.push({ day: ctx.day, versionId: r.internal.id, by: CHINA_ID });
    if (ctx.rng('security').chance(0.5)) {
      ctx.log('rival', `${r.core.name} reports that its model weights were stolen.`, 4, victim);
      ctx.bump('gov.securityDemand', 8, 'rival theft');
    }
  }
}
