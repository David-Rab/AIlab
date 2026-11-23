// Relations action catalog A1–F3 as ActionDefs, plus Security levers and Retire (V2-SPEC §3.9.2, §3.6, §5.1 #10;
// research/17 §1.4). Owner: WS4. All magnitudes are [D] calibrations; precedents are in research/17 §1.4.
// Every preview shows what apply() does (§2.7 preview truth, lint-tradeoffs); a lever with no cost shows none.
import { clamp } from '../../rng';
import { bestG, activeRivals } from '../models/labs';
import { addRivalKnowledge, recipeOf } from './rivalModel';
import { frontierGPerYear, PACE_WINDOW_DAYS } from '../models/capability';
import { publishFinding } from '../safety/findings';
import { reqSpend, WSL_TARGET_RANGE } from '../security/security';
import type { ActionDef, ActionVerb, CounterpartyId, GameStateV2, RivalLab, StructureSystem, SystemCtx } from '../types';
import { signCommitment, hasCommitment, frameworkPublished } from './commitments';
import { addCoverup } from './relations';
import {
  ALL_PUBLIC_CPS, L, bloc, cash, cred, grantAccess, grantFavor, hasFavor, morale, moraleSafety, pv, regStance, rivalMeter, scrutiny, spendFavor,
  talent, trust, trustMany, type Preview,
} from './fx';
import { govPresetOf } from './gov';
import { addPosture, archetypeOf, openAbsorbG, openWeightsReleased, ownProgressDays, publishLeakG, releaseRecG } from './rivals';
import { RECIPE_LEAK_SHARE, recipeLeakG, tacitLeakG } from '../production/diffusion';
import { ws4, ws4r } from './state';
import { changeHeads } from '../departments/teams';
import { addKnowledge, playerRecipeG } from '../models/stacks';

type P = Record<string, number | string | boolean>;

interface Spec {
  id: string;
  verb: ActionVerb;
  system: StructureSystem;
  title: string;
  sphere?: ActionDef['sphere'];
  /** Days before it can be used again (omitted = always available unless `once`). */
  cooldown?: number;
  once?: boolean;
  available?(s: GameStateV2): boolean | string;
  preview(s: GameStateV2, p: P): Preview;
  apply(s: GameStateV2, ctx: SystemCtx, p: P): void;
}

function def(x: Spec): ActionDef {
  return {
    id: x.id, verb: x.verb, system: x.system, sphere: x.sphere ?? 'relations', owner: 'WS4', title: x.title,
    available(s) {
      if (s.player.status !== 'active') return 'Company inactive';
      const last = ws4r(s).actionDay[x.id];
      if (last !== undefined && x.once) return 'Already done';
      if (last !== undefined && x.cooldown !== undefined && s.time.day - last < x.cooldown) return `Again in ${x.cooldown - (s.time.day - last)} d`;
      return x.available ? x.available(s) : true;
    },
    preview: x.preview,
    apply(s, ctx, p) {
      x.apply(s, ctx, p);
      ws4(s).actionDay[x.id] = s.time.day;
    },
  };
}

const num = (p: P, k: string, d: number) => (typeof p[k] === 'number' ? (p[k] as number) : typeof p[k] === 'string' && p[k] !== '' && !Number.isNaN(Number(p[k])) ? Number(p[k]) : d);
const str = (p: P, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);
const dealmakerMult = (s: GameStateV2) => (govPresetOf(s.gov.preset).id === 'dealmaker' ? 1.6 : 1);
/** RD-B19 (B40): A4's recipients, the active labs (China too) whose recipe is below the player's (RD-B16: recipeG at RECIPE_F). */
const publishRecipients = (s: GameStateV2): RivalLab[] => {
  const own = playerRecipeG(s); // RD-B16: the same recipeG at RECIPE_F as recipeOf
  return [...activeRivals(s), s.china.lab].filter((r) => r.core.status === 'active' && recipeOf(s, r) < own);
};
/** C6's release: the G of the weights (`behind` × 0.3 of a year of the player's own frontier-G slope below its best,
 *  RD-L03). RD-X04b: the recipe each active rival takes in is RECIPE_LEAK_SHARE.openWeights of its recipe gap to the
 *  recipe the weights reveal (releaseRecG). */
