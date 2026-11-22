// newGame: build a complete, valid GameStateV2 (V2-SPEC §2.3, §3 start values). Owner: WS1.
// Composes the owner-provided initialisers (initialFinance, initialGov, initialWorld, …) so each workstream owns
// its start values in its own module. All newGame randomness comes from stream 'world' (§2.3).
import { LEADER_FEATURES } from '../../../data/v2/features';
import { BENCHMARKS } from '../../../data/v2/benchmarks';
import { PLAYER_MODEL_FAMILY } from '../../../data/v2/names';
import { PRE_GAME_G_PER_YEAR, REFERENCE_BASE, REFERENCE_POST, RL_BUDGET } from '../../../data/v2/runDesign';
import { B0_DAY, B0_START_DAY, SHARE_REF, V0_DAY } from '../../../data/v2/calibration';
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
import { seedCandidates, staffOf, startTeams } from '../departments/teams';
import { initialBoard } from '../finance/board';
import { initialCapital } from '../finance/investors';
import { initialFinance } from '../finance/ledger';
import { startStory } from '../finance/story';
import { recordThesisHist } from '../finance/promises';
import { startDivision } from '../finance/parent';
import { benchScore } from '../models/benchmarks';
import { domainsOf, gOfBuild, gV0, levelOfG, startLab, startStateOf, updateMilestones } from '../models/capability';
import { initialStacks } from '../models/stacks';
import { fillRecipe } from '../models/runs';
import { flopOfDesign, rlFamiliesAvailable, rlWeights, fptOfDesign } from '../models/effective';
import { labCore } from '../models/labs';
import { initialParadigms } from '../models/paradigms';
import { initialResearch, initialTree } from '../models/tree';
import { initialBuild } from '../departments/build';
import { initialAgents } from '../departments/agents';
import { computeProduction } from '../production/production';
import { portfolioU, startPortfolio } from '../production/data';
import { startExpertAssets, startSuites } from '../models/suites';
import { initialSafetyDept } from '../safety/agendas';
import { initialSecurity } from '../security/security';
import { drawLineageUModes, sampleHidden } from '../world/hidden';
import { initialWorld } from '../worldfx/sectors';
import { initCustomerStocks } from '../worldfx/mix';
import type {
  Deployment, DomainId, EvalRecord, GameStateV2, ModelVersion, PlayerLab, SetupV2, TimelineWorld, ToolFamily, TraitBelief, TraitId, TrainingRun, VersionBuild,
} from '../types';
import { emptySeries, sampleSeries } from './record';
import { hash32, seedStreams, StreamRng } from './rng';
import { SCHEMA_REV } from './save';
import { playerShareRef } from '../departments/split';
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

/** A reference post-training run on B0 already in flight at the start (launched three days ago, 30% of its RL FLOP
 *  done), so the next version lands within days, as under the reference cadence [D]. */
function startRun(w: TimelineWorld, lag: number, b0Flop: number, Lg: number, domains: Record<DomainId, number>): TrainingRun {
  const start = -3;
  const flopNeeded = RL_BUDGET.standard * b0Flop;
  const zero = { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0, S7: 0, S8: 0, S9: 0 };
  return {
    id: 'R0', kind: 'post', name: 'post 0', startDay: start, flopNeeded, flopDone: 0.3 * flopNeeded,
    poolShare: 0.5, cashCost: 0, baseId: 'B0', post: { ...REFERENCE_POST, techniques: [], trainAgainst: [] },
    predicted: {
      Lg: [Lg, Lg + 0.5], domains: Object.fromEntries(Object.entries(domains).map(([d, v]) => [d, [v, v + 0.5]])) as Record<DomainId, [number, number]>,
      signals: zero, etaDays: 7, fpt: fptOfDesign(REFERENCE_BASE.params, REFERENCE_BASE.shape), monitorability: 'high',
    },
    status: 'running', signals: {},
    // Its RL recipe is the start lab's on its launch day (model v3 V2: frozen at launch): the start RL recipe grows
    // linearly from V0's (day V0_DAY) to the day-0 recipe (0), less the lab's lag (RD-U06).
    recipe: { rlMid: (startStateOf(w).v0 * start) / V0_DAY - lag, rlCeil: 0 },
  };
}

/** The start base B0 and version V0 from physical numbers (model v3 V1.4): B0 is the reference base (≈ 354B active MoE ×
 *  400 tokens per parameter = 3e26 FLOP, research/12 §0.3; A6b); B0 and V0 come from startLab, the start rule every lab
 *  shares (RD-U06): the world's start recipes less the lag that puts V0 at G0 (the leader: G(V0), lag 0). */
