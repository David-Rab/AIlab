// Headlines H1–H32 (V2-SPEC §3.11.4; research/16 §5). Owner: WS5.
//
// Each fires once, or again after its cooldown. Text is generic ("{Firm}" from a fictional list; no AI 2027 dates).
// Ticker severity 1, except H14, H17, H18 and H30 (severity 3, also logged as a world alert). H16 (each tech
// discovery) and H28 (Coffee Test) are fired by the tech tree on discovery and listed here for the catalog.
// Effects on WS4 meters go through the cause ledger (source "headline Hn").
import { FIRMS } from '../../../data/v2/names';
import { ECON } from '../../../data/v2/sectors';
import type { GameStateV2, SectorId, SystemCtx } from '../types';
import { leverageAll } from './control';
import { policyState } from './policy';
import { remoteWorkAutomation, unemploymentChange12m } from './readouts';
import { robotOutput } from './robots';

export interface HeadlineDef {
  id: string;
  cooldownDays?: number;
  /** Check only every N days (expensive conditions). */
  every?: number;
  severity: 1 | 3;
  sector?: SectorId;
  when(s: GameStateV2): boolean;
  text(s: GameStateV2, pick: (xs: readonly string[]) => string): string;
  /** One-shot effects (cause-ledger bumps), applied when the headline fires. */
  effect?(s: GameStateV2, ctx: SystemCtx): void;
}

const STATES = ['Texas', 'Ohio', 'Arizona', 'Nevada', 'Michigan', 'Wyoming'];
const bloc = (ctx: SystemCtx, id: string, d: number, src: string) => ctx.bump(`pub.blocs.${id}.mobilization`, d, src);

