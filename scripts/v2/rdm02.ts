// RD-M02 / RF-R5 check: the know-how readouts never carry the engine's true effects. A stack's adopted total is the sum
// of the adopted results' believed estimates (± their combined band); an adopted idea shows its believed band and the
// first evaluated model trained with it, never a measured number of its own; the measured gain is per model (its fitted
// level minus that of the comparable earlier model, with the fit band). Run alone: npx tsx scripts/v2/rdm02.ts
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { measuredDelta, otherEffectViews, stackViews } from '../../src/engine/v2/models/researchView';
import { addBelief, addIdea } from '../../src/engine/v2/models/stacks';
import type { GameStateV2, ModelVersion } from '../../src/engine/v2/types';

let fail = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'pass' : 'FAIL'} ${msg}`);
  if (!ok) fail++;
};
const s: GameStateV2 = newGame(defaultSetupV2({ seed: 3, world: 'tl-central', alignment: 'medium', tutorial: false }));
const day = s.time.day;
const TRUE = 0.777;
// Adopt as the engine does (research.ts): the true effect into the buckets, the estimate into the believed total.
const st = s.player.research.stacks.rlMid;
const est0 = st.est ?? 0;
addIdea(st, TRUE, 0, 1e26, 1);
addBelief(st, 0.05, 0.01);
s.player.research.adopted.push({ id: 'L.rlalg', name: 'RL idea', stack: 'rlMid', eff: TRUE, est: 0.05, estSd: 0.01, s: 0, day });
s.player.research.adopted.push({ id: 'P09', name: 'Domain idea', kind: 'domain', eff: TRUE, est: 1, estSd: 0.2, s: 0, day });
const stack = () => stackViews(s).find((g) => g.key === 'rlMid')!;
const idea = () => stack().ideas.find((a) => a.id === 'L.rlalg')!;
const dom = () => otherEffectViews(s).find((x) => x.id === 'P09')!;
const g = stack();
check(Math.abs(g.adopted - (est0 + 0.05)) < 1e-9 && Math.abs(g.now - (g.base + est0 + 0.05)) < 1e-9 && g.adoptedSd > 0,
  `stack total is the believed sum: adopted ${g.adopted} ± ${g.adoptedSd.toFixed(4)} (est 0.05), now ${g.now} (true buckets hold +${TRUE})`);
const vs = s.player.models.versions;
const proto = vs[vs.length - 1] as ModelVersion;
const before = idea();
check(!('measured' in before) && before.seenIn === undefined && !('eff' in before) && !JSON.stringify(before).includes(String(TRUE)),
  `before an embodying model is evaluated: not in a model yet, no true value in the view (${JSON.stringify(before)})`);
const p = proto.evals;
const ev = (dL: number, dR: number, sd: number) => ({ ...p, measuredL: (p.measuredL ?? 5) + dL, fitSd: sd, measuredDom: { ...(p.measuredDom ?? {}), REASON: (p.measuredDom?.REASON ?? 1) + dR } });
vs.push({ ...proto, id: 'Tnew', name: 'Tnew', day: day + 10, status: 'ready', variant: 'full', trained: { rlDay: day + 1, post: true }, evals: ev(0.31, 0.5, 0.1) });
const a = idea();
check(a.seenIn === 'Tnew' && !('measured' in a) && !JSON.stringify(a).includes(String(TRUE)), `after: the idea names the model trained with it (${a.seenIn}) and has no measured number of its own`);
const m = measuredDelta(s, vs[vs.length - 1]);
const band = Math.hypot(0.1, p.fitSd ?? 0.2);
check(!!m && Math.abs(m.dL - 0.31) < 1e-9 && Math.abs(m.sd - band) < 1e-9 && m.vs === proto.name, `the model's measured gain: ${m?.dL.toFixed(3)} ± ${m?.sd.toFixed(3)} L over ${m?.vs} (want 0.31 ± ${band.toFixed(3)})`);
check(dom().rows.every((r) => !('measured' in r)) && !JSON.stringify(dom()).includes(String(TRUE)), 'domain rows carry the believed band only');
check(!JSON.stringify(stackViews(s).map((x) => ({ ...x, gap: undefined, inModel: undefined }))).includes(String(TRUE)), 'no stack view carries the true effect (gap / inModel aside: RF-R5 left)');
// Moving the true value changes nothing in the believed readouts.
const snap = JSON.stringify({ adopted: stack().adopted, now: stack().now, idea: idea() });
s.player.research.adopted[0].eff = 5;
addIdea(st, 1, 0, 1e26, 0);
check(JSON.stringify({ adopted: stack().adopted, now: stack().now, idea: idea() }) === snap, 'changing the true effects leaves the believed readouts unchanged');
console.log(fail ? `${fail} FAIL` : 'all pass');
process.exit(fail ? 1 : 0);
