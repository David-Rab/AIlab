import { CHINA_PRESETS, GOV_PRESETS, LAB_ARCHETYPES, PUBLIC_PRESETS, RIVAL_NAMES } from '../data/actors';
import { TECHS } from '../data/techs';
import { TRAITS } from '../data/traits';
import { BASELINES, makeWorld, multiplierAt } from '../data/world';
import { Rng } from './rng';
import type { GameState, Lab, Setup, TraitState } from './types';

export const SAVE_VERSION = 1;

export function defaultSetup(): Setup {
  return {
    baseline: 'classic',
    world: 'sampled',
    alignment: 'sampled',
    gov: 'realistic',
    public: 'realistic',
    china: 'realistic',
    rivals: 'realistic',
    seed: Math.floor(Math.random() * 1e9),
    companyName: 'OpenBrain',
  };
}

function pickPreset<T extends { id: string; weight: number }>(rng: Rng, list: T[], choice: string): T {
  if (choice !== 'realistic') return list.find((p) => p.id === choice) ?? list[0];
  return rng.weighted(list.map((p) => ({ item: p, weight: p.weight })));
}

/** Starting hidden trait values for Agent-0: mild sycophancy and reward hacking, some SA. */
const START_TRAITS: Record<string, number> = {
  syc: 0.3, hack: 0.25, proxy: 0.1, sa: 0.2, evalaware: 0.05, conceal: 0.1, honest: 0.2, corrig: 0.35,
};

export function newGame(setup: Setup): GameState {
  const rng = new Rng(setup.seed);
  const base = BASELINES.find((b) => b.id === setup.baseline) ?? BASELINES[0];
  const world = makeWorld(rng, setup.world, setup.alignment, setup.baseline);
  const s = base.start;

  const traits: Record<string, TraitState> = {};
  for (const t of TRAITS) {
    const v = START_TRAITS[t.id] ?? 0;
    traits[t.id] = { value: v, mask: 0, est: v * t.visibility, sigma: 0.3 };
  }

  const techs: GameState['techs'] = {};
  for (const t of TECHS) {
    const done = t.cost === 0;
    techs[t.id] = { progress: done ? t.cost : 0, done, active: done, trainAgainst: false };
  }

  const gov = pickPreset(rng, GOV_PRESETS, setup.gov);
  const pub = pickPreset(rng, PUBLIC_PRESETS, setup.public);
  const china = pickPreset(rng, CHINA_PRESETS, setup.china);

  const labs: Lab[] = [];
  for (let i = 0; i < 3; i++) {
    const arch = pickPreset(rng, LAB_ARCHETYPES, setup.rivals);
    // Reality: the frontier is shared by ~3 labs within 0-2 months (research/09).
    const gap = rng.range(arch.gapYears[0], arch.gapYears[1]) * (setup.baseline === 'reality' ? 0.3 : 1);
    labs.push({
      id: `lab${i}`,
      name: RIVAL_NAMES[i],
      archetype: arch.id,
      p: -gap,
      computeShare: (0.06 + rng.range(-0.015, 0.02)) * arch.computeMult,
      safety: arch.safety,
      openness: arch.openness,
      cooperation: 20,
      lobby: arch.lobby,
      absorbed: false,
    });
  }

  const startP = 0;
  return {
    version: SAVE_VERSION,
    setup,
    world,
    rng: rng.state,
    day: 0,
    startDate: base.startDate,
    p: startP,
    rdMult: multiplierAt(world, 0),
    milestoneDays: { 0: 0 },
    allocation: { capabilities: 0.62, alignment: 0.02, product: 0.32, security: 0.04 },
    staffSplit: { capabilities: 0.82, alignment: 0.1, security: 0.08 },
    policies: {
      govBriefing: 1,
      lobbying: 0,
      prPerMonth: 0.1,
      militaryWork: false,
      openWeightsOld: false,
      whistleblowerProtection: false,
      neuralese: false,
      shareWithAllies: false,
      siloing: 0,
      hiringPerMonth: 60,
      expansion: 2,
    },
    company: {
      name: setup.companyName,
      cash: s.cash,
      revenueRun: s.revenueRun,
      valuation: s.valuation,
      compute: s.compute,
      pipeline: [
        { day: 60, amount: 250000 },
        { day: 150, amount: 350000 },
      ],
      staff: s.staff,
      safetyMorale: 65,
      boardConfidence: 70,
      lastRaiseDay: -120,
      securityLevel: s.securityLevel,
      privileged: Math.round(s.staff * 0.4),
    },
    model: { name: 'Agent-0', milestone: 0, publicP: startP, publicName: 'Agent-0', traits },
    techs,
    researchQueue: ['spec', 'honeypots'],
    labs,
    china: {
      preset: china.id,
      p: -s.chinaGapYears,
      computeShare: s.chinaShare,
      centralization: 0,
      rung: 0,
      espionage: 30,
      taiwan: 35,
      diplomacy: 45,
      safety: 25,
      openWeights: 85,
      stoleWeights: false,
      theftAttempts: 0,
      spies: 3,
      hawk: china.hawk,
    },
    gov: {
      preset: gov.id,
      priority: 55,
      regStance: -60,
      securityDemand: 15,
      trust: 55,
      hawkish: 50,
      nationalization: 0,
      rung: 0,
      chinaRung: 0,
      awareness: 30,
      congress: 20,
      oversight: false,
      dpaOffered: false,
      treatyTalks: false,
      treaty: false,
    },
    pub: {
      preset: pub.id,
      concern: s.concern,
      approval: s.approval,
      jobAnxiety: s.jobAnxiety,
      xrisk: s.xrisk,
      salience: 1,
      activism: 8,
      rung: 0,
      unemploymentShock: 0,
    },
    log: [
      { day: 0, kind: 'news', text: 'Stumbling agents: first computer-use assistants hit the market. Adoption is slow.', canon: 'Mid 2025' },
    ],
    events: [],
    firedEvents: {},
    flags: {},
    series: { day: [], pOB: [], pChina: [], pRival: [], cash: [], revenue: [], approval: [], mult: [], misalignEst: [] },
  };
}