function startModels(w: TimelineWorld, G0: number, uniqueT: number) {
  const d = REFERENCE_BASE;
  const flop = flopOfDesign(d);
  const tokens = d.params * d.tpp;
  const st = startLab(w, G0, { flop, tpp: d.tpp, shape: d.shape });
  const rlW = rlWeights('broad', rlFamiliesAvailable(() => false));
  const rlFlop = RL_BUDGET.standard * flop;
  const build: VersionBuild = {
    gPre: st.gPre, flopPre: flop, rlFlop, rlW, eRL: st.eRL, aRL: 0, dgRL: st.rl.general, dgRLd: st.rl.perDomain, dg: 0, sD: {}, dgD: {},
    h80Mult: 1, signals: {},
  };
  const G = gOfBuild(build);
  return { lag: st.lag, flop, tokens, gPre: st.gPre, ePre: st.ePre, epochs: tokens / Math.max(1, uniqueT), build, G, fpt: fptOfDesign(d.params, d.shape) };
}

/** The player's start (BUILD-PLAN R9). The frontier-leader start is today's (and the calibration anchor): every value
 *  comes from the owners' initialisers exactly as before. The other starts take data/v2/starts.ts: the start model lags
 *  the reference frontier by `lagMonths` (as initialRival: G − lag·rate₀, with the start recipe shifted by the same
 *  progress), teams, known nodes, products and built features, cash, compute owned/rented, board. */
