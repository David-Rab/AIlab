// Save format, migrations, state hash (V2-SPEC §2.5). Owner: WS1.
import type { GameStateV2 } from '../types';
import { PRODUCT_TOOL_BY_ID, TOOL_FROM_FEATURE, harnessForAdaptation, needsCert, toolsAtStart, type LabArchetype, type ProductToolId } from '../../../data/v2/tools';
import type { FeatureId } from '../../../data/v2/features';

/** Bump on any breaking change to types.ts and add a migration from the previous rev to `migrations`.
 *  Saves below MIN_SCHEMA_REV do not load: deserialize refuses them with OLD_SAVE_MESSAGE. UB-3 (DD-20, the clean save
 *  break at the end of the R&D engine work) set MIN_SCHEMA_REV = SCHEMA_REV = 103 and deleted every migration below it
 *  (33 → 34 … 102 → 103) with the helpers only they used; their history is in git before UB-3 and in V3-BUILD /
 *  BUILD-NOTES. Revs up to 103 are documented there.
 */
export const SCHEMA_REV = 107;
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
    const p = s.player as { deployments?: { channel?: string; wasAgents?: boolean }[]; build?: { queue?: { kind?: string; ref?: string; launch?: { channel?: string } }[] } } | undefined;
    for (const d of p?.deployments ?? []) {
      if (d.channel === 'agents') d.wasAgents = true; // read and removed by 106 → 107 (MK-11: Agent mode)
      if (d.channel && CHANNEL_MK1[d.channel]) d.channel = CHANNEL_MK1[d.channel];
    }
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
  /** 105 → 106 (MK-6, design/MARKET.md M5, M6): price tiers removed. Every product and waiting launch takes the 'profit'
   *  stance (price and priceIndex dropped); the sellers' margins (world.fx.priceM) start at today's cost-plus prices
   *  when first read (SEED_MARKUP) and move to their Nash–Bertrand targets. */
  105: (s) => {
    const p = s.player as { deployments?: Record<string, unknown>[]; build?: { queue?: { launch?: Record<string, unknown> }[] } } | undefined;
    for (const d of p?.deployments ?? []) {
      delete d.price;
      delete d.priceIndex;
      d.stance = 'profit';
    }
    for (const it of p?.build?.queue ?? []) if (it.launch) {
      delete it.launch.price;
      it.launch.stance = 'profit';
    }
  },
  /** 106 → 107 (MK-11, design/MARKET.md M9, M14): product features and sector adaptations become the product tools of
   *  data/v2/tools.ts.
   *  - Built features → built tools (TOOL_FROM_FEATURE: codingAgent → Coding harness, deepResearch → Research agent,
   *    memory / computerUse / voiceVision / companion the same id); a queued feature build's ref the same way.
   *  - A product's feature list → its tools; a tool its channel does not offer is dropped: Voice & vision on API,
   *    Enterprise or Vetted (designer: Chat only; its media work is Creative studio's, which is not granted).
   *  - Each sector adaptation → the harness covering its sector on that product's channel (harnessForAdaptation),
   *    switched on and built; a certification record (certDone) moves to Deployment.certs for that sector. Dropped where
   *    no harness the channel can carry covers the sector: on the API every sector but Software, Science,
   *    Finance, Legal and Media (Back-office, Clinical, Operations and Defence harnesses are not offered there), Military
   *    on Enterprise (the Defence suite is Vetted-only), Media on Vetted (Creative studio is not offered there). Its progress is lost with it (a later harness starts a new certification). A queued
   *    adaptation build is dropped (its host's harness is the build now).
   *  - Agent mode (lead decision: keep a save's income, since before MK-11 every business product sold agent-hours):
   *    switched on for every live API, Enterprise and Vetted product and for a product that was an Agents product (MK-1
   *    moved it to the API; marked `wasAgents` by 103 → 104), and built for the lab when any gets it; if Agent mode is
   *    new in the game, the rival lag rule counts from the earliest such product's launch.
   *  - Rivals and China: their tools mapped the same way, plus the tools their lab had shipped by the start
   *    (toolsAtStart); world.fx.toolShip keys mapped. */
  106: (s) => {
    type Dep = { channel?: string; status?: string; startDay?: number; features?: string[]; adaptations?: { sector: string; certDone?: number }[]; certs?: { sector: string; certDone: number }[]; wasAgents?: boolean };
    const p = s.player as { features?: string[]; deployments?: Dep[]; build?: { queue?: { kind?: string; ref?: string }[] } } | undefined;
    const map = (id: string): string => TOOL_FROM_FEATURE[id as FeatureId] ?? id;
    const known = (id: string) => !!PRODUCT_TOOL_BY_ID[id as ProductToolId];
    const offered = (id: string, ch?: string) => !!ch && (PRODUCT_TOOL_BY_ID[id as ProductToolId]?.products as string[] | undefined)?.includes(ch);
    if (!p) return;
    const built = new Set((p.features ?? []).map(map).filter(known));
    let agentsShip: number | undefined;
    for (const d of p.deployments ?? []) {
      const feats = new Set((d.features ?? []).map(map).filter((id) => known(id) && offered(id, d.channel)));
      const certs: { sector: string; certDone: number }[] = [];
      for (const a of d.adaptations ?? []) {
        const h = harnessForAdaptation(a.sector as never, d.channel as never);
        if (!h) continue;
        feats.add(h);
        built.add(h);
        if (needsCert(a.sector as never) && a.certDone !== undefined && !certs.some((c) => c.sector === a.sector)) certs.push({ sector: a.sector, certDone: a.certDone });
      }
      const liveBiz = (d.channel === 'api' || d.channel === 'enterprise' || d.channel === 'vetted') && d.status !== 'withdrawn';
      if (d.wasAgents || liveBiz) {
        feats.add('agentMode');
        built.add('agentMode');
        if (d.startDay !== undefined) agentsShip = Math.min(agentsShip ?? Infinity, d.startDay);
      }
      delete d.wasAgents;
      delete d.adaptations;
      d.certs = certs;
      d.features = [...feats];
    }
    p.features = [...built];
    if (p.build?.queue) {
      p.build.queue = p.build.queue.filter((it) => it.kind !== 'adaptation');
      for (const it of p.build.queue) if (it.kind === 'feature' && it.ref) it.ref = map(it.ref);
    }
    const labs = [...((s.rivals as { archetype?: string; tools?: string[] }[] | undefined) ?? []), (s.china as { lab?: { archetype?: string; tools?: string[] } } | undefined)?.lab].filter((x) => !!x) as { archetype?: string; tools?: string[] }[];
    for (const r of labs) r.tools = [...new Set([...toolsAtStart((r.archetype ?? 'upstart') as LabArchetype), ...(r.tools ?? []).map(map).filter(known)])];
    const fx = (s.world as { fx?: { toolShip?: Record<string, number> } } | undefined)?.fx;
    if (fx?.toolShip) fx.toolShip = Object.fromEntries(Object.entries(fx.toolShip).map(([k, v]) => [map(k), v]));
    if (fx && agentsShip !== undefined && Number.isFinite(agentsShip) && !labs.some((r) => toolsAtStart((r.archetype ?? 'upstart') as LabArchetype).includes('agentMode'))) {
      (fx.toolShip ??= {}).agentMode ??= agentsShip;
    }
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
