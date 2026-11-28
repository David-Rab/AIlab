'use strict';
// World dashboard data prep for the outside actors (W10c): lanes, the timeline of beats and the live checks. Pure functions over the
// inlined data (no DOM). Concatenated after prep.js by worlddash.ts, so `WD` (prep.js) is in scope; this file adds to it.
(function () {
  const { median, dayToYear } = WD;

  /** Whole days from the run's start date to an ISO date (UTC). */
  const dayOfIso = (startDate, iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(startDate + 'T00:00:00Z')) / 86400000);

  /** Per sample index: x (median year) and the share of records for which `pred(sample)` holds. For the dated lanes. */
  function laneShares(recs, pred) {
    const n = Math.max(0, ...recs.map((r) => r.series.length)), out = [];
    for (let i = 0; i < n; i++) {
      const ss = recs.map((r) => r.series[i]).filter(Boolean);
      if (!ss.length) continue;
      out.push({ x: median(ss.map((s) => s.year)), share: ss.filter(pred).length / ss.length, n: ss.length });
    }
    return out;
  }

  /** The beats of one record, in date order: { year, text, kind, approx } (approx = known only to the quarterly sample). */
  function beats(rec, N) {
    const out = [], last = rec.series[rec.series.length - 1];
    const add = (year, text, kind, approx) => out.push({ year, text, kind, approx: !!approx });
    const yd = (d) => dayToYear(rec, d);
    for (const k of Object.keys(last.observe.publicMilestones)) { const m = last.observe.publicMilestones[k]; add(yd(m.day), 'Shown publicly: ' + N.milestones[k] + ' (' + m.lab + ')', 'milestone'); }
    for (const k of Object.keys(last.usgov.stageDay)) add(yd(last.usgov.stageDay[k]), 'US stage ' + k + ': ' + N.stages[k], 'stage');
    for (const l of N.lawTable) if (l.gameDay != null && l.gameDay > 0) add(yd(l.gameDay), 'Law in force: ' + l.name, 'law');
    let prev = null;
    for (const s of rec.series) {
      if (prev) {
        for (const id of Object.keys(s.usgov.laws)) if (prev.usgov.laws[id] === undefined) add(yd(s.usgov.laws[id]), 'Law passed: ' + (N.laws[id] || id), 'law');
        for (const id of Object.keys(prev.usgov.laws)) if (s.usgov.laws[id] === undefined) add(s.year, 'Law repealed: ' + (N.laws[id] || id), 'law', true);
        if (s.chinagov.tension !== prev.chinagov.tension) add(s.year, 'China tension ' + (s.chinagov.tension > prev.chinagov.tension ? 'up' : 'down') + ' to ' + s.chinagov.tension + ': ' + N.tension[s.chinagov.tension], 'china', true);
        if (s.chinagov.talks !== prev.chinagov.talks) add(s.year, 'China talks ' + s.chinagov.talks + ': ' + N.talks[s.chinagov.talks], 'china', true);
        if (s.chinagov.treaty !== prev.chinagov.treaty) add(s.year, 'Treaty: ' + s.chinagov.treaty, 'china', true);
        if (s.chinagov.centralised && !prev.chinagov.centralised) add(s.year, 'China national collective forms', 'china', true);
        if (s.geopolitics.taiwanDisrupted !== prev.geopolitics.taiwanDisrupted) add(s.year, s.geopolitics.taiwanDisrupted ? 'Taiwan disrupted' : 'Taiwan disruption ends', 'taiwan', true);
        if (s.laws.exportPolicy !== prev.laws.exportPolicy) add(s.year, 'Export policy: ' + s.laws.exportPolicy, 'export', true);
        if (s.usgov.consolidated !== prev.usgov.consolidated) add(s.year, 'Consolidation: ' + s.usgov.consolidated, 'stage', true);
      }
      prev = s;
    }
    if (rec.endDay != null) add(yd(rec.endDay), 'Ending: ' + (rec.endReason || rec.ending || '?'), 'ending');
    return out.sort((a, b) => a.year - b.year);
  }

  /** A value in the sample nearest `year`, median over records, against a target with a tolerance (one row per timeline). */
  function checkNear(groups, get, target, tol, year, unit) {
    return groups.map((g) => {
      const vals = [], ys = [];
      for (const r of g.recs) {
        let best = null;
        for (const s of r.series) if (best === null || Math.abs(s.year - year) < Math.abs(best.year - year)) best = s;
        if (best) { vals.push(get(best)); ys.push(best.year); }
      }
      const m = median(vals);
      return { tl: g.id, status: m == null ? 'na' : Math.abs(m - target) <= tol ? 'pass' : 'fail',
        text: m == null ? 'no samples' : `game ${m.toFixed(1)}${unit} at ${median(ys).toFixed(2)} vs real ${target}${unit} +/- ${tol} (diff ${(m - target >= 0 ? '+' : '') + (m - target).toFixed(1)})` };
    });
  }

  /** S1/S3 history part: US stage 0 and no conditional law through the cutoff day, in every record (one row per record). */
  function checkQuietUS(groups, cutoffDay, N) {
    const rows = [];
    for (const g of groups) for (const r of g.recs) {
      const bad = [], last = r.series[r.series.length - 1];
      for (const k of Object.keys(last.usgov.stageDay)) if (last.usgov.stageDay[k] <= cutoffDay) bad.push(`stage ${k} (${N.stages[k]}) on day ${last.usgov.stageDay[k]}`);
      const seen = {};
      for (const s of r.series) for (const id of Object.keys(s.usgov.laws)) seen[id] = s.usgov.laws[id];
      for (const id of Object.keys(seen)) if (seen[id] <= cutoffDay) bad.push(`${N.laws[id] || id} from day ${seen[id]}`);
      rows.push({ tl: WD.tlOf(r) + ' seed ' + r.seed, status: bad.length ? 'fail' : 'pass', text: bad.length ? bad.join('; ') + ` (cutoff day ${cutoffDay})` : `stage 0 and no conditional law through day ${cutoffDay}` });
    }
    return rows;
  }

  /** S7: each dated law's game day against the real date (within 1 day), and every record's samples agree with the game day. */
  function checkDatedLaws(groups, N) {
    const rows = [];
    for (const l of N.lawTable) {
      if (l.realDay == null) { rows.push({ tl: l.name, status: 'na', text: 'no real date in balance/world-history.ts (game day ' + l.gameDay + ')' }); continue; }
      const diff = l.gameDay - l.realDay;
      let bad = 0, total = 0;
      for (const g of groups) for (const r of g.recs) for (const s of r.series) { total++; if (s.laws.inForce.includes(l.id) !== (s.day >= l.gameDay)) bad++; }
      rows.push({ tl: l.name, status: Math.abs(diff) <= 1 && bad === 0 ? 'pass' : 'fail', text: `game day ${l.gameDay} vs real day ${l.realDay} (${l.realLabel}); diff ${diff} d; ${bad} of ${total} samples disagree with the date` });
    }
    return rows;
  }

  /** China's national collective does not form before 2027 (real history has none). */
  function checkCollective(groups) {
    const rows = [];
    for (const g of groups) for (const r of g.recs) {
      const s = r.series.find((x) => x.chinagov.centralised);
      rows.push({ tl: WD.tlOf(r) + ' seed ' + r.seed, status: !s || s.year >= 2027 ? 'pass' : 'fail', text: s ? `first seen centralised in the sample of ${s.year.toFixed(2)}` : 'never centralised in this run' });
    }
    return rows;
  }

  /** Stage order: stage days increase; each stage comes >= minGap days after the milestone that enables it (stage k: milestone
   *  index ENABLER[k] or later, as the government saw it). A stage that came before its milestone came by the other trigger
   *  (a theft or high concern): noted, not judged here (the S1/S3 check judges early stages). */
  const ENABLER = { 1: 2, 2: 3, 3: 4, 4: 5 };
  function checkStageOrder(groups, minGap, N) {
    const rows = [];
    for (const g of groups) for (const r of g.recs) {
      const last = r.series[r.series.length - 1], sd = last.usgov.stageDay, board = last.observe.govMilestones || last.observe.publicMilestones;
      const bad = [], notes = [];
      let prevDay = -Infinity, prevK = 0;
      for (const k of Object.keys(sd).map(Number).sort((a, b) => a - b)) {
        if (sd[k] <= prevDay) bad.push(`stage ${k} (day ${sd[k]}) not after stage ${prevK} (day ${prevDay})`);
        prevDay = sd[k]; prevK = k;
        const days = Object.keys(board).filter((i) => Number(i) >= ENABLER[k]).map((i) => board[i].day);
        if (!days.length) { notes.push(`stage ${k}: no enabling milestone seen (other trigger)`); continue; }
        const en = Math.min(...days);
        if (sd[k] < en) notes.push(`stage ${k} on day ${sd[k]} came before its milestone (day ${en}): other trigger`);
        else if (sd[k] - en < minGap) bad.push(`stage ${k} only ${sd[k] - en} d after its milestone`);
        else notes.push(`stage ${k} ${sd[k] - en} d after its milestone`);
      }
      rows.push({ tl: WD.tlOf(r) + ' seed ' + r.seed, status: bad.length ? 'fail' : Object.keys(sd).length ? 'pass' : 'na', text: bad.concat(notes).join('; ') || 'no stage reached in this run' });
    }
    return rows;
  }

  Object.assign(WD, { dayOfIso, laneShares, beats, checkNear, checkQuietUS, checkDatedLaws, checkCollective, checkStageOrder });
})();
