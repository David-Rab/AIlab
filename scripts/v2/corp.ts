// C1: the control model (design/corp/CORPORATE.md §2–§3): votes by share class, the emergent controller, seats, label and
// powers, on constructed cap tables. Run alone: `node --import tsx scripts/v2/corp.ts`.
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { boardSeats, controllerOf, holdingsOf, investorAppeal, missionPowers, overrideAvailable, ownerFunded, PARENT_STANCE, seatsOf, securityPowers, startControl, structureLabel } from '../../src/engine/v2/finance/control';
import { parentBudgetYear, START_BY_ID } from '../../src/data/v2/starts';
import { PARTNER_TERMS } from '../../src/data/v2/deals';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { leadDays } from '../../src/engine/v2/actors/intel';
import { boardQSystem, ousterVote } from '../../src/engine/v2/finance/board';
import { opexSystem } from '../../src/engine/v2/finance/cashflow';
import { dealVotes, partnerBlocker, partnerTerms, partnerVotesAll, signPartner } from '../../src/engine/v2/finance/deals';
import { capitalQSystem } from '../../src/engine/v2/finance/investors';
import { FINANCE_ACTIONS } from '../../src/engine/v2/finance/actions';
import { budgetFactor, budgetYearOf, DIVISION_REASON, divisionBlock } from '../../src/engine/v2/finance/parent';
import { qOf } from '../../src/engine/v2/finance/ledger';
import { absorbingLab, endingsSystem } from '../../src/engine/v2/endings/endings';
import type { StartType } from '../../src/engine/v2/types';
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

// Init (C2): each start's charter, cap table and label; the board is the seats by votes.
const LABEL: Record<StartType, string> = { leader: 'Mission-controlled', challenger: 'Board-run', spinout: 'Founder-led', bigtech: 'Division of Azimuth' };
const games = Object.fromEntries((Object.keys(LABEL) as StartType[]).map((st) => [st, newGame({ ...defaultSetupV2({ seed: 1 }), start: st })])) as Record<StartType, GameStateV2>;
check((Object.keys(LABEL) as StartType[]).every((st) => structureLabel(games[st]) === LABEL[st] && structureLabel(startControl(START_BY_ID[st])) === LABEL[st]), 'init label by start: leader Mission-controlled, challenger Board-run, spinout Founder-led, bigtech Division of Azimuth', (Object.keys(LABEL) as StartType[]).map((st) => `${st} ${structureLabel(games[st])}`).join(' · '));
const ch = games.challenger.player.finance.ownership;
check(near(ch.founder, 0.4) && near(ch.fin, 0.45) && near(ch.strat.Azimuth ?? 0, 0.15), 'init challenger: founders 40%, investors 45%, Azimuth 15%');
check(games.leader.player.charter.missionBody && games.leader.player.charter.profitCap && !games.spinout.player.charter.missionBody && !games.challenger.player.charter.profitCap, 'init charter by start: leader mission body + profit cap; others none');
check(ownerFunded(games.bigtech) && !ownerFunded(games.leader) && overrideAvailable(games.spinout) && !overrideAvailable(games.challenger) && missionPowers(games.leader), 'init powers: bigtech owner-funded, spinout override, challenger none, leader mission powers');
check(boardSeats(games.leader).length === 7 && boardSeats(games.leader).filter((x) => x.kind === 'mission').length === 4 && games.leader.player.board.extraSeats.length === 0, 'init leader board: CEO + 6 elected, 4 mission seats, no extras');

// C3: what happens when control changes, and how the player loses it.
const bigLab = (s: GameStateV2) => s.rivals.find((r) => r.core.status === 'active' && r.npc.kind === 'bigtech')!;
/** Move the in-house (big-tech) lab so that the player's estimated lead over it is `days`. */
const setLead = (s: GameStateV2, days: number) => { const lab = bigLab(s); lab.npc.d -= days - leadDays(s, lab.core.id).est; return lab; };
/** Azimuth owns the company outright (voting): an owner-funded division; confidence 15 and a warning 61 days old. */
function lowDivision(): GameStateV2 {
  const s = mk({}, { strat: { Azimuth: 1 } }, { voting: ['Azimuth'] });
  s.player.board.confidence = 15;
  s.player.finance.ws3.boardWarnDay = s.time.day - 61;
  return s;
}

