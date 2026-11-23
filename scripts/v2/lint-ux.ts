// UX engine/content checks (M5 UX). Run: npx tsx scripts/v2/lint-ux.ts
// 1. AUDIT #1 / PLAN B1 regression: switching the internal agent to an unevaluated child version must not drop the
//    displayed L to 0 or move U by more than 1.5 levels.
// 3. Every number in the UI source has a tooltip or an allow-listed reason (lint-tips.ts, jank O1).
// 2. Glossary: every [[link]] in a glossary body, every <Term id="…"> and termId reference in src/ui/v2, and every
//    REQUIRED term resolves to an entry (IA rule 4: every technical or business term has a tooltip).
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../src/engine/v2/core/save';
import { internalEval, internalVersion, measuredL, understanding } from '../../src/engine/v2/index';
import { GLOSSARY_V2 } from '../../src/data/v2/glossary';
import { LIMITS } from '../../src/data/v2/limits';
import { STORY } from '../../src/engine/v2/finance/story';
import { RIVAL } from '../../src/engine/v2/finance/rivalFinance';
import { FIXTURE_DIR } from './lib';
import { tipSites } from './lint-tips';

let fails = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
};

// ── 1. internal-agent switch to an unevaluated version ──
for (const fx of ['day400.json', 'day900.json']) {
  const s = deserialize(readFileSync(join(FIXTURE_DIR, fx), 'utf8'));
  const v = internalVersion(s);
  if (!v) { ok(`${fx}: has an internal agent`, false); continue; }
  const L0 = measuredL(s);
  const U0 = understanding(s).U;
  const child = { ...structuredClone(v), id: `${v.id}-uxtest`, name: `${v.name}-test`, parentVersionId: v.id, status: 'evaluating' as const, evals: { bench: {}, safety: {} } };
  s.player.models.versions.push(child);
  s.player.agents.capRoutine.versionId = child.id;
  const e = internalEval(s);
  const U1 = understanding(s).U;
  ok(`${fx}: L kept while evaluating`, Math.abs(e.L - L0) < 1e-9 && e.evaluating, `L ${L0} → ${e.L} (evaluating ${e.evaluating})`);
  ok(`${fx}: U stable on agent switch`, Math.abs(U1 - U0) <= 1.5, `U ${U0} → ${U1}`);
}

// ── 2. glossary resolution ──
const has = (id: string) => !!GLOSSARY_V2[id] || /^(trait|sig):/.test(id);
const bad: string[] = [];
for (const [id, t] of Object.entries(GLOSSARY_V2)) {
  for (const m of t.body.matchAll(/\[\[([a-zA-Z0-9_.:-]+)(?:\|[^\]]+)?\]\]/g)) if (!has(m[1])) bad.push(`${id} → [[${m[1]}]]`);
}
ok('Glossary links resolve', bad.length === 0, bad.slice(0, 12).join(', '));

