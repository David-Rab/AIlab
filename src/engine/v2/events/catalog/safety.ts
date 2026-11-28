// Event catalog: safety decisions (V2-SPEC §4.2: E01, E19, E25; E17 "Red flags" is gone: the Safety framework holds frontier training, SR-19). Owner: WS4 (content
// shared with WS2). The disclosure dilemma (§3.9.3 rule 1) is the backbone: disclose / keep it quiet (a leak: deny / disclose).
import { clamp } from '../../../rng';
import { flag } from '../../safety/common';
import { internalVersion } from '../../models/labs';
import type { EventDefV2, GameStateV2, ModelVersion, SystemCtx, TraitId } from '../../types';
import { TRAIT_BY_ID } from '../../../../data/v2/traits';
import { addCoverup, COVERUP_DISCOVERY_ODDS } from '../coverups';
import { escapeResolved } from '../../safety/footholds';
import { whistleOddsYear } from '../../security/security';
import { L, P, ch, ev, pv, requestOnly } from '../kit';
import { approvalPush, approvalScaled, PUBLIC } from '../../world/public';

/** F6d: what continuing past the flag costs: both "Continue" choices count one red flag (`security.redFlags`), which feeds
 *  the whistleblower hazard (security.ts whistleHazard): the odds of a staff leak to the press over a year at today's
 *  morale, before → after. With a whistleblower channel the concern is handled internally instead (no press leak). */
export function redFlagLine(s: GameStateV2) {
  const pct = (x: number) => { const p = x * 100; return p >= 10 ? p.toFixed(0) : p.toFixed(1); };
  const why = s.player.policies.whistleblowerChannel
    ? 'staff concerns go to your whistleblower channel (handled internally)'
    : `odds of a staff leak to the press ${pct(whistleOddsYear(s))}% → ${pct(whistleOddsYear(s, 1))}% a year`;
  return L('alignment', 1, why, { unit: 'red flag' });
}
/** The disclose choices' preview: their approval gain at today's attention on the lab (the number approvalPush applies). */
const discloseGain = (s: GameStateV2) => pv([], [L('approval', approvalScaled(s, PUBLIC.discloseChoice), 'honesty is noticed')]);
/** What keeping a thing quiet risks: the cover-up is found with these odds over its horizon (approval hit, exposed in coverups.ts). */
const exposed = (s: GameStateV2, p: number) => L('approval', Math.abs(approvalScaled(s, PUBLIC.coverupExposed)), 'if it comes out', { probability: p });
const quietPreview = (s: GameStateV2) => pv([], [], [exposed(s, COVERUP_DISCOVERY_ODDS)]);
/** The disclosure dilemma of findings (E01): disclose, or keep it quiet (a cover-up that may be found). */
function dilemma(what: string) {
  return [
    ch('Disclose', ['disclose', 'safety'], discloseGain, (s: GameStateV2, ctx: SystemCtx) => {
      approvalPush(s, ctx, PUBLIC.discloseChoice, 'You disclosed');
    }),
    ch('Keep it quiet', ['quiet', 'secrecy'], quietPreview, (s: GameStateV2) => {
      addCoverup(s, what, COVERUP_DISCOVERY_ODDS);
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
  const tail = 'Disclose it or keep it quiet? Keeping quiet fixes nothing.';
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
    id: 'E19', title: 'The leak', icon: 'alert', crisis: true, cooldown: 365, deadlineDays: 7, defaultChoice: 0,
    when: requestOnly,
    text: (_s, d) => `An internal safety memo is in the press${Number(d.mult) > 1 ? ' — after your own staff warned you' : ''}.`,
    choices: [
      // Deny is what you get by doing nothing: the memo stays out there and may be proven true. (Spin merged into it, W7.)
      ch('Deny', ['deny', 'quiet'], (s) => pv([], [], [exposed(s, clamp(COVERUP_DISCOVERY_ODDS + 0.3, 0, 1))]), (s, ctx) => {
        addCoverup(s, 'the truth behind the leaked memo', clamp(COVERUP_DISCOVERY_ODDS + 0.3, 0, 1), 120);
        s.public.misalignLeakDay ??= ctx.day;
      }),
      ch('Full disclosure', ['disclose', 'safety'], discloseGain, (s, ctx) => {
        s.public.misalignLeakDay ??= ctx.day;
        approvalPush(s, ctx, PUBLIC.discloseChoice, 'You disclosed');
        s.player.security.redFlags = 0;
      }),
    ],
  }),
  ev({
    id: 'E25', title: 'Copy loose', icon: 'alert', crisis: true, deadlineDays: 5, defaultChoice: 1,
    when: requestOnly,
    text: (s, d) => `A copy of ${s.player.models.versions.find((v) => v.id === d.versionId)?.name ?? 'your model'} is running outside your control. Hunt it loudly, quietly, or tell the world.`,
    choices: [
      ch('Shutdown & hunt', ['safety', 'pause'], P([L('progress', 20, 'without internal agents', { unit: 'days' })], [L('alignment', 0.6, 'recapture odds')]), (s, ctx) => {
        s.player.safety.agentsOffUntil = ctx.day + 21;
        s.player.security.hunt = 'loud';
        if (ctx.rng('events').chance(clamp(0.5 + 0.1 * (s.player.security.wsl - 3), 0.2, 0.9))) {
          delete s.player.security.loose;
          escapeResolved(s, ctx.day, 'captured');
          ctx.log('alert', 'The escaped copy was found and shut down.', 4);
        }
      }),
      ch('Hunt quietly', ['quiet', 'secrecy'], (s) => pv([], [], [L('alignment', -0.3, 'recapture odds lower'), exposed(s, COVERUP_DISCOVERY_ODDS + 0.2)]), (s, ctx) => {
        s.player.security.hunt = 'quiet';
        addCoverup(s, 'an escaped model copy', COVERUP_DISCOVERY_ODDS + 0.2, 120);
        if (ctx.rng('events').chance(clamp(0.25 + 0.1 * (s.player.security.wsl - 3), 0.05, 0.7))) {
          delete s.player.security.loose;
          escapeResolved(s, ctx.day, 'captured');
        }
      }),
      ch('Disclose', ['disclose', 'safety'], (s) => pv([], [L('alignment', 0.5, 'the world hunts with you'), L('approval', approvalScaled(s, PUBLIC.discloseChoice), 'honesty is noticed')]), (s, ctx) => {
        s.player.security.hunt = 'public';
        approvalPush(s, ctx, PUBLIC.discloseChoice, 'You disclosed');
        if (ctx.rng('events').chance(0.5)) {
          delete s.player.security.loose;
          escapeResolved(s, ctx.day, 'captured');
        }
      }),
    ],
  }),
];

