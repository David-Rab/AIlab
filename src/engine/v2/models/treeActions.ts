// Research verbs (STRUCTURE §4.2, BUILD-PLAN R4): queue a project, start it now, reorder, drop it, assign or take off a
// science team, and the auto-assign policy. Owner: WS1. Previews work with empty params (defaults: the first open idea,
// the first capabilities science team) and show what apply() does (§2.7, lint-tradeoffs).
import { PROJECT_BY_ID, TREE, isLineNode, type TreeNodeDef } from '../../../data/v2/tree';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { TRAIT_BY_ID } from '../../../data/v2/traits';
import { P25_DEFENCE } from '../security/theft';
import type { ActionDef, CostLine, EngNeed, GameStateV2, ReNeed, RiskPolicy, SafReNeed, StackKey, TraitId } from '../types';
import { DEFAULT_SAF_RE_ALLOC, PICK_AT, PROJECT_MAX_TEAMS, RISK_KAPPA, STACK_LABEL } from '../../../data/v2/research';
import { RL_FAMILY_LABEL } from '../../../data/v2/suites';
import { atTest, capEta, effortOfNode, isCapProject, priorMean, reopenProject, teamsWanted, wantIsAuto } from './research';
import {
  assignCapNow, assignTeam, autoAssign, dequeueNode, idleTeams, moveInQueue, nodeOdds, nodeStatus, projectEta, projectTeams,
  queueNode, unassignTeam,
} from './tree';