const files: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
walk('src/ui/v2');
const used = new Set<string>();
for (const f of files) {
  const src = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
  for (const m of src.matchAll(/<Term\s+id="([^"]+)"/g)) used.add(m[1]);
  for (const m of src.matchAll(/\bterm(?:Id)?:\s*'([a-zA-Z0-9_]+)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/\[\[([a-zA-Z0-9_.:-]+)(?:\|[^\]]+)?\]\]/g)) used.add(m[1]);
}
const missing = [...used].filter((id) => !has(id));
ok(`UI terms resolve (${used.size} used)`, missing.length === 0, missing.join(', '));

/** IA.md rule 4: the terms the user named, plus the core vocabulary of every panel. */
const REQUIRED = [
  'h100e', 'runway', 'covenant', 'dilution', 'evalaware', 'monitorability', 'rlBudget', 'distill', 'spv', 'lta', 'wsl', 'U', 'L', 'gap',
  'bottleneck', 'computeBound', 'catRisk', 'lead', 'idleChips', 'computeOnline', 'pool', 'split', 'burn', 'netBurn', 'liquidity', 'ledger',
  'raiseCeiling', 'valuation', 'boardConf', 'rdmult', 'misalign', 'agenda', 'technique', 'finding', 'traitGraph', 'evidenceGrade', 'evalGate',
  'channel', 'servingShare', 'capacityBound', 'kyc', 'leverage', 'sector', 'trust', 'credibility', 'scrutiny', 'access', 'commitment', 'watch',
  // R10: the tycoon-restructure vocabulary (STRUCTURE, TECH-TREE, mockups-v3 *-IA.md glossary lists).
  'coreLoop', 'takeoffLoop', 'verbSet', 'limit', 'startType', 'parentBudget', 'revenueRun',
  'team', 'roleEng', 'roleRE', 'roleSci', 'teamQuality', 'specialty', 'specialtyBonus', 'keepHiring', 'talentPull', 'payroll', 'morale', 'buildCapacity',
  'techTree', 'knowHow', 'trainedIn', 'depth', 'layer', 'layerBackbone', 'layerTraining', 'layerScaffold', 'layerLab', 'effortClass', 'teamMonth', 'odds',
  'researchLine', 'lineHealth', 'diminishingReturns', 'projectQueue', 'autoAssign', 'diffusion', 'frontierMethods',
  'blueprint', 'effCompute', 'baseRun', 'postTrain', 'distillRun', 'continueRun', 'flop', 'wallTime', 'behindAtFinish', 'staleness', 'dataWall', 'goodput', 'activeParams', 'tokensPerParam', 'servingFlop', 'gGain', 'distillGap', 'graders',
  'faultTolerant', 'buildQueue', 'teamWeek', 'poolShare', 'idleCompute', 'moe', 'neuralese', 'nativeMultimodal', 'hazardFilter', 'safetyPretrain',
  'rlFocus', 'hardenedGraders', 'cot', 'constitution', 'inoculation', 'honestyTraining', 'antiScheming', 'riskFamily', 'dataSpec', 'evals', 'autoEvaluate',
  'product', 'segmentShare', 'bestRivalProduct', 'bindingCause', 'qualityBound', 'priceBound', 'priceTier', 'safeguards', 'adaptation',
  'feature', 'releaseClearance', 'freeTier', 'autoServing', 'servingCut', 'upgradePolicy', 'timeHorizon', 'agentTasks', 'runCost', 'revPerH100e',
  'agentPackage', 'agentMonitor', 'monitor', 'catchRate', 'agentCopies', 'agentBudget', 'autoSplit', 'aiShareWork', 'researchTaste', 'trustedToAI', 'unseen',
  // model v3 V2b: research projects, recipe, work types, allocations.
  'projectStage', 'stageIdeation', 'stageSmall', 'stageScale', 'stageResult', 'stageAdoption', 'beliefBand', 'scaleBehaviour', 'projectKind', 'linePool',
  'nextPrior', 'realisedEffect', 'teamsWanted', 'riskPolicy', 'reopenSpeculative', 'scienceWhy', 'recipeStack', 'stackEfficiency',
  'softwareRate', 'expCompute', 'expLabour', 'labSpeed', 'workType', 'fit', 'medianExpert', 'bestHuman', 'coverage', 'pAtLength', 'winRate', 'assist',
  'effectiveLabour', 'humanShare', 'reNeeds', 'engNeeds', 'allocCap', 'overflow', 'laborBound', 'humanBound', 'tasteBound', 'aiFte',
  'validatedTo', 'blind', 'detector', 'estimateBand', 'toolUpkeep', 'deadEnd', 'seriousStaffing', 'followUp', 'investigation', 'caseStaffing', 'clarity',
  // model v3 B1: serving economics on the product card.
  'paidSeat', 'unseatedUse', 'supervisingHour', 'agentHour', 'agentLeverage', 'weeklyReach', 'paidShare', 'goingPrice', 'wtp', 'valueCap', 'markup', 'serveOrder', 'adoptedHour',
  // model v3 B2: customers as a stock, typed features.
  'customerStock', 'targetShare', 'customerSpeed', 'featEnabler', 'featHorizon', 'featScaffold', 'featEffort',
  // model v3 B3: the World panel's sector view.
  'workersUsingAI', 'hoursOfUse', 'savedPerHour', 'unseatedUse', 'seatShare', 'agentLeverage', 'costGate', 'feasibility', 'aiWorkHourCost', 'verifiability',
  // model v3 B4: serving as FLOP per token and cost per hour of use (replaces the relative serve cost).
  'useHourCost', 'teamsWantedAuto',
  // model v3 D5/D6: RL environment suites (Models › Suites).
  'envSuite', 'suiteFidelity', 'suiteExploit', 'expertData', 'suiteBuild', 'suiteHarden', 'suiteRlShare', 'rewardHackPressure', 'plannedRun',
  // model v3 D4: the data view (Models › Data) and the Blueprint's drawn mix.
  'dataPortfolio', 'uniqueTokens', 'dataQuality', 'publicWeb', 'licensedData', 'licenceTier', 'syntheticData', 'teacherYield', 'naturalMix', 'refShare', 'drawnMix', 'domainEpochs', 'pendingData', 'usageData', 'synJob', 'dataLicence', 'dataSpec',
  // model v3 E12: trait families and meanings, training pressure per run, successor pull.
  'traitBehaviour', 'traitAwareness', 'traitDisposition', 'traitProtective', 'trainingPressure', 'traitMovement', 'successorPull', 'aiRdShare', 'rdOversight',
  // model v3 D8: evaluations (Models › Evals).
  'evalSuite', 'evalDepth', 'measureBand', 'elicitation', 'evalIndep', 'evalGov', 'rerunRule', 'evalQueue', 'evaluating',
];
const req = REQUIRED.filter((id) => !GLOSSARY_V2[id]);
ok(`Required terms present (${REQUIRED.length})`, req.length === 0, req.join(', '));

// ── 3. every number has a tooltip (jank O1; scripts/v2/lint-tips.ts, allow-list with reasons there) ──
{
  const { sites, total } = tipSites();
  const bad = sites.filter((x) => !x.allowed);
  ok(`Numbers have a tooltip (${total - sites.length}/${total} sites tipped, ${sites.length - bad.length} allow-listed)`, bad.length === 0, bad.slice(0, 10).map((x) => `${x.file}:${x.line} ${x.text}`).join(' | '));
}

// ── 4. B4: no removed v2 concept in the glossary, the limits registry or the UI's text (model v3 V2b–V4: know-how and
//    know-how months → recipe; "× frontier"; relative serve cost → FLOP per token and cost per hour of use; revenue per
//    H100e × M^0.3; the research-speed cap row; 26% price capture; flat "+0.5 L" feature bonuses). ──
{
  const REMOVED: [string, RegExp][] = [
    ['serve cost', /\bserve[- ]?cost\b|\bserveCost\b/i], ['M^0.3', /M\s*\^\s*\(?0\.3|M⁰·³/], ['research-speed cap', /research[- ]speed cap|revenue\.speedCap/i],
    ['price capture', /price capture|captures? 26\s?%|26\s?% of the wage/i], ['flat +0.5 L bonus', /\+0\.5 ?(L|levels?)\b/], ['know-how', /know[- ]how/i],
    ['× frontier', /×\s?frontier\b/],
  ];
  const hits: string[] = [];
  for (const [id, t] of Object.entries(GLOSSARY_V2)) for (const [name, re] of REMOVED) if (re.test(id) || re.test(t.title) || re.test(t.body)) hits.push(`glossary ${id}: ${name}`);
  for (const l of LIMITS) for (const [name, re] of REMOVED) if (re.test(l.title) || re.test(l.rule)) hits.push(`limit ${l.id}: ${name}`);
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      if (/^\s*(\/\/|\/\*|\*)/.test(l)) return;
      const code = l.replace(/\/\/ .*$/, '');
      for (const [name, re] of REMOVED) if (re.test(code)) hits.push(`${f.replace(/\\/g, '/')}:${i + 1}: ${name}`);
    });
  }
  ok('No removed v2 concepts in the glossary, limits or UI text (B4)', hits.length === 0, hits.slice(0, 10).join(' | '));
}