const openReleaseG = (s: GameStateV2, behind: number) => bestG(s, 'player') - Math.max(1, behind) * 0.3 * frontierGPerYear(s, 'player', PACE_WINDOW_DAYS);
/** C4's poached heads (3% of the rival's capabilities staff, at least 5). */
const poachHeads = (r: RivalLab) => Math.max(5, Math.round(r.core.staff.cap * 0.03));
/** RD-X04b: C4's tacit knowledge (OOM into the player's pretraining stack): tacitLeakG from the rival they left. */
const c4TacitG = (s: GameStateV2, r: RivalLab) => tacitLeakG(s, r.core.id, 'player', poachHeads(r), r.core.staff.cap);
/** RD-X04b: E1's leak to China (OOM of recipe): RECIPE_LEAK_SHARE.track2 of China's recipe gap to the player. */
const e1LeakG = (s: GameStateV2) => recipeLeakG(s, playerRecipeG(s), s.china.lab.core.id, RECIPE_LEAK_SHARE.track2);
const openRivalLeaks = (s: GameStateV2, recG: number) => activeRivals(s).map((r) => ({ r, dG: recipeLeakG(s, recG, r.core.id, RECIPE_LEAK_SHARE.openWeights) })).filter((x) => x.dG > 0);
/** The most days of its own progress any of `leaks` gives its lab (the preview's lead line). */
const maxOwnDays = (s: GameStateV2, leaks: { r: RivalLab; dG: number }[]) => Math.round(Math.max(0, ...leaks.map((x) => ownProgressDays(s, x.r.core.id, x.dG))));

const rivalCps = (s: GameStateV2): CounterpartyId[] => activeRivals(s).map((r) => `rival:${r.core.id}` as CounterpartyId);

/** Default poach target: the active rival closest behind (or ahead of) the player. */
function poachTarget(s: GameStateV2, p: P) {
  const want = str(p, 'lab', '');
  const act = activeRivals(s);
  return act.find((r) => r.core.id === want) ?? [...act].sort((a, b) => Math.abs(bestG(s, 'player') - bestG(s, a.core.id)) - Math.abs(bestG(s, 'player') - bestG(s, b.core.id)))[0];
}

