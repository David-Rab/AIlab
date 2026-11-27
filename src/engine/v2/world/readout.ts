// W4 (public), W5 (US government) and W6 (China) state are here.
//
// The engine readout of the outside world now: one flat, JSON-safe record. The observer run (scripts/v2/observer.ts) samples
// it every quarter; later outside-world tasks extend WorldReadout rather than adding another reader. Read-only: it never
// changes the state. A value that is not finite (a lab with no model yet, a runaway overflow) is null.
import { lawIdsInForce, lawsInForce } from '../../../data/v2/laws';
import { lagDays } from '../models/capability';
import { bestG, CHINA_ID, labCore, PLAYER_ID } from '../models/labs';
import { decimalYear } from '../core/time';
import { ws4r } from '../actors/state';
import { robotOutput } from '../worldfx/robots';
import { automationShare } from '../worldfx/readouts';
import { worldMix } from '../worldfx/mix';
import { attention, frontier as publicFrontier, govMilestones, incidentHeat, publicMilestones, usLeadOverChinaMonths, type MilestoneBoard } from './observe';
import type { GameStateV2, LabId } from '../types';

export interface LabReadout {
  id: LabId;
  /** 'lab' (an NPC lab), 'china' (China's lab) or 'observer' (the player's lab, which does nothing in an observer run). */
  kind: 'lab' | 'china' | 'observer';
  /** Best effective compute G (OOM; the engine's capability measure); null without a model. */
  G: number | null;
  /** Months behind the frontier lab (0 for the frontier itself); null without a model. */
  monthsBehind: number | null;
  /** Day each milestone was first reached (index = MilestoneIdx). */
  milestoneDays: Partial<Record<number, number>>;
  /** Attention on the lab, 0..1 (observe.ts, spec 3.2). */
  attention: number;
}

export interface WorldReadout {
  day: number;
  year: number;
  labs: LabReadout[];
  frontier: { lab: LabId | null; G: number | null };
  /** W2 shared inputs (observe.ts): the public frontier holder, the milestones shown publicly (index to first day and lab) and
   *  those the US government sees, the world's incident heat and the US lead over China (months). */
  observe: { frontierHolder: LabId | null; publicMilestones: MilestoneBoard; govMilestones: MilestoneBoard; incidentHeat: number; usLeadOverChinaMonths: number | null };
  public: { concern: number; approval: number };
  /** W5 (usgov.ts): the security stage, trust in the player, oversight, consolidation and the conditional laws in force (id to day). */
  usgov: { stage: number; stageDay: Partial<Record<number, number>>; trust: number; oversight: boolean; consolidated: string; laws: Partial<Record<string, number>> };
  /** Every law in force (dated and conditional; export controls apart) and the export policy. */
  laws: { inForce: string[]; exportPolicy: string };
  economy: { unemploymentUS: number; youthUnemployment: number; gdpGrowthUS: number; aiIncomeShare: number; automationUS: number };
  geopolitics: { taiwanDisrupted: boolean; chinaGapMonths: number | null };
  robotsPerMonth: number;
  techsDiscovered: number;
}

const fin = (x: number): number | null => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const MONTH = 365 / 12;

export function worldReadout(s: GameStateV2): WorldReadout {
  const ids: { id: LabId; kind: LabReadout['kind'] }[] = [
    ...s.rivals.filter((r) => r.core.status === 'active').map((r) => ({ id: r.core.id, kind: 'lab' as const })),
    ...(s.china.lab.core.status === 'active' ? [{ id: CHINA_ID, kind: 'china' as const }] : []),
    { id: PLAYER_ID, kind: 'observer' as const },
  ];
  let top: LabId | null = null;
  let topG = -Infinity;
  for (const { id } of ids) {
    const g = bestG(s, id);
    if (g > topG) { topG = g; top = id; }
  }
  const behind = (id: LabId, leader: LabId | null) => (leader && Number.isFinite(bestG(s, id)) && Number.isFinite(topG) ? fin(lagDays(s, id, leader) / MONTH) : null);
  const pf = publicFrontier(s);
  const mix = worldMix(s);
  const labs: LabReadout[] = ids.map(({ id, kind }) => ({
    id, kind, G: fin(bestG(s, id)), monthsBehind: behind(id, top), milestoneDays: { ...(labCore(s, id)?.milestoneDays ?? {}) },
    attention: fin(attention(s, id, pf, mix))!,
  }));
  const usLead = usLeadOverChinaMonths(s, pf);
  // China's gap to the US frontier (the best US lab: the NPC labs and the observer player).
  let usTop: LabId | null = null;
  let usG = -Infinity;
  for (const { id, kind } of ids) if (kind !== 'china' && bestG(s, id) > usG) { usG = bestG(s, id); usTop = id; }
  const chinaGap = ids.some((x) => x.kind === 'china') && usTop && Number.isFinite(bestG(s, CHINA_ID)) && Number.isFinite(usG) ? fin(lagDays(s, CHINA_ID, usTop) / MONTH) : null;
  const L = lawsInForce(s);
  const w = s.world;
  return {
    day: s.time.day, year: Math.round(decimalYear(s) * 1000) / 1000,
    labs,
    frontier: { lab: top, G: fin(topG) },
    observe: { frontierHolder: pf.lab, publicMilestones: publicMilestones(s), govMilestones: govMilestones(s), incidentHeat: fin(incidentHeat(s))!, usLeadOverChinaMonths: usLead === null ? null : fin(usLead) },
    public: { concern: fin(s.public.concern)!, approval: fin(s.public.approval)! },
    usgov: { stage: s.usgov.stage, stageDay: { ...s.usgov.stageDay }, trust: fin(s.usgov.trust)!, oversight: s.usgov.oversight, consolidated: s.usgov.consolidated, laws: { ...s.usgov.laws } },
    laws: { inForce: lawIdsInForce(s), exportPolicy: L.exportPolicy },
    economy: { unemploymentUS: fin(w.unemployment.US)!, youthUnemployment: fin(w.youthUnemployment)!, gdpGrowthUS: fin(w.macro.US.g)!, aiIncomeShare: fin(w.aiIncomeShare)!, automationUS: fin(automationShare(s, 'US'))! },
    geopolitics: { taiwanDisrupted: ws4r(s).taiwanDisrupted, chinaGapMonths: chinaGap },
    robotsPerMonth: fin(robotOutput(s) / 12)!,
    techsDiscovered: Object.values(w.techs).filter((t) => t.discoveredDay !== undefined).length,
  };
}