// ── 5. finance glossary numbers follow the engine's constants (FIN6c: the FIN6a refit left four entries stale; the
//    glossary is plain data and cannot import the engine, so this check keeps them in step) ──
{
  const body = (id: string) => GLOSSARY_V2[id]?.body ?? '';
  const w = STORY.weights;
  const want: [string, string][] = [
    ['marketMood', `× ${STORY.bust} during a [[bubble|bust]]`],
    ['bubble', `×${STORY.bust}`],
    ['storyShare', `exp(story score ÷ ${STORY.tau})`],
    ['storyShare', `[[storyPosition|position]] ×${w.position}, [[storyMomentum|momentum]] ×${w.momentum}, [[storyEconomics|economics]] ×${w.economics}, [[storyCapacity|capacity]] ×${w.capacity}`],
    ['sectorValue', `^${STORY.alpha}`],
    ['sectorValue', `÷ ${STORY.phiRef})^${STORY.phi}`],
    ['investorPool', `${Math.round(STORY.pi * 100)}% of the [[sectorValue|sector value]]`],
    ['valuationCap', `$${RIVAL.team}B of team value`],
    ['valuationCap', `${RIVAL.multiple}× at ×${RIVAL.capGrowthRef} a year × (growth ÷ ${RIVAL.capGrowthRef})^${RIVAL.capGrowthExp}`],
    ['valuationCap', `×${STORY.growth[0]}–×${STORY.growth[1]}`],
  ];
  const stale = want.filter(([id, text]) => !body(id).includes(text));
  ok(`Finance glossary numbers match the engine (${want.length})`, stale.length === 0, stale.map(([id, text]) => `${id}: "${text}"`).join(' | '));
}

// `--doc`: regenerate design/ux/GLOSSARY.md, the coverage list (every term → its tooltip text).
if (process.argv.includes('--doc')) {
  const esc = (x: string) => x.replace(/\|/g, '\\|').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2 (→$1)').replace(/\[\[([^\]]+)\]\]/g, '$1 (→)');
  const rows = Object.entries(GLOSSARY_V2).sort((a, b) => a[0].localeCompare(b[0])).map(([id, t]) => `| \`${id}\` | ${esc(t.title)} | ${esc(t.body)} | ${t.src ? esc(t.src) : ''} |`);
  const doc = [
    '# v2 glossary coverage',
    '',
    'Generated by `npx tsx scripts/v2/lint-ux.ts --doc` from `src/data/v2/glossary.ts` (v1 entries overlaid by v2). Do not edit by hand.',
    '',
    `Every technical or business term in the UI is a \`<Term id>\` or a \`[[id]]\` link that resolves to one of these ${rows.length} entries (IA.md rule 4). Traits and training signals resolve as \`trait:<ID>\` and \`sig:<ID>\` from \`src/data/v2/traits.ts\`. "(→id)" marks a nested tooltip.`,
    '',
    '| id | Term | Tooltip | Source |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
  writeFileSync('design/ux/GLOSSARY.md', doc);
  console.log(`wrote design/ux/GLOSSARY.md (${rows.length} terms)`);
}

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
