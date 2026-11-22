// Unknown-unknown failure modes: presence, effects, discovery (V2-SPEC §3.5.5). Owner: WS2.
import { UMODES, UMODE_BY_ID, UMODE_PRESENCE } from '../../../data/v2/umodes';
import type { BaseDesign, GameStateV2, ModelVersion, RngLike, SystemCtx, TraitId, UModeId } from '../types';
import { adopted, setFlag } from './common';

export interface LineageDrawOpts {
  /** Capability tier ≥ SC (speculative modes U16–U22 need it). */
  tierAtLeastSC: boolean;
  base?: BaseDesign;
  /** Paradigm adoption modifiers apply to the player only (rivals pass false). */
  player?: boolean;
}

/**
 * U-modes present in a new lineage (§3.5.5): p = propensity × modifiers (synthetic → U01 ×1.5, P08 → U14 ×1.3,
 * safety pretraining → U07 ×0.5, P20 → U19 ×1.3); publicly revealed modes × 0.7 for every lab.
 */
export function drawLineageUModesV2(s: GameStateV2, rng: RngLike, o: LineageDrawOpts): UModeId[] {
  const out: UModeId[] = [];
  const revealed = new Set(s.knowledge.revealedUModes);
  for (const u of UMODES) {
    if (u.kind === 'speculative' && !o.tierAtLeastSC) continue;
    let p = s.hidden.uModePropensity[u.id] ?? 0;
    if (o.base?.data === 'synthetic' && u.id === 'U01') p *= UMODE_PRESENCE.syntheticU01;
    if (o.base?.curation.safetyPretrain && u.id === 'U07') p *= UMODE_PRESENCE.safetyPretrainU07;
    if (o.player) {
      if (u.id === 'U14' && adopted(s, 'P08')) p *= UMODE_PRESENCE.p08U14;
      if (u.id === 'U19' && adopted(s, 'P20')) p *= UMODE_PRESENCE.p20U19;
    }
    if (revealed.has(u.id)) p *= UMODE_PRESENCE.revealed;
    if (rng.chance(Math.min(1, p))) out.push(u.id);
  }
  return out;
}

export function isDiscovered(s: GameStateV2, u: UModeId): boolean {
  return s.player.safety.discoveredUModes.includes(u);
}

/** U-modes present in a version and not yet discovered by the player (their observation effects apply). Engine only. */
export function hiddenUModes(s: GameStateV2, v: { uModes: UModeId[] }): UModeId[] {
  return v.uModes.filter((u) => !isDiscovered(s, u));
}

/** Per-unit-ω trait amplification from the U-modes a lineage carries (§3.5.5 "adds to the trait it amplifies"). */
export function uModeAmp(uModes: readonly UModeId[]): Partial<Record<TraitId, number>> {
  const out: Partial<Record<TraitId, number>> = {};
  for (const u of uModes) {
    const amp = UMODE_BY_ID[u]?.effect.amp;
    if (amp) for (const [k, v] of Object.entries(amp) as [TraitId, number][]) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

/** Edge multipliers from present U-modes. */
export function uModeEdgeMult(uModes: readonly UModeId[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const u of uModes) {
    const m = UMODE_BY_ID[u]?.effect.edgeMult;
    if (m) for (const [e, x] of Object.entries(m)) out[e] = (out[e] ?? 1) * x;
  }
  return out;
}

/** Training-gaming level at which values crystallise (E23: 0.5; U20 value crystallization lowers it to 0.3). */
export function crystalThreshold(uModes: readonly UModeId[]): number {
  let t = 0.5;
  for (const u of uModes) t = Math.min(t, UMODE_BY_ID[u]?.effect.crystalAt ?? 0.5);
  return t;
}

/** Removal multiplier from crystallisation: × 0.3 once TGAME exceeds the threshold (E23). */
export function crystalMult(tgame: number, uModes: readonly UModeId[]): number {
  return tgame > crystalThreshold(uModes) ? 0.3 : 1;
}

/** Removal multiplier (U16 gradient hacking ×0.5 = E26). */
export function uModeRemovalMult(uModes: readonly UModeId[]): number {
  let m = 1;
  for (const u of uModes) m *= UMODE_BY_ID[u]?.effect.removalMult ?? 1;
  return m;
}

export function uModeContainMult(uModes: readonly UModeId[]): number {
  let m = 1;
  for (const u of uModes) m *= UMODE_BY_ID[u]?.effect.containMult ?? 1;
  return m;
}

/** Hidden sabotage of the version doing safety research: sab = SAND + SCHEME + 0.5·[U17 present] (§3.5.3, E20). */
export function sabOf(v: ModelVersion | undefined): number {
  if (!v) return 0;
  let extra = 0;
  for (const u of v.uModes) extra += UMODE_BY_ID[u]?.effect.sab ?? 0;
  return v.traitsTrue.SAND + v.traitsTrue.SCHEME + extra;
}

/**
 * Discover a U-mode (§3.5.5): the card appears, past incidents caused by it are relabelled ("we were wrong"), its
 * counters become researchable. `present` = found in one of your models (vs the world learning it exists).
 * E35 is WS4's event; its trigger reads flags 'ws2.lastDiscoveryDay' / 'ws2.lastDiscovery'.
 */
export function discoverUMode(s: GameStateV2, ctx: SystemCtx, u: UModeId): void {
  const dept = s.player.safety;
  if (dept.discoveredUModes.includes(u)) return;
  dept.discoveredUModes.push(u);
  const def = UMODE_BY_ID[u];
  let relabelled = 0;
  for (const inc of dept.incidents) {
    if (inc.trueSource === u && inc.apparent === 'unexplained') {
      inc.apparent = def.mapsTo;
      relabelled++;
    }
  }
  const present = s.player.models.versions.some((v) => v.status !== 'retired' && v.uModes.includes(u));
  setFlag(s, 'lastDiscovery', u);
  setFlag(s, 'lastDiscoveryDay', ctx.day);
  ctx.log(
    'research',
    present
      ? `Discovery: ${def.name}. It is in our models${relabelled ? `; ${relabelled} past incident(s) relabelled. We were wrong.` : '.'}`
      : `Discovery: ${def.name} is a real failure mode. No sign of it in our models yet.`,
    present ? 4 : 2,
    u,
  );
}

/** Disclose a discovered U-mode to the world: every lab's future lineages get presence × 0.7 (§3.5.5). */
export function revealToWorld(s: GameStateV2, u: UModeId): boolean {
  if (s.knowledge.revealedUModes.includes(u)) return false;
  s.knowledge.revealedUModes.push(u);
  return true;
}
