// RD-M02 check: a recipe idea's "realised" readout is the measured eval delta of the first model that embodies it
// (its fitted level minus that of the comparable model without it, with the fit band), never the engine's true
// value; before such a model is evaluated it reads "not yet measured". Run alone: npx tsx scripts/v2/rdm02.ts
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { otherEffectViews, stackViews } from '../../src/engine/v2/models/researchView';
import type { GameStateV2, ModelVersion } from '../../src/engine/v2/types';

let fail = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'pass' : 'FAIL'} ${msg}`);
  if (!ok) fail++;
};
const s: GameStateV2 = newGame(defaultSetupV2({ seed: 3, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false }));
const day = s.time.day;
const TRUE = 0.777;
s.player.research.adopted.push({ id: 'L.rlalg', name: 'RL idea', stack: 'rlMid', eff: TRUE, est: 0.05, estSd: 0.01, s: 0, day });
s.player.research.adopted.push({ id: 'P09', name: 'Domain idea', kind: 'domain', eff: TRUE, est: 1, estSd: 0.2, s: 0, day });
const idea = () => stackViews(s).find((g) => g.key === 'rlMid')!.ideas.find((a) => a.id === 'L.rlalg')!;
const dom = () => otherEffectViews(s).find((x) => x.id === 'P09')!;
const vs = s.player.models.versions;
const proto = vs[vs.length - 1] as ModelVersion;
const before = idea();
check(before.measured === undefined && before.seenIn === undefined && !('eff' in before) && !JSON.stringify(before).includes(String(TRUE)),
  `before an embodying model is evaluated: not yet measured, no true value in the view (${JSON.stringify(before)})`);
const p = proto.evals;
const ev = (dL: number, dR: number, sd: number) => ({ ...p, measuredL: (p.measuredL ?? 5) + dL, fitSd: sd, measuredDom: { ...(p.measuredDom ?? {}), REASON: (p.measuredDom?.REASON ?? 1) + dR } });
vs.push({ ...proto, id: 'Tnew', name: 'Tnew', day: day + 10, status: 'ready', variant: 'full', trained: { rlDay: day + 1, post: true }, evals: ev(0.31, 0.5, 0.1) });
const a = idea();
const want = 0.31, band = Math.hypot(0.1, p.fitSd ?? 0.2);
check(!!a.measured && Math.abs(a.measured.dL - want) < 1e-9 && Math.abs(a.measured.sd - band) < 1e-9 && a.measured.vs === proto.name && a.seenIn === 'Tnew',
  `realised = measured ΔL of Tnew over ${proto.name}: ${a.measured?.dL.toFixed(3)} ± ${a.measured?.sd.toFixed(3)} (want ${want} ± ${band.toFixed(3)})`);
check(!JSON.stringify(a).includes(String(TRUE)) && Math.abs((a.measured?.dL ?? 0) - TRUE) > 0.1, 'the readout carries no true recipe value');
const d = dom().rows.find((r) => r.label === 'Math & reasoning');
console.log(JSON.stringify(dom().rows));
check(dom().rows.every((r) => r.measured === undefined || Math.abs(r.measured.d - TRUE) > 0.1) && (p.measuredDom?.REASON === undefined || Math.abs((d?.measured?.d ?? 0) - 0.5) < 1e-9), 'domain rows read the measured domain delta, not the true value');
// Moving the true value changes nothing in the readout.
s.player.research.adopted[0].eff = 5;
check(Math.abs(idea().measured!.dL - want) < 1e-9, 'changing the true value leaves the readout unchanged');
console.log(fail ? `${fail} FAIL` : 'all pass');
process.exit(fail ? 1 : 0);
