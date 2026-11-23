// Mockup data v3: player-visible values for TRAINING › Data / Environments / Runs and LAB › Hiring & teams / AI staff /
// Security on the day-400 fixture, via the selectors the UI panels call. Run from the worktree root:
//   npx tsx design/ux/mockups/rd/_data-b.ts  → design/ux/mockups/rd/data400-b.json
// Never reads s.hidden / true traits / version.G / version.build / true stack buckets / spies. Selectors that read truth are
// listed in _flags and their outputs dropped.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { FIXTURE_DIR } from '../../../../scripts/v2/lib';
import {
  RUN_PARAM_DEFAULTS, RUN_POOL_DEFAULT, PARAM_SNAPS, REF_TPP, baseFromParams, postFromParams, runCard, drawByDomain, dataSpecView, dateOf, fmtDate,
  dataPortfolioView, naturalMixView, licenceForm, usageLevels, suitesView, suiteS2Parts, suiteWorkPreview, suitePending, unbuiltSuites, exploitFloor,
  agentsView, workTypeViews, engAllocView, reAllocView, safReAllocView, buildSplit, buildCapacity, upkeepLines, payrollOf, teamsOfKey, teamPayroll, weeklyHireCap,
  fillWeeks, fullTeamPayroll, queuedOfKey, securityFloorView, WSL_TARGET_RANGE, riskSources, runBand,
} from '../../../../src/engine/v2';
import type { GameStateV2, LaunchRunParams, ModelVersion, RLFamily } from '../../../../src/engine/v2';
import { runStall, runEtaDays } from '../../../../src/engine/v2/models/runs';
import { reqSpend, wslFloor, privilegedOf } from '../../../../src/engine/v2/security/security';
import { decimalYear } from '../../../../src/engine/v2/core/time';
import { RL_FAMILY_IDS } from '../../../../src/data/v2/runDesign';
import { LICENCE_TIERS, LICENCE_DELIVERY_DAYS } from '../../../../src/data/v2/dataAssets';
import { TEAM_KEYS, QUALITY, STAR_HIRE, TEAM_SIZE } from '../../../../src/data/v2/teams';
import { INTERNAL_TOOLS } from '../../../../src/data/v2/features';

const FILE = process.argv[2] ?? 'day400.json';
const s = deserialize(readFileSync(join(FIXTURE_DIR, FILE), 'utf8')) as GameStateV2;
const p = s.player;
const r3 = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x === Infinity ? 'Infinity' : x === -Infinity ? '-Infinity' : 'NaN');
const clean = (o: unknown): unknown => {
  if (typeof o === 'number') return r3(o);
  if (o instanceof Map) return clean(Object.fromEntries(o));
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && typeof v !== 'function').map(([k, v]) => [k, clean(v)]));
  return o;
};
const errors: Record<string, string> = {};
const tryy = <T>(k: string, f: () => T): T | undefined => { try { return f(); } catch (e) { errors[k] = String((e as Error)?.stack ?? e).split('\n').slice(0, 3).join(' | '); return undefined; } };
const day = s.time.day;
const date = (d: number) => fmtDate(dateOf(s, d));

// Default plan, as _data2 does (Blueprint default: base if a fitting size exists, else post).
type Params = Record<string, string | number | boolean>;
type Kind = 'base' | 'post' | 'distill' | 'continue';
const DEFAULTS: Params = { ...RUN_PARAM_DEFAULTS };
const lastBase = p.models.bases[p.models.bases.length - 1];
const toLP = (kind: Kind, q: Params): LaunchRunParams => {
  const lp: LaunchRunParams = { kind, poolShare: Number(q.poolShare) };
  if (kind === 'base') lp.base = baseFromParams(q as never);
  if (kind === 'post') { lp.post = postFromParams(q as never, s); lp.baseId = String(q.baseId); }
  return lp;
};
const wallOf = (c?: ReturnType<typeof runCard>) => (c ? (c.limits?.wallDays ?? c.etaDays) : Infinity);
const snaps = PARAM_SNAPS as readonly number[];
let fitParams = snaps[0];
for (let i = snaps.length - 1; i >= 0; i--) {
  const c = tryy(`fit.${i}`, () => runCard(s, toLP('base', { ...DEFAULTS, params: snaps[i], tpp: REF_TPP, poolShare: RUN_POOL_DEFAULT.base })));
  if (wallOf(c) <= 182) { fitParams = snaps[i]; break; }
}
const defFor = (k: Kind): Params => ({ ...DEFAULTS, params: fitParams, poolShare: RUN_POOL_DEFAULT[k], baseId: lastBase?.id ?? '', ...(lastBase?.design.shape === 'latent' ? { cot: 'latent' } : {}) });
const baseLP = toLP('base', defFor('base'));
const postLP = toLP('post', defFor('post'));

