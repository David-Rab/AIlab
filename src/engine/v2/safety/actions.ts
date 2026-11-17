// Player actions in the Safety sphere (ActionDef catalog, V2-SPEC §3.4.3 Safety row, §3.5). Owner: WS2.
// Every preview shows costs, gains and exposure computed from VISIBLE inputs (posteriors, beliefs, FTE, compute);
// none reads truth. Each has ≥ 1 cost in a currency that is not among its gains (§2.7, lint-tradeoffs).
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { TRAIT_IDS } from '../../../data/v2/traits';
import { internalVersion } from '../models/labs';
import type { ActionDef, CostLine, GameStateV2, ResponseKind, SafetyDept, TraitId } from '../types';
import { clamp01, mAtLevel, versionById } from './common';
import { safetyAgentVersion, trustedShare } from './agents';
import { publishFinding } from './findings';
import { INV_FTE, INV_MAX_DAYS, closeInvestigation, investigationFte, openInvestigation, safetyReHeads } from './investigations';
import { patchFte } from './responses';
import { RESPONSE_INFO, applyResponse, responseTrait } from './responses';
import { strengthBelieved, techniqueRole } from './techniques';
import { believedPenalty, combineTools } from './detection';

type P = Record<string, number | string | boolean>;
type Preview = { costs: CostLine[]; gains: CostLine[]; exposure: CostLine[] };

const r2 = (x: number) => Math.round(x * 100) / 100;
const str = (p: P, k: string): string | undefined => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
const num = (p: P, k: string): number | undefined => (typeof p[k] === 'number' ? (p[k] as number) : undefined);
const isTrait = (x: string | undefined): x is TraitId => !!x && (TRAIT_IDS as string[]).includes(x);

function measuredL(s: GameStateV2): number {
  return internalVersion(s)?.evals.measuredL ?? 0;
}

/** Visible sabotage estimate of the safety agent model (from beliefs, never truth). */
function believedSab(s: GameStateV2): number {
  const v = safetyAgentVersion(s);
  if (!v) return 0;
  return (v.beliefs.SAND?.est ?? 0) + (v.beliefs.SCHEME?.est ?? 0);
}

/** Default investigation target: the internal model's critical trait with the highest believed level. */
function defaultTarget(s: GameStateV2): { versionId: string; trait: TraitId } | undefined {
  const v = internalVersion(s);
  if (!v) return undefined;
  return { versionId: v.id, trait: responseTrait(v) };
}

function investigationGain(s: GameStateV2, versionId: string, trait: TraitId, fte: number): number {
  const v = versionById(s, versionId);
  if (!v) return 0;
  const L = v.evals.measuredL ?? 0;
  const M = mAtLevel(s.hidden.timeline, L);
  const items = Object.values(s.player.safety.techniques)
    .filter((t) => t.unlocked && techniqueRole(t) !== 'fix' && (t.coverage[trait] ?? 0) > 0)
    .map((t) => ({ agenda: t.agenda, d: (t.coverage[trait] ?? 0) * strengthBelieved(s, t, M) * believedPenalty(s, v, trait, t.family, L) }));
  return r2(clamp01(combineTools(items) * Math.sqrt(fte / 15)));
}

