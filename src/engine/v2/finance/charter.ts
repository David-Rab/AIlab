// Charter rights (FINANCE-V3 §7.2, FIN3b; design/corp/CORPORATE.md §2.3): the few hard powers on a class's seats, each
// visible before you act. Owner: WS3. Finance reaches the rest of the game only through cash, this release block and
// the ouster (spec §0.3): the deployment gate (models/deployments.ts) asks `charterReleaseBlock` before any external
// release.
//
// | Power                                            | Who holds it (control.ts)  | Where it bites                          |
// |--------------------------------------------------|----------------------------|-----------------------------------------|
// | Safety committee halts a red-flagged release     | a mission body             | every external launch or model swap     |
// | Trust approval: sale of control, threshold model | a mission body             | a deal past 50%; open weights; IP access |
// | Override forces a major decision                 | a holder with > 50% of votes | board votes (board.ts voteGate)       |
// | Security approval (can't be forced)              | golden share, state control | threshold models (open weights, IP)    |
import type { BoardVote, Channel, GameStateV2, ModelVersion } from '../types';
import { boardVote, securityVote, trustVote } from './board';
import { missionPowers, overrideAvailable, securityPowers } from './control';
import { capabilityThresholds, licensedModel, safetyRedFlags } from './observe';

export type CharterRightId = 'safetyCommittee' | 'trust' | 'override' | 'security';
export interface CharterRight { id: CharterRightId; label: string; /** What it blocks, in 2–4 words (the Board card row). */ short: string; blocks: string; source: string }

/** The powers on this company's board now (Board card). */
export function charterRights(s: GameStateV2): CharterRight[] {
  const out: CharterRight[] = [];
  if (missionPowers(s)) out.push({ id: 'safetyCommittee', label: 'Safety committee', short: 'halts red-flagged releases', blocks: `Halts the release of any model your own safety evals red-flag: scheming, alignment faking or sandbagging believed above ${Math.round(COMMITTEE_EST * 100)}%`, source: 'Delaware AG conditions, Oct 2025 [R15]' });
  if (missionPowers(s)) out.push({ id: 'trust', label: 'Trust approval', short: 'sale of control · open weights · IP access', blocks: "The mission body's seats vote on any sale of control (a holder past 50%) and on handing out a capability-threshold model (bio, cyber or replication flag): releasing its weights, or a partner's IP access to it (without its yes, a rescue's licence stops below the thresholds)", source: 'Anthropic LTBT charter [R15]' });
  if (overrideAvailable(s)) out.push({ id: 'override', label: 'Override', short: 'force a failed vote', blocks: 'Your founders hold more than half of the votes: you can force a major decision the board votes down, at board confidence −20', source: s.player.finance.dualClass ? 'dual-class shares [R15]' : 'a founder majority [R15]' });
  if (securityPowers(s)) out.push({ id: 'security', label: 'Security approval', short: 'threshold models · foreign holders', blocks: "The government's directors approve handing out a capability-threshold model and any foreign or competitor holder gaining votes", source: 'design/corp/CORPORATE.md §2.3 [D]' });
  return out;
}

const external = (c: Channel) => c !== 'internal';

/** The safety committee halts a release when the player's evals show a red-flag trait (scheming, alignment faking,
 *  sandbagging) more likely than not: estimate above 50% with clarity above 0.4 [D, FIN3b]. the Safety framework's 30% (SR-19) is the early
 *  warning; a halt needs more. On the bots (10 seeds each) 50% held 13% of the reference bot's full models, half of the
 *  race bot's and almost none of the careful bots'; at 30% it held 70% of the reference bot's (FIN3b notes). */
export const COMMITTEE_EST = 0.5;

/** Handing out a capability-threshold model needs two bodies' approval where they exist: the mission body's seats (trust
 *  approval) and the government's directors (security approval). Neither can be forced. This is the vote that stops it
 *  (a failed one, the mission body's first), else the vote that passes; undefined when no body holds the power. */
function approvals(s: GameStateV2, decision: 'transferModel', trigger: string): BoardVote | undefined {
  const votes = [missionPowers(s) ? trustVote(s, decision, trigger) : undefined, securityPowers(s) ? securityVote(s, decision, trigger) : undefined].filter((x): x is BoardVote => !!x);
  return votes.find((x) => !x.passes) ?? votes[0];
}

