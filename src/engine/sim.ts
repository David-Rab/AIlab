// Daily simulation tick. Pure function of state + rng (state.rng).
import { CHINA_PRESETS, GOV_PRESETS, LAB_ARCHETYPES, PUBLIC_PRESETS } from '../data/actors';
import { TECHS, TECH_BY_ID } from '../data/techs';
import { TRAITS, TRAIT_BY_ID, VIRTUES, VIRTUE_BLOCKS, type Pressure } from '../data/traits';
import { BASELINES, MILESTONES, capIndex, computePace, globalCompute, laborSlowdown, milestoneAt, multiplierAt, refCapCompute, stage1 } from '../data/world';
import { checkEndings } from './endings';
import { checkEvents } from './events';
import { Rng, clamp } from './rng';
import { decimalYear } from './time';
import type { GameState, LogEntry } from './types';

export const govPreset = (s: GameState) => GOV_PRESETS.find((p) => p.id === s.gov.preset) ?? GOV_PRESETS[0];
export const pubPreset = (s: GameState) => PUBLIC_PRESETS.find((p) => p.id === s.pub.preset) ?? PUBLIC_PRESETS[0];
export const chinaPreset = (s: GameState) => CHINA_PRESETS.find((p) => p.id === s.china.preset) ?? CHINA_PRESETS[0];
export const labArch = (id: string) => LAB_ARCHETYPES.find((a) => a.id === id) ?? LAB_ARCHETYPES[0];

export function log(s: GameState, kind: LogEntry['kind'], text: string, severity?: number, canon?: string) {
  s.log.push({ day: s.day, kind, text, severity, canon });
  if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
}

// ---------------- Derived quantities (also used by UI) ----------------

export function activeTechs(s: GameState) {
  return TECHS.filter((t) => s.techs[t.id]?.done && s.techs[t.id].active);
}

export function techTaxes(s: GameState) {
  let rd = 1;
  let compute = 0;
  let cash = 0;
  for (const t of activeTechs(s)) {
    if (t.tax?.rd) rd *= 1 - t.tax.rd;
    compute += t.tax?.compute ?? 0;
    cash += t.tax?.cashPerMonth ?? 0;
  }
  return { rdFactor: rd, computeShare: compute, cashPerMonth: cash / 1000 }; // cash in $B/month
}

export function worldCompute(s: GameState) {
  const base = BASELINES.find((b) => b.id === s.setup.baseline) ?? BASELINES[0];
  return globalCompute(s.world, base.start.globalCompute, s.day / 365);
}

/** Alignment effort: scales counter strength and detection clarity. 1.0 at ~3% compute + 250 staff. */
export function alignEffort(s: GameState) {
  const c = s.company.compute * s.allocation.alignment;
  const staff = s.company.staff * s.staffSplit.alignment;
  const ref = 3.6e4 * Math.pow(2.5, s.day / 365); // reference grows with compute
  const v = Math.pow(c / ref, 0.35) * Math.pow(staff / 250, 0.25);
  return clamp(v, 0.15, 4);
}

export function controlStrength(s: GameState) {
  let keep = 1;
  for (const t of activeTechs(s)) if (t.control) keep *= 1 - t.control;
  const gapPenalty = clamp(1 - 0.12 * Math.max(0, s.model.milestone - 2), 0.3, 1);
  return (1 - keep) * gapPenalty * clamp(0.6 + 0.4 * alignEffort(s), 0.6, 1.4);
}

export interface ProgressBreakdown {
  mult: number;
  computeFactor: number;
  talentFactor: number;
  taxFactor: number;
  neuralese: number;
  silo: number;
  sabotage: number;
  rate: number; // years of progress per year
}

/** A verified US-China treaty slows every frontier project (AI 2027 Slowdown-style deal). [design] */
export const TREATY_SLOWDOWN = 0.35;

export function progressBreakdown(s: GameState): ProgressBreakdown {
  const w = s.world;
  const taxes = techTaxes(s);
  const capShare = Math.max(0.02, s.allocation.capabilities - taxes.computeShare);
  const capCompute = s.company.compute * capShare;
  const computeFactor = clamp(Math.pow(capCompute / refCapCompute(w, s.day / 365), w.computeElasticity), 0.15, 4);
  // Labor growth is already in the 2024-pace baseline: normalise to the default hiring path (audit #12)
  const refStaff = 2050 + 0.82 * 60 * (s.day / 30.4);
  const talentFactor = clamp(Math.pow((s.company.staff * s.staffSplit.capabilities) / refStaff, 0.25), 0.4, 1.6);
  // The scenario path includes neuralese; refusing it costs speed (audit #10)
  const neuralese = s.flags.neuraleseFound && !s.policies.neuralese ? 1 / w.neuraleseBoost : 1;
  const silo = [1, 0.96, 0.9][s.policies.siloing] ?? 1;
  const sabotage = 1 - (s.flags.chinaSabotage as number || 0);
  const mult = multiplierAt(w, s.p);
  const human = talentFactor * taxes.rdFactor * neuralese * silo * sabotage;
  const yr = decimalYear(s);
  let rate: number;
  if (s.p < stage1(w)) rate = w.share * laborSlowdown(mult * human, yr) + (1 - w.share) * computeFactor * computePace(yr);
  else rate = mult * computeFactor * human;
  if (s.flags.paused) rate *= 0.05;
  if (s.gov.treaty) rate *= TREATY_SLOWDOWN;
  return { mult, computeFactor, talentFactor, taxFactor: taxes.rdFactor, neuralese, silo, sabotage, rate };
}

