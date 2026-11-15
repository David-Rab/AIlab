// Finance decision event (V2-SPEC §3.7.5, §4.2): E37 board revolt. Owner: WS3 (content). WS4 owns the catalog and the
// director: `...FINANCE_EVENTS` is in events/catalog/company.ts. Recapitalisation, partner offers and the distress
// options are Finance panel actions, not events.
import type { EventDefV2, GameStateV2 } from '../types';
import { addSeat, BC_WARN, OUSTER_BC, ousterRiskQ } from './board';
import { ensureWs3 } from './ext';

export const FINANCE_EVENTS: EventDefV2[] = [
  {
    // M4 telegraph and counterplay before an ouster (§3.7.5). Fires while confidence is below BC_WARN.
    id: 'E37', title: 'Board revolt', icon: 'alert', owner: 'WS3', crisis: true, cooldown: 365, deadlineDays: 30, defaultChoice: 3,
    when: (s) => (s.player.board.confidence < BC_WARN && s.flags['ws3.ousterDay'] === undefined ? { bc: Math.round(s.player.board.confidence) } : false),
    text: (_s, d) => `Board confidence is ${d.bc}. Directors are sounding out a replacement CEO; below ${OUSTER_BC} they may vote at any quarterly review.`,
    choices: [
      {
        label: 'New directors', tags: ['concede', 'governance'],
        preview: () => ({ costs: [{ currency: 'freedom', amount: -1, target: 'two independent directors join the board' }], gains: [{ currency: 'boardConf', amount: 15 }], exposure: [] }),
        apply: (s, ctx) => {
          if (s.player.board.seats.length < 10) {
            addSeat(s, 'independent', `Independent director ${s.time.day}a`, 1);
            addSeat(s, 'independent', `Independent director ${s.time.day}b`, 1);
          }
          ctx.bump('board.confidence', 15, 'E37 new independent directors');
        },
      },
      {
        label: 'Capex freeze', tags: ['shrink', 'prudent'],
        preview: () => ({ costs: [{ currency: 'compute', amount: -1, target: 'no new sites or chip orders for 90 days' }], gains: [{ currency: 'boardConf', amount: 10 }], exposure: [] }),
        apply: (s, ctx) => {
          ensureWs3(s);
          for (const id of ['cmp.newSite', 'cmp.orderStandard', 'cmp.orderLTA', 'cmp.orderSpot']) s.player.finance.ws3.blockedUntil[id] = s.time.day + 90;
          ctx.bump('board.confidence', 10, 'E37 capex freeze');
        },
      },
      {
        label: 'Rally staff', tags: ['fight', 'morale'],
        preview: (s) => ({ costs: [{ currency: 'morale', amount: -5, target: 'staff spend goodwill' }], gains: [{ currency: 'boardConf', amount: 15, probability: rallyOdds(s) }], exposure: [{ currency: 'boardConf', amount: -5, probability: Math.round((1 - rallyOdds(s)) * 100) / 100 }] }),
        apply: (s, ctx) => {
          const ok = ctx.rng('finance').chance(rallyOdds(s));
          ctx.bump('morale', -5, 'E37 staff letter');
          ctx.bump('board.confidence', ok ? 15 : -5, ok ? 'E37 staff rally the board' : 'E37 staff letter backfires');
        },
      },
      {
        label: 'Ignore', tags: ['decline'],
        preview: (s) => ({ costs: [{ currency: 'boardConf', amount: -2, target: 'directors feel ignored' }], gains: [], exposure: [{ currency: 'freedom', amount: -1, probability: Math.round(ousterRiskQ(s) * 100) / 100, target: 'ouster vote at the next review' }] }),
        apply: (_s, ctx) => void ctx.bump('board.confidence', -2, 'E37 ignored'),
      },
    ],
  },
];

/** E37 'Rally staff': odds rise with overall morale (a loyal staff is the CEO's leverage, Nov 2023) [D]. */
export function rallyOdds(s: GameStateV2): number {
  return Math.round(Math.max(0.05, Math.min(0.95, (s.player.morale.overall - 40) / 40)) * 100) / 100;
}