function buildPlayer(rng: Rng, s: Pick<GameStateV2, 'setup' | 'hidden'>, startDate: string): PlayerLab {
  const { setup, hidden } = s;
  const w = hidden.timeline;
  const base = BASELINES.find((b) => b.id === setup.baseline) ?? BASELINES[0];
  const start = setup.start ?? 'leader';
  const def = START_BY_ID[start];
  const leader = start === 'leader';
  // §3.1.4 initial state: B0 finished day −120, V0 day −20 (data/v2/calibration.ts START_STATE, RD-U06).
  // A follower's start lag in OOM of G: its months behind at the stated pre-game pace (RD-L03).
  const lagG = leader ? 0 : (def.lagMonths / 12) * PRE_GAME_G_PER_YEAR;
  const dataPortfolio = startPortfolio(); // model v3 D1: U = 270T public crawl + 30T licensed + 0.5 × 20T synthetic = 310T
  // Model v3 D5: the start suites' expert data (one asset per start RL family) replaces D1's empty expert placeholder.
  dataPortfolio.assets = [...dataPortfolio.assets.filter((a) => a.kind !== 'expert'), ...startExpertAssets()];
  const uniqueT = portfolioU(dataPortfolio);
  // A follower's start model lags by lagG (BUILD-PLAN R9). Its base is the same physical run; the lag is a recipe lag
  // (startLab: the pretraining and the RL recipe), solved so that G(V0) = G(V0 of the leader) − lagG.
  const gWant = gV0(w) - lagG;
  const sm = startModels(w, gWant, uniqueT);
  const k = sm.lag;
  const G0 = lagG ? gWant : sm.G;
  const build = sm.build;
  const roster = startTeams(setup.baseline, start);
  const staff = staffOf(roster.teams);
  const Lg = levelOfG(w, G0);
  const domains = domainsOf(w, G0, build);
  const lineage = 'L-player-1';
  const uModes = drawLineageUModes(rng, hidden, false);
  const beliefs = {} as Record<TraitId, TraitBelief>;
  const masks = {} as Record<TraitId, Partial<Record<ToolFamily, number>>>;
  for (const t of TRAIT_IDS) {
    const est = clamp(TRAIT_START[t] + rng.normal(0, 0.08), 0, 1);
    beliefs[t] = { est, sd: 0.2, clarity: 1 - 0.2 / 0.35, lastObsDay: -20, evidence: [{ day: -20, source: 'start', reading: Math.round(est * 1000) / 1000, noise: 0.2 }] };
    masks[t] = {};
  }
  const V0: ModelVersion = {
    id: 'V0', name: def.imported ? 'Open-weight import' : `${PLAYER_MODEL_FAMILY}-1.0`, baseId: 'B0', day: -20, variant: def.imported ? 'imported' : 'full', design: { ...REFERENCE_POST },
    G: G0, Lg, domains, traitsTrue: { ...TRAIT_START }, masks, uModes, monitorability: 0.9, fpt: sm.fpt,
    evals: startEvals(domains, Math.round(Lg * 100) / 100, -20), beliefs, status: 'deployed', flags: {}, build, appeal: 1,
  };
  const dep = (id: string, channel: Deployment['channel'], servingShare: number, kyc: Deployment['kyc']): Deployment => ({
    id, kind: channel === 'internal' ? 'internal' : 'product', versionId: 'V0', channel, startDay: -20, price: 'standard', priceIndex: 1, effort: 'max', servingShare,
    safeguards: channel === 'internal' ? 'standard' : 'classifiers', guards: channel === 'internal' ? [{ kind: 'review', since: -20 }] : [], packs: [], features: [],
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
    computeOnline: leader ? (setup.baseline === 'reality' ? 1.0e6 : 1.2e6) : def.owned + def.rented,
    split: playerShareRef(SHARE_REF[0].year), // the start split: AI 2027's compute-usage table at the start (data), engineering agents on their own line (RD-A02)
    staff,
    tasteHire: 1,
    models: {
      bases: [{
        id: 'B0', name: def.imported ? 'Open-weight base (imported)' : `${PLAYER_MODEL_FAMILY}-1`, day: B0_DAY, startDay: B0_START_DAY, flop: sm.flop,
        params: REFERENCE_BASE.params, tokens: sm.tokens, gPre: sm.gPre, ePre: sm.ePre, epochs: sm.epochs,
        design: { ...REFERENCE_BASE, curation: { ...REFERENCE_BASE.curation } }, sD: {}, fpt: sm.fpt, monitorability: 1, signals: {},
        lineage, traitsTrue: { ...TRAIT_START }, uModes: [...uModes],
      }],
      versions: [V0],
      // A post-training run in flight on B0 (the spinout starts with none: its base is a download).
      runs: def.imported ? [] : [startRun(w, k, sm.flop, Lg, domains)],
      nextName: 1,
      evals: [],
      evalSpent: { suites: 0, reTW: 0, engTW: 0, h100eDays: 0 },
    },
    deployments,
    security: initialSecurity(staff, base.start.securityLevel),
    paradigms: initialParadigms(),
    milestoneDays: {}, // set at the end of newGame by the milestone predicate (updateMilestones)
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
    // Model v3 V2: the recipe stacks start at the leader's day-0 recipe, a follower its start lag k (OOM) lower.
    research: { ...initialResearch(roster.teams), stacks: initialStacks(k) },
    build: initialBuild(),
    // D5: the leader start's features (sector packs) are the ×1 baseline; other starts build their own set.
    features: leader ? [...LEADER_FEATURES] : [...def.features],
    morale: { overall: 70, safety: 65 },
    dataPortfolio,
    suites: startSuites(start), // model v3 D5: leader, challenger, big tech hardened; the spinout cheap (data/v2/suites.ts)
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
  const g0 = gV0(w);
  const rivals = Array.from({ length: setup.rivalCount }, (_, i) => initialRival(worldRng, hidden, i, g0, setup.baseline, base.start.globalCompute));
  // The AI 2027 leader lab (BUILD-PLAN R2): after the sampled rivals, from its own stream, so 'world' draws (and
  // everything sampled from them) are the same with the flag on or off.
  if (setup.leaderLab) rivals.push(initialLeaderLab(new Rng(hash32(setup.seed, 'leaderLab')), hidden, setup, g0));
  const china = initialChina(worldRng, hidden, g0, base.start.chinaGapOom);
  // Intel starts from the player's own lag (R9): every lab's estimated lead is against the player's start model.
  if (start !== 'leader') for (const r of [...rivals, china.lab]) if (r.intel) r.intel.leadDaysEst -= Math.round((def.lagMonths * 365) / 12);
  rngState.world = worldRng.state;

  const labIds = ['player', ...rivals.map((r) => r.core.id), 'china'];
  const rSector = player.finance.revenueRun + rivals.filter((r) => r.finance.valuation > 0).reduce((a, r) => a + r.finance.revenueRun, 0);
  const openGs = [...rivals, china.lab].flatMap((r) => (r.publicModel?.openWeights ? [r.publicModel.G] : []));

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
    knowledge: { publishedFindings: [], revealedUModes: [], sharedTechniquePool: 0.1, openWeightsG: openGs.length ? Math.max(...openGs) : g0 - 1.2 /* was 1 progress-year */ },
    events: { pending: [], fired: {}, director: { tension: 0, lastCrisisDay: -999, quietUntil: 0, concurrentCrises: 0 } },
    log: [{ day: 0, kind: 'news', text: 'Agents stumble into the market: the first computer-use assistants ship. Adoption is slow.' }],
    headlines: [],
    causes: { byKey: {} },
    series: emptySeries(labIds),
    decisions: [],
    tutorial: { act: 1, unlocked: setup.tutorial ? ['finance', 'departments', 'models', 'relations'] : ['*'], seen: [] },
    flags: {},
  };
  // RD-L04: day-0 milestones by the one predicate (every lab; recorded as day 0, the player's told silently), before
  // the readouts (Stage 2 reads SC).
  for (const i of updateMilestones(s, 0)) if (i > 0) s.flags[`seenMilestone${i}`] = 0;
  // Readouts (model v3 F1: the non-player labs' recipe, base and models were set when they were built,
  // actors/rivalModel.ts initRivalPhys).
  for (const id of labIds) {
    const core = labCore(s, id);
    if (core) core.prodCache = computeProduction(s, id);
  }
  // RD-B02: the start run's launch snapshot (its RL recipe is its launch day's; suites, domain effects, P07 and the
  // serving stack are day 0's, the first day the lab can adopt anything).
  for (const r of s.player.models.runs) fillRecipe(s, r);
  // A7: the start's customer stocks (sector buyers outside China spread as measured in mid-2025, worldfx/mix.ts).
  initCustomerStocks(s);
  seedCandidates(s.player.hiring, new StreamRng(s, 'company'));
  recordThesisHist(s); // FIN2: day-0 milestone metrics (the raise card's trends)
  startDivision(s); // FIN5c: a big-tech division's first budget year and the parent's goals for it
  startStory(s); // FIN5a: the first story mark (valuation), the investor pool and the player's part of it
  sampleSeries(s);
  return s;
}