const INVESTIGATE: ActionDef = {
  id: 'safety.investigate', verb: 'respond', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Investigate',
  available: (s) => {
    const free = safetyReHeads(s) - investigationFte(s) - patchFte(s);
    return free >= INV_FTE[0] || `Not enough free safety research engineers (a case needs ${INV_FTE[0]}–${INV_FTE[1]})`;
  },
  preview(s, p) {
    const fte = Math.max(INV_FTE[0], Math.min(INV_FTE[1], num(p, 'fte') ?? 15));
    const inc = str(p, 'incidentId') ? s.player.safety.incidents.find((i) => i.id === str(p, 'incidentId')) : undefined;
    const t = defaultTarget(s);
    const versionId = inc?.versionId ?? str(p, 'versionId') ?? t?.versionId ?? '';
    const trait = isTrait(str(p, 'trait')) ? (str(p, 'trait') as TraitId) : inc && inc.apparent !== 'unexplained' && inc.apparent !== 'misuse' ? inc.apparent : t?.trait ?? 'SCHEME';
    const sab = believedSab(s);
    const ai = trustedShare(s);
    return {
      costs: [{ currency: 'staffTime', amount: fte, target: `safety research engineers for up to ${INV_MAX_DAYS} d (tool upkeep slows)` }, { currency: 'compute', amount: r2(5 * (num(p, 'computeShare') ?? 0.05)), target: '% of safety pool' }],
      gains: [{ currency: 'alignment', amount: investigationGain(s, versionId, trait, fte), target: `clarity / month on ${trait}` }],
      exposure: ai > 0 ? [{ currency: 'alignment', amount: -r2(ai * sab), probability: r2(clamp01(ai * sab * 0.4)), target: 'corrupted conclusion (estimate)' }] : [],
    };
  },
  apply(s, ctx, p) {
    const fte = Math.max(INV_FTE[0], Math.min(INV_FTE[1], num(p, 'fte') ?? 15));
    const tools = str(p, 'tools')?.split(',').filter(Boolean);
    const opts = { tools, computeShare: num(p, 'computeShare') };
    const incId = str(p, 'incidentId');
    let r;
    if (incId) r = openInvestigation(s, ctx, { kind: 'incident', incidentId: incId }, fte, opts);
    else {
      const t = defaultTarget(s);
      const versionId = str(p, 'versionId') ?? t?.versionId;
      const trait = isTrait(str(p, 'trait')) ? (str(p, 'trait') as TraitId) : t?.trait;
      if (!versionId || !trait) return void ctx.log('alert', 'Investigate: no model to investigate.');
      r = openInvestigation(s, ctx, { kind: 'trait', versionId, trait }, fte, opts);
    }
    if (typeof r === 'string') ctx.log('alert', `Investigation not opened: ${r}.`, 1);
  },
};

const CLOSE_CASE: ActionDef = {
  id: 'safety.closeCase', verb: 'respond', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Close case',
  available: (s) => s.player.safety.investigations.some((i) => !i.outcome) || 'No open investigation',
  preview(s, p) {
    const inv = s.player.safety.investigations.find((i) => i.id === str(p, 'id')) ?? s.player.safety.investigations.find((i) => !i.outcome);
    return {
      costs: [{ currency: 'alignment', amount: r2(1 - (inv?.clarity ?? 0)), target: 'clarity not reached' }],
      gains: [{ currency: 'staffTime', amount: inv?.fte ?? 0, target: 'safety research engineers freed for tool upkeep' }],
      exposure: [],
    };
  },
  apply(s, ctx, p) {
    const id = str(p, 'id') ?? s.player.safety.investigations.find((i) => !i.outcome)?.id;
    const err = id ? closeInvestigation(s, ctx, id) : 'No case';
    if (err) ctx.log('alert', `Close case: ${err}.`, 1);
  },
};

const RESPONSE_KINDS = Object.keys(RESPONSE_INFO) as ResponseKind[];

