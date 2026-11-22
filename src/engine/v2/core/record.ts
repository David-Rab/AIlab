// record (160, weekly): series samples and cause-ledger trim (V2-SPEC §2.2, §2.5 budgets). Owner: WS1.
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { bestG, bestLg, internalVersion, measuredLOf, otherLabs } from '../models/labs';
import { reValidationMult } from '../safety/agendas';
import { misalignment, misalignmentEstimate } from '../safety/traits';
import { sightLimitPoint, trueSightLimit } from '../safety/sightLimit';
import { recordCause, trimCauses } from './causes';
import type { EngineSystem, GameStateV2, SeriesV2 } from '../types';

export function emptySeries(labIds: string[]): SeriesV2 {
  return {
    day: [], L: Object.fromEntries(labIds.map((id) => [id, [] as number[]])), G: Object.fromEntries(labIds.map((id) => [id, [] as number[]])), Lmeasured: [], U: [], M: [], cash: [], revenue: [],
    valuation: [], compute: [], approval: [], trustGov: [], scrutiny: [], gdpG: [], unemp: [], misTrue: [], misEst: [],
  };
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const r4 = (x: number) => Math.round(x * 10000) / 10000;

export function sampleSeries(s: GameStateV2) {
  const S = s.series;
  const v = internalVersion(s);
  S.day.push(s.time.day);
  (S.L.player ??= []).push(r3(bestLg(s, 'player')));
  for (const r of otherLabs(s)) (S.L[r.core.id] ??= []).push(r3(bestLg(s, r.core.id)));
  // RD-L01: frontier G per lab (player, each rival, China), the lead clock's record (capability.ts lagDays).
  // A lab with no model yet records nothing (the series aligns to day from the end), never a non-finite sample.
  const G = (S.G ??= {});
  for (const id of ['player', ...otherLabs(s).map((r) => r.core.id)]) {
    const g = bestG(s, id);
    if (Number.isFinite(g)) (G[id] ??= []).push(r4(g));
  }
  // A freshly switched internal agent has no measurement yet: hold the last measured level instead of dropping to 0
  // (M4 fix: the 0-dips made the causal replay report level swings of +40 on the 0–15 scale).
  S.Lmeasured.push(r3(v?.evals.measuredL ?? S.Lmeasured[S.Lmeasured.length - 1] ?? 0));
  const U = r3(sightLimitPoint(s)); // SR-11: series key U = the believed sight limit
  noteUnderstandingMove(s, U, S.U[S.U.length - 1]);
  S.U.push(U);
  // Hidden: level − true sight limit, read by bot diagnostics only (SR-02 removed the trait-growth amplifier).
  const tu = trueSightLimit(s);
  s.flags['ws2.gapTrue'] = r3(Math.max(0, tu.level - tu.L));
  S.M.push(r3(s.player.research.last?.x?.mExp ?? 1)); // RD-R01: the engine's AI labour multiplier in experiments (was the aggregate M)
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

/**
 * Why understanding moved (jank M2): U is recomputed from what the player believes, so it steps when one of its inputs
 * changes. Each weekly sample compares the visible drivers with the last sample's and, when U moved by ≥ 0.2, records
 * the move under cause key 'U' (source = the first driver that changed, detail = all of them; read by the race chart
 * tooltip). Believed inputs only.
 */
function noteUnderstandingMove(s: GameStateV2, U: number, prevU: number | undefined) {
  const v = internalVersion(s);
  const tools = Object.values(s.player.safety.techniques).filter((t) => t.unlocked && t.active);
  const now = {
    model: v?.id ?? '',
    L: measuredLOf(s, v).L,
    tools: tools.map((t) => t.id).sort().join(','),
    ea: Math.round((v?.beliefs.EA?.est ?? 0) * 100) / 100,
    val: Math.round(reValidationMult(s) * 100) / 100,
  };
  const prev = s.flags['ws2.uDrivers'];
  s.flags['ws2.uDrivers'] = JSON.stringify(now);
  if (prevU === undefined || typeof prev !== 'string' || Math.abs(U - prevU) < 0.2) return;
  const p = JSON.parse(prev) as typeof now;
  const why: [source: string, text: string][] = [];
  if (p.model !== now.model) why.push(['new internal model', `internal model now ${v?.name ?? '—'}`]);
  else if (Math.abs(p.L - now.L) >= 0.01) why.push(['measured level', `measured level ${p.L.toFixed(2)} → ${now.L.toFixed(2)}`]);
  if (p.tools !== now.tools) {
    const a = new Set(p.tools.split(',').filter(Boolean));
    const b = new Set(now.tools.split(',').filter(Boolean));
    const added = [...b].filter((x) => !a.has(x));
    const lost = [...a].filter((x) => !b.has(x));
    const nm = (id: string) => TECHNIQUE_BY_ID[id]?.name ?? id;
    if (added.length) why.push(['new tool', `new tool ${added.map(nm).join(', ')}`]);
    if (lost.length) why.push(['tool off', `tool off ${lost.map(nm).join(', ')}`]);
  }
  if (Math.abs(p.ea - now.ea) >= 0.03) why.push(['eval awareness', `believed eval awareness ${Math.round(p.ea * 100)}% → ${Math.round(now.ea * 100)}%`]);
  if (Math.abs(p.val - now.val) >= 0.05) why.push(['re-validation', `re-validation staffing ×${p.val.toFixed(2)} → ×${now.val.toFixed(2)}`]);
  if (!why.length) why.push(['tool decay', 'tools weaken as capability grows']);
  recordCause(s, 'U', U - prevU, why[0][0], why.map((w) => w[1]).join(' · '));
}

export const LOG_CAP = 600;
export const HEADLINE_CAP = 200;

export const recordSystem: EngineSystem = {
  id: 'record', owner: 'WS1', cadence: 'weekly', order: 160, system: 'core',
  run(s) {
    sampleSeries(s);
    trimCauses(s);
  },
};
