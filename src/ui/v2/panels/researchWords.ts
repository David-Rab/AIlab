// RESEARCH words shared by Portfolio, Know-how and Discoveries (UB-6/UB-8; VOCAB.md, DATA.md "Display names"). Player
// names for programmes and results whose engine names break VOCAB ("RL", "interp", "agents" = the product only).
import type { Column, StageId, StackKey } from '../../../engine/v2';
import { ICON } from '../icons';

const DISPLAY: Record<string, string> = {
  'RL algorithms': 'Post-training algorithms',
  'Inference efficiency': 'Faster serving',
  'Multi-agent orchestration': 'Coordinating many copies',
  'Applied interp': 'Applied interpretability',
  'Ambitious mech interp': 'Ambitious interpretability',
  'Dev interp / SLT': 'Developmental interpretability',
  'AI control': 'Control protocols',
  'CoT monitorability': 'Readable reasoning',
  'Auditing agents': 'AI auditors',
  'Monitorability suite': 'Reasoning-readability evals',
};
/** The player name of a programme, project or result. */
export const dispName = (name: string) => DISPLAY[name] ?? name;

export const COL_ICON: Record<Column, typeof ICON.L> = { pretraining: ICON.colPretraining, posttraining: ICON.colPosttraining, systems: ICON.colSystems, alignment: ICON.colAlignment, interp: ICON.colInterp, evals: ICON.colEvals };
export const STAGE_LABEL: Record<StageId, string> = { test: 'Test', ideation: 'Ideas', small: 'Small test', scale: 'Big test', adoption: 'Build-in' };
export const STAGE_TERM: Record<StageId, string> = { test: 'stageTest', ideation: 'stageIdeation', small: 'stageSmall', scale: 'stageScale', adoption: 'stageAdoption' };
/** VOCAB know-how area names and their own quantity. */
export const AREA_NAME: Record<StackKey, string> = { pre: 'Pretraining recipe', rlMid: 'Post-training method', rlCeil: 'Post-training ceiling', train: 'Training efficiency', serve: 'Serving efficiency' };
export const AREA_UNIT: Record<StackKey, string> = { pre: 'effective compute for new base models', rlMid: 'post-training compute', rlCeil: 'of the ceiling', train: 'useful training per chip-day', serve: 'work served per chip' };
/** Short "where it lands" words per area (cards). */
export const AREA_LANDS: Record<StackKey, string> = { pre: 'next base model', rlMid: 'next post-training', rlCeil: 'next post-training', train: 'every run, at once', serve: 'all serving, at once' };
export const AREA_ICON: Record<StackKey, typeof ICON.L> = { pre: ICON.colPretraining, rlMid: ICON.colPosttraining, rlCeil: ICON.colPosttraining, train: ICON.colSystems, serve: ICON.colSystems };
/** VOCAB OQ-3: a programme is ongoing, a project one-off. */
export const KIND_CHIP: Record<string, string> = { line: 'ongoing', idea: 'one-off', axis: 'one-off' };

/** × with sensible precision: ×1.037, ×1.19, ×3.4. */
export const xf = (v: number, d?: number) => `×${v.toFixed(d ?? (v >= 1.995 ? 1 : Math.abs(v - 1) < 0.1 ? 3 : 2))}`;
/** A ratio as the nearest simple fraction (returns falling: "~¾ of the first"). */
const FRACS: [number, string][] = [[1, '1'], [7 / 8, '⅞'], [5 / 6, '⅚'], [4 / 5, '⅘'], [3 / 4, '¾'], [2 / 3, '⅔'], [3 / 5, '⅗'], [1 / 2, '½'], [2 / 5, '⅖'], [1 / 3, '⅓'], [1 / 4, '¼'], [1 / 5, '⅕'], [1 / 6, '⅙'], [1 / 8, '⅛'], [1 / 10, '⅒']];
export function fracWord(r: number): string {
  if (!(r > 0)) return '0';
  if (r < 0.075) return `1/${Math.round(1 / r)}`;
  return FRACS.reduce((b, f) => (Math.abs(f[0] - r) < Math.abs(b[0] - r) ? f : b))[1];
}
