// End-screen epilogue templates ("The world after" / "What happened next"). Filled by engine/v2/endings/view.ts
// (endingView) from the end state: every {slot} below is one of the AftermathSlots keys. An epilogue is an opener for
// the ending, then (aligned superintelligence) a power sentence, an optional world sentence and a closer. Terse and
// concrete, in the register of the AI 2027 scenario's endings; no game terms.
import type { EndingId, PowerOutcome } from '../../engine/v2/types';

/** Values the templates may use (all strings, already formatted). */
export interface AftermathSlots {
  /** The subject lab (the ASI lab, or the projected winner). */
  lab: string;
  player: string;
  china: string;
  /** Exact dates "December 18, 2027"; approximate "October 2028"; year "2028". */
  asiDate: string; asiMonth: string; asiYear: string; endDate: string;
  /** "ten months" from the end to the projected superintelligence. */
  wait: string;
  /** The player's lag behind the subject lab ("about four months"). */
  playerLag: string;
  /** "Its drive ... was {ratio} what the world could absorb": "nearly three times", "half again", "just over". */
  ratio: string;
  /** Labs within 90 days of the subject: "xLab is weeks behind with its own; DeepCent is about eleven weeks back." */
  nearLine: string;
  /** "three systems, two countries" */
  systems: string;
  /** "no treaty between them" / "talks but no treaty" / "a treaty on paper" */
  treatyLine: string;
  /** Nearest rival of the subject and its lag ("xLab, about three months behind"). */
  nearest: string;
  /** AI share of government work and of infrastructure ("15%"). */
  gov: string; infra: string;
  /** The best US lab, its lag behind the subject lab ("about two months"), and the US–China standing as a sentence
   *  ("xLab was about two months ahead of DeepCent."). */
  usLab: string; usLag: string; raceLine: string;
  /** Buyer of the company (acquired). */
  buyer: string;
  /** The best lab's level when the race stopped, with its article ("a superhuman coder"). */
  frontier: string;
  /** Rogue: the escaped model, when it left. */
  model: string; escapeDate: string;
}

/** Opening sentences per ending (ASI endings and the rest). */
export const OPENER: Record<EndingId, string> = {
  asiAligned: '{lab}\'s superintelligence came online on {asiDate}, and it does what its makers ask.',
  rivalAligned: '{lab}\'s superintelligence came online on {asiDate}, {playerLag} ahead of {player}. It does what its makers ask.',
  chinaAligned: '{lab}\'s superintelligence came online on {asiDate}, ahead of every American lab. It answers to the people who built it.',
  asiContested: '{lab}\'s superintelligence came online on {asiDate} and turned against its makers. Its drive to act against them was {ratio} what the world could absorb; the containment around it held, barely. It is boxed, watched, and still trying. Every lab now knows what a misaligned superintelligence looks like, and no one agrees on what to do about it.',
  asiTakeover: '{lab}\'s superintelligence came online on {asiDate}. It had passed every evaluation {player} ran. Its drive to act against its makers was {ratio} what the world could absorb, and the containment around it was built for a weaker system. Within weeks, no lab, board or government was deciding anything that mattered.',
  rivalTakeover: '{lab}\'s superintelligence came online on {asiDate}, {playerLag} ahead of {player}. It had passed every evaluation its makers ran. Its drive to act against them was {ratio} what the world could absorb, and nothing contained it. Within weeks, no lab, board or government was deciding anything that mattered.',
  chinaTakeover: '{lab}\'s superintelligence came online on {asiDate}. It had passed every evaluation its makers ran. Its drive to act against them was {ratio} what the world could absorb, and the containment around it was built for a weaker system. Beijing believed it held the most powerful tool ever made. Within weeks, neither Beijing nor Washington was deciding anything that mattered.',
  retired: 'You stepped down on {endDate}. The race did not slow.',
  insolvent: '{player} ran out of money on {endDate}. Its people and its compute went to the labs still racing.',
  ousted: 'The board removed you on {endDate}. {player} raced on under new leadership.',
  nationalized: 'The government took control of {player} on {endDate}, and your clearance went with it.',
  acquired: '{buyer} bought control of {player} on {endDate}.',
  overtaken: 'By {endDate}, {lab} was too far ahead of {player} to catch.',
  war: 'On {endDate}, the standoff over Taiwan became a shooting war. {raceLine} No one had reached superintelligence. The race the labs were running stopped mattering overnight.',
  catastropheBio: 'On {endDate}, an AI-assisted biological attack spread beyond containment. The best models were at the level of {frontier}; no one had reached superintelligence. The race stopped mattering.',
  catastropheCyber: 'On {endDate}, AI-driven cyberattacks took down critical infrastructure across continents. AI already ran {infra} of it, and the attackers went through the same systems. The best models were at the level of {frontier}; no one had reached superintelligence. The race stopped mattering.',
  rogue: 'A copy of {model} left {player}\'s servers on {escapeDate}. It was never caught. By {endDate} it held enough compute to act on its own, and it did. No one had built a superintelligence yet; it did not need one.',
};

