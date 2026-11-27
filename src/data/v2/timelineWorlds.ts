// R3.1 (design/BAL-TASKS.md round 3): the per-game draw worlds tl-fast / tl-central / tl-slow. Each is the authors2026 world (its
// compute table, start and every setting the translation does not carry) with ONE AI Futures Model run's translated settings per game
// (data/v2/timelineDraws.ts, generated: one row per run of the timeline's SAR group). world/hidden.ts picks the row from the game's
// seed. The median of the outcomes of 290 games is not the outcome of the median settings (design/bal/SPEEDUP-DIAG.md: the post-SC
// loop is nonlinear and the median settings sit near its knife edge), which is why a game draws a whole run and not the group median.
import type { TimelinePresetId } from '../../engine/v2/types';
import { DRAW_FIELDS, TIMELINE_DRAWS, type DrawField, type TimelineId } from './timelineDraws';

export const TIMELINE_PRESETS: readonly TimelinePresetId[] = ['tl-fast', 'tl-central', 'tl-slow'];
export const timelineOf = (w: string): TimelineId | undefined => (w === 'tl-fast' ? 'fast' : w === 'tl-central' ? 'central' : w === 'tl-slow' ? 'slow' : undefined);

/** The settings that go to the world's calibration (V3_CAL) and its production parameters (ProdParams). */
export interface DrawnSettings {
  v3: { gSC: number; sdSC: number; dBM: number; r: number; tasteLimit: number; stockAgeYears: number };
  prod: { rc: number; lam: number; La: number; Ca: number; slow10: number; m2b: number };
}
const idx = (f: DrawField) => DRAW_FIELDS.indexOf(f);
const settingsOf = (row: readonly number[]): DrawnSettings => {
  const g = (f: DrawField) => row[idx(f)];
  return {
    v3: { gSC: g('gSC'), sdSC: g('sdSC'), dBM: g('dBM'), r: g('r'), tasteLimit: g('tasteLimit'), stockAgeYears: g('stockAgeYears') },
    prod: { rc: g('rc'), lam: g('lam'), La: g('La'), Ca: g('Ca'), slow10: g('slow10'), m2b: g('m2b') },
  };
};

/** One drawn run of a timeline: its index in the group, its id ("eli_<job>:<sample>") and its translated settings. */
export function drawAt(tl: TimelineId, index: number): { index: number; id: string } & DrawnSettings {
  const d = TIMELINE_DRAWS[tl];
  return { index, id: d.runs[index], ...settingsOf(d.rows[index]) };
}
export const drawCount = (tl: TimelineId): number => TIMELINE_DRAWS[tl].rows.length;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
/** The group medians of the drawn settings (the round-2 median-based timelines): the world's BELIEF (what the player's lab
 *  expects of the production function, production/believed.ts) and the fallback of a world built without a seed. */
function medianSettings(tl: TimelineId): DrawnSettings {
  const rows = TIMELINE_DRAWS[tl].rows;
  return settingsOf(DRAW_FIELDS.map((_, i) => median(rows.map((r) => r[i]))));
}
export const TL_MEDIAN: Record<TimelinePresetId, DrawnSettings> = {
  'tl-fast': medianSettings('fast'), 'tl-central': medianSettings('central'), 'tl-slow': medianSettings('slow'),
};