// ───────── 1. DATA ─────────
const DATA = tryy('DATA', () => {
  const v = dataPortfolioView(s);
  const assets = p.dataPortfolio.assets.map((a) => ({
    id: a.id, kind: a.kind, domain: (a as { domain?: string }).domain, tokensT: a.kind === 'public' ? undefined : (a as { tokensT: number }).tokensT,
    quality: a.kind === 'public' ? undefined : (a as { quality: number }).quality, coverage: a.kind === 'public' ? (a as { coverage: number }).coverage : undefined,
    licensed: a.kind === 'public' ? (a as { licensed: boolean }).licensed : undefined, day: (a as { day?: number }).day,
  }));
  const card = runCard(s, baseLP);
  const L = card.limits;
  const latestVersion = p.models.versions.filter((x) => x.status !== 'retired').slice(-1)[0] as ModelVersion | undefined;
  const offers = Object.fromEntries((Object.keys(LICENCE_TIERS) as (keyof typeof LICENCE_TIERS)[]).map((tier) => [tier, {
    tier: LICENCE_TIERS[tier],
    exampleCode10T: tryy(`licence.${tier}`, () => { const f = licenceForm(s, { domain: 'CODE', tier, tokensT: 10 }); return { cashB: f.cashB, quality: f.quality, priceBPerT: f.priceBPerT, days: f.days, delta: f.delta }; }),
  }]));
  return {
    _src: 'production/dataView.ts dataPortfolioView (rows by kind, pending, flows, crawl), raw p.dataPortfolio.assets (owned facts), naturalMixView, usageLevels, licenceForm (offers: LICENCE_TIERS, fixed menu, any domain), runCard(default base plan).limits + drawByDomain (next run draw / epochs), core/limitsView.ts dataSpecView (latest version)',
    portfolio: { uniqueQualityWeightedT: v.uT, pretrainTokensT: v.tokensT, byKind: v.rows, crawl: v.crawl, expertInSuitesT: v.expertInSuitesT },
    assets,
    naturalMixByDomain: naturalMixView(s),
    pending: v.pending.map((x) => ({ ...x, dueDate: date(x.due), inDays: x.due - day })),
    synthetic: { perDayT: v.synPerDayT, poolH100e: v.synPoolH100e, defaultTeacher: v.defaultTeacher, mixLine: v.synMixLine, job: p.dataPortfolio.synJob ? { ...p.dataPortfolio.synJob, untilDate: date(p.dataPortfolio.synJob.until) } : null },
    usage: { level: v.usageLevel, share: p.dataPortfolio.usageShare, perDayT: v.usagePerDayT, levels: usageLevels(s) },
    nextRun: {
      plan: { kind: 'base', params: fitParams, tpp: baseLP.base?.tpp, data: baseLP.base?.data },
      tokensT: L ? L.tokens / 1e12 : undefined, uniqueT: L ? L.tokensUnique / 1e12 : undefined, epochs: L?.epochs, keptShare: L?.fData, meanQuality: L?.draw.quality,
      byDomain: L ? drawByDomain(s, L.draw) : undefined,
      verdict: L ? (L.epochs <= 4 ? `enough (≤4 epochs: ${L.epochs.toFixed(2)})` : `short (${L.epochs.toFixed(1)} epochs > 4)`) : undefined,
    },
    dataSpecLatest: latestVersion ? { version: latestVersion.name, ...dataSpecView(s, latestVersion) } : undefined,
    licenceOffers: { deliveryDays: LICENCE_DELIVERY_DAYS, tiers: offers },
  };
});

