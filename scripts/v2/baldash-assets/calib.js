// ================================================================ SCENARIOS: CALIBRATION RUN
// The game's forced runs (balrun --forced aifm) laid over each timeline's benchmarks. The numbers come from D.calib, scored at build
// time by scripts/v2/calibscore.ts (the same code as s1compare.ts): this file only draws them. Concatenated between client.js and
// scenarios.js; everything here runs at render time, after scenarios.js has defined its own constants.
const CAL = D.calib && D.calib.layers && Object.keys(D.calib.layers).length ? D.calib : null;
const calState = { a: null, b: null }; // entry keys: the run shown (a) and, for before/after, the earlier run (b)

/** The pickable runs for the current split. A run with sets mapped to timelines is one entry; its unmapped sets (base) are another, greyed. */
function calEntries() {
  const runs = (CAL && CAL.layers[SPLIT === 'matrix' ? LAST_1D : SPLIT]) || [];
  const out = [];
  for (const r of runs) {
    const mapped = r.groups.filter((g) => g.timeline), un = r.groups.filter((g) => !g.timeline);
    if (mapped.length) out.push({ key: r.run, run: r.run, label: r.run, groups: mapped, unmapped: false, exceptions: r.exceptions, games: r.games });
    if (un.length) out.push({ key: r.run + '#base', run: r.run, label: `${r.run} · ${un.map((g) => g.set).join(', ')} (unmapped)`, groups: un, unmapped: true, exceptions: r.exceptions, games: r.games });
  }
  return out;
}
/** The runs being shown, oldest first: [{role: 'old'|'new', entry}]. */
function calActive() {
  if (!CAL || SPLIT === 'matrix') return [];
  const es = calEntries(), pick = (k) => es.find((e) => e.key === k) || null;
  if (!pick(calState.a)) calState.a = (es.filter((e) => !e.unmapped).pop() || es[es.length - 1] || {}).key || null;
  const a = pick(calState.a), b = calState.b && calState.b !== calState.a ? pick(calState.b) : null;
  return [...(b ? [{ role: 'old', entry: b }] : []), ...(a ? [{ role: 'new', entry: a }] : [])];
}
/** The scored column of an entry for one timeline: its group mapped to it, or (unmapped) the first group scored against every timeline. */
function calCol(entry, tl) {
  const g = entry.unmapped ? entry.groups[0] : entry.groups.find((x) => x.timeline === tl);
  return g ? g.byTl[tl] || null : null;
}
const calColor = (a, tl) => (a.entry.unmapped ? 'var(--muted)' : TL_COLOR[tl]);
const calName = (a) => a.entry.label + (a.role === 'old' && calActive().length > 1 ? ' (before)' : '');
const calMinus = (s) => s.replace('-', '−');
const calSigned = (v) => calMinus((v > 0 ? '+' : '') + v.toFixed(1));

