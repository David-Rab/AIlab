// newGame: build a complete, valid GameStateV2 (V2-SPEC §2.3, §3 start values). Owner: WS1.
// Composes the owner-provided initialisers (initialFinance, initialGov, initialWorld, …) so each workstream owns
// its start values in its own module. All newGame randomness comes from stream 'world' (§2.3).
import { BENCHMARKS } from '../../../data/v2/benchmarks';
import { PLAYER_MODEL_FAMILY } from '../../../data/v2/names';
import { REFERENCE_BASE, REFERENCE_POST } from '../../../data/v2/runDesign';
import { TRAIT_IDS, TRAIT_START } from '../../../data/v2/traits';
import { BASELINES } from '../../../data/world';
import { Rng, clamp } from '../../rng';
import { initialChina } from '../actors/china';
import { initialGov } from '../actors/gov';
import { initialPublic } from '../actors/public';
import { initialRelations } from '../actors/relations';
import { initialResearchBodies } from '../actors/researchBodies';
import { initialRival } from '../actors/rivals';
import { initialMarket } from '../compute/market';
import { initialCloud, initialOrders } from '../compute/orders';
import { initialPower } from '../compute/power';
import { initialSites } from '../compute/sites';
import { shareRefAt } from '../departments/split';
import { START_STAFF } from '../departments/staffing';
import { initialBoard } from '../finance/board';
import { initialCapital } from '../finance/investors';
import { initialFinance } from '../finance/ledger';
import { benchScore } from '../models/benchmarks';
import { domainsOf, levelOf } from '../models/capability';
import { initialParadigms } from '../models/paradigms';
import { neutralReadout } from '../production/placeholder';
import { initialSafetyDept } from '../safety/agendas';
import { initialSecurity } from '../security/security';
import { thresholds, referenceRate } from '../world/calibration';
import { drawLineageUModes, sampleHidden } from '../world/hidden';
import { initialWorld } from '../worldfx/sectors';
import type {
  Deployment, DomainId, EvalRecord, GameStateV2, MilestoneIdx, ModelVersion, PlayerLab, SetupV2, TimelineWorld, ToolFamily, TraitBelief, TraitId,
} from '../types';
import { emptySeries, sampleSeries } from './record';
import { seedStreams } from './rng';
import { SCHEMA_REV } from './save';
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
  return { suiteDay: day, bench, safety: {}, measuredL };
}

function buildPlayer(rng: Rng, s: Pick<GameStateV2, 'setup' | 'hidden'>, startDate: string): PlayerLab {
  const { setup, hidden } = s;
  const w = hidden.timeline;
  const base = BASELINES.find((b) => b.id === setup.baseline) ?? BASELINES[0];
  const pm0 = w.p0; // M0: pa(0) = pm(V0) = p0 (M1 solves pa(0) in closed form, §3.1.4)
  const staff = { ...START_STAFF[setup.baseline] };
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
    id: 'V0', name: `${PLAYER_MODEL_FAMILY}-1.0`, baseId: 'B0', day: -20, variant: 'full', design: { ...REFERENCE_POST },
    pm: pm0, Lg, domains, traitsTrue: { ...TRAIT_START }, masks, uModes, monitorability: 0.9, serveCost: 0.5,
    evals: startEvals(domains, Math.round(Lg * 100) / 100, -20), beliefs, status: 'deployed', flags: {},
  };
  const dep = (id: string, channel: Deployment['channel'], servingShare: number, kyc: Deployment['kyc']): Deployment => ({
    id, versionId: 'V0', channel, startDay: -20, priceIndex: 1, effort: 'max', servingShare,
    safeguards: channel === 'internal' ? 'standard' : 'classifiers', controlLayer: false, sectorFocus: [],
    usagePolicy: { noDropInReplacement: false, noSurveillance: false, noAutonomousWeapons: false, minorsProtections: channel === 'consumer' },
    kyc, status: 'live',
  });
  const rate0 = referenceRate(w, pm0, 2025.5);
  return {
    id: 'player', name: setup.companyName, kind: 'player', status: 'active',
    pa: pm0,
    computeOnline: setup.baseline === 'reality' ? 1.0e6 : 1.2e6,
    split: shareRefAt(2025.5),
    staff,
    tasteHire: 1,
    models: {
      bases: [{ id: 'B0', name: `${PLAYER_MODEL_FAMILY}-1`, day: -120, flop: 1e27, paAtStart: pm0, pc: 0, design: { ...REFERENCE_BASE, curation: { ...REFERENCE_BASE.curation } }, lineage, traitsTrue: { ...TRAIT_START }, uModes: [...uModes] }],
      versions: [V0],
      runs: [],
      internalAgent: 'V0',
      nextName: 1,
    },
    deployments: [dep('D1', 'consumer', 0.45, 0), dep('D2', 'api', 0.35, 1), dep('D3', 'enterprise', 0.2, 0), dep('D4', 'internal', 0, 0)],
    security: initialSecurity(staff, base.start.securityLevel),
    paradigms: initialParadigms(),
    prodCache: neutralReadout(w, pm0, rate0),
    milestoneDays: initialMilestones(w, pm0),
    finance: initialFinance(setup.baseline, setup.governance, startDate),
    board: initialBoard(setup.governance),
    sites: initialSites(setup.baseline, startDate),
    orders: initialOrders(setup.baseline),
    cloud: initialCloud(setup.baseline, startDate),
    safety: initialSafetyDept(),
    hiring: { target: { ...staff }, pipeline: [] },
    morale: { overall: 70, safety: 65 },
    dataAssets: { licensedTokensT: 30, unlicensedTokensT: 270, syntheticTokensT: 20, litigationRisk: (0.02 * 270) / 100 },
    policies: { whistleblowerChannel: false, publishSafety: 'selective', govBriefing: 1, shareWithAllies: false, transitionFund: 0, communityBenefits: false },
  };
}

export function newGame(setup: SetupV2): GameStateV2 {
  const startDate = START_DATE;
  const rngState = seedStreams(setup.seed);
  const worldRng = new Rng(rngState.world);
  const hidden = sampleHidden(worldRng, setup);
  const w = hidden.timeline;
  const base = BASELINES.find((b) => b.id === setup.baseline) ?? BASELINES[0];

  const player = buildPlayer(worldRng, { setup, hidden }, startDate);
  const pm0 = player.pa;
  const rivals = Array.from({ length: setup.rivalCount }, (_, i) => initialRival(worldRng, hidden, i, pm0, setup.baseline, base.start.globalCompute));
  const china = initialChina(worldRng, hidden, pm0, base.start.chinaGapYears);
  for (const r of [...rivals, china.lab]) {
    r.core.prodCache = neutralReadout(w, r.core.pa, referenceRate(w, r.core.pa, 2025.5));
    r.core.milestoneDays = initialMilestones(w, Math.max(r.internal.pm, r.publicModel?.pm ?? -Infinity));
  }
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
    relations: initialRelations(rivals.map((r) => r.core.id)),
    commitments: [],
    market: initialMarket(setup.baseline),
    power: initialPower(),
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
  sampleSeries(s);
  return s;
}
