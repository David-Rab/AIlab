// Control: holders, share classes, votes, the controller, the board's seats and the structure label
// (design/corp/CORPORATE.md §2–§3). Pure functions of the cap table and the charter; nothing here is stored. The board's
// seats (boardSeats), the override, the charter's powers and investor appeal all read these.
import type { StartDef } from '../../../data/v2/starts';
import type { BoardSeat, Charter, FinanceState, GameStateV2 } from '../types';

type Vec4 = [number, number, number, number];

/** Stance vectors (speed, fin, safety, mission) from R15 §1.6. The founder/CEO seat votes the player's way [D]. */
export const SEAT_STANCE: Record<BoardSeat['kind'], Vec4> = {
  founder: [1, 0.3, 0.2, 0.3],
  mission: [-0.5, 0.3, 1, 1],
  financial: [1, 0.6, -0.2, 0],
  strategic: [0.5, 0, 0, 0],
  independent: [0, 0.5, 0.3, 0.3],
  gov: [0.2, 0.3, 0.6, 0.4],
};

/** The controlling company's seats (research/18 §3.2): vote speed +0.5, finance +1.0, safety +0.2, mission 0 [Design]. */
export const PARENT_STANCE: Vec4 = [0.5, 1, 0.2, 0];

/** What the control rules read: the cap table, the share classes and the charter. A game state is one; so is a start's
 *  definition (startControl), which the setup screen labels before a game exists. */
export interface ControlView { player: { finance: Pick<FinanceState, 'ownership' | 'dualClass' | 'stratVoting'>; charter: Charter } }

export type ShareClass = 'common' | 'superVoting' | 'nonVoting' | 'mission' | 'state';
export type HolderKind = 'founders' | 'investors' | 'partner' | 'public' | 'mission' | 'government';

/** stake = economic share 0..1 (from ownership); votes = share of all votes 0..1. */
export interface Holding { id: string; kind: HolderKind; cls: ShareClass; stake: number; votes: number }

/** Votes by class (CORPORATE.md §2.1): a multiplier on stake, or a fixed share of all votes. */
export const CLASS_RULE: Record<ShareClass, { mult: number } | { fixed: number }> = {
  common: { mult: 1 },
  superVoting: { mult: 10 },
  nonVoting: { mult: 0 },
  mission: { fixed: 2 / 3 },
  state: { fixed: 2 / 3 },
};

/** Investor appeal factors of the charter (CORPORATE.md §2.4). */
export const CHARTER_APPEAL = { profitCap: 2 / 3, mission: 0.9, dualClass: 0.95 };

const ELECTED = 6;

type Draft = Omit<Holding, 'votes'>;

export function holdingsOf(s: ControlView): Holding[] {
  const { finance: f, charter: c } = s.player;
  const o = f.ownership;
  const missionCls: ShareClass = c.missionBody && !c.stateControl ? 'mission' : 'common';
  const list: Draft[] = [];
  const add = (id: string, kind: HolderKind, cls: ShareClass, stake: number) => { if (stake > 0) list.push({ id, kind, cls, stake }); };
  add('founders', 'founders', f.dualClass ? 'superVoting' : 'common', o.founder);
  add('investors', 'investors', 'common', o.fin);
  add('public', 'public', 'common', o.public);
  for (const [p, st] of Object.entries(o.strat)) add(p, 'partner', f.stratVoting?.[p] ? 'common' : 'nonVoting', st);
  add('mission', 'mission', missionCls, o.mission);
  if (c.stateControl) list.push({ id: 'government', kind: 'government', cls: 'state', stake: 0 });

  const fixedHolder = list.find((h) => h.cls === 'state') ?? list.find((h) => h.cls === 'mission');
  const fixedRule = fixedHolder ? CLASS_RULE[fixedHolder.cls] : undefined;
  const F = fixedRule && 'fixed' in fixedRule ? fixedRule.fixed : 0;
  const weight = (h: Draft) => { const r = CLASS_RULE[h.cls]; return 'mult' in r ? h.stake * r.mult : 0; };
  const total = list.reduce((a, h) => a + weight(h), 0);
  return list.map((h) => {
    const votes = h === fixedHolder ? (total > 0 ? F : 1) : total > 0 ? ((1 - F) * weight(h)) / total : 0;
    return { ...h, votes };
  });
}

/** The holder with more than half of all votes; investors and the public are crowds, never one controller. */
export function controllerOf(s: ControlView): Holding | undefined {
  return holdingsOf(s).find((h) => h.votes > 0.5 && h.kind !== 'investors' && h.kind !== 'public');
}

/** The share of all votes `holder` holds on this cap table (0 when it holds none). */
export const votesOf = (s: ControlView, holder: string): number => holdingsOf(s).find((h) => h.id === holder)?.votes ?? 0;

/** The votes one new holder of `stake` of the company would hold (common shares issued now, diluting everyone): how a
 *  block of stock paid in a merger is judged (CORPORATE.md §4: every path is judged at the votes it reaches). */
export function newHolderVotes(s: ControlView, stake: number): number {
  const f = s.player.finance;
  const o = f.ownership;
  const k = 1 - stake;
  const B = '\u0000block';
  const strat = Object.fromEntries(Object.entries(o.strat).map(([n, x]) => [n, x * k]));
  const ownership = { founder: o.founder * k, mission: o.mission * k, fin: o.fin * k, public: o.public * k, strat: { ...strat, [B]: stake } };
  return votesOf({ player: { finance: { ownership, dualClass: f.dualClass, stratVoting: { ...(f.stratVoting ?? {}), [B]: true } }, charter: s.player.charter } }, B);
}

