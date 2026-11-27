// RD-UI0a targeted check: What binds / the +10% elasticities / the response charts / the research-speed readout read the
// lab's BELIEVED production parameters (production/believed.ts), never the hidden draw. Two worlds that differ only in
// the hidden production draw give the same readouts, at day 0 and after 30 days; no view / readout file reads
// s.hidden.timeline.prod. Run: npx tsx scripts/v2/_ui0a/check.ts
import { readFileSync, readdirSync } from 'node:fs';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { capPriorityList, capProjectView } from '../../../src/engine/v2/models/researchView';
import { computeProduction, labSpeedRel } from '../../../src/engine/v2/production/production';
import { responseCurves } from '../../../src/engine/v2/production/readout';
import { prodParamsFor } from '../../../src/engine/v2/world/hidden';
import { cesFromAsymptotes } from '../../../src/engine/v2/production/ces';
import { TREE, } from '../../../src/data/v2/tree';
import { isCapProject } from '../../../src/engine/v2/models/research';
import { Rng } from '../../../src/engine/rng';
import { check, finish, runTo } from '../lib';
import type { GameStateV2 } from '../../../src/engine/v2/types';

const readouts = (s: GameStateV2) => JSON.stringify({
  list: capPriorityList(s).list.map((v) => [v.id, v.eC, v.eL, v.eCBand, v.eLBand, v.bound]),
  all: TREE.filter((n) => isCapProject(n)).map((n) => { const v = capProjectView(s, n.id); return v && [v.eC, v.eL, v.bound]; }),
  label: computeProduction(s, 'player')?.label, rc: responseCurves(s), rel: labSpeedRel(s),
});
const withLa = (s: GameStateV2, La: number) => {
  const t = structuredClone(s);
  const P = t.hidden.timeline.prod;
  t.hidden.timeline.prod = { ...P, La, ...cesFromAsymptotes(La, P.Ca, P.slow10) };
  return t;
};

// Two games of one timeline: the drawn run differs by seed.
const a = newGame(defaultSetupV2({ seed: 3, world: 'tl-central', alignment: 'medium', tutorial: false }));
const b = newGame(defaultSetupV2({ seed: 11, world: 'tl-central', alignment: 'medium', tutorial: false }));
check(Math.abs(a.hidden.timeline.prod.La - b.hidden.timeline.prod.La) > 1, 'the two seeds draw different hidden La', `${a.hidden.timeline.prod.La.toFixed(1)} vs ${b.hidden.timeline.prod.La.toFixed(1)}`);
const draw2 = prodParamsFor({ world: 'tl-central', seed: 99 });
for (const [day, s0] of [[0, a], [30, (runTo(a, 30), a)]] as const) {
  const lo = withLa(s0, 2), hi = withLa(s0, 180), other = withLa(s0, draw2.La);
  const r = readouts(lo);
  check(r === readouts(hi) && r === readouts(other), `day ${day}: same What-binds / elasticity / response / speed readouts at hidden La 2, 180, ${draw2.La.toFixed(1)}`, r.slice(0, 160));
}
{
  // Physics still reads the truth: the hidden draws do move the engine.
  const lo = withLa(a, 2), hi = withLa(a, 180);
  runTo(lo, 60); runTo(hi, 60);
  check(JSON.stringify(lo.player.research.last?.x) !== JSON.stringify(hi.player.research.last?.x), 'physics still reads the hidden draw (research.last.x differs)');
}
{
  // Grep: no view / readout / selector file reads s.hidden.timeline.prod.
  const dir = new URL('../../../src/engine/v2/', import.meta.url);
  const files: string[] = [];
  const walk = (d: URL, rel: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(new URL(`${e.name}/`, d), `${rel}${e.name}/`); else if (/(View|readout|selectors|believed)\.tsx?$/.test(e.name)) files.push(`${rel}${e.name}`); } };
  walk(dir, '');
  const ui = readdirSync(new URL('../../../src/ui/v2/panels/', import.meta.url)).map((f) => `../../ui/v2/panels/${f}`);
  const hits = [...files, ...ui].filter((f) => /hidden\.timeline\.prod|\.prod\.(La|u|v|rho|zeta|lam)\b/.test(readFileSync(new URL(f, dir), 'utf8')));
  check(hits.length === 0, `no view / readout / selector / panel file reads hidden production parameters (${files.length + ui.length} files)`, hits.join(', ') || 'clean');
}
finish('RD-UI0a');
