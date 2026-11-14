// Bottleneck readout selectors (V2-SPEC §3.2.5, §6.4). Owner: WS1.
// `production(s, lab)` = the bottleneck bar: decomposition (parts multiply to M), elasticities, per-$ values,
// ceilings, what-ifs, label/binding, labour (copies × speed), ratios vs the reference path.
import { decimalYear } from '../core/time';
import { dataStockRatio, effectiveStock, tokensRequired } from './data';
import { frontierFlop } from './knots';
import { computeProduction, evalProduction, labInputs, tcoPerH100eYear, type LabInputs } from './production';
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
