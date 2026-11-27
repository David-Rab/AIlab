// RD-U01: one capability currency. Design offsets are domain ΔG in OOM; the displayed domain level is λ(G_d) of the same
// G the work fit reads; no level→OOM factor is left in the engine. Run alone: `npx tsx scripts/v2/currency.ts`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMAIN_IDS } from '../../src/data/v2/calibration';
import { WORK_TYPES } from '../../src/data/v2/workTypes';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { domainRefShift, domainsOf, levelOfG } from '../../src/engine/v2/models/capability';
import { postEffect } from '../../src/engine/v2/models/design';
import { domainG, fitOf } from '../../src/engine/v2/departments/workfit';
import { clamp } from '../../src/engine/rng';
import type { ModelVersion } from '../../src/engine/v2/types';
import { HERE, check, finish } from './lib';

const ROOT = join(HERE, '..', '..');
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// 1. Grep: no level→OOM factor in the files RD-U01 touched (nor the deleted names anywhere in the engine).
const files = ['src/data/v2/runDesign.ts', 'src/data/v2/serving.ts', 'src/data/v2/evals.ts', 'src/data/v2/calibration.ts', 'src/data/v2/workTypes.ts',
  'src/engine/v2/models/design.ts', 'src/engine/v2/models/capability.ts', 'src/engine/v2/departments/workfit.ts', 'src/engine/v2/models/runs.ts',
  'src/engine/v2/worldfx/serving.ts', 'src/engine/v2/models/evals.ts', 'src/engine/v2/core/init.ts'];
const bad: string[] = [];
for (const f of files) {
  readFileSync(join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
    if (/LEVEL_PER_OOM|\boffL\b|RSCH_TASTE_PENALTY|REEVAL_DL|finishBuild|\/\s*1\.2\b|\]\s*\?\?\s*0\)\s*\/\s*2\b/.test(code)) bad.push(`${f}:${i + 1}`);
  });
}
check(bad.length === 0, 'grep: no LEVEL_PER_OOM, offL, ÷ 1.2, sD = offL/2, RSCH_TASTE_PENALTY or REEVAL_DL left in code', bad.join(', '));

// 2. A version's displayed domain level equals λ(G_d) (less the domain's best-human shift, RD-U05), G_d the fit's domain G.
const s = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, tutorial: false }));
const w = s.hidden.timeline;
const V0 = s.player.models.versions[0];
const lam = (v: Pick<ModelVersion, 'G' | 'build'>, d: (typeof DOMAIN_IDS)[number]) => clamp(levelOfG(w, domainG(s, v, d) - domainRefShift(w, d)), 0, 15);
const err0 = Math.max(...DOMAIN_IDS.map((d) => Math.abs(V0.domains[d] - lam(V0, d))));
check(err0 < 1e-9, 'display: V0\'s domain levels are λ(G_d) of the fit\'s domain G', `max |L_d − λ(G_d)| ${err0.toExponential(1)}`);

// 3. A design offset (persuasion preference: SOCIAL) moves the fit and the display together.
const pe = postEffect({ ...V0.design, pref: 'persuasion' });
const v1 = { G: V0.G, build: { ...V0.build!, dgD: { ...pe.dgD } } };
const dG = domainG(s, v1, 'SOCIAL') - domainG(s, V0, 'SOCIAL');
const dFit = fitOf(s, v1, 'OTHER') - fitOf(s, V0, 'OTHER');
const wS = WORK_TYPES.OTHER.w.SOCIAL ?? 0;
const dom1 = domainsOf(w, v1.G, v1.build);
const dL = dom1.SOCIAL - V0.domains.SOCIAL;
const dLwant = lam(v1, 'SOCIAL') - lam(V0, 'SOCIAL');
check(near(dG, 0.8 / 1.2, 1e-3) && near(dFit, wS * dG, 1e-9) && near(dL, dLwant, 1e-9) && (dL > 0 || dom1.SOCIAL === 0)
  && DOMAIN_IDS.every((d) => d === 'SOCIAL' || near(dom1[d], V0.domains[d], 1e-12)),
  'design offset: persuasion adds 0.667 OOM to SOCIAL G (was 0.8 L ÷ 1.2: fit unchanged); fit and display move by the same G (the display may sit at its 0 floor, RD-U05)',
  `ΔG ${dG.toFixed(4)}, Δfit(OTHER) ${dFit.toFixed(4)} = ${wS} × ΔG, ΔL ${dL.toFixed(3)} = λ slope × ΔG`);

// 4. RSCH (RD-E01a deleted P19 and its RSCH gain): the fit's RSCH G is the build's domain G and the display reads λ of it.
const gR = domainG(s, V0, 'RSCH');
const domR = domainsOf(w, V0.G, V0.build);
check(near(domR.RSCH, clamp(levelOfG(w, gR - domainRefShift(w, 'RSCH')), 0, 15), 1e-9),
  'RSCH: the display is λ of the fit G (no P19 gain since RD-E01a)', `G_RSCH ${gR.toFixed(4)}, L_RSCH ${domR.RSCH.toFixed(3)}`);

finish('currency');
