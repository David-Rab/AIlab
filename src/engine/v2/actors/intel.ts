// Intel: the player's view of the NPC labs (V2-SPEC §3.10.3, §6.6; NPC-LABS §9). N9: there is no intel model any more.
// What the player knows of a lab is its public values (npc/public.ts: true x a log-normal error, redrawn when reported)
// and the exact public facts (products, tools, disclosed incidents). Nobody sees a misalignment estimate (principle 4).
import { clamp, sigmoid } from '../../rng';
import { activeRivals, internalVersion } from '../models/labs';
import { lossOfControlRisk } from '../safety/lossRisk';
import type { GameStateV2, LabId, RivalLab, RiskSource } from '../types';
import { lagDays } from '../models/capability';
import { defenceIndex } from '../worldfx/readouts';
import { publicOf, sigmaOf } from '../npc/public';
import { DAYS_PER_MONTH } from '../npc/lab';
import { chinaWarOdds } from '../world/chinagov';
import { theftYearOdds } from '../security/theft';
import { playerAttention } from '../world/usgov';

/** EngineApi.leadDays: the player's estimate of its lead over `other` (days, positive = player ahead) and its sd. The player
 *  knows its own position; the lab's is its public months behind (npc/public.ts), the error of the last report held until
 *  the next one: est = the lead on the two public models (lagDays, F7: both stepped) − the lab's true lag + its reported
 *  lag. sd = the public months-behind sigma (China x2).
 *  Inactive labs return {0, 0}. */
export function leadDays(s: GameStateV2, other: LabId): { est: number; sd: number } {
  const r = other === 'china' ? s.china.lab : s.rivals.find((x) => x.core.id === other);
  if (!r || r.core.status !== 'active') return { est: 0, sd: 0 };
  const sd = Math.round(sigmaOf(r.core.id, 'monthsBehind') * DAYS_PER_MONTH);
  if (!r.npc) return { est: Math.round(lagDays(s, other, 'player')), sd };
  return { est: Math.round(lagDays(s, other, 'player') - r.npc.d + publicOf(s, r).lagDays), sd };
}

/** The player's public prior on a lab's misalignment, from its visible clause type and disclosed incidents only (research/17
 *  §1.6.4: the framework is the main observable). Nothing about the lab's true misalignment enters; it only turns "who is
 *  ahead" into a rough weight for the risk row. */
const PRIOR_BAND: Record<string, [number, number]> = {
  conditional: [0.08, 0.45], allAdopt: [0.12, 0.5], unconditional: [0.15, 0.6], override: [0.2, 0.7], state: [0.15, 0.65],
};
function publicBand(r: RivalLab): [number, number] {
  const [lo, hi] = PRIOR_BAND[r.visible.clauseType] ?? [0.1, 0.6];
  const shift = 0.02 * r.intel.knownIncidents.length;
  return [clamp(lo + shift, 0, 1), clamp(hi + shift, 0, 1)];
}

/** What-if changes to the inputs of the risk-source estimates (J2 RK1): each is an engine lever's effect on what the
 *  player believes (never truth). */
export interface RiskMods {
  /** Days added to your estimated lead over every lab. */
  leadDays?: number;
  /** Added to the believed misalignment estimate (loss-of-control risk, SR-04). */
  mis?: number;
  /** Belief ranges on misalignment scaled by this (loss-of-control risk). */
  sdMult?: number;
  /** Points of stop rate added on the "Acts against the lab" row (loss-of-control risk). */
  stopAdd?: number;
  /** Weight-security levels added. */
  wsl?: number;
  /** Added to the world defence index (0–1). */
  defence?: number;
  /** Dangerous-capability flags (bio, cyber) of the internal model treated as cleared. */
  noFlags?: boolean;
}

/** EngineApi.riskSources: rows from BELIEFS and intel only (§6.6). Estimates are P(catastrophic outcome via this
 *  source) on a 0..1 scale; bands from intel/belief sd. Inactive labs are never listed. `m`: what-if inputs (RK1). */
