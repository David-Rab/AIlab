// China's NPC lab (DeepCent): its start and its compute (V2-SPEC §3.10.4; research/10; design/npc/NPC-LABS.md §8).
// Owner: WS4. China the government is rebuilt in W6; until then China is just its lab.
import type { ChinaActor, GameStateV2, HiddenWorld, SetupV2 } from '../types';
import { START_DATE } from '../core/time';
import { chinaCast, initialNpcLab } from './lab';

/** China's accessible compute at the start (H100e, Jul 2025; research/10 §1.1). */
export const CHINA_COMPUTE_START = 1.5e6;
/** China's national AI-team centralisation 0..100. W1d stand-in until W6 (which sets it from China's tension): fixed at
 *  0, so DeepCent's AGI share stays at 0.4. */
const CENTRALIZATION = 0;

/** DeepCent's compute (H100e): China's accessible compute × its AGI share (AI 2027 compute forecast: 40% → 90% as the
 *  collective centralizes, research/11 #16) × the R&D share 0.6. CP3k: the start uses the same rule. */
export const deepCentCompute = (computeAbs: number, centralization = CENTRALIZATION) => computeAbs * (0.4 + 0.5 * Math.min(1, centralization / 75)) * 0.6;

/** China at Jul 2025. N2b-1: its lab is the Realistic cast's NPC lab of kind `china` (npc/lab.ts): its start lag from
 *  the cast, its compute from deepCentCompute. `i`/`n`: its place among the NPC labs (release days staggered). */
export function initialChina(h: HiddenWorld, setup: SetupV2, i: number, n: number): ChinaActor {
  const lab = initialNpcLab({ setup, hidden: h, time: { day: 0, startDate: START_DATE, speed: 0 } }, chinaCast(), i, n, deepCentCompute(CHINA_COMPUTE_START), { cash: 30, revenueRun: 1, valuation: 0, raised: 0 });
  lab.core.staff = { cap: 1500, saf: 60 }; // today's (research/10); not from compute
  return { lab, computeAbs: CHINA_COMPUTE_START };
}

/** China's compute, daily: ≈ ×2 a year (IFP), slower under strict export policy, faster if open; DeepCent gets its
 *  share (deepCentCompute). */
export function chinaComputeDaily(s: GameStateV2) {
  const g = Math.pow(2, 1 / 365) - 1;
  const exportF = s.market.exportPolicy === 'strict' ? 0.8 : s.market.exportPolicy === 'open' ? 1.1 : 1;
  s.china.computeAbs *= 1 + g * exportF;
  s.china.lab.core.computeOnline = deepCentCompute(s.china.computeAbs);
}