// (a) An owner-funded division's board can oust: the parent's seats vote it.
{
  const s = lowDivision();
  const ov = ousterVote(s);
  boardQSystem.run(s, makeCtx(s));
  endingsSystem.run(s, makeCtx(s));
  check(ownerFunded(s) && ov.live && ov.passes && ov.seats.filter((x) => x.holder === 'Azimuth').every((x) => x.yes) && s.flags['ws3.ousterDay'] !== undefined && s.ending?.id === 'ousted', 'C3a an owner-funded division below 25 with a 60-day warning is ousted: the vote passes on the parent\'s seats', `vote ${ov.yes}/${ov.total} · lead over ${bigLab(s).core.name} ${leadDays(s, bigLab(s).core.id).est} d · ending ${s.ending?.id}`);
}

// (b) The same with the controller's in-house lab ahead: absorbed, the lab named.
{
  const s = lowDivision();
  const lab = setLead(s, -90);
  boardQSystem.run(s, makeCtx(s));
  endingsSystem.run(s, makeCtx(s));
  check(absorbingLab(s)?.core.id === lab.core.id && s.ending?.id === 'absorbed' && s.ending.text.includes(lab.core.name) && /folds your lab into its own/.test(s.ending.text), 'C3b the same ouster with the controller\'s in-house lab ahead is the absorbed ending, naming the lab', `${s.ending?.id}: ${s.ending?.text}`);
}

// (c) A voting partner crossing 50% mid-game: the controller changes, the owner budget starts at the last four
// quarters' spending, and raises are blocked.
{
  const s = mk({}, { founder: 0.5, fin: 0.2, strat: { 'Northwind Cloud': 0.3 } }, { voting: ['Northwind Cloud'] });
  const fx = s.player.finance.ws3;
  fx.opCost4q = [3, 3, 4, 4];
  fx.capex4q = [1, 1, 2, 2];
  opexSystem.run(s, makeCtx(s)); // first look: records "no controller"
  const before = fx.controllerId;
  const free = divisionBlock(s);
  s.player.finance.ownership = { founder: 0.3, mission: 0, fin: 0.15, public: 0, strat: { 'Northwind Cloud': 0.55 } };
  const log0 = s.log.length;
  const cashAt = s.player.finance.cash; // the check runs first in opex: this is the cash it carries in
  opexSystem.run(s, makeCtx(s));
  const d = fx.division;
  const y = budgetYearOf(qOf(s));
  const raise = FINANCE_ACTIONS.find((a) => a.id === 'fin.raise')!.available(s);
  const said = s.log.slice(log0).some((e) => /Northwind Cloud now controls/.test(e.text));
  check(before === null && free === undefined && fx.controllerId === 'Northwind Cloud' && ownerFunded(s) && said && !!d && d.year === y && near(d.plan, 20, 1e-9) && near(d.budget, 20 * budgetFactor(s.player.board.confidence), 1e-9) && d.paid === 0 && near(d.carryIn, cashAt, 1e-9) && near(d.plan / parentBudgetYear(y), d.planScale ?? 1, 1e-9),
    'C3c a voting partner past 50% mid-game: the controller changes (logged), the owner budget starts with year 0 = the last four quarters\' spending ($20B), the cash carries in', `controller ${before} → ${fx.controllerId} · plan ${d?.plan.toFixed(1)} · budget ${d?.budget.toFixed(1)}`);
  check(raise === DIVISION_REASON && partnerBlocker(s, 'Azimuth') === DIVISION_REASON, 'C3c raises and partner deals are blocked once owner-funded', String(raise));
}

