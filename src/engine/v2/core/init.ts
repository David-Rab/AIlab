// newGame: build a complete, valid GameStateV2 (V2-SPEC §2.3, §3 start values). Owner: WS1.
// Composes the owner-provided initialisers (initialFinance, initialGov, initialWorld, …) so each workstream owns
// its start values in its own module. All newGame randomness comes from stream 'world' (§2.3).
import { LEADER_FEATURES } from '../../../data/v2/features';
import { BENCHMARKS } from '../../../data/v2/benchmarks';
import { PLAYER_MODEL_FAMILY } from '../../../data/v2/names';
import { REFERENCE_BASE, REFERENCE_POST } from '../../../data/v2/runDesign';
import { B0_DAY, B0_START_DAY, KAPPA, PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { START_BY_ID } from '../../../data/v2/starts';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { TRAIT_IDS, TRAIT_START } from '../../../data/v2/traits';
import { BASELINES } from '../../../data/world';
import { Rng, clamp } from '../../rng';
import { initialChina } from '../actors/china';
import { initialGov } from '../actors/gov';
import { initialPublic } from '../actors/public';
import { initialRelations } from '../actors/relations';
import { initialResearchBodies } from '../actors/researchBodies';
import { initialLeaderLab, initialRival } from '../actors/rivals';
import { initialMarket } from '../compute/market';
import { initialCloud, initialOrders } from '../compute/orders';
import { initialPower } from '../compute/power';
import { initialSites } from '../compute/sites';
import { shareRefAt } from '../departments/split';
import { seedCandidates, staffOf, startTeams } from '../departments/teams';
import { initialBoard } from '../finance/board';
import { initialCapital } from '../finance/investors';
import { initialFinance } from '../finance/ledger';
import { recordThesisHist } from '../finance/promises';
import { benchScore } from '../models/benchmarks';
import { domainsOf, levelOf, playerStart, simpleStartPa, yearOfDay } from '../models/capability';
import { labCore } from '../models/labs';
import { initialParadigms } from '../models/paradigms';
import { initialResearch, initialTree } from '../models/tree';
import { initialBuild } from '../departments/build';
import { initialAgents } from '../departments/agents';
import { frontierFlop } from '../production/knots';
import { computeProduction } from '../production/production';
import { initialSafetyDept } from '../safety/agendas';
import { initialSecurity } from '../security/security';
import { referenceRate, thresholds } from '../world/calibration';
import { drawLineageUModes, sampleHidden } from '../world/hidden';
import { initialWorld } from '../worldfx/sectors';
import type {
  Deployment, DomainId, EvalRecord, GameStateV2, MilestoneIdx, ModelVersion, PlayerLab, SetupV2, TimelineWorld, ToolFamily, TraitBelief, TraitId, TrainingRun, VersionBuild,
} from '../types';
import { emptySeries, sampleSeries } from './record';
import { hash32, seedStreams, StreamRng } from './rng';
import { SCHEMA_REV } from './save';
import { startBoard, startCompute, startFinance } from './starts';
import { START_DATE } from './time';

export function defaultSetupV2(over: Partial<SetupV2> = {}): SetupV2 {
  const world = over.world ?? 'ai2027';
  return {
    baseline: 'classic',
    world,
    alignment: 'sampled',
    econ: world === 'ai2027' ? 'ai2027' : 'sampled', // §2.3 step 8: the ai2027 timeline defaults to econ ai2027
    gov: 'realistic', public: 'realistic', china: 'realistic', rivals: 'realistic',
    rivalCount: 4,
    governance: 'legacyNonprofit',
    storyteller: 'rising',
    tutorial: true,
    seed: Math.floor(Math.random() * 1e9),
    companyName: 'OpenBrain',
    ...over,
    // R9: the start type (default the frontier leader) sets the leader lab (D1) unless the caller sets it.
    start: over.start ?? 'leader',
    leaderLab: over.leaderLab ?? START_BY_ID[over.start ?? 'leader'].leaderLab,
  };
}

/** Milestones already crossed at day 0 (recorded as day 0). */
export function initialMilestones(w: TimelineWorld, pm: number): Partial<Record<MilestoneIdx, number>> {
  const out: Partial<Record<MilestoneIdx, number>> = {};
  thresholds(w).forEach((t, i) => {
    if (pm >= t) out[i as MilestoneIdx] = 0;
  });
  return out;
}

function startEvals(domains: Record<DomainId, number>, measuredL: number, day: number): EvalRecord {
  const bench: EvalRecord['bench'] = {};
  for (const b of BENCHMARKS) {
    if (b.special) continue;
    const ds = Array.isArray(b.domain) ? b.domain : [b.domain];
    const Ld = ds.reduce((a, d) => a + domains[d], 0) / ds.length;
    bench[b.id] = { score: Math.round(benchScore(b, Ld) * 10) / 10, sd: 2, day, by: 'self' };
  }
  // M1: the start model is long known: its reading is exact and counts as 16 suites (band ±0.05).
  return { suiteDay: day, bench, safety: {}, measuredL, nSuites: 16, errTrue: 0 };
}

/** A reference post-training run on B0 already in flight at the start (launched day −42), so the next version lands
 *  about a month in, as under the reference 6-week cadence [D]. It asks for the whole training pool (R5: the start state
 *  has no idle training compute, as the reference lab's; it finishes its FLOP within days and then only waits for its
 *  minimum length, which takes no pool share). */
function startRun(w: TimelineWorld, ps: ReturnType<typeof playerStart>, Lg: number, domains: Record<DomainId, number>): TrainingRun {
  const start = -42;
  const flopNeeded = 0.5 * frontierFlop(w, yearOfDay(start));
  const perDay = 1e6 * 0.4 * 0.5 * PHI_FLOP_PER_H100E_DAY;
  const zero = { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0, S7: 0, S8: 0 };
  return {
    id: 'R0', kind: 'post', name: 'post 0', startDay: start, flopNeeded, flopDone: Math.min(0.9 * flopNeeded, -start * perDay), minDays: 77,
    poolShare: 1, cashCost: 0, baseId: 'B0', post: { ...REFERENCE_POST, techniques: [], trainAgainst: [] },
    predicted: {
      Lg: [Lg, Lg + 0.5], domains: Object.fromEntries(Object.entries(domains).map(([d, v]) => [d, [v, v + 0.5]])) as Record<DomainId, [number, number]>,
      signals: zero, etaDays: 35, serveCost: 0.5, monitorability: 'high',
    },
    status: 'running', restarts: 0, paAtStart: ps.pa0 + (ps.r0 * start) / 365, signals: {},
  };
}

/** The player's start (BUILD-PLAN R9). The frontier-leader start is today's (and the calibration anchor): every value
 *  comes from the owners' initialisers exactly as before. The other starts take data/v2/starts.ts: the start model lags
 *  the reference frontier by `lagMonths` (as initialRival: pm − lag·rate₀, with the know-how pa and the start base
 *  shifted by the same progress), teams, known nodes, products and built features, cash, compute owned/rented, board. */
function buildPlayer(rng: Rng, s: Pick<GameStateV2, 'setup' | 'hidden'>, startDate: string): PlayerLab {
  const { setup, hidden } = s;
  const w = hidden.timeline;
  const base = BASELINES.find((b) => b.id === setup.baseline) ?? BASELINES[0];
  const start = setup.start ?? 'leader';
  const def = START_BY_ID[start];
  const leader = start === 'leader';
  // §3.1.4 initial state: B0 started day −120, V0 finished day −20; pa(0) solved so that pm(V0) = p0 − calShift.
  const ps0 = playerStart(w);
  const lagY = leader ? 0 : (def.lagMonths / 12) * referenceRate(w, ps0.target, 2025.5);
  const ps = lagY ? { ...ps0, pa0: ps0.pa0 - lagY, paBase: ps0.paBase - lagY, paPost: ps0.paPost - lagY, target: ps0.target - lagY } : ps0;
  const pm0 = ps.target;
  const build: VersionBuild = { paBase: ps.paBase, paPost: ps.paPost, kappa: KAPPA.post, pc: ps.pcB0, dp: 0, off: {}, h80Mult: 1, misuseMult: 1, signals: {} };
  const roster = startTeams(setup.baseline, start);
  const staff = staffOf(roster.teams);
  const Lg = levelOf(w, pm0);
  const domains = domainsOf(w, pm0);
  const lineage = 'L-player-1';
  const uModes = drawLineageUModes(rng, hidden, false);
  const beliefs = {} as Record<TraitId, TraitBelief>;
  const masks = {} as Record<TraitId, Partial<Record<ToolFamily, number>>>;
  for (const t of TRAIT_IDS) {
    beliefs[t] = { est: clamp(TRAIT_START[t] + rng.normal(0, 0.08), 0, 1), sd: 0.2, clarity: 1 - 0.2 / 0.35, lastObsDay: -20 };
    masks[t] = {};
  }
  const V0: ModelVersion = {
    id: 'V0', name: def.imported ? 'Open-weight import' : `${PLAYER_MODEL_FAMILY}-1.0`, baseId: 'B0', day: -20, variant: def.imported ? 'imported' : 'full', design: { ...REFERENCE_POST },
    pm: pm0, Lg, domains, traitsTrue: { ...TRAIT_START }, masks, uModes, monitorability: 0.9, serveCost: 0.5,
    evals: startEvals(domains, Math.round(Lg * 100) / 100, -20), beliefs, status: 'deployed', flags: {}, build, appeal: 1,
  };
  const dep = (id: string, channel: Deployment['channel'], servingShare: number, kyc: Deployment['kyc']): Deployment => ({
    id, kind: channel === 'internal' ? 'internal' : 'product', versionId: 'V0', channel, startDay: -20, price: 'standard', priceIndex: 1, effort: 'max', servingShare,
    safeguards: channel === 'internal' ? 'standard' : 'classifiers', controlLayer: false, sectorFocus: [], features: [],
    usagePolicy: { noDropInReplacement: false, noSurveillance: false, noAutonomousWeapons: false, minorsProtections: channel === 'consumer' },
    kyc, status: 'live',
  });
  // Products at the start: the leader's three (as before) or the start type's; the internal deployment last.
  const deployments = leader
    ? [dep('D1', 'consumer', 0.45, 0), dep('D2', 'api', 0.35, 1), dep('D3', 'enterprise', 0.2, 0), dep('D4', 'internal', 0, 0)]
    : [
        ...def.products.map((x, i) => ({ ...dep(`D${i + 1}`, x.channel, x.servingShare, x.channel === 'api' ? 1 : 0), features: [...(x.features ?? [])] })),
        dep(`D${def.products.length + 1}`, 'internal', 0, 0),
      ];
  const safety = initialSafetyDept();
  // Known safety ideas come with their tools (research/18 §5: probes, SAEs).
  for (const id of def.known) {
    const t = leader ? undefined : safety.techniques[id];
    if (t && !t.unlocked) Object.assign(t, { unlocked: true, active: TECHNIQUE_BY_ID[id]?.role !== 'fix' });
  }
  const compute = leader ? undefined : startCompute(def, startDate);
  return {
    id: 'player', name: setup.companyName, kind: 'player', status: 'active',
    pa: ps.pa0,
    computeOnline: leader ? (setup.baseline === 'reality' ? 1.0e6 : 1.2e6) : def.owned + def.rented,
    split: shareRefAt(2025.5),
    staff,
    tasteHire: 1,
    models: {
      bases: [{
        id: 'B0', name: def.imported ? 'Open-weight base (imported)' : `${PLAYER_MODEL_FAMILY}-1`, day: B0_DAY, startDay: B0_START_DAY, flop: frontierFlop(w, yearOfDay(B0_START_DAY)), paAtStart: ps.paBase, pc: ps.pcB0,
        design: { ...REFERENCE_BASE, curation: { ...REFERENCE_BASE.curation } }, dp: 0, off: {}, serve: 0.5, monitorability: 1, signals: {},
        lineage, traitsTrue: { ...TRAIT_START }, uModes: [...uModes],
      }],
      versions: [V0],
      // A post-training run in flight on B0 (the spinout starts with none: its base is a download).
      runs: def.imported ? [] : [startRun(w, ps, Lg, domains)],
      nextName: 1,
    },
    deployments,
    security: initialSecurity(staff, base.start.securityLevel),
    paradigms: initialParadigms(),
    milestoneDays: initialMilestones(w, pm0),
    finance: compute ? startFinance(def, compute) : initialFinance(setup.baseline, setup.governance, startDate),
    board: leader ? initialBoard(setup.governance) : startBoard(def),
    sites: compute ? compute.sites : initialSites(setup.baseline, startDate),
    orders: compute ? [] : initialOrders(setup.baseline),
    cloud: compute ? compute.cloud : initialCloud(setup.baseline, startDate),
    safety,
    teams: roster.teams,
    stars: 0,
    hiring: roster.hiring,
    tree: initialTree(setup),
    research: initialResearch(roster.teams),
    build: initialBuild(),
    // D5: the leader start's features (sector packs) are the ×1 baseline; other starts build their own set.
    features: leader ? [...LEADER_FEATURES] : [...def.features],
    morale: { overall: 70, safety: 65 },
    dataAssets: { licensedTokensT: 30, unlicensedTokensT: 270, syntheticTokensT: 20, litigationRisk: (0.02 * 270) / 100 },
    policies: { whistleblowerChannel: false, publishSafety: 'selective', govBriefing: 1, shareWithAllies: false, transitionFund: 0, communityBenefits: false, spareTraining: 'data', spareServing: 'research', servingAuto: true, upgradeToNewest: false, autoEvaluate: true, trustedToAI: 0 },
    agents: initialAgents('V0'),
  };
}

export function newGame(setupIn: SetupV2): GameStateV2 {
  // R1 setup fields: callers built before them (older UI drafts, scripts) get today's start.
  // R9: the start type sets the leader lab (D1) unless the caller sets it, and (other than the leader's) the board.
  const start = setupIn.start ?? 'leader';
  const def = START_BY_ID[start];
  const setup: SetupV2 = { ...setupIn, start, leaderLab: setupIn.leaderLab ?? def.leaderLab, ...(start === 'leader' ? {} : { governance: def.board }) };
  const startDate = START_DATE;
  const rngState = seedStreams(setup.seed);
  const worldRng = new Rng(rngState.world);
  const hidden = sampleHidden(worldRng, setup);
  const w = hidden.timeline;
  const base = BASELINES.find((b) => b.id === setup.baseline) ?? BASELINES[0];

  const player = buildPlayer(worldRng, { setup, hidden }, startDate);
  // Rivals, China and the leader lab are placed against the reference frontier (the leader start's V0), whatever the
  // player's own start model is.
  const pm0 = playerStart(w).target;
  const rivals = Array.from({ length: setup.rivalCount }, (_, i) => initialRival(worldRng, hidden, i, pm0, setup.baseline, base.start.globalCompute));
  // The AI 2027 leader lab (BUILD-PLAN R2): after the sampled rivals, from its own stream, so 'world' draws (and
  // everything sampled from them) are the same with the flag on or off.
  if (setup.leaderLab) rivals.push(initialLeaderLab(new Rng(hash32(setup.seed, 'leaderLab')), hidden, setup, pm0));
  const china = initialChina(worldRng, hidden, pm0, base.start.chinaGapYears);
  for (const r of [...rivals, china.lab]) {
    r.core.milestoneDays = initialMilestones(w, Math.max(r.internal.pm, r.publicModel?.pm ?? -Infinity));
  }
  // Intel starts from the player's own lag (R9): every lab's estimated lead is against the player's start model.
  if (start !== 'leader') for (const r of [...rivals, china.lab]) if (r.intel) r.intel.leadDaysEst -= Math.round((def.lagMonths * 365) / 12);
  rngState.world = worldRng.state;

  const labIds = ['player', ...rivals.map((r) => r.core.id), 'china'];
  const rSector = player.finance.revenueRun + rivals.filter((r) => r.finance.valuation > 0).reduce((a, r) => a + r.finance.revenueRun, 0);
  const openPms = [...rivals, china.lab].flatMap((r) => (r.publicModel?.openWeights ? [r.publicModel.pm] : []));

  const s: GameStateV2 = {
    version: 2,
    schemaRev: SCHEMA_REV,
    setup: { ...setup },
    hidden,
    time: { day: 0, startDate, speed: 0 },
    rng: rngState,
    player,
    rivals,
    china,
    gov: initialGov(hidden.actorPresets.gov),
    pub: initialPublic(hidden.actorPresets.public, setup.baseline),
    researchBodies: initialResearchBodies(),
    relations: { ...initialRelations(rivals.map((r) => r.core.id)), ...(start === 'leader' ? {} : { talentPull: def.mods.talentPull }) },
    commitments: [],
    market: initialMarket(setup.baseline),
    power: start === 'leader' ? initialPower() : { ...initialPower(), queue: [] },
    capital: initialCapital(rSector),
    world: initialWorld(labIds),
    knowledge: { publishedFindings: [], revealedUModes: [], sharedTechniquePool: 0.1, openWeightsFrontier: openPms.length ? Math.max(...openPms) : pm0 - 1 },
    events: { pending: [], fired: {}, director: { tension: 0, lastCrisisDay: -999, quietUntil: 0, concurrentCrises: 0 } },
    log: [{ day: 0, kind: 'news', text: 'Agents stumble into the market: the first computer-use assistants ship. Adoption is slow.' }],
    headlines: [],
    causes: { byKey: {} },
    series: emptySeries(labIds),
    decisions: [],
    tutorial: { act: 1, unlocked: setup.tutorial ? ['finance', 'departments', 'models', 'relations'] : ['*'], seen: [] },
    flags: {},
  };
  // Non-player know-how: solve pa so that each lab's default frontier (simpleFrontierPm) equals its start model.
  // Readouts first (the rate does not depend on pa), then each lab's pa from its start model and rate.
  for (const id of labIds) {
    const core = labCore(s, id);
    if (core) core.prodCache = computeProduction(s, id);
  }
  for (const r of [...rivals, china.lab]) r.core.pa = simpleStartPa(s, r.core.id, r.internal.pm);
  seedCandidates(s.player.hiring, new StreamRng(s, 'company'));
  recordThesisHist(s); // FIN2: day-0 milestone metrics (the raise card's trends)
  sampleSeries(s);
  return s;
}