/** Rival / China progress rate using the same engine with their compute */
function actorRate(s: GameState, p: number, compute: number, eff: number) {
  const w = s.world;
  const cf = clamp(Math.pow(compute / refCapCompute(w, s.day / 365), w.computeElasticity), 0.05, 4);
  const mult = multiplierAt(w, p);
  const yr = decimalYear(s);
  return p < stage1(w) ? w.share * laborSlowdown(mult * eff, yr) + (1 - w.share) * cf * computePace(yr) : mult * cf * eff;
}

/** Days since OpenBrain was at progress p (lead in days). Negative if other is ahead. */
export function leadDays(s: GameState, pOther: number): number {
  if (pOther >= s.p) {
    const r = progressBreakdown(s).rate;
    return -((pOther - s.p) / Math.max(0.05, r)) * 365;
  }
  const { day, pOB } = s.series;
  for (let i = pOB.length - 1; i >= 0; i--) {
    if (pOB[i] <= pOther) {
      const next = i + 1 < pOB.length ? pOB[i + 1] : s.p;
      const nd = i + 1 < day.length ? day[i + 1] : s.day;
      const t = next > pOB[i] ? (pOther - pOB[i]) / (next - pOB[i]) : 0;
      return s.day - (day[i] + t * (nd - day[i]));
    }
  }
  // Before recorded history: extrapolate at the start rate
  return s.day + (0 - pOther) / 1.1 * 365;
}

export function bestRival(s: GameState) {
  return s.labs.filter((l) => !l.absorbed).reduce((a, b) => (b.p > a.p ? b : a), s.labs[0]);
}

/** Hidden misalignment index (truth). */
export function misalignment(s: GameState, useEst = false) {
  const v = (id: string) => (useEst ? s.model.traits[id].est : s.model.traits[id].value);
  const raw = 0.3 * v('scheme') + 0.18 * v('successor') + 0.14 * v('power') + 0.14 * v('fake') + 0.1 * v('collude') + 0.08 * v('sabotage') + 0.06 * v('selfpres');
  const virtue = 0.15 * v('honest') + 0.15 * v('corrig');
  return clamp(raw * (1 - virtue) * 1.6, 0, 1);
}

// ---------------- Tick ----------------

export function tick(s: GameState) {
  if (s.ending) return;
  const rng = new Rng(s.rng);
  s.day += 1;

  economyAndCompute(s, rng);
  const oldP = s.p;
  const oldMult = multiplierAt(s.world, oldP);
  const pb = progressBreakdown(s);
  s.p += pb.rate / 365;
  s.rdMult = multiplierAt(s.world, s.p);
  checkMilestone(s);
  research(s);
  traitsTick(s, rng, Math.log(s.rdMult / oldMult));
  if (s.day % 7 === 0) estimates(s, rng);
  incidents(s, rng);
  security(s, rng);
  chinaTick(s, rng);
  rivalsTick(s, rng);
  govTick(s);
  publicTick(s);
  if (s.day % 7 === 0) recordSeries(s);
  checkEvents(s, rng);
  const end = checkEndings(s, rng);
  if (end) s.ending = end;

  s.rng = rng.state;
}

function recordSeries(s: GameState) {
  const r = bestRival(s);
  const se = s.series;
  se.day.push(s.day);
  se.pOB.push(s.p);
  se.pChina.push(s.china.p);
  se.pRival.push(r?.p ?? 0);
  se.cash.push(s.company.cash);
  se.revenue.push(s.company.revenueRun);
  se.approval.push(s.pub.approval);
  se.mult.push(s.rdMult);
  se.misalignEst.push(misalignment(s, true));
}

function checkMilestone(s: GameState) {
  const m = milestoneAt(s.world, s.p);
  if (m > s.model.milestone) {
    for (let i = s.model.milestone + 1; i <= m; i++) {
      if (s.milestoneDays[i] === undefined) s.milestoneDays[i] = s.day; // first crossing
      const ms = MILESTONES[i];
      const safer = s.techs.cotkeep?.done && s.techs.cotkeep.active && s.techs.goaltrain?.done;
      s.model.name = safer ? `Safer-${Math.max(1, i - 2)}` : ms.model;
      log(s, 'milestone', `${s.model.name} trained internally: ${ms.name}.`, 3, ms.canon);
    }
    s.model.milestone = m;
  }
}

// ---------------- Economy & compute ----------------

export function revenuePerH100eYear(s: GameState) {
  const m = multiplierAt(s.world, s.model.publicP);
  // Compute forecast: ~$47k/H100e-yr external deployment (2025) rising to ~$75k (2027) (audit #14)
  return 40000 * Math.pow(Math.min(m, 8), 0.3);
}

