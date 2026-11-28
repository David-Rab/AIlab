// C7a: what a partner deal is and costs (design/corp/CORPORATE.md §5, DEALS-AUDIT.md §5), on constructed cases: the
// commitment in dollars (4 × the equity: yearly cloud contracts, or custom chips), tranches that land as the commitment is
// paid to the partner, exclusivity and IP access that end with the deal and scale with what they shut out or give, and the
// rescue priced by distress. Run alone: `node --import tsx scripts/v2/partners.ts`.
import { PARTNER_TERMS } from '../../src/data/v2/deals';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { FINANCE_ACTIONS } from '../../src/engine/v2/finance/actions';
import { makeCtx, tick } from '../../src/engine/v2/core/loop';
import { PARTNER_INTEREST, dependence, partnerInterest } from '../../src/engine/v2/finance/partnerInterest';
import { computeOnlineOf } from '../../src/engine/v2/compute/power';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { dealWith, exclusiveBlocker, followOnBlocker, followOnTerms, partnerMonthly, partnersNow, signFollowOn, ipBlocker, ipLeadScale, partnerBlocker, partnerStakeAfter, partnerTerms, rescuePartner, signPartner, termsEquity, vetoesOf } from '../../src/engine/v2/finance/deals';
import { capitalQSystem, trancheConditionMet } from '../../src/engine/v2/finance/investors';
import { leadEstimate } from '../../src/engine/v2/finance/observe';
import { paidTo } from '../../src/engine/v2/finance/ledger';
import type { GameStateV2, StrategicDeal } from '../../src/engine/v2/types';
import { check, finish } from './lib';

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const f1 = (x: number) => x.toFixed(1);
const ST = PARTNER_TERMS.strings;
/** The leader start (Northwind's legacy 27% is above the cap, so Azimuth is the open hyperscaler). */
const leader = () => newGame(defaultSetupV2({ seed: 4 }));
const dealEq = (s: GameStateV2) => Object.values(s.player.finance.ws3.years).reduce((a, y) => a + y.dealEquity, 0);
/** A start with no rival backed by a partner (the realistic cast has some: each lowers that partner's interest by 0.2). */
const clean = () => {
  const s = leader();
  for (const r of s.rivals) r.npc.backers = {};
  return s;
};
/** Move the affiliated lab so that the player's estimated lead over it is `days`. */
function setLead(s: GameStateV2, days: number) {
  const lab = s.rivals.find((r) => r.core.status === 'active' && r.npc.kind === 'bigtech')!;
  lab.npc.d -= days - leadEstimate(s, lab.core.id);
  return lab.core.id;
}

// 1. Cloud: the commitment is 4 × all the equity, in dollars, booked as one firm contract a year of C/6 that buys more
// capacity as prices fall.
{
  const s = leader();
  const t = partnerTerms(s, 'Azimuth');
  const sp = t.supply!;
  const eq = termsEquity(t);
  const year = (y: number) => sp.perQ.slice(4 * y, 4 * y + 4).reduce((a, b) => a + b, 0);
  check(near(sp.total, 4 * eq, 1e-9) && sp.kind === 'cloud' && sp.quarters === 24 && sp.yearly?.length === 6 && [0, 1, 2, 3, 4, 5].every((y) => near(year(y), sp.total / 6, 1e-9)), '1 cloud commitment = 4 × all the equity, in dollars, C/6 a year', `equity $${f1(eq)}B · commitment $${f1(sp.total)}B · $${f1(year(0))}B a year`);
  const up = sp.yearly!.every((h, y, a) => y === 0 || h > a[y - 1]);
  check(up && sp.firmDiscount === 0.1 && sp.partnerDiscount === PARTNER_TERMS.hyperscaler.discount && sp.prices.length === 24 && sp.prices[23] < sp.prices[0], '1 the capacity each year buys rises with the falling price path (firm 10% of the 6-year term, partner 10%)', sp.yearly!.map((h) => (h / 1e6).toFixed(2)).join(' → ') + 'M H100e');
  const n0 = s.player.cloud.length;
  const ledger0 = s.player.finance.ledger.length;
  const err = signPartner(s, makeCtx(s), 'Azimuth');
  const mine = s.player.cloud.slice(n0);
  const led = s.player.finance.ledger.slice(ledger0).filter((c) => c.payee === 'Azimuth');
  const starts = mine.map((c) => c.startDay);
  check(!err && mine.length === 6 && mine.every((c, y) => near(c.h100e, sp.yearly![y]) && c.provider === 'Azimuth' && c.cancellableNoticeQ === null) && starts.every((d, y) => y === 0 || d > starts[y - 1]) && led.length === 24 && near(led.reduce((a, c) => a + c.perQuarter, 0), sp.total, 1e-9), '1 signing books six yearly firm cloud contracts (rising H100e) and 24 take-or-pay payments adding up to C', `${mine.length} contracts · ${led.length} payments $${f1(led.reduce((a, c) => a + c.perQuarter, 0))}B`);
}

