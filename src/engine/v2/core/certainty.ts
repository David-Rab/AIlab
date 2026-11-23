// UB-2: one certainty scale for every estimate the R&D screens show (VOCAB §0 rule 4: a range plus a word), and the one
// "Unknown" rule (VOCAB §1 Belief: range wider than 30 points). Pure display helpers: no engine number depends on them.
//
// Display thresholds (UB-2, stated here and in BUILD-NOTES):
// - a chance or share (0..1) with a 90% range: width in points (hi − lo) × 100: ≤ 5 "sure", ≤ 15 "fairly sure",
//   ≤ 30 "fairly unsure", > 30 Unknown;
// - a size (an effect, a × or a count) with a 90% range: relative half-width (hi − lo) ÷ (2·|best guess|): ≤ 0.15 "sure",
//   ≤ 0.4 "fairly sure", ≤ 1 "fairly unsure", > 1 "very unsure" (the range reaches no effect or twice the guess).
// The four words are the same on both; only the measure of width differs (points for chances, share of the guess for
// sizes).

export type CertaintyWord = 'sure' | 'fairly sure' | 'fairly unsure' | 'very unsure';
export const CERTAINTY_WORDS: readonly CertaintyWord[] = ['sure', 'fairly sure', 'fairly unsure', 'very unsure'];
/** VOCAB: a belief whose 90% range is wider than this many points reads **Unknown**. */
export const UNKNOWN_RANGE_PTS = 30;
/** Width cut-offs (points) for chances, and (share of the guess) for sizes, between the four words. */
export const CHANCE_WIDTH_PTS = [5, 15, 30] as const;
export const SIZE_REL_WIDTH = [0.15, 0.4, 1] as const;

/** VOCAB's Unknown rule: a chance whose 90% range [lo, hi] (0..1) is wider than 30 points. */
export const isUnknown = (lo: number, hi: number): boolean => (hi - lo) * 100 > UNKNOWN_RANGE_PTS;

export interface Certainty { word: CertaintyWord; unknown: boolean; width: number }

/** Certainty of a chance or share (0..1) with its 90% range. */
export function chanceCertainty(lo: number, hi: number): Certainty {
  const w = Math.max(0, hi - lo) * 100;
  const i = CHANCE_WIDTH_PTS.findIndex((c) => w <= c);
  return { word: CERTAINTY_WORDS[i < 0 ? 3 : i], unknown: isUnknown(lo, hi), width: w };
}

/** Certainty of a size (an effect or a ×, in any unit where 0 = no effect) with its 90% range. */
export function sizeCertainty(mid: number, lo: number, hi: number): Certainty {
  const r = Math.abs(mid) > 1e-12 ? Math.max(0, hi - lo) / (2 * Math.abs(mid)) : Infinity;
  const i = SIZE_REL_WIDTH.findIndex((c) => r <= c);
  return { word: CERTAINTY_WORDS[i < 0 ? 3 : i], unknown: false, width: r };
}
