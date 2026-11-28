// C1: the control model (design/corp/CORPORATE.md §2–§3): votes by share class, the emergent controller, seats, label and
// powers, on constructed cap tables. Run alone: `node --import tsx scripts/v2/corp.ts`.
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { boardSeats, controllerOf, holdingsOf, investorAppeal, missionPowers, overrideAvailable, ownerFunded, PARENT_STANCE, seatsOf, securityPowers, startControl, structureLabel } from '../../src/engine/v2/finance/control';
import { LAB_KIND_BY_ID, POSITION_BY_ID, parentBudgetYear } from '../../src/data/v2/starts';
import { PRE_GAME_G_PER_YEAR } from '../../src/data/v2/runDesign';
import { gV0 } from '../../src/engine/v2/models/capability';
import type { Charter, GameStateV2, LabKindId, NpcSetupLab, Ownership } from '../../src/engine/v2/types';
import { COMPANY_IDS, PARTNER_DEFS, PARTNER_TERMS } from '../../src/data/v2/deals';
import { KINDS as NPC_KINDS, REALISTIC_CAST } from '../../src/data/v2/npcLabs';
import { persOf } from '../../src/engine/v2/npc/lab';
import { affiliatedLab, dealVotes, partnerBlocker, partnerTerms, partnerVotesAll, signPartner } from '../../src/engine/v2/finance/deals';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { leadDays } from '../../src/engine/v2/actors/intel';
import { boardQSystem, ousterVote } from '../../src/engine/v2/finance/board';
import { opexSystem } from '../../src/engine/v2/finance/cashflow';
import { capitalQSystem } from '../../src/engine/v2/finance/investors';
import { FINANCE_ACTIONS } from '../../src/engine/v2/finance/actions';
import { budgetFactor, budgetYearOf, DIVISION_REASON, divisionBlock, divisionQ, revenueToParent } from '../../src/engine/v2/finance/parent';
import { qOf } from '../../src/engine/v2/finance/ledger';
import { absorbingLab, endingsSystem } from '../../src/engine/v2/endings/endings';
import { acceptDpa, dpaStaffPlan, nationalize } from '../../src/engine/v2/world/usgov';
import { frontier } from '../../src/engine/v2/world/observe';
import { GOV_EVENTS } from '../../src/engine/v2/events/catalog/gov';
import { charterReleaseBlock, transferVote } from '../../src/engine/v2/finance/charter';
import { TEAM_SIZE } from '../../src/data/v2/teams';
import { independentAtEnd } from '../../src/engine/v2/endings/scoring';
import { labOf } from '../../src/engine/v2/actors/rivals';
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

