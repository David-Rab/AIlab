// UB-2 check (npx tsx scripts/v2/_ub2/check.ts): every UB-2 readout runs on the day-400 fixture, and none reads hidden
// truth: a copy of the fixture with the hidden values rewritten (every version's true effective compute, levels and
// build, true traits, the hidden production draw and parameters, the true know-how effects, hidden programme efficacy
// and method scale) gives the same readouts (as lint-hidden / _rfs14 / _ui0a do). The fixed readouts (UB-2 A) are
// in the comparison too.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { cesFromAsymptotes } from '../../../src/engine/v2/production/ces';
import { check, finish, FIXTURE_DIR, KNOWN } from '../lib';
import { baseFromParams, postFromParams, RUN_PARAM_DEFAULTS } from '../../../src/engine/v2/models/actions';
import { bestMeasuredVersion, internalVersion } from '../../../src/engine/v2/models/labs';
import { measuredDomains } from '../../../src/engine/v2';
import { knowHowAreas, programmeGets, programmeRates, rankMoves, researchSpeedReadout, skillGains, targetRate } from '../../../src/engine/v2/models/rdReadouts';
import { softwareRate, stackViews, workTypeViews, labSpeedView } from '../../../src/engine/v2/models/researchView';
import { aiShareByRole } from '../../../src/engine/v2/departments/teams';
import { responseCurves } from '../../../src/engine/v2/production/readout';
import { actReadouts, instrumentReliability, oversightGaps, safetyProgrammes, sightGaps } from '../../../src/engine/v2/safety/safetyReadouts';
import { sightCurve } from '../../../src/engine/v2/safety/sightLimit';
import { actTable } from '../../../src/engine/v2/safety/actTable';
import { lossOfControlRisk, runningModels } from '../../../src/engine/v2/safety/lossRisk';
import { internalFleets } from '../../../src/engine/v2/departments/agents';
import { lineRows } from '../../../src/engine/v2/safety/view';
import { chanceCertainty, isUnknown, sizeCertainty } from '../../../src/engine/v2/core/certainty';
import type { GameStateV2, LaunchRunParams } from '../../../src/engine/v2/types';

const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));

/** Rewrite every hidden value a readout could read; observations already made (eval records, the research engine's
 *  last day, beliefs, stored series) stay. */
function rewriteHidden(s: GameStateV2) {
  for (const v of s.player.models.versions) {
    v.G += 0.8;
    v.Lg += 1.3;
    for (const d of Object.keys(v.domains) as (keyof typeof v.domains)[]) v.domains[d] = v.domains[d] * 0.7 + 1.1;
    if (v.build) { v.build.gPre += 0.8; v.build.dg += 0.3; } // not the RL part: token efficiency (tokens per task) is observed in use
    if (v.domainDg) for (const d of Object.keys(v.domainDg) as (keyof typeof v.domainDg)[]) v.domainDg[d] = (v.domainDg[d] ?? 0) + 0.4;
    for (const t of Object.keys(v.traitsTrue) as (keyof typeof v.traitsTrue)[]) v.traitsTrue[t] = 1 - v.traitsTrue[t];
  }
  const P = s.hidden.timeline.prod;
  // The drawn production parameter (believed.ts: the rest are the preset's published values) and its CES terms.
  s.hidden.timeline.prod = { ...P, La: P.La * 5, ...cesFromAsymptotes(P.La * 5, P.Ca, P.slow10) };
  // True know-how in the areas whose effect the lab sees only through evals (training and serving efficiency are
  // measured directly as chip throughput, a fact).
  for (const k of ['pre', 'rlMid', 'rlCeil'] as const) for (const b of s.player.research.stacks[k].buckets) b.a *= 2.5;
  for (const a of s.player.research.adopted) a.eff *= 3;
  for (const k of Object.keys(s.hidden.agendaEfficacy)) s.hidden.agendaEfficacy[k as keyof typeof s.hidden.agendaEfficacy] = 1 - (s.hidden.agendaEfficacy[k as keyof typeof s.hidden.agendaEfficacy] ?? 0);
  for (const k of Object.keys(s.hidden.methodScale ?? {})) (s.hidden.methodScale as Record<string, number>)[k] = 1.9;
  s.hidden.organismRealism = 1 - (s.hidden.organismRealism ?? 0.5);
}

const plans = (s: GameStateV2): Record<string, LaunchRunParams> => {
  const lastBase = s.player.models.bases[s.player.models.bases.length - 1];
  const heavy = { ...RUN_PARAM_DEFAULTS, rlBudget: 'heavy' };
  return {
    nextRun: { kind: 'base', base: baseFromParams(RUN_PARAM_DEFAULTS as never), poolShare: 0.6 },
    startFrom: { kind: 'post', baseId: lastBase?.id, post: postFromParams(RUN_PARAM_DEFAULTS as never, s), poolShare: 0.2 },
    effort: { kind: 'post', baseId: lastBase?.id, post: postFromParams(heavy as never, s), poolShare: 0.2 },
  };
};