function respondPreview(s: GameStateV2, kind: ResponseKind, versionId: string | undefined, incidentId: string | undefined): Preview {
  const v = versionById(s, versionId) ?? internalVersion(s);
  const inc = incidentId ? s.player.safety.incidents.find((i) => i.id === incidentId) : undefined;
  const trait = v ? responseTrait(v, inc) : 'SCHEME';
  const est = v?.beliefs[trait]?.est ?? 0;
  const cred = s.relations.credibility;
  switch (kind) {
    case 'patchSignal':
      return {
        costs: [{ currency: 'staffTime', amount: 10, target: 'safety FTE for 30–90 d', lagDays: 60 }, { currency: 'progress', amount: -0.02, target: 'next post-run' }],
        gains: [{ currency: 'alignment', amount: r2(est * 0.15), target: `future growth of ${trait} × 0.3–0.6`, lagDays: 60 }],
        exposure: [],
      };
    case 'retrainAgainst':
      return {
        costs: [{ currency: 'monitorability', amount: -0.5, target: 'detector strength × (1 − G); adds a mask' }, { currency: 'staffTime', amount: 5, target: '14 d' }],
        gains: [{ currency: 'boardConf', amount: 3, target: `measured ${trait} −70–90%` }],
        exposure: [{ currency: 'alignment', amount: -0.1, probability: 1, target: 'hides, not heals: true level falls only 20–40%; obfuscation +' }],
      };
    case 'targetedTraining':
      return {
        costs: [{ currency: 'staffTime', amount: 10, target: '21–35 d' }, { currency: 'progress', amount: -0.02, target: 'next post-run' }],
        gains: [{ currency: 'alignment', amount: r2(est * 0.3), target: `${trait} reduced (technique-specific)` }],
        exposure: trait === 'SCHEME' || trait === 'AF' ? [{ currency: 'monitorability', amount: -0.1, probability: 0.8, target: 'eval awareness × 1.5 (E25)' }] : [],
      };
    case 'restrictContext':
      return {
        costs: [{ currency: 'revenue', amount: -0.5, target: 'channel revenue × 0.5' }],
        gains: [{ currency: 'approval', amount: 2, target: 'incident hazard × 0.3' }],
        exposure: [],
      };
    case 'addControl':
      return {
        costs: [{ currency: 'revenue', amount: -0.05, target: '5% usefulness tax' }, { currency: 'compute', amount: 2, target: '% for trusted monitors' }],
        gains: [{ currency: 'security', amount: 1, target: 'catastrophe conversion × (1 − Contain)' }],
        exposure: [],
      };
    case 'rollback':
      return {
        costs: [{ currency: 'progress', amount: -0.25, target: 'lose the newer model' }, { currency: 'leadDays', amount: -45 }],
        gains: [{ currency: 'alignment', amount: r2(est * 0.5), target: 'traits reset to the checkpoint' }],
        exposure: [{ currency: 'alignment', amount: -0.05, probability: 0.3, target: 'U-modes may predate the checkpoint' }],
      };
    case 'disclose':
      return {
        costs: [{ currency: 'scrutiny', amount: 3 + 2 * (inc?.severity ?? 2) }],
        gains: [{ currency: 'trust', amount: r2((3 * (cred - 30)) / 40), target: 'evalGov, exec, evaluators' }, { currency: 'credibility', amount: cred >= 30 ? 2 : 0 }],
        exposure: [{ currency: 'approval', amount: -(inc?.severity ?? 2), probability: 0.5, target: 'press coverage' }],
      };
  }
}

const RESPOND: ActionDef = {
  id: 'safety.respond', verb: 'respond', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Respond',
  available: (s) => s.player.models.versions.length > 0 || 'No models',
  preview(s, p) {
    const kind = (str(p, 'kind') as ResponseKind) ?? 'patchSignal';
    return respondPreview(s, RESPONSE_KINDS.includes(kind) ? kind : 'patchSignal', str(p, 'versionId'), str(p, 'incidentId'));
  },
  apply(s, ctx, p) {
    const kind = str(p, 'kind') as ResponseKind;
    if (!RESPONSE_KINDS.includes(kind)) return void ctx.log('alert', 'Respond: pick a response.');
    const inc = str(p, 'incidentId') ? s.player.safety.incidents.find((i) => i.id === str(p, 'incidentId')) : undefined;
    const versionId = str(p, 'versionId') ?? inc?.versionId ?? s.player.agents.capRoutine.versionId ?? '';
    const err = applyResponse(s, ctx, kind, versionId, inc?.id, { trait: isTrait(str(p, 'trait')) ? (str(p, 'trait') as TraitId) : undefined, techniqueId: str(p, 'techniqueId') });
    if (err) ctx.log('alert', `${RESPONSE_INFO[kind].title}: ${err}.`, 1);
  },
};

