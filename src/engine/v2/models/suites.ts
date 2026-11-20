// Environment suites (model v3 D5: design/MODEL-V3.md §4.3, §11.2; data in data/v2/suites.ts). Owner: WS1.
//
// One suite per RL family, owned by the lab (PlayerLab.suites). A family with no suite has no environments: broad RL
// leaves it out and a run cannot focus on it. The six start families have suites from day 0; computer use gets one
// when P06 (computer-use environments) is known — until the lab works on it, it reads as a start-quality suite.
//   fidelity        fid_f = FIDELITY(expert data built into the suite, the family's `expert:<f>` asset): scales the
//                   family's RL ceiling A_f = fid_f · (A_base + a_RL) (effective.ts rlGains). The RL-ceiling stack
//                   (research line "Environments & rewards", a_RL) is the lab-wide method for making environments and
//                   rewards; a suite's fidelity is how much of it this family's environments realise
//   exploitability  x_f, the share of the suite's tasks whose scorer a policy can game: S2 = S2_PER_EXPLOIT ·
//                   Σ_f (RL compute share_f · x_f) × the RL budget's optimisation pressure (safety/traits.ts)
//   build           cash for expert data + engineer team-weeks (build queue); the data joins the asset when built
//   harden          cash for expert red-teamers + team-weeks; x ← floor + (x − floor)·(1 − cut) (diminishing returns)
//   upkeep          every suite keeps engineers busy (build.ts upkeepLines, the 'upkeep' need)
// A post-training run freezes its suites' fidelity and exploitability at launch (TrainingRun.recipe), like its RL recipe.
import {
  EXPERT_PRICE_B_PER_T, EXPERT_START_T, EXPLOIT_START, FIDELITY, HARDENED_FACTOR, RL_FAMILY_LABEL, S2_REF, START_EXPLOIT_MULT, SUITE_BUILD, SUITE_HARDEN,
  SUITE_UPKEEP,
} from '../../../data/v2/suites';
import { EXPERT_QUALITY } from '../../../data/v2/dataAssets';
import { RL_FAMILY_IDS, RL_FAMILY_NEEDS } from '../../../data/v2/runDesign';
import { TRANSFER, rlWeights, type FamilyMap } from './effective';
import { nodeKnown } from './tree';
import { adopted } from '../safety/common';
import { queueBuild } from '../departments/build';
import { bookCash } from '../finance/ledger';
import type { ActionDef, CostLine, DomainId, EnvSuite, GameStateV2, OwnedDataAsset, PostDesign, RLFamily, StartType, SystemCtx } from '../types';

export type SuiteWork = 'build' | 'harden';

/** Families whose environments exist without a paradigm (every start suite). */
export const START_SUITE_FAMILIES: RLFamily[] = RL_FAMILY_IDS.filter((f) => !RL_FAMILY_NEEDS[f]);
/** A family's environments can exist: no paradigm needed, or the paradigm is known (computer use: P06). */
export const familyUnlocked = (s: GameStateV2, f: RLFamily) => !RL_FAMILY_NEEDS[f] || nodeKnown(s, RL_FAMILY_NEEDS[f] as string);

const startMult = (s: Pick<GameStateV2, 'setup'>) => START_EXPLOIT_MULT[(s.setup.start ?? 'leader') as StartType] ?? 1;
const startSuite = (f: RLFamily, mult: number): EnvSuite => ({ exploit: Math.min(1, EXPLOIT_START[f] * mult), builds: 0, hardenings: 0 });

/** Start suites of a start type: the six start families, start exploitability × the start type's multiplier. */
export function startSuites(start: StartType = 'leader'): Partial<Record<RLFamily, EnvSuite>> {
  const m = START_EXPLOIT_MULT[start] ?? 1;
  return Object.fromEntries(START_SUITE_FAMILIES.map((f) => [f, startSuite(f, m)])) as Partial<Record<RLFamily, EnvSuite>>;
}

/** The family's own domain (its largest transfer entry): the expert asset's domain. */
export const familyDomain = (f: RLFamily): DomainId => (Object.entries(TRANSFER[f]) as [DomainId, number][]).reduce((a, x) => (x[1] > a[1] ? x : a))[0];
export const expertAssetId = (f: RLFamily) => `expert:${f}`;
/** The expert data a suite is built on (D1's `expert` kind, q 3, one asset per family, domain = the family's own). */
export const expertAsset = (f: RLFamily, tokensT: number): OwnedDataAsset => ({
  id: expertAssetId(f), kind: 'expert', tokensT, mix: { [familyDomain(f)]: 1 }, quality: EXPERT_QUALITY, domain: familyDomain(f), family: f,
});
/** The start portfolio's expert assets: EXPERT_START_T per start family. */
export const startExpertAssets = (): OwnedDataAsset[] => START_SUITE_FAMILIES.map((f) => expertAsset(f, EXPERT_START_T));