// 2. Custom chips: the same dollars at costMult of the list path over the existing quarters; equity is the cloud option's.
{
  const s = leader();
  const c = partnerTerms(s, 'Azimuth', { supply: 'cloud' });
  const t = partnerTerms(s, 'Azimuth', { supply: 'asic' });
  const sp = t.supply!;
  check(near(termsEquity(t), termsEquity(c), 1e-9) && sp.kind === 'asic' && near(sp.total, 4 * termsEquity(t), 1e-6) && sp.quarters === 24 && sp.costMult === PARTNER_TERMS.asic.costMult, '2 custom chips: the same equity as cloud, the same commitment (4 × equity) in dollars over the deal 24 quarters', `equity $${f1(termsEquity(t))}B · chips $${f1(sp.total)}B over ${sp.quarters} q at ${sp.costMult} of list`);
  const err = signPartner(s, makeCtx(s), 'Azimuth', { supply: 'asic' });
  const paid = s.player.finance.ledger.filter((x) => x.payee === 'Azimuth').reduce((a, x) => a + x.perQuarter, 0) + (sp.prepaid ?? 0);
  check(!err && near(paid, sp.total, 1e-6), '2 signing books the chips: payments (and any prepaid part) add up to C', `$${f1(paid)}B of $${f1(sp.total)}B`);
}

// 3. Tranches land as the commitment is paid to the partner since signing: tranche 2 at ⅓ of C, tranche 3 at ⅔.
{
  const s = leader();
  const t = partnerTerms(s, 'Azimuth');
  const C = t.supply!.total;
  signPartner(s, makeCtx(s), 'Azimuth');
  const tr = s.player.finance.tranches.filter((x) => x.partner === 'Azimuth');
  const base = tr[0]?.spentBase ?? -1;
  const [a, b] = PARTNER_TERMS.hyperscaler.spentAt;
  check(tr.length === 2 && tr.every((x) => /^spent:Azimuth:/.test(x.condition ?? '') && x.spentBase === base) && near(Number(tr[0].condition!.split(':')[2]), C * a, 1e-3) && near(Number(tr[1].condition!.split(':')[2]), C * b, 1e-3), '3 the two tranches read spent:Azimuth:⅓C and ⅔C', tr.map((x) => x.condition).join(' · '));
  const settle = () => { for (const x of s.player.finance.tranches) x.dueDay = s.time.day; capitalQSystem.run(s, makeCtx(s)); };
  const landed = () => 2 - s.player.finance.tranches.filter((x) => x.partner === 'Azimuth').length;
  const e0 = dealEq(s);
  s.player.finance.ws3.paidTo = { ...s.player.finance.ws3.paidTo, Azimuth: base + 0.3 * C };
  settle();
  const l0 = landed();
  const e30 = dealEq(s);
  s.player.finance.ws3.paidTo!.Azimuth = base + 0.34 * C;
  settle();
  const l1 = landed();
  const e1 = dealEq(s);
  s.player.finance.ws3.paidTo!.Azimuth = base + 0.67 * C;
  settle();
  const l2 = landed();
  check(l0 === 0 && near(e30, e0, 1e-9) && l1 === 1 && near(e1 - e0, t.equityNow, 1e-3) && l2 === 2, '3 tranche 2 lands only after ⅓ of C has been paid to the partner, tranche 3 after ⅔', `landed after 30% ${l0}, 34% ${l1}, 67% ${l2}`);
  // Payments made to other payees do not count, and the tally follows the ledger as it pays.
  const s2 = leader();
  signPartner(s2, makeCtx(s2), 'Azimuth');
  const cond = s2.player.finance.tranches.find((x) => x.partner === 'Azimuth')!;
  const t0 = paidTo(s2, 'Azimuth');
  const first = s2.player.cloud.filter((c) => c.provider === 'Azimuth')[0];
  const t1 = Date.now();
  while (s2.time.day < first.startDay - 1) tick(s2, { skip: ['endings'] });
  const paidOther = paidTo(s2, 'Data-centre rent') > 0 || paidTo(s2, 'Northwind Cloud') > 0;
  check(paidOther && paidTo(s2, 'Azimuth') === t0 && !trancheConditionMet(s2, cond.condition!, cond), '3 other payees do not count towards the partner\'s tranche; before its supply starts it has been paid nothing', `Azimuth ${f1(paidTo(s2, 'Azimuth') - t0)} · ${Math.round((Date.now() - t1) / 1000)} s`);
  while (s2.time.day < first.startDay + 62) tick(s2, { skip: ['endings'] });
  const got = paidTo(s2, 'Azimuth') - t0;
  const led = s2.player.finance.ledger.find((x) => x.payee === 'Azimuth' && (x.startDay ?? 0) === first.startDay);
  const n = got / Math.max(1e-9, (led?.perQuarter ?? 0) / 3);
  check(!!led && n >= 2 && Math.abs(n - Math.round(n)) < 1e-6, '3 the tally counts what the ledger pays the partner (a third of a quarter on each month-first)', `paid $${got.toFixed(3)}B = ${n.toFixed(2)} monthly payments of $${((led?.perQuarter ?? 0) / 3).toFixed(3)}B`);
}

