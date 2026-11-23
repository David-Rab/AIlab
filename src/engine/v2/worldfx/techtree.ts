// World technology tree W01–W29 (V2-SPEC §3.11.2; research/16 §3). Owner: WS5.
//
//   World research rate S = 1 + (M_sci − 1)·A_SCI·ExpCap                                   (R16 §3.1)
//   M_sci = 2^((g_sci − λ⁻¹(8))/(1.5·o)) above λ⁻¹(8), else 1 + 0.1·(g_sci − λ⁻¹(5))/o;  g_sci = mean domain G of
//           REASON, AGENCY, CODE (OOM; RD-P04b: v2's L 8 / 1.5 L / 0.1 per L restated through the one λ, o = OOM per level
//           on the V0 → SC segment, exact there; above SC the doubling keeps that segment's slope, a stand-in)
//   ExpCap = min(1, 0.4 + 0.3·[W04 autonomous labs] + 0.3·RobotAvail_SCI)
//   prog += (S + S_player)·dt/Effort once gates (best accessible model) and prerequisites are met
//   Impact ramps as a logistic over Lag years after discovery, compressed by fast-track/in-silico trials (health)
//   and SEZs (physical goods).
// The player's moonshot adds S_player = M_sci(internal)·computeShare·10 [D] and opens the gate to the internal model.
import { TECH_BY_ID, WORLD_TECHS, type TechEffects, type WorldTechDef } from '../../../data/v2/techs';
import { internalVersion } from '../models/labs';
import { domainScaleGs, gOfLevel, levelGate, oomPerLevel } from '../models/capability';
import type { DomainId, GameStateV2, SystemCtx, TimelineWorld } from '../types';
import { worldMix, type WorldMix } from './mix';
import { policyState, sigmoid, techRamp } from './policy';
import { robotAvail } from './robots';

export { techRamp };

/** S_player = M_sci(internal)·share·MOONSHOT_K (10% of compute at internal L_sci 12 ≈ +6 S). [D] */
export const MOONSHOT_K = 10;

/** M_sci on the science domains' mean domain G (OOM; see the header). */
export function mSci(w: TimelineWorld, gSci: number): number {
  const o = oomPerLevel(w, 8);
  const g8 = gOfLevel(w, 8);
  return gSci > g8 ? Math.pow(2, (gSci - g8) / (1.5 * o)) : Math.max(0.5, 1 + (0.1 * (gSci - gOfLevel(w, 5))) / o);
}
/** g_sci: mean domain G (OOM, general λ scale) of REASON, AGENCY, CODE. */
export const gSci = (d: Record<DomainId, number>) => (d.REASON + d.AGENCY + d.CODE) / 3;

/** World science readout (for the World panel and the tech tooltips). */
export function scienceRate(s: GameStateV2, mix?: WorldMix): { S: number; Msci: number; gSci: number; expCap: number; Asci: number } {
  const best = (mix ?? worldMix(s)).bestPublic;
  const g = gSci(best);
  const Msci = mSci(s.hidden.timeline, g);
  const expCap = Math.min(1, 0.4 + 0.3 * techRamp(s, 'W04') + 0.3 * robotAvail(s, 'US', 'SCI'));
  const Asci = s.world.sectors.US.SCI.A;
  return { S: 1 + (Msci - 1) * Asci * expCap, Msci, gSci: g, expCap, Asci };
}

/** Player moonshot science rate on a tech (0 if none). */
export function playerScience(s: GameStateV2, techId: string): number {
  const share = s.world.techs[techId]?.playerProject?.computeShare ?? 0;
  if (share <= 0) return 0;
  const v = internalVersion(s);
  return v ? mSci(s.hidden.timeline, gSci(domainScaleGs(s.hidden.timeline, v))) * share * MOONSHOT_K : 0;
}

/** Why a tech can't progress (undefined = it can). RD-P04b: `g` is domain G (OOM, general λ scale: bestPublic, or
 *  models/capability.ts domainScaleGs); a tech's gate levels (data/v2/techs.ts) convert exactly through the one λ. */
export function techBlocker(s: GameStateV2, t: WorldTechDef, g: Record<DomainId, number>): string | undefined {
  for (const p of t.prereqs) if (s.world.techs[p]?.discoveredDay === undefined) return `needs ${TECH_BY_ID[p]?.name ?? p}`;
  if (t.needs === 'sez' && !policyState(s).sez) return 'needs Special Economic Zones';
  if (t.needs === 'findings' && s.knowledge.publishedFindings.length < 3) return 'needs 3 published safety findings';
  const w = s.hidden.timeline;
  for (const [d, min] of GATES[t.id]) if (g[d] < gOfLevel(w, min)) return `${d} ${min}`;
  return undefined;
}
const GATES: Record<string, [DomainId, number][]> = Object.fromEntries(WORLD_TECHS.map((t) => [t.id, Object.entries(t.gates) as [DomainId, number][]]));