/** Revenue target if the public model were at progress p (for UI previews). */
export function revenueTargetIf(s: GameState, publicP: number) {
  const old = s.model.publicP;
  s.model.publicP = publicP;
  const r = revenueTarget(s);
  s.model.publicP = old;
  return r;
}

/** Revenue run-rate the market converges to ($B/yr). */
export function revenueTarget(s: GameState) {
  const productCompute = s.company.compute * s.allocation.product;
  const demand = clamp(1 + s.pub.approval / 250, 0.6, 1.3) * competitionFactor(s) * (s.policies.militaryWork ? 1.04 : 1) * (s.policies.openWeightsOld ? 0.95 : 1);
  return (productCompute * revenuePerH100eYear(s) * demand) / 1e9;
}

export function competitionFactor(s: GameState) {
  let f = 1;
  for (const l of s.labs) if (!l.absorbed && l.p > s.model.publicP - 0.05) f *= 0.88;
  if (s.china.openWeights > 60 && s.china.p > s.model.publicP - 0.3) f *= 0.95;
  return f;
}

/** H100e contracted per month: expansion target, capped at a quarter of world supply. */
export function monthlyOrder(s: GameState) {
  // Grow the whole contracted fleet (installed + pipeline), so deliveries track the target growth rate
  const inPipe = s.company.pipeline.reduce((a, o) => a + o.amount, 0);
  const want = (s.company.compute + inPipe) * (Math.pow(1 + s.policies.expansion, 1 / 12) - 1);
  return Math.max(0, Math.min(want, worldCompute(s) * COMPUTE_CAP - s.company.compute - inPipe));
}

/** Max share of world AI compute a single lab can contract (AI 2027 leader ~20%; DPA consolidation can exceed it). */
export const COMPUTE_CAP = 0.35;

export function computeCapped(s: GameState) {
  const inPipe = s.company.pipeline.reduce((a, o) => a + o.amount, 0);
  return s.company.compute + inPipe >= worldCompute(s) * COMPUTE_CAP * 0.98;
}

export function monthlyCosts(s: GameState) {
  const yrs = s.day / 365;
  // AI27: ~$16K (2025) -> $10K (2026) -> $9K (2027); scarcity premium above 20% of world supply [design]
  const share = s.company.compute / worldCompute(s);
  const perH100eYr = 14000 * Math.pow(0.8, yrs) * (1 + 2 * Math.max(0, share - 0.2));
  const computeCost = (s.company.compute * perH100eYr) / 1e9 / 12;
  const staffCost = (s.company.staff * 0.6) / 1000 / 12;
  const taxes = techTaxes(s).cashPerMonth;
  const pr = s.policies.prPerMonth;
  const orders = (monthlyOrder(s) * perH100eYr * 0.25) / 1e9; // 25% deposit on new capacity
  const security = s.allocation.security * computeCost * 0.3;
  return { computeCost, staffCost, taxes, pr, orders, security, total: computeCost + staffCost + taxes + pr + orders + security };
}

function economyAndCompute(s: GameState, rng: Rng) {
  const c = s.company;
  // Compute arrivals; local opposition delays arrivals
  const delay = s.pub.rung >= 1 ? 1 : 0;
  c.pipeline = c.pipeline.filter((o) => {
    if (o.day + delay * 45 <= s.day) {
      c.compute += o.amount;
      return false;
    }
    return true;
  });
  if (s.day % 30 === 0 && s.policies.expansion > 0) {
    const amt = monthlyOrder(s);
    if (amt > 0) c.pipeline.push({ day: s.day + 180, amount: amt });
  }
  // Revenue
  const target = revenueTarget(s);
  c.revenueRun += (target - c.revenueRun) * 0.04; // adoption lag (~1 month)
  const costs = monthlyCosts(s);
  c.cash += c.revenueRun / 365 - costs.total / 30;
  // Valuation: revenue multiple with hype from R&D multiplier and lead
  const lead = leadDays(s, Math.max(bestRival(s)?.p ?? 0, s.china.p));
  const hype = 1 + 0.08 * Math.log(s.rdMult) + clamp(lead / 365, -0.3, 0.5);
  // [design] AI 2027 gives no valuation path; revenue multiple shrinks with scale
  const multiple = 50 * Math.pow(Math.max(1, c.revenueRun) / 12, -0.2);
  const target_val = c.revenueRun * multiple * hype * clamp(c.boardConfidence / 70, 0.5, 1.3);
  c.valuation += (target_val - c.valuation) * 0.01;
  // Staff
  const hires = s.policies.hiringPerMonth / 30;
  c.staff = Math.max(200, c.staff + hires - (s.flags.poached as number || 0));
  s.flags.poached = 0;
  c.privileged = Math.round(c.staff * [0.4, 0.15, 0.04][s.policies.siloing]);
  // Board confidence: cash runway and lead
  const runwayMonths = c.cash / Math.max(0.1, costs.total - c.revenueRun / 12);
  const target_bc = 55 + clamp(lead / 10, -20, 25) + (runwayMonths < 6 && costs.total > c.revenueRun / 12 ? -25 : 0) + (s.flags.paused ? -15 : 0);
  c.boardConfidence += (clamp(target_bc, 0, 100) - c.boardConfidence) * 0.01;
  // Safety team morale
  const moraleTarget = 40 + 600 * s.allocation.alignment + (s.policies.whistleblowerProtection ? 10 : 0) - (s.gov.rung >= 3 ? 10 : 0) - misalignment(s, true) * 40;
  c.safetyMorale += (clamp(moraleTarget, 0, 100) - c.safetyMorale) * 0.01;
  // Compute rental market noise
  if (rng.chance(0.002)) log(s, 'news', 'Chip supply crunch: HBM shortages slow new datacenter deliveries.');
  if (c.cash < 5 && !s.flags.lowCash) {
    s.flags.lowCash = true;
    log(s, 'alert', 'Cash below $5B. Raise capital or cut expansion; below −$5B the company fails.', 4);
  }
  if (c.cash > 15) s.flags.lowCash = false;
}

