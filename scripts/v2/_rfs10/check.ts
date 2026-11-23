// RF-S10 check (npx tsx scripts/v2/_rfs10/check.ts): method strength at scale is two-sided around the tested effect
// (q ~ U[0, 2], believed 1 = as tested), saves redraw it from the seed, and the run preview's method line is in player
// language (no citations, no "typical agenda").
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { methodScaleOf } from '../../../src/engine/v2/world/hidden';
import { methodLines, methodStrength } from '../../../src/engine/v2/safety/methods';
import { METHOD_SCALE, METHOD_SCALE_BELIEVED } from '../../../src/data/v2/agendas';
import { gV0 } from '../../../src/engine/v2/models/capability';
import type { GameStateV2, PostDesign } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const qs: number[] = [];
for (let seed = 1; seed <= 2000; seed++) qs.push(methodScaleOf(seed)['T-INOC']);
const mean = qs.reduce((a, b) => a + b, 0) / qs.length;
const above = qs.filter((q) => q > 1).length / qs.length;
check(METHOD_SCALE.lo === 0 && METHOD_SCALE.hi === 2 && METHOD_SCALE_BELIEVED === 1 && Math.min(...qs) >= 0 && Math.max(...qs) <= 2 && Math.abs(mean - 1) < 0.05 && Math.abs(above - 0.5) < 0.05,
  'q ~ U[0, 2]: either way around the tested effect; believed 1', `mean ${mean.toFixed(3)}, ${(above * 100).toFixed(0)}% above 1`);

const s: GameStateV2 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
check(JSON.stringify(s.hidden.methodScale) === JSON.stringify(methodScaleOf(s.setup.seed)), 'save migrates to the two-sided draw from its seed', `T-INOC q ${s.hidden.methodScale['T-INOC'].toFixed(3)}`);
check(methodStrength(s, 'T-INOC', 0, 'believed') === 1 && methodStrength(s, 'T-INOC', 6, 'believed') === 1, 'believed strength = as tested, below and far above the tested model');

const post = { ...(s.player.models.versions.at(-1)!.design as PostDesign), methods: ['T-INOC', 'T-ANTISCHEME'] };
const g = gV0(s.hidden.timeline) + 4;
const lines = methodLines(s, post, undefined, g).gains.map((l) => l.target ?? '');
console.log(lines.map((l) => `     ${l}`).join('\n'));
check(lines.length === 2 && lines.every((l) => !/arXiv|et al\.|typical agenda/.test(l) && /Only tested on weaker models/.test(l) && /from 0% to/.test(l)), 'preview in player language: range from 0% to double, no citations');
console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