// ---- score cell
const calClass = (r) => (!r || r.score == null ? 'none' : Math.abs(r.score) <= 1 ? 'ok' : Math.abs(r.score) <= 2 ? 'near' : 'miss');
const CAL_ICON = { ok: '✓', near: '△', miss: '✕', none: '·' };
const CAL_CLASS_NAME = { ok: 'within 1 (±1 half-IQR)', near: 'within 2 (±2 half-IQR)', miss: 'beyond 2', none: 'no band to score against' };
function calText(r) {
  if (!r) return '—';
  if (r.score == null) return 'no band';
  if (r.score >= 999) return 'never';
  if (r.score <= -999) return '−∞';
  return calSigned(r.score) + (r.carried ? '*' : '');
}
function calVal(r, v) {
  if (v == null) return 'never (or diverged)';
  if (r.unit === 'year') return v.toFixed(2);
  if (r.unit === 'years') return v.toFixed(2) + ' yr';
  if (r.unit === 'log10 growth') return `×${fmtCompact(Math.pow(10, v))}`;
  if (r.unit.startsWith('OOM growth')) return `${v >= 0 ? '+' : ''}${v.toFixed(2)} OOM`;
  if (r.unit === 'min') return fmtDur(v);
  return String(v);
}
function calTip(r, a, tl, hist) {
  const lines = [
    ['Game (median across seeds)', calVal(r, r.game) + (r.carried ? ' (last sample, a lower bound: the games ended earlier)' : '')],
    ['Model median', calVal(r, r.target)],
    ['Model range', r.lo != null && r.hi != null ? `${calVal(r, r.lo)} to ${calVal(r, r.hi)}` : 'no range'],
    ['Score', r.score == null ? 'none: the benchmark has no range' : r.score >= 999 ? 'never reached' : `${calSigned(r.score)} half-ranges from the model's median`],
    ['Games', `${calCol(a.entry, tl).n}`],
  ];
  if (hist) lines.push(['How', 'The game’s yearly path is interpolated between samples. Half-range is the source’s interval, or the game’s own tolerance (15% on a horizon, 0.2 OOM on effective compute) where the source gives none.']);
  else if (r.id.endsWith('.SC')) lines.push(['SC convention', `The game’s SC is compared with the model’s AC${D.calib.scShift ? ` + ${D.calib.scShift} yr` : ''}.`]);
  return { title: r.label, rows: [{ c: calColor(a, tl), v: `${CAL_ICON[calClass(r)]} ${calText(r)}`, n: `${calName(a)}: ${CAL_CLASS_NAME[calClass(r)]}`, hl: true }], lines };
}
function calCell(r, a, tl, hist) {
  const k = calClass(r);
  const el = H('span', { class: `cal-c cal-${k}${a.entry.unmapped ? ' cal-grey' : ''}`, tabindex: '0' }, H('i', { text: CAL_ICON[k] }), H('b', { text: calText(r) }));
  if (r) { const get = () => calTip(r, a, tl, hist); el.setAttribute('aria-label', tipText(get())); bindTip(el, get); }
  return el;
}

