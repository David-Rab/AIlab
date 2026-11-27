// The matched research speed-up `spdM` (R3.2): the game quantity that is defined as the AI Futures Model's AI software-R&D
// progress multiplier (ai_sw_progress_mult_ref_present_day, metrics_computation.py:520-535): the research rate WITH the AI's
// current labour and taste divided by the rate WITHOUT AI (humans only, human taste only), both at the SAME frozen resources,
// the AIFM's present day (here 2026.578): the lab's human staff, its agent compute and its experiment compute as of that date,
// and the unit scale. Only the AI's skill (coverage, assist, FTE per H100e, taste sd_AI) moves with time. It carries no compute or
// staff growth, which is why the game's labSpeedRel (the player's own research speed) is a different quantity.
//
//   spdM = [ X(cbar_ref, l_with) / X(cbar_ref, 1) ]  x  [ Tai(sd_AI, s_AI) / Tai(sd_AI, 0) ]
//
// X is the experiment throughput of the engine's own CES (production.ts expThroughput) at the reference inputs, with and without AI
// labour; Tai is the capabilities science teams' taste (workfit.ts teamTaste) with and without AI's share of the ideas.
// Logic as the SPEEDUP-DIAG probe (.scratch/su-probe.ts matched()). PURE READ: every call is an engine getter on the live state
// with override inputs (copies of the reference LabInputs, scaled labourOf calls); nothing is written to the game state.
// Before the reference date the resources of that moment are used (the reference is then "now"; 2025.5 differs from 2026.578 by
// under 0.07 log10 in the diagnosis).
import { decimalYear } from '../../src/engine/v2/core/time';
import { PLAYER_ID } from '../../src/engine/v2/models/labs';
import { expThroughput, labInputs, type LabInputs } from '../../src/engine/v2/production/production';
import { labourOf, humanTasteMean, tasteLimitOf, teamTaste, workContext } from '../../src/engine/v2/departments/workfit';
import type { GameStateV2 } from '../../src/engine/v2/types';

/** The AIFM's present day in the aifm-public Eli config runs (parameters.present_day). */
export const AIFM_PRESENT_DAY = 2026.578;

interface Ref { inp: LabInputs; Hx: number; kx: number; Hi: number; ki: number }
const snapshot = (s: GameStateV2): Ref | undefined => {
  const inp = labInputs(s, PLAYER_ID);
  if (!inp) return undefined;
  const wc = workContext(s);
  return { inp, Hx: wc.slots.EXP.H, kx: wc.slots.EXP.h100e, Hi: wc.slots.IDEAS.H, ki: wc.slots.IDEAS.h100e };
};

/** The capabilities science teams' mean taste at AI taste sd_AI and AI's ideas share sAI (workfit.ts teamTaste, as production.ts playerInputs). */
function tasteAt(s: GameStateV2, sdAI: number, sAI: number): number {
  const w = s.hidden.timeline;
  const m2b = w.prod.m2b, tl = tasteLimitOf(w), star = humanTasteMean(s);
  let cap = 0, tai = 0;
  for (const t of s.player.teams) {
    if (t.role !== 'sci' || t.dept !== 'cap') continue;
    cap += t.heads;
    tai += t.heads * teamTaste(0, sdAI, sAI, m2b, star, tl);
  }
  return cap > 0 ? tai / cap : 1;
}

/** spdM at the state's date against the reference snapshot `ref`; null when the lab has no inputs or the ratio is not finite. */
function matched(s: GameStateV2, ref: Ref): number | null {
  const w = s.hidden.timeline;
  const wc = workContext(s);
  const ex = wc.slots.EXP, id = wc.slots.IDEAS;
  // today's AI (its model's fit, FTE per H100e, taste) with the reference date's human labour and agent compute
  const lab = labourOf(s, 'EXP', { h: ex.H > 1e-12 ? ref.Hx / ex.H : 1, k: ex.h100e > 1e-12 ? ref.kx / ex.h100e : 0 });
  const idl = labourOf(s, 'IDEAS', { h: id.H > 1e-12 ? ref.Hi / id.H : 1, k: id.h100e > 1e-12 ? ref.ki / id.h100e : 0 });
  const base = ref.inp.v3;
  const withAI: LabInputs = { ...ref.inp, v3: { ...base, a: lab.fit.a, assist: lab.fit.assist, AI0: lab.AI } };
  const noAI: LabInputs = { ...ref.inp, v3: { ...base, a: 0, assist: 1, AI0: 0 } };
  const m = (expThroughput(w, withAI) / expThroughput(w, noAI)) * (tasteAt(s, wc.sdAI, idl.sAI) / tasteAt(s, wc.sdAI, 0));
  return Number.isFinite(m) && m > 0 ? m : null;
}

/** One game's recorder: call `observe(s)` after every tick (it freezes the reference at the first tick on or after the AIFM's
 *  present day), `read(s)` at a sample. */
export function matchedSpeedup() {
  let ref: Ref | undefined;
  return {
    observe(s: GameStateV2): void {
      if (!ref && decimalYear(s) >= AIFM_PRESENT_DAY) ref = snapshot(s);
    },
    read(s: GameStateV2): number | null {
      const r = ref ?? snapshot(s);
      return r ? matched(s, r) : null;
    },
  };
}