// ---------------- Research ----------------

export function researchRate(s: GameState) {
  const sabotage = s.model.traits.sabotage.value;
  const ai = 1 + (s.rdMult - 1) * 0.5 * (1 - 0.7 * sabotage);
  return 1.6 * alignEffort(s) * ai * (s.flags.externalResearchers ? 1.5 : 1);
}

export function canResearch(s: GameState, id: string) {
  const t = TECH_BY_ID[id];
  if (!t || s.techs[id].done) return false;
  if ((t.minCap ?? 0) > s.model.milestone) return false;
  return t.prereqs.every((p) => s.techs[p]?.done);
}

function research(s: GameState) {
  s.researchQueue = s.researchQueue.filter((id) => !s.techs[id].done);
  const id = s.researchQueue.find((x) => canResearch(s, x));
  if (!id) return;
  const ts = s.techs[id];
  ts.progress += researchRate(s);
  const def = TECH_BY_ID[id];
  if (ts.progress >= def.cost) {
    ts.done = true;
    ts.active = true;
    log(s, 'research', `Research complete: ${def.name}.`);
  }
}

// ---------------- Traits ----------------

function pressures(s: GameState): Record<Pressure, number> {
  const m = s.model.milestone;
  const trainAgainst = Object.entries(s.techs).filter(([, t]) => t.done && t.active && t.trainAgainst).length;
  const lead = leadDays(s, Math.max(bestRival(s)?.p ?? 0, s.china.p));
  const race = clamp(s.allocation.capabilities * 1.2 - s.allocation.alignment * 3 + (lead < 60 ? 0.3 : 0), 0, 1.2);
  const copies = Math.log10(Math.max(10, copiesOf(s))) / 6;
  return {
    feedback: 0.35 + s.allocation.product * 1.2,
    outcomeRL: 0.4 + 0.15 * m,
    agency: 0.2 + 0.2 * m,
    scale: 1,
    cotPressure: trainAgainst * 0.5,
    neuralese: s.policies.neuralese && s.flags.neuraleseFound ? 1 : 0,
    copies,
    selfImprove: 1 - 1 / s.rdMult,
    race,
  };
}

/** Number of parallel copies of the best model running research (AI27 copies x speed). */
export function copiesOf(s: GameState) {
  const rd = s.company.compute * s.allocation.capabilities * 0.1;
  return Math.max(1000, rd * 0.4 * Math.pow(Math.min(s.rdMult, 10), 0.3));
}

export function speedOf(s: GameState) {
  const v = 8 + 10.8 * Math.log2(s.rdMult);
  return s.model.milestone >= 6 ? v : Math.min(50, v); // scenario: ~50x at Agent-4
}

function traitsTick(s: GameState, rng: Rng, dLogMult: number) {
  const P = pressures(s);
  const eff = alignEffort(s);
  const diff = s.world.alignDifficulty;
  const tr = s.model.traits;
  // Online learning from Agent-2 on: traits drift continuously, not only per capability gain.
  const step = Math.max(0, dLogMult) + (s.model.milestone >= 2 ? 0.0015 : 0.0004);
  const active = activeTechs(s);
  const crystal = clamp(tr.tgame.value * 0.5 + tr.fake.value * 0.6, 0, 0.8);
  for (const t of TRAITS) {
    const st = tr[t.id];
    if (VIRTUES.includes(t.id)) {
      let grow = 0;
      for (const tech of active) grow += tech.grows?.[t.id] ?? 0;
      st.value = clamp(st.value + step * (grow * eff * 0.6 * (1 - st.value) - 0.15 * P.race * st.value), 0, 1);
      continue;
    }
    if ((t.minCap ?? 0) > s.model.milestone) continue;
    // Soft gates: a trait grows in proportion to how developed its prerequisites are.
    let gate = 1;
    if (t.needsAll) gate *= clamp((Math.min(...t.needsAll.map((id) => tr[id].value)) - 0.15) / 0.4, 0, 1);
    if (t.needsAny) gate *= clamp((Math.max(...t.needsAny.map((id) => tr[id].value)) - 0.15) / 0.4, 0, 1);
    let drive = 0;
    for (const [k, w] of Object.entries(t.drivers)) drive += w * P[k as Pressure];
    let block = 0;
    for (const v of VIRTUES) if (VIRTUE_BLOCKS[v].includes(t.id)) block += tr[v].value * 0.7;
    const growth = 0.45 * drive * gate * diff * clamp(1 - block, 0.2, 1) * (1 + 0.5 * P.race);
    let counter = 0;
    let mask = 0;
    for (const tech of active) {
      counter += tech.counters?.[t.id] ?? 0;
      mask += tech.masks?.[t.id] ?? 0;
      // "Train against" a detector: strong visible reduction, mostly masking (hide, don't heal).
      if (s.techs[tech.id].trainAgainst && tech.detects?.[t.id]) {
        mask += tech.detects[t.id] * 0.8;
        counter += tech.detects[t.id] * 0.2;
      }
    }
    const reduce = counter * eff * 0.9 * (1 - crystal);
    const dv = step * (growth * (1 - st.value) - reduce * st.value) + rng.normal(0, 0.002) * gate;
    st.value = clamp(st.value + dv, 0, 1);
    st.mask = clamp(st.mask + step * (mask * eff * (1 - st.mask) - 0.3 * st.mask), 0, 0.9);
  }
}