type Params = Record<string, number | string | boolean>;
type Preview = ReturnType<ActionDef['preview']>;
const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);
const num = (p: Params, k: string, d: number) => (typeof p[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : d);
const fail = (why: string | undefined) => {
  if (why) throw new Error(why);
};

/** Default node for previews: the param, else the first open idea. */
const nodeParam = (s: GameStateV2, p: Params) => str(p, 'id', TREE.find((n) => nodeStatus(s, n.id) === 'open')?.id ?? 'P05');
const teamParam = (s: GameStateV2, p: Params) => str(p, 'team', projectTeams(s)[0]?.id ?? '');
/** One project's ETA change as a preview line, in days (B31: before and after from projectEta / capEta); a project that
 *  gets going or stalls says so. Undefined when it does not move. */
function etaChange(name: string, a: number, b: number): CostLine | undefined {
  if (!Number.isFinite(a) && !Number.isFinite(b)) return undefined;
  if (!Number.isFinite(b)) return { currency: 'leadDays', amount: -Math.round(a), target: `${name} stalls (its ETA was this many days)` };
  if (!Number.isFinite(a)) return { currency: 'progress', amount: Math.round(b), unit: 'days', target: `${name} gets going: its ETA in days` };
  const d = Math.round(a) - Math.round(b);
  if (d > 0) return { currency: 'progress', amount: d, unit: 'days', target: `${name} sooner` };
  if (d < 0) return { currency: 'leadDays', amount: d, target: `${name} later` };
  return undefined;
}
const pushEta = (costs: CostLine[], gains: CostLine[], l: CostLine | undefined) => { if (l) (l.amount > 0 && l.currency === 'progress' ? gains : costs).push(l); };

/** Capability lines of a node's preview (F6c): its typed effect in its own unit, from the numbers adoption applies
 *  (models/research.ts completeAdoption): a stack effect is the expected effect at the scale test (the public prior mean
 *  per idea × 1000^s at the prior exponent, `atTest`), in OOM of that stack (and its `also` stacks); a domain effect the
 *  prior × the node's OOM per domain; data and expert-data effects the prior × their own units. A node without a typed
 *  effect gives what it unlocks (its design options, or its stated capability). */
function capLines(s: GameStateV2, n: TreeNodeDef, odds: number, spec: number): { gains: CostLine[]; costs: CostLine[] } {
  const gains: CostLine[] = [];
  const costs: CostLine[] = [];
  const g = (amount: number, unit: string, target: string) => gains.push({ currency: 'progress', amount: Number(amount.toPrecision(3)), unit, probability: odds, target });
  const eff = n.effect;
  const per = eff ? priorMean(s, n, {}, spec) : 0;
  if (eff?.stack) {
    const x = atTest(n, { b: 1 }, { x: per, s: eff.s?.[0] ?? 0 }).xTest;
    g(x, 'OOM', `${STACK_LABEL[eff.stack]}${n.kind === 'line' ? ' per idea' : ''} (expected)`);
    for (const [k, ratio] of Object.entries(eff.also ?? {}) as [StackKey, number][]) g(x * ratio, 'OOM', `${STACK_LABEL[k]} (expected)`);
  } else if (eff?.domains) {
    for (const [d, v] of Object.entries(eff.domains)) g(per * (v ?? 0), 'OOM', `${d} for new versions (expected)`);
  } else if (eff?.data || eff?.expert) {
    if (eff.data?.synQMax) g(per * eff.data.synQMax, 'q', 'synthetic-quality ceiling, the web = 1 (expected)');
    if (eff.data?.worthOom) g(per * eff.data.worthOom, 'OOM', 'worth of each drawn token (expected)');
    if (eff.expert) g(per * eff.expert.tokensT * 1000, 'B expert tokens', `${RL_FAMILY_LABEL[eff.expert.family]} suite (expected)`);
  }
  const opts = n.options?.length ?? 0;
  if ((n.fx.cap ?? 0) > 0 && (opts || !eff)) g(Math.max(1, opts), opts > 1 ? 'options' : opts ? 'option' : 'unlock', n.cap ?? n.name);
  if ((n.fx.cap ?? 0) < 0) {
    // Paid when the option is used: the node states it ("−0.3 OOM effective compute …"), else in words.
    const m = /^[−-]\s*([\d.]+) OOM (.*)$/.exec(n.cap ?? '');
    costs.push(m
      ? { currency: 'progress', amount: -Number(m[1]), unit: 'OOM', target: `when used: ${m[2]}` }
      : { currency: 'progress', amount: 1, unit: 'trade-off', target: `when used: ${n.cap ?? 'less capability'}` });
  }
  return { gains, costs };
}

/** RD-B18 (B31): a node's work as cost lines, from effortOfNode (what the engine runs): capability projects' science
 *  and experiment team-months, a research line's months at serious staffing, another project's team-months. */
function effortLines(n: TreeNodeDef, again = ''): CostLine[] {
  const e = effortOfNode(n);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const per = n.kind === 'line' ? ' per result' : '';
  if (isCapProject(n)) {
    return [
      { currency: 'staffTime', amount: r1(e.sci), unit: 'team-months', target: `science teams: ideas for ${PICK_AT} candidates${per}${again}` },
      { currency: 'staffTime', amount: r1(e.exp), unit: 'team-months', target: `research engineers and experiment compute: small and scale tests${per}${again}` },
    ];
  }
  if (e.unit === 'months') return [{ currency: 'staffTime', amount: r1(e.sci + e.exp), unit: 'months', target: `to a result at serious staffing (ideas, then tests)${again}` }];
  return [{ currency: 'staffTime', amount: r1(e.sci), unit: 'team-months', target: `science teams${again}` }];
}

/** What researching a node costs and gives: its work (effortLines); its capability effect in its own unit (capLines)
 *  with its odds, or a safety gain; safety side effects as exposure. `reopen`: the next speculative attempt of a failed
 *  project (reopenProject: one more speculative step, so a lower prior mean and half the odds). */
export function nodePreview(s: GameStateV2, id: string, reopen = false): Preview {
  const n = PROJECT_BY_ID[id];
  if (!n) return { costs: [{ currency: 'staffTime', amount: 0 }], gains: [], exposure: [] };
  const odds = nodeOdds(s, id);
  const costs = effortLines(n, reopen ? ', again' : '');
  const spec = (s.player.tree[n.id]?.cap?.spec ?? 0) + (reopen ? 1 : 0);
  const cap = capLines(s, n, odds, spec);
  const gains = cap.gains;
  costs.push(...cap.costs);
  const saf = safLines(n, odds);
  gains.push(...saf.gains);
  return { costs, gains, exposure: saf.exposure };
}

const traitList = (cov: Partial<Record<TraitId, number>>) =>
  (Object.entries(cov) as [TraitId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, c]) => `${TRAIT_BY_ID[t]?.name ?? t} ${c}`).join(', ');