const PUBLISH: ActionDef = {
  id: 'safety.publish', verb: 'respond', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Publish',
  available: (s) => s.player.safety.findings.some((f) => !f.published) || 'Nothing unpublished',
  preview(s, p) {
    const f = s.player.safety.findings.find((x) => x.id === str(p, 'findingId')) ?? s.player.safety.findings.find((x) => !x.published);
    const disc = f?.type === 'DISC';
    return {
      costs: [{ currency: 'leadDays', amount: disc ? -3 : -5, target: 'rivals learn it too' }],
      gains: [{ currency: 'credibility', amount: 2 }, { currency: 'talent', amount: 1 }, { currency: 'alignment', amount: disc ? 0.04 : 0.02, target: "rivals' alignment (shared pool)" }],
      exposure: [{ currency: 'approval', amount: -1, probability: disc ? 0.3 : 0.05, target: 'model-organism papers raise public concern' }],
    };
  },
  apply(s, ctx, p) {
    const id = str(p, 'findingId') ?? s.player.safety.findings.find((x) => !x.published)?.id;
    if (!id) return void ctx.log('alert', 'Publish: nothing to publish.');
    publishFinding(s, ctx, id);
  },
};

const POLICY: ActionDef = {
  id: 'safety.publishPolicy', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Publish policy',
  available: () => true,
  preview(_s, p) {
    const pol = str(p, 'policy') ?? 'all';
    if (pol === 'all') return { costs: [{ currency: 'leadDays', amount: -10, target: 'per year, findings shared' }], gains: [{ currency: 'credibility', amount: 4, target: 'per year' }, { currency: 'talent', amount: 2 }], exposure: [] };
    if (pol === 'none') return { costs: [{ currency: 'credibility', amount: -3 }, { currency: 'talent', amount: -1 }], gains: [{ currency: 'leadDays', amount: 5, target: 'advantage kept' }], exposure: [{ currency: 'trust', amount: -3, probability: 0.2, target: 'evaluators find out' }] };
    return { costs: [{ currency: 'staffTime', amount: 1, target: 'review each finding' }], gains: [{ currency: 'leadDays', amount: 2 }], exposure: [] };
  },
  apply(s, ctx, p) {
    const pol = str(p, 'policy');
    if (pol !== 'none' && pol !== 'selective' && pol !== 'all') return void ctx.log('alert', 'Publish policy: none, selective or all.');
    s.player.policies.publishSafety = pol;
    ctx.log('company', `Safety publication policy: ${pol}.`, 1);
  },
};

const PLEDGE: ActionDef = {
  id: 'safety.pledge', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Monitorability pledge',
  available: (s) => !s.player.safety.monitorabilityCommitment || 'Already pledged',
  preview: () => ({
    costs: [{ currency: 'progress', amount: -0.4, target: 'no latent reasoning (forgo +0.4 Δp)' }, { currency: 'leadDays', amount: -30, target: 'vs rivals who adopt neuralese' }],
    gains: [{ currency: 'credibility', amount: 8 }, { currency: 'trust', amount: 4, target: 'evalGov, safety bloc' }, { currency: 'monitorability', amount: 0.5, target: 'obfuscation growth −50%' }],
    exposure: [{ currency: 'credibility', amount: -20, probability: 0.1, target: 'if broken' }],
  }),
  boardVector: [-0.3, -0.1, 0.6, 0.5],
  apply(s, ctx) {
    s.player.safety.monitorabilityCommitment = true;
    if (!s.commitments.some((c) => c.kind === 'monitorabilityPledge' && c.status === 'live')) {
      s.commitments.push({
        id: `C-mon-${ctx.day}`, kind: 'monitorabilityPledge', title: 'Monitorability pledge',
        condition: { predicate: 'monitorabilityPledge', params: {} }, audience: ['evalGov', 'evalIndep', 'bloc:safety'],
        breakCost: { trust: 15, credibility: 20 }, signedDay: ctx.day, status: 'live', amendments: 0,
      });
    }
    ctx.bump('relations.credibility', 8, 'monitorability pledge');
    ctx.bump('trust:evalGov', 4, 'monitorability pledge');
    ctx.log('company', 'We pledge to keep reasoning legible: no latent reasoning, no CoT pressure.', 3);
  },
};