// ───────── 2. ENVIRONMENTS ─────────
const ENV = tryy('ENV', () => {
  const focus = postLP.post?.rlFocus ?? 'broad';
  const v = suitesView(s, focus);
  const parts = tryy('s2parts', () => suiteS2Parts(s, postLP.post!));
  const rows = v.rows.map((r) => ({
    ...r, exploitFloor: exploitFloor(r.family), usedByNextPost: r.share > 0,
    pendingJobs: suitePending(s, r.family),
    build: tryy(`prev.build.${r.family}`, () => { const w = suiteWorkPreview(s, r.family, 'build', postLP); return { cost: w.cost, effect: w.effect, block: w.block, waitDays: w.waitDays, s2Before: w.before.s2, s2After: w.after.s2 }; }),
    harden: tryy(`prev.harden.${r.family}`, () => { const w = suiteWorkPreview(s, r.family, 'harden', postLP); return { cost: w.cost, effect: w.effect, block: w.block, waitDays: w.waitDays, s2Before: w.before.s2, s2After: w.after.s2 }; }),
  }));
  const unbuilt = tryy('unbuilt', () => unbuiltSuites(s, postLP).map((u) => ({ family: u.family, cost: u.build.cost, effect: u.build.effect, block: u.build.block, waitDays: u.build.waitDays, s2After: u.build.after.s2 })));
  return {
    _src: 'models/suites.ts suitesView(s, default post rlFocus) rows/weighted/s2, exploitFloor; models/suitesPreview.ts suiteS2Parts (hacking pressure), suiteWorkPreview (cost + suite fid/exploit before→after + planned S2 before→after; rl gains dropped), suitePending (jobs)',
    allFamilies: RL_FAMILY_IDS, nextPostFocus: focus, weighted: v.weighted, s2BeforeBudget: v.s2, hackingPressure: parts, rows, unbuilt,
    note: 'exploit is the engine value the UI shows as is (no belief layer for loopholes exists)',
  };
});

// ───────── 3. RUNS ─────────
const RUNS = tryy('RUNS', () => {
  // No run→version id is stored: match each finished run to the first version made after its start (post: same base,
  // full variant; distill: non-full variant; base: first version on the first base finished after the start).
  const used = new Set<string>();
  const after = (v: ModelVersion, d: number) => v.day >= d && !used.has(v.id);
  const matchVersion = (r: (typeof p.models.runs)[number]): ModelVersion | undefined => {
    let v: ModelVersion | undefined;
    if (r.kind === 'base') { const b = p.models.bases.find((x) => x.day >= r.startDay); v = b ? p.models.versions.find((x) => x.baseId === b.id && after(x, r.startDay)) : undefined; }
    else if (r.kind === 'distill') v = p.models.versions.find((x) => x.variant !== 'full' && after(x, r.startDay));
    else v = p.models.versions.find((x) => x.variant === 'full' && (!r.baseId || x.baseId === r.baseId) && after(x, r.startDay));
    if (v) used.add(v.id);
    return v;
  };
  const vByName = new Map(p.models.versions.map((v) => [v.name, v] as const));
  const runs = p.models.runs.map((r) => {
    const out = r.status === 'done' ? (vByName.get(r.name) ?? matchVersion(r)) : undefined;
    const eta = r.status === 'running' ? tryy(`eta.${r.id}`, () => runEtaDays(s, r)) : undefined;
    return {
      id: r.id, name: r.name, kind: r.kind, status: r.status, autoTier: r.autoTier, startDay: r.startDay, startDate: date(r.startDay), readyDay: r.readyDay,
      progress: r.flopNeeded > 0 ? r.flopDone / r.flopNeeded : 1, flopNeeded: r.flopNeeded, poolShare: r.poolShare, cashCostB: r.cashCost,
      etaDays: eta, etaDate: eta !== undefined && Number.isFinite(eta) ? date(day + eta) : undefined, stall: runStall(s, r),
      base: r.base ? { params: r.base.params, tpp: r.base.tpp, shape: r.base.shape, data: r.base.data } : undefined,
      post: r.post ? { rlFocus: r.post.rlFocus, rlBudget: r.post.rlBudget, cot: r.post.cot, safety: r.post.safety } : undefined,
      teacher: r.teacherVersionId ? p.models.versions.find((v) => v.id === r.teacherVersionId)?.name : undefined,
      forecastAtLaunch: r.forecast ? { mid: r.forecast.mid, sd: r.forecast.sd, band: runBand(s, r) } : null,
      etaAtLaunchDays: r.predicted?.etaDays, monitorabilityAtLaunch: r.predicted?.monitorability,
      resultBase: r.kind === 'base' && r.status === 'done' ? p.models.bases.find((b) => b.day >= r.startDay)?.name : undefined,
      resultMatch: 'heuristic (no run→version id stored)',
      result: out ? { version: out.name, day: out.day, date: date(out.day), measuredL: out.evals.measuredL ?? null, status: out.status } : undefined,
    };
  });
  const st = p.models.stream;
  return {
    _src: 'p.models.runs (owned facts), models/runs.ts runStall, runEtaDays, index.ts runBand(run.forecast); result = version of same name, evals.measuredL; p.models.stream; p.models.evals',
    versions: p.models.versions.map((v) => ({ name: v.name, variant: v.variant, status: v.status, day: v.day, date: date(v.day), base: p.models.bases.find((b) => b.id === v.baseId)?.name, measuredL: v.evals.measuredL ?? null })),
    bases: p.models.bases.map((b) => ({ name: b.name, day: b.day, date: date(b.day) })),
    counts: { total: runs.length, running: runs.filter((r) => r.status === 'running').length },
    runs,
    continualLearning: st ? { version: p.models.versions.find((v) => v.id === st.versionId)?.name, startedDate: date(st.startedDay), lastAuditDate: date(st.lastAuditDay) } : null,
    autoTierPolicy: (p.policies as unknown as Record<string, unknown>).autoTiers ?? (p.policies as unknown as Record<string, unknown>).autoTier,
    evalsQueue: p.models.evals.map((e) => ({ version: p.models.versions.find((v) => v.id === e.versionId)?.name, depth: e.depth, by: e.by, why: e.why, progress: e.progress, startDate: date(e.day) })),
  };
});

