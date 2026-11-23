// Player actions in the World sphere (transition fund, moonshots; sector adaptations: models/adaptations.ts). Owner: WS5.
// Every preview shows what apply() does (V2-SPEC §2.7 preview truth).
import { TECH_BY_ID, WORLD_TECHS } from '../../../data/v2/techs';
import type { ActionDef, CostLine, GameStateV2, SystemCtx } from '../types';
import { worldMix } from './mix';
import { moonshotH100e } from './revenue';
import { gSci, MOONSHOT_K, mSci, scienceRate, techBlocker } from './techtree';
import { domainScaleGs } from '../models/capability';
import { internalVersion } from '../models/labs';
import { revenueReadout } from './revenue';

type P = Record<string, number | string | boolean>;

/** Transition fund: $B/yr to retraining and transition support (research/16 §1A.2 step 9: each $10B/yr adds +0.1
 *  Retrain, cap +0.5; research/07 JobAnxiety relief). The single implementation of the fund: WS4 events call
 *  `setTransitionFund`; WS3's payroll system charges it monthly through the finance ledger. */
const transitionFund: ActionDef = {
  id: 'wfx.transitionFund', verb: 'deal', system: 'world',
  sphere: 'world',
  owner: 'WS5',
  title: 'Transition fund',
  available(s) {
    return s.player.finance.cash > 1 ? true : 'Not enough cash';
  },
  preview(s, p: P) {
    const cur = s.player.policies.transitionFund;
    const amount = typeof p.amount === 'number' ? Math.max(0, p.amount) : cur + 5;
    const d = amount - cur;
    if (d >= 0) {
      return {
        costs: [{ currency: 'cash', amount: -d }],
        gains: [
          { currency: 'approval', amount: Math.round(Math.min(5, d * 0.4) * 10) / 10, lagDays: 90 },
          { currency: 'trust', amount: Math.round(Math.min(8, d * 0.6) * 10) / 10, target: 'bloc:labor' },
        ],
        exposure: [],
      };
    }
    return {
      costs: [
        { currency: 'approval', amount: Math.round(Math.max(-5, d * 0.4) * 10) / 10 },
        { currency: 'trust', amount: Math.round(Math.max(-12, d * 1.0) * 10) / 10, target: 'bloc:labor' },
      ],
      gains: [{ currency: 'cash', amount: -d }],
      exposure: [],
    };
  },
  apply(s, ctx, p: P) {
    const cur = s.player.policies.transitionFund;
    setTransitionFund(s, ctx, typeof p.amount === 'number' ? p.amount : cur + 5);
  },
};

/** Set the transition fund ($B/yr, 0–100) with its one-off public effects. Used by wfx.transitionFund and events. */
export function setTransitionFund(s: GameStateV2, ctx: SystemCtx, perYear: number): void {
  {
    const cur = s.player.policies.transitionFund;
    const amount = Math.max(0, Math.min(100, perYear));
    const d = amount - cur;
    s.player.policies.transitionFund = amount;
    if (d > 0) {
      ctx.bump('pub.approval', Math.min(5, d * 0.4), 'transition fund');
      ctx.bump('pub.jobAnxiety', -Math.min(6, d * 0.5), 'transition fund');
      ctx.bump('trust:bloc:labor', Math.min(8, d * 0.6), 'transition fund');
    } else if (d < 0) {
      ctx.bump('pub.approval', Math.max(-5, d * 0.4), 'transition fund cut');
      ctx.bump('trust:bloc:labor', Math.max(-12, d), 'transition fund cut');
    }
    ctx.log('company', `Transition fund set to ${amount.toFixed(0)}B/yr.`);
  }
}

/** Default moonshot target: a researchable, non-risk technology with benefits. */
function defaultTech(s: GameStateV2): string | undefined {
  const best = worldMix(s).bestPublic;
  const iv = internalVersion(s);
  const lv = { ...best };
  // RD-P04b: domain G (OOM) of the best public model and the internal model, as the tech gates read.
  const ivg = iv ? domainScaleGs(s.hidden.timeline, iv) : undefined;
  if (ivg) for (const k of Object.keys(lv) as (keyof typeof lv)[]) lv[k] = Math.max(lv[k], ivg[k]);
  for (const t of WORLD_TECHS) {
    const st = s.world.techs[t.id];
    if (!st || st.discoveredDay !== undefined || t.risk) continue;
    if (!techBlocker(s, t, lv)) return t.id;
  }
  return undefined;
}

/** Science moonshot: assign a share of compute to one world technology (research/16 §3.1). Taken from the serving
 *  pool first, so it is a revenue sink; benefits and approval on discovery; dual-use exposure for risk techs. */