/** The lab's suite for a family (stored, or the start-quality suite of a family unlocked since the start), or undefined:
 *  no environments for that family. */
export function suiteOf(s: GameStateV2, f: RLFamily): EnvSuite | undefined {
  const x = s.player.suites?.[f];
  if (x) return x;
  return familyUnlocked(s, f) ? startSuite(f, startMult(s)) : undefined;
}
/** Families with a suite (the families RL can use). */
export const suiteFamilies = (s: GameStateV2): RLFamily[] => RL_FAMILY_IDS.filter((f) => suiteOf(s, f));

const findExpert = (s: GameStateV2, f: RLFamily) =>
  s.player.dataPortfolio.assets.find((a): a is OwnedDataAsset => a.kind === 'expert' && a.id === expertAssetId(f));
/** Expert data built into a family's suite (T tokens): its expert asset, E₀ for a suite not yet worked on, 0 without a suite. */
export function suiteExpertT(s: GameStateV2, f: RLFamily): number {
  if (!suiteOf(s, f)) return 0;
  return findExpert(s, f)?.tokensT ?? EXPERT_START_T;
}
/** Fidelity from expert data E (T): max − (max − 1)·(E₀/E)^γ, ≥ min. 1 at the start stock. */
export const fidelityOf = (expertT: number) =>
  expertT <= 0 ? FIDELITY.min : Math.max(FIDELITY.min, FIDELITY.max - (FIDELITY.max - 1) * Math.pow(EXPERT_START_T / expertT, FIDELITY.gamma));
export const suiteFidelity = (s: GameStateV2, f: RLFamily) => fidelityOf(suiteExpertT(s, f));

/** Fidelity and exploitability of every suite (the snapshot a post-training run freezes at launch). */
export function suiteFidMap(s: GameStateV2): FamilyMap {
  const out: FamilyMap = {};
  for (const f of suiteFamilies(s)) out[f] = suiteFidelity(s, f);
  return out;
}
export function suiteExploitMap(s: GameStateV2): FamilyMap {
  const out: FamilyMap = {};
  for (const f of suiteFamilies(s)) out[f] = suiteOf(s, f)!.exploit;
  return out;
}

/** RL family weights for the player (broad = equal over the families with a suite; a focus on a family without one is
 *  dropped here and refused by planRun). */
export const suiteRlWeights = (s: GameStateV2, focus: PostDesign['rlFocus']): FamilyMap => rlWeights(focus, suiteFamilies(s));

/** S2 per unit of RL-share-weighted exploitability [fit]: the start suites under broad RL at the standard budget give
 *  V1's reference S2 (0.36: the family table under broad × hardened graders). */
export const S2_PER_EXPLOIT = (() => {
  const w = rlWeights('broad', START_SUITE_FAMILIES);
  return S2_REF / START_SUITE_FAMILIES.reduce((a, f) => a + (w[f] ?? 0) * EXPLOIT_START[f], 0);
})();
/** S2 before the RL budget's pressure: S2_PER_EXPLOIT · Σ_f w_f · x_f (MODEL-V3 §11.2: RL FLOP share × exploitability). */
export const suiteS2 = (w: FamilyMap, exploit: FamilyMap) =>
  S2_PER_EXPLOIT * (Object.entries(w) as [RLFamily, number][]).reduce((a, [f, wf]) => a + wf * (exploit[f] ?? EXPLOIT_START[f]), 0);

// ───────────────────────────── work on a suite ─────────────────────────────

/** Size of a suite relative to the start stock (√ scales hardening and upkeep). */
const sizeOf = (s: GameStateV2, f: RLFamily) => Math.sqrt(Math.max(1e-9, suiteExpertT(s, f)) / EXPERT_START_T);
/** Hardening floor of a family: floorFrac × its start (hardened) exploitability. */
export const exploitFloor = (f: RLFamily) => SUITE_HARDEN.floorFrac * EXPLOIT_START[f];
/** Exploitability after one hardening pass. */
export const hardenedExploit = (f: RLFamily, x: number) => {
  const fl = Math.min(x, exploitFloor(f));
  return fl + (x - fl) * (1 - SUITE_HARDEN.cut);
};

