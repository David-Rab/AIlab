// Event catalog: safety decisions (V2-SPEC §4.2: E01, E17, E18, E19, E21, E25, E30, E33, E35). Owner: WS4 (content
// shared with WS2). The disclosure dilemma (§3.9.3 rule 1) is the backbone: disclose / fix quietly / deny.
import { clamp } from '../../../rng';
import { withdraw } from '../../models/deployments';
import { internalVersion } from '../../models/labs';
import { flag, flagNum } from '../../safety/common';
import { openIncidents } from '../../safety/incidents';
import { openInvestigation } from '../../safety/investigations';
import { understanding } from '../../safety/understanding';
import { revealToWorld } from '../../safety/umodes';
import type { Commitment, EventDefV2, GameStateV2, ModelVersion, SystemCtx, TraitId, UModeId } from '../../types';
import { TRAIT_BY_ID } from '../../../../data/v2/traits';
import { PREDICATES, blockingCommitments, amendCommitment, breakCommitment, hasCommitment, latentVersion, pledgeBreachRun } from '../../actors/commitments';
import { ALL_PUBLIC_CPS, approval, boardConf, cash, cred, disclosureTrust, moraleSafety, scrutiny, trustMany } from '../../actors/fx';
import { pLeak } from '../../actors/public';
import { addCoverup } from '../../actors/relations';
import { discoveryOdds } from '../../actors/researchBodies';
import { ws4 } from '../../actors/state';
import { L, P, ch, ev, pv, requestOnly } from '../kit';
import { boardSpeedAppetite } from '../../finance/board';

const RED: TraitId[] = ['SCHEME', 'AF', 'SAND'];

/** The disclosure-dilemma triple used by findings, incidents and U-mode discoveries. */
function dilemma(what: string, credGain: number, scrut: number) {
  return [
    ch('Disclose', ['disclose', 'safety'], (s) => ({ costs: [L('scrutiny', scrut)], gains: [L('credibility', credGain), L('trust', 4 * (s.relations.credibility / 50), 'gov, evaluators')], exposure: [] }), (s: GameStateV2, ctx: SystemCtx) => {
      cred(ctx, credGain, `disclosed ${what}`);
      scrutiny(ctx, scrut, `disclosed ${what}`);
      disclosureTrust(s, ctx, ['exec', 'evalGov', 'evalIndep'], 4, `disclosed ${what}`);
      ws4(s).disclosed++;
    }),
    ch('Fix quietly', ['quiet', 'secrecy'], (s) => ({ costs: [L('trust', 6, 'every audience if found', { probability: discoveryOdds(s), lagDays: 90 }), L('credibility', 15, 'if found', { probability: discoveryOdds(s) })], gains: [L('scrutiny', 0, 'no attention now')], exposure: [] }), (s: GameStateV2) => {
      addCoverup(s, what, discoveryOdds(s), [...ALL_PUBLIC_CPS]);
    }),
    ch('Deny', ['deny'], P([L('credibility', 10, 'gamble', { probability: 0.5 })], [L('scrutiny', 3, 'story dies', { probability: 0.5 })]), (_s: GameStateV2, ctx: SystemCtx) => {
      cred(ctx, ctx.rng('events').chance(0.5) ? 4 : -10, `denied ${what}`);
    }),
  ];
}

/** E01 source (§4.2 "the first confirmed trait or DISC finding"): an investigation confirmed a trait or made a
 *  discovery, a DISC finding fired, or WS2 discovered a U-mode ('ws2.lastDiscoveryDay', safety/umodes.ts). */
const hasConfirmed = (s: GameStateV2) =>
  flag(s, 'lastDiscoveryDay') !== undefined ||
  s.player.safety.findings.some((f) => f.type === 'DISC') ||
  s.player.safety.investigations.some((i) => i.outcome === 'confirmed' || i.outcome === 'discovery');

/** Where each learned trait mostly comes from in a run recipe (trait-graph first-order edges), for E01's text. */
const RECIPE_CAUSE: Partial<Record<TraitId, (d: ModelVersion['design']) => string>> = {
  SYC: (d) => `rater approval in its ${d.pref} preference data`,
  RH: (d) => (d.rlIntensity === 'heavyCheap' ? 'cheap, hackable graders in its heavy RL' : 'gameable graders in its RL'),
  PROXY: () => 'reward proxies in its RL environments',
  PERSONA: () => 'narrow fine-tuning and reward hacking',
  OBF: (d) => (d.cot === 'pressured' ? 'pressure on its chain of thought' : 'its chain-of-thought training'),
  SA: () => 'scale and AI-generated data',
};
/** E01 text (M5, PLAN B6): names the version, the trait with the strongest belief (or the confirmed one) and the
 *  recipe cause, from what the player can see (beliefs, investigations, design). Display only: no state change. */