// ---------------- Detection ----------------

export function clarityOf(s: GameState, traitId: string) {
  const t = TRAIT_BY_ID[traitId];
  const tr = s.model.traits;
  const eff = alignEffort(s);
  const neural = s.policies.neuralese && s.flags.neuraleseFound;
  let miss = 1 - t.visibility * 0.5;
  let wbShare = 0;
  let total = 0;
  for (const tech of activeTechs(s)) {
    const d = tech.detects?.[traitId];
    if (!d) continue;
    let k = 1;
    if (tech.detectKind === 'behavioral') k = 1 - 0.75 * tr.evalaware.value - 0.4 * tr.sandbag.value;
    if (tech.detectKind === 'cot') k = (1 - tr.obfus.value) * (neural ? 0.25 : 1);
    if (tech.detectKind === 'whitebox') k = 1 - 0.08 * s.model.milestone;
    if (s.techs[tech.id].trainAgainst) k *= 0.5;
    const strength = clamp(d * k * clamp(eff, 0.4, 2), 0, 0.95);
    miss *= 1 - strength;
    total += strength;
    if (tech.detectKind === 'whitebox') wbShare += strength;
  }
  return { clarity: clamp(1 - miss, 0, 0.97), whitebox: total > 0 ? wbShare / total : 0 };
}

function estimates(s: GameState, rng: Rng) {
  for (const t of TRAITS) {
    const st = s.model.traits[t.id];
    const { clarity, whitebox } = clarityOf(s, t.id);
    const visible = st.value * (1 - st.mask * (1 - whitebox));
    const sigma = 0.04 + 0.4 * (1 - clarity);
    const fp = rng.chance(0.03 * clarity) ? rng.range(0.05, 0.2) : 0; // false positives
    const obs = clamp(visible + rng.normal(0, sigma * 0.5) + fp, 0, 1);
    st.est = clamp(st.est + (obs - st.est) * (0.25 + 0.5 * clarity), 0, 1);
    st.sigma = sigma;
  }
}

// ---------------- Incidents ----------------

function incidents(s: GameState, rng: Rng) {
  const control = controlStrength(s);
  for (const t of TRAITS) {
    if (!t.incidents.length) continue;
    const st = s.model.traits[t.id];
    if (st.value < 0.1) continue;
    const p = 0.006 * Math.pow(st.value, 1.5) * (0.3 + t.visibility) * (1 - control * 0.7) * (1 + s.model.milestone * 0.15);
    if (!rng.chance(p)) continue;
    if (st.lastIncident !== undefined && s.day - st.lastIncident < 20) continue;
    st.lastIncident = s.day;
    const head = rng.pick(t.incidents);
    log(s, 'incident', `${head} [${t.name}]`, t.severity);
    // Incident reveals: estimate jumps toward truth
    st.est = clamp(st.est * 0.4 + st.value * 0.6, 0, 1);
    st.sigma *= 0.7;
    // Public exposure
    const leak = (s.allocation.product > 0.05 ? 0.25 : 0.08) * (s.policies.siloing === 2 ? 0.5 : 1);
    if (t.severity >= 2 && rng.chance(leak)) {
      const sev = t.severity;
      const pp = pubPreset(s);
      s.pub.concern = clamp(s.pub.concern + sev * 1.5 * pp.shock * pp.xrisk, 0, 100);
      s.pub.approval = clamp(s.pub.approval - sev * 1.5 * pp.shock, -100, 100);
      s.gov.trust = clamp(s.gov.trust - sev, 0, 100);
      log(s, 'public', `Press picks up the incident. ${s.company.name} approval falls.`, sev);
    }
    if (t.id === 'exfil' && s.model.milestone >= 3) {
      const succeed = st.value * (1 - control) * clamp(1 - s.company.securityLevel / 5.5, 0.03, 1) * 0.5;
      if (rng.chance(succeed)) {
        s.flags.rogue = s.day;
        log(s, 'alert', 'Model weights found on an external server. A copy of your model is loose.', 5);
      }
    }
  }
}

// ---------------- Security & theft ----------------