// ───────── 4. HIRING & TEAMS ─────────
const HIRE = tryy('HIRE', () => {
  const roles = Object.fromEntries(TEAM_KEYS.map((k) => {
    const ts = teamsOfKey(p, k);
    const q = queuedOfKey(p, k);
    const [role, dept] = k === 'eng' ? ['eng', 'cap'] : k.split('.');
    return [k, {
      teams: ts.length, people: ts.reduce((a, t) => a + t.heads, 0), seats: ts.reduce((a, t) => a + t.size, 0), seatsOpen: ts.reduce((a, t) => a + t.size - t.heads, 0),
      quality: ts.map((t) => t.quality), payroll_perYear: ts.reduce((a, t) => a + teamPayroll(t), 0), target: p.hiring.targets[k],
      teamSize: TEAM_SIZE[role as 'eng'], fullTeamCost_perYear: Object.fromEntries((['solid', 'strong', 'elite'] as const).map((ql) => [ql, fullTeamPayroll(role as never, dept as never, ql)])),
      filling: q.map((t) => ({ id: t.id, quality: t.quality, heads: t.heads, size: t.size, weeksLeft: tryy(`fill.${t.id}`, () => fillWeeks(s, t)) })),
      weeksToHireATeam: tryy(`fill.new.${k}`, () => fillWeeks(s, { role: role as never, dept: dept as never, size: TEAM_SIZE[role as 'eng'], heads: 0 })),
      sciProjects: ts.filter((t) => t.role === 'sci').map((t) => ({ specialty: t.specialty, projectId: t.projectId ?? null, why: t.why })),
    }];
  }));
  return {
    _src: 'departments/teams.ts teamsOfKey, teamPayroll, fullTeamPayroll, queuedOfKey, fillWeeks, weeklyHireCap, payrollOf; p.hiring (targets, candidates, filling); p.stars, p.morale; data/v2/teams.ts QUALITY, STAR_HIRE',
    roles, hiringTargets: p.hiring.targets, hireCapPerWeek: { cap: weeklyHireCap(s, 'cap'), saf: weeklyHireCap(s, 'saf') }, payroll_perYear: payrollOf(p),
    candidates: p.hiring.candidates.map((c) => ({ ...c, untilDate: date(c.until), cost_perYear: fullTeamPayroll(c.role, c.dept, c.quality) })),
    qualityScale: QUALITY, stars: { count: p.stars, rule: STAR_HIRE }, morale: p.morale, staff: p.staff,
    poachingRivals: s.rivals?.map?.((r: { core: { name: string }; meters: { poachAggression: number } }) => ({ name: r.core.name, poachAggression: r.meters.poachAggression })),
  };
});

// ───────── 5. AI STAFF ─────────
const AI = tryy('AI', () => {
  const av = agentsView(s);
  const lanes = Object.fromEntries(Object.entries(av.lanes).map(([u, l]) => [u, { model: l.version?.name ?? null, newest: l.newest, measuredL: l.L, copies: l.copies, h100e: l.compute, shareOfBudget: l.share, monitor: l.monitorSame ? 'copy of itself' : l.monitor?.name ?? null }]));
  const wt = workTypeViews(s).map((w) => ({
    wt: w.wt, name: w.name, model: w.version ?? null, copies: w.copies, h100e: w.h100e, aiFte: w.aiFte, humansTeamEq: w.humans, aiTeamEq: w.ai, effectiveTeamEq: w.L,
    multiplier_xPeopleAlone: w.m, humanShare: w.wH, handedToAI_t: w.t, aiDoesShare_A: w.A, coverage: w.coverage, costAIperHour: w.costAI, costHumanPerHour: w.costHuman,
  }));
  const bc = buildCapacity(s);
  const re = reAllocView(s);
  return {
    _src: 'departments/agents.ts agentsView; workTypeViews; engAllocView, reAllocView, safReAllocView, buildSplit, buildCapacity, upkeepLines; p.build queue; p.tooling vs data/v2/features.ts INTERNAL_TOOLS',
    packages: p.agents, lanes, mExp: av.mExp, mIdeas: av.mIdeas, safetyAiFte: av.safetyAiFte, totalH100e: av.total, totalCost: av.totalCost, trusted: av.trusted, monitors: av.monitors,
    workTypes: wt,
    needs: { engineers: engAllocView(s), researchEngineersCap: { cap: re.cap, order: re.order, needs: re.needs, idle: re.idle, unit: re.unit }, researchEngineersSaf: safReAllocView(s), buildSplit: buildSplit(s), upkeep: upkeepLines(s) },
    buildCapacity: { capacity: bc.capacity, human: bc.human, aEng: bc.aEng },
    buildQueue: (p.build as unknown as { queue?: unknown[] }).queue ?? p.build,
    tools: { owned: p.tooling, all: INTERNAL_TOOLS.map((t) => ({ id: t.id, name: (t as { name?: string; label?: string }).name ?? (t as { label?: string }).label, owned: p.tooling.includes(t.id) })) },
  };
});

