// Control: holders, share classes, votes, the controller, the board's seats and the structure label
// (design/corp/CORPORATE.md §2–§3). Pure functions of the cap table and the charter; nothing here is stored. Not yet read
// by the board, charter or equity code (task C2 switches them).
import type { BoardSeat, GameStateV2 } from '../types';
import { isListed } from './equity';
import { PARENT_STANCE, SEAT_STANCE } from './board';

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

export function holdingsOf(s: GameStateV2): Holding[] {
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
export function controllerOf(s: GameStateV2): Holding | undefined {
  return holdingsOf(s).find((h) => h.votes > 0.5 && h.kind !== 'investors' && h.kind !== 'public');
}

const SEAT_KIND: Record<HolderKind, { kind: BoardSeat['kind']; name: string }> = {
  founders: { kind: 'founder', name: 'Founder director' },
  investors: { kind: 'financial', name: 'Investor' },
  partner: { kind: 'strategic', name: '' },
  public: { kind: 'independent', name: 'Independent' },
  mission: { kind: 'mission', name: 'Mission board' },
  government: { kind: 'gov', name: 'Oversight committee' },
};

/** The CEO's seat, 6 elected seats by largest remainder over votes, 2 government directors under a golden share, then extras. */
export function seatsOf(s: GameStateV2, extras: BoardSeat[] = []): BoardSeat[] {
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

export function structureLabel(s: GameStateV2): string {
  const c = controllerOf(s);
  const base = !c ? (isListed(s) ? 'Public company' : 'Board-run')
    : c.kind === 'government' ? 'Government-controlled'
    : c.kind === 'partner' ? `Division of ${c.id}`
    : c.kind === 'mission' ? 'Mission-controlled'
    : 'Founder-led';
  return isListed(s) && base !== 'Public company' ? `${base} · listed` : base;
}

export const overrideAvailable = (s: GameStateV2) => controllerOf(s)?.kind === 'founders';
export const missionPowers = (s: GameStateV2) => s.player.charter.missionBody && !s.player.charter.stateControl;
export const securityPowers = (s: GameStateV2) => s.player.charter.goldenShare || s.player.charter.stateControl;
export const ownerFunded = (s: GameStateV2) => { const k = controllerOf(s)?.kind; return k === 'partner' || k === 'government'; };

export function investorAppeal(s: GameStateV2): number {
  const { charter: c, finance: f } = s.player;
  return (c.missionBody ? CHARTER_APPEAL.mission : 1) * (c.profitCap ? CHARTER_APPEAL.profitCap : 1) * (f.dualClass ? CHARTER_APPEAL.dualClass : 1);
}
