// Save format, migrations, state hash (V2-SPEC §2.5). Owner: WS1.
import { ensureWs3 } from '../finance/ext';
import { keyOf, staffOf, teamsFromStaff } from '../departments/teams';
import type { GameStateV2, PlayerLab, StaffByRole, TeamHiring } from '../types';
import { hash32 } from './rng';

/** Bump on any breaking change to types.ts and add a migration from the previous rev. */
export const SCHEMA_REV = 5;
export const AUTOSAVE_KEY = 'ai27.v2.autosave';
export const SLOT_KEYS = ['ai27.v2.slot1', 'ai27.v2.slot2', 'ai27.v2.slot3'] as const;
/** v1 save key: the start screen offers "v1 save found: start new" (no migration). */
export const V1_SAVE_KEY = 'ai27.save.v1';
export const SAVE_BUDGET_BYTES = 1.5 * 1024 * 1024;

/** migrations[rev] upgrades a state at schemaRev = rev to rev + 1. */
export const migrations: Record<number, (s: Record<string, unknown>) => void> = {
  /** 1 → 2 (M2): WS3 `ws3` blocks became required fields of FinanceState, ChipMarket, PowerGrid, CapitalMarkets and
   *  Site; `GameStateV2.ws4` is optional and created lazily, so it needs nothing. */
  1: (raw) => ensureWs3(raw as unknown as GameStateV2),
  /** 2 → 3: the security compute pool is gone (its share moves to data generation); security, product and ops staff are gone. */
  2: (raw) => {
    const s = raw as unknown as GameStateV2;
    const cores = [s.player, s.china?.lab?.core, ...(s.rivals ?? []).map((r) => r.core)].filter(Boolean) as unknown as { split: Record<string, number>; staff: Record<string, number> }[];
    const fix = (o: Record<string, number> | undefined, drop: string[]) => { if (o) for (const k of drop) delete o[k]; };
    for (const c of cores) {
      c.split.synthetic = (c.split.synthetic ?? 0) + (c.split.security ?? 0);
      fix(c.split, ['security']);
      fix(c.staff, ['sec', 'prod', 'ops']);
    }
    const hiring = (s.player as unknown as { hiring?: { target?: Record<string, number>; pipeline?: { role: string }[] } }).hiring;
    fix(hiring?.target, ['sec', 'prod', 'ops']);
    if (hiring?.pipeline) hiring.pipeline = hiring.pipeline.filter((p) => p.role === 'cap' || p.role === 'saf');
  },
  /** 3 → 4 (restructure R1): setup gains the start type (every earlier game is the frontier-leader start) and the
   *  leader-lab flag (off). Later restructure milestones may reject pre-restructure saves instead (BUILD-PLAN D8). */
  3: (raw) => {
    const setup = (raw as { setup?: Record<string, unknown> }).setup;
    if (setup) {
      setup.start ??= 'leader';
      setup.leaderLab ??= false;
    }
  },
  /** 4 → 5 (restructure R3): staff become teams. Headcounts (plus people still in the old hiring pipeline) are cut into
   *  whole Strong teams in the reference split; keep-hiring targets come from the old headcount targets; star hires
   *  come from τ_h. The candidate list starts empty (the weekly tick fills it). */
  4: (raw) => {
    const s = raw as unknown as GameStateV2;
    s.rng.company ??= hash32(s.setup.seed, 'company');
    const p = s.player as unknown as Omit<PlayerLab, 'hiring'> & { hiring?: { target?: StaffByRole; pipeline?: { role: keyof StaffByRole; n: number }[] } | TeamHiring };
    if (Array.isArray(p.teams)) return;
    const old = (p.hiring ?? {}) as { target?: StaffByRole; pipeline?: { role: keyof StaffByRole; n: number }[] };
    const staff: StaffByRole = { cap: p.staff?.cap ?? 0, saf: p.staff?.saf ?? 0 };
    for (const e of old.pipeline ?? []) if (e.role === 'cap' || e.role === 'saf') staff[e.role] += e.n;
    const hiring: TeamHiring = { targets: { eng: 0, 're.cap': 0, 'sci.cap': 0, 're.saf': 0, 'sci.saf': 0 }, candidates: [], filling: [], nextId: 1 };
    p.teams = teamsFromStaff(hiring, staff);
    const tgt = teamsFromStaff({ nextId: 0 }, { cap: Math.max(staff.cap, old.target?.cap ?? 0), saf: Math.max(staff.saf, old.target?.saf ?? 0) });
    for (const t of tgt) hiring.targets[keyOf(t)]++;
    p.hiring = hiring;
    p.stars = Math.max(0, Math.round(((p.tasteHire ?? 1) - 1) / 0.05));
    p.staff = staffOf(p.teams);
  },
};

export function serialize(s: GameStateV2): string {
  return JSON.stringify(s);
}

export function deserialize(json: string): GameStateV2 {
  const raw = JSON.parse(json) as Record<string, unknown>;
  if (raw.version !== 2) throw new Error(`not a v2 save (version ${String(raw.version)})`);
  let rev = Number(raw.schemaRev ?? 0);
  if (rev > SCHEMA_REV) throw new Error(`save is from a newer build (schemaRev ${rev} > ${SCHEMA_REV})`);
  while (rev < SCHEMA_REV) {
    const m = migrations[rev];
    if (!m) throw new Error(`no migration from schemaRev ${rev}`);
    m(raw);
    rev++;
    raw.schemaRev = rev;
  }
  return raw as unknown as GameStateV2;
}

/** 64-bit (two FNV-1a 32 lanes) hex hash of the serialised state. Determinism tests compare these. */
export function hashString(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) ^ (h2 >>> 15);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function stateHash(s: GameStateV2): string {
  return hashString(serialize(s));
}