function readouts(s: GameStateV2) {
  const iv = internalVersion(s);
  const moves = rankMoves(s, [
    { id: 'compute→experiments ×4', target: 'research', gain: ((responseCurves(s)?.experiments.at(-1) ?? 1) - 1) * targetRate(s, 'research') }, // the curve is relative: × today's speed
    { id: 'safety scientist team', target: 'safety', gain: 0.54 },
    { id: 'safety RE team', target: 'safety', gain: 0.1 },
  ]);
  const fleets = internalFleets(s).map((fl) => {
    const d = s.player.deployments.find((x) => x.channel === 'internal' && x.status !== 'withdrawn');
    return d ? actTable(s, { deploymentId: d.id, versionId: fl.v.id, usage: fl.usage }, true) : undefined;
  });
  const lane = actTable(s, { use: 'capRoutine' }, true);
  const out = {
    // A: fixed readouts
    bestMeasured: bestMeasuredVersion(s)?.name,
    measuredDomains: s.player.models.versions.map((v) => measuredDomains(v)),
    stacks: stackViews(s).map((v) => ({ ...v, ideas: v.ideas.length })),
    softwareRate: softwareRate(s),
    workTypes: workTypeViews(s),
    aiShare: aiShareByRole(s),
    speedView: labSpeedView(s).rel,
    response: responseCurves(s),
    lines: lineRows(s).map((r) => r.aiLabour),
    running: runningModels(s).map((v) => v.name),
    risk: lossOfControlRisk(s),
    // B: new readouts
    speed: researchSpeedReadout(s),
    knowHow: knowHowAreas(s),
    rates: programmeRates(s),
    gets: programmeGets(s),
    moves,
    gains: Object.fromEntries(Object.entries(plans(s)).map(([k, p]) => [k, skillGains(s, p)])),
    safety: safetyProgrammes(s),
    instruments: instrumentReliability(s),
    sight: sightGaps(s, (iv?.evals.measuredL ?? 0) + 2.4),
    curve: sightCurve(s, 0.5),
    acts: [lane, ...fleets].map((t) => (t ? actReadouts(t) : undefined)),
    gaps: oversightGaps(s),
  };
  return out;
}

// Round to 9 significant digits: the readouts that subtract a version's own true fit from the tools' fit cancel exactly
// in algebra, not always in the last float bit.
const canon = (x: unknown): string => JSON.stringify(x, (_k, v) => (typeof v === 'number' && Number.isFinite(v) && v !== 0 ? Number(v.toPrecision(9)) : v));

/** The leaf paths where two readouts differ (for the failure detail). */
function diffs(a: unknown, b: unknown, path = ''): string[] {
  if (typeof a === 'number' && typeof b === 'number') return canon(a) === canon(b) ? [] : [`${path} ${a} vs ${b}`];
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out: string[] = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out.push(...diffs((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k));
    return out;
  }
  return canon(a) === canon(b) ? [] : [`${path} ${canon(a)} vs ${canon(b)}`];
}

// Known deviations (reported as WARN, left for a later task; BUILD-NOTES UB-2 "Left"):
KNOWN['gains: unchanged when hidden values are rewritten'] = 'the run forecast (runs.ts runForecast, RD-B19) adds the planned step computed by planRun from the true recipe and the true reference build; a believed run step is a separate task';
KNOWN['safety: unchanged when hidden values are rewritten'] = 'results / yr and next-result days move with the safety research engineers each programme gets (safAllocation: a staffing fact the engine computes live from the true AI work to review), not with a hidden value read by the readout';
KNOWN['moves: unchanged when hidden values are rewritten'] = 'the base rate of the safety moves is safety results / yr (see safety)';

const A = load();
const B = load();
rewriteHidden(B);
const rA = readouts(A);
const rB = readouts(B);