/** The approval vote on releasing a capability-threshold model's weights, or undefined if none is needed. */
export function transferVote(s: GameStateV2, v: ModelVersion, channel: Channel): BoardVote | undefined {
  if (channel !== 'open') return undefined;
  const t = capabilityThresholds(v);
  if (!t.length) return undefined;
  return approvals(s, 'transferModel', `${v.name} crossed ${t.join(', ')}: open weights hand it to everyone`);
}

/** The approval vote on IP access that would license a capability-threshold model (FIN4b): a licence to a partner's lab
 *  (`to`) transfers the model as surely as open weights do. Undefined when no vote is needed (no body holds the power, or
 *  the best model the licence would reach crosses no threshold). */
export function ipTransferVote(s: GameStateV2, to: string): BoardVote | undefined {
  const v = licensedModel(s);
  const t = v ? capabilityThresholds(v) : [];
  if (!v || !t.length) return undefined;
  return approvals(s, 'transferModel', `IP access licenses ${v.name} (${t.join(', ')}) to ${to}`);
}

/** Why the charter stops this release, or undefined (models/deployments.ts deployGate). Internal use is never a
 *  release. */
export function charterReleaseBlock(s: GameStateV2, v: ModelVersion, channel: Channel): string | undefined {
  if (!external(channel)) return undefined;
  if (missionPowers(s)) {
    const f = safetyRedFlags(v, COMMITTEE_EST);
    if (f.length) return `Safety committee halts the release: your evals red-flag ${v.name} (${f.map((x) => `${x.name.toLowerCase()} ${Math.round(x.est * 100)}%`).join(', ')}). It releases once every estimate is ${Math.round(COMMITTEE_EST * 100)}% or less (investigate, patch, retrain)`;
  }
  const tv = transferVote(s, v, channel);
  if (tv && !tv.passes) return `${tv.body === 'security' ? "The government's directors vote" : 'The mission body votes'} no on releasing ${v.name}'s weights, a capability-threshold model (${tv.yes} of ${tv.total} ${tv.body === 'security' ? 'security' : 'trust'} votes)`;
  return undefined;
}

const controlTrigger = (holder: string, votesAfter: number) => `${holder} would hold ${Math.round(votesAfter * 100)}% of all votes`;

/** The mission body's vote on a sale of control: when a deal would leave one holder above half of all votes
 *  (`votesAfter`, the votes it reaches: CORPORATE.md §4). */
export function controlVote(s: GameStateV2, partner: string, votesAfter: number): BoardVote | undefined {
  if (!missionPowers(s) || votesAfter <= 0.5) return undefined;
  return trustVote(s, 'saleOfControl', controlTrigger(partner, votesAfter));
}

/** Every vote a sale of control needs (FIN3c), in the order they are held: under a mission body its seats' (it cannot
 *  be forced, so it goes first), then the board's own (spec §7.3). Empty when the holder would not pass half of all
 *  votes. A deal or rescue (judged once every tranche lands), or a lab bought with your stock (its holders as one
 *  block), can sell control; buying a lab for cash never does. Only a voting stake can control. */
export function controlVotes(s: GameStateV2, holder: string, votesAfter: number): BoardVote[] {
  if (votesAfter <= 0.5) return [];
  return [controlVote(s, holder, votesAfter), boardVote(s, 'saleOfControl', controlTrigger(holder, votesAfter))].filter((v): v is BoardVote => !!v);
}

/** Models the charter holds back now (Board card, Products link): versions ready to release that the safety committee
 *  would stop, with the reason. Only the newest few. */
export function charterHolds(s: GameStateV2): { versionId: string; name: string; reason: string }[] {
  if (!missionPowers(s)) return [];
  const out: { versionId: string; name: string; reason: string }[] = [];
  for (const v of [...s.player.models.versions].reverse()) {
    if (v.status !== 'ready') continue;
    if (v.variant === 'imported') continue;
    const f = safetyRedFlags(v, COMMITTEE_EST);
    if (f.length) out.push({ versionId: v.id, name: v.name, reason: f.map((x) => `${x.name.toLowerCase()} ${Math.round(x.est * 100)}%`).join(', ') });
    if (out.length >= 4) break;
  }
  return out;
}