export interface SuiteCost { tw: number; cashB: number; tokensT: number }
/** Cost of a build (more expert data built in) or a hardening pass on a family's suite, today. */
export function suiteWorkCost(s: GameStateV2, f: RLFamily, work: SuiteWork): SuiteCost {
  if (work === 'build') return { tw: SUITE_BUILD.twPerStart * (SUITE_BUILD.tokensT / EXPERT_START_T), cashB: SUITE_BUILD.tokensT * EXPERT_PRICE_B_PER_T, tokensT: SUITE_BUILD.tokensT };
  const k = sizeOf(s, f);
  return { tw: SUITE_HARDEN.tw * k, cashB: SUITE_HARDEN.cashB * k * (adopted(s, 'P15') ? SUITE_HARDEN.p15Cash : 1), tokensT: 0 };
}
/** Fidelity after a build and exploitability after a hardening pass (the action's before → after). */
export function suiteWorkEffect(s: GameStateV2, f: RLFamily, work: SuiteWork): { fid: [number, number]; exploit: [number, number] } {
  const fid = suiteFidelity(s, f);
  const x = suiteOf(s, f)?.exploit ?? 0;
  return work === 'build'
    ? { fid: [fid, fidelityOf(suiteExpertT(s, f) + SUITE_BUILD.tokensT)], exploit: [x, x] }
    : { fid: [fid, fid], exploit: [x, hardenedExploit(f, x)] };
}

/** Build-queue reference of suite work: `<family>:build` or `<family>:harden`. */
export const suiteRef = (f: RLFamily, work: SuiteWork) => `${f}:${work}`;
export function parseSuiteRef(ref: string): { family: RLFamily; work: SuiteWork } | undefined {
  const [f, w] = ref.split(':');
  if (!RL_FAMILY_IDS.includes(f as RLFamily) || (w !== 'build' && w !== 'harden')) return undefined;
  return { family: f as RLFamily, work: w };
}

/** Store a family's suite and its expert asset (a suite unlocked since the start becomes state when the lab works on it). */
export function materialiseSuite(s: GameStateV2, f: RLFamily): EnvSuite | undefined {
  const x = suiteOf(s, f);
  if (!x) return undefined;
  const suites = (s.player.suites ??= {});
  suites[f] ??= x;
  if (!findExpert(s, f)) s.player.dataPortfolio.assets.push(expertAsset(f, EXPERT_START_T));
  return suites[f];
}

/** A finished build or hardening pass takes effect (build.ts complete). */
export function completeSuiteWork(s: GameStateV2, ctx: SystemCtx, ref: string) {
  const r = parseSuiteRef(ref);
  if (!r) return;
  const x = materialiseSuite(s, r.family);
  if (!x) return;
  if (r.work === 'build') {
    const a = findExpert(s, r.family)!;
    const before = fidelityOf(a.tokensT);
    a.tokensT += SUITE_BUILD.tokensT;
    a.day = ctx.day;
    x.builds++;
    ctx.log('research', `Engineers finished building out the ${RL_FAMILY_LABEL[r.family]} environments: fidelity ${before.toFixed(2)} → ${fidelityOf(a.tokensT).toFixed(2)}.`, 1, r.family);
  } else {
    const before = x.exploit;
    x.exploit = hardenedExploit(r.family, x.exploit);
    x.hardenings++;
    ctx.log('research', `Engineers finished hardening the ${RL_FAMILY_LABEL[r.family]} environments: exploitable ${(before * 100).toFixed(1)}% → ${(x.exploit * 100).toFixed(1)}% of tasks.`, 1, r.family);
  }
}

/** Upkeep of a family's suite, team-weeks per week: SUITE_UPKEEP.tw × √(E/E₀). */
export const suiteUpkeepTW = (s: GameStateV2, f: RLFamily) => SUITE_UPKEEP.tw * sizeOf(s, f);

/** Save migration 21 → 22: start suites (exploitability from the lab's graders: cheap → cheap, else hardened) and the
 *  start expert data. `graders` is the post design's v1 option, read only here. */
export function suitesFromV1(graders: 'cheap' | 'hardened' | undefined, families: RLFamily[]): Partial<Record<RLFamily, EnvSuite>> {
  const mult = graders === 'cheap' ? 1 / HARDENED_FACTOR : 1;
  return Object.fromEntries(families.map((f) => [f, startSuite(f, mult)])) as Partial<Record<RLFamily, EnvSuite>>;
}

// ───────────────────────────── actions ─────────────────────────────

