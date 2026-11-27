// China's NPC lab (Xuanmu): its start and its chip access (V2-SPEC §3.10.4; research/10; design/npc/NPC-LABS.md §8).
// Owner: WS4. W6: the lab gets its compute by the rule every NPC lab follows (npc/lab.ts cPlan; quarterly chip orders
// through the shared market, actors/rivals.ts); the China-specific effects are one multiplier on what it orders, its
// chip access: export controls bend its growth, the national collective (world/chinagov.ts) pools more of China's compute
// into it.
import type { ChinaActor, GameStateV2, HiddenWorld, SetupV2 } from '../types';
import { START_DATE } from '../core/time';
import { RIVAL_GROWTH } from '../compute/market';
import { chinaCast, initialNpcLab } from './lab';

/** China's chip-access growth factor by US export policy: the exponent on the common plan's yearly growth (strict: China
 *  grows at RIVAL_GROWTH^0.8, open ^1.1; the old China-compute rule's factors, IFP) [repo]. */
export const CHINA_EXPORT_GROWTH = { strict: 0.8, caseByCase: 1, open: 1.1 } as const;

/** China at Jul 2025. N2b-1: its lab is the Realistic cast's NPC lab of kind `china` (npc/lab.ts), its start compute the
 *  cast's. Chip access starts at 1 (the common plan). `i`/`n`: its place among the NPC labs (release days staggered). */
export function initialChina(h: HiddenWorld, setup: SetupV2, i: number, n: number): ChinaActor {
  const e = chinaCast();
  const lab = initialNpcLab({ setup, hidden: h, time: { day: 0, startDate: START_DATE, speed: 0 } }, e, i, n, e.start.computeH100e, { cash: 30, revenueRun: 1, valuation: 0, raised: 0 });
  lab.core.staff = { cap: 1500, saf: 60 }; // today's (research/10); not from compute
  return { lab, access: 1 };
}

/** Daily: China's chip access drifts off the common plan by the export policy (RIVAL_GROWTH^(factor − 1) a year). */
export function chinaAccessDaily(s: GameStateV2) {
  const f = CHINA_EXPORT_GROWTH[s.market.exportPolicy];
  if (f !== 1) s.china.access *= Math.pow(RIVAL_GROWTH, (f - 1) / 365);
}

/** The national collective (world/chinagov.ts): China pools `mult` times more of its compute into its lab, at once and in
 *  every later order (its AGI share 0.4 → 0.9, AI 2027 compute forecast, research/11 #16). */
export function centraliseChina(s: GameStateV2, mult: number) {
  s.china.access *= mult;
  s.china.lab.core.computeOnline *= mult;
}