export const HEADLINES: HeadlineDef[] = [
  { id: 'H1', severity: 1, sector: 'SOFT', when: (s) => s.world.sectors.US.SOFT.hireRate <= 0.7, text: () => 'Junior dev postings collapse',
    effect: (_s, ctx) => { ctx.bump('pub.jobAnxiety', 2, 'headline H1'); bloc(ctx, 'labor', 5, 'headline H1'); } },
  { id: 'H2', severity: 1, when: (s) => s.world.youthUnemployment >= ECON.youthU0 + 3, text: () => "New graduates can't find work",
    effect: (_s, ctx) => { ctx.bump('pub.concern', 2, 'headline H2'); } },
  { id: 'H3', severity: 1, cooldownDays: 120, sector: 'OFFICE', when: (s) => s.world.fx.layoffs30 >= 150e3,
    text: (_s, pick) => `${pick(FIRMS)} cuts 12,000; agents take over support`,
    effect: (s, ctx) => { if ((s.world.shares.OFFICE.player ?? 0) >= 0.3) ctx.bump('pub.approval', -2, 'headline H3'); ctx.bump('pub.jobAnxiety', 0.5, 'headline H3'); } },
  { id: 'H4', severity: 1, sector: 'OFFICE', when: (s) => s.world.sectors.US.OFFICE.A >= 0.3, text: () => 'Call centers go dark' },
  { id: 'H5', severity: 1, sector: 'MEDIA', when: (s) => s.world.sectors.US.MEDIA.A >= 0.3, text: () => 'Studio ships a game in 30 days',
    effect: (_s, ctx) => { bloc(ctx, 'creatives', 5, 'headline H5'); } },
  { id: 'H6', severity: 1, sector: 'LEGAL', when: (s) => s.world.sectors.US.LEGAL.A >= 0.2, text: () => 'Bar sues AI law firm',
    effect: (s) => { s.world.fx.incidentR.LEGAL = Math.min(0.5, s.world.fx.incidentR.LEGAL + 0.1); } },
  { id: 'H7', severity: 1, when: (s) => s.pub.rung >= 2, text: () => '10,000 march on Washington' },
  { id: 'H9', severity: 1, when: (s) => s.world.friendShare >= 0.1, text: () => '1 in 10 Americans: my best friend is an AI',
    effect: (_s, ctx) => { bloc(ctx, 'parents', 5, 'headline H9'); } },
  { id: 'H10', severity: 1, when: (s) => remoteWorkAutomation(s) >= 0.25, text: () => 'A quarter of remote jobs now done by AI' },
  { id: 'H11', severity: 1, cooldownDays: 365, when: (s) => unemploymentChange12m(s) >= 1, text: () => 'Unemployment jumps; AI blamed',
    effect: (_s, ctx) => { ctx.bump('pub.jobAnxiety', 0.5, 'headline H11'); } },
  { id: 'H12', severity: 1, when: (s) => s.pub.salience >= 2 || s.pub.jobAnxiety >= 85, text: () => "AI now America's #1 problem, poll finds" },
  { id: 'H13', severity: 1, sector: 'GOV', when: (s) => s.world.control.GOV.P >= 0.1 && s.world.control.GOV.tiers[1] >= 0.3, text: () => 'Cabinet now briefed by AI each morning' },
  { id: 'H14', severity: 3, sector: 'MIL', when: (s) => s.world.control.MIL.tiers[3] >= 0.15, text: () => 'Pentagon removes human from kill chain',
    effect: (_s, ctx) => { bloc(ctx, 'safety', 5, 'headline H14'); } },
  { id: 'H15', severity: 1, when: (s) => (s.world.control.INFRA.shares.player ?? 0) >= 0.4 && s.world.control.INFRA.tiers[2] + s.world.control.INFRA.tiers[3] >= 0.4,
    text: () => 'Internal: our agents now run our own security' },
  { id: 'H16', severity: 1, when: () => false, text: () => 'Technology discovered (fired by the tech tree, one per technology)' },
  { id: 'H17', severity: 3, when: (s) => (s.world.techs.W25?.exposure ?? 0) >= 0.5, text: () => 'Eval: model can guide virus enhancement',
    effect: (_s, ctx) => { ctx.bump('gov.securityDemand', 5, 'headline H17'); } },
  { id: 'H18', severity: 3, cooldownDays: 365, sector: 'ENGY', when: (s) => (s.world.techs.W24?.exposure ?? 0) >= 0.6 && ((s.time.day * 2654435761) >>> 0) % 120 === 0,
    text: () => 'Grid outage traced to AI-run intrusion',
    effect: (s, ctx) => { s.world.fx.incidentR.ENGY = Math.min(0.5, s.world.fx.incidentR.ENGY + 0.05); ctx.bump('gov.hawkishness', 5, 'headline H18'); } },
  { id: 'H19', severity: 1, when: (s) => s.world.robots.sezOpen, text: (_s, pick) => `First Special Economic Zone opens in ${pick(STATES)}` },
  { id: 'H20', severity: 1, when: (s) => robotOutput(s) / 12 >= 100e3, text: () => 'Detroit converts: 100,000 robots a month' },
  { id: 'H21', severity: 1, when: (s) => robotOutput(s) / 12 >= 1e6, text: () => 'One million robots a month' },
  { id: 'H22', severity: 1, when: (s) => s.world.macro.US.g >= 0.1, text: () => 'Fastest growth since WWII' },
  { id: 'H23', severity: 1, when: (s) => s.world.macro.US.g >= 0.3, text: () => 'Economy doubling every two years' },
  { id: 'H25', severity: 1, when: (s) => s.world.aiIncomeShare >= 0.2, text: () => 'AI companies now earn a fifth of national income',
    effect: (_s, ctx) => { bloc(ctx, 'populist', 5, 'headline H25'); } },
  { id: 'H26', severity: 1, when: (s) => policyState(s).ubi, text: () => 'Congress passes basic income',
    effect: (_s, ctx) => { ctx.bump('pub.jobAnxiety', -10, 'headline H26'); } },
  { id: 'H28', severity: 1, when: () => false, text: () => 'Robot passes the Coffee Test (fired by the tech tree)' },
  { id: 'H29', severity: 1, sector: 'HEALTH', when: (s) => (s.world.techs.W07?.ramp ?? 0) >= 0.5, text: () => 'Cancer death rate falls by a third' },
  { id: 'H30', severity: 3, every: 7, when: (s) => Math.max(0, ...Object.entries(leverageAll(s)).filter(([k]) => k !== 'player:open').map(([, v]) => v)) >= 0.35,
    text: () => 'Can we still switch it off? Economists say no',
    effect: (_s, ctx) => { bloc(ctx, 'safety', 5, 'headline H30'); } },
  { id: 'H32', severity: 1, when: (s) => policyState(s).chinaSez || (s.world.robots.sezOpen && s.china.meters.centralization >= 50), text: () => 'China answers with AI zones' },
];

/** Check every headline (called daily from worldDaily). */
export function fireHeadlines(s: GameStateV2, ctx: SystemCtx): void {
  const hl = s.world.fx.hl;
  for (const h of HEADLINES) {
    const last = hl[h.id];
    if (last !== undefined && (h.cooldownDays === undefined || ctx.day - last < h.cooldownDays)) continue;
    if (h.every && ctx.day % h.every !== 0) continue;
    if (!h.when(s)) continue;
    hl[h.id] = ctx.day;
    const text = h.text(s, (xs) => ctx.rng('worldfx').pick(xs));
    ctx.headline(h.id, text, h.sector);
    if (h.severity === 3) ctx.log('world', text, 3, h.id);
    h.effect?.(s, ctx);
  }
}
