// WS4 working state (relations memory, timers, cover-ups, ladder bookkeeping). Owner: WS4.
//
// Ws4State lives in types.ts (`GameStateV2.ws4`, folded at M2). Created lazily by `ws4(s)`; plain JSON.
import type { Day, Ws4State } from '../types';

export type { Coverup, RivalIncident, Ws4State } from '../types';

export function initialWs4(): Ws4State {
  return {
    govSeenL: 0, leakedL: 0, evalL: 0, claimedL: 0,
    coverups: [], redFlags: 0, theftAttempts: 0,
    frontierPauseUntil: -1,
    overtakenDays: {},
    taiwanDisrupted: false, taiwanUntil: -1,
    accessCap: { exec: 1, evalGov: 1 },
    actionDay: {},
    postureDelta: {},
    goalposts: {},
    rivalIncidents: [],
    nextPost: {},
    internalDay: {},
    spyMult: 1,
    distillDays: 0,
    crunchDays: 0,
    misalignmentLeak: false,
    lastTheftOrCyberDay: 0,
    usProposedTalks: false,
    treatyRejected: false,
    dpaAccepted: false,
    nationalizedHard: false,
    soldControl: false,
    retired: false,
    unrestrictedDefense: false,
    defenseContract: 'none',
    disclosed: 0, leaked: 0, papers: 0,
    gdp0: 0,
    drift: {},
    evalReports: [], reportedVersions: [],
    chinaLeadHist: [],
    absorbedCompute: 0,
    storyNoise: 1,
    requests: [],
  };
}

/** Ask the director to raise decision `id` (deduplicated against open requests and pending decisions). */
export function request(s: { ws4?: Ws4State; time: { day: Day }; events: { pending: { id: string; data: Record<string, number | string> }[] } }, id: string, data: Record<string, number | string> = {}) {
  const w = ws4(s);
  const same = (d: Record<string, number | string>) => JSON.stringify(d) === JSON.stringify(data);
  if (w.requests.some((r) => r.id === id && same(r.data)) || s.events.pending.some((p) => p.id === id && same(p.data))) return;
  w.requests.push({ id, day: s.time.day, data });
}

/** WS4 state accessor (creates the block on first use). Use only where mutation is allowed (systems, apply). */
export function ws4(s: { ws4?: Ws4State }): Ws4State {
  return (s.ws4 ??= initialWs4());
}

const EMPTY: Ws4State = initialWs4();
/** Read-only view for selectors and previews (never creates the block). */
export function ws4r(s: { ws4?: Ws4State }): Readonly<Ws4State> {
  return s.ws4 ?? EMPTY;
}
