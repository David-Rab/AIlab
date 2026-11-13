// Benchmark scores and eval suites (V2-SPEC §3.3.4). Owner: WS1.
import type { BenchmarkDef } from '../../../data/v2/benchmarks';
import type { GameStateV2, SystemCtx } from '../types';

/** score = floor + (ceil − floor)·σ(kL·(L_d + elic + gap − mL)). */
export function benchScore(b: BenchmarkDef, Ld: number, elic = 0, gap = 0): number {
  return b.floor + (b.ceil - b.floor) / (1 + Math.exp(-b.kL * (Ld + elic + gap - b.mL)));
}

/** Run a full eval suite on a version (benchmarks + safety evals via WS2 detection). TODO(WS1, M1). */
export function runEvalSuite(_s: GameStateV2, _ctx: SystemCtx, _versionId: string): void {}
