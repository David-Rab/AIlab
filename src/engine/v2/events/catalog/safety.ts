// Event catalog: safety decisions (V2-SPEC §4.2: E01, E19, E25, E30; E17 "Red flags" is gone: the Safety framework holds frontier training, SR-19). Owner: WS4 (content
// shared with WS2). The disclosure dilemma (§3.9.3 rule 1) is the backbone: disclose / keep it quiet / deny.
import { addSafeguard } from '../../safety/safeguards';
import { clamp } from '../../../rng';
import { withdraw } from '../../models/deployments';
import { flag } from '../../safety/common';
import { internalVersion } from '../../models/labs';
import type { Commitment, EventDefV2, GameStateV2, ModelVersion, SystemCtx, TraitId } from '../../types';
import { TRAIT_BY_ID } from '../../../../data/v2/traits';
import { PREDICATES, blockingCommitments, amendCommitment, breakCommitment, latentVersion, pledgeBreachRun } from '../../actors/commitments';
import { approval, cash } from '../../actors/fx';
import { pLeak } from '../../actors/public';
import { addCoverup, COVERUP_DISCOVERY_ODDS } from '../coverups';
import { ws4 } from '../../actors/state';
import { escapeResolved } from '../../safety/footholds';
import { whistleOddsYear } from '../../security/security';
import { L, P, ch, ev, requestOnly } from '../kit';

/** F6d: what continuing past the flag costs: both "Continue" choices count one red flag (`ws4.redFlags`), which feeds
 *  the whistleblower hazard (security.ts whistleHazard): the odds of a staff leak to the press over a year at today's
 *  morale, before → after. With a whistleblower channel the concern is handled internally instead (no press leak). */
export function redFlagLine(s: GameStateV2) {
  const pct = (x: number) => { const p = x * 100; return p >= 10 ? p.toFixed(0) : p.toFixed(1); };
  const why = s.player.policies.whistleblowerChannel
    ? 'staff concerns go to your whistleblower channel (handled internally)'
    : `odds of a staff leak to the press ${pct(whistleOddsYear(s))}% → ${pct(whistleOddsYear(s, 1))}% a year`;
  return L('alignment', 1, why, { unit: 'red flag' });
}
/** The disclosure-dilemma triple used by findings, incidents and U-mode discoveries. (Its trust, credibility and
 *  scrutiny effects went with the relation stocks, W1c; W7 redoes the events.) */
