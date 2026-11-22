// RD-U05: domain difficulty in one place. The displayed domain score is λ(G_d − (best_d − G_SC)), best_d the domain's
// best human from the work types' reference points (refDelta); no display offset table is left. Run alone:
// `npx tsx scripts/v2/domainref.ts`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DOMAIN_IDS } from '../../src/data/v2/calibration';
import { refDelta } from '../../src/data/v2/workTypes';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { deserialize, serialize } from '../../src/engine/v2/core/save';
import { domainRefShift, domainsOf, levelOfG } from '../../src/engine/v2/models/capability';
import { domainG } from '../../src/engine/v2/departments/workfit';
import { clamp } from '../../src/engine/rng';
import type { DomainId } from '../../src/engine/v2/types';
import { HERE, check, finish } from './lib';

const ROOT = join(HERE, '..', '..');
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// 1. Grep: REF_OFF is gone from src.
const hits: string[] = [];
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && readFileSync(p, 'utf8').includes('REF_OFF')) hits.push(p);
  }
};
walk(join(ROOT, 'src'));
check(hits.length === 0, 'grep: no REF_OFF in src', hits.join(', '));

for (const world of ['ai2027', 'authors2026', 'fast', 'slow'] as const) {
  const s = newGame(defaultSetupV2({ world, alignment: 'medium', seed: 2027, tutorial: false }));
  const w = s.hidden.timeline;
  const rd = refDelta(w.v3.sdSC);
  const V0 = s.player.models.versions[0];
  // 2. The shift is the reference points' δ_d·Δ_bm; a model at a domain's best human scores 10 there.
  const shiftOk = DOMAIN_IDS.every((d) => near(domainRefShift(w, d), rd[d] * w.v3.dBM, 1e-12));
  const atBest = DOMAIN_IDS.every((d) => near(clamp(levelOfG(w, w.v3.gSC + rd[d] * w.v3.dBM - domainRefShift(w, d)), 0, 15), 10, 1e-9));
  // 3. V0's stored domain scores are λ(G_d − shift_d) of the fit's domain G.
  const err = Math.max(...DOMAIN_IDS.map((d) => Math.abs(V0.domains[d] - clamp(levelOfG(w, domainG(s, V0, d) - domainRefShift(w, d)), 0, 15))));
  check(shiftOk && atBest && err < 1e-9, `${world}: domain score = λ(G_d − δ_d·Δ_bm); 10 at each domain's best human; V0 stored = formula`,
    `Δ_bm ${w.v3.dBM}, V0 ${DOMAIN_IDS.map((d: DomainId) => `${d} ${V0.domains[d].toFixed(2)}`).join(' ')}`);
}

// 4. Save migration 47 → 48 recomputes stored domain records (player version, a rival's public model).
const s = newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, tutorial: false }));
const raw = JSON.parse(serialize(s));
raw.schemaRev = 47;
raw.player.models.versions[0].domains.PHYS = 99;
const r0 = raw.rivals.find((r: { publicModel?: unknown }) => r.publicModel);
if (r0) r0.publicModel.domains.BIO = 99;
const m = deserialize(JSON.stringify(raw));
const v = m.player.models.versions[0];
const rm = m.rivals.find((r) => r.publicModel)?.publicModel;
check(near(v.domains.PHYS, s.player.models.versions[0].domains.PHYS, 1e-12) && (!rm || near(rm.domains.BIO, domainsOf(m.hidden.timeline, rm.G).BIO, 1e-12)),
  'save 47 → 48: stored domain levels (player version, rival public model) recomputed', `PHYS ${v.domains.PHYS.toFixed(3)}${rm ? `, rival BIO ${rm.domains.BIO.toFixed(3)}` : ''}`);

finish('domainref');