// (d) A rescue is judged at the votes it reaches, every tranche included; a failed control vote stops it with no side
// effects.
{
  const s = mk({}, { founder: 0.3, fin: 0.21, strat: { 'Northwind Cloud': 0.49 } });
  s.player.board.confidence = 20; // the board's mood turns every seat but the CEO's against a sale of control
  const t = partnerTerms(s, 'Northwind Cloud', { rescue: true });
  const vs = dealVotes(s, t);
  const own0 = JSON.stringify(s.player.finance.ownership);
  const cash0 = s.player.finance.cash;
  const deals0 = s.player.finance.deals.length;
  const tr0 = s.player.finance.tranches.length;
  const err = signPartner(s, makeCtx(s), 'Northwind Cloud', { rescue: true }); // not forced (founders hold the override)
  check(partnerVotesAll(s, t) > 0.5 && vs[0]?.decision === 'saleOfControl' && !vs[0].passes && typeof err === 'string' && /sale of control/.test(err) && JSON.stringify(s.player.finance.ownership) === own0 && s.player.finance.cash === cash0 && s.player.finance.deals.length === deals0 && s.player.finance.tranches.length === tr0 && !s.player.finance.stratVoting?.['Northwind Cloud'],
    'C3d a rescue whose votes pass half needs the sale-of-control vote; a failed vote stops it with no side effects', `${vs.map((v) => `${v.decision} ${v.yes}/${v.total}`).join(', ')} · ${err}`);
  // Tranches count: a stake the equity now leaves under half passes it once a tranche is added.
  const u = mk({}, { founder: 0.6, fin: 0.3, strat: { 'Northwind Cloud': 0.1 } });
  const tu = partnerTerms(u, 'Northwind Cloud', { rescue: true });
  const withTranche = { ...tu, tranches: [{ amount: 50 * Math.max(10, u.player.finance.valuation), condition: 'ipo', dueDay: u.time.day, deadline: u.time.day + 365 }] };
  check(partnerVotesAll(u, tu) < 0.5 && !dealVotes(u, tu).some((v) => v.decision === 'saleOfControl') && partnerVotesAll(u, withTranche) > 0.5 && dealVotes(u, withTranche).some((v) => v.decision === 'saleOfControl'), 'C3d the votes a deal reaches include every tranche', `now ${(partnerVotesAll(u, tu) * 100).toFixed(0)}% · with the tranche ${(partnerVotesAll(u, withTranche) * 100).toFixed(0)}%`);
}

// (e) A chip vendor's stake is capped at 15%: its tranche stops at the cap. (f) A voting partner's tranche that would
// pass half of all votes without a control vote at signing lapses.
{
  const s = mk({}, { founder: 0.6, fin: 0.26, strat: { 'Silica Systems': 0.14 } });
  const t = partnerTerms(s, 'Silica Systems');
  s.player.finance.tranches.push({ amount: 10, dueDay: s.time.day, source: 'Silica Systems equity per GW', partner: 'Silica Systems', stakeCap: t.stakeCap });
  const trS = s.player.finance.tranches.length;
  capitalQSystem.run(s, makeCtx(s));
  const st = s.player.finance.ownership.strat['Silica Systems'];
  check(t.stakeCap === PARTNER_TERMS.chipVendor.stakeCap && t.stakeCap === 0.15 && t.tranches.length > 0 && near(st, 0.15, 1e-9) && !s.player.finance.tranches.some((x) => x.partner === 'Silica Systems') && s.player.finance.tranches.length < trS && typeof partnerBlocker(s, 'Silica Systems') === 'string', 'C3e a chip vendor\'s tranche stops at its 15% stake cap (and no new deal past it)', `stake ${(st * 100).toFixed(2)}% · ${partnerBlocker(s, 'Silica Systems')}`);
  const v = mk({}, { founder: 0.55, fin: 0.05, strat: { 'Northwind Cloud': 0.4 } }, { voting: ['Northwind Cloud'] });
  v.player.finance.tranches.push({ amount: 1000, dueDay: v.time.day, source: 'Northwind Cloud tranche 2', partner: 'Northwind Cloud' });
  const own0 = JSON.stringify(v.player.finance.ownership);
  capitalQSystem.run(v, makeCtx(v));
  check(JSON.stringify(v.player.finance.ownership) === own0 && !v.player.finance.tranches.some((x) => x.partner === 'Northwind Cloud') && v.log.some((e) => /more than half of all votes/.test(e.text)), 'C3f a voting partner\'s tranche past half of all votes, never voted at signing, lapses with a log line');
}

finish('corp');