export function riskSources(s: GameStateV2, m: RiskMods = {}): RiskSource[] {
  const out: RiskSource[] = [];
  const v = internalVersion(s);
  const doom = 0.4; // the player does not know the world's threshold; uses the published-default 0.40
  const curve = (mis: number) => sigmoid((mis - doom) / 0.06);
  // Who reaches ASI first (M4): one distribution over the player and every active lab, w ∝ exp(−days behind the
  // estimated leader / 180) (the scoring epilogue's weights), so the lab rows no longer add up to more than 100%.
  const labs: RivalLab[] = [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])];
  const behind = labs.map((r) => leadDays(s, r.core.id).est + (m.leadDays ?? 0)); // > 0: the player leads that lab
  const lead = Math.max(0, ...behind.map((b) => -b)); // days the best lab is ahead of the player
  const wPlayer = Math.exp(-lead / 180);
  const wLab = behind.map((b) => Math.exp(-(lead + b) / 180));
  const wSum = wPlayer + wLab.reduce((a, x) => a + x, 0);
  const firstShare = (i: number) => wLab[i] / wSum;
  // SR-04 (OD-1, OD-2): your row is Loss-of-control risk, "if it could act now": the believed odds that the engine's
  // loss test fails for the riskiest model you run (safety/lossRisk.ts). Drivers: what removing footholds and what
  // certain beliefs would take off it; the rest is believed misalignment the stop rate does not stop.
  const lr = lossOfControlRisk(s, undefined, { misShift: m.mis, sdMult: m.sdMult, stopAdd: m.stopAdd });
  if (lr) {
    const noFoot = lossOfControlRisk(s, lr.versionId, { misShift: m.mis, sdMult: m.sdMult, stopAdd: m.stopAdd, noFootholds: true })!.p;
    const certain = lossOfControlRisk(s, lr.versionId, { misShift: m.mis, sdMult: 0, stopAdd: m.stopAdd })!.p;
    const dFoot = Math.max(0, lr.p - noFoot);
    const dUnc = Math.max(0, lr.p - certain);
    const rest = Math.max(0, lr.p - dFoot - dUnc);
    const tot = dFoot + dUnc + rest;
    const sh = (x: number, d: number) => (tot > 0 ? x / tot : d);
    out.push({ id: 'own', label: `Loss of control (${lr.name})`, kind: 'ownModel', estimate: clamp(lr.p, 0, 1), band: [clamp(lr.lo, 0, 1), clamp(lr.hi, 0, 1)], drivers: [
      { label: 'Believed misalignment not stopped', share: sh(rest, 1) }, { label: 'Uncertain beliefs', share: sh(dUnc, 0) }, { label: 'Footholds (known and unfound)', share: sh(dFoot, 0) },
    ] });
  }
  const labRow = (r: RivalLab, kind: 'rival' | 'china'): RiskSource => {
    const [lo, hi] = publicBand(r);
    const mid = (lo + hi) / 2;
    const first = firstShare(labs.indexOf(r)); // P(they reach ASI first), from the lead estimates
    return {
      id: kind === 'china' ? 'china' : `rival:${r.core.id}`, label: r.core.name, kind,
      estimate: clamp(first * curve(mid), 0, 1), band: [clamp(first * curve(lo), 0, 1), clamp(first * curve(hi), 0, 1)],
      drivers: [{ label: 'Chance they get there first', share: 0.5 }, { label: 'Their stated safety posture', share: 0.5 }],
    };
  };
  for (const r of activeRivals(s)) out.push(labRow(r, 'rival'));
  if (s.china.lab.core.status === 'active') out.push(labRow(s.china.lab, 'china'));
  const loose = s.player.security.loose;
  const misuseLevel = m.noFlags ? 0 : Math.max(0, ...(v ? [v.flags.bioUplift ? 0.3 : 0, v.flags.cyberOffense ? 0.25 : 0] : [0]));
  // M4 recalibration: the flags give the chance of a severity-5 misuse incident; it turns civilisation-scale only
  // through the §5.1 #4 chain (world tech exposure > 0.6, then P = 0.15·exposure·(1 − defence)). The old row read the
  // flag level itself as P(catastrophe) (32% on the day-900 fixture).
  const exposure = Math.max(0, ...Object.values(s.world.techs).map((t) => t.exposure));
  const defence = clamp(defenceIndex(s) + (m.defence ?? 0), 0, 1);
  const chain = exposure > 0.6 ? 0.15 * exposure * (1 - defence) : 0.15 * exposure * 0.5 * (1 - defence);
  const misuseEst = clamp(0.005 + misuseLevel * chain, 0, 1);
  out.push({ id: 'misuse', label: 'Misuse', kind: 'misuse', estimate: misuseEst, band: [clamp(misuseEst / 2, 0, 1), clamp(0.01 + 2 * misuseLevel * Math.max(chain, 0.05), 0, 1)], drivers: [{ label: 'Dangerous capability flags', share: 0.6 }, { label: 'World tech exposure and defences', share: 0.4 }] });
  // Theft: P(a weight theft within a year) times what it adds to China's row (a stolen frontier puts DeepCent in the race) [D, M4].
  // The probability follows security/theft.ts exactly (theftYearOdds: attempts only from tension CHINAGOV.theftRung, on a lab outsiders
  // pay attention to, holding a model more than 90 days ahead of China, against the weight security level), seen with what the player believes.
  const th = theftYearOdds(s, { lead: leadDays(s, 'china').est + (m.leadDays ?? 0), attention: playerAttention(s), wsl: m.wsl ?? 0 });
  const cnMid = s.china.lab.core.status === 'active' ? (publicBand(s.china.lab)[0] + publicBand(s.china.lab)[1]) / 2 : 0;
  const theftEst = clamp(th.p * 0.3 * curve(cnMid), 0, 1);
  out.push({ id: 'theft', label: 'Theft', kind: 'theft', estimate: theftEst, band: [clamp(theftEst / 2, 0, 1), clamp(th.p * 0.3 * curve(cnMid) * 2 + 0.01, 0, 1)], drivers: th.p > 0 ? [{ label: 'Weight security', share: 0.6 }, { label: 'China intent', share: 0.4 }] : [{ label: th.blocker, share: 1 }] });
  out.push({ id: 'rogue', label: 'Rogue copies', kind: 'rogue', estimate: loose ? 0.5 : 0.01, band: loose ? [0.2, 0.8] : [0, 0.05], drivers: [{ label: loose ? 'A copy is loose' : 'No known escape', share: 1 }] });
  // War: the game ends in war only at China's war footing (tension 4), CHINAGOV.warPerQuarter a quarter (endings.ts); rung 4 is reached
  // only after a rejected treaty with a long US lead (chinagov.ts climb). chinaWarOdds reads exactly that rule.
  const wr = chinaWarOdds(s);
  out.push({ id: 'war', label: 'War', kind: 'war', estimate: wr.p, band: [wr.p / 2, Math.min(1, wr.p * 1.5)], drivers: wr.drivers });
  return out;
}

