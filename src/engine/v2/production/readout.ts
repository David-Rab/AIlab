// Bottleneck readout selectors (V2-SPEC §3.2.5, §6.4). Owner: WS1.
// `production(s, lab)` = the bottleneck bar: decomposition (parts multiply to M), elasticities, per-$ values,
// ceilings, what-ifs, label/binding, labour (copies × speed), ratios vs the reference path.
import { decimalYear } from '../core/time';
import { dataStockRatio, effectiveStock, tokensRequired } from './data';
import { frontierFlop } from './knots';
import { bestResearchMix, computeProduction, evalM, evalProduction, inputsAtMix, labInputs, tcoPerH100eYear, type LabInputs } from './production';
import { trainingFlopPerDay } from '../models/runs';
import type { GameStateV2, LabId, ProductionReadout } from '../types';

/** EngineApi.production: the lab's readout (cached by the daily production system, recomputed if absent). Other
 *  labs' daily caches skip the ceilings and what-ifs, so their readout is recomputed in full here. */
export function production(s: GameStateV2, lab: LabId): ProductionReadout {
  if (lab !== 'player') return computeProduction(s, lab) ?? computeProduction(s, 'player')!;
  const core = lab === 'player' ? s.player : lab === 'china' ? s.china.lab.core : s.rivals.find((r) => r.core.id === lab)?.core;
  return core?.prodCache ?? computeProduction(s, lab) ?? computeProduction(s, 'player')!;
}

/** What-if readout with modified inputs (UI sliders: "what if I double experiments?"). */
export function productionWhatIf(s: GameStateV2, lab: LabId, change: Partial<Pick<LabInputs, 'h' | 'k' | 'c' | 'd' | 'tasteHire'>>): ProductionReadout | undefined {
  const inp = labInputs(s, lab);
  return inp ? evalProduction(s.hidden.timeline, { ...inp, ...change }) : undefined;
}

/** Research-mix trade-off: research speed M as the research compute (experiments + agents) is re-split, from all
 *  agents (f = 0) to all experiments (f = 1). `current` is today's experiments share, `best` the best one. */
export interface MixCurve { points: { f: number; M: number }[]; current: number; best: number; Mcurrent: number; Mbest: number; manual: boolean; research: number }

export function researchMixCurve(s: GameStateV2, n = 41): MixCurve | undefined {
  const inp = labInputs(s, 'player');
  if (!inp) return undefined;
  const w = s.hidden.timeline;
  const at = (f: number) => evalM(w, inputsAtMix(inp, f)).M;
  const points: { f: number; M: number }[] = [];
  for (let i = 0; i < n; i++) {
    const f = 0.02 + (0.96 * i) / (n - 1);
    points.push({ f, M: at(f) });
  }
  const sp = s.player.split;
  const r = sp.experiments + sp.agents;
  const current = r > 0 ? sp.experiments / r : 0.5;
  const best = bestResearchMix(s, inp);
  return { points, current, best, Mcurrent: evalM(w, inp).M, Mbest: at(best), manual: !!s.player.researchManual, research: s.player.computeOnline * r };
}

/** Response of research speed to scaling one input from ×0.25 to ×4 (today = ×1), others held. Research compute
 *  scales experiments and agents together at the best mix; humans are capabilities staff. */
export interface ResponseCurves { scales: number[]; humans: number[]; research: number[]; experiments: number[]; agents: number[] }

export const RESPONSE_SCALES = [0.25, 0.35, 0.5, 0.7, 1, 1.4, 2, 2.8, 4];

export function responseCurves(s: GameStateV2): ResponseCurves | undefined {
  const inp = labInputs(s, 'player');
  if (!inp) return undefined;
  const w = s.hidden.timeline;
  const M0 = evalM(w, inp).M;
  const rel = (o: Partial<LabInputs>) => evalM(w, { ...inp, ...o }).M / M0;
  const fBest = (x: number) => bestResearchMix(s, { ...inp, mixUnit: { ...inp.mixUnit, c: inp.mixUnit.c * x, k: inp.mixUnit.k * x } });
  return {
    scales: RESPONSE_SCALES,
    humans: RESPONSE_SCALES.map((x) => rel({ h: inp.h * x })),
    research: RESPONSE_SCALES.map((x) => {
      const cIdle = inp.mixUnit.cIdle ?? 0; // idle training compute is not research compute: it stays as it is
      const f = s.player.researchManual ? ((inp.c - cIdle) / Math.max(1e-12, inp.mixUnit.c)) : fBest(x);
      return rel({ c: f * inp.mixUnit.c * x + cIdle, k: (1 - f) * inp.mixUnit.k * x });
    }),
    experiments: RESPONSE_SCALES.map((x) => rel({ c: inp.c * x })),
    agents: RESPONSE_SCALES.map((x) => rel({ k: inp.k * x })),
  };
}

/** "Next model" mini-bar (§3.2.5): what gates the next frontier base run. */
export interface NextModelGate { trainingDays: number; dataRatio: number; mwFree: number; cashShare: number; binding: 'training' | 'data' | 'power' | 'cash' }

export function nextModelGate(s: GameStateV2): NextModelGate {
  const w = s.hidden.timeline;
  const yr = decimalYear(s);
  const F = frontierFlop(w, yr);
  const trainingDays = F / Math.max(1, trainingFlopPerDay(s));
  const dataRatio = effectiveStock(s) / tokensRequired(F);
  let mwFree = 0;
  for (const site of s.player.sites) if (site.stage === 'live') mwFree += site.mw - (site.installed * s.power.kWPerH100e) / 1000;
  const runCash = 0.5 * (F / 3.46e19 / 365) * tcoPerH100eYear(s, yr); // env budget of a reference post on it [D]
  const cashShare = runCash / Math.max(0.01, s.player.finance.cash);
  let binding: NextModelGate['binding'] = 'training';
  if (dataStockRatio(s, yr) < 1) binding = 'data';
  else if (cashShare > 0.5) binding = 'cash';
  else if (mwFree <= 0 && trainingDays > 120) binding = 'power';
  return { trainingDays, dataRatio, mwFree, cashShare, binding };
}