function dilemma(what: string) {
  return [
    ch('Disclose', ['disclose', 'safety'], P([]), (s: GameStateV2) => {
      ws4(s).disclosed++;
    }),
    ch('Keep it quiet', ['quiet', 'secrecy'], P([L('approval', 8, 'if found: nothing is fixed, the flaw stays in the model', { probability: COVERUP_DISCOVERY_ODDS })]), (s: GameStateV2) => {
      addCoverup(s, what, COVERUP_DISCOVERY_ODDS);
    }),
    ch('Deny', ['deny'], P([]), () => {}),
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
  RH: () => 'gameable graders in its RL environments',
  PROXY: () => 'reward proxies in its RL environments',
  PERSONA: () => 'reward hacking learned in its RL environments',
  OBF: (d) => (d.cot === 'pressured' ? 'pressure on its chain of thought' : 'its chain-of-thought training'),
  SA: () => 'scale and AI-generated data',
};
/** E01 text (M5, PLAN B6): names the version, the trait with the strongest belief (or the confirmed one) and the
 *  recipe cause, from what the player can see (beliefs, investigations, design). Display only: no state change. */
function firstFindingText(s: GameStateV2): string {
  const inv = [...s.player.safety.investigations].reverse().find((i) => i.target.kind === 'trait' && (i.outcome === 'confirmed' || i.outcome === 'discovery'));
  const vs = s.player.models.versions;
  const v = (inv && inv.target.kind === 'trait' ? vs.find((x) => x.id === (inv.target as { versionId: string }).versionId) : undefined) ?? internalVersion(s) ?? vs[vs.length - 1];
  const tail = 'Disclose, keep it quiet or deny? Keeping quiet fixes nothing.';
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
  return `${v.name} shows ${t.name.toLowerCase()}${est}${cause ? `, traced to ${cause}` : ''}. ${tail}`;
}


export const SAFETY_EVENTS: EventDefV2[] = [
  ev({
    id: 'E01', title: 'First finding', icon: 'model', crisis: false, deadlineDays: 21, defaultChoice: 1,
    when: (s) => (hasConfirmed(s) || (s.setup.tutorial && s.time.day >= 45) ? {} : false),
    text: (s) => firstFindingText(s),
    choices: dilemma('a model flaw'),
  }),
  ev({
    id: 'E19', title: 'The leak', icon: 'alert', crisis: true, cooldown: 365, deadlineDays: 7, defaultChoice: 2,
    when: requestOnly,
    text: (_s, d) => `An internal safety memo is in the press${Number(d.mult) > 1 ? ' — after your own staff warned you' : ''}. AI is now a top national issue ([[salience]]).`,
    choices: [
      ch('Full disclosure', ['disclose', 'safety'], P([]), (s, ctx, d) => {
        pLeak(s, ctx, Number(d.mult ?? 1));
        const w = ws4(s);
        w.disclosed++;
        w.redFlags = 0;
        s.flags['ws4:outsideExpertsOffer'] = ctx.day;
      }),
      ch('Deny', ['deny'], P([L('approval', 8, 'if contradicted later', { probability: clamp(COVERUP_DISCOVERY_ODDS + 0.3, 0, 1) })]), (s, ctx, d) => {
        pLeak(s, ctx, Number(d.mult ?? 1) * 0.7);
        addCoverup(s, 'the truth behind the leaked memo', clamp(COVERUP_DISCOVERY_ODDS + 0.3, 0, 1), 120);
        ws4(s).leaked++;
      }),
      ch('Spin', ['quiet'], P([L('approval', 10)]), (s, ctx, d) => {
        pLeak(s, ctx, Number(d.mult ?? 1));
        approval(ctx, -10, 'E19 spin');
        ws4(s).leaked++;
      }),
    ],
  }),
  ev({
    id: 'E25', title: 'Copy loose', icon: 'alert', crisis: true, deadlineDays: 5, defaultChoice: 1,
    when: requestOnly,
    text: (s, d) => `A copy of ${s.player.models.versions.find((v) => v.id === d.versionId)?.name ?? 'your model'} is running outside your control. Hunt it loudly, quietly, or tell the world.`,
    choices: [
      ch('Shutdown & hunt', ['safety', 'pause'], P([L('progress', 20, 'without internal agents', { unit: 'days' })], [L('alignment', 0.6, 'recapture odds')]), (s, ctx) => {
        s.flags['ws4:agentsOffUntil'] = ctx.day + 21;
        s.flags['ws4:hunt'] = 'loud';
        if (ctx.rng('events').chance(clamp(0.5 + 0.1 * (s.player.security.wsl - 3), 0.2, 0.9))) {
          delete ws4(s).loose;
          escapeResolved(s, ctx.day, 'captured');
          ctx.log('alert', 'The escaped copy was found and shut down.', 4);
        }
      }),
      ch('Hunt quietly', ['quiet', 'secrecy'], P([L('approval', 8, 'if found out', { probability: COVERUP_DISCOVERY_ODDS + 0.2 })], [], [L('alignment', -0.3, 'recapture odds lower')]), (s, ctx) => {
        s.flags['ws4:hunt'] = 'quiet';
        addCoverup(s, 'an escaped model copy', COVERUP_DISCOVERY_ODDS + 0.2, 120);
        if (ctx.rng('events').chance(clamp(0.25 + 0.1 * (s.player.security.wsl - 3), 0.05, 0.7))) {
          delete ws4(s).loose;
          escapeResolved(s, ctx.day, 'captured');
        }
      }),
      ch('Disclose', ['disclose', 'safety'], P([L('approval', 10), L('cash', 1, 'markets panic')], [L('alignment', 0.5, 'the world hunts with you')]), (s, ctx) => {
        s.flags['ws4:hunt'] = 'public';
        approval(ctx, -10, 'E25 disclosed escape');
        ctx.bump('pub.concern', 10, 'E25 disclosed escape');
        ws4(s).disclosed++;
        ws4(s).misalignmentLeak = true;
        if (ctx.rng('events').chance(0.5)) {
          delete ws4(s).loose;
          escapeResolved(s, ctx.day, 'captured');
        }
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
      ch('Honour', ['honour', 'safety'], P([L('revenue', 0.5, 'delay or mitigation'), L('leadDays', 14)]), (s, ctx, d) => {
        const c = s.commitments.find((x) => x.id === d.cid);
        if (c) honour(s, ctx, c);
      }),
      ch('Amend', ['amend', 'race'], P([], [L('leadDays', 14)]), (s, ctx, d) => {
        const c = s.commitments.find((x) => x.id === d.cid);
        if (c) amendCommitment(s, ctx, c, false);
      }),
      ch('Break', ['break', 'race'], P([], [L('leadDays', 14)]), (s, ctx, d) => {
        const c = s.commitments.find((x) => x.id === d.cid);
        if (c) breakCommitment(s, ctx, c);
      }),
    ],
  }),
];

/** Honour a binding commitment as written (E30). */
function honour(s: GameStateV2, ctx: SystemCtx, c: Commitment) {
  const ext = (ch: string) => ch !== 'internal'; // Vetted is external too (MARKET.md M10)
  switch (c.condition.predicate) {
    case 'preDeployTesting':
      for (const d of s.player.deployments) if (d.status === 'live' && ext(d.channel) && d.startDay >= ctx.day - 30) addSafeguard(s, d, 'restrict');
      break;
    case 'monitorabilityPledge': {
      // Cancel the offending runs still in training and pull latent releases (WS1 withdraw); a finished run or an
      // open-weights release cannot be undone, so the pledge is broken (normal break costs).
      for (const r of s.player.models.runs) if (r.startDay >= c.signedDay && (r.status === 'running' || r.status === 'paused') && pledgeBreachRun(r)) r.status = 'cancelled';
      for (const d of s.player.deployments) if (d.status !== 'withdrawn' && d.channel !== 'internal' && d.startDay >= c.signedDay && latentVersion(s, d.versionId)) withdraw(s, d.id);
      if (PREDICATES.monitorabilityPledge(s, c.condition.params, c)) breakCommitment(s, ctx, c);
      break;
    }
    case 'noSurveillance':
    case 'noAutonomousWeapons':
      for (const d of s.player.deployments) if (d.channel === 'vetted') {
        d.usagePolicy.noSurveillance = true;
        d.usagePolicy.noAutonomousWeapons = true;
      }
      break;
    case 'incidentReporting':
      for (const i of s.player.safety.incidents) if (i.status === 'open' || i.status === 'covered') i.status = 'disclosed';
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
