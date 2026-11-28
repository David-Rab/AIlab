// C1: the control model (design/corp/CORPORATE.md §2–§3): votes by share class, the emergent controller, seats, label and
// powers, on constructed cap tables. Run alone: `node --import tsx scripts/v2/corp.ts`.
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { PARENT_STANCE } from '../../src/engine/v2/finance/board';
import { controllerOf, holdingsOf, investorAppeal, missionPowers, overrideAvailable, ownerFunded, seatsOf, securityPowers, structureLabel } from '../../src/engine/v2/finance/control';
import type { Charter, GameStateV2, Ownership } from '../../src/engine/v2/types';
import { check, finish } from './lib';

const near = (a: number, b: number, tol = 1e-3) => Math.abs(a - b) <= tol;
const NONE: Charter = { missionBody: false, profitCap: false, goldenShare: false, stateControl: false };

function mk(charter: Partial<Charter>, o: Partial<Ownership>, opts: { dual?: boolean; voting?: string[] } = {}): GameStateV2 {
  const s = newGame(defaultSetupV2({ seed: 1 }));
  s.player.charter = { ...NONE, ...charter };
  s.player.finance.ownership = { founder: 0, mission: 0, fin: 0, public: 0, strat: {}, ...o };
  s.player.finance.dualClass = opts.dual ? true : undefined;
  s.player.finance.stratVoting = opts.voting ? Object.fromEntries(opts.voting.map((p) => [p, true as const])) : undefined;
  return s;
}
const votes = (s: GameStateV2, id: string) => holdingsOf(s).find((h) => h.id === id)?.votes ?? 0;
const seatsBy = (s: GameStateV2, kind: string) => seatsOf(s).filter((x) => x.kind === kind).length;
const total = (s: GameStateV2, golden = 0) => seatsOf(s).length === 7 + golden;

// 1. Leader cap table.
const s1 = mk({ missionBody: true, profitCap: true }, { founder: 0.3, mission: 0.26, fin: 0.17, strat: { Northwind: 0.27 } });
check(near(votes(s1, 'mission'), 2 / 3) && near(votes(s1, 'founders'), 0.2128) && near(votes(s1, 'investors'), 0.1206) && votes(s1, 'Northwind') === 0, '1 votes: mission 2/3, founders .2128, investors .1206, Northwind 0');
check(seatsBy(s1, 'mission') === 4 && seatsBy(s1, 'founder') === 2 && seatsBy(s1, 'financial') === 1 && seatsBy(s1, 'strategic') === 0, '1 seats: CEO + mission 4, founders 1, investors 1');
check(controllerOf(s1)?.id === 'mission' && structureLabel(s1) === 'Mission-controlled', '1 controller mission, label Mission-controlled');
check(!overrideAvailable(s1) && missionPowers(s1) && !ownerFunded(s1) && near(investorAppeal(s1), 0.6), '1 override false, missionPowers, not ownerFunded, appeal 0.6');

// 2. No controller, private.
const s2 = mk({}, { founder: 0.4, fin: 0.45, strat: { Azimuth: 0.15 } });
check(near(votes(s2, 'founders'), 0.4706) && near(votes(s2, 'investors'), 0.5294), '2 votes founders .4706, investors .5294');
check(controllerOf(s2) === undefined && structureLabel(s2) === 'Board-run' && !overrideAvailable(s2), '2 no controller, Board-run, no override');
check(seatsBy(s2, 'founder') === 4 && seatsBy(s2, 'financial') === 3, '2 seats founders 3 (+CEO), investors 3');

// 3. Founder majority.
const s3 = mk({}, { founder: 0.75, fin: 0.25 });
check(controllerOf(s3)?.kind === 'founders' && structureLabel(s3) === 'Founder-led' && overrideAvailable(s3), '3 founders control, Founder-led, override');
check(seatsBy(s3, 'founder') === 6 && seatsBy(s3, 'financial') === 1, '3 seats founders 5 (+CEO), investors 1');