// 4. Chip vendor: $10B per GW of its chips bought; a tranche per GW-worth paid; the commitment is the value of 2 GW.
{
  const s = leader();
  const t = partnerTerms(s, 'Silica Systems');
  const sp = t.supply!;
  const g = PARTNER_TERMS.chipVendor.gw;
  const conds = t.tranches.map((x) => Number(x.condition.split(':')[2]));
  check(t.tranches.length === g && t.tranches.every((x) => x.amount === PARTNER_TERMS.chipVendor.perGW && /^spent:Silica Systems:/.test(x.condition)) && near(conds[0], sp.total / g, 1e-3) && near(conds[1], sp.total, 1e-3) && near((sp.h100e * s.power.kWPerH100e * sp.quarters) / 1e6, g, 1e-9), '4 chip vendor: $10B per GW of its chips, a tranche per GW-worth paid (½C, C)', t.tranches.map((x) => x.condition).join(' · '));
  const p0 = paidTo(s, 'Silica Systems');
  signPartner(s, makeCtx(s), 'Silica Systems');
  check(near(paidTo(s, 'Silica Systems') - p0, sp.prepaid ?? 0, 1e-9), '4 a prepaid part of the first delivery counts as paid at signing', `$${f1(sp.prepaid ?? 0)}B`);
}

// 5. Exclusivity: offered only while a competitor could offer you something; inert once the deal has ended.
{
  const s = leader();
  const why = exclusiveBlocker(s, 'Azimuth') ?? '';
  const t = partnerTerms(s, 'Azimuth', { exclusive: true });
  check(/Northwind Cloud has nothing to offer you now, so there is nothing to exclude/.test(why) && !t.strings.exclusivity && !!t.options.exclusive.blocked, '5 exclusivity is blocked when the competitor has nothing to offer (Northwind is capped out)', why);
  const o = leader();
  o.player.finance.ownership.strat['Northwind Cloud'] = 0;
  const openEq = termsEquity(partnerTerms(o, 'Northwind Cloud'));
  const ex = partnerTerms(o, 'Azimuth', { exclusive: true });
  const plain = partnerTerms(o, 'Azimuth');
  check(!exclusiveBlocker(o, 'Azimuth') && !!ex.strings.exclusivity && near(termsEquity(ex), termsEquity(plain) * (1 + ST.exclusiveBump), 1e-9), '5 with Northwind able to offer, exclusivity is on offer and pays +25%', `Azimuth $${f1(termsEquity(plain))}B → $${f1(termsEquity(ex))}B`);
  const pv = FINANCE_ACTIONS.find((a) => a.id === 'fin.partner')!.preview(o, { partner: 'Azimuth', exclusive: true });
  const line = pv.exposure.find((x) => x.currency === 'freedom');
  check(new RegExp(`Northwind Cloud would give \\$${f1(openEq)}B of equity today`).test(String(line?.target)), '5 the preview names the competitor and the equity its own offer would give today', String(line?.target));
  const err = signPartner(o, makeCtx(o), 'Azimuth', { exclusive: true });
  const d = dealWith(o, 'Azimuth')!;
  const blocked = vetoesOf(o, 'Northwind Cloud').join() === 'Azimuth' && /exclusivity blocks deals with Northwind Cloud/.test(partnerBlocker(o, 'Northwind Cloud') ?? '');
  o.time.day = d.until;
  check(!err && blocked && vetoesOf(o, 'Northwind Cloud').length === 0 && !/exclusivity/.test(partnerBlocker(o, 'Northwind Cloud') ?? ''), '5 a running exclusivity blocks its competitor; past `until` it blocks nothing', `until day ${d.until}`);
}