// Init (C2, C5a): each lab kind's charter, cap table and label; the board is the seats by votes.
const LABEL: Record<LabKindId, string> = { leader: 'Mission-controlled', safety: 'Mission-controlled', racer: 'Founder-led', bigtech: 'Division of Azimuth', breakaway: 'Founder-led', newcomer: 'Founder-led' };
const KINDS = Object.keys(LABEL) as LabKindId[];
const games = Object.fromEntries(KINDS.map((k) => [k, newGame({ ...defaultSetupV2({ seed: 1 }), labKind: k })])) as Record<LabKindId, GameStateV2>;
check(KINDS.every((k) => structureLabel(games[k]) === LABEL[k] && structureLabel(startControl(LAB_KIND_BY_ID[k])) === LABEL[k]), 'init label by kind: leader/safety Mission-controlled, racer/breakaway/newcomer Founder-led, bigtech Division of Azimuth', KINDS.map((k) => `${k} ${structureLabel(games[k])}`).join(' · '));
const sf = games.safety.player.finance.ownership;
check(near(sf.founder, 0.3) && near(sf.mission, 0.1) && near(sf.fin, 0.46) && near(sf.strat.Azimuth ?? 0, 0.14) && games.safety.player.finance.deals.some((d) => d.partner === 'Azimuth' && d.legacy), 'init safety: founders 30%, mission body 10%, investors 46%, Azimuth 14% non-voting legacy');
check(games.leader.player.finance.deals.some((d) => d.id === 'DL-northwind0' && d.legacy) && !games.racer.player.finance.deals.length && near(games.racer.player.finance.ownership.founder, 0.6) && near(games.newcomer.player.finance.ownership.founder, 0.85), 'init partners: leader Northwind legacy deal, racer none; racer founders 60%, newcomer 85%');
check(games.leader.player.charter.missionBody && games.leader.player.charter.profitCap && games.safety.player.charter.missionBody && !games.safety.player.charter.profitCap && KINDS.filter((k) => k !== 'leader' && k !== 'safety').every((k) => !games[k].player.charter.missionBody && !games[k].player.charter.profitCap), 'init charter by kind: leader mission body + profit cap, safety mission body, others none');
check(ownerFunded(games.bigtech) && !ownerFunded(games.leader) && overrideAvailable(games.breakaway) && overrideAvailable(games.racer) && !overrideAvailable(games.safety) && missionPowers(games.leader) && missionPowers(games.safety), 'init powers: bigtech owner-funded, breakaway and racer override, safety none, leader and safety mission powers');
check(boardSeats(games.leader).length === 7 && boardSeats(games.leader).filter((x) => x.kind === 'mission').length === 4 && games.leader.player.board.extraSeats.length === 0, 'init leader board: CEO + 6 elected, 4 mission seats, no extras');
// Each kind's position: its cash, compute and model lag; the kind's NPC lab is absent from the cast.
const posOk = KINDS.map((k) => {
  const g = games[k], p = POSITION_BY_ID[LAB_KIND_BY_ID[k].position], want = p.cash + (k === 'bigtech' ? parentBudgetYear(0) / 4 : 0);
  const lag = (gV0(g.hidden.timeline) - g.player.models.versions[0].G) / PRE_GAME_G_PER_YEAR * 12;
  return { k, ok: near(g.player.finance.cash, want, 1e-6) && g.player.computeOnline === p.owned + p.rented && Math.abs(lag - p.lagMonths) < 0.05 };
});
check(posOk.every((x) => x.ok), 'init position by kind: cash, compute (owned + rented) and start-model lag are the position row\'s', posOk.filter((x) => !x.ok).map((x) => x.k).join(',') || 'all six');
const absent = KINDS.map((k) => ({ k, gone: LAB_KIND_BY_ID[k].replacesNpc, g: games[k] }));
check(absent.every((x) => !x.gone || !x.g.rivals.some((r) => r.npc.kind === x.gone)) && absent.filter((x) => x.gone).every((x) => x.g.rivals.length === 5) && games.newcomer.rivals.length === 6 && games.newcomer.rivals.some((r) => r.npc.kind === 'leader'), 'init cast: the kind\'s NPC lab is absent (leader, safety, racer, bigtech, upstart), five rivals left; newcomer replaces none (six)');
check(!games.bigtech.rivals.some((r) => r.npc.kind === 'bigtech') && ownerFunded(games.bigtech), 'init bigtech: Azimuth\'s in-house NPC lab is the player');
// Custom: any position, a charter and a cap-table preset; it replaces no NPC lab.
const cu = (capTable: 'founderMajority' | 'investorHeavy' | 'wholly', charter: { missionBody?: boolean; profitCap?: boolean } = {}, position: 'frontier' | 'contender' | 'talent' | 'capital' | 'scratch' = 'contender') =>
  newGame({ ...defaultSetupV2({ seed: 1 }), labKind: 'custom', custom: { position, charter, capTable } });
const cf = cu('founderMajority'), ci = cu('investorHeavy'), cw = cu('wholly'), cm = cu('founderMajority', { missionBody: true, profitCap: true });
check(structureLabel(cf) === 'Founder-led' && structureLabel(ci) === 'Board-run' && structureLabel(cw) === 'Division of Azimuth' && structureLabel(cm) === 'Mission-controlled', 'custom labels: founderMajority Founder-led, investorHeavy Board-run, wholly Division of Azimuth, mission body Mission-controlled', [cf, ci, cw, cm].map(structureLabel).join(' · '));
check(near(ci.player.finance.ownership.founder, 0.35) && near(ci.player.finance.ownership.fin, 0.65) && ownerFunded(cw) && cf.rivals.length === 6 && cf.player.finance.cash === POSITION_BY_ID.contender.cash && cm.player.charter.profitCap, 'custom: investorHeavy 35/65, wholly owner-funded, no NPC lab replaced (six rivals), cash from the chosen position');
const cfr = cu('founderMajority', {}, 'frontier');
check(cfr.player.finance.cash === POSITION_BY_ID.frontier.cash && cfr.player.finance.ownership.founder === 0.6 && !cfr.player.finance.deals.length, 'custom frontier: the frontier row\'s cash with the custom cap table and no Northwind stake');