// ---- the card: picker, banner, grid
function calHeaderBits(act) {
  const bits = [];
  const exc = [...new Set(act.flatMap((a) => a.entry.exceptions))];
  const per = act.map((a) => {
    const ns = [...new Set(a.entry.groups.flatMap((g) => Object.values(g.byTl).map((c) => c.n)))];
    const one = a.entry.groups.every((g) => g.worlds.length === 1);
    return `${a.entry.label}: ${ns.length > 1 ? `${Math.min(...ns)} to ${Math.max(...ns)}` : ns[0]} ${one ? 'seeds' : 'games'} per cell`;
  });
  bits.push(H('div', { class: 'muted', text: per.join(' · ') }));
  if (act.some((x) => x.entry.unmapped)) bits.push(H('div', { class: 'muted', text: 'An unmapped run (no override set plays a timeline) is scored against every timeline and drawn in grey. Map sets with --map, for example tl-fast=fast.' }));
  if (exc.length) bits.push(H('div', { class: 'scn-live warn cal-banner', role: 'status' }, H('b', { text: 'Harness exceptions in this run' }), H('div', { class: 'muted', text: exc.map((e) => `${e}: pending the hiring market`).join('; ') + '. The harness stands in for something the game cannot yet do itself, so these scores are not final.' })));
  return bits;
}
function calibrationCard() {
  const es = calEntries();
  if (!CAL || !es.length || SPLIT === 'matrix') return null;
  const act = calActive();
  const sel = (key, none) => {
    const s = H('select', { class: 'cal-sel', 'aria-label': none ? 'Before run (optional)' : 'Calibration run' });
    if (none) s.append(H('option', { value: '', text: 'none (show one run)' }));
    for (const e of es) s.append(H('option', { value: e.key, text: e.label }));
    s.value = (none ? calState.b : calState.a) || '';
    s.onchange = () => { calState[none ? 'b' : 'a'] = s.value || null; const y = window.scrollY; renderScenarios(); window.scrollTo(0, y); };
    return s;
  };
  const card = H('div', { class: 'card cal-card' }, H('h2', { text: 'Calibration run: how the game compares with each timeline' }),
    H('div', { class: 'sub' }, 'Pick a forced calibration run to lay its results over the benchmarks below: diamonds on the milestone chart, dashed lines on the charts after it, and the pass/miss grid here. Choose a second run to see before and after. A score is how far the game’s median is from the model’s median, in half-ranges: half of the middle half of the model’s runs (p25 to p75). Hover a cell for the numbers.'),
    H('div', { class: 'cal-pick' }, H('label', {}, 'Calibration run ', sel(calState.a, false)), H('label', {}, 'Compare with an earlier run ', sel(calState.b, true))),
    ...calHeaderBits(act));
  card.append(calKey(act), calGrid(act), calTwin(act));
  return card;
}
function calKey(act) {
  const items = [['ok', 'Within ±1'], ['near', 'Within ±2'], ['miss', 'Beyond ±2 (or never)']].map(([k, t]) => H('span', { class: 'it' }, H('span', { class: `cal-c cal-${k}` }, H('i', { text: CAL_ICON[k] })), t));
  const two = act.length > 1;
  return H('div', { class: 'legend scn-key cal-key' }, ...items,
    H('span', { class: 'it' }, '+ the game is above or later than the model, − below or earlier'),
    H('span', { class: 'it' }, '* only the games’ last sample, a lower bound'),
    two ? H('span', { class: 'it' }, 'In each cell: before → after') : null);
}
function calGrid(act) {
  const cols = TIMELINES.map((t) => t.id);
  // rows: history anchors, then the timeline benchmarks, in the order the scoring lists them
  const histKeys = [], tlKeys = [], label = {};
  const note = (list, id, r) => { if (!list.includes(id)) list.push(id); if (!label[id]) label[id] = r; };
  for (const a of act) for (const t of cols) { const c = calCol(a.entry, t); if (!c) continue; c.history.forEach((r) => note(histKeys, r.id, r)); c.rows.forEach((r) => note(tlKeys, r.id.replace(/^(fast|central|slow)\./, ''), r)); }
  // timeline rows in reading order: milestones, intervals, then each series by year
  const grp = (id) => { const m = /^(horizon80|speedup|effCompute)\.(\d+)/.exec(id); return m ? [{ horizon80: 2, speedup: 3, effCompute: 4 }[m[1]], +m[2]] : [id.startsWith('interval.') ? 1 : 0, 0]; };
  tlKeys.sort((x, y) => { const a = grp(x), b = grp(y); return a[0] - b[0] || a[1] - b[1]; });
  const unitText = (u) => (u === 'log10 growth' ? 'growth since 2025.5, scored in log10' : u === 'OOM growth' ? 'OOM growth since 2025.5' : u);
  const find = (a, t, id, hist) => { const c = calCol(a.entry, t); return c ? (hist ? c.history.find((r) => r.id === id) : c.rows.find((r) => r.id === `${t}.${id}`)) || null : null; };
  const cellFor = (t, id, hist) => {
    const wrap = H('td', { class: 'cal-td' });
    if (!act.some((a) => calCol(a.entry, t))) { wrap.append(H('span', { class: 'muted', text: '—' })); return wrap; }
    const kids = act.map((a) => { const r = find(a, t, id, hist); return r ? calCell(r, a, t, hist) : H('span', { class: 'muted', text: '—' }); });
    kids.forEach((k, i) => { if (i) wrap.append(H('span', { class: 'cal-arr', text: '→' })); wrap.append(k); });
    return wrap;
  };
  const head = H('tr', {}, H('th', { text: 'Benchmark', style: { cursor: 'default' } }), ...cols.map((t) => {
    const ns = act.map((a) => calCol(a.entry, t)).filter(Boolean);
    return H('th', { style: { cursor: 'default' } }, H('span', { class: 'sw', style: { background: TL_COLOR[t] } }), ' ', H('b', { text: tlShort(t) }), ns.length ? H('div', { class: 'muted', text: act.map((a) => { const c = calCol(a.entry, t); return c ? `${c.n} games` : 'not run'; }).join(' → ') }) : H('div', { class: 'muted', text: 'no run for this timeline' }));
  }));
  const sec = (text, sub) => H('tr', { class: 'cal-sec' }, H('th', { colSpan: 4, text }, sub ? H('span', { class: 'muted', text: ' ' + sub }) : null));
  const body = [];
  const rowEl = (id, hist) => {
    const r = label[id];
    return H('tr', {}, H('td', {}, H('div', { text: r.label }), H('div', { class: 'muted', text: hist ? `scored in ${r.unit === 'min' ? 'log10 minutes' : r.unit}` : unitText(r.unit) })), ...cols.map((t) => cellFor(t, id, hist)));
  };
  if (histKeys.length) { body.push(sec('Shared history', 'the game’s own path against measured data; every timeline starts from the same past')); histKeys.forEach((id) => body.push(rowEl(id, true))); }
  if (tlKeys.length) { body.push(sec('Timeline benchmarks', 'each column against its own timeline')); tlKeys.forEach((id) => body.push(rowEl(id, false))); }
  // totals
  const tot = H('tr', { class: 'cal-tot' }, H('td', {}, H('b', { text: 'Within ±1, timeline benchmarks' })), ...cols.map((t) => H('td', { class: 'cal-td' }, ...act.flatMap((a, i) => { const c = calCol(a.entry, t); return [i ? H('span', { class: 'cal-arr', text: '→' }) : null, c ? H('b', { text: `${c.within1} of ${c.scored}` }) : H('span', { class: 'muted', text: '—' })]; }).filter(Boolean))));
  body.push(tot);
  if (!body.length) return H('div', { class: 'empty', text: 'This run has nothing to score yet.' });
  return H('div', { class: 'tablewrap cal-wrap' }, H('table', { class: 'dt cal-grid' }, H('thead', {}, head), H('tbody', {}, body)));
}
/** Table twin of the milestone diamonds and the dashed paths. */
function calTwin(act) {
  const det = H('details', { class: 'scn-twin cal-twin' }, H('summary', { text: 'The game’s medians as a table' }));
  const yrs = (v) => (v == null ? 'never' : v.toFixed(2));
  const rows = [];
  for (const a of act) for (const t of TIMELINES) {
    const c = calCol(a.entry, t.id);
    if (!c || (a.entry.unmapped && t.id !== TIMELINES[0].id)) continue;
    rows.push({ name: calName(a), tl: a.entry.unmapped ? 'all (unmapped)' : tlShort(t.id), ms: c.ms, p: c.paths });
  }
  const msCell = (m) => (m.reached === 0 ? 'never' : `${yrs(m.med)} (${yrs(m.p10)} to ${yrs(m.p90)}), ${m.reached} of ${m.n}`);
  const t1 = H('table', { class: 'dt' }, H('thead', {}, H('tr', {}, ['Run', 'Timeline', ...MS_ORDER.map((m) => `${m}: median (p10 to p90)`)].map((x) => H('th', { style: { cursor: 'default' }, text: x })))),
    H('tbody', {}, rows.map((r) => H('tr', {}, H('td', { text: r.name }), H('td', { text: r.tl }), ...MS_ORDER.map((m) => H('td', { text: msCell(r.ms[m]) }))))));
  const years = [...new Set(rows.flatMap((r) => ['h50', 'h80', 'spd', 'ec'].flatMap((k) => r.p[k].map((p) => p[0]))))].sort((x, y) => x - y);
  const at = (r, k, y) => { const p = r.p[k].find((q) => q[0] === y); return p ? (p[1] == null ? 'diverged' : k === 'h50' || k === 'h80' ? fmtDur(p[1]) : k === 'spd' ? fmtCompact(p[1]) + '×' : '10^' + p[1].toFixed(1)) : '—'; };
  const t2 = H('table', { class: 'dt' }, H('thead', {}, H('tr', {}, ['Run', 'Timeline', 'Year', 'Task length (50%)', 'Task length (80%)', 'Research speed-up', 'Effective compute'].map((x) => H('th', { style: { cursor: 'default' }, text: x })))),
    H('tbody', {}, rows.flatMap((r) => years.filter((y) => ['h50', 'h80', 'spd', 'ec'].some((k) => r.p[k].some((p) => p[0] === y))).map((y) => H('tr', {}, H('td', { text: r.name }), H('td', { text: r.tl }), H('td', { class: 'num', text: String(y) }), ...['h50', 'h80', 'spd', 'ec'].map((k) => H('td', { class: 'num', text: at(r, k, y) })))))));
  det.append(H('div', { class: 'tablewrap' }, t1), H('div', { class: 'tablewrap' }, t2));
  return det;
}
/** One line under a chart's description, when a run is laid over it. */
function calNote(what) {
  const act = calActive();
  if (!act.length) return null;
  return H('div', { class: 'cal-note' }, what === 'ms' ? '◆ ' : '╌╌ ', `${what === 'ms' ? 'Game (diamond: median, whisker: 10th to 90th percentile across seeds)' : 'Game (dashed: median across seeds, yearly samples)'}: ${act.map((a) => calName(a) + (a.role === 'old' && act.length > 1 ? ', hollow' : '')).join(', ')}.`);
}

