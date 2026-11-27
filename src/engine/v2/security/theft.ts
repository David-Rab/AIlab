// Theft, secrets leak, distillation, insider leaks (V2-SPEC §3.6; research/11 #16, #24; research/02 §1.7–1.10). Owner: WS4.
import { clamp } from '../../rng';
import { lagDays } from '../models/capability';
import { baseParams, setModelG } from '../npc/model';
import { theft } from '../npc/shocks';
import { bestPlayerVersion, CHINA_ID } from '../models/labs';
import type { GameStateV2, LabId, RivalLab, SecurityState, SimpleModel, SystemCtx } from '../types';
import { request, ws4 } from '../actors/state';
import { WS4_TUNING } from '../actors/tuning';
import { adopted } from '../models/paradigms';
import { stolenModelG } from '../production/diffusion';
import { usgovTheftDetected } from '../world/usgov';

/** China's posture rung (0 coexistence … 6 war footing; research/10 §1.4). W1d stand-in until W6: the start value 0,
 *  so China's weight theft stays off (theftMinRung 2) exactly as at the start of today's game. */
export const CHINA_RUNG = 0;
/** China's theft intent 0..100. W1d stand-in until W6: the start value 20. */
export const CHINA_THEFT_INTENT = 20;

/** P(successful theft in 2 months) = 1/(1 + 19·6^(d−a)) (R11 #24: 5% at d = a, base 6 per level). */
export function theftP2mo(defence: number, attacker: number): number {
  return 1 / (1 + 19 * Math.pow(6, defence - attacker));
}

/** Attacker level a = 4 + [China rung ≥ 3] + 0.5·min(1, theftIntent/50), capped at 5 (R11 #24). */
export function attackerLevel(_s: GameStateV2): number {
  return Math.min(5, 4 + (CHINA_RUNG >= 3 ? 1 : 0) + 0.5 * Math.min(1, CHINA_THEFT_INTENT / 50));
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

/** P25 Formal verification at scale (model v3 V2): the player's weight-security defence bonus, in levels (F6d: the
 *  tree preview reads it). */
export const P25_DEFENCE = 0.5;

/** Daily theft hazard on a target with security `sec` holding a model `leadDays` ahead of China (§3.6). */
export function theftHazardOn(s: GameStateV2, sec: SecurityState, leadDays: number, gulf = 0): number {
  if (leadDays <= 90 || s.china.lab.core.status !== 'active' || CHINA_RUNG < WS4_TUNING.theftMinRung) return 0; // China holds nothing worth stealing
  // P25 Formal verification at scale (model v3 V2): verified infrastructure, +0.5 defence level for the player.
  const p = theftP2mo(effectiveDefence(sec, gulf) + (sec === s.player.security && adopted(s, 'P25') ? P25_DEFENCE : 0), attackerLevel(s));
  return (-Math.log(1 - Math.min(0.999, p)) / 61) * (CHINA_THEFT_INTENT / 100);
}

/** Daily theft hazard against the player (§3.6). */
export function theftHazardDaily(s: GameStateV2): number {
  return theftHazardOn(s, s.player.security, lagDays(s, CHINA_ID, 'player'), gulfShare(s));
}

/** The strength of the secrets-leak channel: the share of the gap to the player China closes a day, k·spies·clamp(3.5 − ssl, 0, 2)
 *  (§3.6). N6: npc/shocks.ts secretsLeak pulls China's lag toward the player's position by this share. */
export function secretsLeakDaily(s: GameStateV2): number {
  const sec = s.player.security;
  return WS4_TUNING.leakK * sec.spies * clamp(3.5 - sec.ssl, 0, 2);
}

/** A successful theft of `victim`'s best internal model by China (§3.6 outcome; R11 #16d). */
export function executeTheft(s: GameStateV2, ctx: SystemCtx, victim: LabId) {
  const w = ws4(s);
  const cn = s.china.lab;
  const tw = s.hidden.timeline;
  // RD-X04b (research/RD-X04r §3C, T5): sized by what moves. China's model G jumps toward the stolen model's G by
  // THEFT_GAP_CLOSED of the gap (production/diffusion.ts stolenModelG; the rest is integration loss). With no gap (China
  // at or above the stolen G) its model is unchanged; the theft is still recorded.
  const cnOwnG = cn.internal.G;
  // Weights, not a recipe: China holds the stolen copy (its FLOP, size and G); its lag jumps to the copy's position (npc/shocks.ts
  // theft) and the lab's daily step takes the copy over from there. Its know-how does not jump: the secrets leak is the recipe channel.
  const holdStolen = (m: SimpleModel, G: number, flop: number, params: number) => setModelG(tw, m, G, { flop, params });
  if (victim === 'player') {
    const v = bestPlayerVersion(s);
    if (!v) return;
    const sec = s.player.security;
    sec.stolen.push({ day: ctx.day, versionId: v.id, by: CHINA_ID });
    // China gets a copy of the best internal version.
    const b = s.player.models.bases.find((x) => x.id === v.baseId);
    const flop = b?.flop ?? v.build?.flopPre ?? 3e26;
    if (v.G > cnOwnG) {
      cn.internal = { id: `china-st${sec.stolen.length}`, name: `${cn.internal.name.split('-')[0]}-S${sec.stolen.length}`, day: ctx.day, G: 0, Lg: 0, domains: cn.internal.domains, isPublic: false, openWeights: false, stolenFrom: 'player' };
      holdStolen(cn.internal, stolenModelG(cnOwnG, v.G), flop, v.params ?? b?.params ?? baseParams(flop));
      theft(s, v.G); // N6: China's lag jumps to the stolen model's position plus the integration delay
      if (v.fpt) cn.internal.fpt = v.fpt;
      w.internalDay[CHINA_ID] = ctx.day;
    }
    const pDetect = clamp(0.5 + 0.1 * (sec.wsl - 2) + 0.3 * sec.counterIntel, 0, 1);
    if (ctx.rng('security').chance(pDetect)) {
      sec.detectedThefts.push(v.id);
      usgovTheftDetected(s, ctx, 'player');
      ctx.log('alert', `Security detects that the weights of ${v.name} were stolen.`, 5, v.id);
      request(s, 'E10', { versionId: v.id });
    }
  } else {
    const r = s.rivals.find((x) => x.core.id === victim) as RivalLab | undefined;
    if (!r || r.core.status !== 'active') return;
    const stolen = r.internal.G;
    if (stolen > cnOwnG) {
      const G = stolenModelG(cnOwnG, stolen);
      cn.internal = { ...r.internal, id: `china-st-${victim}-${ctx.day}`, isPublic: false, openWeights: false, stolenFrom: victim };
      holdStolen(cn.internal, G, r.internal.flop ?? 1e26, r.internal.params ?? baseParams(r.internal.flop ?? 1e26));
      theft(s, stolen); // N6
      w.internalDay[CHINA_ID] = ctx.day;
    }
    r.core.security.stolen.push({ day: ctx.day, versionId: r.internal.id, by: CHINA_ID });
    if (ctx.rng('security').chance(0.5)) {
      ctx.log('rival', `${r.core.name} reports that its model weights were stolen.`, 4, victim);
      usgovTheftDetected(s, ctx, victim);
    }
  }
}
