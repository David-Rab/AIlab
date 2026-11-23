// Mockup data: the player-visible numbers on the day-400 RefBot fixture, via the same selectors the UI panels call.
// Run from the worktree root: npx tsx design/ux/mockups/rd/_data.ts  → design/ux/mockups/rd/data400.json
// Never reads s.hidden / true traits directly. Fields the views compute from hidden truth are dropped (see notes).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { FIXTURE_DIR } from '../../../../scripts/v2/lib';
import {
  agentsView, buildSplit, capPriorityList, controlReadout, dateOf, engAllocView, engine, fmtDate, idleChips, idleServing, idleShares, idleTrainingShare,
  labSpeedLimits, labSpeedView, monitorBudget, ownedOnline, payrollOf, poolsOf, reAllocView, rentedOnline, responseCurves, safetyView, safIdleFlag,
  safReAllocView, SPLIT_KEYS, SPLIT_LABEL, SPLIT_PRESETS, teamGain, teamPayroll, teamsOfKey, upkeepLines, weeklyHireCap, workTypeViews, idleStocks,
  softwareRate, buildCapacity, newestInternal, internalEval, versionById,
} from '../../../../src/engine/v2';
import { bestPlayerVersion } from '../../../../src/engine/v2/models/labs';
import { believedElasticities } from '../../../../src/engine/v2/production/believed';
import { catRisk, nearestRival, runwayLive } from '../../../../src/ui/v2/shell/selectors';
import { TEAM_KEYS } from '../../../../src/data/v2/teams';
import type { GameStateV2 } from '../../../../src/engine/v2';

const FILE = process.argv[2] ?? 'day400.json';
const s = deserialize(readFileSync(join(FIXTURE_DIR, FILE), 'utf8')) as GameStateV2;
const p = s.player;
const r3 = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x === Infinity ? 'Infinity' : x === -Infinity ? '-Infinity' : 'NaN');
const clean = (o: unknown): unknown => {
  if (typeof o === 'number') return r3(o);
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, clean(v)]));
  return o;
};
const errors: Record<string, string> = {};
const tryy = <T>(k: string, f: () => T): T | undefined => { try { return f(); } catch (e) { errors[k] = String((e as Error)?.stack ?? e).split('\n').slice(0, 3).join(' | '); return undefined; } };
const oomPct = (oom: number) => (Math.pow(10, oom) - 1) * 100;
/** Series value ~n days ago (series are weekly samples with a day column). */
const ago = (arr: number[] | undefined, n: number) => {
  const days = s.series.day as number[];
  if (!arr || !days?.length) return undefined;
  const target = s.time.day - n;
  let best = 0;
  for (let i = 0; i < days.length; i++) if (Math.abs(days[i] - target) < Math.abs(days[best] - target)) best = i;
  return { day: days[best], v: arr[best] };
};

// ───────── A. Shell ─────────
const A = tryy('A', () => {
  const rl = runwayLive(s);
  const nr = nearestRival(s);
  const sp = labSpeedView(s);
  const cr = controlReadout(s);
  const cat = catRisk(s);
  const from = s.time.day - 30;
  const alerts = s.log.filter((e) => e.day >= from && (e.severity ?? 1) >= 2);
  const byKind: Record<string, number> = {};
  for (const e of alerts) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  return {
    date: fmtDate(dateOf(s)), day: s.time.day, act: s.tutorial.act,
    cash: p.finance.cash, runwayQ: rl.rw.q, runwayState: rl.live, officialState: rl.official, liquidity: rl.rw.liquidity, minCash: rl.rw.floor,
    burnPerQ: rl.rw.burnQ, burnPerYear: rl.rw.burnQ * 4, runwayParts_perQ: rl.rw.parts,
    revenueRun30d_perYear: p.finance.revenueRun,
    lead: { nearest: nr.nearest, all: nr.all },
    researchSpeed: {
      rel_vsLeaderDay0: sp.rel, aiLabourExp_mExp: sp.mExp, aiLabourIdeas_mIdeas: sp.mIdeas, mods: sp.mods, boundLabel: sp.label,
      unitProject_c: sp.c, researchH100e: sp.researchH100e, expShare: sp.expShare,
      trend_mExp: { now: ago(s.series.M as number[], 0), d30: ago(s.series.M as number[], 30), d90: ago(s.series.M as number[], 90) },
      limits: labSpeedLimits(s),
    },
    lossOfControlRisk: cr.risk ? { p: cr.risk.p, lo: cr.risk.lo, hi: cr.risk.hi, model: cr.risk.name, mis: cr.risk.mis, misSd90: 1.64 * cr.risk.misSd, stopRate: cr.risk.stopRate, knownF: cr.risk.knownF, unfoundF: cr.risk.unfoundF, exposure: cr.risk.exposure } : null,
    lossOfControlExtra: { harmPerYear: cr.harm, harmActs: cr.harmActs, believedControl: cr.believed, suspectedFootholds: cr.suspected, locatedFootholds: cr.located, monitor: cr.monitorName, monitorGapOom: cr.monitorGapOom },
    catastropheRisk: { est: cat.est, lo: cat.lo, hi: cat.hi, top: [...cat.rows].sort((a, b) => b.estimate - a.estimate).slice(0, 3).map((r) => ({ label: r.label, est: r.estimate, band: r.band })) },
    alerts: { last30dSev2plus: alerts.length, byKind, pendingDecisions: s.events.pending.map((e) => ({ id: e.id, daysLeft: e.deadline - s.time.day })) },
  };
});

