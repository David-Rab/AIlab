// SR-22: the Safety work package (SAFETY-REDESIGN §3.10; RD-S08 / SAF-26). Owner: WS2.
//
// AI staff doing safety work run on the safety agent package (player.agents.safety: its model, RD-A06; its compute,
// RD-A05a). The package adds a human SPOT-CHECK share q (none / 2% / 10%): the fraction of AI-done safety work the
// safety engineers re-check, Greenblatt et al.'s audit budget (2% in their APPS setting; research/20 F4) [S]. It is
// the real control lever on sabotage of safety work:
//   staff   q × SPOT_COST × the human heads the AI's share of safety work would take (Σ A_k · H_k · heads_k over SAF_EXP
//           and SAF_IDEAS), the 'spotCheck' need in the safety needs list (SR-21); served share σ = got ÷ demand;
//   catch   a sabotaged item in the re-checked sample is caught by the human reviewer as human review catches acts in
//           the work humans do (HUMAN_REVIEW × the reviewer's gap factor, model v3 E6): spot = q·σ · HUMAN_REVIEW · gap;
//           SAFSAB's catch becomes 1 − (1 − catch)(1 − spot) (covert.ts safetySabotage);
//   validation  an AI-assisted validation of a false (sabotaged) instrument: each planted case is re-run by humans with
//           probability q·σ and then finds what the instrument really finds (validation.ts), so a spot-checked false
//           instrument shows found below its expected recall.
// SPOT_COST = 1 [D]: re-checking a piece of work takes the human time of doing it (an audit re-derives the result).
// Each safety job records its AI share, the served spot-check share, its expected result (beliefs before the job's own
// evidence) and its observed result (types.ts SafJobResult): a gap is evidence read by the player, never a truth leak.
import type { AgendaId, GameStateV2, ModelVersion, SafJobResult } from '../types';
import { HUMAN_REVIEW } from '../../../data/v2/danger';
import { WORK_TYPES } from '../../../data/v2/workTypes';
import { safetyLabour } from '../departments/workfit';
import { clamp01 } from './common';
import { lineLabour, needServed } from './lineProjects';
import { gapFactor, humanReviewFactor, oversightGap } from './oversight';
import { HUMAN_REVIEW_L } from '../../../data/v2/oversight';

/** The spot-check choices (share of AI-done safety work humans re-check). */
export const SPOT_SHARES = [0, 0.02, 0.1] as const;
/** Human time to re-check a unit of AI-done safety work ÷ the time to do it [D]. */
export const SPOT_COST = 1;

/** The chosen spot-check share (0 when unset). */
export const spotCheckChosen = (s: GameStateV2): number => clamp01(s.player.agents.safety?.spotCheck ?? 0);

/** Human heads the AI's share of safety work would take (Σ A · H · heads over the two safety work types). */
export function aiDoneHeads(s: GameStateV2): number {
  const sl = safetyLabour(s);
  return sl.exp.A * sl.exp.H * WORK_TYPES.SAF_EXP.heads + sl.ideas.A * sl.ideas.H * WORK_TYPES.SAF_IDEAS.heads;
}

/** The 'spotCheck' need's demand (safety engineers, heads) at share q (default the chosen one). */
export const spotCheckFte = (s: GameStateV2, q = spotCheckChosen(s)): number => clamp01(q) * SPOT_COST * aiDoneHeads(s);

/** Spot-check share in effect: the chosen share × the share of its staff served today. */
export function spotShare(s: GameStateV2): number {
  const q = spotCheckChosen(s);
  return q > 0 ? q * needServed(s, 'spotCheck') : 0;
}

/** Catch of a sabotaged AI safety work item by the spot-checks (on model v, the one doing the work), at share `q`
 *  in effect (default today's). */
export function spotCatch(s: GameStateV2, v: ModelVersion, q = spotShare(s)): number {
  return clamp01(q * HUMAN_REVIEW * humanReviewFactor(s, v));
}

/** The lab's estimate of spotCatch (previews, readouts): the reviewer's gap at the model's MEASURED level. */
export function believedSpotCatch(s: GameStateV2, v: ModelVersion, q = spotShare(s)): number {
  const L = v.evals.measuredL ?? 0;
  return clamp01(q * HUMAN_REVIEW * gapFactor(oversightGap(s.hidden.timeline, L, HUMAN_REVIEW_L).oom));
}

/** AI share of a safety job's work: a line's (stage-weighted), a validation or case (the safety experiments' A; 0 when
 *  human-run), an eval suite (self-run: the experiments' A; external evaluators: 0). */
export function jobAiShare(s: GameStateV2, kind: 'line' | 'validation' | 'case' | 'suite', opts: { agenda?: AgendaId; human?: boolean } = {}): number {
  if (opts.human) return 0;
  if (kind === 'line' && opts.agenda) return clamp01(lineLabour(s, opts.agenda).aiShare);
  return clamp01(safetyLabour(s).exp.A);
}

/** A job's record at its start (or before its own evidence): AI share, spot-check share in effect, expected result. */
export function jobRecord(s: GameStateV2, aiShare: number, expected: number): SafJobResult {
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return { aiShare: r3(aiShare), spot: aiShare > 0 ? r3(spotShare(s)) : 0, expected: r3(clamp01(expected)) };
}

/** Expected vs observed results of a line over the last `days` (SAF-26: results per year): Σ expected chance it works
 *  and Σ working results over its finished tests. */
export function lineExpectedObserved(s: GameStateV2, ag: AgendaId, days = 365): { n: number; expected: number; observed: number; aiShare: number } {
  let n = 0, e = 0, o = 0, a = 0;
  for (const f of s.player.safety.findings) {
    if (f.agenda !== ag || !f.job || s.time.day - f.day > days) continue;
    n++;
    e += f.job.expected;
    o += f.job.observed ?? 0;
    a += f.job.aiShare;
  }
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return { n, expected: r2(e), observed: r2(o), aiShare: n ? r2(a / n) : 0 };
}