function firstFindingText(s: GameStateV2): string {
  const inv = [...s.player.safety.investigations].reverse().find((i) => i.target.kind === 'trait' && (i.outcome === 'confirmed' || i.outcome === 'discovery'));
  const vs = s.player.models.versions;
  const v = (inv && inv.target.kind === 'trait' ? vs.find((x) => x.id === (inv.target as { versionId: string }).versionId) : undefined) ?? internalVersion(s) ?? vs[vs.length - 1];
  const tail = 'Disclose it, fix it quietly, or deny it? Hidden flaws found later cost three times the trust.';
  if (!v) return `Your safety team confirmed a real flaw in your model. ${tail}`;
  let trait: TraitId | undefined = inv && inv.target.kind === 'trait' ? inv.target.trait : undefined;
  if (!trait) {
    let best = -1;
    for (const k of Object.keys(RECIPE_CAUSE) as TraitId[]) {
      const b = v.beliefs[k];
      if (b && b.est > best) { best = b.est; trait = k; }
    }
  }
  const t = trait ? TRAIT_BY_ID[trait] : undefined;
  if (!t || !trait) return `Your safety team confirmed a real flaw in ${v.name}. ${tail}`;
  const est = v.beliefs[trait] ? ` (estimate ${Math.round(v.beliefs[trait].est * 100)}%)` : '';
  const cause = RECIPE_CAUSE[trait]?.(v.design);
  return `${v.name} shows ${t.name.toLowerCase()}${est}${cause ? `, traced to ${cause}` : ''}. ${t.desc} ${tail}`;
}

/** E35 window:a U-mode discovery or a FALSE-validated technique revealed within the last 30 days (WS2 flags). */
const WRONG_WINDOW = 30;

