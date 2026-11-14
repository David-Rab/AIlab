// World technologies W01–W29 (= research/16 T1–T29, §3.2). Owner: WS5.
// Gates, prerequisites, Effort (world-research-years at S = 1) and Lag (years to broad impact) are research/16's [D]
// values; evidence per tech is in research/16 §3.2 and N6. Effect magnitudes are [D] ("+0.2 to +2 pp each at full
// ramp" for g_tech, research/16 §4.2).
import type { DomainId } from '../../engine/v2/types';

export type TechRisk = 'bio' | 'cyber' | 'war' | 'persuasion' | 'crypto' | 'nano' | 'power';

export interface TechEffects {
  /** GDP growth (fraction/yr) at full ramp (g_tech). */
  g?: number;
  /** Experiment capacity for world science (ExpCap). */
  expCap?: number;
  /** Multiplier on SCI-sector Bass q (science tools). */
  sciQ?: number;
  /** Energy price change at full ramp (fraction). */
  energy?: number;
  /** World PHYS model level floor at full ramp (general robotics). */
  physFloor?: number;
  /** Extra PHYS level in LOG (autonomous vehicles). */
  logPhys?: number;
  /** Public benefit (approval points per year at full ramp, fed to WS4 via the cause ledger). */
  benefit?: number;
  /** Compute-efficiency multiplier for all labs (WS1 reads worldTechEffects). */
  computeEff?: number;
  /** Persuasion multiplier (INFO channel). */
  persuasion?: number;
  /** MIL control penetration added at full ramp. */
  milP?: number;
  /** INFRA cyber-defense penetration added at full ramp. */
  infraP?: number;
}

export interface WorldTechDef {
  id: string;
  /** research/16 T-number. */
  r16: string;
  name: string;
  /** Short headline on discovery (H16; tech headlines name the technology, no canon dates). */
  headline: string;
  /** progress 0..1 at Jul 2025 (1 = discovered). research/16: T1, T2 discovered; T3, T10, T22, T24, T25 0.3–0.6. */
  start: number;
  /** Minimum domain levels of the best accessible model. */
  gates: Partial<Record<DomainId, number>>;
  prereqs: string[];
  /** Extra non-model condition: a government SEZ policy, or published safety findings. */
  needs?: 'sez' | 'findings';
  effort: number;
  lag: number;
  /** Lag compression channel: FDA fast-track/in-silico trials (health) or SEZs (physical goods). */
  lagChannel?: 'health' | 'physical';
  effects: TechEffects;
  risk?: TechRisk;
}

