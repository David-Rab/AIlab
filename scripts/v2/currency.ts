// RD-U01: one capability currency. Design offsets are domain ΔG in OOM; the displayed domain level is λ(G_d) of the same
// G the work fit reads; no level→OOM factor is left in the engine. Run alone: `npx tsx scripts/v2/currency.ts`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMAIN_IDS, P19_RSCH_DG, REF_OFF } from '../../src/data/v2/calibration';
import { WORK_TYPES } from '../../src/data/v2/workTypes';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { deserialize, serialize } from '../../src/engine/v2/core/save';
import { domainsOf, levelOfG } from '../../src/engine/v2/models/capability';
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

// 2. A version's displayed domain level equals λ(G_d) (+ the display difficulty profile), G_d the fit's domain G.
const s = newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, tutorial: false }));
const w = s.hidden.timeline;
const V0 = s.player.models.versions[0];
const lam = (v: Pick<ModelVersion, 'G' | 'build'>, d: (typeof DOMAIN_IDS)[number]) => clamp(levelOfG(w, domainG(s, v, d)) + REF_OFF[d], 0, 15);
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
const dLwant = levelOfG(w, domainG(s, v1, 'SOCIAL')) - levelOfG(w, domainG(s, V0, 'SOCIAL'));
check(near(dG, 0.8 / 1.2, 1e-3) && near(dFit, wS * dG, 1e-9) && near(dL, dLwant, 1e-9) && dL > 0
  && DOMAIN_IDS.every((d) => d === 'SOCIAL' || near(dom1[d], V0.domains[d], 1e-12)),
  'design offset: persuasion adds 0.667 OOM to SOCIAL G (was 0.8 L ÷ 1.2: fit unchanged); fit and display move by the same G',
  `ΔG ${dG.toFixed(4)}, Δfit(OTHER) ${dFit.toFixed(4)} = ${wS} × ΔG, ΔL ${dL.toFixed(3)} = λ slope × ΔG`);

// 4. P19: RSCH gains P19_RSCH_DG in the fit and the display reads λ of it.
const p19was = s.player.paradigms.P19;
s.player.paradigms.P19 = { ...(p19was ?? {}), status: 'adopted' } as typeof p19was;
const gR = domainG(s, V0, 'RSCH');
const domP19 = domainsOf(w, V0.G, V0.build, true);
s.player.paradigms.P19 = p19was;
const gR0 = domainG(s, V0, 'RSCH');
check(near(gR - gR0, P19_RSCH_DG, 1e-12) && near(domP19.RSCH, clamp(levelOfG(w, gR) + REF_OFF.RSCH, 0, 15), 1e-9),
  'P19: +0.4167 OOM RSCH (was the 0.5 L taste penalty ÷ 1.2) in the fit; the display is λ of the same G', `ΔG ${(gR - gR0).toFixed(4)}, L_RSCH ${V0.domains.RSCH.toFixed(3)} → ${domP19.RSCH.toFixed(3)}`);

// 5. Migration 46 → 47: a stored offL becomes dgD at 1.2 L per OOM; offL / off gone; domains recomputed.
const raw = JSON.parse(serialize(s));
raw.schemaRev = 46;
const rb = raw.player.models.versions[0].build;
delete rb.dgD;
rb.offL = { SOCIAL: 0.8 };
rb.off = { SOCIAL: 0.8 };
raw.player.models.versions[0].domains.SOCIAL = 99;
const m = deserialize(JSON.stringify(raw));
const mb = m.player.models.versions[0].build! as unknown as Record<string, unknown> & { dgD: Record<string, number> };
check(near(mb.dgD.SOCIAL, 0.8 / 1.2, 1e-12) && !('offL' in mb) && !('off' in mb)
  && near(m.player.models.versions[0].domains.SOCIAL, lam(m.player.models.versions[0], 'SOCIAL'), 1e-9),
  'save: a schemaRev-46 build\'s offL migrates to dgD (÷ 1.2), offL / off dropped, domain levels recomputed as λ(G_d)', `dgD ${JSON.stringify(mb.dgD)}`);

finish('currency');