// 6. IP access scales with your lead over its lab; none without a lead; the preview says what it costs in months.
{
  const none = leader();
  setLead(none, -30);
  const nt = partnerTerms(none, 'Azimuth', { ipAccess: true });
  check(ipBlocker(none, 'Azimuth') === 'You have no lead to license' && !nt.strings.ipAccess && nt.options.ipAccess.bump === 0, '6 IP access is blocked with no lead: "You have no lead to license"', ipBlocker(none, 'Azimuth'));
  const bumps = [60, 120, 200, 365].map((d) => {
    const s = leader();
    const lab = setLead(s, d);
    const base = termsEquity(partnerTerms(s, 'Azimuth'));
    const ip = partnerTerms(s, 'Azimuth', { ipAccess: true });
    return { d, scale: ipLeadScale(s, lab), want: ST.ipBump * Math.min(1, d / 30.4 / ST.ipFullLeadMonths), got: termsEquity(ip) / base - 1 };
  });
  check(bumps.every((b) => near(b.got, b.want, 1e-6) && near(b.scale, Math.min(1, b.d / 30.4 / 6), 1e-3)) && bumps[0].got < bumps[1].got && bumps[1].got < bumps[2].got && near(bumps[2].got, ST.ipBump, 1e-6) && near(bumps[3].got, ST.ipBump, 1e-6), '6 the IP bump is 20% × lead months ÷ 6, capped at 6 months of lead', bumps.map((b) => `${b.d} d → +${(b.got * 100).toFixed(1)}%`).join(' · '));
  const s = leader();
  setLead(s, 150);
  const lead = leadEstimate(s, s.rivals.find((r) => r.npc.kind === 'bigtech')!.core.id);
  const pv = FINANCE_ACTIONS.find((a) => a.id === 'fin.partner')!.preview(s, { partner: 'Azimuth', ipAccess: true });
  const line = String(pv.costs.find((c) => c.currency === 'leadDays')?.target);
  const months = Math.round(Math.min(lead, ST.ipCloseYr * lead * PARTNER_TERMS.hyperscaler.years) / 30.4);
  check(new RegExp(`ends about ${months} months closer over the deal`).test(line), '6 the preview says how much closer its lab ends over the deal (ipCloseYr × lead × years, at most the lead)', line.slice(line.indexOf('its lab')));
}