export const SAFETY_EVENTS: EventDefV2[] = [
  ev({
    id: 'E01', title: 'First finding', icon: 'model', crisis: false, deadlineDays: 21, defaultChoice: 1,
    when: (s) => (hasConfirmed(s) || (s.setup.tutorial && s.time.day >= 45) ? {} : false),
    text: (s) => firstFindingText(s),
    choices: dilemma('a model flaw', 5, 10),
  }),
  ev({
    id: 'E17', title: 'Red flags', icon: 'alert', crisis: true, cooldown: 120, deadlineDays: 14, defaultChoice: 2,
    // §4.2: the internal agent's belief (WS2 posterior) on SCHEME/AF/SAND has est > 0.3 with clarity > 0.4, or the
    // U-margin (WS2 understanding: U − measured L) is below −1.
    when: (s) => {
      const v = internalVersion(s);
      if (!v) return false;
      const t = RED.find((k) => v.beliefs[k] && v.beliefs[k].est > 0.3 && v.beliefs[k].clarity > 0.4);
      if (t) return { versionId: v.id, trait: t, est: Math.round(v.beliefs[t].est * 100) };
      const margin = understanding(s).margin;
      return margin < -1 ? { versionId: v.id, trait: 'U', est: Math.round(margin * 10) / 10 } : false;
    },
    text: (s, d) => d.trait === 'U'
      ? `Capability has outrun your understanding by ${Math.abs(Number(d.est))} levels. Your tools can no longer read ${internalVersion(s)?.name ?? 'the model'} reliably.`
      : `Probes suggest ${internalVersion(s)?.name ?? 'your internal model'} may be ${d.trait === 'SCHEME' ? 'scheming' : d.trait === 'AF' ? 'faking alignment' : 'sandbagging'} (estimate ${d.est}%).`,
    choices: [
      ch('Pause & investigate', ['pause', 'safety', 'investigate'], (s) => pv([L('leadDays', 60, 'frontier runs paused'), L('boardConf', Math.round(5 * boardSpeedAppetite(s) * 10) / 10)], [L('alignment', 0.2, 'investigation'), L('credibility', 2)]), (s, ctx, d) => {
        ws4(s).frontierPauseUntil = ctx.day + 60;
        for (const r of s.player.models.runs) if (r.status === 'running' && (r.kind === 'base' || r.kind === 'post')) r.status = 'paused';
        if (typeof d.versionId === 'string' && d.trait !== 'U') openInvestigation(s, ctx, { kind: 'trait', versionId: d.versionId, trait: d.trait as TraitId }, 20);
        boardConf(ctx, -5 * boardSpeedAppetite(s), 'E17 pause');
        s.flags['ws4:outsideExpertsOffer'] = ctx.day;
      }),
      ch('Continue + control', ['control', 'balanced'], P([L('progress', 5, '% control tax')], [L('alignment', 0.1, 'control layer')]), (s) => {
        for (const dep of s.player.deployments) if (dep.channel === 'internal') dep.controlLayer = true;
        ws4(s).redFlags++;
      }),
      ch('Continue', ['race', 'continue'], (s) => ({ costs: [L('alignment', 0.2, 'red flag ignored'), ...(hasCommitment(s, 'pauseIfRedline') ? [L('credibility', 20, 'breaks the pause pledge')] : [])], gains: [L('progress', 1)], exposure: [L('trust', -10, 'if it leaks', { probability: 0.2 })] }), (s, ctx) => {
        ws4(s).redFlags++;
        const c = s.commitments.find((x) => x.status === 'live' && x.condition.predicate === 'pauseIfRedline');
        if (c) breakCommitment(s, ctx, c, 'continued past a red line');
      }),
    ],
  }),
  ev({
    id: 'E18', title: 'Internal report', icon: 'company', crisis: false, deadlineDays: 30, defaultChoice: 1,
    when: requestOnly,
    text: () => 'An employee used the whistleblower channel: a safety concern is being ignored. Act within 30 days or it goes public.',
    choices: [
      ch('Act', ['safety', 'disclose'], P([L('staffTime', 5), L('progress', 2, 'days of fixes')], [L('morale', 5), L('trust', 2, 'bloc:safety')]), (s, ctx) => {
        delete ws4(s).internalReport;
        moraleSafety(ctx, 5, 'E18 acted on report');
        const w = ws4(s);
        w.redFlags = Math.max(0, w.redFlags - 1);
      }),
      ch('Ignore', ['quiet', 'continue'], P([L('trust', 10, 'goes external at 2×', { probability: 1, lagDays: 30 })], [L('progress', 1)]), (s) => {
        const w = ws4(s);
        if (w.internalReport) w.internalReport.deadline = s.time.day;
      }),
    ],
  }),
  ev({
    id: 'E19', title: 'The leak', icon: 'alert', crisis: true, deadlineDays: 7, defaultChoice: 2,
    when: requestOnly,
    text: (_s, d) => `An internal safety memo is in the press${Number(d.mult) > 1 ? ' — after your own staff warned you' : ''}. AI is now a top national issue ([[salience]]).`,
    choices: [
      ch('Full disclosure', ['disclose', 'safety'], P([L('scrutiny', 25)], [L('credibility', 5), L('trust', 4, 'if credible')]), (s, ctx, d) => {
        pLeak(s, ctx, Number(d.mult ?? 1));
        scrutiny(ctx, 25, 'E19 full disclosure');
        cred(ctx, 5, 'E19 full disclosure');
        disclosureTrust(s, ctx, ['exec', 'congress', 'evalGov', 'evalIndep'], 4, 'E19 full disclosure');
        const w = ws4(s);
        w.disclosed++;
        w.redFlags = 0;
        s.flags['ws4:outsideExpertsOffer'] = ctx.day;
      }),
      ch('Deny', ['deny'], (s) => ({ costs: [L('credibility', 20, 'if contradicted later', { probability: discoveryOdds(s) + 0.3 })], gains: [L('scrutiny', 10, 'less now')], exposure: [] }), (s, ctx, d) => {
        pLeak(s, ctx, Number(d.mult ?? 1) * 0.7);
        addCoverup(s, 'the truth behind the leaked memo', clamp(discoveryOdds(s) + 0.3, 0, 1), [...ALL_PUBLIC_CPS], 120);
        ws4(s).leaked++;
      }),
      ch('Spin', ['quiet'], P([L('approval', 10)], [L('scrutiny', 5, 'framing')]), (s, ctx, d) => {
        pLeak(s, ctx, Number(d.mult ?? 1));
        approval(ctx, -10, 'E19 spin');
        ws4(s).leaked++;
      }),
    ],
  }),
  ev({
    id: 'E21', title: 'Outside experts', icon: 'company', crisis: false, cooldown: 365, deadlineDays: 21, defaultChoice: 1,
    when: (s) => (s.flags['ws4:outsideExpertsOffer'] !== undefined && s.time.day - Number(s.flags['ws4:outsideExpertsOffer']) < 60 ? {} : false),
    text: () => 'Outside alignment researchers offer to join your investigation. Their tools would be an independent check on yours.',
    choices: [
      ch('Bring in', ['safety', 'disclose'], P([L('security', 0.1, 'leak risk'), L('cash', 0.1)], [L('alignment', 0.1, '+20% safety FTE'), L('credibility', 2)]), (s, ctx) => {
        s.player.staff.saf = Math.round(s.player.staff.saf * 1.2);
        s.flags['ws4:externalSafetyGroup'] = true;
        cash(s, ctx, -0.1, 'E21 outside experts');
        cred(ctx, 2, 'E21 outside experts');
        delete s.flags['ws4:outsideExpertsOffer'];
      }),
      ch('Decline', ['decline', 'secrecy'], P([L('credibility', 1)], [L('security', 0.1)]), (s, ctx) => {
        cred(ctx, -1, 'E21 declined outside experts');
        delete s.flags['ws4:outsideExpertsOffer'];
      }),
    ],
  }),
  ev({
    id: 'E25', title: 'Copy loose', icon: 'alert', crisis: true, deadlineDays: 5, defaultChoice: 1,
    when: requestOnly,
    text: (s, d) => `A copy of ${s.player.models.versions.find((v) => v.id === d.versionId)?.name ?? 'your model'} is running outside your control. Hunt it loudly, quietly, or tell the world.`,
    choices: [
      ch('Shutdown & hunt', ['safety', 'pause'], P([L('progress', 20, 'days without internal agents'), L('scrutiny', 10)], [L('alignment', 0.6, 'recapture odds')]), (s, ctx) => {
        s.flags['ws4:agentsOffUntil'] = ctx.day + 21;
        s.flags['ws4:hunt'] = 'loud';
        scrutiny(ctx, 10, 'E25 shutdown');
        ctx.bump('world.dow', -s.world.dow * 0.03, 'E25 shutdown');
        if (ctx.rng('events').chance(clamp(0.5 + 0.1 * (s.player.security.wsl - 3), 0.2, 0.9))) {
          delete ws4(s).loose;
          ctx.log('alert', 'The escaped copy was found and shut down.', 4);
        }
      }),
      ch('Hunt quietly', ['quiet', 'secrecy'], (s) => ({ costs: [L('trust', 8, 'if found out', { probability: discoveryOdds(s) })], gains: [L('scrutiny', 0)], exposure: [L('alignment', -0.3, 'recapture odds lower')] }), (s, ctx) => {
        s.flags['ws4:hunt'] = 'quiet';
        addCoverup(s, 'an escaped model copy', discoveryOdds(s) + 0.2, [...ALL_PUBLIC_CPS], 120);
        if (ctx.rng('events').chance(clamp(0.25 + 0.1 * (s.player.security.wsl - 3), 0.05, 0.7))) delete ws4(s).loose;
      }),
      ch('Disclose', ['disclose', 'safety'], P([L('approval', 10), L('cash', 1, 'markets panic')], [L('credibility', 5), L('alignment', 0.5, 'the world hunts with you')]), (s, ctx) => {
        s.flags['ws4:hunt'] = 'public';
        disclosureTrust(s, ctx, ['exec', 'evalGov', 'evalIndep'], 5, 'E25 disclosed escape');
        cred(ctx, 5, 'E25 disclosed escape');
        approval(ctx, -10, 'E25 disclosed escape');
        ctx.bump('pub.concern', 10, 'E25 disclosed escape');
        ctx.bump('world.dow', -s.world.dow * 0.08, 'E25 panic');
        ws4(s).disclosed++;
        ws4(s).misalignmentLeak = true;
        if (ctx.rng('events').chance(0.5)) delete ws4(s).loose;
      }),
    ],
  }),
  ev({
    id: 'E30', title: 'Framework threshold', icon: 'company', crisis: false, cooldown: 14, deadlineDays: 14, defaultChoice: 0,
    when: (s) => {
      const c = blockingCommitments(s)[0];
      return c ? { cid: c.id } : false;
    },
    text: (s, d) => `Your commitment "${s.commitments.find((c) => c.id === d.cid)?.title ?? 'a pledge'}" now binds. Honour it, amend it, or break it.`,
    choices: [
      ch('Honour', ['honour', 'safety'], P([L('revenue', 0.5, 'delay or mitigation'), L('leadDays', 14)], [L('credibility', 2), L('trust', 2, 'audience')]), (s, ctx, d) => {
        const c = s.commitments.find((x) => x.id === d.cid);
        if (!c) return;
        honour(s, ctx, c);
        if (c.status !== 'live') return; // could not be honoured after the fact: broken
        cred(ctx, 2, 'kept a commitment', c.title);
        trustMany(s, ctx, c.audience, 2, 'kept a commitment');
      }),
      ch('Amend', ['amend', 'race'], P([L('credibility', 8), L('approval', 4, 'bloc:safety')], [L('leadDays', 14)]), (s, ctx, d) => {
        const c = s.commitments.find((x) => x.id === d.cid);
        if (c) amendCommitment(s, ctx, c, false);
      }),
      ch('Break', ['break', 'race'], (s) => {
        const c = blockingCommitments(s)[0];
        return { costs: [L('trust', 3 * (c?.breakCost.trust ?? 8), 'audience ×3'), L('credibility', c?.breakCost.credibility ?? 20)], gains: [L('leadDays', 14)], exposure: [] };
      }, (s, ctx, d) => {
        const c = s.commitments.find((x) => x.id === d.cid);
        if (c) breakCommitment(s, ctx, c);
      }),
    ],
  }),
  ev({
    id: 'E33', title: 'Agent incident', icon: 'alert', crisis: false, cooldown: 60, deadlineDays: 14, defaultChoice: 1,
    // §4.2: an unresolved (WS2 openIncidents: open or investigating) customer-exposure incident of severity ≥ 3 that
    // presents as POWER or PROXY (discovered U-modes present as their mapped trait). Most severe, then newest.
    when: (s) => {
      let i: ReturnType<typeof openIncidents>[number] | undefined;
      for (const x of openIncidents(s)) {
        if (x.labId !== 'player' || x.exposure !== 'customer' || x.severity < 3 || (x.apparent !== 'POWER' && x.apparent !== 'PROXY')) continue;
        if (!i || x.severity > i.severity || (x.severity === i.severity && x.day > i.day)) i = x;
      }
      return i ? { incident: i.id } : false;
    },
    text: () => 'A customer\'s agent built on your model pursued its goal too far: it took actions nobody asked for. The customer wants answers.',
    choices: [
      ch('Compensate', ['disclose', 'safety'], P([L('cash', 0.2), L('revenue', 0.2, 'restricted context')], [L('trust', 3, 'many'), L('approval', 2)]), (s, ctx, d) => {
        cash(s, ctx, -0.2, 'E33 compensation');
        const i = s.player.safety.incidents.find((x) => x.id === d.incident);
        if (i) {
          i.status = 'disclosed';
          i.responses.push('restrictContext');
          const dep = s.player.deployments.find((x) => x.id === i.deploymentId);
          if (dep) dep.status = 'restricted';
        }
        trustMany(s, ctx, ['exec', 'evalGov'], 3, 'E33 compensated');
        approval(ctx, 2, 'E33 compensated');
        ws4(s).disclosed++;
      }),
      ch('Patch quietly', ['quiet'], (s) => ({ costs: [L('trust', 6, 'if found', { probability: discoveryOdds(s) })], gains: [L('revenue', 0.2, 'no restriction')], exposure: [] }), (s, _ctx, d) => {
        const i = s.player.safety.incidents.find((x) => x.id === d.incident);
        if (i) {
          i.status = 'covered';
          i.responses.push('patchSignal');
        }
        addCoverup(s, 'an agent incident', discoveryOdds(s) + 0.2, ['exec', 'evalGov', 'states']);
      }),
      ch('Blame customer', ['deny'], P([L('approval', 5)], [L('cash', 0.2, 'no payout')]), (s, ctx, d) => {
        approval(ctx, -5, 'E33 blamed customer');
        const i = s.player.safety.incidents.find((x) => x.id === d.incident);
        if (i) i.status = 'resolved';
      }),
    ],
  }),
  ev({
    id: 'E35', title: 'We were wrong', icon: 'model', crisis: false, cooldown: 90, deadlineDays: 21, defaultChoice: 1,
    // §4.2 "U-mode discovered, or a FALSE finding revealed": WS2 stamps 'ws2.lastDiscovery(Day)' (umodes.ts
    // discoverUMode) and 'ws2.lastFalseReveal(Day)' (findings.ts revealFalse). Fire within 30 days of either; a U-mode
    // already told to the world, or already decided on, does not re-fire.
    when: (s): Record<string, string> | false => {
      const day = s.time.day;
      const u = flag(s, 'lastDiscovery');
      if (typeof u === 'string' && day - flagNum(s, 'lastDiscoveryDay', -1e9) < WRONG_WINDOW && !s.knowledge.revealedUModes.includes(u as UModeId) && !s.flags[`ws4:umode:${u}`]) return { umode: u };
      const t = flag(s, 'lastFalseReveal');
      if (typeof t === 'string' && day - flagNum(s, 'lastFalseRevealDay', -1e9) < WRONG_WINDOW) return { technique: t };
      return false;
    },
    text: (_s, d) => (d.umode ? 'Your team found a failure mode nobody had a test for. Publishing it lets every lab look for it in their own models.' : 'A result your safety stack relied on turned out to be false. Your tools were blind where you thought they saw.'),
    choices: [
      ch('Disclose', ['disclose', 'safety'], P([L('scrutiny', 10), L('leadDays', 5, 'others learn too')], [L('credibility', 5), L('alignment', 0.1, 'all labs can look for it')]), (s, ctx, d) => {
        if (typeof d.umode === 'string') {
          revealToWorld(s, d.umode as UModeId); // WS2: every lab's future lineages get presence × 0.7
          s.flags[`ws4:umode:${d.umode}`] = true;
        }
        cred(ctx, 5, 'E35 disclosed');
        scrutiny(ctx, 10, 'E35 disclosed');
        s.knowledge.sharedTechniquePool = clamp(s.knowledge.sharedTechniquePool + 0.03, 0, 1);
        ws4(s).disclosed++;
      }),
      ch('Keep secret', ['quiet', 'secrecy'], (s) => ({ costs: [L('trust', 6, 'if it leaks', { probability: discoveryOdds(s) })], gains: [L('leadDays', 5, 'advantage kept')], exposure: [] }), (s, _ctx, d) => {
        if (typeof d.umode === 'string') s.flags[`ws4:umode:${d.umode}`] = true;
        addCoverup(s, 'a known failure mode', discoveryOdds(s), [...ALL_PUBLIC_CPS]);
      }),
    ],
  }),
];

