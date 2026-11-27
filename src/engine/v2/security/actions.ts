// Security levers (V2-SPEC §3.6): the WSL target, siloing and counter-intelligence. Owner: WS4.
// Every preview shows what apply() does (§2.7 preview truth, lint-tradeoffs).
import { clamp } from '../../rng';
import type { ActionDef } from '../types';
import { L, morale, pv } from '../actors/fx';
import { numParam, simpleAction } from '../core/actionDef';
import { reqSpend, WSL_TARGET_RANGE } from './security';

export const SECURITY_ACTIONS: ActionDef[] = [
  simpleAction({
    id: 'SEC_TARGET', verb: 'policy', system: 'relations', title: 'Security target', sphere: 'security',
    preview: (s, p) => {
      const sec = s.player.security;
      const t = clamp(numParam(p, 'level', Math.min(WSL_TARGET_RANGE[1], sec.target + 0.5)), WSL_TARGET_RANGE[0], WSL_TARGET_RANGE[1]);
      const spend = reqSpend(t, s.player.computeOnline) * 1.05;
      return pv([L('cash', Math.max(0, spend - sec.spendRate), '$B/yr more'), L('staffTime', 1)], [L('security', t - sec.wsl, `WSL → ${t.toFixed(1)} at ≤ 0.006/day`)]);
    },
    apply(s, _ctx, p) {
      const sec = s.player.security;
      sec.target = clamp(numParam(p, 'level', Math.min(WSL_TARGET_RANGE[1], sec.target + 0.5)), WSL_TARGET_RANGE[0], WSL_TARGET_RANGE[1]);
      sec.spendRate = Math.round(reqSpend(sec.target, s.player.computeOnline) * 1.05 * 1000) / 1000;
    },
  }),
  simpleAction({
    id: 'SEC_SILO', verb: 'policy', system: 'relations', title: 'Siloing', sphere: 'security',
    preview: (s, p) => {
      const lvl = clamp(Math.round(numParam(p, 'level', Math.min(2, s.player.security.siloing + 1))), 0, 2);
      const d = lvl - s.player.security.siloing;
      return d >= 0 ? pv([L('progress', 5 * Math.max(1, d), 'research speed', { unit: '%' }), L('morale', 3 * Math.max(1, d))], [L('security', 0.3 * Math.max(1, d), 'spies ×0.7 per level')]) : pv([L('security', 0.3)], [L('progress', 5, 'research speed', { unit: '%' }), L('morale', 2)]);
    },
    apply(s, ctx, p) {
      const sec = s.player.security;
      const lvl = clamp(Math.round(numParam(p, 'level', Math.min(2, sec.siloing + 1))), 0, 2) as 0 | 1 | 2;
      if (lvl > sec.siloing) morale(ctx, -3 * (lvl - sec.siloing), 'siloing');
      sec.siloing = lvl;
    },
  }),
  simpleAction({
    id: 'SEC_CI', verb: 'policy', system: 'relations', title: 'Counter-intel', sphere: 'security',
    available: (s) => (s.player.security.counterIntel >= 0.9 ? 'At maximum' : true),
    preview: () => pv([L('cash', 0.1, 'per year')], [L('security', 0.2, 'theft detection')]),
    apply(s) {
      const sec = s.player.security;
      sec.counterIntel = Math.min(1, sec.counterIntel + 0.2);
      sec.spendRate = Math.round((sec.spendRate + 0.1) * 1000) / 1000;
    },
  }),
];