export function securityTarget(s: GameState) {
  // Status quo drift: WSL 2.2 (Dec 2024) -> 3.3 (Dec 2026) with no special effort (security forecast)
  let lvl = 2.2 + 0.55 * Math.min(s.day / 365 + 0.5, 2);
  if (s.techs.sl3.done && s.techs.sl3.active) lvl = Math.max(lvl, 3);
  if (s.techs.sl4.done && s.techs.sl4.active) lvl = Math.max(lvl, 4);
  if (s.techs.sl5.done && s.techs.sl5.active) lvl = Math.max(lvl, s.gov.rung >= 2 || s.flags.govSecurityHelp ? 5 : 4.4); // SL5 needs government help
  if (s.flags.govSecurityHelp) lvl += 0.3; // officials and IC support on security (AI 2027 Feb 2027)
  lvl += clamp((s.allocation.security - 0.03) * 6, -0.3, 0.5) + clamp((s.staffSplit.security - 0.08) * 3, -0.2, 0.3);
  return clamp(lvl, 1, 5.2);
}

/** P(theft succeeds within 2 months) at attacker level a vs defence s (research/02 F7). */
export function theftP2mo(attacker: number, defence: number) {
  return 1 / (1 + 19 * Math.pow(6, defence - attacker));
}

export function attackerLevel(s: GameState) {
  // OC4 (standard state ops) until China prioritises theft, then OC5. Insiders are already inside OC3+.
  return s.china.rung >= 2 ? 5 : 4;
}

function security(s: GameState, rng: Rng) {
  const c = s.company;
  const target = securityTarget(s);
  c.securityLevel += clamp(target - c.securityLevel, -0.01, 0.006); // ~2 levels/yr max
  // Spies: expected compromised privileged employees (0.5% -> 1% under adversary priority)
  const r = s.china.espionage > 60 ? 0.01 : 0.005;
  const targetSpies = c.privileged * r * (s.gov.rung >= 3 ? 0.3 : 1) * (s.policies.shareWithAllies ? 1.15 : 1);
  s.china.spies += (targetSpies - s.china.spies) * 0.01;
  // Algorithmic secrets leak while SSL is low
  const ssl = c.securityLevel - 0.6;
  if (s.china.p < s.p && ssl < 3.5) {
    const leak = 0.00015 * s.china.spies * clamp(3.5 - ssl, 0, 2);
    s.china.p += (s.p - s.china.p) * leak;
  }
  // Weight theft
  const ch = chinaPreset(s);
  if (s.model.milestone >= 2 && !s.china.stoleWeights && s.china.espionage > 50 && s.china.p < s.p - 0.05) {
    const spiesEff = s.china.spies * (s.policies.siloing === 2 ? 0.3 : 1);
    const def = c.securityLevel < 3 ? c.securityLevel - 0.3 * Math.min(1, spiesEff / 5) : c.securityLevel;
    const p2 = theftP2mo(attackerLevel(s), def);
    const h = (-Math.log(1 - p2) / 61) * ch.theft * (s.china.espionage / 100);
    if (rng.chance(h)) {
      s.china.stoleWeights = true;
      s.china.theftAttempts++;
      s.china.p = Math.max(s.china.p, s.p - (progressBreakdown(s).rate * 60) / 365); // ~2 months behind after theft
      s.flags.heist = s.day;
      log(s, 'alert', `${s.model.name} weights stolen. Traffic monitor flags the exfiltration after the fact.`, 5, 'Feb 2027');
      if (s.flags.bioRisk) {
        s.pub.concern = clamp(s.pub.concern + 10, 0, 100);
        s.gov.nationalization = clamp(s.gov.nationalization + 15, 0, 100);
        log(s, 'gov', 'Stolen weights include unsafeguarded bioweapon uplift. Washington is alarmed.', 4);
      }
    }
  }
}

// ---------------- China ----------------

/** Capability of the older model you open-source: ~85% of your public model. */
export function openWeightsLevel(s: GameState) {
  return s.model.publicP * 0.85;
}