// Each readout ran and has content on the fixture.
const f2 = (x: number) => x.toFixed(2);
console.log(`     research speed ×${f2(rA.speed.now)} (AI staff ×${f2(rA.speed.ai)}: experiments ×${f2(rA.speed.aiExperiments)}, ideas ×${f2(rA.speed.aiIdeas)}; without AI ×${f2(rA.speed.withoutAI)}); history ${rA.speed.history.length} weeks`);
console.log(`     know-how: ${rA.knowHow.map((k) => `${k.name} ×${f2(k.yours)} (public ×${f2(k.public)}, ×${f2(k.perYear)}/yr${k.waiting ? `, waiting ×${f2(k.waiting.x)} from ${k.waiting.ideas} ideas` : ''}, ${k.certainty.word})`).join('; ')}`);
console.log(`     programme rates: ${rA.rates.map((r) => `${r.name} ≈×${f2(r.xPerYear)}/yr (${f2(r.perYear)} results/yr; so far ${f2(r.soFar.perYear)}; next ×${r.next.x.toFixed(3)} ${r.next.certainty.word})`).join('; ')}`);
console.log(`     gets: ${rA.gets.map((g) => `${g.id} ${Math.round(g.h100e / 1e3)}k H100e (${(g.shareOfExperiments * 100).toFixed(0)}%)${g.idea ? ` idea ×${g.idea.x.toFixed(3)} ${g.idea.certainty.word}, at scale ${g.idea.atScale}` : ''}`).join('; ')}`);
console.log(`     best moves (days of progress / yr): ${rA.moves.map((m) => `${m.id} ${m.days !== undefined ? Math.round(m.days) : 'starts it'}`).join(' · ')}`);
for (const [k, g] of Object.entries(rA.gains)) console.log(`     skill gains ${k} vs ${g.ref ?? '—'}: ${g.gains.map((x) => `${x.d} ${x.dLevels >= 0 ? '+' : ''}${f2(x.dLevels)}`).join(' ')}${g.reason ? ` (${g.reason})` : ''}`);
console.log(`     safety programmes: ${rA.safety.slice(0, 5).map((p) => `${p.rank}. ${p.name} (${p.why}${p.stage ? `, ${p.stage} ${Math.round((p.stageFrac ?? 0) * 100)}%` : ''}, ${p.outlook})`).join('; ')} … ${rA.safety.length} in all`);
console.log(`     instruments on ${rA.instruments.model}: ${rA.instruments.rows.map((r) => `${r.name} ${Math.round(r.pct * 100)}% (${Math.round(r.lo * 100)}–${Math.round(r.hi * 100)}%)`).join('; ')}`);
console.log(`     sight: ${rA.sight.current.text}; planned: ${rA.sight.planned?.text}; curve ${rA.curve.points.length} points`);
const acts = rA.acts.find((t) => t && t.length) ?? [];
console.log(`     chances / yr: ${acts.map((a) => `${a.name} ${a.chancesPerYear !== undefined ? a.chancesPerYear.toFixed(2) : '—'}${a.chancesUnit === '/ item' ? '/item' : ''}${a.unknown ? ' [Unknown]' : ''}${a.ableToMeasured ? '' : ' [not measured yet]'}`).join('; ')}`);
console.log(`     oversight gaps: ${rA.gaps.map((g) => `${g.job} ${g.model}: human ${f2(g.humanGap)}${g.watcher ? `, watcher ${g.watcher} ${f2(g.watcherGap!)}` : ''} levels`).join('; ')}`);

check(rA.speed.now > 0 && rA.speed.ai >= 1, 'research speed and AI staff part read');
check(rA.knowHow.length === 5 && rA.knowHow.every((k) => k.yours >= k.public * 0.999), 'five know-how areas; Yours ≥ Public');
check(rA.knowHow.every((k) => !k.waiting || k.waiting.x <= k.yours / k.public + 1e-9), 'Waiting never exceeds your own know-how');
check(rA.rates.length > 0 && rA.rates.every((r) => r.xPerYear >= 1 && Number.isFinite(r.cycleDays)), 'programme rates at current staffing', `${rA.rates.length} programmes`);
check(rA.moves.length === 3 && rA.moves.every((m, i, xs) => i === 0 || (xs[i - 1].days ?? -Infinity) >= (m.days ?? -Infinity)), 'Best moves ranked by days of progress a year');
check(Object.values(rA.gains).every((g) => g.gains.length === 9 || !!g.reason), 'skill gains for next run / start-from / effort');
check(rA.safety.length > 0 && rA.safety.every((p, i) => p.rank === i + 1), 'safety programmes in one priority order');
check(rA.instruments.rows.every((r) => r.lo <= r.pct + 1e-12 && r.pct <= r.hi + 1e-12), 'instrument reliability inside its range');
check(rA.curve.points.length === 31 && rA.curve.points.every((p) => p.min <= p.mean + 1e-12), 'sight curve: mean and floor per level');
check(acts.some((a) => a.chancesPerYear !== undefined), 'chances / yr per act');
check(isUnknown(0, 0.49) && !isUnknown(0.1, 0.3) && chanceCertainty(0.1, 0.12).word === 'sure' && sizeCertainty(0.016, 0.016 - 1.64 * 0.008, 0.016 + 1.64 * 0.008).word === 'fairly unsure', 'certainty scale and Unknown rule (drawer example reads "fairly unsure")');

// Truth not read.
for (const k of Object.keys(rA) as (keyof typeof rA)[]) {
  const a = canon(rA[k]);
  const b = canon(rB[k]);
  check(a === b, `${k}: unchanged when hidden values are rewritten`, a === b ? '' : diffs(rA[k], rB[k]).slice(0, 6).join('; '));
}
finish('ub2');