const GATE_DAYS: Record<SafetyDept['evalGate'], number> = { none: 0, basic: 7, full: 14, fullPlusExternal: 30 };
const GATES = Object.keys(GATE_DAYS) as SafetyDept['evalGate'][];

const EVAL_GATE: ActionDef = {
  id: 'safety.evalGate', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Eval gate',
  available: () => true,
  preview(s, p) {
    const g = (str(p, 'level') as SafetyDept['evalGate']) ?? 'fullPlusExternal';
    const to = GATES.includes(g) ? g : 'fullPlusExternal';
    const d = GATE_DAYS[to] - GATE_DAYS[s.player.safety.evalGate];
    if (d >= 0) return { costs: [{ currency: 'leadDays', amount: -d, target: 'per external launch' }], gains: [{ currency: 'alignment', amount: r2(d / 60), target: 'pre-deployment clarity' }, { currency: 'credibility', amount: to === 'fullPlusExternal' ? 3 : 1 }], exposure: [] };
    return { costs: [{ currency: 'credibility', amount: -2 }, { currency: 'alignment', amount: r2(d / 60) }], gains: [{ currency: 'leadDays', amount: -d, target: 'per external launch' }], exposure: [{ currency: 'approval', amount: -3, probability: 0.2, target: 'incident after a rushed launch' }] };
  },
  apply(s, ctx, p) {
    const g = str(p, 'level') as SafetyDept['evalGate'];
    if (!GATES.includes(g)) return void ctx.log('alert', 'Eval gate: none, basic, full or fullPlusExternal.');
    s.player.safety.evalGate = g;
    ctx.log('company', `Pre-deployment eval gate: ${g}.`, 1);
  },
};

const TECHNIQUE: ActionDef = {
  id: 'safety.technique', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Safety stack',
  available: (s) => Object.values(s.player.safety.techniques).some((t) => t.unlocked && techniqueRole(t) !== 'fix') || 'No tools unlocked',
  preview(s, p) {
    const t = s.player.safety.techniques[str(p, 'id') ?? ''] ?? Object.values(s.player.safety.techniques).find((x) => x.unlocked && techniqueRole(x) !== 'fix');
    const on = p.active === undefined ? !t?.active : !!p.active;
    const L = measuredL(s);
    const d = t ? r2(strengthBelieved(s, t, mAtLevel(s.hidden.timeline, L))) : 0;
    const name = t ? TECHNIQUE_BY_ID[t.id]?.name ?? t.id : 'tool';
    if (on) return { costs: [{ currency: 'compute', amount: 0.5, target: '% of serving for monitors' }], gains: [{ currency: 'alignment', amount: d, target: `${name} strength` }], exposure: [] };
    return { costs: [{ currency: 'alignment', amount: -d, target: `${name} strength` }], gains: [{ currency: 'compute', amount: 0.5 }], exposure: [] };
  },
  apply(s, ctx, p) {
    const t = s.player.safety.techniques[str(p, 'id') ?? ''];
    if (!t?.unlocked) return void ctx.log('alert', 'Safety stack: unknown or locked tool.');
    t.active = p.active === undefined ? !t.active : !!p.active;
  },
};

export const SAFETY_ACTIONS: ActionDef[] = [INVESTIGATE, CLOSE_CASE, RESPOND, PUBLISH, POLICY, PLEDGE, EVAL_GATE, TECHNIQUE];