// C5b: the companies cast and who owns or backs each lab.
const castOwners = REALISTIC_CAST.filter((e) => e.owner);
check(REALISTIC_CAST.every((e) => (!e.owner || COMPANY_IDS.includes(e.owner)) && Object.keys(e.backers ?? {}).every((c) => COMPANY_IDS.includes(c as never))), 'C5b every cast owner and backer is a company in COMPANIES');
check(REALISTIC_CAST.every((e) => (NPC_KINDS[e.kind].funding === 'parent') === !!e.owner), 'C5b funding parent <=> owner set', castOwners.map((e) => e.kind + ':' + e.owner).join(' '));
check(REALISTIC_CAST.find((e) => e.kind === 'bigtech')?.owner === 'Azimuth' && REALISTIC_CAST.find((e) => e.kind === 'openweights')?.owner === 'Lattice' && REALISTIC_CAST.find((e) => e.kind === 'leader')?.backers?.['Northwind Cloud'] === 0.27 && REALISTIC_CAST.find((e) => e.kind === 'safety')?.backers?.Azimuth === 0.14 && !REALISTIC_CAST.some((e) => ['racer', 'upstart', 'china'].includes(e.kind) && (e.owner || e.backers)), 'C5b cast ties: bigtech Azimuth, open-weights Lattice, leader backed by Northwind 27%, safety by Azimuth 14%, racer, upstart and China none');
check(affiliatedLab(games.leader, 'Azimuth')?.npc.kind === 'bigtech' && !affiliatedLab(games.bigtech, 'Azimuth') && !affiliatedLab(games.leader, 'Northwind Cloud') && !affiliatedLab(games.leader, 'Silica Systems'), 'C5b affiliatedLab: Azimuth -> the big-tech lab on the leader kind, none on the bigtech kind; Northwind and Silica none');
check(!PARTNER_DEFS.some((x) => x.id === 'Lattice') && affiliatedLab(games.leader, 'Lattice')?.npc.kind === 'openweights', 'C5b Lattice is not a partner (no terms), and owns the open-weights lab');
const rs = games.racer.player.sites;
check(rs.length > 0 && rs.every((x) => x.path === 'grid' && x.capexPaid === x.capex && x.capex > 0) && !games.racer.player.finance.ledger?.some((c) => c.kind === 'lease'), 'C5b racer: sites are owned grid campuses, capex paid, no rent', rs.map((x) => x.name + ' ' + x.mw + ' MW').join(', '));

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


