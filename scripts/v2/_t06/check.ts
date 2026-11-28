// RD-T06 targeted check (DD-07): no expert-data purchase by domain; a suite build buys its expert data; P12 unlocks the
// long-tasks demonstrations build, which raises that suite's fidelity at its cost. (CP4: the rev-64 migration check is gone with the UB-3 save break.)
import { DEMO_BUILD, EXPERT_PRICE_B_PER_T, SUITE_BUILD } from '../../../src/data/v2/suites';
import { TREE_BY_ID } from '../../../src/data/v2/tree';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { act, makeCtx } from '../../../src/engine/v2/core/loop';
import { deserialize } from '../../../src/engine/v2/core/save';
import { completeSuiteWork, suiteExpertT, suiteFidelity, suiteWorkBlock, suiteWorkCost } from '../../../src/engine/v2/models/suites';
import { DATA_ACTIONS } from '../../../src/engine/v2/production/dataActions';
import type { OwnedDataAsset } from '../../../src/engine/v2/types';
import { check, finish } from '../lib';

const game = () => newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, labKind: 'leader', tutorial: false }));
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;

const s = game();
check(!DATA_ACTIONS.some((x) => x.id === 'data.expert') && act(s, 'data.expert', { domain: 'BIO', tokensT: 0.002 }) !== undefined, 'no domain expert-data purchase');
check(!s.player.dataPortfolio.assets.some((a) => a.kind === 'expert' && !a.family), 'no expert asset outside a suite at start');

s.player.finance.cash = 100;
const c = suiteWorkCost(s, 'swe', 'build');
const cash0 = s.player.finance.cash;
check(!act(s, 'suite.build', { family: 'swe' }) && near(c.cashB, SUITE_BUILD.tokensT * EXPERT_PRICE_B_PER_T) && near(cash0 - s.player.finance.cash, c.cashB),
  'a suite build pays for its expert data', `$${c.cashB}B, paid ${(cash0 - s.player.finance.cash).toFixed(3)}`);

const blocked = suiteWorkBlock(s, 'longHorizon', 'build', true);
check(!!blocked && act(s, 'suite.build', { family: 'longHorizon', demos: true }) !== undefined, 'demos build needs P12', blocked);
check(!TREE_BY_ID.P12.effect, 'P12 is an unlock (no adoption effect, no cash at adoption)');

const d = game();
d.player.finance.cash = 100;
d.player.tree.P12 = { status: 'known', progress: 1, attempts: 1 } as never;
const plain = suiteWorkCost(d, 'longHorizon', 'build');
const prem = suiteWorkCost(d, 'longHorizon', 'build', true);
const fid0 = suiteFidelity(d, 'longHorizon');
const E0 = suiteExpertT(d, 'longHorizon');
const before = d.player.finance.cash;
check(!act(d, 'suite.build', { family: 'longHorizon', demos: true }) && near(before - d.player.finance.cash, prem.cashB) && near(prem.cashB - plain.cashB, DEMO_BUILD.tokensT * EXPERT_PRICE_B_PER_T),
  'demos build costs the build + $1B of demonstrations', `plain $${plain.cashB}B, demos $${prem.cashB}B`);
completeSuiteWork(d, makeCtx(d), 'longHorizon:build:demos');
const p = game();
completeSuiteWork(p, makeCtx(p), 'longHorizon:build');
check(near(suiteExpertT(d, 'longHorizon'), E0 + SUITE_BUILD.tokensT + DEMO_BUILD.tokensT, 1e-15) && suiteFidelity(d, 'longHorizon') > suiteFidelity(p, 'longHorizon') && suiteFidelity(p, 'longHorizon') > fid0,
  'P12 option raises long-tasks fidelity beyond a plain build', `${fid0.toFixed(3)} → plain ${suiteFidelity(p, 'longHorizon').toFixed(3)} / demos ${suiteFidelity(d, 'longHorizon').toFixed(3)}`);

finish('rdt06');
