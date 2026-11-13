// Research bodies: evalGov, evalIndep, academia (V2-SPEC §3.9.5). Owner: WS4.
import type { ResearchBodies } from '../types';

export function initialResearchBodies(): ResearchBodies {
  return {
    evalGov: { capacityPerQ: 2, publishPressure: 0.3, queue: [] },
    evalIndep: { capacityPerQ: 3, publishPressure: 0.6, queue: [] },
    academia: { pipeline: 100, publishLagDays: 180 },
    index: { grades: {} },
  };
}