const famParam = (p: Record<string, number | string | boolean>): RLFamily => {
  const f = typeof p.family === 'string' ? (p.family as RLFamily) : 'swe';
  return RL_FAMILY_IDS.includes(f) ? f : 'swe';
};
/** Why suite work cannot be queued (undefined = it can). One pending item per family and kind of work. */
export function suiteWorkBlock(s: GameStateV2, f: RLFamily, work: SuiteWork): string | undefined {
  if (!suiteOf(s, f)) return `No ${RL_FAMILY_LABEL[f]} environments yet${RL_FAMILY_NEEDS[f] ? ` (needs ${RL_FAMILY_NEEDS[f]})` : ''}`;
  if (s.player.build.queue.some((it) => it.kind === 'suite' && it.ref === suiteRef(f, work))) return `Already ${work === 'build' ? 'building' : 'hardening'} the ${RL_FAMILY_LABEL[f]} suite`;
  if (suiteWorkCost(s, f, work).cashB > s.player.finance.cash) return 'Not enough cash';
  return undefined;
}
const pct = (x: number) => Math.round(x * 1000) / 10;

/** suite.build / suite.harden (model v3 D5): queue engineers' work on a family's suite; cash is paid when queued. */
export const SUITE_ACTIONS: ActionDef[] = (['build', 'harden'] as SuiteWork[]).map((work): ActionDef => ({
  id: `suite.${work}`, verb: 'train', system: 'models', sphere: 'models', owner: 'WS1', title: work === 'build' ? 'Build suite' : 'Harden suite',
  available: (s) => (suiteFamilies(s).length ? true : 'No environment suites'),
  preview: (s, p) => {
    const f = famParam(p);
    const c = suiteWorkCost(s, f, work);
    const e = suiteWorkEffect(s, f, work);
    const costs: CostLine[] = [{ currency: 'cash', amount: -Math.round(c.cashB * 1000) / 1000, target: work === 'build' ? 'expert data' : 'expert red-teamers' }, { currency: 'staffTime', amount: -Math.round(c.tw * 10) / 10, target: 'engineer team-weeks' }];
    const gains: CostLine[] = work === 'build'
      ? [{ currency: 'progress', amount: Math.round((e.fid[1] - e.fid[0]) * 1000) / 1000, target: `${RL_FAMILY_LABEL[f]} suite fidelity ${e.fid[0].toFixed(2)} → ${e.fid[1].toFixed(2)}` }]
      : [{ currency: 'alignment', amount: Math.round((e.exploit[0] - e.exploit[1]) * 1000) / 1000, target: `${RL_FAMILY_LABEL[f]} suite exploitable ${pct(e.exploit[0])}% → ${pct(e.exploit[1])}% of tasks` }];
    return { costs, gains, exposure: [] };
  },
  apply: (s, ctx, p) => {
    const f = famParam(p);
    const why = suiteWorkBlock(s, f, work);
    if (why) throw new Error(why);
    materialiseSuite(s, f);
    const c = suiteWorkCost(s, f, work);
    queueBuild(s, 'suite', suiteRef(f, work), c.tw);
    if (c.cashB > 0) bookCash(s, ctx, -c.cashB, 'training', work === 'build' ? 'expert data' : 'environment hardening', f);
    ctx.log('research', `Engineers start ${work === 'build' ? 'building out' : 'hardening'} the ${RL_FAMILY_LABEL[f]} environments.`, 1, f);
  },
}));

// ───────────────────────────── readout (Blueprint today, D6's suites view) ─────────────────────────────

export interface SuiteRow { family: RLFamily; label: string; fid: number; exploit: number; expertT: number; share: number; builds: number; hardenings: number; pending: SuiteWork[] }
/** Every suite with its fidelity, exploitability, expert data and the RL share a post-train with `focus` gives it;
 *  `weighted` = the RL-share-weighted fidelity and exploitability, `s2` = the S2 before the RL budget's pressure. */
export function suitesView(s: GameStateV2, focus: PostDesign['rlFocus'] = 'broad'): { rows: SuiteRow[]; weighted: { fid: number; exploit: number }; s2: number } {
  const w = suiteRlWeights(s, focus);
  const rows = suiteFamilies(s).map((f): SuiteRow => {
    const x = suiteOf(s, f)!;
    const pending = (['build', 'harden'] as SuiteWork[]).filter((k) => s.player.build.queue.some((it) => it.kind === 'suite' && it.ref === suiteRef(f, k)));
    return { family: f, label: RL_FAMILY_LABEL[f], fid: suiteFidelity(s, f), exploit: x.exploit, expertT: suiteExpertT(s, f), share: w[f] ?? 0, builds: x.builds, hardenings: x.hardenings, pending };
  });
  const weighted = rows.reduce((a, r) => ({ fid: a.fid + r.share * r.fid, exploit: a.exploit + r.share * r.exploit }), { fid: 0, exploit: 0 });
  return { rows, weighted, s2: suiteS2(w, suiteExploitMap(s)) };
}
