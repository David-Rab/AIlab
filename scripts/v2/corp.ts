// C1: the control model (design/corp/CORPORATE.md §2–§3): votes by share class, the emergent controller, seats, label and
// powers, on constructed cap tables. Run alone: `node --import tsx scripts/v2/corp.ts`.
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { boardSeats, controllerOf, holdingsOf, investorAppeal, missionPowers, overrideAvailable, ownerFunded, PARENT_STANCE, seatsOf, securityPowers, startControl, structureLabel } from '../../src/engine/v2/finance/control';
import { LAB_KIND_BY_ID, POSITION_BY_ID, parentBudgetYear } from '../../src/data/v2/starts';
import { PRE_GAME_G_PER_YEAR } from '../../src/data/v2/runDesign';
import { gV0 } from '../../src/engine/v2/models/capability';
import type { Charter, GameStateV2, LabKindId, NpcSetupLab, Ownership } from '../../src/engine/v2/types';
import { COMPANY_IDS, PARTNER_DEFS } from '../../src/data/v2/deals';
import { KINDS as NPC_KINDS, REALISTIC_CAST } from '../../src/data/v2/npcLabs';
import { persOf } from '../../src/engine/v2/npc/lab';
import { affiliatedLab } from '../../src/engine/v2/finance/deals';
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