export const RELATION_ACTIONS: ActionDef[] = [
  // ───────── A. Testing and transparency ─────────
  def({
    id: 'A1', verb: 'policy', system: 'relations', title: 'Pre-deploy testing',
    available: (s) => (hasCommitment(s, 'preDeployTesting') ? 'Already signed' : true),
    preview: () => pv([L('leadDays', 21, 'each frontier launch'), L('staffTime', 5)], [L('trust', 8, 'exec'), L('trust', 6, 'evalGov'), L('credibility', 2)], [L('security', 15, 'gov awareness → security demand', { lagDays: 30 })]),
    apply(s, ctx) {
      signCommitment(s, ctx, 'testingAgreement', 'Pre-deployment testing with government evaluators', 'preDeployTesting', { days: 21 }, ['evalGov', 'exec'], { trust: 8, credibility: 10 });
      trust(s, ctx, 'exec', 8, 'A1 testing agreement');
      trust(s, ctx, 'evalGov', 6, 'A1 testing agreement');
      cred(ctx, 2, 'A1 testing agreement');
      grantAccess(s, 'evalGov', 3);
      ctx.bump('gov.awareness', 15, 'A1 testing agreement');
      bloc(s, ctx, 'safety', 5, 0, 'A1');
      bloc(s, ctx, 'measurers', 5, 0, 'A1');
    },
  }),
  def({
    id: 'A2', verb: 'policy', system: 'relations', title: 'Evaluator access', once: true,
    preview: () => pv([L('leadDays', 30, 'early access'), L('compute', 0.5)], [L('credibility', 5, undefined, { probability: 0.7 }), L('trust', 8, 'evalIndep')], [L('credibility', -15, 'report contradicts claims', { probability: 0.3, lagDays: 45 })]),
    apply(s, ctx) {
      grantAccess(s, 'evalIndep', 2);
      trust(s, ctx, 'evalIndep', 8, 'A2 evaluator access');
      bloc(s, ctx, 'measurers', 8, 0, 'A2');
      s.researchBodies.evalIndep.queue.push('player');
    },
  }),
  def({
    id: 'A3', verb: 'policy', system: 'relations', title: 'Publish framework',
    available: (s) => (frameworkPublished(s) ? 'Framework already live' : true),
    preview: () => pv([L('freedom', 1, 'thresholds bind')], [L('credibility', 5), L('approval', 6, 'bloc:safety')], [L('credibility', -8, 'moving goalposts if relaxed', { probability: 0.3 })]),
    // RF-S2 (review safety #4, decision 9): publishing = committing to your Safety framework's rules (safety/framework.ts);
    // its holds enforce them and an override is the visible departure (its credibility cost once published). The old
    // BIO ≥ 10 pledge (noDeployAbove) and the pause pledge (pauseIfRedline) are gone: both are framework rules.
    apply(s, ctx) {
      signCommitment(s, ctx, 'framework', 'Published Safety framework', 'safetyFramework', {}, ['evalGov', 'evalIndep', 'exec', 'bloc:safety'], { trust: 8, credibility: 15 });
      cred(ctx, 5, 'A3 framework published');
      bloc(s, ctx, 'safety', 6, 0, 'A3');
    },
  }),
  def({
    id: 'A4', verb: 'policy', system: 'relations', title: 'Publish research', cooldown: 90,
    // RD-B19 (B40): the lead line is the recipe A4 applies (publishLeakG) in days of each recipient's own progress.
    preview: (s) => pv([L('leadDays', maxOwnDays(s, publishRecipients(s).map((r) => ({ r, dG: publishLeakG(s, r.core.id) }))), `days of progress into the recipes of ${publishRecipients(s).length} labs behind you (at their next model)`)], [L('credibility', 3), L('talent', 2), L('trust', 3, 'academia')], [L('approval', -1, 'model-organism papers raise concern', { probability: 0.3 }), L('alignment', s.knowledge.sharedTechniquePool < 0.9 ? 0.03 : 0, 'shared technique pool (all labs)')]),
    apply(s, ctx) {
      const w = ws4(s);
      // RD-X04b: recipe leak (OOM), a share of each recipient's recipe gap to the player (recipe with recipe).
      for (const r of publishRecipients(s)) addRivalKnowledge(r, publishLeakG(s, r.core.id));
      s.knowledge.sharedTechniquePool = clamp(s.knowledge.sharedTechniquePool + 0.03, 0, 1);
      const f = s.player.safety.findings.find((x) => !x.published);
      if (f) publishFinding(s, ctx, f.id);
      w.papers++;
      cred(ctx, 3, 'A4 safety research published');
      talent(ctx, 2, 'A4 safety research published');
      trust(s, ctx, 'academia', 3, 'A4');
      ctx.bump('pub.concern', 1, 'A4 model-organism papers');
    },
  }),
  def({
    id: 'A5', verb: 'policy', system: 'relations', title: 'Bug bounty', once: true,
    preview: () => pv([L('cash', 0.05, 'per year')], [L('credibility', 1), L('security', 0.1, 'misuse detection')]),
    apply(s, ctx) {
      s.flags['ws4:bugBounty'] = true;
      cash(s, ctx, -0.05, 'A5 bug bounty');
      cred(ctx, 1, 'A5 bug bounty');
    },
  }),
  def({
    id: 'A6', verb: 'policy', system: 'relations', title: 'Whistleblower channel',
    available: (s) => (s.player.policies.whistleblowerChannel ? 'Channel already open' : true),
    preview: () => pv([L('staffTime', 3, 'handling reports')], [L('talent', 3), L('morale', 5, 'safety staff'), L('trust', 2, 'insider concerns handled internally, not leaked')]),
    apply(s, ctx) {
      s.player.policies.whistleblowerChannel = true;
      signCommitment(s, ctx, 'whistleblower', 'Right-to-warn whistleblower channel', 'whistleblower', {}, ['bloc:safety', 'evalIndep'], { trust: 6, credibility: 10 });
      talent(ctx, 3, 'A6 whistleblower channel');
      moraleSafety(ctx, 5, 'A6 whistleblower channel');
      bloc(s, ctx, 'safety', 4, 0, 'A6');
    },
  }),
  // ───────── B. Government ─────────
  def({
    id: 'B1', verb: 'deal', system: 'relations', title: 'Loss-leader contract', cooldown: 365,
    preview: (s) => pv([L('revenue', Math.max(0.1, s.player.finance.revenueRun * 0.02), 'priced at $1 for a year'), L('cash', 0.3, 'serving cost')], [L('trust', 5, 'exec')], [L('trust', -3, 'favors decay when price normalises', { lagDays: 365 })]),
    apply(s, ctx) {
      const st = s.relations.stocks.exec;
      st.depOnYou = Math.min(100, st.depOnYou + 15);
      grantAccess(s, 'exec', 2);
      grantFavor(s, 'exec');
      trust(s, ctx, 'exec', 5, 'B1 loss-leader contract');
      cash(s, ctx, -0.3, 'B1 loss-leader contract');
    },
  }),
  def({
    id: 'B2', verb: 'deal', system: 'relations', title: 'Defense contract', once: true,
    preview: (_s, p) => (str(p, 'terms', 'limits') === 'unrestricted'
      ? pv([L('morale', 12, 'safety staff'), L('approval', 8, 'bloc:civlib')], [L('cash', 1, 'contract value'), L('trust', 8, 'exec')], [L('chinaTension', 5, 'China hawk +5')])
      : pv([L('morale', 6, 'safety staff'), L('revenue', 0.5, 'half the contract')], [L('cash', 0.5), L('trust', 3, 'exec')], [L('trust', -15, 'retaliation roll (0.35)', { probability: 0.35 })])),
    apply(s, ctx, p) {
      const w = ws4(s);
      const terms = str(p, 'terms', 'limits');
      w.defenseContract = terms === 'unrestricted' ? 'unrestricted' : 'limits';
      grantAccess(s, 'exec', 3);
      ctx.bump('china.meters.hawkDove', 5, 'B2 defense contract');
      if (terms === 'unrestricted') {
        w.unrestrictedDefense = true;
        cash(s, ctx, 1, 'B2 defense contract');
        trust(s, ctx, 'exec', 8, 'B2 defense contract');
        moraleSafety(ctx, -12, 'B2 defense contract');
        bloc(s, ctx, 'defense', 10, 0, 'B2');
        bloc(s, ctx, 'civlib', -8, 5, 'B2');
      } else {
        cash(s, ctx, 0.5, 'B2 defense contract (limits)');
        trust(s, ctx, 'exec', 3, 'B2 defense contract (limits)');
        moraleSafety(ctx, -6, 'B2 defense contract (limits)');
        signCommitment(s, ctx, 'usageRestriction', 'No mass surveillance or autonomous weapons', 'noSurveillance', {}, ['bloc:civlib', 'bloc:safety'], { trust: 6, credibility: 10 });
        bloc(s, ctx, 'civlib', 6, 0, 'B2');
        const pre = govPresetOf(s.gov.preset).id;
        if ((pre === 'dealmaker' || pre === 'hawk') && ctx.rng('actors').chance(0.35)) {
          trust(s, ctx, 'exec', -5, 'retaliation: supply-chain-risk designation');
          ctx.log('gov', 'The Pentagon labels you a supply-chain risk for refusing some uses.', 3);
          s.flags['ws4:blacklisted'] = true;
        }
      }
    },
  }),
  def({
    id: 'B3', verb: 'hire', system: 'relations', title: 'Hire officials', cooldown: 365,
    preview: () => pv([L('cash', 0.02), L('scrutiny', 5)], [L('trust', 3, 'exec')], [L('scrutiny', 8, '"unfair access" press', { probability: 0.3 })]),
    apply(s, ctx) {
      cash(s, ctx, -0.02, 'B3 former officials');
      scrutiny(ctx, 5, 'B3 former officials');
      const cap = ws4(s).accessCap.exec ?? 0;
      grantAccess(s, 'exec', Math.min(4, Math.max(cap, s.relations.stocks.exec.access) + 1));
      grantFavor(s, 'exec');
      trust(s, ctx, 'exec', 3, 'B3 former officials');
      if (ctx.rng('actors').chance(0.3)) scrutiny(ctx, 8, 'unfair-access story');
    },
  }),
  def({
    id: 'B4', verb: 'deal', system: 'relations', title: 'Lobby', cooldown: 91,
    preview: (s, p) => {
      const dereg = str(p, 'direction', 'deregulate') === 'deregulate';
      return pv([L('cash', 0.05), L('approval', 6, dereg ? 'bloc:safety' : 'bloc:accel')], [L('trust', 3, 'exec')], [L('scrutiny', 10, 'exposure', { probability: clamp(s.relations.scrutiny / 200, 0, 1) })]);
    },
    apply(s, ctx, p) {
      const dereg = str(p, 'direction', 'deregulate') === 'deregulate';
      cash(s, ctx, -0.05, 'B4 lobbying');
      regStance(s, ctx, (dereg ? -10 : 10) * dealmakerMult(s), 'B4 lobbying');
      trust(s, ctx, 'exec', dereg ? 3 : 1, 'B4 lobbying');
      if (dereg) {
        bloc(s, ctx, 'accel', 6, 0, 'B4');
        bloc(s, ctx, 'bigtech', 4, 0, 'B4');
        bloc(s, ctx, 'safety', -6, 5, 'B4');
      } else {
        bloc(s, ctx, 'safety', 6, 0, 'B4');
        bloc(s, ctx, 'accel', -6, 5, 'B4');
      }
      addCoverup(s, 'lobbying money', clamp(s.relations.scrutiny / 200, 0, 1), ['states', 'congress'], 91);
    },
  }),
  def({
    id: 'B5', verb: 'deal', system: 'relations', title: 'Voluntary accord',
    available: (s) => (hasCommitment(s, 'incidentReporting') ? 'Already signed' : true),
    preview: () => pv([L('freedom', 1, '72-hour incident reporting')], [L('trust', 3, 'many')], [L('trust', -3, 'small but broad break cost', { probability: 0.2 })]),
    apply(s, ctx) {
      signCommitment(s, ctx, 'voluntaryAccord', 'Frontier safety accord: report incidents within 72 hours', 'incidentReporting', { hours: 72 }, [...ALL_PUBLIC_CPS], { trust: 3, credibility: 5 });
      trustMany(s, ctx, ALL_PUBLIC_CPS, 3, 'B5 voluntary accord');
      s.gov.statutes.euCode = true;
    },
  }),
  def({
    id: 'B6', verb: 'respond', system: 'relations', title: 'Sue', cooldown: 180,
    preview: (s, p) => pv([L('cash', 0.05), L('scrutiny', 8)], [L('trust', str(p, 'target', 'gov') === 'gov' ? 0 : 0, 'courts')], [L('approval', -5, 'sympathy backlash', { probability: str(p, 'target', 'gov') === 'critics' ? 0.8 : 0.2 }), L('freedom', 1, `injunction odds ${Math.round(s.gov.judicialCheck)}%`, { probability: s.gov.judicialCheck / 100 })]),
    apply(s, ctx, p) {
      cash(s, ctx, -0.05, 'B6 lawsuit');
      scrutiny(ctx, 8, 'B6 lawsuit');
      const win = ctx.rng('actors').chance(s.gov.judicialCheck / 100);
      if (str(p, 'target', 'gov') === 'critics') {
        ctx.bump('pub.approval', -5, 'suing critics');
        bloc(s, ctx, 'safety', -10, 15, 'B6');
        bloc(s, ctx, 'measurers', -6, 10, 'B6');
      } else {
        trust(s, ctx, 'exec', -6, 'B6 suing the government');
        if (win && s.flags['ws4:blacklisted']) {
          delete s.flags['ws4:blacklisted'];
          ctx.log('gov', 'A court enjoins the supply-chain-risk designation.', 2);
        }
      }
    },
  }),
  def({
    id: 'B7', verb: 'deal', system: 'relations', title: 'Brief officials',
    preview: (s, p) => {
      const lvl = clamp(Math.round(num(p, 'level', Math.min(3, s.player.policies.govBriefing + 1))), 0, 3);
      const up = lvl - s.player.policies.govBriefing;
      return up >= 0
        ? pv([L('security', 6 * Math.max(1, up), 'gov sees more → security demand'), L('freedom', Math.max(1, up) * 0.5)], [L('trust', 4 * Math.max(1, up), 'exec')])
        : pv([L('trust', 6, 'exec')], [L('freedom', 1)]);
    },
    apply(s, ctx, p) {
      const old = s.player.policies.govBriefing;
      const lvl = clamp(Math.round(num(p, 'level', Math.min(3, old + 1))), 0, 3) as 0 | 1 | 2 | 3;
      s.player.policies.govBriefing = lvl;
      if (lvl > old) {
        trust(s, ctx, 'exec', 4 * (lvl - old), 'B7 briefing');
        ctx.bump('gov.securityDemand', 3 * (lvl - old), 'B7 briefing');
        ctx.bump('gov.aiPriority', 3 * (lvl - old), 'B7 briefing');
        grantAccess(s, 'exec', Math.max(1, lvl));
      } else if (lvl < old) trust(s, ctx, 'exec', -3 * (old - lvl), 'B7 briefings cut');
    },
  }),
  // ───────── C. Rivals ─────────
  def({
    id: 'C1', verb: 'deal', system: 'relations', title: 'Share threat intel', once: true,
    preview: () => pv([L('security', 1, 'reveals detection methods'), L('trust', 5, 'china')], [L('trust', 5, 'rivals'), L('leadDays', 10, 'China distillation −10')]),
    apply(s, ctx) {
      s.flags['ws4:threatIntel'] = true;
      ctx.bump('china.meters.distillationAccess', -10, 'C1 shared threat intel');
      for (const cp of rivalCps(s)) trust(s, ctx, cp, 5, 'C1 shared threat intel');
      for (const r of activeRivals(s)) rivalMeter(s, ctx, r.core.id, 'cooperation', 10, 'C1');
      trust(s, ctx, 'china', -5, 'C1 shared threat intel');
      bloc(s, ctx, 'hawks', 3, 0, 'C1');
    },
  }),
  def({
    id: 'C2', verb: 'policy', system: 'relations', title: 'Restrict adversaries', once: true,
    preview: (s) => pv([L('revenue', Math.max(0.01, s.player.finance.revenueRun * 0.01), '−1%'), L('trust', 5, 'china')], [L('approval', 5, 'bloc:hawks'), L('leadDays', 5, 'less distillation')]),
    apply(s, ctx) {
      s.flags['ws4:restrictAdversary'] = true;
      cash(s, ctx, -s.player.finance.revenueRun * 0.01, 'C2 restricted entities');
      bloc(s, ctx, 'hawks', 5, 0, 'C2');
      trust(s, ctx, 'china', -5, 'C2 restricted entities');
    },
  }),
  def({
    id: 'C3', verb: 'deal', system: 'relations', title: 'Joint evals', cooldown: 91,
    preview: () => pv([L('staffTime', 4)], [L('trust', 6, 'rivals'), L('alignment', 0.05, 'rivals eval rigor')], [L('scrutiny', 5, 'maverick cries "cartel"', { probability: 0.5 })]),
    apply(s, ctx) {
      for (const r of activeRivals(s)) {
        addPosture(s, r.core.id, 'evalRigor', 0.05);
        const a = archetypeOf(r.archetype).id;
        rivalMeter(s, ctx, r.core.id, 'cooperation', a === 'safety' ? 30 : a === 'bigtech' ? 10 : a === 'maverick' ? -10 : 5, 'C3 joint evals');
        trust(s, ctx, `rival:${r.core.id}`, a === 'maverick' ? -2 : 4, 'C3 joint evals');
        if (a === 'maverick') scrutiny(ctx, 5, 'antitrust: "safety cartel"', r.core.name);
      }
      s.knowledge.sharedTechniquePool = clamp(s.knowledge.sharedTechniquePool + 0.02, 0, 1);
      cred(ctx, 2, 'C3 joint evals');
    },
  }),
  def({
    id: 'C4', verb: 'hire', system: 'people', title: 'Poach', cooldown: 180,
    available: (s) => (activeRivals(s).length ? true : 'No active rivals'),
    preview: (s, p) => {
      const r = poachTarget(s, p);
      return pv([L('cash', 0.5), L('trust', 20, r ? `rival:${r.core.id}` : 'rivals')], [L('talent', 4), L('leadDays', r ? Math.round(ownProgressDays(s, 'player', c4TacitG(s, r))) : 0, r ? `days of your own progress: tacit recipe from ${r.core.name}` : undefined)], [L('cash', -0.5, 'trade-secret suit', { probability: 0.2 }), L('morale', -3, 'culture dilution')]);
    },
    apply(s, ctx, p) {
      const r = poachTarget(s, p);
      if (!r) return;
      cash(s, ctx, -0.5, 'C4 poaching', r.core.name);
      const n = poachHeads(r);
      // RD-X04b: tacit knowledge (c4TacitG, sized before the heads move) enters the pretraining stack as public ideas.
      const tacit = c4TacitG(s, r);
      r.core.staff.cap = Math.max(0, r.core.staff.cap - n);
      changeHeads(s, 'cap', n);
      addKnowledge(s, ctx, tacit, 'C4 tacit knowledge', r.core.name);
      rivalMeter(s, ctx, r.core.id, 'cooperation', -20, 'C4 poaching');
      rivalMeter(s, ctx, r.core.id, 'poachAggression', 20, 'C4 poaching');
      trust(s, ctx, `rival:${r.core.id}`, -10, 'C4 poaching');
      talent(ctx, 4, 'C4 poaching');
      morale(ctx, -3, 'culture dilution', r.core.name);
      if (ctx.rng('actors').chance(0.2)) cash(s, ctx, -0.5, 'trade-secret suit', r.core.name);
    },
  }),
  def({
    id: 'C6', verb: 'launch', system: 'models', title: 'Open weights', cooldown: 180,
    // RD-B19 (B40): the lead lines are what apply adds: each rival's recipe (openRivalLeaks) and China's absorbed months
    // (openWeightsReleased → openAbsorbMonths), in days of their own progress; none if the weights are not above the
    // open frontier for China. The China-tension line went: nothing applies it.
    preview: (s, p) => {
      const G = openReleaseG(s, num(p, 'behind', 1));
      const recG = releaseRecG(s, 'player', G);
      const cn = G > s.knowledge.openWeightsG ? Math.round(ownProgressDays(s, s.china.lab.core.id, openAbsorbG(s, recG))) : 0;
      return pv([L('leadDays', maxOwnDays(s, openRivalLeaks(s, recG)), "days of progress into the best-placed rival's recipe (at its next model)"), L('leadDays', cn, "days of China's own progress: it absorbs the weights"), L('approval', 8, 'bloc:hawks')], [L('approval', 8, 'bloc:accel'), L('credibility', 2, 'open science')], [L('scrutiny', 3)]);
    },
    apply(s, ctx, p) {
      const G = openReleaseG(s, num(p, 'behind', 1));
      // RD-X04b: recipe gap to what the weights reveal; RECIPE_LEAK_SHARE.openWeights of it enters each rival's recipe.
      const recG = releaseRecG(s, 'player', G);
      for (const { r, dG } of openRivalLeaks(s, recG)) addRivalKnowledge(r, dG);
      openWeightsReleased(s, ctx, 'player', G, recG);
      bloc(s, ctx, 'accel', 8, 0, 'C6 open weights');
      bloc(s, ctx, 'measurers', 4, 0, 'C6 open weights');
      bloc(s, ctx, 'hawks', -8, 5, 'C6 open weights');
      cred(ctx, 2, 'C6 open science');
      scrutiny(ctx, 3, 'C6 open weights');
    },
  }),
  // ───────── D. Research bodies and academia ─────────
  def({
    id: 'D1', verb: 'deal', system: 'relations', title: 'Academic grant', cooldown: 365,
    preview: () => pv([L('cash', 0.05), L('compute', 0.5)], [L('talent', 3, undefined, { lagDays: 270 }), L('trust', 8, 'academia')], [L('credibility', -2, 'academics publish what they find', { probability: 0.3 })]),
    apply(s, ctx) {
      cash(s, ctx, -0.05, 'D1 academic grant');
      grantAccess(s, 'academia', 1);
      trust(s, ctx, 'academia', 8, 'D1 academic grant');
      talent(ctx, 1, 'D1 academic grant');
    },
  }),
  def({
    id: 'D2', verb: 'deal', system: 'relations', title: 'Safety fellowship', cooldown: 365,
    preview: () => pv([L('cash', 0.02, '$15k compute per fellow-month'), L('security', 0.05, 'leak risk')], [L('talent', 2, 'safety pipeline'), L('credibility', 1)]),
    apply(s, ctx) {
      cash(s, ctx, -0.02, 'D2 safety fellowship');
      talent(ctx, 2, 'D2 safety fellowship');
      cred(ctx, 1, 'D2 safety fellowship');
      bloc(s, ctx, 'safety', 3, 0, 'D2');
      ws4(s).papers++;
    },
  }),
  // D3 "License data" moved to the data actions (model v3 D2, production/dataActions.ts data.license: by domain, or
  // domain 'web' for the crawl).
  // ───────── E. China ─────────
  def({
    id: 'E1', verb: 'deal', system: 'relations', title: 'Track-2 dialogue', cooldown: 180,
    preview: (s) => pv([L('staffTime', 2), L('approval', 3, 'bloc:hawks')], [L('trust', 5, 'china'), L('chinaTension', 3)], [L('leadDays', -Math.round(ownProgressDays(s, s.china.lab.core.id, e1LeakG(s))), "small leak: days of China's own progress")]),
    apply(s, ctx) {
      ctx.bump('china.meters.safetyConcern', 4, 'E1 Track-2 dialogue');
      ctx.bump('china.meters.normsDiplomacy', 5, 'E1 Track-2 dialogue');
      trust(s, ctx, 'china', 5, 'E1 Track-2 dialogue');
      grantAccess(s, 'china', 1);
      bloc(s, ctx, 'hawks', -3, 0, 'E1');
      addRivalKnowledge(s.china.lab, e1LeakG(s));
    },
  }),
  def({
    id: 'E2', verb: 'deal', system: 'relations', title: 'Gov-gov agreement', cooldown: 365,
    available: (s) => (s.relations.stocks.exec.trust >= 45 || hasFavor(s, 'exec') ? true : 'Needs exec trust ≥ 45 or a favor'),
    preview: (s) => pv([hasFavor(s, 'exec') ? L('trust', 0, 'spend an exec favor') : L('trust', 3, 'exec'), L('approval', 5, 'bloc:hawks')], [L('chinaTension', 5, 'China D-track step')], [L('chinaTension', -5, 'fails if linked to export controls', { probability: Number(s.flags['ws4:exportLobby'] ?? 0) > 0 ? 0.8 : 0.1 })]),
    apply(s, ctx) {
      if (!spendFavor(s, 'exec')) trust(s, ctx, 'exec', -3, 'E2 spent political capital');
      bloc(s, ctx, 'hawks', -5, 0, 'E2');
      if (Number(s.flags['ws4:exportLobby'] ?? 0) > 0 && ctx.rng('actors').chance(0.8)) {
        ctx.bump('china.meters.normsDiplomacy', -5, 'talks linked to export controls (R11)');
        ctx.log('china', 'Beijing rejects talks tied to export controls.', 2);
        return;
      }
      ws4(s).usProposedTalks = true;
      ctx.bump('china.meters.normsDiplomacy', 10, 'E2 narrow agreement (R10)');
      grantAccess(s, 'china', 2);
    },
  }),
  def({
    id: 'E3', verb: 'deal', system: 'relations', title: 'Lobby export controls', cooldown: 182,
    preview: (_s, p) => (str(p, 'direction', 'tighten') === 'tighten'
      ? pv([L('trust', 10, 'china'), L('chinaTension', 5)], [L('approval', 8, 'bloc:hawks'), L('leadDays', 20, 'China compute growth slows')], [L('cash', -0.2, 'rare-earth retaliation', { probability: 0.4 })])
      : pv([L('approval', 8, 'bloc:hawks')], [L('approval', 8, 'bloc:chip'), L('trust', 5, 'china')], [L('leadDays', -15, 'China gets more chips')])),
    apply(s, ctx, p) {
      const t = str(p, 'direction', 'tighten') === 'tighten';
      s.flags['ws4:exportLobby'] = t ? 1 : -1;
      if (t) {
        trust(s, ctx, 'china', -10, 'E3 export-control lobbying');
        ctx.bump('china.meters.taiwanTension', 5, 'E3 export-control lobbying');
        bloc(s, ctx, 'hawks', 8, 0, 'E3');
        bloc(s, ctx, 'chip', -8, 5, 'E3');
        ctx.bump('gov.hawkishness', 5, 'E3 export-control lobbying');
        if (ctx.rng('actors').chance(0.4)) cash(s, ctx, -0.2, 'rare-earth retaliation');
      } else {
        bloc(s, ctx, 'chip', 8, 0, 'E3');
        bloc(s, ctx, 'hawks', -8, 5, 'E3');
        trust(s, ctx, 'china', 5, 'E3 export-control lobbying');
        ctx.bump('gov.hawkishness', -5, 'E3 export-control lobbying');
      }
    },
  }),
  // ───────── F. Public ─────────
  // F1 (community benefits) merged into the compute action cmp.community (FIN1, spec §4: upfront package with a
  // company default).
  // F2 (transition fund) is WS5's wfx.transitionFund: one implementation, charged by WS3's payroll.
  def({
    id: 'F3', verb: 'policy', system: 'world', title: 'No drop-in agents', once: true,
    preview: (s) => pv([L('revenue', Math.max(0.05, s.player.finance.revenueRun * 0.05), 'α ≤ 0.5 in chosen sectors')], [L('approval', 10, 'bloc:labor')]),
    apply(s, ctx) {
      for (const d of s.player.deployments) d.usagePolicy.noDropInReplacement = true;
      bloc(s, ctx, 'labor', 10, 0, 'F3');
      ctx.bump('pub.approval', 2, 'F3 no drop-in agents');
    },
  }),
  // ───────── Security sphere (§3.6) ─────────
  def({
    id: 'SEC_TARGET', verb: 'policy', system: 'relations', title: 'Security target', sphere: 'security',
    preview: (s, p) => {
      const sec = s.player.security;
      const t = clamp(num(p, 'level', Math.min(WSL_TARGET_RANGE[1], sec.target + 0.5)), WSL_TARGET_RANGE[0], WSL_TARGET_RANGE[1]);
      const spend = reqSpend(t, s.player.computeOnline) * 1.05;
      return pv([L('cash', Math.max(0, spend - sec.spendRate), '$B/yr more'), L('staffTime', 1)], [L('security', t - sec.wsl, `WSL → ${t.toFixed(1)} at ≤ 0.006/day`)]);
    },
    apply(s, _ctx, p) {
      const sec = s.player.security;
      sec.target = clamp(num(p, 'level', Math.min(WSL_TARGET_RANGE[1], sec.target + 0.5)), WSL_TARGET_RANGE[0], WSL_TARGET_RANGE[1]);
      sec.spendRate = Math.round(reqSpend(sec.target, s.player.computeOnline) * 1.05 * 1000) / 1000;
    },
  }),
  def({
    id: 'SEC_SILO', verb: 'policy', system: 'relations', title: 'Siloing', sphere: 'security',
    preview: (s, p) => {
      const lvl = clamp(Math.round(num(p, 'level', Math.min(2, s.player.security.siloing + 1))), 0, 2);
      const d = lvl - s.player.security.siloing;
      return d >= 0 ? pv([L('progress', 5 * Math.max(1, d), 'research speed', { unit: '%' }), L('morale', 3 * Math.max(1, d))], [L('security', 0.3 * Math.max(1, d), 'spies ×0.7 per level')]) : pv([L('security', 0.3)], [L('progress', 5, 'research speed', { unit: '%' }), L('morale', 2)]);
    },
    apply(s, ctx, p) {
      const sec = s.player.security;
      const lvl = clamp(Math.round(num(p, 'level', Math.min(2, sec.siloing + 1))), 0, 2) as 0 | 1 | 2;
      if (lvl > sec.siloing) morale(ctx, -3 * (lvl - sec.siloing), 'siloing');
      sec.siloing = lvl;
    },
  }),
  def({
    id: 'SEC_CI', verb: 'policy', system: 'relations', title: 'Counter-intel', sphere: 'security',
    available: (s) => (s.player.security.counterIntel >= 0.9 ? 'At maximum' : true),
    preview: () => pv([L('cash', 0.1, 'per year')], [L('security', 0.2, 'theft detection')]),
    apply(s) {
      const sec = s.player.security;
      sec.counterIntel = Math.min(1, sec.counterIntel + 0.2);
      sec.spendRate = Math.round((sec.spendRate + 0.1) * 1000) / 1000;
    },
  }),
  // ───────── Retire (§5.1 #10: always available) ─────────
  def({
    id: 'RETIRE', verb: 'respond', system: 'core', title: 'Retire', sphere: 'relations',
    // F6c: no placeholder level: retiring ends the game now (endings.ts 'retired', scored as a loss).
    preview: () => pv([L('freedom', 1, 'you hand over the company: the game ends (Retired, scored as a loss) and the race goes on without you')], []),
    apply(s) {
      ws4(s).retired = true;
    },
  }),
];