// 7. Rescue: the hyperscaler that values you most (interest); ties go to the larger stake; shares at half the valuation.
{
  const s = clean();
  const base = rescuePartner(s); // Azimuth's own lab sits near you: Northwind values you more
  setLead(s, 400); // its lab far behind: no penalty, so the two are level at 1
  s.player.finance.ownership.strat = { 'Northwind Cloud': 0.1, Azimuth: 0.2 };
  const tieA = rescuePartner(s);
  s.player.finance.ownership.strat = { 'Northwind Cloud': 0.15, Azimuth: 0.15 };
  const tieN = rescuePartner(s);
  s.player.finance.ownership.strat = { 'Northwind Cloud': 0.1, Azimuth: 0.2 };
  s.player.finance.ws3.paidTo = { 'Northwind Cloud': 9, Other: 1 };
  const spend = rescuePartner(s);
  s.player.finance.ws3.paidTo = {};
  s.player.finance.deals.push({ id: 'DLx', partner: 'Northwind Cloud', kind: 'hyperscaler', day: 0, equityNow: 0, equityLater: 0, strings: { exclusivity: true }, until: s.time.day + 1000 });
  const blocked = rescuePartner(s);
  check(base === 'Northwind Cloud' && tieA === 'Azimuth' && tieN === 'Northwind Cloud' && spend === 'Northwind Cloud' && blocked === 'Northwind Cloud', '7 the rescuer is the hyperscaler with the highest interest (ties: larger stake, then partner order); a running exclusivity of another partner blocks that other', `own lab near: ${base} · level, larger stake: ${tieA} · level, tie: ${tieN} · spend: ${spend} · ${blocked}`);
  const r = leader();
  r.player.finance.ownership.strat = { 'Northwind Cloud': 0.27, Azimuth: 0.1 };
  r.player.finance.ownership.founder *= 0.99;
  r.player.finance.state = 'distress';
  const V = Math.max(10, r.player.finance.valuation);
  const t = partnerTerms(r, 'Northwind Cloud', { rescue: true });
  const cash = t.equityNow;
  const f = cash / (0.5 * V + cash);
  const stake0 = r.player.finance.ownership.strat['Northwind Cloud'];
  const want = stake0 * (1 - f) + f;
  const after = partnerStakeAfter(r, t);
  const cash0 = r.player.finance.cash;
  const err = signPartner(r, makeCtx(r), 'Northwind Cloud', { rescue: true, force: true });
  check(!err && near(after, want, 1e-9) && near(r.player.finance.ownership.strat['Northwind Cloud'], want, 1e-9) && near(r.player.finance.cash - cash0, cash, 1e-6) && t.priceMult === 0.5, '7 the rescue issues shares = cash ÷ (0.5 V + cash): a distressed round at half the valuation', `cash $${f1(cash)}B for ${(f * 100).toFixed(1)}% new shares · stake ${(stake0 * 100).toFixed(1)}% → ${(after * 100).toFixed(1)}%`);
  const m = leader();
  m.player.finance.state = 'distress';
  const burn2 = 2 * Math.max(0, 6);
  void burn2;
  const tm = partnerTerms(m, 'Northwind Cloud', { rescue: true });
  check(tm.equityNow >= PARTNER_TERMS.rescue.minCash - 1e-9 && tm.equityNow <= PARTNER_TERMS.rescue.maxShareOfV * V0(m) + 1e-9, '7 the rescue cash is max($20B, 2 × burn), at most 15% of V', `$${f1(tm.equityNow)}B`);
}
const deal6 = (s: GameStateV2, partner: string, until: number, extra: Partial<StrategicDeal> = {}) => s.player.finance.deals.push({ id: 'DLt' + partner + until, partner, kind: 'hyperscaler', day: 0, equityNow: 0, equityLater: 0, strings: {}, until, ...extra });
const interest = (s: GameStateV2, p: string) => partnerInterest(s, p).value;

// 8. Interest: 1 plus named parts, each in words; spend raises it, a backed rival and a near own lab lower it; clamped.
{
  const s = clean();
  setLead(s, 400);
  const base = interest(s, 'Silica Systems');
  s.player.finance.ws3.paidTo = { 'Silica Systems': 3, Other: 7 };
  const spent = partnerInterest(s, 'Silica Systems');
  const rival = s.rivals.find((r) => r.core.status === 'active')!;
  rival.npc.backers = { 'Silica Systems': 0.1 };
  const backed = partnerInterest(s, 'Silica Systems');
  check(near(base, 1) && near(spent.value, 1 + 0.3 * 0.3, 1e-9) && near(backed.value, spent.value - 0.2, 1e-9) && backed.parts.every((x) => x.label.length > 8) && /30% of your compute payments/.test(spent.parts[1].label) && /rival of yours/.test(backed.parts[2].label), '8 interest: spend share (+0.3 × 30%) raises it, a partner backing a rival (−0.2) lowers it; every part has a label', backed.parts.map((x) => `${x.label} ${x.v.toFixed(2)}`).join(' · '));
  const own = clean();
  setLead(own, 0);
  const lvl = interest(own, 'Azimuth');
  setLead(own, 91); // 3 months ahead
  const mid = interest(own, 'Azimuth');
  setLead(own, 400);
  const clear = interest(own, 'Azimuth');
  check(near(clear, 1) && near(lvl, 1 - 0.3, 1e-9) && near(mid, 1 - 0.3 * (1 - 91 / 30.4 / 6), 1e-6), "8 the partner's own lab near you lowers its interest: −0.3 × (1 − your lead in months ÷ 6)", `level ${lvl.toFixed(2)} · 3 months ${mid.toFixed(2)} · far ${clear.toFixed(2)}`);
  const c = clean();
  setLead(c, 0);
  c.rivals.find((r) => r.core.status === 'active')!.npc.backers = { Azimuth: 0.2 };
  deal6(c, 'Northwind Cloud', c.time.day + 1000);
  const raw = 1 - 0.3 - 0.2 - 0.2;
  const low = partnerInterest(c, 'Azimuth');
  const sil = clean();
  sil.player.finance.ws3.paidTo = { 'Silica Systems': 1 };
  const hi = interest(sil, 'Silica Systems');
  check(raw < PARTNER_INTEREST.min && low.value === PARTNER_INTEREST.min && hi <= PARTNER_INTEREST.max && hi > 1.2, '8 the value is clamped to 0.5–1.5 (own lab level + backs a rival + you lean on its competitor = 0.3 → 0.5)', `raw ${raw.toFixed(2)} → ${low.value} · all-spend Silica ${hi.toFixed(2)}`);
}

