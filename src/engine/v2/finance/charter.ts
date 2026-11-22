// Charter rights (FINANCE-V3 §7.2, FIN3b): the few hard rights a governance preset gives its board, each visible before
// you act. Owner: WS3. Finance reaches the rest of the game only through cash, this release block and the ouster
// (spec §0.3): the deployment gate (models/deployments.ts) asks `charterReleaseBlock` before any external release.
//
// | Right                                            | Preset            | Where it bites                                 |
// |--------------------------------------------------|-------------------|------------------------------------------------|
// | Safety committee halts a red-flagged release     | nonprofit PBC     | every external launch or model swap            |
// | Trust approval: sale of control, threshold model | PBC + trust       | a deal past 50%; open weights; IP access        |
// | Founder super-voting forces a major decision      | founder, dual-class | board votes (board.ts voteGate)               |
// | Nonprofit board removes the CEO more easily       | legacy nonprofit  | the ouster vote's reluctance ×0.5 (board.ts)    |
import type { BoardVote, Channel, GameStateV2, ModelVersion } from '../types';
import { boardVote, founderControl, OUSTER, trustVote } from './board';
import { capabilityThresholds, licensedModel, safetyRedFlags } from './observe';

export type CharterRightId = 'safetyCommittee' | 'trust' | 'founderControl' | 'nonprofitRemoval';
export interface CharterRight { id: CharterRightId; label: string; /** What it blocks, in 2–4 words (the Board card row). */ short: string; blocks: string; source: string }

/** The charter rights this company's governance gives its board now (Board card). */
export function charterRights(s: GameStateV2): CharterRight[] {
  const b = s.player.board;
  const out: CharterRight[] = [];
  if (b.safetyCommitteeVeto) out.push({ id: 'safetyCommittee', label: 'Safety committee', short: 'halts red-flagged releases', blocks: `Halts the release of any model your own safety evals red-flag: scheming, alignment faking or sandbagging believed above ${Math.round(COMMITTEE_EST * 100)}%`, source: 'Delaware AG conditions, Oct 2025 [R15]' });
  if (b.preset === 'pbcTrust') out.push({ id: 'trust', label: 'Trust approval', short: 'sale of control · open weights · IP access', blocks: "The trust votes on any sale of control (a holder past 50%) and on handing out a capability-threshold model (bio, cyber or replication flag): releasing its weights, or a partner's IP access to it (without its yes, a rescue's licence stops below the thresholds)", source: 'Anthropic LTBT charter [R15]' });
  if (founderControl(s)) out.push({ id: 'founderControl', label: 'Founder control', short: 'force a failed vote', blocks: 'Lets you force a major decision the board votes down, at board confidence −20', source: s.player.finance.dualClass ? 'dual-class shares [R15]' : 'founder super-voting [R15]' });
  if (b.preset === 'legacyNonprofit') out.push({ id: 'nonprofitRemoval', label: 'Nonprofit removal', short: 'ouster ×2 as easy', blocks: `The nonprofit board removes a CEO more easily: half the usual reluctance in an ouster vote (×${OUSTER.legacyMult})`, source: 'Nov 2023 [R15]' });
  return out;
}

const external = (c: Channel) => c !== 'internal';

/** The safety committee halts a release when the player's evals show a red-flag trait (scheming, alignment faking,
 *  sandbagging) more likely than not: estimate above 50% with clarity above 0.4 [D, FIN3b]. E17's 30% is the early
 *  warning; a halt needs more. On the bots (10 seeds each) 50% held 13% of the reference bot's full models, half of the
 *  race bot's and almost none of the careful bots'; at 30% it held 70% of the reference bot's (FIN3b notes). */
export const COMMITTEE_EST = 0.5;

/** The trust's vote on releasing a capability-threshold model's weights (PBC + trust), or undefined if none is needed. */
export function transferVote(s: GameStateV2, v: ModelVersion, channel: Channel): BoardVote | undefined {
  if (s.player.board.preset !== 'pbcTrust' || channel !== 'open') return undefined;
  const t = capabilityThresholds(v);
  if (!t.length) return undefined;
  return trustVote(s, 'transferModel', `${v.name} crossed ${t.join(', ')}: open weights hand it to everyone`);
}

/** The trust's vote on IP access that would license a capability-threshold model (PBC + trust, FIN4b): a licence to a
 *  partner's lab (`to`) transfers the model as surely as open weights do. Undefined when no vote is needed (another
 *  preset, or the best model the licence would reach crosses no threshold). */
export function ipTransferVote(s: GameStateV2, to: string): BoardVote | undefined {
  if (s.player.board.preset !== 'pbcTrust') return undefined;
  const v = licensedModel(s);
  const t = v ? capabilityThresholds(v) : [];
  if (!v || !t.length) return undefined;
  return trustVote(s, 'transferModel', `IP access licenses ${v.name} (${t.join(', ')}) to ${to}`);
}

/** Why the charter stops this release, or undefined (models/deployments.ts deployGate). Internal use is never a
 *  release. */
export function charterReleaseBlock(s: GameStateV2, v: ModelVersion, channel: Channel): string | undefined {
  if (!external(channel)) return undefined;
  if (s.player.board.safetyCommitteeVeto) {
    const f = safetyRedFlags(v, COMMITTEE_EST);
    if (f.length) return `Safety committee halts the release: your evals red-flag ${v.name} (${f.map((x) => `${x.name.toLowerCase()} ${Math.round(x.est * 100)}%`).join(', ')}). It releases once every estimate is ${Math.round(COMMITTEE_EST * 100)}% or less (investigate, patch, retrain)`;
  }
  const tv = transferVote(s, v, channel);
  if (tv && !tv.passes) return `The trust votes no on releasing ${v.name}'s weights, a capability-threshold model (${tv.yes} of ${tv.total} trust votes)`;
  return undefined;
}

/** The trust's vote on a sale of control (PBC + trust): when a deal would leave one holder above half the equity. */
export function controlVote(s: GameStateV2, partner: string, stakeAfter: number): BoardVote | undefined {
  if (s.player.board.preset !== 'pbcTrust' || stakeAfter <= 0.5) return undefined;
  return trustVote(s, 'saleOfControl', `${partner} would hold ${Math.round(stakeAfter * 100)}% of the company`);
}

/** Every vote a sale of control needs (FIN3c), in the order they are held: under PBC + trust the trust's (it cannot be
 *  forced, so it goes first), then the board's own (spec §7.3). Empty when no holder would pass 50%. A deal, a rescue,
 *  or a lab bought with your stock (its holders as one block) can sell control; buying a lab for cash never does. */
export function controlVotes(s: GameStateV2, holder: string, stakeAfter: number): BoardVote[] {
  if (stakeAfter <= 0.5) return [];
  const trigger = `${holder} would hold ${Math.round(stakeAfter * 100)}% of the company`;
  return [controlVote(s, holder, stakeAfter), boardVote(s, 'saleOfControl', trigger)].filter((v): v is BoardVote => !!v);
}

/** Models the charter holds back now (Board card, Products link): versions ready to release that the safety committee
 *  would stop, with the reason. Only the newest few. */
export function charterHolds(s: GameStateV2): { versionId: string; name: string; reason: string }[] {
  if (!s.player.board.safetyCommitteeVeto) return [];
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