// ───────── B. Lab ─────────
const B = tryy('B', () => {
  const pools = poolsOf(s);
  const online = p.computeOnline;
  const mb = monitorBudget(s);
  const idleUse = {
    training: idleTrainingShare(s) * pools.training,
    serving: idleServing(s),
    monitors: mb.need > 0 ? (mb.budget - mb.used) * online : 0,
    unallocated: pools.idle ?? 0,
  };
  const ish = idleShares(s);
  const split = Object.fromEntries(SPLIT_KEYS.map((k) => [k, { label: SPLIT_LABEL[k], share: p.split[k], h100e: pools[k] }]));
  const roles = Object.fromEntries(TEAM_KEYS.map((k) => {
    const ts = teamsOfKey(p, k);
    return [k, {
      teams: ts.length, people: ts.reduce((a, t) => a + t.heads, 0), seats: ts.reduce((a, t) => a + t.size, 0), seatsOpen: ts.reduce((a, t) => a + t.size - t.heads, 0),
      quality: ts.map((t) => t.quality), payroll_perYear: ts.reduce((a, t) => a + teamPayroll(t), 0),
      sciAssigned: ts.filter((t) => t.role === 'sci').map((t) => ({ id: t.id, specialty: t.specialty, projectId: t.projectId ?? null })),
    }];
  }));
  const av = agentsView(s);
  const lanes = Object.fromEntries(Object.entries(av.lanes).map(([u, l]) => [u, { model: l.version?.name ?? null, newest: l.newest, measuredL: l.L, copies: l.copies, h100e: l.compute, shareOfBudget: l.share, monitor: l.monitorSame ? 'copy of itself' : l.monitor?.name ?? null }]));
  const wt = workTypeViews(s).map((w) => ({
    wt: w.wt, name: w.name, model: w.version ?? null, copies: w.copies, h100e: w.h100e, aiFte: w.aiFte,
    humansTeamEq: w.humans, aiTeamEq: w.ai, effectiveTeamEq: w.L, multiplier_xPeopleAlone: w.m, humanShare: w.wH, handedToAI_t: w.t, aiDoesShare_A: w.A,
    coverage: w.coverage, costAIperHour: w.costAI, costHumanPerHour: w.costHuman,
    // dropped: fit / fit vs median & best human / h50 (workfit.ts workFitW on the version's G: true effective compute)
  }));
  const bc = buildCapacity(s);
  const gains = tryy('B.teamGain', () => Object.fromEntries(([
    ['eng', { role: 'eng', dept: 'cap', quality: 'strong' }], ['re.cap', { role: 're', dept: 'cap', quality: 'strong' }],
    ['sci.cap', { role: 'sci', dept: 'cap', quality: 'strong', specialty: 'pretraining' }], ['re.saf', { role: 're', dept: 'saf', quality: 'strong' }],
    ['sci.saf', { role: 'sci', dept: 'saf', quality: 'strong', specialty: 'alignment' }],
  ] as const).map(([k, t]) => [k, teamGain(s, t as never)])));
  const sp = labSpeedView(s);
  const el = believedElasticities(s, Math.max(1e-12, sp.c), sp.l);
  const plus10 = (e: number) => (Math.pow(1.1, e) - 1) * 100;
  const rc = responseCurves(s);
  return {
    computeOnline: online, owned: ownedOnline(s), rented: rentedOnline(s), idleChipsNoRacks: idleChips(s),
    split, presets: SPLIT_PRESETS, autoSplit: p.policies.autoSplit,
    idlePerUse_h100e: idleUse, idleShares: ish, idleTotal_h100e: ish.total * online,
    idleStocks: idleStocks(s),
    roles, hiringTargets: p.hiring.targets, hireCapPerWeek: { cap: weeklyHireCap(s, 'cap'), saf: weeklyHireCap(s, 'saf') }, payroll_perYear: payrollOf(p),
    openCandidates: p.hiring.candidates?.length ?? 0, staff: p.staff,
    agents: { lanes, mExp: av.mExp, mIdeas: av.mIdeas, build: av.build, safetyAiFte: av.safetyAiFte, totalH100e: av.total, totalCost: av.totalCost, trusted: av.trusted, monitors: av.monitors },
    workTypes: wt,
    needs: {
      engineers: engAllocView(s), buildSplit: buildSplit(s), buildCapacity: { capacity: bc.capacity, human: bc.human, aEng: bc.aEng },
      upkeep: upkeepLines(s),
      researchEngineersCap: (() => { const v = reAllocView(s); return { cap: v.cap, order: v.order, needs: v.needs, idle: v.idle, unit: v.unit, m: v.m, perProject: v.perProject }; })(),
      researchEngineersSaf: safReAllocView(s),
    },
    whatBinds: {
      label: engine.production(s, 'player').label,
      unitProject_believed: { eC: el.eC, eL: el.eL, eCBand: el.eCBand, eLBand: el.eLBand, plus10pctComputeToExperiments_speedPct: plus10(el.eC), plus10pctResearchEngineers_speedPct: plus10(el.eL) },
      responseCurves_believed: rc,
      nextHireBuys_strongTeam: gains,
    },
  };
});

