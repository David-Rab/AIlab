// RD-X03 targeted check (DD-18, TRN-22, MEA-11): a rival's versions get G through the player's baseG (runs.ts baseGOf)
// and rlGains on its stated reference portfolio; its model carries that reference-profile build (work fit, domains read
// it); no clG / refRlGain special path left in the rivals' training. (CP4: the rev-68 migration check is gone with the UB-3 save break.)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RL_BUDGET } from '../../../src/data/v2/runDesign';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { tick } from '../../../src/engine/v2/core/loop';
import { deserialize, serialize } from '../../../src/engine/v2/core/save';
import { rivalDesign, rivalDraw } from '../../../src/engine/v2/actors/rivalModel';
import { baseGOf } from '../../../src/engine/v2/models/runs';
import { gOfBuild, domainsOf } from '../../../src/engine/v2/models/capability';
import { rlFamiliesAvailable, rlGains, rlWeights } from '../../../src/engine/v2/models/effective';
import { workFit } from '../../../src/engine/v2/departments/workfit';
import type { GameStateV2, RivalLab } from '../../../src/engine/v2/types';
import { check, finish, HERE } from '../lib';

const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;

// 1. No clG path in src; the rivals' model file no longer calls the recipe-only RL shortcut.
const SRC = join(HERE, '..', '..', 'src');
const files: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
walk(SRC);
const clHits = files.filter((f) => /\bclG\b/.test(readFileSync(f, 'utf8')));
const rm = readFileSync(join(SRC, 'engine', 'v2', 'actors', 'rivalModel.ts'), 'utf8');
check(clHits.length === 0 && !/refRlGain|rlOnBase|gPreOf\(/.test(rm), 'no clG in src; rivalModel.ts has no refRlGain / rlOnBase / direct gPreOf', clHits.join(', '));

// 2. Run until each lab has made at least one new version, then recompute its release's G from the reference inputs.
const s: GameStateV2 = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, start: 'leader', tutorial: false }));
const labs = () => [...s.rivals, s.china.lab] as RivalLab[];
const id0 = new Map(labs().map((r) => [r.core.id, r.internal.id]));
const fams = rlFamiliesAvailable(() => false);
const refW = rlWeights('broad', fams);
const refFid = Object.fromEntries(fams.map((f) => [f, 1]));
let checked = 0;
let worst = 0;
for (let d = 0; d < 200 && checked < labs().length; d++) {
  tick(s);
  for (const r of labs()) {
    if (r.internal.id === id0.get(r.core.id) || !r.internal.build) continue;
    const b = r.internal.build;
    if (b.dg !== 0) continue; // a version kept over a weaker new build (G above it as general ΔG): not a fresh release
    id0.set(r.core.id, r.internal.id);
    const base = r.phys.base;
    const des = rivalDesign(base.flop, base.tpp);
    const gPreRef = baseGOf(des, { pre: base.ePre, draw: rivalDraw(des.params * des.tpp) }).parts.total;
    const rl = rlGains(base.flop, RL_BUDGET.standard * base.flop, refW, b.eRL, b.aRL ?? 0, refFid);
    // A stream (continued pretraining) may have raised G_pre over the base's: the base's own G_pre is baseG's.
    const gPre = b.gPre;
    const okBase = near(base.gPre, gPreRef, 1e-9) || base.day <= 0; // start bases: startLab's solve (same functions)
    const err = Math.abs(r.internal.G - (gPre + rl.general));
    worst = Math.max(worst, err);
    check(okBase && err < 1e-9 && near(rl.general, b.dgRL, 1e-12) && gPre >= base.gPre - 1e-12,
      `${r.core.id} release ${r.internal.name}: G = G_pre + rlGains.general on the reference inputs`,
      `G ${r.internal.G.toFixed(4)}, gPre ${gPre.toFixed(4)} (base ${base.gPre.toFixed(4)} vs baseG ${gPreRef.toFixed(4)}), RL ${rl.general.toFixed(4)}, err ${err.toExponential(1)}`);
    // Its domains and work fit read the build (not the general G alone).
    const dm = domainsOf(s.hidden.timeline, r.internal.G, b);
    const wf = workFit(s, r.internal, 'EXP');
    check(Object.keys(dm).every((k) => near(dm[k as keyof typeof dm], r.internal.domains[k as keyof typeof dm], 1e-12)) && Number.isFinite(wf.fit),
      `${r.core.id}: domain levels and work fit from the reference-profile build`, `EXP fit ${wf.fit.toFixed(3)} vs G ${r.internal.G.toFixed(3)}`);
    checked++;
  }
}
check(checked > 0, `at least one rival release recomputed (${checked} labs; worst |ΔG| ${worst.toExponential(1)})`);

finish();
