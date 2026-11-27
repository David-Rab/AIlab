// CP3c checks (run alone): (1) the long-tasks horizon multiplier is ×1 for a broad post-train and ×2 for a long-tasks
// focus on any base / budget (h50Of already scales with the RL gain in AGENCY G); (2) a rival's day-0 release reveals the
// lab's day-0 recipe, not its recipe of later days; (3) a rival streams only once it has adopted P08.
import { longTasksHorizonMult, rlGains, rlWeights, rlFamiliesAvailable } from '../../../src/engine/v2/models/effective';
import { RL_BUDGET } from '../../../src/data/v2/runDesign';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { otherLabs } from '../../../src/engine/v2/models/labs';
import { recipeOf, clRefresh } from '../../../src/engine/v2/actors/rivalModel';
import { refGame, runRef, check, finish } from '../lib';

const fams = rlFamiliesAvailable(() => false);
const broad = rlWeights('broad', fams);
const focus = rlWeights(['longHorizon'], fams);
for (const [F, b, e] of [[3e26, RL_BUDGET.standard, 0], [1e27, RL_BUDGET.standard, 0.1], [3e27, RL_BUDGET.standard * 3, 0.3]] as const) {
  const at = { flopPre: F, rlFlop: b * F, eRL: e };
  const hb = longTasksHorizonMult(rlGains(F, b * F, broad, e).perFamily.longHorizon ?? 0, 1, at);
  const hf = longTasksHorizonMult(rlGains(F, b * F, focus, e).perFamily.longHorizon ?? 0, 1, at);
  const hp = longTasksHorizonMult(rlGains(F, b * F, focus, e).perFamily.longHorizon ?? 0, 1.2, at);
  check(Math.abs(hb - 1) < 1e-9 && Math.abs(hf - 2) < 1e-9 && Math.abs(hp - 2.4) < 1e-9, `horizon multiplier broad ×1 / focus ×2 / focus+P07 ×2.4 at base ${F.toExponential(0)}, budget ${b.toFixed(2)}, e_RL ${e}`, `${hb.toFixed(3)} / ${hf.toFixed(3)} / ${hp.toFixed(3)}`);
}
const s = refGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 1 }));
const day0 = new Map(otherLabs(s).map((r) => [r.core.id, { pub: r.publicModel?.recG, rec: recipeOf(s, r) }]));
check([...day0.values()].every((x) => x.pub !== undefined && Math.abs(x.pub - x.rec) < 1e-12), 'day-0 releases are stamped with the lab\'s day-0 recipe', JSON.stringify([...day0].map(([k, v]) => [k, v.pub?.toFixed(3)])));
runRef(s, 40);
const r0 = otherLabs(s)[0];
check(otherLabs(s).every((r) => !r.publicModel || r.publicModel.recG === undefined || recipeOf(s, r) >= r.publicModel.recG), 'after 40 days no release reveals more than its lab\'s recipe');
check(otherLabs(s).every((r) => !(r.phys.ideas?.done.P08)) && otherLabs(s).every((r) => r.phys.clDay === undefined), 'no rival streams before adopting P08 (day 40)', otherLabs(s).map((r) => `${r.core.id} stream ${r.phys.clDay === undefined ? "off" : "on"}`).join(' '));
// Force adoption on one rival: the stream then moves its model after a period.
const s2 = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 1 }));
const r = otherLabs(s2)[1];
check(!clRefresh(s2, r, 0) && !clRefresh(s2, r, 14), 'clRefresh is a no-op without P08');
(r.phys.ideas ??= { spent: 0, done: {} }).done.P08 = 1;
const g0 = r.internal.G;
clRefresh(s2, r, 20);
const moved = clRefresh(s2, r, 27);
check(moved && r.internal.G > g0, 'with P08 the stream accrues from adoption and moves the model after CL_DAYS', `${g0.toFixed(3)} → ${r.internal.G.toFixed(3)}`);
finish();