const moonshot: ActionDef = {
  id: 'wfx.moonshot', verb: 'deal', system: 'world',
  sphere: 'world',
  owner: 'WS5',
  title: 'Moonshot',
  available(s) {
    if (Object.values(s.world.techs).some((t) => t.playerProject)) return true;
    return defaultTech(s) ? true : 'No technology is researchable yet';
  },
  preview(s, p: P) {
    const techId = typeof p.tech === 'string' && TECH_BY_ID[p.tech] ? p.tech : defaultTech(s) ?? Object.keys(s.world.techs).find((k) => s.world.techs[k].playerProject) ?? 'W03';
    const t = TECH_BY_ID[techId];
    const cur = s.world.techs[techId]?.playerProject?.computeShare ?? 0;
    const share = typeof p.share === 'number' ? Math.max(0, Math.min(0.3, p.share)) : cur > 0 ? 0 : 0.03;
    const dShare = share - cur;
    // Revenue at stake: the serving capacity removed (or returned), valued at the average capacity rate.
    const rd = revenueReadout(s);
    let h = 0;
    for (const x of rd.deps) h += x.servingH100e;
    const perH = h > 0 ? rd.capacity / h : 0;
    const dH = s.player.computeOnline * dShare;
    const util = rd.capacity > 0 ? Math.min(1, rd.total / rd.capacity) : 0;
    const revLoss = Math.round(dH * perH * Math.max(0.3, util) * 100) / 100;
    // CP3d: the moonshot moves when the technology is discovered, nothing else at once. Its approval (+0.3·benefit on
    // discovery, +0.5·benefit when it reaches patients: techtree.ts advanceTechs) comes with or without the moonshot,
    // so the preview states the days it moves discovery, not an approval or credibility gain of its own.
    const v = internalVersion(s);
    const perShare = v ? mSci(s.hidden.timeline, gSci(domainScaleGs(s.hidden.timeline, v))) * MOONSHOT_K : 0;
    const { S } = scienceRate(s);
    const left = t ? Math.max(0, 1 - (s.world.techs[techId]?.prog ?? 0)) * t.effort : 0;
    const daysTo = (sh: number) => (left * 365) / Math.max(1e-9, S + perShare * sh);
    const dDays = Math.round(daysTo(cur) - daysTo(share));
    const benefit = t?.effects.benefit ?? 0;
    const timing: CostLine = {
      currency: 'progress', amount: dDays, unit: 'days',
      target: `${t?.name ?? techId}: discovery ${Math.abs(dDays)} d ${dDays >= 0 ? 'sooner' : 'later'} at today's science rate${benefit ? ` (its approval, +${Math.round(benefit * 3) / 10} on discovery and +${Math.round(benefit * 5) / 10} when it reaches patients, comes either way)` : ''}`,
    };
    if (dShare >= 0) {
      const exposure: CostLine[] = t?.risk ? [{ currency: 'scrutiny', amount: 5, probability: 0.5, lagDays: 180 }, { currency: 'chinaTension', amount: 3, probability: 0.3 }] : [];
      return {
        costs: [{ currency: 'compute', amount: -Math.round(dH) }, { currency: 'revenue', amount: -revLoss }],
        gains: [timing],
        exposure,
      };
    }
    return {
      costs: [timing],
      gains: [{ currency: 'compute', amount: Math.round(-dH) }, { currency: 'revenue', amount: revLoss }],
      exposure: [],
    };
  },
  apply(s, ctx, p: P) {
    const techId = typeof p.tech === 'string' && TECH_BY_ID[p.tech] ? p.tech : defaultTech(s);
    if (!techId) return;
    const st = s.world.techs[techId];
    const cur = st.playerProject?.computeShare ?? 0;
    const share = typeof p.share === 'number' ? Math.max(0, Math.min(0.3, p.share)) : cur > 0 ? 0 : 0.03;
    if (share <= 0) {
      delete st.playerProject;
      ctx.log('company', `Moonshot on ${TECH_BY_ID[techId].name} wound down.`);
      return;
    }
    // Cap total moonshot compute at the serving pool.
    const others = moonshotH100e(s) - s.player.computeOnline * cur;
    const room = Math.max(0, s.player.computeOnline * s.player.split.serving - others) / Math.max(1, s.player.computeOnline);
    st.playerProject = { computeShare: Math.min(share, room) };
    const blocked = techBlocker(s, TECH_BY_ID[techId], worldMix(s).bestPublic);
    ctx.log('company', `Moonshot on ${TECH_BY_ID[techId].name}: ${(st.playerProject.computeShare * 100).toFixed(1)}% of compute${blocked ? ` (gate: ${blocked}, needs our internal model)` : ''}.`);
  },
};

export const WORLD_ACTIONS: ActionDef[] = [transitionFund, moonshot];
