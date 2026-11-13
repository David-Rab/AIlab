// record (160, weekly): series samples and cause-ledger trim (V2-SPEC §2.2, §2.5 budgets). Owner: WS1.
import { bestLg, internalVersion, otherLabs } from '../models/labs';
import { misalignment, misalignmentEstimate } from '../safety/traits';
import { understanding } from '../safety/understanding';
import { trimCauses } from './causes';
import type { EngineSystem, GameStateV2, SeriesV2 } from '../types';

export function emptySeries(labIds: string[]): SeriesV2 {
  return {
    day: [], L: Object.fromEntries(labIds.map((id) => [id, [] as number[]])), Lmeasured: [], U: [], M: [], cash: [], revenue: [],
    valuation: [], compute: [], approval: [], trustGov: [], scrutiny: [], gdpG: [], unemp: [], misTrue: [], misEst: [],
  };
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function sampleSeries(s: GameStateV2) {
  const S = s.series;
  const v = internalVersion(s);
  S.day.push(s.time.day);
  (S.L.player ??= []).push(r3(bestLg(s, 'player')));
  for (const r of otherLabs(s)) (S.L[r.core.id] ??= []).push(r3(bestLg(s, r.core.id)));
  S.Lmeasured.push(r3(v?.evals.measuredL ?? 0));
  S.U.push(r3(understanding(s).U));
  S.M.push(r3(s.player.prodCache?.M ?? 1));
  S.cash.push(r3(s.player.finance.cash));
  S.revenue.push(r3(s.player.finance.revenueRun));
  S.valuation.push(r3(s.player.finance.valuation));
  S.compute.push(Math.round(s.player.computeOnline));
  S.approval.push(r3(s.pub.approval));
  S.trustGov.push(r3(s.relations.stocks.exec.trust));
  S.scrutiny.push(r3(s.relations.scrutiny));
  S.gdpG.push(r3(s.world.macro.US.g));
  S.unemp.push(r3(s.world.unemployment.US));
  S.misTrue.push(r3(v ? misalignment(v.traitsTrue, v.uModes) : 0));
  S.misEst.push(r3(v ? misalignmentEstimate(v) : 0));
}

export const LOG_CAP = 600;
export const HEADLINE_CAP = 200;

export const recordSystem: EngineSystem = {
  id: 'record', owner: 'WS1', cadence: 'weekly', order: 160,
  run(s) {
    sampleSeries(s);
    trimCauses(s);
  },
};