// 9. A plain offer's equity scales with interest (strings and the stake cap still apply).
{
  const s = clean();
  setLead(s, 400);
  const e1 = termsEquity(partnerTerms(s, 'Azimuth'));
  const i1 = interest(s, 'Azimuth');
  setLead(s, 0);
  const e0 = termsEquity(partnerTerms(s, 'Azimuth'));
  const i0 = interest(s, 'Azimuth');
  const sil = clean();
  const v0 = termsEquity(partnerTerms(sil, 'Silica Systems'));
  sil.player.finance.ws3.paidTo = { 'Silica Systems': 5, Other: 5 };
  const v1 = termsEquity(partnerTerms(sil, 'Silica Systems'));
  check(i0 < i1 && near(e0 / e1, i0 / i1, 1e-9) && near(v1 / v0, 1.15, 1e-9), '9 the equity of a plain offer is × interest (hyperscaler and chip vendor)', `Azimuth ${f1(e0)} at ${i0.toFixed(2)} vs ${f1(e1)} at ${i1.toFixed(2)} · Silica ×${(v1 / v0).toFixed(2)}`);
}

// 10. Dependence: its cloud (and chips) over your compute; a renewal keeps base discount × (1 − dependence).
{
  const s = clean();
  const before = dependence(s, 'Azimuth');
  s.player.cloud.push({ id: 'Ct', provider: 'Azimuth', h100e: 1e6, costPerYear: 1, startDay: s.time.day - 1, endDay: s.time.day + 300, cancellableNoticeQ: null });
  const dep = dependence(s, 'Azimuth');
  const want = 1e6 / computeOnlineOf(s);
  const D = PARTNER_TERMS.hyperscaler.discount;
  const disc = (x: number) => partnerTerms(s, 'Azimuth', { dependence: x }).supply!.partnerDiscount;
  check(before === 0 && dep > 0.05 && dep < 1 && near(dep, want, 1e-9) && near(disc(0), D) && near(disc(0.4), D * 0.6) && near(disc(1), 0), '10 dependence = its cloud ÷ your compute; the renewal discount is the base × (1 − dependence)', `${(dep * 100).toFixed(1)}% · discount ${disc(0)} → ${disc(0.4).toFixed(3)} → ${disc(1)}`);
}

// 11. Renewal: one request when a deal passes its end; accepting signs a fresh deal; declining ends it. Running deals only count.
{
  const s = clean();
  const err = signPartner(s, makeCtx(s), 'Azimuth');
  const d = dealWith(s, 'Azimuth')!;
  const now = partnersNow(s).length;
  partnerMonthly(s);
  const none = s.events.requests.filter((r) => r.id === 'E33').length;
  d.until = s.time.day; // the deal ends today
  const gone = !dealWith(s, 'Azimuth') && partnersNow(s).length === 0;
  partnerMonthly(s);
  partnerMonthly(s);
  const reqs = s.events.requests.filter((r) => r.id === 'E33');
  const ev = EVENT_BY_ID.get('E33')!;
  const deals0 = s.player.finance.deals.length;
  ev.choices[0].apply(s, makeCtx(s), reqs[0]?.data ?? {});
  const renewed = s.player.finance.deals.length === deals0 + 1 && !!dealWith(s, 'Azimuth') && partnersNow(s).length === 1;
  check(!err && now === 1 && none === 0 && gone && reqs.length === 1 && reqs[0].data.partner === 'Azimuth' && reqs[0].data.supply === 'cloud' && renewed, '11 partnersNow ignores an ended deal; one E33 request fires when the deal passes its end (never again); accepting signs a fresh deal', `requests ${reqs.length} · deals ${deals0} → ${s.player.finance.deals.length}`);
  const o = clean();
  signPartner(o, makeCtx(o), 'Azimuth');
  dealWith(o, 'Azimuth')!.until = o.time.day;
  partnerMonthly(o);
  const dd = o.events.requests.find((r) => r.id === 'E33')!.data;
  const n0 = o.player.finance.deals.length;
  ev.choices[1].apply(o, makeCtx(o), dd);
  partnerMonthly(o);
  check(o.player.finance.deals.length === n0 && !dealWith(o, 'Azimuth') && partnersNow(o).length === 0 && o.events.requests.filter((r) => r.id === 'E33').length === 1, '11 declining ends the partnership (no new deal, no second request)', `deals ${n0}`);
}