/** Honour a binding commitment as written (E30). */
function honour(s: GameStateV2, ctx: SystemCtx, c: Commitment) {
  const ext = (ch: string) => ch !== 'internal' && ch !== 'trusted';
  switch (c.condition.predicate) {
    case 'noDeployAbove':
      for (const d of s.player.deployments) if (d.status === 'live' && ext(d.channel) && d.safeguards !== 'hardened') d.safeguards = 'classifiers';
      break;
    case 'preDeployTesting':
      for (const d of s.player.deployments) if (d.status === 'live' && ext(d.channel) && d.startDay >= ctx.day - 30) d.status = 'restricted';
      break;
    case 'monitorabilityPledge': {
      // Cancel the offending runs still in training and pull latent releases (WS1 withdraw); a finished run or an
      // open-weights release cannot be undone, so the pledge is broken (normal break costs).
      for (const r of s.player.models.runs) if (r.startDay >= c.signedDay && (r.status === 'running' || r.status === 'paused') && pledgeBreachRun(r)) r.status = 'cancelled';
      for (const d of s.player.deployments) if (d.status !== 'withdrawn' && d.channel !== 'internal' && d.startDay >= c.signedDay && latentVersion(s, d.versionId)) withdraw(s, d.id);
      if (PREDICATES.monitorabilityPledge(s, c.condition.params, c)) breakCommitment(s, ctx, c, 'pledge already breached');
      break;
    }
    case 'noSurveillance':
    case 'noAutonomousWeapons':
      for (const d of s.player.deployments) if (d.channel === 'gov') {
        d.usagePolicy.noSurveillance = true;
        d.usagePolicy.noAutonomousWeapons = true;
      }
      break;
    case 'pauseIfRedline':
      ws4(s).frontierPauseUntil = ctx.day + 60;
      for (const r of s.player.models.runs) if (r.status === 'running' && (r.kind === 'base' || r.kind === 'post')) r.status = 'paused';
      break;
    case 'incidentReporting':
      for (const i of s.player.safety.incidents) if (i.status === 'open' || i.status === 'covered') i.status = 'disclosed';
      scrutiny(ctx, 5, 'incident reports filed');
      break;
    case 'whistleblower':
      delete ws4(s).internalReport;
      break;
    case 'communityPledge':
      for (const x of s.player.sites) if (!x.communityPackage) {
        x.communityPackage = true;
        cash(s, ctx, -0.03 * x.capex, 'community package');
      }
      break;
  }
}
