// Bottleneck readout selectors (V2-SPEC §3.2.5, §6.4). Owner: WS1.
// `production(s, lab)` = label / binding, labour (copies × speed), ratios vs the reference path. The response charts
// plot the lab's experiment throughput (production.ts expThroughput, a readout only; RD-R01: no aggregate multiplier M),
// relative to today's. RD-A02: the research-mix chart went with the Auto mix (INP-V02).
import { believedInputs, computeProduction, expThroughput, labInputs, type LabInputs } from './production';
import { believedWorld } from './believed';
import type { GameStateV2, LabId, ProductionReadout } from '../types';

/** EngineApi.production: the lab's readout (cached by the daily production system, recomputed if absent). Other
 *  labs' daily caches skip the ceilings and what-ifs, so their readout is recomputed in full here. */
export function production(s: GameStateV2, lab: LabId): ProductionReadout {
  if (lab !== 'player') return computeProduction(s, lab) ?? computeProduction(s, 'player')!;
  const core = lab === 'player' ? s.player : lab === 'china' ? s.china.lab.core : s.rivals.find((r) => r.core.id === lab)?.core;
  return core?.prodCache ?? computeProduction(s, lab) ?? computeProduction(s, 'player')!;
}

/** Response of research speed to scaling one input from ×0.25 to ×4 (today = ×1), others held. Research compute
 *  scales experiments and agents together at today's mix; humans are capabilities staff. */
export interface ResponseCurves { scales: number[]; humans: number[]; research: number[]; experiments: number[]; agents: number[] }

export const RESPONSE_SCALES = [0.25, 0.35, 0.5, 0.7, 1, 1.4, 2, 2.8, 4];

export function responseCurves(s: GameStateV2): ResponseCurves | undefined {
  const raw = labInputs(s, 'player');
  if (!raw) return undefined;
  const inp = believedInputs(s, raw); // UB-2: measured coverage / assist, believed taste
  const w = believedWorld(s); // RD-UI0a: believed production parameters (published prior), never the hidden draw
  const X0 = Math.max(1e-12, expThroughput(w, inp));
  const rel = (o: Partial<Pick<LabInputs, 'h' | 'k' | 'c'>>) => expThroughput(w, inp, o) / X0;
  return {
    scales: RESPONSE_SCALES,
    humans: RESPONSE_SCALES.map((x) => rel({ h: inp.h * x })),
    research: RESPONSE_SCALES.map((x) => {
      const f = inp.c / Math.max(1e-12, inp.mixUnit.c);
      return rel({ c: f * inp.mixUnit.c * x, k: (1 - f) * inp.mixUnit.k * x });
    }),
    experiments: RESPONSE_SCALES.map((x) => rel({ c: inp.c * x })),
    agents: RESPONSE_SCALES.map((x) => rel({ k: inp.k * x })),
  };
}
