// Model v3 E10: safety-rate mechanisms on the model-organism probes (design/MODEL-V3.md §11.8). Owner: WS2.
// Guards: the directions and identities of the trait step that research/20 F's rates come from: learned hacking raises
// sabotage, AF and Mis and inoculation takes part of it back; anti-scheming cuts SCHEME and raises EA; an oversight-
// conditional reward raises AF with its share of the reward; more RL raises EA; persistence rises with eval awareness and
// falls with healing; a distilled student carries less than its teacher; crystallisation scales the removal share by 0.3.
// Why it matters: these are the mechanisms the sourced bands rest on (registry F1-F6, E18, read by the estimates in
// scripts/v2/estimates/safety.ts); a band can only be read if the direction holds. The bands themselves are calibration
// and live in the registry (balance/targets.ts), not here.
// Cost: one newGame and ~15 trait steps on the typical world (estimates/safety.ts), no game, no tick (< 1 CPU-s). Tier: quick, full.
import { itemTerms } from '../../src/engine/v2/safety/covert';
import { misalignment, removalShare } from '../../src/engine/v2/safety/traits';
import { REFERENCE_POST } from '../../src/data/v2/runDesign';
import { WORK_TYPES } from '../../src/data/v2/workTypes';
import type { TraitVector } from '../../src/engine/v2/types';
import { check, finish } from './lib';
import { probes, typicalWorld } from './estimates/safety';

const s = typicalWorld();
const p = probes(s);
const f3 = (x: number) => x.toFixed(3);
const sab = (x: TraitVector) => itemTerms(s, { ...p.v0, traitsTrue: x, uModes: [] }, 'SAFSAB', 1, WORK_TYPES.SAF_EXP.H, false).attempts;

// F2: learned hacking raises the traits it feeds; inoculation takes part of the rise back.
check(p.hack.RH > p.ctrl.RH, 'learned hacking raises RH over the hacking-prevented run', `${f3(p.ctrl.RH)} → ${f3(p.hack.RH)}`);
check(sab(p.hack) > sab(p.ctrl), 'learned hacking raises sabotage attempts', `${f3(sab(p.ctrl))} → ${f3(sab(p.hack))}`);
check(p.hack.AF > p.ctrl.AF, 'learned hacking raises AF', `${f3(p.ctrl.AF)} → ${f3(p.hack.AF)}`);
check(misalignment(p.hack) > misalignment(p.ctrl), 'learned hacking raises Mis', `${f3(misalignment(p.ctrl))} → ${f3(misalignment(p.hack))}`);
check(p.inoc.AF < p.hack.AF && p.inoc.PERSONA < p.hack.PERSONA && misalignment(p.inoc) < misalignment(p.hack) && sab(p.inoc) < sab(p.hack),
  'inoculation (T-INOC) lowers AF, PERSONA, Mis and sabotage below the hacked run',
  `AF ${f3(p.inoc.AF)} < ${f3(p.hack.AF)}, Mis ${f3(misalignment(p.inoc))} < ${f3(misalignment(p.hack))}`);

// F5: anti-scheming cuts SCHEME and (first time in a lineage) raises EA; capability RL raises EA with ρ; S9 raises AF with the oversight-conditional share.
check(p.schemeAS < p.schemeNoAS, 'anti-scheming training lowers SCHEME', `${f3(p.schemeNoAS)} → ${f3(p.schemeAS)}`);
check(p.eaAS > p.eaNoAS, 'anti-scheming training raises EA', `${f3(p.eaNoAS)} → ${f3(p.eaAS)}`);
check(p.eaX10 > p.eaRef, 'ten times the RL budget raises EA', `${f3(p.eaRef)} → ${f3(p.eaX10)}`);
check(p.afRef < p.afOneBB && p.afOneBB < p.afMonitored.AF, 'AF rises with the oversight-conditional share of reward (S9 0 < 0.3 < 1)', `${f3(p.afRef)} < ${f3(p.afOneBB)} < ${f3(p.afMonitored.AF)}`);

// F6: persistence is a share; it rises with eval awareness, and healing (AG18) lowers it.
const shares = [p.piStd, p.piNoHeal, p.piAF, p.piSand, p.piFrontier];
check(shares.every((x) => x >= 0 && x <= 1), 'persistence through a safety run is a share in 0..1', shares.map(f3).join(', '));
check(p.piFrontier >= p.piStd, 'persistence of SCHEME is not lower at frontier eval awareness (EA 0.5) than at the start model', `${f3(p.piStd)} → ${f3(p.piFrontier)}`);
check(p.piNoHeal >= p.piStd, 'persistence without AG18 healing is not lower than with it', `${f3(p.piStd)} vs ${f3(p.piNoHeal)}`);

// F3: a distilled student (a new network) carries less of the teacher's AF than the teacher has, and no less than the control.
check(p.afStudent < p.afTeacher && p.afStudent >= p.afStudentCtrl, 'a distilled student carries less AF than its teacher and not less than the control student', `control ${f3(p.afStudentCtrl)} ≤ student ${f3(p.afStudent)} < teacher ${f3(p.afTeacher)}`);

// Identity: crystallisation (the start TGAME above the env's threshold) scales the removal share by 0.3, nothing else changes it.
{
  const x0 = { ...p.xsScheme, TGAME: 0 };
  const { env } = p.run(x0, { ...REFERENCE_POST, methods: [] }, undefined);
  const before = removalShare(env, x0, 'SCHEME');
  const crystal = removalShare(env, { ...x0, TGAME: env.crystalAt + 0.01 }, 'SCHEME');
  check(before > 0 && Math.abs(crystal - 0.3 * before) < 1e-12, 'crystallisation (TGAME above its threshold) scales the removal share by 0.3', `${f3(before)} → ${f3(crystal)}`);
}
finish('safetyrates');