// ───────── 6. SECURITY ─────────
const SEC = tryy('SEC', () => {
  const sec = p.security;
  const fl = securityFloorView(s);
  const theft = riskSources(s).find((r) => r.kind === 'theft');
  const steps = [2.5, 3, 3.5, 4, 4.5, 5].map((L) => ({ wsl: L, spend_BperYear: reqSpend(L, p.computeOnline) }));
  const secLog = s.log.filter((e) => /theft|security|spy|leak|stolen|exfil|whistle/i.test(`${e.kind} ${e.text ?? ''}`)).map((e) => ({ day: e.day, date: date(e.day), kind: e.kind, severity: e.severity, text: e.text }));
  return {
    _src: 'p.security (wsl, ssl, target, spendRate, siloing, clearances, privileged, counterIntel, detectedThefts), core/limitsView.ts securityFloorView, security.ts reqSpend/wslFloor/privilegedOf (published formulas), core/selectors riskSources theft row (wsl + China theftIntent meter + China misalign band, all visible), s.china.meters.theftIntent (Relations panel shows it), s.log',
    known: {
      wsl: sec.wsl, ssl: sec.ssl, target: sec.target, targetRange: WSL_TARGET_RANGE, spend_BperYear: sec.spendRate,
      spendNeeded_holdNow: reqSpend(sec.wsl, p.computeOnline), spendNeeded_target: reqSpend(sec.target, p.computeOnline), costPerLevel: steps, movePerDay: 0.006, decayPerDayUnderfunded: 0.002,
      floor: fl, floorToday: wslFloor(decimalYear(s) - 2025),
      siloing: sec.siloing, privilegedAtSilo: [0, 1, 2].map((lv) => privilegedOf(p.staff, lv)), clearances: sec.clearances, privileged: sec.privileged, counterIntel: sec.counterIntel,
      detectedThefts: sec.detectedThefts, theftRisk: theft, chinaTheftIntent: s.china.meters.theftIntent, chinaRung: s.china.rung,
      eventLog: secLog,
    },
    hiddenTruth_notExported: ['security.spies (comment: "hidden for player, shown only as an estimate band" — no estimate selector exists)', 'security.stolen (truth list; player sees detectedThefts)', 'theft.ts theftHazardDaily (lagDays on true G + spies)', 'secretsLeakDaily (spies + true recipe gap)'],
    researchSpeedEffectOfSiloing: 'NONE in engine: siloing only cuts privileged staff by 30% per level (privilegedOf); no research slowdown modelled',
  };
});

const _flags = {
  'run.predicted.Lg / domains': 'planRun build on TRUE G: not exported; forecastAtLaunch (run.forecast) used instead',
  'suiteWorkPreview before/after .rl': 'RL gains from planRun on true stacks: dropped; only S2 and suite fid/exploit kept',
  'teacherRows / synForm quality': 'gOfBuild(v.build) + s.hidden.timeline gV0: truth; not exported (UI Data panel shows them: flag)',
  'workTypes coverage / aiDoesShare_A': 'workfit on version G (true); kept because the UI shows it (same as data400.json)',
  'theftHazardDaily, secretsLeakDaily, spies': 'hidden truth: not exported',
};

const out = clean({ fixture: FILE, day, date: date(day), DATA, ENV, RUNS, HIRE, AI, SEC, _flags, errors });
writeFileSync(join('design', 'ux', 'mockups', 'rd', 'data400-b.json'), JSON.stringify(out, null, 1));
console.log('wrote data400-b.json; errors:', Object.keys(errors));