// C4: the government's soft path (E22: pooled compute and staff, a golden share with security approval) and its hard
// path (nationalize: state control while the player leads, absorbed while it is behind).
{
  const leader = () => mk({ missionBody: true, profitCap: true }, { founder: 0.3, mission: 0.26, fin: 0.17, strat: { Northwind: 0.27 } });
  /** A fresh game's player leads the frontier (its starting product is the best public model). */
  const asFrontier = (s: GameStateV2) => s;
  // Soft path.
  const s = leader();
  const seats0 = seatsOf(s).length;
  const ctl0 = controllerOf(s)?.id;
  const staff0 = s.rivals.reduce((a, r) => a + r.core.staff.cap + r.core.staff.saf, 0);
  const teams0 = s.player.teams.length;
  const heads0 = s.player.teams.reduce((a, t) => a + t.heads, 0);
  const plan = dpaStaffPlan(s);
  const e22 = GOV_EVENTS.find((e) => e.id === 'E22')!.choices[0]!;
  const pre = e22.preview(s);
  const res = acceptDpa(s, makeCtx(s));
  const staff1 = s.rivals.reduce((a, r) => a + r.core.staff.cap + r.core.staff.saf, 0);
  const heads1 = s.player.teams.reduce((a, t) => a + t.heads, 0);
  const whole = s.player.teams.every((t) => t.heads === TEAM_SIZE[t.role]);
  check(s.player.charter.goldenShare && seats0 === 7 && seatsOf(s).length === 9 && seatsBy(s, 'gov') === 2 && controllerOf(s)?.id === ctl0 && securityPowers(s), 'C4 E22 accepted: golden share, 9 seats (2 government), the controller unchanged, security approval', `${seats0} → ${seatsOf(s).length}, controller ${ctl0} → ${controllerOf(s)?.id}`);
  check(plan.heads > 0 && res.teams > 0 && s.player.teams.length === teams0 + res.teams && heads1 - heads0 === plan.heads && whole && near(staff0 - staff1, plan.heads, 1e-6) && staff1 < staff0, 'C4 E22 accepted: the pooled staff arrive as whole teams (100/50/20) and the American labs lose exactly those heads', `+${res.teams} teams, ${plan.heads} heads; rivals ${staff0.toFixed(0)} → ${staff1.toFixed(0)}`);
  check(pre.gains.some((l) => l.currency === 'compute') && pre.gains.some((l) => l.currency === 'staffTime' && l.amount > 0) && pre.costs.some((l) => /2 government directors/.test(l.target ?? '') && /security approval/.test(l.target ?? '')), 'C4 E22 preview lists compute, staff and the 2 government directors with security approval');
  // Security approval: a capability-threshold model's open weights need the government directors' yes.
  const g = mk({ goldenShare: true }, { founder: 0.9, fin: 0.1 });
  g.player.board.confidence = 50; // a neutral mood: the directors' own stance decides
  const risky = { name: 'Test-9', flags: { cyberOffense: true } } as never;
  const plain = { name: 'Test-1', flags: {} } as never;
  const tv = transferVote(g, risky, 'open');
  const block = charterReleaseBlock(g, risky, 'open');
  check(!!tv && tv.body === 'security' && !tv.canForce && tv.seats.length === 2 && tv.seats.every((x) => x.kind === 'gov') && !tv.passes && typeof block === 'string' && /government's directors vote no/.test(block) && !transferVote(g, plain, 'open') && charterReleaseBlock(g, plain, 'open') === undefined && !transferVote(g, risky, 'api'), 'C4 security approval: the government directors vote no on open weights of a threshold model, cannot be forced; no vote without a threshold flag or for a private channel', String(block));

  // Hard path while leading.
  const h = asFrontier(leader());
  h.player.board.confidence = 70;
  opexSystem.run(h, makeCtx(h)); // records the controller
  nationalize(h, makeCtx(h));
  opexSystem.run(h, makeCtx(h));
  endingsSystem.run(h, makeCtx(h));
  check(frontier(h).lab === 'player' && h.player.charter.stateControl && controllerOf(h)?.kind === 'government' && structureLabel(h) === 'Government-controlled' && ownerFunded(h) && !!h.player.finance.ws3.division && near(h.player.board.confidence, 40, 1e-6) && !h.ending && h.usgov.consolidated === 'nationalized' && securityPowers(h) && !missionPowers(h), 'C4 nationalize while leading: state control, Government-controlled, owner-funded, budget started, confidence 40, no ending', `${structureLabel(h)} · confidence ${h.player.board.confidence} · ending ${h.ending?.id}`);
  check(near(votes(h, 'government'), 2 / 3) && seatsBy(h, 'gov') === 4 && !independentAtEnd(h), 'C4 state control: the government holds 2/3 of the votes (4 of the 6 elected seats)');

  // The government's yearly review: three goals, a missed security floor costs confidence; revenue stays.
  const d = h.player.finance.ws3.division!;
  h.player.finance.ws3.division = { ...d, year: budgetYearOf(qOf(h)) - 1, govGoals: ['security', 'lead', 'incident'], govGoalsDay: h.time.day - 365 };
  const ok = structuredClone(h) as GameStateV2; // the same review with the floor met
  ok.player.security.wsl = 9;
  divisionQ(ok, makeCtx(ok));
  h.player.security.wsl = 0; // below the government's floor
  const c0 = h.player.board.confidence;
  divisionQ(h, makeCtx(h));
  const after = h.player.finance.ws3.division!;
  const rv = after.reviews[after.reviews.length - 1];
  const sec = rv?.gov?.find((x) => x.id === 'security');
  check(!!rv?.gov && rv.gov.length === 3 && sec?.met === false && h.player.board.confidence < ok.player.board.confidence && after.govGoals?.length === 3 && !(h.player.finance.promises ?? []).some((p) => p.by === 'parent'), 'C4 the government\'s review judges three goals (a missed security floor lowers confidence) and sets three new ones, not parent promises', `confidence ${c0.toFixed(1)} → ${h.player.board.confidence.toFixed(1)} (floor met: ${ok.player.board.confidence.toFixed(1)}) · ${rv?.gov?.map((x) => `${x.id} ${x.met ? 'met' : 'missed'}`).join(', ')}`);
  const cash0 = h.player.finance.cash;
  revenueToParent(h, makeCtx(h), 5);
  const p = mk({}, { founder: 0.3, strat: { 'Northwind Cloud': 0.7 } }, { voting: ['Northwind Cloud'] });
  const pc0 = p.player.finance.cash;
  revenueToParent(p, makeCtx(p), 5);
  check(h.player.finance.cash === cash0 && p.player.finance.cash === pc0 - 5, 'C4 revenue stays with the company under government control (a parent takes it)');

  // Hard path while behind: absorbed under the frontier lab.
  const b = leader();
  b.player.deployments = []; // nothing public: a rival leads
  const front = frontier(b).lab;
  nationalize(b, makeCtx(b));
  endingsSystem.run(b, makeCtx(b));
  const name = labOf(b, front as string)?.core.name ?? '';
  check(front !== null && front !== 'player' && !b.player.charter.stateControl && b.ending?.id === 'absorbed' && /folds your lab into the national project under/.test(b.ending.text) && b.ending.text.includes(name), 'C4 nationalize while behind: the absorbed ending, the government folds the lab into the national project under the frontier lab', `${b.ending?.id}: ${b.ending?.text}`);
}

// C6: the setup screen's custom kinds and Create-rivals ties.
const c6a = cu('founderMajority', { missionBody: true }, 'contender'), c6b = cu('investorHeavy', {}, 'talent'), c6c = cu('wholly', {}, 'capital');
check(structureLabel(c6a) === 'Mission-controlled' && structureLabel(c6b) === 'Board-run' && structureLabel(c6c) === 'Division of Azimuth', 'C6 custom: contender + mission body + founder-majority Mission-controlled; talent + investor-heavy Board-run; capital + wholly Division of Azimuth', [c6a, c6b, c6c].map(structureLabel).join(' · '));
const mkRivals = (cast: NpcSetupLab[]) => newGame({ ...defaultSetupV2({ seed: 1 }), cast });
const c6r = mkRivals([{ kind: 'racer', lagMonths: 3, owner: 'Lattice', backers: {} }, { kind: 'bigtech', lagMonths: 3, backers: { 'Silica Systems': 0.1 } }, { kind: 'safety', lagMonths: 3 }]);
const rOwned = c6r.rivals.find((r) => r.npc.kind === 'racer')!, rFree = c6r.rivals.find((r) => r.npc.kind === 'bigtech')!, rDefault = c6r.rivals.find((r) => r.npc.kind === 'safety')!;
check(rOwned.npc.owner === 'Lattice' && persOf(rOwned.npc).funding === 'parent', 'C6 Create rivals: a lab with owner Lattice is parent-funded and owned by Lattice');
check(!rFree.npc.owner && persOf(rFree.npc).funding === 'private' && near(rFree.npc.backers?.['Silica Systems'] ?? 0, 0.1), 'C6 Create rivals: owner None on a big-tech lab makes it privately funded; backer Silica 10% is written');
check(rDefault.npc.backers?.Azimuth === 0.14 && persOf(rDefault.npc).funding === 'private', 'C6 Create rivals: a lab with no ties set keeps its own kind ties (safety backed by Azimuth 14%)');
finish('corp');