/** Gate domain G (OOM): best public model, or the player's internal model on a moonshot. */
function gateLevels(s: GameStateV2, techId: string, best: Record<DomainId, number>): Record<DomainId, number> {
  if (!s.world.techs[techId]?.playerProject) return best;
  const v = internalVersion(s);
  if (!v) return best;
  const out = { ...best };
  const vg = domainScaleGs(s.hidden.timeline, v);
  for (const k of Object.keys(out) as DomainId[]) out[k] = Math.max(out[k], vg[k]);
  return out;
}

/** Effective lag (years) after compression. */
export function effectiveLag(s: GameStateV2, t: WorldTechDef): number {
  let lag = t.lag;
  const pol = policyState(s);
  if (t.lagChannel === 'health') {
    if (pol.fdaFastTrack) lag *= 0.5;
    if (['W06', 'W07', 'W08', 'W09'].includes(t.id)) lag *= 1 - 0.5 * techRamp(s, 'W05');
  }
  if (t.lagChannel === 'physical' && s.world.robots.sezOpen) lag *= 0.3;
  return lag;
}

/** Summed effects of all technologies at their current ramp. WS1 reads `computeEff`; macro reads `g`. */
export function worldTechEffects(s: GameStateV2): Required<TechEffects> {
  const out: Required<TechEffects> = { g: 0, expCap: 0, sciQ: 0, energy: 0, physFloor: 0, logPhys: 0, benefit: 0, computeEff: 0, persuasion: 0, milP: 0, infraP: 0 };
  const techs = s.world.techs;
  for (const [id, k, x] of EFFECT_LIST) {
    const r = techs[id]?.ramp ?? 0;
    if (r) out[k] += x * r;
  }
  return out;
}
const EFFECT_LIST: [string, keyof TechEffects, number][] = WORLD_TECHS.flatMap((t) =>
  (Object.entries(t.effects) as [keyof TechEffects, number][]).map(([k, x]) => [t.id, k, x] as [string, keyof TechEffects, number]));

/** Risk exposure 0..1 of a risk technology given the best accessible domain G (R16 §3.1 "Risks"; RD-P04b: v2's level
 *  gates through the one λ). */
function exposureOf(s: GameStateV2, t: WorldTechDef, best: Record<DomainId, number>): number {
  const st = s.world.techs[t.id];
  const p = Math.max(Math.min(1, st.prog), st.ramp);
  const w = s.hidden.timeline;
  switch (t.risk) {
    case 'bio': return p * levelGate(w, best.BIO, 10, 1) * (1 - 0.5 * techRamp(s, 'W06'));
    case 'cyber': return p * levelGate(w, best.CYBER, 8, 1) * (1 - 0.3 * techRamp(s, 'W24'));
    case 'persuasion': return p * levelGate(w, best.SOCIAL, 12, 1);
    default: return st.ramp;
  }
}

/** Daily tech progress (called from worldDaily). */
export function advanceTechs(s: GameStateV2, ctx: SystemCtx): void {
  const mix = worldMix(s, ctx);
  const best = mix.bestPublic;
  const { S } = scienceRate(s, mix);
  const dt = 1 / 365;
  for (const t of WORLD_TECHS) {
    const st = s.world.techs[t.id];
    if (!st) continue;
    if (st.discoveredDay === undefined) {
      const blocked = techBlocker(s, t, gateLevels(s, t.id, best));
      if (!blocked) {
        st.prog = Math.min(1, st.prog + ((S + playerScience(s, t.id)) * dt) / t.effort);
        if (st.prog >= 1) {
          st.discoveredDay = ctx.day;
          ctx.headline(t.id === 'W16' ? 'H28' : `H16:${t.id}`, t.headline);
          if (t.effects.benefit) ctx.bump('pub.approval', 0.3 * t.effects.benefit, 'world tech', t.name);
          if (t.id === 'W16') ctx.bump('pub.jobAnxiety', 4, 'world tech', 'general-purpose robots');
        }
      }
    } else {
      const lag = effectiveLag(s, t);
      const yrs = (ctx.day - st.discoveredDay) / 365;
      const prev = st.ramp;
      st.ramp = lag <= 0 ? 1 : yrs >= lag ? 1 : Math.max(prev, (sigmoid(10 * (yrs / lag - 0.5)) - sigmoid(-5)) / (sigmoid(5) - sigmoid(-5)));
      if (t.effects.benefit && prev < 0.5 && st.ramp >= 0.5) ctx.bump('pub.approval', 0.5 * t.effects.benefit, 'world tech', `${t.name} reaches patients`);
    }
    if (t.risk) st.exposure = exposureOf(s, t, best);
  }
}
