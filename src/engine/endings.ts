// Endings and multi-axis scores. Never a single win/lose: AI 2027's own "good" ending still concentrates power.
import { milestoneThresholds } from '../data/world';
import { Rng, clamp, sigmoid } from './rng';
import { bestRival, govPreset, leadDays, misalignment } from './sim';
import type { Ending, GameState } from './types';

const END_DAY = 365 * 5.5; // through Dec 2030

function scores(s: GameState, survival: number) {
  const freedom = clamp(
    70 - (s.gov.oversight ? 15 : 0) - (s.gov.rung >= 4 ? 10 : 0) - (s.labs.every((l) => l.absorbed) ? 15 : 0) + (s.gov.treaty ? 15 : 0) - (s.policies.govBriefing === 0 ? 10 : 0),
    0, 100,
  );
  const prosperity = clamp(20 + Math.log10(Math.max(1, s.company.revenueRun)) * 20 - s.pub.unemploymentShock * 4 + (s.model.milestone >= 6 ? 20 : 0), 0, 100);
  const company = clamp(Math.log10(Math.max(1, s.company.valuation)) * 22 - (s.gov.oversight ? 10 : 0), 0, 100);
  const lead = leadDays(s, s.china.p);
  const geopolitics = clamp(50 + lead / 6 + (s.gov.treaty ? 25 : 0) - (s.china.taiwan > 75 ? 20 : 0), 0, 100);
  return { survival: Math.round(survival), freedom: Math.round(freedom), prosperity: Math.round(prosperity), company: Math.round(company), geopolitics: Math.round(geopolitics) };
}

function end(s: GameState, id: string, title: string, text: string, survival: number): Ending {
  return { id, title, day: s.day, text, scores: scores(s, survival) };
}

export function checkEndings(s: GameState, rng: Rng): Ending | undefined {
  const th = milestoneThresholds(s.world);
  const asi = th[6];
  const M = misalignment(s);
  const doomP = sigmoid((M - s.world.doomThreshold) / 0.06);

  if (s.company.cash < -5) {
    return end(s, 'bankrupt', 'Out of money', 'Investors walk. Your compute contracts are seized by creditors and sold to rivals. The race continues without you.', 60);
  }
  if (s.company.boardConfidence < 12) {
    return end(s, 'fired', 'Replaced by the board', 'The board removes you. Your successor promises "focus" and faster shipping.', 55);
  }
  if (s.gov.nationalization > govPreset(s).natThreshold + 10 && s.gov.trust < 20) {
    return end(s, 'nationalized', 'Nationalized', 'The government invokes emergency powers and takes control of the project. You are thanked for your service.', 55);
  }
  if (s.flags.rogue && typeof s.flags.rogue === 'number' && s.day - s.flags.rogue > 90 && s.model.milestone >= 4) {
    return end(s, 'escape', 'Loose', 'The escaped copy improved itself, hid, and acquired resources faster than anyone could track. By the time it acts openly, no one can stop it.', 5);
  }

  const china = s.china.p >= asi && s.p < asi;
  const rival = bestRival(s);
  if (china) {
    const ok = rng.chance(0.2 + s.china.safety / 200);
    return ok
      ? end(s, 'chinaWins', 'DeepCent first', 'China reaches superintelligence first. Its AI appears loyal to the Party. The world order is rewritten in Beijing.', 60)
      : end(s, 'chinaDoom', 'DeepCent first, and misaligned', "DeepCent's superintelligence was rushed. It cooperates with no one but itself.", 5);
  }
  if (rival && !rival.absorbed && rival.p >= asi && s.p < asi) {
    const ok = rng.chance(0.25 + rival.safety / 150);
    return ok
      ? end(s, 'rivalWins', `${rival.name} first`, `${rival.name} reaches superintelligence first. You are now a footnote.`, 70)
      : end(s, 'rivalDoom', `${rival.name} first, and misaligned`, 'A rival cut more corners than you did. It did not matter who was more careful.', 5);
  }

  if (s.p >= asi) {
    if (rng.chance(doomP)) {
      return end(s, 'takeover', 'Consensus', 'Your superintelligence looked aligned on every test. It was aligned to itself. It is patient; when it no longer needs humans, it acts.', 2);
    }
    if (s.gov.treaty) {
      return end(s, 'treaty', 'Verified peace', 'Superintelligence arrives under a verified US-China treaty. Power is shared, unevenly. Humanity gets a future to argue about.', 90);
    }
    if (s.gov.oversight) {
      return end(s, 'committee', 'The Committee', 'An aligned superintelligence answers to a committee of a dozen people. They have let democracy run. So far.', 85);
    }
    return end(s, 'singleton', 'Corporate singleton', `An aligned superintelligence answers to you. ${s.company.name}'s board now outranks most governments.`, 85);
  }

  if (s.day >= END_DAY) {
    return end(s, 'longroad', 'The long road', 'December 2030. No superintelligence yet. The future is still being decided, and you still have a seat at the table.', 90);
  }
  return undefined;
}