/** Safety lines of a node's preview (F6d; was `0.05 × fx.saf` "alignment", a v2 meter scale): what the node really adds
 *  to the safety mechanisms. A technique node unlocks its technique (data/v2/techniques.ts), shown by its role: a
 *  detector or a control protocol with the traits it covers most (coverage, 1 = built for the trait: the weight the
 *  detection and containment code applies), or a training fix (a run option). A research-line node's odds are the
 *  line's estimated chance per result (nodeOdds). P25 gives its defence levels (theft.ts); any other node its stated
 *  safety effect. A node whose safety side is a risk (fx.saf < 0) shows it as exposure, "when used" for an option. */
export function safLines(n: TreeNodeDef, odds: number): { gains: CostLine[]; exposure: CostLine[] } {
  const saf = n.fx.saf ?? 0;
  if (!saf) return { gains: [], exposure: [] };
  const p = { probability: odds };
  const per = isLineNode(n) ? ' (odds per result)' : '';
  if (saf < 0) return { gains: [], exposure: [{ currency: 'alignment', amount: 1, unit: 'safety risk', ...p, target: `${n.options?.length ? 'when used: ' : ''}${n.saf ?? 'safety side effect'}` }] };
  const t = n.technique ? TECHNIQUE_BY_ID[n.technique] : undefined;
  const g = (unit: string, target: string, amount = 1): { gains: CostLine[]; exposure: CostLine[] } => ({ gains: [{ currency: 'alignment', amount, unit, ...p, target: target + per }], exposure: [] });
  if (t && Object.keys(t.coverage).length) return g(t.role === 'contain' ? 'control protocol' : 'detector', `${t.role === 'contain' ? 'contains' : 'detects'} by coverage: ${traitList(t.coverage)}`);
  if (t) return g(t.role === 'contain' ? 'control protocol' : 'training fix', `${t.role === 'fix' ? 'run option: ' : ''}${n.saf ?? t.name}`);
  if (n.id === 'P25') return g('defence levels', 'weight security against theft', P25_DEFENCE);
  return g('safety effect', n.saf ?? n.name);
}

const NEEDS_RE: ReNeed[] = ['ops', 'evals', 'exp'];
const NEEDS_ENG: EngNeed[] = ['runs', 'upkeep', 'builds'];
const NEEDS_SAF_RE: SafReNeed[] = ['cases', 'patches', 'safExp', 'reval'];
/** Parse an order param ('exp,ops,evals'): a permutation of the needs, or undefined. */
function orderParam<K extends string>(p: Params, all: K[]): K[] | undefined {
  if (typeof p.order !== 'string') return undefined;
  const xs = p.order.split(',').map((x) => x.trim()) as K[];
  return xs.length === all.length && all.every((k) => xs.includes(k)) ? xs : undefined;
}
/** Apply cap params to an allocation: `need` + `max` (team-equivalents) or `share` (0..1); a negative value clears. */
function capParams<K extends string>(a: { max: Partial<Record<K, number>>; share: Partial<Record<K, number>> }, p: Params, all: K[]) {
  const k = typeof p.need === 'string' && (all as string[]).includes(p.need) ? (p.need as K) : undefined;
  if (!k) return;
  if (typeof p.max === 'number') { if (p.max < 0) delete a.max[k]; else a.max[k] = p.max; }
  if (typeof p.share === 'number') { if (p.share < 0) delete a.share[k]; else a.share[k] = Math.min(1, p.share); }
}

