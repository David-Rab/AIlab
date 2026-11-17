// Safety Index editions (V2-SPEC §3.9.5; research/17 §1.6.2). Owner: WS4. (Not a barrel module: "index" = the Safety Index.)
//
// Grades every active lab on six domains from OBSERVABLES only: published frameworks and their revisions, named
// testers, disclosures, governance, incidents disclosed vs leaked, and published research. Hidden traits and the
// rhetoric gap never enter the grade — the end screen shows grade vs true Mis (the "unreliable proxy" lesson).
import { clamp } from '../../rng';
import type { EngineSystem, GameStateV2, IndexGrade, LabId } from '../types';
import { activeRivals } from '../models/labs';
import { bloc, talent } from './fx';
import { hasCommitment } from './commitments';
import { evalIndepAccess } from './researchBodies';
import { postureOf } from './rivals';
import { ws4 } from './state';

const LETTERS: [number, string][] = [
  [4.15, 'A+'], [3.85, 'A'], [3.5, 'A-'], [3.15, 'B+'], [2.85, 'B'], [2.5, 'B-'], [2.15, 'C+'], [1.85, 'C'],
  [1.5, 'C-'], [1.15, 'D+'], [0.85, 'D'], [0.5, 'D-'], [-Infinity, 'F'],
];
export const letterOf = (gpa: number) => LETTERS.find(([t]) => gpa >= t)![1];

// R9 parent: a corporate division with a responsibility council but no independent safety board (GDM: C−) [D].
const GOV_SCORE: Record<string, number> = { legacyNonprofit: 0.65, nonprofitPBC: 0.75, pbcTrust: 0.6, founder: 0.3, parent: 0.45 };

function grade(d: IndexGrade['domains']): IndexGrade {
  const vals = Object.values(d);
  const overall = Math.round((vals.reduce((a, x) => a + x, 0) / vals.length) * 100) / 100;
  return { overall, domains: d, letter: letterOf(overall) };
}

const g43 = (x: number) => Math.round(clamp(x, 0, 1) * 4.3 * 100) / 100;

/** Player grade from what outsiders can see. */
export function gradePlayer(s: GameStateV2): IndexGrade {
  const w = ws4(s);
  const framework = hasCommitment(s, 'noDeployAbove') || hasCommitment(s, 'pauseIfRedline') ? 0.75 : s.gov.statutes.sb53 ? 0.4 : 0.15;
  const testers = (hasCommitment(s, 'preDeployTesting') ? 0.4 : 0) + (evalIndepAccess(s) ? 0.4 : 0) + 0.1;
  const disclosure = clamp(0.4 + 0.08 * w.disclosed - 0.15 * w.leaked, 0, 1);
  const pub = { none: 0.15, selective: 0.45, all: 0.8 }[s.player.policies.publishSafety] + 0.02 * w.papers;
  const goal = 0.12 * (w.goalposts.player ?? 0);
  return grade({
    risk: g43(0.3 + 0.5 * testers + (s.player.safety.evalGate === 'fullPlusExternal' ? 0.15 : 0)),
    harms: g43(disclosure * 0.8 + (s.player.policies.whistleblowerChannel ? 0.15 : 0)),
    frameworks: g43(framework - goal),
    existential: g43(0.15 + (hasCommitment(s, 'pauseIfRedline') ? 0.3 : 0) + (hasCommitment(s, 'monitorabilityPledge') ? 0.15 : 0) + 0.2 * pub),
    governance: g43((GOV_SCORE[s.player.board.preset] ?? 0.5) + (s.player.policies.whistleblowerChannel ? 0.1 : 0) - goal),
    sharing: g43(0.6 * pub + 0.3 * disclosure),
  });
}

/** Rival/China grade from posture observables (frameworks, testers, disclosure record, governance). Anchors:
 *  safety ≈ C+ 2.7, bigtech ≈ C 2.2, maverick ≈ F 0.7, DeepCent ≈ F 0.5 (FLI Summer 2026, research/17 §1.6.2). */
export function gradeRival(s: GameStateV2, lab: LabId): IndexGrade {
  const p = postureOf(s, lab);
  const goal = 0.1 * (ws4(s).goalposts[lab] ?? 0);
  const relax = lab === 'china' ? 0.8 : p.raceRelaxation;
  const inc = ws4(s).rivalIncidents.filter((i) => i.lab === lab).length;
  return grade({
    risk: g43(0.6 * p.evalRigor + 0.3 * p.externalAccess),
    harms: g43(0.7 * p.disclosureRate - 0.03 * inc),
    frameworks: g43(0.5 * (1 - relax) + 0.4 * p.bindingness - goal),
    existential: g43(0.75 * p.safetyInvestment),
    governance: g43(0.8 * p.bindingness + 0.1 - goal),
    sharing: g43(0.5 * p.disclosureRate + 0.3 * p.externalAccess),
  });
}

/** index (500, semiannual): Safety Index edition: grades from observables only. */
export const indexSystem: EngineSystem = {
  id: 'index', owner: 'WS4', cadence: 'semiannual', order: 500,
  run(s, ctx) {
    const idx = s.researchBodies.index;
    const grades: Record<LabId, IndexGrade> = { player: gradePlayer(s) };
    for (const r of activeRivals(s)) {
      grades[r.core.id] = gradeRival(s, r.core.id);
      r.visible.indexGrade = grades[r.core.id].letter;
    }
    if (s.china.lab.core.status === 'active') {
      grades.china = gradeRival(s, 'china');
      s.china.lab.visible.indexGrade = grades.china.letter;
    }
    const prev = idx.grades.player?.overall;
    idx.grades = grades;
    idx.lastEdition = ctx.day;
    const g = grades.player.overall;
    bloc(s, ctx, 'safety', (g - 2) * 4, 5, 'Safety Index');
    bloc(s, ctx, 'measurers', (g - 2) * 3, 0, 'Safety Index');
    talent(ctx, (g - 2) * 3, 'Safety Index', grades.player.letter);
    ctx.log('research', `Safety Index: ${s.player.name} ${grades.player.letter}${prev !== undefined ? ` (was ${letterOf(prev)})` : ''}.`, 2);
  },
};