// ───────── C. Research portfolio ─────────
const C = tryy('C', () => {
  const cl = capPriorityList(s);
  const proj = (v: ReturnType<typeof capPriorityList>['list'][number]) => {
    const effOom = v.result?.est ?? v.belief?.mu ?? v.line?.nextPrior;
    return {
      id: v.id, name: v.name, kind: v.kind, unlock: v.unlock, area: v.area, column: v.column, stack: v.stack, unit: v.unit,
      rank: v.rank, state: v.state, stage: v.stage, stageFrac: v.stageFrac, wait: v.wait,
      eta: v.eta, etaParts: v.etaParts, adoption: v.adoption,
      teams: v.teams.map((t) => ({ specialty: t.specialty, quality: t.quality, heads: t.heads, match: t.match })), teamsWanted: v.want, wantAuto: v.auto,
      sciCap: v.sciCap, taste: v.taste, cands: v.cands, pickAt: v.pickAt, spec: v.spec, drops: v.drops, maxDrops: v.maxDrops,
      odds: v.odds, belief: v.belief, result: v.result,
      effect: effOom === undefined ? undefined : { raw: effOom, unit: v.unit, source: v.result ? 'result.est' : v.belief ? 'belief.mu (small-scale)' : 'line.nextPrior', pctEffCompute: v.unit === 'oom' ? oomPct(effOom) : undefined,
        range90: v.result ? [effOom - 1.64 * v.result.estSd, effOom + 1.64 * v.result.estSd] : v.belief ? [v.belief.mu - 1.64 * v.belief.sd, v.belief.mu + 1.64 * v.belief.sd] : undefined },
      line: v.line ? { returnsHarder_R_over_n0: v.line.harder, realisedOom: v.line.realised, realisedPct: oomPct(v.line.realised), nextPriorOom: v.line.nextPrior, nextPriorPct: oomPct(v.line.nextPrior), ideasSoFar: v.line.gen, pendingBuild: v.line.pending, r: v.line.r } : undefined,
      researchEngineers: v.re, flopDay: v.flopDay, c: v.c,
      binds: v.bound, eC: v.eC, eL: v.eL, eCBand: v.eCBand, eLBand: v.eLBand,
    };
  };
  const sv = safetyView(s);
  const lines = sv.lines.map((l) => ({
    id: l.id, name: l.name, column: l.column, status: l.status, health: l.band, T1mo: l.T1,
    teams: l.teams.map((t) => ({ specialty: t.specialty, quality: t.quality, heads: t.heads, projectId: t.projectId })), heads: l.heads, staffingOfSerious: l.mult,
    computeShare: l.computeShare, aiLabourShare: l.aiLabour, results: l.results, findings: l.findings, resultsPerYear: l.resultsPerYear, expectedVsObserved: l.expObs,
    deadEndTM: l.deadEndTM, projects: l.projects, ideasKnown: l.ideasKnown, ideasTotal: l.ideasTotal, next: l.next, nextReason: l.nextReason,
  }));
  const sciCap = p.teams.filter((t) => t.role === 'sci' && t.dept === 'cap');
  const sciSaf = p.teams.filter((t) => t.role === 'sci' && t.dept === 'saf');
  return {
    researchWideBinds: engine.production(s, 'player').label,
    softwareRate: softwareRate(s),
    capability: { list: cl.list.map(proj), failed: cl.failed.map(proj), idleScienceTeams: cl.idleTeams },
    safetyLines: lines, lineBadges: sv.lineBadges, safIdleFlag: safIdleFlag(s) ?? null,
    techniques: sv.techniques.filter((t) => t.unlocked).map((t) => ({ id: t.id, name: t.name, agenda: t.agenda, family: t.family, role: t.role, active: t.active, decay: t.decay, trainedAgainst: t.trainedAgainst })),
    validation: { heads: sv.validation.heads, validationHeads: sv.validation.validationHeads, experiments: sv.validation.experiments, investigations: sv.validation.investigations, patches: sv.validation.patches, jobs: sv.validation.jobs.length, notOnCurrent: sv.validation.notOnCurrent, instruments: sv.validation.instruments, model: sv.validation.model },
    counts: {
      sciCapTeams: sciCap.length, sciCapIdle: sciCap.filter((t) => !t.projectId).length, sciSafTeams: sciSaf.length, sciSafIdle: sciSaf.filter((t) => !t.projectId).length,
      reCapTeams: teamsOfKey(p, 're.cap').length, reCapPeople: teamsOfKey(p, 're.cap').reduce((a, t) => a + t.heads, 0),
      reSafTeams: teamsOfKey(p, 're.saf').length, reSafPeople: teamsOfKey(p, 're.saf').reduce((a, t) => a + t.heads, 0),
    },
  };
});

