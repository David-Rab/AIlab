// Research bodies: evalGov, evalIndep, academia (V2-SPEC §3.9.5; research/17 §1.3). Owner: WS4.
import { observeExternal } from '../safety/detection';
import type { GameStateV2, ResearchBodies, SystemCtx } from '../types';
import { cred, talent, trust } from './fx';
import { hasCommitment } from './commitments';
import { request, ws4, ws4r } from './state';

export function initialResearchBodies(): ResearchBodies {
  return {
    evalGov: { capacityPerQ: 2, publishPressure: 0.3, queue: [] },
    evalIndep: { capacityPerQ: 3, publishPressure: 0.6, queue: [] },
    academia: { pipeline: 100, publishLagDays: 180 },
    index: { grades: {} },
  };
}

/** Evaluator access the player has granted: evalGov via A1 (testing agreement), evalIndep via A2 (access rung ≥ 2). */
export const evalGovAccess = (s: GameStateV2) => hasCommitment(s, 'preDeployTesting');
export const evalIndepAccess = (s: GameStateV2) => s.relations.stocks.evalIndep.access >= 2 || (ws4r(s).accessCap.evalIndep ?? 0) >= 2;

/** Outsiders with access: each raises the odds that a quiet fix is discovered (§3.9.3 rule 1). */
export function discoveryOdds(s: GameStateV2): number {
  const p: number[] = [0.05 * s.researchBodies.evalGov.publishPressure + 0.02]; // staff and press baseline
  if (evalGovAccess(s)) p.push(0.3 * s.researchBodies.evalGov.publishPressure);
  if (evalIndepAccess(s)) p.push(0.3 * s.researchBodies.evalIndep.publishPressure);
  if ((ws4r(s).accessCap.academia ?? 0) >= 1) p.push(0.15);
  if (s.player.policies.whistleblowerChannel) p.push(0.05);
  return 1 - p.reduce((a, x) => a * (1 - x), 1);
}

/** Weekly: evaluators pick up new player versions (capacity per quarter), publish on schedule. */
export function researchBodiesWeekly(s: GameStateV2, ctx: SystemCtx) {
  const w = ws4(s);
  const rb = s.researchBodies;
  const r = ctx.rng('actors');
  const day = ctx.day;
  const recent = (by: 'evalGov' | 'evalIndep') => w.evalReports.filter((x) => x.by === by).length;
  // Release candidates first (M4): minis before full versions, newest first — evaluators used to take versions in
  // creation order, so a lab with a fullPlusExternal gate saw its minis wait behind every internal checkpoint.
  const queue = s.player.models.versions.filter((v) => v.status === 'ready' || v.status === 'deployed')
    .sort((a, b) => (a.variant === 'mini' ? 0 : 1) - (b.variant === 'mini' ? 0 : 1) || b.day - a.day);
  for (const v of queue) {
    if (w.reportedVersions.includes(v.id) || w.evalReports.some((x) => x.versionId === v.id)) continue;
    if (v.id === 'V0') continue;
    if (evalGovAccess(s) && recent('evalGov') < rb.evalGov.capacityPerQ) w.evalReports.push({ versionId: v.id, due: day + Math.round(r.range(14, 30)), by: 'evalGov' });
    else if (evalIndepAccess(s) && recent('evalIndep') < rb.evalIndep.capacityPerQ) w.evalReports.push({ versionId: v.id, due: day + 30 + Math.round(r.range(0, 30)), by: 'evalIndep' });
  }
  for (const rep of [...w.evalReports]) {
    if (day < rep.due) continue;
    w.evalReports.splice(w.evalReports.indexOf(rep), 1);
    w.reportedVersions.push(rep.versionId);
    if (w.reportedVersions.length > 40) w.reportedVersions.shift();
    const v = s.player.models.versions.find((x) => x.id === rep.versionId);
    if (!v) continue;
    // WS2: the evaluators' own observations (evalIndep: behavioural suite with stronger elicitation → beliefs and
    // v.evals.safety; evalGov: misuse only, no trait observations).
    observeExternal(s, ctx, rep.versionId, rep.by);
    const L = Math.round((v.Lg + r.normal(0, 0.2)) * 10) / 10; // evaluators measure well; truth-informed
    w.evalL = Math.max(w.evalL, L);
    if (rep.by === 'evalGov') {
      trust(s, ctx, 'evalGov', 2, 'evaluation completed', v.name);
      ctx.log('research', `Government evaluators finished testing ${v.name}: level ${L.toFixed(1)}.`, 1);
    } else {
      const claimed = v.evals.measuredL ?? L;
      const contradicts = Math.abs(L - claimed) > 1;
      ctx.log('research', `Independent evaluators publish their ${v.name} report: level ${L.toFixed(1)}.`, contradicts ? 3 : 1);
      if (contradicts) request(s, 'E29', { versionId: v.id, theirL: L, ourL: Math.round(claimed * 10) / 10 });
      else cred(ctx, 5, 'evaluator report matches claims', v.name);
    }
  }
  // Academia: grants feed talent with a lag (D1), and publish what they learn about you (3–9 months later).
  if ((w.accessCap.academia ?? 0) >= 1 && day % 91 === 0) talent(ctx, 1, 'academic pipeline');
}