/** A holder's name in a sentence ("Azimuth now controls …"). */
export const holderName = (h: Pick<Holding, 'id' | 'kind'>): string =>
  h.kind === 'founders' ? 'Your founders' : h.kind === 'mission' ? 'The mission body' : h.kind === 'government' ? 'The government' : h.id;

const SEAT_KIND: Record<HolderKind, { kind: BoardSeat['kind']; name: string }> = {
  founders: { kind: 'founder', name: 'Founder director' },
  investors: { kind: 'financial', name: 'Investor' },
  partner: { kind: 'strategic', name: '' },
  public: { kind: 'independent', name: 'Independent' },
  mission: { kind: 'mission', name: 'Mission board' },
  government: { kind: 'gov', name: 'Oversight committee' },
};

/** The CEO's seat, 6 elected seats by largest remainder over votes, 2 government directors under a golden share, then extras. */
export function seatsOf(s: ControlView, extras: BoardSeat[] = []): BoardSeat[] {
  const holds = holdingsOf(s).filter((h) => h.votes > 0);
  const controller = controllerOf(s);
  const quota = holds.map((h) => {
    const n = Math.floor(h.votes * ELECTED + 1e-9);
    return { h, n, rem: h.votes * ELECTED - n };
  });
  let left = ELECTED - quota.reduce((a, q) => a + q.n, 0);
  const order = [...quota].sort((a, b) => b.rem - a.rem || b.h.votes - a.h.votes || (a.h.id < b.h.id ? -1 : 1));
  for (const q of order) { if (left <= 0) break; q.n++; left--; }
  const seats: BoardSeat[] = [{ kind: 'founder', holder: 'CEO', stance: [...SEAT_STANCE.founder], weight: 1 }];
  for (const { h, n } of quota) {
    const k = SEAT_KIND[h.kind];
    for (let i = 1; i <= n; i++) {
      const stance = h.kind === 'partner' && controller?.id === h.id ? PARENT_STANCE : SEAT_STANCE[k.kind];
      seats.push({ kind: k.kind, holder: h.kind === 'partner' ? h.id : `${k.name} ${i}`, stance: [...stance], weight: 1 });
    }
  }
  if (s.player.charter.goldenShare) {
    for (let i = 1; i <= 2; i++) seats.push({ kind: 'gov', holder: `Government director ${i}`, stance: [...SEAT_STANCE.gov], weight: 1 });
  }
  return [...seats, ...extras];
}

/** The board now: the seats by votes, then the critics' seats (board.extraSeats). */
export const boardSeats = (s: GameStateV2): BoardSeat[] => seatsOf(s, s.player.board.extraSeats);

const isListed = (s: ControlView) => s.player.finance.ownership.public > 0;

export function structureLabel(s: ControlView): string {
  const c = controllerOf(s);
  const base = !c ? (isListed(s) ? 'Public company' : 'Board-run')
    : c.kind === 'government' ? 'Government-controlled'
    : c.kind === 'partner' ? `Division of ${c.id}`
    : c.kind === 'mission' ? 'Mission-controlled'
    : 'Founder-led';
  return isListed(s) && base !== 'Public company' ? `${base} · listed` : base;
}

export const overrideAvailable = (s: ControlView) => controllerOf(s)?.kind === 'founders';
export const missionPowers = (s: ControlView) => s.player.charter.missionBody && !s.player.charter.stateControl;
export const securityPowers = (s: ControlView) => s.player.charter.goldenShare || s.player.charter.stateControl;
/** A corporate owner or the government controls the company and funds it through a budget (§3.2). It may take control
 *  mid-game (finance/parent.ts controlCheck starts the budget). */
export const ownerFunded = (s: ControlView) => { const k = controllerOf(s)?.kind; return k === 'partner' || k === 'government'; };

/** Investor appeal of a charter (§2.4): a product of its features. Rivals use it on their kind's charter. */
export function appealOf(c: { missionBody?: boolean; profitCap?: boolean; dualClass?: boolean }): number {
  return (c.missionBody ? CHARTER_APPEAL.mission : 1) * (c.profitCap ? CHARTER_APPEAL.profitCap : 1) * (c.dualClass ? CHARTER_APPEAL.dualClass : 1);
}

export const investorAppeal = (s: ControlView): number => appealOf({ ...s.player.charter, dualClass: s.player.finance.dualClass });

/** The charter a start begins with (StartDef.charter). */
export const startCharter = (def: StartDef): Charter => ({ missionBody: !!def.charter.missionBody, profitCap: !!def.charter.profitCap, goldenShare: false, stateControl: false });

/** A start's cap table and charter as the control rules read them (the setup screen's label, the start builders). */
export const startControl = (def: StartDef): ControlView => ({
  player: {
    finance: { ownership: { founder: def.ownership.founder, mission: def.ownership.mission ?? 0, fin: def.ownership.fin, strat: { ...(def.ownership.strat ?? {}) }, public: 0 }, ...(def.ownership.stratVoting ? { stratVoting: { ...def.ownership.stratVoting } } : {}) },
    charter: startCharter(def),
  },
});