// ───────── D. Models ─────────
const D = tryy('D', () => ({
  versions: p.models.versions.map((v) => ({ id: v.id, name: v.name, status: v.status })),
  best: bestPlayerVersion(s)?.name ?? null, newestInternal: newestInternal(s)?.name ?? null, internalEval: internalEval(s),
  deployments: p.deployments.filter((d) => d.status !== 'withdrawn').map((d) => ({ channel: d.channel, status: d.status, model: versionById(s, d.versionId)?.name })),
}));

const _flags = {
  'B.workTypes.effectiveTeamEq / multiplier_xPeopleAlone / humanShare, A.researchSpeed.aiLabour*, B.agents.mExp/mIdeas':
    'departments/workfit.ts useLabour/effLabour read s.hidden.timeline.prod (rc) and the version G: the engine\'s realised labour, shown by the UI as "as your projects ran yesterday"; kept, but derived from hidden parameters',
  'B.workTypes.coverage / aiDoesShare_A': 'workfit.ts workFit on version G (true effective compute) and preset calibration; kept (UI shows it), flagged',
  'C.capability[].l, X (dropped)': 'models/research.ts projectExpInputs reads s.hidden.timeline.prod.lam; dropped. bound/eC/eL use believedElasticities (ok) at c and the hidden-λ l',
  'B.computeOnline': 'compute/power.ts: online less hidden-foothold reservations (by design the "unexplained compute use" symptom)',
  'C.techniques.decay': 'not verified whether decay reads true or measured capability',
};
const out = clean({ fixture: FILE, A, B, C, D, _flags, errors });
writeFileSync(join('design', 'ux', 'mockups', 'rd', FILE.replace('.json', '') === 'day400' ? 'data400.json' : `data-${FILE}`), JSON.stringify(out, null, 1));
console.log('written; errors:', JSON.stringify(errors, null, 1));