// 12. Follow-on: only at interest ≥ 1.2 with a running deal, once a year.
{
  const s = clean();
  const ctx = makeCtx(s);
  signPartner(s, ctx, 'Azimuth');
  setLead(s, 400);
  const low = followOnBlocker(s, 'Azimuth') ?? '';
  s.player.finance.ws3.paidTo = { Azimuth: 8, Other: 2 };
  const i = interest(s, 'Azimuth');
  const t = followOnTerms(s, 'Azimuth');
  const eq0 = dealWith(s, 'Azimuth')!.equityNow;
  const tranche = Math.min(15, 0.03 * Math.max(10, s.player.finance.valuation));
  const err = signFollowOn(s, ctx, 'Azimuth');
  const d = dealWith(s, 'Azimuth')!;
  const again = followOnBlocker(s, 'Azimuth') ?? '';
  s.time.day += 366;
  const later = followOnBlocker(s, 'Azimuth');
  const none = clean();
  setLead(none, 400);
  none.player.finance.ws3.paidTo = { Azimuth: 8, Other: 2 };
  check(/does not value you enough/.test(low) && i >= 1.2 && !err && near(t.equityNow, tranche * i, 1e-9) && near(t.supply!.total, 4 * t.equityNow, 1e-6) && near(d.equityNow, eq0 + t.equityNow, 1e-9) && /one a year/.test(again) && later === undefined && /No running deal/.test(followOnBlocker(none, 'Azimuth') ?? ''), '12 a follow-on needs interest ≥ 1.2 and a running deal: one more tranche × interest for 4× it, once a year', `interest ${i.toFixed(2)} · equity ${f1(t.equityNow)}B for ${f1(t.supply!.total)}B · ${low}`);
}

// 13. Custom chips: one order a year for 6 years, sized at each year's price, the same dollar total as before.
{
  const s = leader();
  const t = partnerTerms(s, 'Azimuth', { supply: 'asic' });
  const sp = t.supply!;
  const yr = (y: number) => sp.perQ.slice(4 * y, 4 * y + 4).reduce((a, b) => a + b, 0) + (y === 0 ? sp.prepaid ?? 0 : 0);
  const o0 = s.player.orders.length;
  const l0 = s.player.finance.ledger.length;
  const err = signPartner(s, makeCtx(s), 'Azimuth', { supply: 'asic' });
  const orders = s.player.orders.slice(o0);
  const led = s.player.finance.ledger.slice(l0).filter((c) => c.payee === 'Azimuth');
  const starts = orders.map((o) => o.ltaStartQ ?? 0);
  check(!err && sp.yearly?.length === 6 && sp.yearly.every((h, y, a) => y === 0 || h > a[y - 1]) && [0, 1, 2, 3, 4, 5].every((y) => near(yr(y), sp.total / 6, 1e-9)) && near(sp.total, 4 * termsEquity(t), 1e-9) && orders.length === 6 && orders.every((o, y) => near(o.qty, sp.yearly![y]) && o.ltaStartQ === starts[0] + 4 * y) && near(led.reduce((a, c) => a + c.perQuarter, 0) + (sp.prepaid ?? 0), sp.total, 1e-9), '13 custom chips: six yearly orders of C/6 each, more chips as prices fall, the same total C', `${sp.yearly!.map((h) => (h / 1e6).toFixed(2)).join(' → ')}M a quarter · ${f1(sp.total)}B`);
}

function V0(s: GameStateV2) { return Math.max(10, s.player.finance.valuation); }

finish('partners');
