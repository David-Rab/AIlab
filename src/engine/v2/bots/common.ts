// Shared bot helpers (§7.4). Owner: WS4 (harness); balance owned by all workstreams.
//
// Bots act only through EngineApi actions (never by writing state) and decide by choice TAGS, so they keep working
// as other workstreams add actions and events. All bots share WS1's reference model cadence (`refPlay`) and WS3's
// finance autopilot with their own options.
import { ACTION_BY_ID, EVENT_BY_ID } from '../core/registry';
import type { AgendaId, EngineApi, GameStateV2, PendingDecision, Team } from '../types';
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { PROJECT_BY_ID, isLineNode, lineNodeId } from '../../../data/v2/tree';
import { nextLineProject, nodeKnown, projectReady } from '../models/tree';
import { acquireTerms, acquireVotes, type PayWith } from '../finance/acquire';

type Params = Record<string, number | string | boolean>;

/** Try an action by id; returns true if it applied. Unknown or unavailable actions are skipped silently. */
export function tryAct(s: GameStateV2, api: EngineApi, id: string, params: Params = {}): boolean {
  const a = ACTION_BY_ID.get(id);
  if (!a || a.available(s) !== true) return false;
  try {
    api.act(s, id, params);
    return true;
  } catch {
    return false;
  }
}

/** Intent → registered action ids in other spheres (first registered one is used). Model cadence, compute and money
 *  are shared policies instead: WS1's `refPlay` (bots/ref.ts) and WS3's `financeAutopilot` (finance/plan.ts). */
export const BOT_INTENTS: Record<string, string[]> = {
  frameworkEvals: ['safety.frameworkEvals'], // params { depth: none | basic | full | deep, external: boolean }
  raise: ['fin.raise'],
  split: ['setSplit'], // params: ComputeSplit keys (must sum to 1)
  release: ['product.launch'], // params { versionId, channel }
};

export function intent(s: GameStateV2, api: EngineApi, name: keyof typeof BOT_INTENTS, params: Params = {}): boolean {
  for (const id of BOT_INTENTS[name]) if (ACTION_BY_ID.has(id)) return tryAct(s, api, id, params);
  return false;
}

/** Choose the first available choice whose tags hit the earliest preference group; else the event's default. */
export function pickByTags(s: GameStateV2, d: PendingDecision, prefs: string[][]): number {
  const def = EVENT_BY_ID.get(d.id);
  if (!def) return 0;
  const ok = (i: number) => (def.choices[i].available?.(s, d.data) ?? true) === true;
  for (const group of prefs) {
    const i = def.choices.findIndex((c, k) => ok(k) && c.tags.some((t) => group.includes(t)));
    if (i >= 0) return i;
  }
  return ok(def.defaultChoice) ? def.defaultChoice : 0;
}

/** Index of a choice by label (falls back to `fallback`). */
export function byLabel(d: PendingDecision, label: string, fallback = 0): number {
  const i = EVENT_BY_ID.get(d.id)?.choices.findIndex((c) => c.label === label) ?? -1;
  return i >= 0 ? i : fallback;
}

/** E32 merger offer (FIN3c): buy for cash while that leaves `cushion` ($B) in the bank, else in stock while its
 *  holders get at most `maxStake` of the company (so never a sale of control), and only on votes that pass without forcing;
 *  otherwise decline. */
export function mergerChoice(s: GameStateV2, d: PendingDecision, opts: { cushion: number; maxStake: number }): number {
  const def = EVENT_BY_ID.get(d.id);
  const decline = byLabel(d, 'Decline', def?.defaultChoice ?? 0);
  const r = s.rivals.find((x) => x.core.id === d.data.lab && x.core.status === 'active');
  if (!def || !r) return decline;
  const t = acquireTerms(s, r);
  const ok = (pay: PayWith, i: number) => i >= 0 && (def.choices[i].available?.(s, d.data) ?? true) === true && acquireVotes(s, t, pay).every((v) => v.passes);
  const cash = byLabel(d, 'Pay cash', -1);
  const stock = byLabel(d, 'Pay in stock', -1);
  if (s.player.finance.cash - t.price >= opts.cushion && ok('cash', cash)) return cash;
  if (t.stockFrac <= opts.maxStake && ok('stock', stock)) return stock;
  return decline;
}

/** Run an action at most every `every` days (uses the action's own cooldown/once rules too). */
export const every = (s: GameStateV2, n: number, offset = 0) => (s.time.day + offset) % n === 0;

/** A bot's safety research plan (R8): research lines in priority order, the teams each should have, and optionally the
 *  ideas it wants from the line in order (then the line's follow-up; default: the tree's next open idea). */
export interface LinePlan { ag: AgendaId; teams: number; ideas?: string[] }