/** One lever's what-if on the risk sources (J2 RK1): the change it models and how much it moves each source it
 *  touches (percentage points of P(catastrophe via that source), negative = safer). */
export interface RiskLever { id: string; label: string; how: string; mod: RiskMods }
/** Levers by source kind [D: one plausible step each, so the size of each lever reads on one scale]. */
export const RISK_LEVERS: Record<RiskSource['kind'], RiskLever[]> = {
  ownModel: [
    { id: 'mis', label: 'Believed misalignment −0.05', how: 'alignment training, fixes from findings', mod: { mis: -0.05 } },
    { id: 'range', label: 'Belief ranges halved', how: 'validated instruments, evaluations and cases on the model', mod: { sdMult: 0.5 } },
    { id: 'stop', label: 'Stop rate +10 pts', how: 'monitors, a control protocol, human review, containment', mod: { stopAdd: 0.1 } },
  ],
  rival: [{ id: 'lead', label: 'Your lead +60 days', how: 'research speed, compute, a new base sooner', mod: { leadDays: 60 } }],
  china: [{ id: 'lead', label: 'Your lead +60 days', how: 'research speed, compute, a new base sooner', mod: { leadDays: 60 } }],
  misuse: [
    { id: 'defence', label: 'World defences +10 pts', how: 'transition fund, moonshot, world technologies', mod: { defence: 0.1 } },
    { id: 'flags', label: 'Bio and cyber flags cleared', how: 'a model without the dangerous capabilities, or classifier safeguards that hold', mod: { noFlags: true } },
  ],
  theft: [
    { id: 'wsl', label: 'Weight security +1 level', how: 'security level, siloing, counter-intelligence', mod: { wsl: 1 } },
  ],
  rogue: [],
  war: [], // only the treaty choice (when offered) moves it, and that is an event, not a what-if
};

/** Engine what-ifs per risk source (J2 RK1): for each lever of the source's kind, the change in its estimate. */
export function riskLevers(s: GameStateV2): Record<string, { id: string; label: string; how: string; delta: number }[]> {
  const base = riskSources(s);
  const byId = new Map(base.map((r) => [r.id, r]));
  const out: Record<string, { id: string; label: string; how: string; delta: number }[]> = {};
  const cache = new Map<string, Map<string, number>>();
  for (const r of base) {
    out[r.id] = RISK_LEVERS[r.kind].map((l) => {
      const key = JSON.stringify(l.mod);
      let alt = cache.get(key);
      if (!alt) cache.set(key, (alt = new Map(riskSources(s, l.mod).map((x) => [x.id, x.estimate]))));
      return { id: l.id, label: l.label, how: l.how, delta: (alt.get(r.id) ?? byId.get(r.id)!.estimate) - r.estimate };
    });
  }
  return out;
}