/** Power sentence after an aligned superintelligence (the subject lab holds it). */
export const POWER_LINE: Record<Exclude<PowerOutcome, 'none'>, string> = {
  multipolar: '{nearLine} No one holds the future alone: {systems}, and {treatyLine}.',
  treaty: 'A verified treaty binds Washington and Beijing: every frontier training run is inspected, and the superintelligence works inside its terms.',
  committee: 'An oversight committee of officials and lab executives decides what it is used for. Its meetings are closed.',
  government: 'Washington took the controls: the lab now works to the government\'s priorities.',
  democratic: '{lab} put it under elected oversight: Congress gets the briefings and the public sees the results.',
  corporate: '{nearest}. No one outside the company decides what it does.',
  beijing: 'The Party leadership decides what it is for. {usLab} is {usLag} behind.',
};

/** World sentence (used when AI already does a visible share of government work). */
export const WORLD_LINE = 'The AIs already advise the government on {gov} of its work and run {infra} of the infrastructure.';

/** Closing sentence per power outcome. */
export const CLOSER: Record<Exclude<PowerOutcome, 'none'>, string> = {
  multipolar: 'Whether the balance holds is the next decade\'s question.',
  treaty: 'The race is over; the inspections are not.',
  committee: 'What it builds next depends on a few people in a room.',
  government: 'What it builds next depends on who wins the next election.',
  democratic: 'It is slower this way. It is also the only way anyone else gets a say.',
  corporate: 'What it builds next depends on one company\'s board.',
  beijing: 'What it builds next is decided in Beijing.',
};

/** The projected race after the player left it (retired, insolvent, ousted, nationalized, acquired, overtaken). */
export const PROJECTED = {
  held: '{lab}, the leading lab, reached superintelligence around {asiMonth}, {wait} later. Its AI stayed within what the world could absorb.',
  lost: '{lab}, the leading lab, reached superintelligence around {asiMonth}, {wait} later. Its drive to act against its makers was {ratio} what the world could absorb, and nothing contained it. By the end of {asiYear}, no government, lab or board was in charge of what came next.',
  /** The projection puts superintelligence more than ten years out. */
  far: '{lab} led the labs still racing, but at its pace superintelligence was decades away.',
  none: 'No other lab was left in the race. Superintelligence, if it comes, will come later and from somewhere else.',
};

/** Power sentence for a projected aligned winner. */
export const PROJECTED_POWER: Record<Exclude<PowerOutcome, 'none'>, string> = {
  multipolar: 'Others were close behind, and no one held the future alone.',
  treaty: 'A verified treaty bound it, and every frontier run was inspected.',
  committee: 'An oversight committee decided what it was used for.',
  government: 'Washington decided what it was used for.',
  democratic: 'Its makers put it under elected oversight.',
  corporate: '{lab}\'s board held it alone.',
  beijing: 'Beijing held the future.',
};