// 4. Dual-class listed.
const s4 = mk({}, { founder: 0.3, fin: 0.3, public: 0.4 }, { dual: true });
check(near(votes(s4, 'founders'), 0.8108) && controllerOf(s4)?.kind === 'founders' && structureLabel(s4) === 'Founder-led · listed', '4 dual-class: founders .8108, controller, Founder-led · listed');

// 5. A division: one voting partner.
const s5 = mk({}, { strat: { Azimuth: 1 } }, { voting: ['Azimuth'] });
const st5 = seatsOf(s5).filter((x) => x.kind === 'strategic');
check(structureLabel(s5) === 'Division of Azimuth' && ownerFunded(s5), '5 Division of Azimuth, ownerFunded');
check(st5.length === 6 && st5.every((x) => x.holder === 'Azimuth' && x.stance.join() === PARENT_STANCE.join()), '5 six strategic seats with PARENT_STANCE');

// 6. A big partner, voting or not.
const s6 = mk({}, { founder: 0.3, fin: 0.15, strat: { Northwind: 0.55 } }, { voting: ['Northwind'] });
check(controllerOf(s6)?.id === 'Northwind' && structureLabel(s6) === 'Division of Northwind' && ownerFunded(s6), '6 voting Northwind controls: Division of Northwind, ownerFunded');
const s6n = mk({}, { founder: 0.3, fin: 0.15, strat: { Northwind: 0.55 } });
check(near(votes(s6n, 'founders'), 0.6667) && controllerOf(s6n)?.kind === 'founders' && structureLabel(s6n) === 'Founder-led', '6 non-voting Northwind: founders .667, Founder-led');

// 7. State control.
const s7 = mk({ missionBody: true, profitCap: true, stateControl: true }, { founder: 0.3, mission: 0.26, fin: 0.17, strat: { Northwind: 0.27 } });
check(near(votes(s7, 'government'), 2 / 3) && holdingsOf(s7).find((h) => h.id === 'mission')?.cls === 'common' && votes(s7, 'mission') > 0, '7 government 2/3, mission counted as common');
check(controllerOf(s7)?.kind === 'government' && structureLabel(s7) === 'Government-controlled' && !missionPowers(s7) && securityPowers(s7) && ownerFunded(s7), '7 Government-controlled, no mission powers, security powers, ownerFunded');
check(seatsBy(s7, 'gov') === 4, '7 four gov seats');

// 8. Golden share.
const s8 = mk({ goldenShare: true }, { founder: 0.75, fin: 0.25 });
check(controllerOf(s8)?.kind === 'founders' && seatsOf(s8).length === 9 && seatsBy(s8, 'gov') === 2 && securityPowers(s8), '8 golden share: founders still control, 9 seats, security powers');

// 9. Mission with only a non-voting partner.
const s9 = mk({ missionBody: true }, { mission: 0.5, strat: { Northwind: 0.5 } });
check(near(votes(s9, 'mission'), 1) && seatsBy(s9, 'mission') === 6, '9 mission votes 1, 6 mission seats');

// 10. Investor appeal.
check(investorAppeal(mk({}, { founder: 1 })) === 1 && near(investorAppeal(mk({ missionBody: true }, { founder: 1 })), 0.9)
  && near(investorAppeal(mk({ missionBody: true, profitCap: true }, { founder: 1 })), 0.6) && near(investorAppeal(mk({}, { founder: 1 }, { dual: true })), 0.95), '10 investor appeal 1 / 0.9 / 0.6 / 0.95');

// 11. Seat count.
check([s1, s2, s3, s4, s5, s6, s6n, s7, s9].every((s) => total(s)) && total(s8, 2), '11 seat count is 1 + 6 (+2 golden) in cases 1-9');
check(seatsOf(s2, [{ kind: 'independent', holder: 'Critics', stance: [0, 0, 0, 0], weight: 1 }]).length === 8, '11 extras are appended');

// Init: the start's charter.
const g = (governance: 'legacyNonprofit' | 'pbcTrust' | 'founder') => newGame({ ...defaultSetupV2({ seed: 1 }), governance }).player.charter;
check(g('legacyNonprofit').missionBody && g('legacyNonprofit').profitCap && g('pbcTrust').missionBody && !g('pbcTrust').profitCap && !g('founder').missionBody, 'init charter by governance');

finish('corp');
