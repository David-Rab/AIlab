// Save format, migrations, state hash (V2-SPEC §2.5). Owner: WS1.
import type { GameStateV2 } from '../types';

/** Bump on any breaking change to types.ts and add a migration from the previous rev to `migrations`.
 *  Saves below MIN_SCHEMA_REV do not load: deserialize refuses them with OLD_SAVE_MESSAGE. UB-3 (DD-20, the clean save
 *  break at the end of the R&D engine work) set MIN_SCHEMA_REV = SCHEMA_REV = 103 and deleted every migration below it
 *  (33 → 34 … 102 → 103) with the helpers only they used; their history is in git before UB-3 and in V3-BUILD /
 *  BUILD-NOTES. Revs up to 103 are documented there.
 */
export const SCHEMA_REV = 105;
/** The oldest save that loads (DD-20, UB-3): a save below it is refused with OLD_SAVE_MESSAGE. */
export const MIN_SCHEMA_REV = 103;
/** What the player is told when a save is older than MIN_SCHEMA_REV. */
export const OLD_SAVE_MESSAGE = 'This save is from an older version of the game and can no longer be loaded.';
export const AUTOSAVE_KEY = 'ai27.v2.autosave';
export const SLOT_KEYS = ['ai27.v2.slot1', 'ai27.v2.slot2', 'ai27.v2.slot3'] as const;
/** v1 save key: the start screen offers "v1 save found: start new" (no migration). */
export const V1_SAVE_KEY = 'ai27.save.v1';
export const SAVE_BUDGET_BYTES = 1.5 * 1024 * 1024;

/** MK-1 (design/MARKET.md M1): the old channels' successors: Government and Trusted access → Vetted, Agents → API. */
const CHANNEL_MK1: Record<string, string> = { gov: 'vetted', trusted: 'vetted', agents: 'api' };

/** migrations[rev] upgrades a state at schemaRev = rev to rev + 1 (from MIN_SCHEMA_REV up). */
export const migrations: Record<number, (s: Record<string, unknown>) => void> = {
  /** 103 → 104 (MK-1): four products. A deployment on 'gov' or 'trusted' moves to 'vetted', on 'agents' to 'api'; a
   *  second product of the same channel is kept as it is (not merged). Launches waiting on the build queue (ref and
   *  launch.channel) move the same way. Nothing else in the state is keyed by channel. */
  103: (s) => {
    const p = s.player as { deployments?: { channel?: string }[]; build?: { queue?: { kind?: string; ref?: string; launch?: { channel?: string } }[] } } | undefined;
    for (const d of p?.deployments ?? []) if (d.channel && CHANNEL_MK1[d.channel]) d.channel = CHANNEL_MK1[d.channel];
    for (const it of p?.build?.queue ?? []) {
      if (it.kind !== 'launch') continue;
      if (it.ref && CHANNEL_MK1[it.ref]) it.ref = CHANNEL_MK1[it.ref];
      if (it.launch?.channel && CHANNEL_MK1[it.launch.channel]) it.launch.channel = CHANNEL_MK1[it.launch.channel];
    }
  },
  /** 104 → 105 (MK-3, design/MARKET.md M8): thinking effort removed. Every product serves as the old default 'max'
   *  (×1 reasoning tokens, +0 OOM), so the field is dropped from deployments and waiting launches; a product that was
   *  on 'low' or 'deep' now serves at max. */
  104: (s) => {
    const p = s.player as { deployments?: Record<string, unknown>[]; build?: { queue?: { launch?: Record<string, unknown> }[] } } | undefined;
    for (const d of p?.deployments ?? []) delete d.effort;
    for (const it of p?.build?.queue ?? []) if (it.launch) delete it.launch.effort;
  },
};

export function serialize(s: GameStateV2): string {
  return JSON.stringify(s);
}

export function deserialize(json: string): GameStateV2 {
  const raw = JSON.parse(json) as Record<string, unknown>;
  if (raw.version !== 2) throw new Error(`not a v2 save (version ${String(raw.version)})`);
  let rev = Number(raw.schemaRev ?? 0);
  if (!(rev >= MIN_SCHEMA_REV)) throw new Error(OLD_SAVE_MESSAGE);
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
