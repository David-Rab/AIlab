// ================================================================ TAB 4: SCENARIOS
// Reads D.scenarios (balance/scenarios.ts: TIMELINES, ALIGNMENT_LEVELS, CHECKPOINTS). Appended to client.js by baldash.ts.
const SC = D.scenarios || { timelines: [], levels: [], checkpoints: [] };
const CPS = SC.checkpoints || [];
const NOW = 2026.9; // "late 2026": the end of the shared history
const TL_ORDER = ['fast', 'central', 'slow'];
const TL_FALLBACK = { fast: 'Fast', central: 'Central', slow: 'Slow' };
// Fixed timeline colours: categorical slots 1-3, checked together with validate_palette.js --pairs all (both modes).
const TL_COLOR = { fast: 'var(--s2)', central: 'var(--s1)', slow: 'var(--s3)' };
const TIMELINES = TL_ORDER.map((id) => (SC.timelines || []).find((t) => t.id === id) || { id, name: TL_FALLBACK[id], sourceModel: '', summary: '' });
const tlOf = (id) => TIMELINES.find((t) => t.id === id);
const tlShort = (id) => String(tlOf(id).name).split(' (')[0];
const LV_ORDER = ['beginner', 'easy', 'normal', 'hard', 'impossible'];
const LEVELS = LV_ORDER.map((id) => (SC.levels || []).find((l) => l.id === id) || { id, name: prettify(id), tested: false, params: [] });
const lvOf = (id) => LEVELS.find((l) => l.id === id);
const STATUS_NAME = { sourced: 'Sourced', unsure: 'Unsure', proposed: 'Proposed', blank: 'To be filled' };
const STATUS_DEF = {
  sourced: 'The number comes straight from the cited source.',
  unsure: 'A judgement call, or the sources disagree. Read the note.',
  proposed: 'Suggested by the spec; the designer has not agreed it yet.',
  blank: 'No number yet; the slot is reserved.',
};
const BAND_DEF = { source: 'The range comes from the source itself.', designer: 'The range is the designer’s own tolerance, not the source’s.', none: 'The source gives no range.' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtWhen = (y) => (y == null ? '—' : `${MONTHS[Math.min(11, Math.floor((y - Math.floor(y)) * 12 + 1e-6))]} ${Math.floor(y)}`);
const hollowOf = (c) => c.status !== 'sourced';

// ---- number words
const WDAY = 480, WWEEK = 2400, WMONTH = 10000, WYEAR = 120000; // work-time in minutes (8 h day, 40 h week, ~167 h month, 2,000 h year)
const WORK_NOTE = 'Work-time units: a work-day is 8 hours, a work-week 40 hours, a work-month about 167 hours, a work-year 2,000 hours.';
const sig2 = (v) => String(+v.toPrecision(2));
function fmtDur(min) {
  if (min < 60) return `${sig2(min)} min`;
  if (min < WDAY) return `${sig2(min / 60)} hr`;
  if (min < WWEEK) return `${sig2(min / WDAY)} work-days`;
  if (min < WMONTH) return `${sig2(min / WWEEK)} work-weeks`;
  if (min < WYEAR) return `${sig2(min / WMONTH)} work-months`;
  return `${sig2(min / WYEAR)} work-years`;
}
function fmtCompact(v) {
  const a = Math.abs(v);
  if (a >= 1e12) return +(v / 1e12).toPrecision(3) + 'T';
  if (a >= 1e9) return +(v / 1e9).toPrecision(3) + 'B';
  if (a >= 1e6) return +(v / 1e6).toPrecision(3) + 'M';
  if (a >= 1e4) return +(v / 1e3).toPrecision(3) + 'K';
  if (a >= 100) return Math.round(v).toLocaleString('en-US');
  return String(+v.toPrecision(3));
}
const toMin = (c, v) => { const u = String(c.unit || 'min').toLowerCase(); return u.startsWith('h') ? v * 60 : u.startsWith('d') ? v * 1440 : v; };
function fmtNum(c, v) {
  if (v == null) return '—';
  if (c.unit === 'fraction') return `${+(v * 100).toPrecision(3)}%`;
  if (c.unit === 'year' || c.quantity === 'milestone') return v.toFixed(2);
  return fmtCompact(v);
}
const fmtBand = (c) => (c.lo != null && c.hi != null ? `${fmtNum(c, c.lo)} to ${fmtNum(c, c.hi)}` : null);
function valueText(c) { // the headline reading of one checkpoint
  if (c.value == null && c.lo == null) return 'no value yet';
  const v = c.value != null ? c.value : null;
  if (c.quantity === 'milestone') return fmtWhen(v);
  if (c.quantity === 'horizon50' || c.quantity === 'horizon80') return v != null ? fmtDur(toMin(c, v)) : 'range only';
  if (c.unit === 'fraction') return fmtNum(c, v);
  return v != null ? `${fmtNum(c, v)} ${c.unit}` : 'range only';
}

// ---- the three timeline charts share one time axis
const PLOTTED = new Set(['horizon50', 'horizon80', 'worldCompute', 'milestone']);
const timeRange = (() => {
  const ys = [NOW];
  for (const c of CPS) if (PLOTTED.has(c.quantity)) { if (c.date != null) ys.push(c.date); if (c.quantity === 'milestone') for (const v of [c.value, c.lo, c.hi]) if (v != null) ys.push(v); }
  let lo = Math.floor(Math.min(...ys) - 0.01), hi = Math.ceil(Math.max(...ys) + 0.01);
  if (CPS.filter((c) => PLOTTED.has(c.quantity)).length === 0) { lo = 2024; hi = 2031; }
  lo = Math.min(lo, 2025); hi = Math.max(hi, lo + 5);
  return [lo, hi];
})();
function yearTicks(lo, hi, w) {
  const step = (hi - lo) <= (w < 800 ? 10 : 16) ? 1 : (hi - lo) <= 30 ? 2 : 5, t = [];
  for (let y = Math.ceil(lo / step) * step; y <= hi + 1e-9; y += step) t.push(y);
  return t;
}
function cpTip(c, color, who) {
  const lines = [];
  if (c.quantity !== 'milestone' && c.date != null) lines.push(['When', fmtWhen(c.date)]);
  const hz = c.quantity === 'horizon50' || c.quantity === 'horizon80';
  const b = c.lo != null && c.hi != null ? (hz ? `${fmtDur(toMin(c, c.lo))} to ${fmtDur(toMin(c, c.hi))}` : c.quantity === 'milestone' ? `${fmtWhen(c.lo)} to ${fmtWhen(c.hi)}` : fmtBand(c)) : null;
  if (b) lines.push(['Range', `${b}. ${BAND_DEF[c.bandFrom] || ''}`]);
  lines.push(['Source', c.source || '—']);
  if (c.sourceRef) lines.push(['Reference', c.sourceRef]);
  lines.push(['Status', STATUS_NAME[c.status] + (c.status === 'sourced' ? '' : ` (hollow marker). ${STATUS_DEF[c.status]}`)]);
  if (c.notes) lines.push(['Note', c.notes]);
  lines.push(['Target', c.targetId ? c.targetId : 'none yet']);
  const raw = c.value != null && (c.quantity === 'horizon50' || c.quantity === 'horizon80') ? ` (${fmtCompact(toMin(c, c.value))} min)` : '';
  return { title: c.label, rows: [{ c: color, v: valueText(c) + raw, n: who, hl: true }], lines };
}
const markerAttrs = (color, hollow) => (hollow ? { fill: 'var(--surface)', stroke: color, 'stroke-width': 2 } : { fill: color, stroke: 'var(--surface)', 'stroke-width': 2 });

/** Frame shared by the three charts: surface, history wash, year grid, "now" marker. Returns helpers. */
function timeFrame(host, o) {
  clear(host);
  const W = Math.max(host.clientWidth || 900, 640), L = 92, R = 104, top = 24, bot = 26, ph = o.ph;
  const [x0, x1] = timeRange, xs = (y) => L + ((y - x0) / (x1 - x0)) * (W - L - R);
  const svg = S('svg', { width: W, height: top + ph + bot, role: 'group', 'aria-label': o.aria });
  if (NOW > x0) svg.append(S('rect', { x: L, y: top, width: xs(Math.min(NOW, x1)) - L, height: ph, fill: 'var(--wash)' }));
  for (const y of yearTicks(x0, x1, W)) {
    svg.append(S('line', { x1: xs(y), x2: xs(y), y1: top, y2: top + ph, stroke: 'var(--grid)', 'stroke-width': 1 }));
    svg.append(S('text', { x: xs(y), y: top + ph + 17, 'text-anchor': 'middle', class: 't-muted' }, String(y)));
  }
  svg.append(S('line', { x1: L, x2: W - R, y1: top + ph, y2: top + ph, stroke: 'var(--axis)', 'stroke-width': 1 }));
  return { svg, W, L, R, top, ph, bot, xs, x0, x1, finish() {
    if (NOW >= x0 && NOW <= x1) {
      svg.append(S('line', { x1: xs(NOW), x2: xs(NOW), y1: top - 8, y2: top + ph, stroke: 'var(--ink)', 'stroke-width': 1.5 }));
      svg.append(S('text', { x: xs(NOW) + 5, y: top - 4, class: 't-ink', style: 'font-size:11px' }, 'now (late 2026)'));
      if (xs(NOW) - L > 90) svg.append(S('text', { x: xs(NOW) - 5, y: top - 4, 'text-anchor': 'end', class: 't-muted' }, 'measured history'));
    }
    host.append(svg);
  } };
}
function emptyNote(f, text) {
  f.svg.append(S('text', { x: (f.L + f.W - f.R) / 2, y: f.top + f.ph / 2, 'text-anchor': 'middle', class: 't-muted', style: 'font-size:12px' }, text));
}
function logAxis(f, ticks, ymin, ymax) {
  const lmin = Math.log10(ymin), lmax = Math.log10(ymax), ys = (v) => f.top + f.ph * (1 - (Math.log10(v) - lmin) / (lmax - lmin));
  let lastY = Infinity;
  for (const t of ticks.slice().sort((a, b) => b.v - a.v).reverse()) {
    if (t.v < ymin * 0.999 || t.v > ymax * 1.001) continue;
    const y = ys(t.v);
    f.svg.append(S('line', { x1: f.L, x2: f.W - f.R, y1: y, y2: y, stroke: 'var(--grid)', 'stroke-width': 1 }));
    if (lastY - y >= 14 || lastY === Infinity) f.svg.append(S('text', { x: f.L - 8, y: y + 4, 'text-anchor': 'end', class: 't-muted' }, t.label));
    lastY = y;
  }
  f.svg.append(S('line', { x1: f.L, x2: f.L, y1: f.top, y2: f.top + f.ph, stroke: 'var(--axis)', 'stroke-width': 1 }));
  return ys;
}
function decadeTicks(ymin, ymax, fmt, extra) {
  const t = [];
  for (let k = Math.floor(Math.log10(ymin)); k <= Math.ceil(Math.log10(ymax)); k++) for (const m of extra || [1]) { const v = m * Math.pow(10, k); if (v >= ymin * 0.999 && v <= ymax * 1.001) t.push({ v, label: fmt(v) }); }
  return t;
}
const horizonTicks = (lo, hi) => [[1, '1 min'], [10, '10 min'], [60, '1 hr'], [240, '4 hr'], [WDAY, '1 work-day'], [WWEEK, '1 work-week'], [WMONTH, '1 work-month'], [WYEAR, '1 work-year'], [WYEAR * 10, '10 work-years'], [WYEAR * 100, '100 work-years']]
  .map(([v, label]) => ({ v, label })).filter((t) => t.v >= lo * 0.999 && t.v <= hi * 1.001);

/** Line chart on a log scale: history points, then one series per timeline, source ranges as shaded bands. */
function timeLogChart(host, o) {
  const f = timeFrame(host, { ph: 240, aria: o.aria });
  const mk = (c) => {
    const cv = (v) => (v == null ? null : o.conv(c, v));
    const lo = c.bandFrom !== 'none' ? cv(c.lo) : null, hi = c.bandFrom !== 'none' ? cv(c.hi) : null;
    const y = cv(c.value), ok = lo > 0 && hi > 0; // a range with no central value is drawn as a bar only (no marker, no line)
    return { c, x: c.date, y, lo: ok ? lo : null, hi: ok ? hi : null, mid: y > 0 ? y : ok ? Math.sqrt(lo * hi) : null };
  };
  const take = (pred) => CPS.filter((c) => c.quantity === o.key && pred(c) && c.date != null).map(mk).filter((p) => p.mid > 0).sort((a, b) => a.x - b.x);
  const hist = take((c) => c.layer === 'history');
  const series = TIMELINES.map((t) => ({ t, pts: take((c) => c.layer === 'timeline' && c.timeline === t.id) }));
  const all = [...hist, ...series.flatMap((s) => s.pts)];
  const val = (pts) => pts.filter((p) => p.y > 0);
  if (!all.length) {
    const ys = logAxis(f, o.ticks(o.dom[0], o.dom[1]), o.dom[0], o.dom[1]);
    emptyNote(f, 'No benchmarks for this chart yet.');
    f.finish();
    return;
  }
  const vals = all.flatMap((p) => [p.mid, p.lo, p.hi]).filter((v) => v > 0);
  const ymin = Math.min(...vals) / 1.8, ymax = Math.max(...vals) * 1.8;
  const ys = logAxis(f, o.ticks(ymin, ymax), ymin, ymax);
  const marks = [], hits = [], labels = [];
  const drawSet = (pts, color, who, id, noRibbon) => {
    // shaded ribbon through each run of 2+ neighbouring source ranges
    const runs = []; let cur = [];
    for (const p of pts) { if (p.lo != null && p.c.bandFrom === 'source') cur.push(p); else { if (cur.length) runs.push(cur); cur = []; } }
    if (cur.length) runs.push(cur);
    for (const r of runs) {
      if (r.length < 2 || noRibbon) continue;
      const d = r.map((p) => `${f.xs(p.x)},${ys(p.hi)}`).concat(r.slice().reverse().map((p) => `${f.xs(p.x)},${ys(p.lo)}`)).join(' ');
      f.svg.append(S('polygon', { points: d, style: `fill:${color};opacity:0.16` }));
    }
    for (const p of pts) if (p.lo != null) {
      const x = f.xs(p.x), st = `stroke:${color};stroke-width:1.5;opacity:${p.c.bandFrom === 'source' ? 0.75 : 0.45}`;
      f.svg.append(S('line', { x1: x, x2: x, y1: ys(p.hi), y2: ys(p.lo), style: st }), S('line', { x1: x - 3, x2: x + 3, y1: ys(p.hi), y2: ys(p.hi), style: st }), S('line', { x1: x - 3, x2: x + 3, y1: ys(p.lo), y2: ys(p.lo), style: st }));
    }
  };
  for (const s of series) if (s.pts.length) {
    const color = TL_COLOR[s.t.id];
    drawSet(s.pts, color, s.t.name, s.t.id);
    if (val(s.pts).length > 1) f.svg.append(S('polyline', { points: val(s.pts).map((p) => `${f.xs(p.x)},${ys(p.y)}`).join(' '), fill: 'none', style: `stroke:${color};stroke-width:2`, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  }
  drawSet(hist, 'var(--ink)', 'Measured', 'hist', true); // measured points are separate readings: whiskers, no ribbon
  const addMarks = (pts, color, who) => {
    for (const p of pts) {
      const x = f.xs(p.x), y = ys(p.mid);
      const m = S('circle', Object.assign({ cx: x, cy: y, r: p.y > 0 ? 4.5 : 0 }, markerAttrs(color, hollowOf(p.c))));
      const hit = S('circle', { cx: x, cy: y, r: 12, class: 'hit', tabindex: '0' });
      const get = () => cpTip(p.c, color, who);
      hit.setAttribute('aria-label', tipText(get()));
      bindTip(hit, get, p.y > 0 ? { on: () => m.setAttribute('r', 6), off: () => m.setAttribute('r', 4.5) } : undefined);
      marks.push(m); hits.push(hit);
    }
  };
  addMarks(hist, 'var(--ink)', 'Measured');
  for (const s of series) addMarks(s.pts, TL_COLOR[s.t.id], s.t.name);
  f.svg.append(...marks);
  // direct labels at the right-hand end of each series; skipped (the legend carries them) if two would touch
  const placed = [];
  for (const s of series) if (val(s.pts).length) {
    const p = val(s.pts)[val(s.pts).length - 1], x = f.xs(p.x) + 9, y = ys(p.y) + 4;
    if (placed.some((q) => Math.abs(q.y - y) < 13 && Math.abs(q.x - x) < 80)) continue;
    placed.push({ x, y });
    f.svg.append(S('text', { x, y, class: 't-ink', style: 'font-weight:600' }, tlShort(s.t.id)));
  }
  f.finish();
  f.svg.append(...hits);
}

/** Milestone chart: one row per timeline, a dot per milestone with its range, labels stacked clear of each other. */
function milestoneChart(host) {
  const LH = 13, RAIL = 24;
  const rows = TIMELINES.map((t) => {
    const pts = MS_ORDER.map((m) => CPS.find((c) => c.layer === 'timeline' && c.timeline === t.id && c.quantity === 'milestone' && c.milestone === m && c.value != null)).filter(Boolean);
    return { t, pts };
  });
  const probe = timeFrame(host, { ph: 10, aria: '' }); // for the width and x scale only (nothing is attached)
  const W = probe.W, xs = probe.xs;
  rows.forEach((r) => {
    const placed = [];
    // Place from the right-hand dot leftwards: an earlier dot's label goes higher than the later labels its text runs over,
    // so no leader line crosses another label's text.
    r.items = r.pts.slice().reverse().map((c) => {
      const x = xs(c.value), w = MS_NAME[c.milestone].length * 5.9 + 4, flip = x + 6 + w > W - 6;
      const it = { c, x, a: flip ? x - 6 - w : x + 6, b: flip ? x - 6 : x + 6 + w, level: 0 };
      for (let k = 0; k < 12; k++) {
        const clash = placed.some((q) => (q.level === k && it.a < q.b + 6 && q.a < it.b + 6)
          || (q.x > it.a - 3 && q.x < it.b + 3 && k <= q.level) || (it.x > q.a - 3 && it.x < q.b + 3 && k >= q.level));
        if (!clash) { it.level = k; break; }
        it.level = k + 1;
      }
      placed.push(it);
      return it;
    }).reverse();
    r.levels = r.items.length ? Math.max(...r.items.map((i) => i.level)) + 1 : 1;
    r.ranged = r.items.some((i) => i.c.lo != null && i.c.hi != null && i.c.bandFrom !== 'none');
    r.h = 12 + r.levels * LH + RAIL + (r.ranged ? 4 * 6 + 4 : 0);
  });
  const ph = rows.reduce((s, r) => s + r.h, 0);
  const f = timeFrame(host, { ph, aria: 'Milestone dates by timeline' });
  let y0 = f.top;
  rows.forEach((r, i) => {
    const color = TL_COLOR[r.t.id], rail = y0 + 12 + r.levels * LH + RAIL / 2 - 2;
    if (i) f.svg.append(S('line', { x1: 0, x2: f.W - f.R, y1: y0, y2: y0, stroke: 'var(--grid)', 'stroke-width': 1 }));
    f.svg.append(S('circle', { cx: 8, cy: rail, r: 4.5, style: `fill:${color}` }), S('text', { x: 20, y: rail + 4, class: 't-ink', style: 'font-weight:600' }, tlShort(r.t.id)));
    f.svg.append(S('line', { x1: f.L, x2: f.W - f.R, y1: rail, y2: rail, stroke: 'var(--grid)', 'stroke-width': 1 }));
    if (!r.items.length) { f.svg.append(S('text', { x: f.L + 10, y: rail + 4, class: 't-muted' }, 'No milestone dates yet')); y0 += r.h; return; }
    if (r.items.length > 1) f.svg.append(S('line', { x1: r.items[0].x, x2: r.items[r.items.length - 1].x, y1: rail, y2: rail, style: `stroke:${color};stroke-width:2;opacity:0.55` }));
    // ranges sit in their own thin lane under the rail, one lane per milestone, in milestone order, so they never pile up
    for (const it of r.items) {
      const c = it.c;
      if (c.lo == null || c.hi == null || c.bandFrom === 'none') continue;
      const a = xs(c.lo), b = xs(c.hi), ly = rail + 12 + MS_ORDER.indexOf(c.milestone) * 6, src = c.bandFrom === 'source';
      f.svg.append(S('rect', { x: a, y: ly - 2, width: Math.max(2, b - a), height: 4, rx: 2, style: `fill:${color};opacity:${src ? 0.45 : 0.18}` }));
      if (!src) f.svg.append(S('line', { x1: a, x2: b, y1: ly, y2: ly, style: `stroke:${color};stroke-width:1;opacity:0.7` }));
      f.svg.append(S('line', { x1: it.x, x2: it.x, y1: rail + 6, y2: ly + 3, style: `stroke:${color};stroke-width:1;opacity:0.5` }));
      const bh = S('rect', { x: a, y: ly - 4, width: Math.max(2, b - a), height: 8, class: 'hit', tabindex: '0' });
      const get = () => { const t = cpTip(c, color, r.t.name); t.lines.unshift(['What', MS_DEF[c.milestone]]); return t; };
      bh.setAttribute('aria-label', tipText(get())); bindTip(bh, get); f.svg.append(bh);
    }
    const hits = [];
    for (const it of r.items) {
      const c = it.c, ly = rail - 10 - it.level * LH;
      f.svg.append(S('line', { x1: it.x, x2: it.x, y1: ly + 2, y2: rail - 5, stroke: 'var(--axis)', 'stroke-width': 1 }));
      f.svg.append(S('text', { x: it.x + (it.a < it.x ? -6 : 6), y: ly + 3, 'text-anchor': it.a < it.x ? 'end' : 'start', class: 't-ink' }, MS_NAME[c.milestone]));
      const m = S('circle', Object.assign({ cx: it.x, cy: rail, r: 5.5 }, markerAttrs(color, hollowOf(c))));
      f.svg.append(m);
      const hit = S('circle', { cx: it.x, cy: rail, r: 12, class: 'hit', tabindex: '0' });
      const get = () => { const t = cpTip(c, color, r.t.name); t.lines.unshift(['What', MS_DEF[c.milestone]]); return t; };
      hit.setAttribute('aria-label', tipText(get()));
      bindTip(hit, get, { on: () => m.setAttribute('r', 7), off: () => m.setAttribute('r', 5.5) });
      hits.push(hit);
    }
    f.svg.append(...hits);
    y0 += r.h;
  });
  f.finish();
}

// ---- chart cards
const scnCard = (title, sub, ctl) => {
  const c = H('div', { class: 'card' }, H('div', { class: 'scn-h' }, H('h2', { text: title }), ctl || null), sub);
  return c;
};
const subEl = (...kids) => H('div', { class: 'sub' }, ...kids);
function keyRow() {
  const sw = (cls) => H('span', { class: 'mk ' + cls });
  return H('div', { class: 'legend scn-key' },
    H('span', { class: 'it', tabindex: '0' }, sw('mk-hist'), 'Measured history'), H('span', { class: 'it', tabindex: '0' }, sw('mk-hollow'), 'Unsure or proposed'), H('span', { class: 'it', tabindex: '0' }, sw('mk-band'), 'Range given by the source'), H('span', { class: 'it' }, H('span', { class: 'tk' }), 'Now (late 2026)'));
}

function renderScenarios() {
  const host = document.getElementById('p-scn');
  clear(host);
  const nBy = (s) => CPS.filter((c) => c.status === s).length;
  const nTgt = CPS.filter((c) => c.targetId).length;
  // ---- 1. intro, legend of the three timelines
  const intro = H('div', { class: 'card' }, H('h2', { text: 'Three possible futures, one shared past' }),
    H('div', { class: 'sub', text: CPS.length ? `${CPS.length} benchmarks: ${nBy('sourced')} sourced, ${nBy('unsure')} unsure, ${nBy('proposed')} proposed, ${nBy('blank')} still to be filled. ${nTgt} already have a target in the targets list.` : 'No benchmarks have been entered yet, so the charts below are empty frames. The levels and the grid still show their structure.' }));
  intro.append(H('div', { class: 'scn-tls' }, TIMELINES.map((t) => H('div', { class: 'scn-tl', tabindex: '0' },
    H('div', { class: 'scn-tl-h' }, H('span', { class: 'sw', style: { background: TL_COLOR[t.id] } }), H('b', { text: t.name })),
    H('div', { class: 'muted', text: t.sourceModel || 'source model not named yet' }), H('div', { text: t.summary || '' })))));
  intro.append(keyRow());
  host.append(intro);

  // ---- 2. the three charts, one time axis
  const h50 = CPS.filter((c) => c.quantity === 'horizon50').length, h80 = CPS.filter((c) => c.quantity === 'horizon80').length;
  const view = { h: h50 >= h80 ? 'horizon50' : 'horizon80' };
  const hHost = H('div', { class: 'chart' }), wHost = H('div', { class: 'chart' }), mHost = H('div', { class: 'chart' });
  const hSub = subEl(), seg = H('div', { class: 'seg-ctl', style: { marginLeft: '0' } });
  const hBtns = [['horizon50', 'Half the time'], ['horizon80', 'Four times in five']].map(([k, t]) => H('button', { text: t, 'aria-pressed': String(view.h === k), onclick: () => { view.h = k; draw(); } }));
  seg.append(...hBtns);
  const hCard = scnCard('How long a task can the best AI do on its own?', hSub, seg);
  hCard.append(hHost);
  const wCard = scnCard('How much computing power does the world have?', subEl('Total AI computing in the world, counted in chips equal to one top-end 2023 chip (', infoTip('H100e: H100 equivalents, the standard unit of AI computing power.', 'H100 equivalents'), '). Each step up the axis is ten times more.'));
  wCard.append(wHost);
  const mCard = scnCard('When does each AI milestone arrive?', subEl('One row per timeline. A dot is the central date. Each thin bar under the row is that milestone’s range, in the same order as the labels; a faint line joins it to its dot. Hover for what the milestone means.'));
  mCard.append(mHost);
  const draw = () => {
    clear(hSub);
    hSub.append(`The length of task, in human working time, that the best AI finishes ${view.h === 'horizon50' ? 'half' : 'four times in five'} of the time. Each step up the axis is ten times longer. `, infoTip(WORK_NOTE, 'What is a work-month?'));
    hBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(['horizon50', 'horizon80'][i] === view.h)));
    timeLogChart(hHost, { key: view.h, conv: toMin, ticks: horizonTicks, dom: [1, 1e5], aria: 'AI task length over time, by timeline' });
    timeLogChart(wHost, { key: 'worldCompute', conv: (c, v) => v, ticks: (lo, hi) => decadeTicks(lo, hi, (v) => fmtCompact(v), hi / lo <= 1e3 ? [1, 3] : [1]), dom: [1e7, 1e9], aria: 'World computing power over time, by timeline' });
    milestoneChart(mHost);
  };
  const sw = H('div', { class: 'scn-stack' }, hCard, wCard, mCard);
  host.append(sw);
  // table twin of the chart data
  const twin = H('details', { class: 'card scn-twin' }, H('summary', { text: 'The chart points as a table' }));
  const plotted = CPS.filter((c) => PLOTTED.has(c.quantity));
  const twinBody = H('div', { class: 'tablewrap' });
  twin.append(twinBody);
  dataTable(twinBody, [
    { label: 'Benchmark', get: (c) => c.label, clamp: true },
    { label: 'Belongs to', get: (c) => (c.layer === 'history' ? 'Shared history' : c.layer === 'timeline' ? tlShort(c.timeline) : 'Alignment') },
    { label: 'When', get: (c) => c.date, fmt: (v) => fmtWhen(v), num: true },
    { label: 'Value', get: (c) => c.value, fmt: (v, c) => fmtNum(c, v), num: true },
    { label: 'Range', get: (c) => c.lo, fmt: (v, c) => fmtBand(c) || '—' },
    { label: 'Unit', get: (c) => c.unit },
    { label: 'Status', get: (c) => STATUS_NAME[c.status] },
  ], plotted, { limit: 400 });
  if (!plotted.length) twinBody.append(H('div', { class: 'empty', text: 'No chart points yet.' }));
  host.append(twin);
  draw();
  renderers.scn_re = draw;
  window.addEventListener('resize', () => { if (!document.getElementById('p-scn').hidden) { clearTimeout(draw.t); draw.t = setTimeout(draw, 120); } });

  // ---- 3. alignment levels
  const lv = H('div', { class: 'card' }, H('h2', { text: 'Alignment difficulty levels' }),
    H('div', { class: 'sub' }, 'How hard it is to keep AI aligned. Each level is calibrated by how often the strongest bot wins at it: the ', infoTip('The win-rate band is set by the designer only. The calibration tooling tunes the level’s parameters until the strongest bot found wins this often.', 'win-rate band'), '. Three levels are tested first.'));
  const lvGrid = H('div', { class: 'scn-lvls' });
  for (const l of LEVELS) {
    const band = l.winBand;
    const track = H('div', { class: 'scn-track' });
    if (band) track.append(H('div', { class: 'scn-band', style: { left: band.lo * 100 + '%', width: Math.max(1, (band.hi - band.lo) * 100) + '%' } }));
    const params = l.params && l.params.length ? l.params.map((p) => H('div', { class: 'scn-par' }, H('span', { class: 'chip', text: p.id }), p.value == null ? H('span', { class: 'muted', text: 'not chosen yet' }) : H('b', { text: fmtVal(p.value) }))) : [H('div', { class: 'muted', text: 'No parameters named yet' })];
    lvGrid.append(H('div', { class: 'scn-lv' + (l.tested ? '' : ' off') },
      H('div', { class: 'scn-lv-h' }, H('b', { text: l.name }), H('span', { class: 'pill' + (l.tested ? ' on' : ''), text: l.tested ? 'Tested first' : 'Not tested yet' })),
      H('div', { class: 'k', text: 'Set by' }), ...params,
      H('div', { class: 'k', text: 'Strongest bot’s win rate' }),
      track, H('div', { class: 'scn-axis' }, H('span', { text: '0%' }), H('span', { text: '50%' }), H('span', { text: '100%' })),
      band ? H('div', { class: 'scn-bandtx' }, H('b', { text: `${Math.round(band.lo * 100)}% to ${Math.round(band.hi * 100)}%` })) : H('div', { class: 'muted', text: 'Win-rate band: not set yet' }),
      l.notes ? H('div', { class: 'muted', text: l.notes }) : null));
  }
  lv.append(lvGrid);
  host.append(lv);

  // ---- 4. the grid and the benchmark list of one cell
  const tested = LEVELS.filter((l) => l.tested);
  const grid = H('div', { class: 'card' }, H('h2', { text: 'Calibration cells' }), H('div', { class: 'sub', text: 'One cell is one timeline played at one alignment level. Pick a cell to see every benchmark it has to hit.' }));
  const detail = H('div', { class: 'scn-detail' });
  const st = { tl: TIMELINES[1].id, lv: (tested.find((l) => l.id === 'normal') || tested[0] || {}).id };
  const inCell = (tl, lvId) => ({
    hist: CPS.filter((c) => c.layer === 'history'),
    tl: CPS.filter((c) => c.layer === 'timeline' && c.timeline === tl),
    lv: CPS.filter((c) => c.layer === 'alignment' && c.align === lvId),
  });
  const cellBtns = [];
  const drawDetail = () => {
    clear(detail);
    cellBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tl === st.tl && b.dataset.lv === st.lv)));
    if (!st.lv) return;
    const g = inCell(st.tl, st.lv), t = tlOf(st.tl), l = lvOf(st.lv);
    detail.append(H('div', { class: 'scn-dh' }, H('span', { class: 'sw', style: { background: TL_COLOR[t.id] } }), H('h3', { text: `${t.name}, ${l.name} alignment` }), H('span', { class: 'muted', text: `${g.hist.length + g.tl.length + g.lv.length} benchmarks` })));
    detail.append(groupEl('Shared history', 'Holds in every cell: measured data up to late 2026.', g.hist, 'No history benchmarks entered yet.'));
    detail.append(groupEl(`${t.name} timeline`, t.summary || 'Checkpoints from this timeline’s source.', g.tl, 'No checkpoints for this timeline yet.'));
    detail.append(groupEl(`${l.name} alignment level`, 'The strongest bot’s win rate, plus any safety benchmarks of this level.', g.lv, 'No alignment benchmarks for this level yet.', l.winBand || null));
  };
  const gridEl = H('div', { class: 'scn-grid', style: { gridTemplateColumns: `minmax(150px, 190px) repeat(${Math.max(1, tested.length)}, minmax(0, 1fr))` } });
  gridEl.append(H('div'));
  for (const l of tested) gridEl.append(H('div', { class: 'scn-gh' }, H('b', { text: l.name }), H('div', { class: 'muted', text: l.winBand ? `bot wins ${Math.round(l.winBand.lo * 100)}% to ${Math.round(l.winBand.hi * 100)}%` : 'win-rate band not set yet' })));
  if (!tested.length) gridEl.append(H('div', { class: 'muted', text: 'No alignment level is marked as tested yet.' }));
  for (const t of TIMELINES) {
    gridEl.append(H('div', { class: 'scn-rh' }, H('span', { class: 'sw', style: { background: TL_COLOR[t.id] } }), H('b', { text: t.name })));
    for (const l of tested) {
      const g = inCell(t.id, l.id), n = g.hist.length + g.tl.length + g.lv.length;
      const all = [...g.hist, ...g.tl, ...g.lv], open = all.filter((c) => c.status !== 'sourced').length;
      const b = H('button', { class: 'scn-cell', 'data-tl': t.id, 'data-lv': l.id, 'aria-pressed': 'false', onclick: () => { st.tl = t.id; st.lv = l.id; drawDetail(); } },
        H('span', { class: 'n', text: String(n) }), H('span', { class: 'muted', text: n === 1 ? ' benchmark' : ' benchmarks' }),
        H('div', { class: 'muted', text: `${g.hist.length} history, ${g.tl.length} timeline, ${g.lv.length} level` }),
        H('div', { class: open ? 'warnx' : 'muted', text: n ? (open ? `${open} unsure, proposed or blank` : 'all sourced') : 'nothing entered yet' }));
      cellBtns.push(b); gridEl.append(b);
    }
  }
  grid.append(gridEl);
  host.append(grid, detail);
  drawDetail();
}