export const WORLD_TECHS: WorldTechDef[] = [
  { id: 'W01', r16: 'T1', name: 'Protein structure and design', headline: 'AI protein design becomes a standard lab tool', start: 1, gates: {}, prereqs: [], effort: 1, lag: 0, effects: { sciQ: 0.1 }, risk: 'bio' },
  { id: 'W02', r16: 'T2', name: 'ML weather forecasting', headline: 'AI forecasts beat the best weather models', start: 1, gates: {}, prereqs: [], effort: 1, lag: 0, effects: { g: 0.0005, benefit: 1 } },
  { id: 'W03', r16: 'T3', name: 'AI drug-candidate pipeline', headline: 'AI-designed drug clears Phase II', start: 0.5, gates: { REASON: 7, BIO: 6 }, prereqs: ['W01'], effort: 3, lag: 6, lagChannel: 'health', effects: { g: 0.002, benefit: 3 } },
  { id: 'W04', r16: 'T4', name: 'Autonomous labs', headline: 'Self-driving lab runs a year of experiments in a month', start: 0, gates: { AGENCY: 8, PHYS: 4 }, prereqs: [], effort: 3, lag: 2, effects: { expCap: 0.3, sciQ: 0.2 } },
  { id: 'W05', r16: 'T5', name: 'In-silico trials', headline: 'Regulator accepts AI-run trial evidence', start: 0, gates: { REASON: 10 }, prereqs: ['W03'], effort: 2, lag: 3, lagChannel: 'health', effects: { benefit: 1 } },
  { id: 'W06', r16: 'T6', name: 'New antibiotics and antivirals', headline: 'AI-designed antibiotic clears Phase I', start: 0, gates: { BIO: 8 }, prereqs: ['W03'], effort: 2, lag: 4, lagChannel: 'health', effects: { g: 0.001, benefit: 4 } },
  { id: 'W07', r16: 'T7', name: 'Cancer therapeutics wave', headline: 'Wave of AI-designed cancer drugs enters trials', start: 0, gates: { REASON: 11, BIO: 10 }, prereqs: ['W03', 'W04'], effort: 6, lag: 5, lagChannel: 'health', effects: { g: 0.005, benefit: 10 } },
  { id: 'W08', r16: 'T8', name: 'Precision gene editing', headline: 'AI-designed gene edit cures a rare disease', start: 0, gates: { BIO: 10 }, prereqs: ['W01'], effort: 5, lag: 5, lagChannel: 'health', effects: { g: 0.002, benefit: 4 }, risk: 'bio' },
  { id: 'W09', r16: 'T9', name: 'Longevity interventions', headline: 'First drug shown to slow human aging', start: 0, gates: { REASON: 13, BIO: 12 }, prereqs: ['W07', 'W08'], effort: 15, lag: 8, lagChannel: 'health', effects: { g: 0.01, benefit: 15 } },
  { id: 'W10', r16: 'T10', name: 'Materials discovery engine', headline: 'AI finds a new class of battery materials', start: 0.4, gates: { REASON: 8 }, prereqs: ['W04'], effort: 2, lag: 3, lagChannel: 'physical', effects: { g: 0.001 } },
  { id: 'W11', r16: 'T11', name: 'Grid-scale storage', headline: 'Grid batteries undercut gas peakers', start: 0, gates: {}, prereqs: ['W10'], effort: 3, lag: 4, lagChannel: 'physical', effects: { g: 0.002, energy: -0.1 } },
  { id: 'W12', r16: 'T12', name: 'Fusion', headline: 'Tokamak hits record with AI control', start: 0, gates: { REASON: 12, PHYS: 6 }, prereqs: ['W10'], effort: 10, lag: 5, lagChannel: 'physical', effects: { g: 0.01, energy: -0.3, benefit: 5 } },
  { id: 'W13', r16: 'T13', name: 'Cheap solar / geothermal', headline: 'Solar tiles go up at robot speed', start: 0, gates: {}, prereqs: ['W10', 'W17'], effort: 3, lag: 2, lagChannel: 'physical', effects: { g: 0.003, energy: -0.15 } },
  { id: 'W14', r16: 'T14', name: 'AI chip-design automation', headline: 'AI designs its own next chip', start: 0, gates: { CODE: 9, REASON: 9 }, prereqs: [], effort: 2, lag: 1.5, effects: { computeEff: 0.2 }, risk: 'power' },
  { id: 'W15', r16: 'T15', name: 'Fault-tolerant quantum computing', headline: 'Fault-tolerant quantum computer runs', start: 0, gates: { REASON: 12 }, prereqs: ['W10'], effort: 8, lag: 4, effects: { g: 0.003, sciQ: 0.1 }, risk: 'crypto' },
  { id: 'W16', r16: 'T16', name: 'General-purpose robotics', headline: 'Robot passes the Coffee Test', start: 0, gates: { REASON: 11, AGENCY: 10 }, prereqs: [], effort: 4, lag: 1, effects: { physFloor: 10 } },
  { id: 'W17', r16: 'T17', name: 'Self-replicating factories', headline: 'Robot factories start building robot factories', start: 0, gates: {}, prereqs: ['W16'], needs: 'sez', effort: 2, lag: 0, effects: { g: 0.005 }, risk: 'power' },
  { id: 'W18', r16: 'T18', name: 'Molecular nanotechnology', headline: 'Molecular assembler demonstrated', start: 0, gates: { REASON: 15 }, prereqs: ['W10', 'W17'], effort: 20, lag: 3, lagChannel: 'physical', effects: { g: 0.01 }, risk: 'nano' },
  { id: 'W19', r16: 'T19', name: 'Autonomous vehicles at scale', headline: 'Driverless trucks cleared for every interstate', start: 0, gates: { MEDIA: 8, AGENCY: 8 }, prereqs: [], effort: 2, lag: 3, lagChannel: 'physical', effects: { logPhys: 3, g: 0.002 } },
  { id: 'W20', r16: 'T20', name: 'Whole-brain emulation', headline: 'Whole mouse brain mapped by AI proofreaders', start: 0, gates: { REASON: 13 }, prereqs: ['W04'], effort: 12, lag: 5, effects: { sciQ: 0.1 } },
  { id: 'W21', r16: 'T21', name: 'Brain–computer interfaces', headline: 'Paralysed patients type at speaking speed', start: 0, gates: { BIO: 10, PHYS: 7 }, prereqs: [], effort: 6, lag: 4, lagChannel: 'health', effects: { benefit: 3 } },
  { id: 'W22', r16: 'T22', name: 'Automated mathematics', headline: 'AI proves a famous open conjecture', start: 0.6, gates: { REASON: 9 }, prereqs: [], effort: 1, lag: 0.5, effects: { sciQ: 0.1, benefit: 1 } },
  { id: 'W23', r16: 'T23', name: 'Superhuman persuasion', headline: 'Study: AI out-persuades the best human debaters', start: 0, gates: { SOCIAL: 12 }, prereqs: [], effort: 1, lag: 0, effects: { persuasion: 0.5 }, risk: 'persuasion' },
  { id: 'W24', r16: 'T24', name: 'Autonomous cyber offense/defense', headline: 'AI agents find and patch zero-days at scale', start: 0.4, gates: { CYBER: 8 }, prereqs: [], effort: 1, lag: 0.5, effects: { infraP: 0.1 }, risk: 'cyber' },
  { id: 'W25', r16: 'T25', name: 'Enhanced pathogen design', headline: 'Eval: models can guide virus enhancement', start: 0.3, gates: { BIO: 10 }, prereqs: [], effort: 2, lag: 0, effects: {}, risk: 'bio' },
  { id: 'W26', r16: 'T26', name: 'Autonomous weapons', headline: 'Drone swarms enter service', start: 0, gates: { PHYS: 6, AGENCY: 9 }, prereqs: ['W16'], effort: 2, lag: 1, effects: { milP: 0.15 }, risk: 'war' },
  { id: 'W27', r16: 'T27', name: 'Counter-second-strike', headline: 'Analysts warn deterrence is breaking down', start: 0, gates: { REASON: 13, PHYS: 8 }, prereqs: ['W26'], effort: 4, lag: 2, effects: {}, risk: 'war' },
  { id: 'W28', r16: 'T28', name: 'Verifiable AI / treaty verification', headline: 'AI lie detector passes independent tests', start: 0, gates: { REASON: 11 }, prereqs: [], needs: 'findings', effort: 3, lag: 0.5, effects: { benefit: 2 } },
  { id: 'W29', r16: 'T29', name: 'Space industrialization', headline: 'Robot-built rocket fleet launches weekly', start: 0, gates: {}, prereqs: ['W17', 'W12'], effort: 6, lag: 3, lagChannel: 'physical', effects: { g: 0.01 } },
];

export const TECH_BY_ID: Record<string, WorldTechDef> = Object.fromEntries(WORLD_TECHS.map((t) => [t.id, t]));