// ---- milestone chart: a diamond per game milestone under the model's box
const calRowH = 12;
function calMilestones(f, t, k, cy, LH, X, x1, xEnd, GUT, hits) {
  if (k === 'TED-AI') return;
  const act = calActive();
  act.forEach((a, i) => {
    const col = calCol(a.entry, t.id); // an unmapped run is laid over every timeline, in grey
    if (!col) return;
    const m = col.ms[k], y = cy + LH / 2 + 5 + calRowH * i, color = calColor(a, t.id), hollow = a.role === 'old' && act.length > 1;
    const g = S('g', {});
    if (i === 0 && act.length > 1) { /* the label says which row is which */ }
    f.svg.append(S('text', { x: f.L - 8, y: y + 3, 'text-anchor': 'end', class: 't-muted', style: 'font-size:10px' }, act.length > 1 ? (hollow ? 'before' : 'after') : 'game'));
    let tip;
    if (m.reached === 0 || m.med == null) {
      g.append(S('text', { x: Math.max(f.L + 8, f.xs(NOW) + 8), y: y + 3, style: `font-size:11px;fill:${color}` }, `never reached in ${m.n} game${m.n === 1 ? '' : 's'}`));
    } else {
      const lo = m.p10 ?? m.med, far = m.p90 == null ? Infinity : m.p90, st = `stroke:${color};stroke-width:1.5;stroke-dasharray:3 2;opacity:0.9`;
      g.append(S('line', { x1: X(lo), x2: X(far), y1: y, y2: y, style: st }));
      g.append(S('line', { x1: X(lo), x2: X(lo), y1: y - 4, y2: y + 4, style: `stroke:${color};stroke-width:1.5` }));
      if (far <= x1) g.append(S('line', { x1: X(far), x2: X(far), y1: y - 4, y2: y + 4, style: `stroke:${color};stroke-width:1.5` }));
      else g.append(arrowMark('right', xEnd, y, color));
      const cx = X(m.med), r = 6.5;
      g.append(S('polygon', { points: `${cx},${y - r} ${cx + r},${y} ${cx},${y + r} ${cx - r},${y}`, fill: hollow ? 'var(--surface)' : color, stroke: hollow ? color : 'var(--surface)', 'stroke-width': hollow ? 2 : 1.5 }));
      g.append(S('text', { x: xEnd + GUT, y: y + 3, style: `font-size:11px;fill:${color};font-weight:600` }, m.med > x1 ? String(Math.round(m.med)) : m.med.toFixed(1)));
    }
    f.svg.append(g);
    const r = col.rows.find((q) => q.id === `${t.id}.${k}`);
    const get = () => ({
      title: `${LANE_NAME[k]} · game, ${tlShort(t.id)}`,
      rows: [{ c: color, v: m.med == null ? 'never' : fmtWhen(m.med) + ` (${m.med.toFixed(2)})`, n: `${calName(a)} (median)`, hl: true }],
      lines: [['10th to 90th percentile across seeds', m.med == null ? 'never reached' : `${m.p10 == null ? 'never' : m.p10.toFixed(2)} to ${m.p90 == null ? 'never' : m.p90.toFixed(2)}`], ['Reached', `${m.reached} of ${m.n} games`],
        ...(k === 'SC' && D.calib.scShift ? [['SC convention', `Plotted ${D.calib.scShift} yr earlier than the game’s own SC (${m.raw == null ? 'never' : m.raw.toFixed(2)}), to line up with the model’s AC.`]] : []),
        ...(r ? [['Score against this timeline', `${calText(r)} (${CAL_CLASS_NAME[calClass(r)]})`]] : [])],
    });
    const hit = S('rect', { x: f.L, y: y - 6, width: xEnd - f.L, height: 12, class: 'hit', tabindex: '0' });
    hit.setAttribute('aria-label', tipText(get()));
    bindTip(hit, get);
    hits.push(hit);
  });
}