export const TREE_ACTIONS: ActionDef[] = [
  {
    id: 'research.queue', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Queue',
    available: (s) => (s.player.status === 'active' ? true : 'Lab inactive'),
    preview: (s, p) => nodePreview(s, nodeParam(s, p)),
    apply: (s, _ctx, p) => {
      fail(queueNode(s, nodeParam(s, p), typeof p.at === 'number' ? num(p, 'at', 0) : undefined));
      assignCapNow(s);
    },
  },
  {
    id: 'research.start', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Start now',
    available: (s) => (s.player.status === 'active' ? true : 'Lab inactive'),
    preview: (s, p) => nodePreview(s, nodeParam(s, p)),
    // Top of the queue: the next idle team joins it (auto-assign), or assign one by hand.
    apply: (s, _ctx, p) => {
      fail(queueNode(s, nodeParam(s, p), 0));
      assignCapNow(s);
    },
  },
  {
    id: 'research.dequeue', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Drop',
    available: (s) => (s.player.research.queue.length ? true : 'No projects'),
    preview: (s, p) => {
      const id = str(p, 'id', s.player.research.queue[0] ?? '');
      const heads = s.player.teams.filter((t) => t.projectId === id).reduce((a, t) => a + t.heads, 0);
      return { costs: [{ currency: 'progress', amount: 0, unit: 'project', target: `${PROJECT_BY_ID[id]?.name ?? 'project'} leaves the list` }], gains: [{ currency: 'staffTime', amount: Math.round(heads), target: 'scientists freed' }], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      fail(dequeueNode(s, str(p, 'id', s.player.research.queue[0] ?? '')));
      assignCapNow(s);
    },
  },
  {
    id: 'research.move', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Reorder',
    available: (s) => (s.player.research.queue.length > 1 ? true : 'Nothing to reorder'),
    preview: (s, p) => {
      // B35: apply re-plans every capability science team by the new order (assignCapNow); run it on a copy and read
      // each project's ETA (capEta) before and after.
      const q = s.player.research.queue;
      const id = str(p, 'id', q[q.length - 1] ?? '');
      const to = num(p, 'to', 0);
      const c: GameStateV2 = { ...s, player: { ...s.player, teams: s.player.teams.map((t) => ({ ...t })), research: { ...s.player.research, queue: [...q] } } };
      moveInQueue(c, id, to);
      assignCapNow(c);
      const costs: CostLine[] = [];
      const gains: CostLine[] = [];
      for (const x of q) {
        const n = PROJECT_BY_ID[x];
        if (!n || !isCapProject(n)) continue;
        pushEta(costs, gains, etaChange(n.name, capEta(s, x).eta, capEta(c, x).eta));
      }
      if (!costs.length) costs.push({ currency: 'leadDays', amount: 0, target: 'no capability project later: the science teams stay where they are' });
      if (!gains.length) gains.push({ currency: 'progress', amount: 0, unit: 'days', target: `${PROJECT_BY_ID[id]?.name ?? 'project'} moves in the order; no capability project sooner today` });
      return { costs, gains, exposure: [] };
    },
    apply: (s, _ctx, p) => {
      fail(moveInQueue(s, str(p, 'id', ''), num(p, 'to', 0)));
      assignCapNow(s);
    },
  },
  {
    id: 'research.assign', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Assign',
    available: (s) => (projectTeams(s).length ? true : 'No science teams'),
    preview: (s, p) => {
      const id = nodeParam(s, p);
      const team = s.player.teams.find((t) => t.id === teamParam(s, p));
      const costs: CostLine[] = [{ currency: 'staffTime', amount: Math.round(team?.heads ?? 0), target: 'scientists' }];
      const gains: CostLine[] = [];
      if (team) pushEta(costs, gains, etaChange(PROJECT_BY_ID[id]?.name ?? 'project', projectEta(s, id), projectEta(s, id, { add: team })));
      if (team?.projectId && team.projectId !== id) {
        const from = team.projectId;
        pushEta(costs, gains, etaChange(PROJECT_BY_ID[from]?.name ?? 'project', projectEta(s, from), projectEta(s, from, { remove: team.id })));
      }
      if (!gains.length) gains.push({ currency: 'progress', amount: 0, unit: 'days', target: `${PROJECT_BY_ID[id]?.name ?? 'project'}: no sooner today` });
      return { costs, gains, exposure: [] };
    },
    apply: (s, _ctx, p) => fail(assignTeam(s, teamParam(s, p), nodeParam(s, p))),
  },
  {
    id: 'research.unassign', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Take off',
    available: (s) => (s.player.teams.some((t) => t.projectId) ? true : 'No team on a project'),
    preview: (s, p) => {
      const team = s.player.teams.find((t) => t.id === str(p, 'team', s.player.teams.find((t) => t.projectId)?.id ?? ''));
      const id = team?.projectId ?? '';
      const costs: CostLine[] = [];
      const gains: CostLine[] = [{ currency: 'staffTime', amount: Math.round(team?.heads ?? 0), target: 'scientists free' }];
      if (id && team) pushEta(costs, gains, etaChange(PROJECT_BY_ID[id]?.name ?? 'project', projectEta(s, id), projectEta(s, id, { remove: team.id })));
      if (!costs.length) costs.push({ currency: 'leadDays', amount: 0, target: `${PROJECT_BY_ID[id]?.name ?? 'project'}: no later today` });
      return { costs, gains, exposure: [] };
    },
    apply: (s, _ctx, p) => fail(unassignTeam(s, teamParam(s, p))),
  },
  {
    id: 'research.autoAssign', verb: 'policy', system: 'research', sphere: 'models', owner: 'WS1', title: 'Auto-assign',
    available: () => true,
    preview: (s, p) => {
      const on = p.on === undefined ? !s.player.research.autoAssign : p.on === true;
      // B35: the policy places safety science teams only (autoAssign); capability teams always follow the priority list.
      // On: run it on a copy and count the idle safety scientists it puts to work today.
      let placed = 0;
      if (on) {
        const c: GameStateV2 = { ...s, player: { ...s.player, teams: s.player.teams.map((t) => ({ ...t })), research: { ...s.player.research, queue: [...s.player.research.queue] } } };
        autoAssign(c);
        placed = c.player.teams.filter((t) => t.role === 'sci' && t.dept === 'saf' && t.projectId && !s.player.teams.find((x) => x.id === t.id)?.projectId).reduce((a, t) => a + t.heads, 0);
      }
      const idle = idleTeams(s, 'saf').reduce((a, t) => a + t.heads, 0);
      return on
        ? { costs: [{ currency: 'staffTime', amount: 0, target: 'safety teams placed by the policy, not by you' }], gains: [{ currency: 'progress', amount: Math.round(placed), unit: 'scientists', target: 'idle safety scientists put on projects today' }], exposure: [] }
        : { costs: [{ currency: 'progress', amount: -Math.round(idle), unit: 'scientists', target: 'idle safety scientists wait for you (capability teams still follow the priority list)' }], gains: [{ currency: 'staffTime', amount: 0, target: 'you place safety teams by hand' }], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      s.player.research.autoAssign = p.on === undefined ? !s.player.research.autoAssign : p.on === true;
    },
  },
  {
    id: 'research.want', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Teams wanted',
    available: (s) => (s.player.research.queue.length ? true : 'No projects'),
    preview: (s, p) => {
      const id = str(p, 'id', s.player.research.queue[0] ?? '');
      if (p.auto === true) return { costs: [{ currency: 'staffTime', amount: 0, target: 'one science team, then spare teams by priority and fit' }], gains: [{ currency: 'progress', amount: 0, target: (PROJECT_BY_ID[id]?.name ?? 'project') + ' takes spare teams where they add the most progress' }], exposure: [] };
      const n = Math.max(0, Math.min(PROJECT_MAX_TEAMS, Math.round(num(p, 'n', teamsWanted(s, id) + 1))));
      return { costs: [{ currency: 'staffTime', amount: n - teamsWanted(s, id), target: 'science teams from lower-priority projects' }], gains: [{ currency: 'progress', amount: 0, target: (PROJECT_BY_ID[id]?.name ?? 'project') + ' faster (square-root returns per team)' }], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const id = str(p, 'id', '');
      if (!PROJECT_BY_ID[id]) throw new Error('Unknown idea');
      // B4: `auto: true` puts the project on auto (the game picks the number); a number takes it off auto.
      const r = s.player.research;
      r.wantAuto ??= [];
      if (p.auto === true) {
        if (!wantIsAuto(s, id)) r.wantAuto.push(id);
      } else {
        r.wantAuto = r.wantAuto.filter((x) => x !== id);
        r.want[id] = Math.max(0, Math.min(PROJECT_MAX_TEAMS, Math.round(num(p, 'n', 1))));
      }
      assignCapNow(s);
    },
  },
  {
    id: 'research.risk', verb: 'policy', system: 'research', sphere: 'models', owner: 'WS1', title: 'Research risk policy',
    available: () => true,
    preview: (_s, p) => {
      const r = (str(p, 'risk', 'balanced') as RiskPolicy);
      const k = RISK_KAPPA[r] ?? 0;
      // B35: the policy is the pick rule (models/research.ts candidateScore): the candidate tested next is the one with
      // the highest belief mean + κ × spread. No one-number effect: which candidate wins depends on the candidates.
      const rule = k === 0 ? 'the highest expected effect' : `expected effect ${k > 0 ? '+' : '−'} ${Math.abs(k)} × its spread`;
      return k > 0
        ? { costs: [{ currency: 'staffTime', amount: 0, target: 'more tests on candidates that fail them (dropped, the team time is spent)' }], gains: [{ currency: 'progress', amount: 0, unit: 'pick rule', target: `tests the candidate with the best ${rule}: bigger, less certain ideas` }], exposure: [] }
        : k < 0
          ? { costs: [{ currency: 'progress', amount: 0, unit: 'pick rule', target: `tests the candidate with the best ${rule}: surer, smaller ideas` }], gains: [{ currency: 'staffTime', amount: 0, target: 'fewer tests on candidates that fail them' }], exposure: [] }
          : { costs: [{ currency: 'staffTime', amount: 0, target: 'no weight on spread: neither surer nor bolder candidates first' }], gains: [{ currency: 'progress', amount: 0, unit: 'pick rule', target: `tests the candidate with ${rule}` }], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const r = str(p, 'risk', 'balanced') as RiskPolicy;
      if (!(r in RISK_KAPPA)) throw new Error('Unknown risk policy');
      s.player.research.risk = r;
    },
  },
  {
    id: 'research.reopen', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Reopen as speculative',
    available: (s) => (TREE.some((n) => s.player.tree[n.id]?.status === 'failed' && n.kind && n.kind !== 'line') ? true : 'No failed project'),
    preview: (s, p) => {
      // B35: the next speculative attempt's own preview (lower prior mean, half the odds; nodePreview with reopen).
      const id = str(p, 'id', TREE.find((n) => s.player.tree[n.id]?.status === 'failed' && n.kind && n.kind !== 'line')?.id ?? '');
      return nodePreview(s, PROJECT_BY_ID[id] ? id : TREE[0].id, true);
    },
    apply: (s, _ctx, p) => {
      const id = str(p, 'id', '');
      fail(reopenProject(s, id) ?? queueNode(s, id));
      assignCapNow(s);
    },
  },
  {
    id: 'research.reAlloc', verb: 'policy', system: 'research', sphere: 'departments', owner: 'WS1', title: 'Research engineers by need',
    available: () => true,
    preview: (_s, p) => {
      const need = str(p, 'need', 'exp');
      return { costs: [{ currency: 'staffTime', amount: 0, target: 'research engineers move from the needs below it' }], gains: [{ currency: 'progress', amount: 0, target: need + ' gets them first' }], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const a = s.player.research.re;
      const o = orderParam(p, NEEDS_RE);
      if (o) a.order = o;
      capParams(a, p, NEEDS_RE);
    },
  },
  {
    // RD-A04 (OD-9): the safety research engineers' needs list, set in LAB like the capability one.
    id: 'research.safReAlloc', verb: 'policy', system: 'safety', sphere: 'departments', owner: 'WS1', title: 'Safety research engineers by need',
    available: () => true,
    preview: (_s, p) => {
      const need = str(p, 'need', 'safExp');
      return { costs: [{ currency: 'staffTime', amount: 0, target: 'safety research engineers move from the needs below it' }], gains: [{ currency: 'progress', amount: 0, target: need + ' gets them first' }], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const a = (s.player.research.safRe ??= { order: [...DEFAULT_SAF_RE_ALLOC.order], max: {}, share: {} });
      const o = orderParam(p, NEEDS_SAF_RE);
      if (o) a.order = o;
      capParams(a, p, NEEDS_SAF_RE);
    },
  },
  {
    id: 'build.engAlloc', verb: 'policy', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Engineers by need',
    available: () => true,
    preview: (_s, p) => {
      const need = str(p, 'need', 'builds');
      return { costs: [{ currency: 'staffTime', amount: 0, target: 'engineers move from the needs below it' }], gains: [{ currency: 'progress', amount: 0, target: need + ' gets them first' }], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const a = s.player.build.alloc;
      const o = orderParam(p, NEEDS_ENG);
      if (o) a.order = o;
      capParams(a, p, NEEDS_ENG);
    },
  },
];
