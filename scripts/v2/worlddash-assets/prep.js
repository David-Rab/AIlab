'use strict';
// World dashboard data prep: pure functions over the inlined data (no DOM), so node can run them (see worlddash.ts --selftest).
// Records are observer records (scripts/v2/observer.ts); `series` is the quarterly WorldReadout list (src/engine/v2/world/readout.ts).
const WD = (function () {
  const TL_ORDER = ['fast', 'central', 'slow'];
  const MS = [{ k: 'SC', idx: 3, name: 'SC (AI that codes better than any human; AIFM "AC")' }, { k: 'SAR', idx: 4, name: 'SAR' }, { k: 'SIAR', idx: 5, name: 'SIAR' }, { k: 'ASI', idx: 6, name: 'ASI' }];
  const tlOf = (rec) => String(rec.world).replace(/^tl-/, '');

  function pct(a, p) { // a sorted ascending
    if (!a.length) return null;
    const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return a[lo] + (a[hi] - a[lo]) * (i - lo);
  }
  const sorted = (a) => a.filter((v) => v != null && Number.isFinite(v)).sort((x, y) => x - y);
  const median = (a) => pct(sorted(a), 0.5);

  /** Records grouped by timeline id, in fast/central/slow order (other worlds after). */
  function groupByTimeline(recs) {
    const g = {};
    for (const r of recs) (g[tlOf(r)] = g[tlOf(r)] || []).push(r);
    const ids = Object.keys(g).sort((a, b) => (TL_ORDER.indexOf(a) + 99 * (TL_ORDER.indexOf(a) < 0)) - (TL_ORDER.indexOf(b) + 99 * (TL_ORDER.indexOf(b) < 0)));
    return ids.map((id) => ({ id, recs: g[id] }));
  }

  /** Median and 10-90 band across the records' seeds, sample by sample (same sample index = same quarter). */
  function seriesStat(recs, get, mode) {
    const n = Math.max(0, ...recs.map((r) => r.series.length)), out = [];
    for (let i = 0; i < n; i++) {
      const vs = [], ys = [];
      for (const r of recs) {
        const s = r.series[i];
        if (!s) continue;
        const v = get(s);
        if (v != null && Number.isFinite(v)) { vs.push(v); ys.push(s.year); }
      }
      if (!vs.length) continue;
      const a = sorted(vs);
      const mean = a.reduce((x, y) => x + y, 0) / a.length;
      out.push({ i, x: median(ys), y: mode === 'mean' ? mean : pct(a, 0.5), n: a.length, med: mode === 'mean' ? mean : pct(a, 0.5), lo: mode === 'mean' ? mean : pct(a, 0.1), hi: mode === 'mean' ? mean : pct(a, 0.9) });
    }
    return out;
  }

  const startYear = (rec) => rec.series[0].year - rec.series[0].day / 365;
  const dayToYear = (rec, day) => startYear(rec) + day / 365;

  /** First day each milestone was reached by any lab of kind `kinds` (default: the NPC labs): the frontier holder's date. Reads the last sample. */
  function frontierMilestones(rec, kinds) {
    const last = rec.series[rec.series.length - 1], out = {};
    for (const m of MS) {
      const ds = last.labs.filter((l) => (kinds || ['lab']).includes(l.kind) && l.milestoneDays && l.milestoneDays[m.idx] != null).map((l) => l.milestoneDays[m.idx]);
      if (ds.length) out[m.k] = { day: Math.min(...ds), year: dayToYear(rec, Math.min(...ds)), lab: last.labs.find((l) => l.milestoneDays && l.milestoneDays[m.idx] === Math.min(...ds)).id };
    }
    return out;
  }

  /** Median frontier date per milestone over a timeline's records (for the marks on the Reactions charts). */
  function milestoneMarks(recs) {
    return MS.map((m) => {
      const ys = recs.map((r) => (frontierMilestones(r)[m.k] || {}).year).filter((v) => v != null);
      return ys.length ? { k: m.k, year: median(ys), n: ys.length } : null;
    }).filter(Boolean);
  }

  /** AIFM band for a milestone in a timeline: the scenarios.ts checkpoint '<timeline>.<SC|SAR|SIAR|ASI>'. */
  function aifmBand(checkpoints, tl, k) {
    const c = checkpoints.find((x) => x.layer === 'timeline' && x.timeline === tl && x.quantity === 'milestone' && x.milestone === k);
    return c ? { p10: c.p10, p25: c.lo, p50: c.value, p75: c.hi, p90: c.p90 } : null;
  }

  /** Months behind the frontier per NPC lab, median over seeds, by lab id. */
  function lagSeries(recs) {
    const ids = [];
    for (const r of recs) for (const l of r.series[0].labs) if (l.kind === 'lab' && !ids.includes(l.id)) ids.push(l.id);
    return ids.map((id) => ({ id, pts: seriesStat(recs, (s) => { const l = s.labs.find((x) => x.id === id); return l ? l.monthsBehind : null; }) }));
  }

  /** Sample year when a law is first in force, per record; null when never. 'before' when already in force at the first sample. */
  function lawFirstYear(rec, key) {
    const s = rec.series.find((x) => x.laws.inForce.includes(key));
    return s ? s.year : null;
  }
  function exportPolicyChanges(rec) {
    const out = [];
    let prev = null;
    for (const s of rec.series) { if (prev !== null && s.laws.exportPolicy !== prev) out.push({ year: s.year, policy: s.laws.exportPolicy }); prev = s.laws.exportPolicy; }
    return out;
  }

  /** Ending mix: counts by endReason (an ending id when the world ended it) and end-year summary. */
  function endingMix(recs) {
    const c = {};
    for (const r of recs) c[r.endReason || '?'] = (c[r.endReason || '?'] || 0) + 1;
    const yrs = recs.map((r) => r.series[r.series.length - 1].year);
    return { counts: c, n: recs.length, yearMed: median(yrs), yearLo: Math.min(...yrs), yearHi: Math.max(...yrs) };
  }

  /** Check (a): the leading NPC lab's SC date is inside the AIFM p25-p75 band. One row per timeline; pass when the median date is inside. */
  function checkSC(groups, checkpoints) {
    return groups.map((g) => {
      const b = aifmBand(checkpoints, g.id, 'SC');
      const ys = g.recs.map((r) => (frontierMilestones(r).SC || {}).year).filter((v) => v != null);
      if (!b || b.p25 == null || b.p75 == null) return { tl: g.id, status: 'na', text: 'no AIFM band for this world' };
      if (!ys.length) return { tl: g.id, status: 'fail', text: 'no lab reached SC before the run ended', band: b };
      const m = median(ys), inside = ys.filter((y) => y >= b.p25 && y <= b.p75).length;
      return { tl: g.id, status: m >= b.p25 && m <= b.p75 ? 'pass' : 'fail', value: m, band: b, seeds: ys, inside, text: `lead lab SC ${m.toFixed(2)} (${ys.length} run${ys.length > 1 ? 's' : ''}, ${inside} inside) vs AIFM p25-p75 ${b.p25.toFixed(2)}-${b.p75.toFixed(2)} (median ${b.p50.toFixed(2)})` };
    });
  }

  /** Check (b): US unemployment at the sample nearest `year` (Nov 2026) within `tol` points of the BLS value. */
  function checkUnemployment(groups, real, year, tol) {
    return groups.map((g) => {
      const vals = [], ys = [];
      for (const r of g.recs) {
        let best = null;
        for (const s of r.series) if (best === null || Math.abs(s.year - year) < Math.abs(best.year - year)) best = s;
        if (best) { vals.push(best.economy.unemploymentUS); ys.push(best.year); }
      }
      const m = median(vals);
      return { tl: g.id, status: m == null ? 'na' : Math.abs(m - real) <= tol ? 'pass' : 'fail', value: m, real, tol, year: median(ys),
        text: m == null ? 'no samples' : `game ${m.toFixed(2)}% at ${median(ys).toFixed(2)} vs BLS ${real}% (diff ${(m - real >= 0 ? '+' : '') + (m - real).toFixed(2)}, limit ${tol})` };
    });
  }

  return { TL_ORDER, MS, tlOf, pct, median, groupByTimeline, seriesStat, startYear, dayToYear, frontierMilestones, milestoneMarks, aifmBand, lagSeries, lawFirstYear, exportPolicyChanges, endingMix, checkSC, checkUnemployment };
})();
if (typeof module !== 'undefined') module.exports = WD;
