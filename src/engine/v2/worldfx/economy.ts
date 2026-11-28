// Economy: three small readouts (design/world/OUTSIDE-WORLD.md §4). Owner: WS5.
//   1. GDP growth per region: g = G_BASE[r] + gAI + world-tech growth − output shock (US), gdp ← gdp·exp(g/12) monthly.
//      gAI = λ · (annual change of the value-weighted automation share Σ v·A of the region).
//   2. AI share of income = AI-lab revenue / US GDP.
//   3. Unemployment is not computed here: sectors.ts owns it (the displacement engine); this system only records the
//      13-month US history for the 12-month-change readout.
// λ fit (RefBot tl-central, scripts/v2/_w1b/before.txt vs after.txt): the old model's AI-driven growth (g − 0.018) was
//   0.0026 at day 400 and 0.0072 at day 900. One λ = 0.6 gives 0.0015 (day 400, 42% low: the annual change of the share
//   is still small then) and 0.0074 (day 900, within 3%). The day-900 fit is used.
import { REGIONS } from '../../../data/v2/sectors';
import type { EngineSystem, GameStateV2, RegionId } from '../types';
import { automationShare } from './readouts';
import { worldTechEffects } from './techtree';
import { CHINAGOV } from '../world/chinagov';

/** Baseline GDP growth by region: US = CBO potential (SOURCES §2); CN, ROW [D]. */
export const G_BASE: Record<RegionId, number> = { US: 0.022, CN: 0.04, ROW: 0.028 };
/** λ: growth added per unit of annual change of the automation share (one number for every region), fitted above. */
export const ECONOMY = { lambda: 0.6 };

/** Days a severity-5 misuse incident (the player's, WS2's stamp, or a rival's) keeps the economy in shock [D]. */
export const MISUSE_SHOCK_DAYS = 180;
/** US output shock, a growth penalty per year [D]: Taiwan chip disruption 3%/yr while it lasts; a severity-5 misuse
 *  incident in the last MISUSE_SHOCK_DAYS days 2%/yr; China on war footing (tension 4) CHINAGOV.warShock (world/chinagov.ts). */
export const OUTPUT_SHOCK = { taiwan: 0.03, misuse: 0.02 };

/** The US output shock today (growth penalty per year). */
export function outputShock(s: GameStateV2): number {
  const day = s.time.day;
  const last = s.flags['ws2.sev5MisuseDay'];
  const sev5 = (typeof last === 'number' && day - last < MISUSE_SHOCK_DAYS) || s.rivalIncidents.some((i) => i.misuse && i.severity >= 5 && day - i.day < MISUSE_SHOCK_DAYS);
  return (s.market.taiwanDisrupted ? OUTPUT_SHOCK.taiwan : 0) + (sev5 ? OUTPUT_SHOCK.misuse : 0) + (s.chinagov.tension >= 4 ? CHINAGOV.warShock : 0);
}

/** Total AI-lab revenue run-rate ($B/yr): player + rivals + DeepCent. */
export function aiRevenue(s: GameStateV2): number {
  let x = s.player.finance.revenueRun;
  for (const r of s.rivals) if (r.core.status === 'active') x += r.finance.revenueRun;
  return x + s.china.lab.finance.revenueRun;
}

/** Monthly economy update. */
export function runEconomy(s: GameStateV2): void {
  const W = s.world;
  const fx = W.fx;
  const eff = worldTechEffects(s);
  const shock = outputShock(s);
  for (const r of REGIONS) {
    const M = W.macro[r];
    const hist = fx.autoHist[r];
    hist.push(automationShare(s, r));
    if (hist.length > 13) hist.splice(0, hist.length - 13);
    const dShareYr = hist.length > 1 ? ((hist[hist.length - 1] - hist[0]) * 12) / (hist.length - 1) : 0;
    const g = G_BASE[r] + ECONOMY.lambda * dShareYr + eff.g - (r === 'US' ? shock : 0);
    M.gdp *= Math.exp(g / 12);
    M.g += (g - M.g) / 3; // 3-month smoothing of the annualised rate
  }
  W.aiIncomeShare = aiRevenue(s) / W.macro.US.gdp;
  fx.uHist.push(Math.round(W.unemployment.US * 1000) / 1000);
  if (fx.uHist.length > 13) fx.uHist.splice(0, fx.uHist.length - 13);
}

/** economy (310, monthly). */
export const economySystem: EngineSystem = {
  id: 'economy', owner: 'WS5', cadence: 'monthly', order: 310, system: 'world',
  run(s) {
    runEconomy(s);
  },
};
