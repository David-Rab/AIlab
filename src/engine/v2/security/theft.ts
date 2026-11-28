// Theft, secrets leak, distillation, insider leaks (V2-SPEC §3.6; research/11 #16, #24; research/02 §1.7–1.10). Owner: WS4.
import { clamp } from '../../rng';
import { lagDays } from '../models/capability';
import { npcG, setNpcModel } from '../npc/lab';
import { theft } from '../npc/shocks';
import { decimalYear } from '../core/time';
import { bestPlayerVersion, CHINA_ID } from '../models/labs';
import type { GameStateV2, LabId, RivalLab, SecurityState, SystemCtx } from '../types';
import { request } from '../events/request';
import { WS4_TUNING } from '../actors/tuning';
import { CHINAGOV, theftIntent } from '../world/chinagov';
import { USGOV, playerAttention, usgovTheftDetected } from '../world/usgov';
import { attention, frontier } from '../world/observe';
import { adopted } from '../models/paradigms';

/** P(successful theft in 2 months) = 1/(1 + 19·6^(d−a)) (R11 #24: 5% at d = a, base 6 per level). */
export function theftP2mo(defence: number, attacker: number): number {
  return 1 / (1 + 19 * Math.pow(6, defence - attacker));
}

/** Attacker level a = 4 + [China tension ≥ 3] + 0.5·min(1, theftIntent/50), capped at 5 (R11 #24; world/chinagov.ts). */
export function attackerLevel(s: GameStateV2): number {
  return Math.min(5, 4 + (s.chinagov.tension >= 3 ? 1 : 0) + 0.5 * Math.min(1, theftIntent(s) / 50));
}

/** Share of the player's compute hosted at Gulf sites (Gulf hosting lowers effective WSL by 0.3 there). */
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

/** Daily theft hazard on a target with security `sec` holding a model `leadDays` ahead of China, with attention `att` on
 *  it (§3.6; W6: China attempts from tension CHINAGOV.theftRung, on labs outsiders pay attention to, observe.ts). */
export function theftHazardOn(s: GameStateV2, sec: SecurityState, leadDays: number, att: number, gulf = 0): number {
  if (leadDays <= 90 || att < USGOV.attentionMin || s.china.lab.core.status !== 'active' || s.chinagov.tension < CHINAGOV.theftRung) return 0; // nothing worth stealing, or no push to steal
  // P25 Formal verification at scale (model v3 V2): verified infrastructure, +0.5 defence level for the player.
  const p = theftP2mo(effectiveDefence(sec, gulf) + (sec === s.player.security && adopted(s, 'P25') ? P25_DEFENCE : 0), attackerLevel(s));
  return (-Math.log(1 - Math.min(0.999, p)) / 61) * (theftIntent(s) / 100);
}

/** Daily theft hazard against the player (§3.6). */
export function theftHazardDaily(s: GameStateV2, ctx?: SystemCtx): number {
  if (s.chinagov.tension < CHINAGOV.theftRung) return 0;
  return theftHazardOn(s, s.player.security, lagDays(s, CHINA_ID, 'player'), playerAttention(s, ctx), gulfShare(s));
}

/** The chance of a successful theft from the player within a year, by the same rule as theftHazardOn (the daily hazard held for 365
 *  days), for the Risk tab. `lead` is the days the player's model is ahead of China, `attention` the player's, `wsl` extra weight security
 *  levels (a what-if). `blocker` says in words why the chance is 0 when it is. */
export function theftYearOdds(s: GameStateV2, o: { lead: number; attention: number; wsl?: number }): { p: number; blocker: string } {
  if (s.china.lab.core.status !== 'active') return { p: 0, blocker: 'China has no lab to use stolen weights' };
  if (s.chinagov.tension < CHINAGOV.theftRung) return { p: 0, blocker: 'China is not stealing weights yet' };
  if (o.attention < USGOV.attentionMin) return { p: 0, blocker: 'Too little attention on your lab to be a target' };
  if (o.lead <= 90) return { p: 0, blocker: 'Nothing worth stealing: China is within three months' };
  const sec = s.player.security;
  const d = effectiveDefence({ ...sec, wsl: sec.wsl + (o.wsl ?? 0) }, gulfShare(s)) + (adopted(s, 'P25') ? P25_DEFENCE : 0);
  const hazard = (-Math.log(1 - Math.min(0.999, theftP2mo(d, attackerLevel(s)))) / 61) * (theftIntent(s) / 100);
  return { p: 1 - Math.pow(1 - Math.min(1, hazard), 365), blocker: '' };
}

/** Daily theft hazard against an NPC US lab (half the player's rate: §3.6). */
export function rivalTheftHazard(s: GameStateV2, r: RivalLab): number {
  const lead = lagDays(s, CHINA_ID, r.core.id);
  if (s.chinagov.tension < CHINAGOV.theftRung || lead <= 90) return 0;
  return 0.5 * theftHazardOn(s, r.core.security, lead, attention(s, r.core.id, frontier(s)));
}

/** The strength of the secrets-leak channel: the share of its KNOW-HOW gap to the player China closes a day, k·spies·clamp(3.5 − ssl, 0, 2)
 *  (§3.6). N6: npc/shocks.ts secretsLeak closes that share of the gap, in lag days. */
export function secretsLeakDaily(s: GameStateV2): number {
  const sec = s.player.security;
  return WS4_TUNING.leakK * sec.spies * clamp(3.5 - sec.ssl, 0, 2);
}

/** China holds the stolen copy: its lag jumps to the copy's position plus the integration delay (npc/shocks.ts theft: the one
 *  rule of a theft; the lab's daily step follows that lag, so nothing else sets the model's G) and its internal model is
 *  named for the copy and read at the new lag today. With no gap to the copy (China at or ahead of it) nothing changes. */
function chinaHoldsStolen(s: GameStateV2, ctx: SystemCtx, stolenG: number, id: string, name: string, from: LabId): boolean {
  const cn = s.china.lab;
  if (!(theft(s, stolenG) > 0)) return false;
  cn.internal = { ...cn.internal, id, name, day: ctx.day, isPublic: false, openWeights: false, stolenFrom: from };
  setNpcModel(s.hidden.timeline, cn.internal, npcG(s, cn), cn.core.computeOnline, decimalYear(s));
  return true;
}

/** A successful theft of `victim`'s best internal model by China (§3.6 outcome; R11 #16d). Weights, not a recipe: China's
 *  know-how does not jump (the secrets leak is the recipe channel); the theft is recorded even with no gap. */
export function executeTheft(s: GameStateV2, ctx: SystemCtx, victim: LabId) {
  const cn = s.china.lab;
  if (victim === 'player') {
    const v = bestPlayerVersion(s);
    if (!v) return;
    const sec = s.player.security;
    sec.stolen.push({ day: ctx.day, versionId: v.id, by: CHINA_ID });
    // China gets a copy of the best internal version.
    chinaHoldsStolen(s, ctx, v.G, `china-st${sec.stolen.length}`, `${cn.internal.name.split('-')[0]}-S${sec.stolen.length}`, 'player');
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
    chinaHoldsStolen(s, ctx, r.internal.G, `china-st-${victim}-${ctx.day}`, r.internal.name, victim);
    r.core.security.stolen.push({ day: ctx.day, versionId: r.internal.id, by: CHINA_ID });
    if (ctx.rng('security').chance(0.5)) {
      ctx.log('rival', `${r.core.name} reports that its model weights were stolen.`, 4, victim);
      usgovTheftDetected(s, ctx, victim);
    }
  }
}