/** The ideas bots want first from a line, in order (then the tree's next open idea): the ones their recipes use. */
export const BOT_IDEAS: Partial<Record<AgendaId, string[]>> = {
  AG18: ['T-INOC', 'T-CONFESS', 'T-ANTISCHEME'], AG15: ['T-FILTER', 'safetyPretrain', 'T-UNDO'], AG02: ['T-DECEPT', 'T-NLA'],
  AG08: ['T-HONEY', 'T-AUDIT'], AG07: ['T-RESAMPLE', 'T-CEVAL', 'T-LOCK'],
};

/** The project a line's teams should be on under a plan. */
function wantedProject(s: GameStateV2, l: LinePlan): string | undefined {
  const idea = (l.ideas ?? BOT_IDEAS[l.ag])?.find((id) => !nodeKnown(s, id) && projectReady(s, id) === true);
  if (idea) return idea;
  if (l.ideas) {
    const f = lineNodeId(l.ag);
    return projectReady(s, f) === true ? f : undefined;
  }
  return nextLineProject(s, l.ag);
}

const lineOf = (t: Team) => {
  const n = t.projectId ? PROJECT_BY_ID[t.projectId] : undefined;
  return n && isLineNode(n) ? n.agenda : undefined;
};

/** Staff research lines by a plan with the bot's safety science teams (through research.assign): each line in order gets
 *  up to its team count, from idle teams first (its column's specialty preferred), then from teams on lines outside the
 *  plan; teams on a planned line move to the project the plan wants. */
export function staffLines(s: GameStateV2, api: EngineApi, plan: LinePlan[]) {
  const sci = s.player.teams.filter((t) => t.role === 'sci' && t.dept === 'saf');
  const planned = new Set(plan.map((l) => l.ag));
  for (const l of plan) {
    const want = wantedProject(s, l);
    if (!want) continue;
    const on = sci.filter((t) => lineOf(t) === l.ag);
    for (const t of on) if (t.projectId !== want) tryAct(s, api, 'research.assign', { team: t.id, id: want });
    let need = l.teams - on.length;
    while (need > 0) {
      const col = AGENDA_BY_ID[l.ag].column;
      const free = sci.filter((t) => !t.projectId || !lineOf(t) || !planned.has(lineOf(t) as AgendaId));
      const t = free.find((x) => !x.projectId && x.specialty === col) ?? free.find((x) => !x.projectId) ?? free.find((x) => x.specialty === col) ?? free[0];
      if (!t || !tryAct(s, api, 'research.assign', { team: t.id, id: want })) break;
      need--;
    }
  }
  keepLockdown(s, api);
}

/** SR-13b: before SR-13 owning T-LOCK was the comms lockdown; now it unlocks a safeguard item. Bots that research it
 *  (BOT_IDEAS AG07) add it to every live internal agent package that lacks one, so their play keeps T-LOCK's effect. */
export function keepLockdown(s: GameStateV2, api: EngineApi) {
  if (!s.player.safety.techniques['T-LOCK']?.unlocked) return;
  const ids = new Set(s.player.deployments.filter((d) => d.channel === 'internal' && d.status === 'live' && !d.guards?.some((g) => g.kind === 'lockdown')).map((d) => d.versionId));
  for (const versionId of ids) tryAct(s, api, 'safety.respond', { kind: 'addLockdown', versionId });
}

/** SR-19 (replaces the E17 "Red flags" decision): RefBot, race and capex override each training hold in force (the old
 *  E17 Continue). RF-S13: the framework applies its own package (safety/packages.ts autoApplyPackages), so a hold here
 *  is one the package cannot meet (evidence: an eval suite, an external evaluation); the safe / mixed bots' 'control' answer
 *  (add control where a hold lacked it) is gone with it, and they leave such holds (the old Pause). */
export function answerFramework(s: GameStateV2, api: EngineApi) {
  for (const h of s.player.safety.framework?.holds ?? []) {
    if (h.target === 'training') tryAct(s, api, 'safety.frameworkOverride', { ruleId: h.ruleId, versionId: h.versionId });
  }
}

/** Leader-start capabilities staff (data/v2/starts.ts leader teams: 6·100 + 21·50 + 14·20 = 1,930; L15, was 2,020). */
const LEADER_CAP_STAFF = 1930;
/** A bot's safety-team target sized to the company (R9): a follower start smaller than the leader's scales its plan by
 *  its capabilities staff (at least one team); the leader start (and a larger big-tech division) keep it. */
export function sizedTarget(s: GameStateV2, n: number): number {
  if ((s.setup.start ?? 'leader') === 'leader') return n;
  return Math.max(1, Math.round(n * Math.min(1, s.player.staff.cap / LEADER_CAP_STAFF)));
}