// ---- line charts: the game's median path, dashed, in the timeline's colour
function calPaths(f, Y, key, ymax, placed) {
  const hits = [], act = calActive();
  const fmt = (v) => (key === 'h50' || key === 'h80' ? fmtDur(v) : key === 'spd' ? fmtCompact(v) + '×' : '10^' + v.toFixed(1));
  const what = { h50: 'Task length (50%)', h80: 'Task length (80%)', spd: 'Research speed-up', ec: 'Effective compute' }[key];
  for (const a of act) for (const t of TIMELINES) {
    if (a.entry.unmapped && t.id !== TIMELINES[0].id) continue;
    const col = calCol(a.entry, t.id);
    const pts = col ? (col.paths[key] || []).filter((p) => p[0] <= f.x1 + 1e-9) : [];
    if (!pts.length) continue;
    const color = calColor(a, t.id), old = a.role === 'old' && act.length > 1, xy = [];
    let clipped = false;
    for (const [yr, v] of pts) {
      const x = f.xs(yr), top = v == null || v > ymax;
      xy.push([x, v == null ? f.top : Y(v)]);
      if (top) { clipped = true; break; }
    }
    f.svg.append(S('polyline', { points: xy.map((p) => p.join(',')).join(' '), fill: 'none', style: `stroke:${color};stroke-width:2.2;stroke-dasharray:${old ? '2 4' : '8 4'};opacity:${old ? 0.7 : 1}`, 'stroke-linejoin': 'round' }));
    pts.slice(0, xy.length).forEach(([yr, v], i) => {
      const [x, y] = xy[i];
      f.svg.append(S('circle', { cx: x, cy: y, r: 3, fill: 'var(--surface)', stroke: color, 'stroke-width': 1.6 }));
      const hit = S('circle', { cx: x, cy: y, r: 9, class: 'hit', tabindex: '0' });
      const get = () => ({ title: `${what} · game, ${a.entry.unmapped ? 'unmapped' : tlShort(t.id)}, ${yr}`, rows: [{ c: color, v: v == null ? 'diverged' : fmt(v), n: `${calName(a)} (median of ${col.n})`, hl: true }], lines: [['Median across seeds', 'a year is drawn when at least half the games reach it']] });
      hit.setAttribute('aria-label', tipText(get()));
      bindTip(hit, get);
      hits.push(hit);
    });
    if (clipped) f.svg.append(arrowMark('up', xy[xy.length - 1][0], f.top - 2, color));
    const [lx, ly] = xy[xy.length - 1], text = `game (${a.entry.run}${old ? ', before' : ''})`, w = text.length * 6.2;
    const x = lx + 9, y = ly + 4;
    if (x + w < f.W - 4 && !placed.some((q) => Math.abs(q.y - y) < 13 && x < q.x + (q.w || 90) && q.x < x + w)) {
      placed.push({ x, y, w });
      f.svg.append(S('text', { x, y, style: `font-size:11px;fill:${color};font-weight:600` }, text));
    }
  }
  return hits;
}