function chinaTick(s: GameState, rng: Rng) {
  const ch = s.china;
  const pre = chinaPreset(s);
  const lead = leadDays(s, ch.p);
  // Centralization ladder (C-CENTRAL)
  if (ch.rung === 0 && (lead > 150 || s.gov.chinaRung >= 1) && s.day > 60) {
    ch.rung = 1;
    log(s, 'china', 'Beijing restricts travel for top AI researchers; model weights become state secrets.', 2);
  }
  if (ch.rung === 1 && s.model.milestone >= 1 && lead > 100 && rng.chance(0.004 * pre.centralize)) {
    ch.rung = 2;
    ch.espionage = Math.max(ch.espionage, 60);
    log(s, 'china', 'China wakes up: AI research nationalized under DeepCent. A Centralized Development Zone rises at Tianwan.', 4, 'Mid 2026');
  }
  if (ch.rung === 2 && (ch.stoleWeights || s.gov.chinaRung >= 2)) {
    ch.rung = 3;
    ch.openWeights = 10;
    log(s, 'china', 'CDZ hardened and air-gapped. DeepCent stops releasing open weights.', 3);
  }
  if (ch.rung >= 2) ch.centralization = clamp(ch.centralization + 0.12 * pre.centralize, 0, 75);
  // Compute share: slow decline under export controls, offset by domestic chips
  ch.computeShare = clamp(ch.computeShare + (s.gov.chinaRung >= 3 ? -0.00004 : -0.00001), 0.06, 0.2);
  const chinaAI = worldCompute(s) * ch.computeShare * (0.4 + 0.5 * Math.min(1, ch.centralization / 75)) * 0.6;
  const eff = s.world.chinaEfficiency * pre.efficiency * (ch.stoleWeights ? 1.1 : 1);
  ch.p += (actorRate(s, ch.p, chinaAI, eff) * (1 - (s.flags.usSabotage as number || 0)) * (s.gov.treaty ? TREATY_SLOWDOWN : 1)) / 365;
  // Distillation from released US models (open weights / API)
  const pub = Math.max(s.model.publicP, ...s.labs.filter((l) => l.openness > 60).map((l) => l.p));
  if (pub > ch.p) ch.p += (pub - ch.p) * 0.0015 * pre.openSource;
  if (s.policies.openWeightsOld && openWeightsLevel(s) > ch.p) ch.p += (openWeightsLevel(s) - ch.p) * 0.003;
  ch.espionage = clamp(ch.espionage + (lead > 60 ? 0.03 : -0.01) * pre.theft, 0, 100);
  // Taiwan
  const tTarget = 35 + (pre.taiwan - 1) * 25 + (s.gov.chinaRung >= 3 ? 15 : 0) + (lead > 200 && ch.rung >= 2 ? 15 : 0);
  ch.taiwan += (clamp(tTarget, 0, 100) - ch.taiwan) * 0.005;
  // Diplomacy: rises with misalignment fear and when behind under a dove leadership
  const dTarget = 45 * pre.treaty + (s.pub.xrisk - 40) * 0.3 + (lead > 90 && ch.hawk < 50 ? 10 : 0);
  ch.diplomacy += (clamp(dTarget, 0, 100) - ch.diplomacy) * 0.004;
  // China's own cyber sabotage on OpenBrain grows late
  s.flags.chinaSabotage = s.model.milestone >= 3 && ch.rung >= 2 ? clamp(0.02 * (s.model.milestone - 2) * (5 - s.company.securityLevel), 0, 0.15) : 0;
}

// ---------------- Rivals ----------------

function rivalsTick(s: GameState, rng: Rng) {
  for (const l of s.labs) {
    if (l.absorbed) continue;
    const arch = labArch(l.archetype);
    const comp = worldCompute(s) * l.computeShare * 0.6;
    // Rivals pay their own safety tax in proportion to their safety posture
    l.p += (actorRate(s, l.p, comp, 0.8 * (1 - 0.25 * (l.safety / 100))) * (s.gov.treaty ? TREATY_SLOWDOWN : 1)) / 365;
    // Catch up via public models (distillation, papers, poaching)
    if (s.model.publicP > l.p) l.p += (s.model.publicP - l.p) * 0.002;
    if (s.policies.openWeightsOld && openWeightsLevel(s) > l.p) l.p += (openWeightsLevel(s) - l.p) * 0.002;
    l.computeShare = clamp(l.computeShare * (1 + rng.normal(0, 0.0008)), 0.01, 0.2);
    if (l.p > s.model.publicP + 0.02 && !s.flags[`rivalAhead_${l.id}`]) {
      s.flags[`rivalAhead_${l.id}`] = s.day;
      log(s, 'rival', `${l.name} releases a model that beats your public offering.`, 2);
    }
    if (l.p < s.model.publicP) s.flags[`rivalAhead_${l.id}`] = false;
    // Lobbying against the leader when far behind
    const lead = leadDays(s, l.p);
    if (lead > 180 && arch.id === 'safety' && rng.chance(0.002)) {
      s.gov.regStance = clamp(s.gov.regStance + 6, -100, 100);
      log(s, 'rival', `${l.name} lobbies Congress for frontier AI safety rules.`, 1);
    }
  }
}

// ---------------- Government ----------------