function statusChip(s) {
  const e = H('span', { class: 'st st-' + s, tabindex: '0' }, H('i', { class: 'dot' + (s === 'sourced' ? '' : ' hol') }), STATUS_NAME[s] || s);
  bindTip(e, () => ({ lines: [STATUS_DEF[s] || s] }));
  return e;
}
function groupEl(title, sub, list, emptyMsg, band) {
  const el = H('div', { class: 'card scn-grp' }, H('div', { class: 'scn-gt' }, H('h2', { text: title }), H('span', { class: 'muted', text: `${list.length} benchmark${list.length === 1 ? '' : 's'}` })), H('div', { class: 'sub', text: sub }));
  const rows = [];
  if (band !== undefined) rows.push(H('tr', {}, H('td', {}, H('b', { text: 'Strongest bot’s win rate' })), H('td', { class: 'num', colSpan: 2, text: band ? `${Math.round(band.lo * 100)}% to ${Math.round(band.hi * 100)}%` : 'not set yet' }),
    H('td', { class: 'muted', text: 'Set by the designer only' }), H('td', {}), H('td', { class: 'muted', text: 'none' })));
  for (const c of list) {
    const b = fmtBand(c);
    const raw = c.value != null && (c.quantity === 'horizon50' || c.quantity === 'horizon80') ? fmtDur(toMin(c, c.value)) : c.quantity === 'milestone' && c.value != null ? fmtWhen(c.value) : null;
    const tg = c.targetId ? targetById.get(c.targetId) : null;
    const tgEl = !c.targetId ? H('span', { class: 'muted', text: 'no target yet' })
      : tg ? H('button', { class: 'chip lnk', text: c.targetId, title: 'Open in the Targets tab', onclick: () => { showTab('tgt'); setTF({ q: c.targetId, type: '', role: '', policy: '' }); } })
        : H('span', { class: 'chip', text: c.targetId, title: 'This id is not in the targets list' });
    rows.push(H('tr', {},
      H('td', {}, H('div', { text: c.label }), c.date != null && c.quantity !== 'milestone' ? H('div', { class: 'muted', text: fmtWhen(c.date) }) : c.quantity === 'interval' ? H('div', { class: 'muted', text: `${MS_NAME[c.from] || c.from} to ${MS_NAME[c.milestone] || c.milestone}` }) : null, c.notes ? H('div', { class: 'muted', text: c.notes }) : null),
      H('td', { class: 'num' }, c.value != null ? fmtNum(c, c.value) : '—', raw ? H('div', { class: 'muted', text: raw }) : null),
      H('td', { class: 'num' }, b ? b : H('span', { class: 'muted', text: 'no range' }), b ? H('div', { class: 'muted', text: c.bandFrom === 'source' ? 'from the source' : c.bandFrom === 'designer' ? 'designer’s' : '' }) : null),
      H('td', { text: c.unit }),
      H('td', { class: 'src', title: c.sourceRef }, H('div', { text: c.source }), H('div', { class: 'ref', text: c.sourceRef })),
      H('td', {}, statusChip(c.status)),
      H('td', {}, tgEl)));
  }
  if (!rows.length) { el.append(H('div', { class: 'empty', text: emptyMsg })); return el; }
  el.append(H('div', { class: 'tablewrap' }, H('table', { class: 'dt' }, H('thead', {}, H('tr', {}, ['Benchmark', 'Value', 'Range', 'Unit', 'Source', 'Status', 'Target'].map((t, i) => H('th', { class: i === 1 || i === 2 ? 'num' : '', style: { cursor: 'default' }, text: t })))), H('tbody', {}, rows))));
  return el;
}
renderers.scn = renderScenarios;
