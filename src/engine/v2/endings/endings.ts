// End conditions (V2-SPEC §5.1). Owner: WS4.
import type { EngineSystem } from '../types';

/** endings (150, daily): Check end conditions in §5.1 order; set s.ending. TODO(WS4, M1). */
export const endingsSystem: EngineSystem = {
  id: 'endings', owner: 'WS4', cadence: 'daily', order: 150,
  run() {},
};
