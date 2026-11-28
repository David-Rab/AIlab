// Outside world and revenue, mechanism checks: what it guards. The world effects' wiring (V2-SPEC §7.3, F11): revenue
// is written on every external deployment, world state stays plain JSON, leverage is a tier in [0,1), the two World
// actions (transition fund, moonshot) take effect. Constructed cases only, no played game: a fresh start (30 + 60 days)
// and the day-900 fixture (60 days). Cost ≈ 150 sim-days, a few CPU-s. Tier: quick.
// The sourced outcome bands of reference play (revenue, labour, adoption, token anchors, date checks) are calibration, not
// tests: they live in scripts/v2/calreport/world.ts (design/TESTING.md §0).
import { makeCtx, tick } from '../../src/engine/v2/core/loop';
import { ACTIONS } from '../../src/engine/v2/core/registry';
import { domainScaleGs } from '../../src/engine/v2/models/capability';
import { LEVERAGE_THRESHOLDS, leverage, leverageTier } from '../../src/engine/v2/worldfx/control';
import { revenueOf } from '../../src/engine/v2/worldfx/revenue';
import type { GameStateV2, SetupV2 } from '../../src/engine/v2/types';
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { WORLD_TECHS } from '../../src/data/v2/techs';
import { internalVersion } from '../../src/engine/v2/models/labs';
import { techBlocker } from '../../src/engine/v2/worldfx/techtree';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../src/engine/v2/core/save';
import { FIXTURE_DIR, check, finish, validateJson } from './lib';

/** A fresh start state (tutorial on, as a player starts). */
const refGame = (over: Partial<SetupV2> = {}): GameStateV2 => newGame(defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', ...over }));

const fx = deserialize(readFileSync(join(FIXTURE_DIR, 'day900.json'), 'utf8'));

console.log('Revenue and state');
check(Math.abs(refGame().player.finance.revenueRun - 12) < 1e-9, 'F11 revenue run-rate at start = $12B', '');
check(validateJson(fx).length === 0, 'world state stays plain JSON (day-900 fixture)', validateJson(fx).slice(0, 3).join('; '));
{
  const s = structuredClone(fx);
  for (let i = 0; i < 7; i++) tick(s, { skip: ['endings'] });
  const ext = s.player.deployments.filter((d) => d.channel !== 'internal');
  check(ext.length > 0 && ext.every((d) => d.revenueRate !== undefined && d.demandBound !== undefined && revenueOf(s, d.id) === d.revenueRate),
    'revenue writes revenueRate and demandBound on every external deployment', `${ext.length} external deployments`);
}

console.log('Control / leverage and actions');
{
  const lev = leverage(fx, 'player');
  check(lev >= 0 && lev < 1 && ['none', 'entrenched', 'indispensable', 'decisive'].includes(leverageTier(fx, lev)), 'leverage(player) in [0,1) with a tier', `${lev.toFixed(3)} (${leverageTier(fx, lev)}; thresholds ${Object.values(LEVERAGE_THRESHOLDS).join('/')})`);
  const s2 = refGame();
  for (let i = 0; i < 30; i++) tick(s2, { skip: ['endings'] });
  const ctx = makeCtx(s2);
  const wa = ACTIONS.filter((a) => a.owner === 'WS5');
  // CP3 rewrite (RD-P08); MK-11: sector adaptations are harnesses (product tools, feature.build / feature.toggle).
  check(wa.length === 2 && ['wfx.transitionFund', 'wfx.moonshot'].every((id) => wa.some((a) => a.id === id)) && !ACTIONS.some((a) => a.id === 'product.adapt'),
    'the World actions registered (transition fund, moonshot); no product.adapt (MK-11)', wa.map((a) => a.id).join(', '));
  const cash0 = s2.player.finance.cash;
  const tf = wa.find((a) => a.id === 'wfx.transitionFund')!;
  tf.apply(s2, ctx, { amount: 10 });
  for (let i = 0; i < 60; i++) tick(s2, { skip: ['endings'] });
  check(s2.player.policies.transitionFund === 10 && s2.player.finance.cash < cash0 + 1e3, 'transition fund: set and paid from cash');
  const ms = wa.find((a) => a.id === 'wfx.moonshot')!;
  // At day 30 the start model researches nothing (every tech is gated: W03 needs REASON 7), so the action is unavailable
  // there; use the day-900 fixture, where a beneficial non-risk tech is researchable.
  const s3 = structuredClone(fx);
  const iv = internalVersion(s3);
  const tech = WORLD_TECHS.find((x) => s3.world.techs[x.id]?.discoveredDay === undefined && x.effects.benefit && !x.risk && iv && techBlocker(s3, x, domainScaleGs(s3.hidden.timeline, iv)) === undefined)?.id ?? 'W03';
  const avail = ms.available(s3);
  const pv = ms.preview(s3, { tech, share: 0.05 });
  ms.apply(s3, makeCtx(s3), { tech, share: 0.05 });
  const prog0 = s3.world.techs[tech].prog;
  for (let i = 0; i < 60; i++) tick(s3, { skip: ['endings'] });
  const ts = s3.world.techs[tech];
  check(avail === true && (ts.playerProject?.computeShare ?? 0) > 0 && (ts.prog > prog0 || ts.discoveredDay !== undefined) && pv.costs.some((x) => x.currency === 'compute'),
    'moonshot: compute assigned, tech advances, preview costs compute', `${tech} ${prog0.toFixed(3)} → ${ts.prog.toFixed(3)}`);
}

finish('worldfx');
