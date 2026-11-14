// WS4 working state (relations memory, timers, cover-ups, ladder bookkeeping). Owner: WS4.
//
// ─── PROPOSED types.ts ADDITION (WS1 to merge) ───────────────────────────────────────────────────────────────
// types.ts is WS1-only, so this block is declared here by module augmentation instead of editing types.ts.
// It adds ONE optional, plain-JSON field `GameStateV2.ws4`, created lazily by `ws4(s)` on first use (so newGame
// in core/init.ts needs no change). Request to WS1: move `Ws4State` + `ws4?: Ws4State` into types.ts verbatim.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
import type { CounterpartyId, Day, LabId, SafetyPosture } from '../types';

/** A quiet fix that outsiders may still discover (§3.9.3 rule 1). */
export interface Coverup { id: string; day: Day; what: string; pDaily: number; audience: CounterpartyId[]; until: Day }

/** A rival/China incident made public (drives E31 and intel bands). */
export interface RivalIncident { lab: LabId; day: Day; severity: number; misuse: boolean }

export interface Ws4State {
  /** Level the government believes the player's frontier is at (§3.10.1: announced / leaked / evaluator-reported). */
  govSeenL: number;
  leakedL: number;
  evalL: number;
  /** Level the player has publicly claimed (best measured L of an external deployment). */
  claimedL: number;
  coverups: Coverup[];
  /** Continue-through-red-flag counter (E09/E17); feeds leaks and the Index. */
  redFlags: number;
  theftAttempts: number;
  /** Escaped copy of a player model (E25 / 'rogue' ending). */
  loose?: { day: Day; versionId: string; mis: number };
  /** Open internal whistleblower report (E18) and its fix-or-escalate deadline. */
  internalReport?: { day: Day; deadline: Day };
  /** Frontier runs paused until this day (E17 Pause, pauseIfRedline). WS1 reads it (cross-WS need). */
  frontierPauseUntil: Day;
  /** Consecutive days each competitor has led the player by ≥ 365 d after its SC (overtaken rule). */
  overtakenDays: Record<LabId, number>;
  taiwanDisrupted: boolean;
  taiwanUntil: Day;
  /** Per-counterparty access cap granted by specific agreements (§3.9.1 access rungs). */
  accessCap: Record<string, number>;
  /** Day an action was last used (cooldowns). */
  actionDay: Record<string, Day>;
  /** Dynamic posture changes on top of hidden postures (moving goalposts, joint evals). */
  postureDelta: Record<LabId, Partial<SafetyPosture>>;
  /** Moving-goalposts revisions per lab (Index penalty). */
  goalposts: Record<LabId, number>;
  rivalIncidents: RivalIncident[];
  /** Next post-training day per non-player lab. */
  nextPost: Record<LabId, Day>;
  /** Day the current internal model of a non-player lab was finished (release lag). */
  internalDay: Record<LabId, Day>;
  /** Spy multiplier after purges (recovers over a year). */
  spyMult: number;
  /** Days China/rival distillation inflow has exceeded the E06 threshold. */
  distillDays: number;
  /** Days demand exceeded capacity by > 30% (E36). */
  crunchDays: number;
  /** Misalignment evidence made public (P-LEAK / R14 / G-SEC 5). */
  misalignmentLeak: boolean;
  /** Days DA−track conditions held (D2 needs 180 quiet days). */
  lastTheftOrCyberDay: Day;
  usProposedTalks: boolean;
  treatyRejected: boolean;
  /** Player G-SEC 5b acceptance (DPA consolidation) — government-held lab. */
  dpaAccepted: boolean;
  nationalizedHard: boolean;
  soldControl: boolean;
  retired: boolean;
  /** Unrestricted surveillance / weapons contract signed (Freedom −10). */
  unrestrictedDefense: boolean;
  defenseContract: 'none' | 'limits' | 'unrestricted';
  /** Disclosure record for the Index: disclosed vs leaked/covered incidents and findings. */
  disclosed: number;
  leaked: number;
  papers: number;
  /** World GDP (US) at game start, for Prosperity. */
  gdp0: number;
  /** Rolling drift accumulator per meter key, flushed to the cause ledger weekly. */
  drift: Record<string, number>;
  /** Pending evaluator reports (versionId → day due) and the last reported version. */
  evalReports: { versionId: string; due: Day; by: 'evalGov' | 'evalIndep' }[];
  reportedVersions: string[];
  /** China gap history (lead days, weekly) for "widening"/"shrinking" rules. */
  chinaLeadHist: number[];
  /** Merged rival compute folded into the player by DPA / acquisition (WS3 should add to computeOnline). */
  absorbedCompute: number;
  /** Last day a crisis decision was queued (storyteller), and noise for the chaotic storyteller. */
  storyNoise: number;
  /** Event requests from WS4 systems; the director fires them under storyteller limits (E4). Expire after 60 d. */
  requests: { id: string; day: Day; data: Record<string, number | string> }[];
}

declare module '../types' {
  interface GameStateV2 {
    /** WS4 working state (see actors/state.ts). Created lazily; plain JSON. PROPOSED types.ts addition. */
    ws4?: Ws4State;
  }
}

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