function govTick(s: GameState) {
  const g = s.gov;
  const gp = govPreset(s);
  const brief = s.policies.govBriefing;
  // Awareness of true capability rises with briefings and leaks
  const awTarget = [15, 35, 70, 95][brief] + (s.flags.heist ? 15 : 0);
  g.awareness += (clamp(awTarget, 0, 100) - g.awareness) * 0.01;
  const perceived = s.model.milestone * (g.awareness / 100) + (s.model.publicP > 0 ? capIndex(s.world, s.model.publicP) * 0.4 : 0);
  // Priority & security demand
  g.priority += (clamp(55 + perceived * 9 + (s.flags.heist ? 20 : 0), 0, 100) - g.priority) * 0.004;
  const sdTarget = (10 + perceived * 14 + (s.flags.heist ? 30 : 0)) * gp.security;
  g.securityDemand += (clamp(sdTarget, 0, 100) - g.securityDemand) * 0.004;
  // Trust: transparency, security compliance, lobbying fit, military work
  let tTarget = 50 + (brief - 1) * 8 + (s.company.securityLevel - 3) * 8 + (s.policies.militaryWork ? 10 * gp.transactional : -5);
  tTarget += s.policies.lobbying * (gp.reg > 1 ? 8 : -6) + (s.policies.shareWithAllies ? 5 : 0) + (s.flags.govSecurityHelp ? 4 : 0);
  tTarget -= misalignment(s, true) * 20 * (g.awareness / 100);
  g.trust += (clamp(tTarget, 0, 100) - g.trust) * 0.005;
  // Regulation stance follows preset, public concern and lobbying
  const rTarget = -60 * gp.accel * 0.8 + 50 * (gp.reg - 0.6) + (s.pub.concern - 50) * 0.8 * gp.pollSensitivity - s.policies.lobbying * -15 + (s.flags.leak ? 30 : 0);
  g.regStance += (clamp(rTarget, -100, 100) - g.regStance) * 0.003;
  // China hawkishness
  const hTarget = 50 * gp.hawk + (s.flags.heist ? 30 : 0) + (s.china.rung >= 2 ? 10 : 0);
  g.hawkish += (clamp(hTarget, 0, 100) - g.hawkish) * 0.004;
  // Nationalization pressure: capability + low trust + leaks
  const nTarget = Math.max(0, perceived - 2) * 18 + (50 - g.trust) * 0.6 + (s.flags.leak ? 25 : 0);
  g.nationalization += (clamp(nTarget, 0, 100) - g.nationalization) * 0.004;
  // G-CHN ladder
  if (g.chinaRung === 0 && (g.hawkish > 60 || leadDays(s, s.china.p) < 120)) {
    g.chinaRung = 1;
    log(s, 'gov', 'Commerce revokes chip export licenses to China.', 2);
  }
  if (g.chinaRung === 1 && s.flags.heist) {
    g.chinaRung = 2;
    log(s, 'gov', 'President authorizes cyberattacks on DeepCent. They fail against the air-gapped CDZ.', 3, 'Feb 2027');
  }
  if (g.chinaRung === 2 && (g.hawkish > 80 || leadDays(s, s.china.p) < 60)) {
    g.chinaRung = 3;
    log(s, 'gov', 'Full chip and HBM export ban to China. Secondary sanctions on transit countries.', 3);
  }
  // AI 2027: US cyberattacks slow DeepCent ~25% (Dec 2027) to ~40% (Feb 2028) once AIs out-hack theirs
  if (g.chinaRung >= 2 && s.model.milestone >= 3) s.flags.usSabotage = clamp(0.1 * (s.model.milestone - 2), 0, 0.4);
}

// ---------------- Public ----------------

function publicTick(s: GameState) {
  const pb = s.pub;
  const pp = pubPreset(s);
  const decay = Math.log(2) / pp.halfLife;
  // Job disruption from deployed capability
  const deployCap = capIndex(s.world, s.model.publicP);
  const unemTarget = Math.max(0, deployCap - 1.5) * 0.6 * (s.allocation.product / 0.3);
  pb.unemploymentShock += (unemTarget - pb.unemploymentShock) * 0.003;
  const baseline = 45 + s.model.milestone * 3;
  pb.concern += (baseline + pb.unemploymentShock * 5 * pp.jobs - pb.concern) * decay;
  pb.jobAnxiety += (clamp(65 + pb.unemploymentShock * 6 * pp.jobs, 0, 100) - pb.jobAnxiety) * 0.003;
  pb.xrisk += (clamp(40 + (s.flags.leak ? 25 : 0) + s.model.milestone * 2, 0, 100) * pp.xrisk ** 0.3 - pb.xrisk) * 0.003;
  // Approval of OpenBrain: product benefits vs jobs vs PR
  const pr = Math.min(1, s.policies.prPerMonth / 1) * 10;
  const apTarget = -15 + pr - pb.unemploymentShock * 6 * pp.jobs - (pb.concern - 50) * 0.5 + (s.allocation.product - 0.3) * 20 * pp.benefit + (s.policies.openWeightsOld ? 4 : 0);
  pb.approval += (clamp(apTarget, -100, 100) - pb.approval) * decay;
  // Salience (% naming AI top problem)
  const salTarget = 1 + Math.max(0, pb.concern - 45) * 0.25 + pb.unemploymentShock * 3 + (s.flags.leak ? 15 : 0);
  pb.salience += (clamp(salTarget, 0, 45) - pb.salience) * 0.01;
  // Activism
  const actTarget = (pb.concern * 0.4 + pb.jobAnxiety * 0.2 + pb.salience) * pp.mobilization - 20;
  pb.activism += (clamp(actTarget, 0, 100) - pb.activism) * 0.005;
  const rungs = [0, 25, 35, 55, 70];
  let rung = 0;
  for (let i = 0; i < rungs.length; i++) if (pb.activism >= rungs[i]) rung = i;
  if (rung > pb.rung) {
    const msg = ['', 'Local groups block new datacenter permits.', 'Thousands march on Washington against AI job losses.', 'Mass movement: unions strike, AI becomes the top campaign issue.', 'Radical fringe attacks a datacenter. Security costs rise.'][rung];
    log(s, 'public', msg, rung + 1);
  }
  pb.rung = Math.max(pb.rung, rung);
}
