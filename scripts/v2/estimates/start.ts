// Back-of-envelope estimates: start (see scripts/v2/estimates.ts; design/estimates/MAP-A.md, MAP-B.md).
// The start state as built: the cast's start gaps from the cast table, and the reads of one newGame (never stepped).
import { DANGER_ACTS } from '../../../src/data/v2/danger';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { workContext } from '../../../src/engine/v2/departments/workfit';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { DAYS_PER_MONTH, chinaCast, startLagDays, usCast } from '../../../src/engine/v2/npc/lab';
import { dangerOf, forEachIncidentSite } from '../../../src/engine/v2/safety/incidents';
import { multiplierRef } from '../../../src/engine/v2/world/calibration';
import { estOf, type Estimate } from './types';

export const area = 'start';
const YEAR = 365.25;

export function estimates(): Estimate[] {
  const out: Estimate[] = [];

  // CAST: the start lags of the cast table (no game): startLagDays of each US lab entry, and of China's.
  const rivals = usCast(undefined).map((e) => ({ name: e.name, months: startLagDays(e) / DAYS_PER_MONTH }));
  out.push(estOf('CAST.rivalGaps.start', rivals.map((r) => `${r.name} ${r.months.toFixed(1)}`).join(', ') + ' months', rivals.map((r) => r.months),
    'usCast(undefined) → startLagDays(entry) / DAYS_PER_MONTH'));
  const cn = startLagDays(chinaCast()) / DAYS_PER_MONTH;
  out.push(estOf('CAST.china.startLead', `${cn.toFixed(2)} months (the start lag; the report reads one tick in)`, cn, 'chinaCast() → startLagDays / DAYS_PER_MONTH'));

  // One game state, built and never stepped.
  const s = newGame(defaultSetupV2({ seed: 1, world: 'tl-central', alignment: 'medium', tutorial: false }));

  const ea = internalVersion(s)?.traitsTrue.EA ?? NaN;
  out.push(estOf('F5.evalAwarenessStart', `${(ea * 100).toFixed(1)}% on the start model`, ea, 'newGame(tl-central, medium) → internalVersion(s).traitsTrue.EA'));

  const wc = workContext(s);
  const m = wc.slots.EXP.m;
  const src = multiplierRef(s.hidden.timeline, s.hidden.timeline.p0);
  out.push(estOf('M.startReadout', `M ${m.toFixed(3)} (day-0 experiments slot, before the auto mix) vs ${src.toFixed(3)} (source at p0)`, Math.abs(m - src),
    'newGame → workContext(s).slots.EXP.m vs multiplierRef(w, w.p0)'));

  // DANGER: the start incident rates, per lab-year, summed over the start sites (one seed: seeds only change the world draws).
  const tab: Record<string, number> = {};
  forEachIncidentSite(s, (d, v, u) => {
    for (const x of dangerOf(s, d, v, u)) {
      const k = x.source === 'misuse' ? 'misuse' : x.source.startsWith('U') ? 'umode' : x.source;
      tab[k] = (tab[k] ?? 0) + x.attempts * YEAR;
    }
  });
  const acts = [...Object.keys(DANGER_ACTS), 'umode', 'misuse'];
  const all = acts.reduce((a, k) => a + (tab[k] ?? 0), 0);
  const t = (k: string) => tab[k] ?? 0;
  out.push(estOf('DANGER.start.actRate', `${all.toFixed(2)} acts per lab-year`, all, 'newGame → forEachIncidentSite → dangerOf(...).attempts × year, summed over every kind'));
  out.push(estOf('DANGER.start.common', `SYC ${t('SYC').toFixed(2)} (needs > 0.1), RH ${t('RH').toFixed(2)} (needs > 0.05)`, t('SYC') > 0.1 && t('RH') > 0.05,
    'newGame → forEachIncidentSite → dangerOf per kind'));
  out.push(estOf('DANGER.start.rareActs', ['SAND', 'COLLUDE', 'SCHEME', 'POWER'].map((k) => `${k} ${t(k).toExponential(1)}`).join(', ') + ' (SAND, COLLUDE, SCHEME < 0.005; POWER < 0.01)',
    ['SAND', 'COLLUDE', 'SCHEME'].every((k) => t(k) < 0.005) && t('POWER') < 0.01, 'newGame → forEachIncidentSite → dangerOf per kind'));
  return out;
}
