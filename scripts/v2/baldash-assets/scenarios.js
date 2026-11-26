// ================================================================ TAB 4: SCENARIOS
// Reads D.scenarios (balance/scenarios.ts: TIMELINES, ALIGNMENT_LEVELS, CHECKPOINTS). Appended to client.js by baldash.ts.
const SC = D.scenarios || { timelines: [], levels: [], checkpoints: [] };
const LIVE = D.live || null; // set by --scenarios-live: the timeline layer comes from a running forecast job (baldash-live.ts)
// The timeline layer can be cut three ways (live builds that found the files): by AC date, by SAR date, or as a 3x3 matrix.
// BASE_CPS (history, alignment) never changes; useLayer() swaps in one split's timeline checkpoints and texts.
const BASE_CPS = (SC.checkpoints || []).filter((c) => c.layer !== 'timeline');
const SPLIT_NAME = { ac: 'Coder date', sar: 'SAR date', matrix: 'Coder × takeoff' };
const SPLIT_WHAT = { ac: 'when AI first codes better than any human (AC)', sar: 'when AI first does AI research better than any human (SAR)' };
const LAYERS = { ac: { timelines: SC.timelines || [], cps: (SC.checkpoints || []).filter((c) => c.layer === 'timeline'), clusterN: LIVE ? LIVE.clusterN || {} : {} } };
if (LIVE && LIVE.sar) LAYERS.sar = { timelines: LIVE.sar.timelines, cps: LIVE.sar.checkpoints, clusterN: LIVE.sar.clusterN || {} };
const MATRIX = LIVE && LIVE.matrix && LIVE.matrix.cells ? LIVE.matrix : null;
const SPLITS = ['ac', ...(LAYERS.sar ? ['sar'] : []), ...(MATRIX ? ['matrix'] : [])];
// The designer chose the SAR-date split: a live build opens on it (the other cuts stay one click away).
let SPLIT = LAYERS.sar ? 'sar' : 'ac', LAST_1D = SPLIT;
let CPS = [...BASE_CPS, ...LAYERS[SPLIT].cps];
let CUR_N = LAYERS[SPLIT].clusterN;
const NOW = 2026.9; // "late 2026": the end of the shared history
const TL_ORDER = ['fast', 'central', 'slow'];
const TL_FALLBACK = { fast: 'Fast', central: 'Central', slow: 'Slow' };
// Fixed timeline colours: categorical slots 1-3, checked together with validate_palette.js --pairs all (both modes).
const TL_COLOR = { fast: 'var(--s2)', central: 'var(--s1)', slow: 'var(--s3)' };
const pickTimelines = (list) => TL_ORDER.map((id) => (list || []).find((t) => t.id === id) || { id, name: TL_FALLBACK[id], sourceModel: '', summary: '' });
let TIMELINES = pickTimelines(LAYERS[SPLIT].timelines);
function useLayer(id) { const L = LAYERS[id]; CPS = [...BASE_CPS, ...L.cps]; TIMELINES = pickTimelines(L.timelines); CUR_N = L.clusterN; }
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
const isDist = (c) => c.p10 != null || c.p90 != null || c.neverBy2100 != null; // a distribution: p25 to p75 is lo to hi, p10 to p90 the outer band
const isTed = (c) => c.layer === 'timeline' && String(c.id).endsWith('.TED-AI');
const fmtShare = (f) => `${+(f * 100).toPrecision(2)}%`;
const fmtBand = (c) => (c.lo != null && c.hi != null ? `${fmtNum(c, c.lo)} to ${fmtNum(c, c.hi)}` : isDist(c) && c.lo != null ? `${fmtNum(c, c.lo)} and above` : null);
/** The outer band and the never-reached share of a distribution, as text; `f` formats one number. */
function fmtWide(c, f) {
  if (!isDist(c)) return null;
  const wide = c.p10 != null || c.p90 != null ? `${c.p10 != null ? f(c.p10) : 'below the chart'} to ${c.p90 != null ? f(c.p90) : 'beyond the chart or never'}` : null;
  const never = c.neverBy2100 > 0.0005 ? `${fmtShare(c.neverBy2100)} of samples do not reach it by 2100` : null;
  return [wide, never].filter(Boolean).join('; ');
}
function valueText(c) { // the headline reading of one checkpoint
  if (c.value == null && c.lo == null) return 'no value yet';
  const v = c.value != null ? c.value : null;
  if (c.quantity === 'milestone' || isTed(c)) return fmtWhen(v);
  if (c.quantity === 'horizon50' || c.quantity === 'horizon80') return v != null ? fmtDur(toMin(c, v)) : 'range only';
  if (c.unit === 'fraction') return fmtNum(c, v);
  return v != null ? `${fmtNum(c, v)} ${c.unit}` : 'range only';
}

// ---- the three timeline charts share one time axis
const PLOTTED = new Set(['horizon50', 'horizon80', 'worldCompute', 'milestone', 'interval']);
const TIME_CAP = 2060; // the long tails (the 2070s, 2100+) would squash everything else: the axis stops here and later dates get an arrow
const timeRange = (() => {
  const ys = [NOW];
  let over = false; // some date lies beyond the cap
  const add = (v) => { if (v == null) return; if (v > TIME_CAP) over = true; else ys.push(v); };
  for (const c of CPS) if (PLOTTED.has(c.quantity) || c.series || isTed(c)) { add(c.date); if (c.quantity === 'milestone' || isTed(c)) for (const v of [c.value, c.lo, c.hi, c.p10, c.p90]) add(v); }
  let lo = Math.floor(Math.min(...ys) - 0.01), hi = TIME_CAP; // the axis always runs to the cap, so charts of different builds line up
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
  if (c.quantity !== 'milestone' && c.date != null) lines.push(['When', c.series || c.date % 1 === 0 ? String(Math.round(c.date)) : fmtWhen(c.date)]);
  const hz = c.quantity === 'horizon50' || c.quantity === 'horizon80';
  const dist = isDist(c), yearly = c.quantity === 'milestone' || isTed(c);
  const f1 = hz ? (v) => fmtDur(toMin(c, v)) : yearly ? fmtWhen : (v) => fmtNum(c, v);
  const b = c.lo != null && c.hi != null ? `${f1(c.lo)} to ${f1(c.hi)}` : dist && c.lo != null ? `${f1(c.lo)} and above (the upper end is off the chart)` : null;
  if (b) lines.push([dist ? 'Middle half of this group’s runs (p25 to p75)' : 'Range', dist ? b : `${b}. ${BAND_DEF[c.bandFrom] || ''}`]);
  if (dist) lines.push(['Wider range (p10 to p90)', fmtWide(c, f1)]);
  lines.push(['Source', c.source || '—']);
  if (c.sourceRef) lines.push(['Reference', c.sourceRef]);
  lines.push(['Status', STATUS_NAME[c.status] + (c.status === 'sourced' ? '' : ` (hollow marker). ${STATUS_DEF[c.status]}`)]);
  if (c.notes) lines.push(['Note', c.notes]);
  lines.push(['Target', c.targetId ? c.targetId : 'none yet']);
  const raw = c.value != null && (c.quantity === 'horizon50' || c.quantity === 'horizon80') ? ` (${fmtCompact(toMin(c, c.value))} min)` : '';
  return { title: c.label, rows: [{ c: color, v: valueText(c) + raw, n: dist ? who + ' (median)' : who, hl: true }], lines };
}
const markerAttrs = (color, hollow) => (hollow ? { fill: 'var(--surface)', stroke: color, 'stroke-width': 2 } : { fill: color, stroke: 'var(--surface)', 'stroke-width': 2 });

/** Frame shared by the three charts: surface, history wash, year grid, "now" marker. Returns helpers. */
function timeFrame(host, o) {
  clear(host);
  const W = Math.max(host.clientWidth || 900, o.minW || 640), L = o.L || 92, R = o.R || 104, top = 24, bot = 26, ph = o.ph;
  const [x0, x1] = o.range || timeRange, xs = (y) => L + ((y - x0) / (x1 - x0)) * (W - L - R);
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

/** A linear value axis (for quantities already in powers of ten, like effective compute). Returns the y scale. */
function linAxis(f, ymin, ymax, fmt) {
  const raw = (ymax - ymin) / 5, pow = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  const ys = (v) => f.top + f.ph * (1 - (v - ymin) / (ymax - ymin));
  for (let v = Math.ceil(ymin / step - 1e-9) * step; v <= ymax + 1e-9; v += step) {
    f.svg.append(S('line', { x1: f.L, x2: f.W - f.R, y1: ys(v), y2: ys(v), stroke: 'var(--grid)', 'stroke-width': 1 }));
    f.svg.append(S('text', { x: f.L - 8, y: ys(v) + 4, 'text-anchor': 'end', class: 't-muted' }, fmt(v)));
  }
  f.svg.append(S('line', { x1: f.L, x2: f.L, y1: f.top, y2: f.top + f.ph, stroke: 'var(--axis)', 'stroke-width': 1 }));
  return ys;
}
/** A small arrow at (x, y) pointing up, down, or right: "the range continues beyond the chart". */
function arrowMark(dir, x, y, color) {
  const d = dir === 'up' ? `${x - 4},${y + 6} ${x + 4},${y + 6} ${x},${y}` : dir === 'down' ? `${x - 4},${y - 6} ${x + 4},${y - 6} ${x},${y}` : `${x - 6},${y - 4} ${x - 6},${y + 4} ${x},${y}`;
  return S('polygon', { points: d, style: `fill:${color};opacity:0.85` });
}

/**
 * Time chart: history points, then one series per timeline (the three are nudged sideways so they do not overlap).
 * A source distribution is drawn as two bands: p25 to p75 (darker) and p10 to p90 (lighter). A band whose upper end is
 * off the scale is cut at the top of the chart and ends in an arrow; a missing upper percentile counts as off the scale.
 * Options: key (quantity), pick (instead of key), hist (which history rows to show), conv, ticks, linear {fmt}, shared (one input line).
 */
function timeLogChart(host, o) {
  const pickHist = o.hist || ((c) => c.layer === 'history' && c.quantity === o.key);
  const pickTl = o.pick || ((c) => c.quantity === o.key);
  const mk = (c) => {
    const cv = (v) => (v == null ? null : o.conv(c, v));
    const src = c.bandFrom !== 'none', lo = src ? cv(c.lo) : null, y = cv(c.value);
    const open = src && lo != null && c.hi == null && isDist(c); // the upper end was left out: off the scale
    const hi = open ? Infinity : src ? cv(c.hi) : null;
    const p10 = src ? cv(c.p10) : null, p90 = src && isDist(c) && (hi != null) ? (c.p90 == null ? Infinity : cv(c.p90)) : null;
    const ok = lo != null && (o.linear ? true : lo > 0) && hi != null && (hi > 0); // a range with no central value is drawn as a bar only
    const mid = y != null && (o.linear || y > 0) ? y : ok && isFinite(hi) ? (o.linear ? (lo + hi) / 2 : Math.sqrt(lo * hi)) : null;
    return { c, x: c.date, y: mid != null && y != null ? y : null, lo: ok ? lo : null, hi: ok ? hi : null, p10: ok ? p10 : null, p90: ok ? p90 : null, mid };
  };
  const take = (pred) => CPS.filter((c) => pred(c) && c.date != null).map(mk).filter((p) => p.mid != null).sort((a, b) => a.x - b.x);
  const hist = take((c) => pickHist(c) && c.id !== 'H5.gpath.slope');
  const series = o.shared
    ? [{ id: 'shared', name: 'Model input, the same in all three timelines', short: 'Model input', color: 'var(--ink)', dodge: 0, pts: take((c) => pickTl(c) && c.layer === 'timeline' && c.timeline === 'central') }]
    : TIMELINES.map((t, i) => ({ id: t.id, name: t.name, short: tlShort(t.id), color: TL_COLOR[t.id], dodge: (i - 1) * 6, pts: take((c) => pickTl(c) && c.layer === 'timeline' && c.timeline === t.id) }));
  const all = [...hist, ...series.flatMap((s) => s.pts)];
  // these charts end a year after their last point (the milestone chart keeps the long axis)
  const last = all.length ? Math.max(...all.map((p) => p.x)) : timeRange[0] + 5;
  const f = timeFrame(host, { ph: 240, aria: o.aria, range: [timeRange[0], Math.min(TIME_CAP, Math.max(Math.ceil(last) + 1, timeRange[0] + 5))] });
  if (!all.length) {
    logAxis(f, o.ticks(o.dom[0], o.dom[1]), o.dom[0], o.dom[1]);
    emptyNote(f, 'No benchmarks for this chart yet.');
    f.finish();
    return;
  }
  // Scale: the centres set it; the bands above the top are cut (arrow), so a huge tail cannot squash the rest.
  const centres = all.map((p) => p.mid), lows = all.flatMap((p) => [p.mid, p.lo, p.p10]).filter((v) => v != null && (o.linear || v > 0));
  const histHi = hist.flatMap((p) => [p.hi]).filter((v) => v != null && isFinite(v));
  let ymin, ymax, ys;
  if (o.linear) {
    ymin = Math.floor(Math.min(...lows) - 1); ymax = Math.ceil(Math.max(...centres, ...histHi) * 1.04 + 1);
    ys = linAxis(f, ymin, ymax, o.linear.fmt);
  } else {
    ymin = Math.min(...lows) / 1.5; ymax = Math.max(...centres, ...histHi) * 1.8;
    const lg = logAxis(f, o.ticks(ymin, ymax), ymin, ymax);
    ys = lg;
  }
  const Y = (v) => ys(Math.min(Math.max(v, ymin), ymax));
  const topY = f.top;
  const marks = [], hits = [];
  const drawSet = (pts, color, dodge, noRibbon) => {
    // shaded ribbons through each run of 2+ neighbouring source ranges: the wide one (p10 to p90) first, then p25 to p75
    const runsOf = (keep) => {
      const out = []; let cur = [];
      for (const p of pts) { if (p.lo != null && p.c.bandFrom === 'source' && keep(p)) cur.push(p); else { if (cur.length) out.push(cur); cur = []; } }
      if (cur.length) out.push(cur);
      return out.filter((r) => r.length >= 2);
    };
    const poly = (r, up, dn, op) => f.svg.append(S('polygon', { points: r.map((p) => `${f.xs(p.x) + dodge},${Y(up(p))}`).concat(r.slice().reverse().map((p) => `${f.xs(p.x) + dodge},${Y(dn(p))}`)).join(' '), style: `fill:${color};opacity:${op}` }));
    // a ribbon is drawn only for a series whose bands all fit on the chart; a cut band is shown by its whisker and arrow alone
    if (!noRibbon) {
      if (!pts.some((p) => p.p90 > ymax)) for (const r of runsOf((p) => p.p10 != null && p.p90 != null)) poly(r, (p) => p.p90, (p) => p.p10, 0.08);
      if (!pts.some((p) => p.hi > ymax)) for (const r of runsOf((p) => true)) poly(r, (p) => p.hi, (p) => p.lo, 0.16);
    }
    for (const p of pts) if (p.lo != null) {
      const x = f.xs(p.x) + dodge, src = p.c.bandFrom === 'source';
      const bar = (a, b, w, op) => {
        const st = `stroke:${color};stroke-width:${w};opacity:${op}`, top = b > ymax, bot = a < ymin;
        f.svg.append(S('line', { x1: x, x2: x, y1: Y(b), y2: Y(a), style: st }));
        f.svg.append(top ? arrowMark('up', x, topY, color) : S('line', { x1: x - 3, x2: x + 3, y1: Y(b), y2: Y(b), style: st }));
        f.svg.append(bot ? arrowMark('down', x, f.top + f.ph, color) : S('line', { x1: x - 3, x2: x + 3, y1: Y(a), y2: Y(a), style: st }));
      };
      if (p.p10 != null) bar(p.p10, p.p90 != null ? p.p90 : p.hi, 1, 0.35);
      bar(p.lo, p.hi, 1.5, src ? 0.75 : 0.45);
    }
  };
  for (const s of series) if (s.pts.length) {
    drawSet(s.pts, s.color, s.dodge);
    const line = s.pts.filter((p) => p.y != null);
    if (line.length > 1) f.svg.append(S('polyline', { points: line.map((p) => `${f.xs(p.x) + s.dodge},${Y(p.y)}`).join(' '), fill: 'none', style: `stroke:${s.color};stroke-width:2`, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  }
  drawSet(hist, 'var(--ink)', 0, true); // measured points are separate readings: whiskers, no ribbon
  const addMarks = (pts, color, who, dodge) => {
    for (const p of pts) {
      const x = f.xs(p.x) + dodge, y = Y(p.mid);
      const m = S('circle', Object.assign({ cx: x, cy: y, r: p.y != null ? 4.5 : 0 }, markerAttrs(color, hollowOf(p.c))));
      const hit = S('circle', { cx: x, cy: y, r: 10, class: 'hit', tabindex: '0' });
      const get = () => cpTip(p.c, color, who);
      hit.setAttribute('aria-label', tipText(get()));
      bindTip(hit, get, p.y != null ? { on: () => m.setAttribute('r', 6), off: () => m.setAttribute('r', 4.5) } : undefined);
      marks.push(m); hits.push(hit);
    }
  };
  addMarks(hist, 'var(--ink)', 'Measured', 0);
  for (const s of series) addMarks(s.pts, s.color, s.name, s.dodge);
  f.svg.append(...marks);
  // direct labels at the right-hand end of each series; skipped (the legend carries them) if two would touch
  const placed = [];
  for (const s of series) {
    const line = s.pts.filter((p) => p.y != null);
    if (!line.length) continue;
    const p = line[line.length - 1], x = f.xs(p.x) + s.dodge + 9, y = Y(p.y) + 4;
    if (placed.some((q) => Math.abs(q.y - y) < 13 && Math.abs(q.x - x) < 80)) continue;
    placed.push({ x, y });
    f.svg.append(S('text', { x, y, class: 't-ink', style: 'font-weight:600' }, s.short));
  }
  f.finish();
  f.svg.append(...hits);
}

/** Milestone chart: one block per timeline, one lane per milestone. Each lane is a box plot of the model's samples:
 *  whiskers p10 to p90, box p25 to p75, dot at the median. The axis stops at TIME_CAP; later ends get an arrow and a label. */
const LANES = [['SC', 'SC'], ['SAR', 'SAR'], ['SIAR', 'SIAR'], ['TED-AI', 'TED-AI'], ['ASI', 'ASI']];
const LANE_NAME = Object.assign({ 'TED-AI': 'Top-human-expert-dominating AI' }, MS_NAME);
const LANE_DEF = Object.assign({ 'TED-AI': 'TED-AI: the AI Futures Model’s name for an AI that does every thinking task at least as well as the top human experts. The game has no matching milestone, so it is shown for reference.' }, MS_DEF);
function milestoneChart(host) {
  const LH = 24, HEAD = 28, GUT = 66;
  const find = (t, k) => CPS.find((c) => c.layer === 'timeline' && c.timeline === t.id && (k === 'TED-AI' ? isTed(c) : c.quantity === 'milestone' && c.milestone === k) && c.value != null);
  const rowH = HEAD + LANES.length * LH + 8;
  const f = timeFrame(host, { ph: rowH * TIMELINES.length, aria: 'Milestone dates by timeline, with the spread of the model’s samples', R: GUT + 140 });
  const { xs, x1 } = f, xEnd = xs(x1), hits = [];
  const X = (v) => xs(Math.min(v, x1));
  TIMELINES.forEach((t, i) => {
    const y0 = f.top + i * rowH, color = TL_COLOR[t.id];
    if (i) f.svg.append(S('line', { x1: 0, x2: f.W, y1: y0, y2: y0, stroke: 'var(--grid)', 'stroke-width': 1 }));
    f.svg.append(S('circle', { cx: 8, cy: y0 + 16, r: 4.5, style: `fill:${color}` }), S('text', { x: 20, y: y0 + 20, class: 't-ink', style: 'font-weight:600' }, tlShort(t.id)));
    if (LIVE) { // interim data: say how many runs stand behind the block, and flag a thin one
      const n = CUR_N[t.id] || 0;
      f.svg.append(S('text', { x: xEnd + GUT, y: y0 + 20, class: n < 30 ? 't-ink' : 't-muted', style: 'font-size:11px' }, n === 0 ? 'no runs yet' : n < 30 ? `only ${n} run${n === 1 ? '' : 's'}: rough` : `${n} runs`));
    }
    LANES.forEach(([k], j) => {
      const c = find(t, k), cy = y0 + HEAD + j * LH + LH / 2, dim = k === 'TED-AI';
      f.svg.append(S('text', { x: f.L - 8, y: cy + 4, 'text-anchor': 'end', class: dim ? 't-muted' : 't-ink' }, k));
      if (!c) { f.svg.append(S('text', { x: Math.max(f.L + 8, xs(NOW) + 8), y: cy + 4, class: 't-muted' }, LIVE ? 'no date yet: this group has not reached it' : 'no date yet')); return; }
      const op = dim ? 0.7 : 1;
      const p10 = c.p10 ?? c.lo ?? c.value, p90 = c.p90 ?? null, lo = c.lo ?? c.value, hi = c.hi ?? null;
      const farEnd = p90 == null ? Infinity : p90; // a missing p90 is "never reached" by the share beyond the box
      const g = S('g', { style: `opacity:${op}` });
      g.append(S('line', { x1: X(p10), x2: X(farEnd), y1: cy, y2: cy, style: `stroke:${color};stroke-width:1.5;opacity:0.55` }));
      g.append(S('line', { x1: X(p10), x2: X(p10), y1: cy - 5, y2: cy + 5, style: `stroke:${color};stroke-width:1.5;opacity:0.75` }));
      if (farEnd <= x1) g.append(S('line', { x1: X(farEnd), x2: X(farEnd), y1: cy - 5, y2: cy + 5, style: `stroke:${color};stroke-width:1.5;opacity:0.75` }));
      const bx = X(lo), bw = Math.max(3, X(hi == null ? Infinity : hi) - bx);
      g.append(S('rect', { x: bx, y: cy - 7, width: bw, height: 14, rx: 2, style: `fill:${color};fill-opacity:0.35;stroke:${color};stroke-width:1` }));
      const m = S('circle', Object.assign({ cx: X(c.value), cy, r: 5.5 }, markerAttrs(color, hollowOf(c))));
      g.append(m);
      // an end beyond the axis: arrow at the edge and the label just outside it
      const beyond = farEnd > x1 || c.value > x1 || (hi != null && hi > x1);
      if (beyond) {
        g.append(arrowMark('right', xEnd, cy, color));
        g.append(S('text', { x: xEnd + 9, y: cy + 4, class: 't-muted', style: 'font-size:11px' }, p90 == null ? 'p90 never' : farEnd > x1 ? `p90 ${Math.round(farEnd)}` : String(Math.round(c.value))));
      }
      f.svg.append(g);
      // the median and the share that never arrives, in the right-hand column
      f.svg.append(S('text', { x: xEnd + GUT, y: cy + 4, class: dim ? 't-muted' : 't-ink', style: 'font-size:11px' }, c.value.toFixed(1)));
      if (c.neverBy2100 > 0.0005) f.svg.append(S('text', { x: xEnd + GUT + 40, y: cy + 4, class: 't-muted', style: 'font-size:11px' }, `${fmtShare(c.neverBy2100)} not by 2100`));
      const a = Math.min(X(p10), bx) - 4, b = Math.max(X(farEnd), bx + bw) + 4;
      const hit = S('rect', { x: a, y: cy - 10, width: Math.max(12, b - a), height: 20, class: 'hit', tabindex: '0' });
      const get = () => { const tp = cpTip(c, color, t.name); tp.lines.unshift(['What', LANE_DEF[k] || '']); return tp; };
      hit.setAttribute('aria-label', tipText(get()));
      bindTip(hit, get, { on: () => m.setAttribute('r', 7), off: () => m.setAttribute('r', 5.5) });
      hits.push(hit);
    });
  });
  f.svg.append(S('text', { x: xEnd + GUT, y: f.top - 4, class: 't-muted', style: 'font-size:11px' }, 'median'), S('text', { x: xEnd + GUT + 40, y: f.top - 4, class: 't-muted', style: 'font-size:11px' }, 'not by 2100'));
  f.finish();
  f.svg.append(...hits);
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
    H('span', { class: 'it', tabindex: '0' }, sw('mk-hist'), 'Measured history'), H('span', { class: 'it', tabindex: '0' }, sw('mk-hollow'), 'Unsure or proposed'), H('span', { class: 'it', tabindex: '0' }, sw('mk-band'), 'Range given by the source'),
    H('span', { class: 'it', tabindex: '0' }, sw('mk-band2'), 'Model samples: dark = middle half of this group’s runs (p25 to p75), light = p10 to p90'), H('span', { class: 'it', tabindex: '0' }, sw('mk-arrow'), 'Arrow: the range goes past the edge of the chart'), H('span', { class: 'it' }, H('span', { class: 'tk' }), 'Now (late 2026)'));
}

/** Banner of a live build: how far the forecast jobs are, when the clusters were last rebuilt. */
function liveBanner() {
  const st = LIVE.status;
  if (!st) return H('div', { class: 'scn-live warn', role: 'status' }, H('b', { text: 'Interim: no status file found, so the number of forecast runs is unknown.' }));
  const total = st.requested || 3000, n = st.clusterSamples != null ? st.clusterSamples : st.samples;
  const when = st.clustersUpdatedAt || st.updatedAt, t = new Date(when);
  const hhmm = isNaN(t) ? '?' : t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const jobs = Object.entries(st.jobs || {}).map(([k, v]) => `${k} ${v}`).join(', ');
  const failed = (st.clusterSamples != null ? st.clusterSamples - (st.clusterOk || 0) : st.failedSoFar) || 0;
  const head = st.final ? `Final: all ${total.toLocaleString('en-US')} forecast runs are in, updated ${hhmm}. Clusters are settled.`
    : `Interim: ${n.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} forecast runs, updated ${hhmm}. Clusters still moving.`;
  const stale = !st.final && !isNaN(t) && Date.now() - t.getTime() > 20 * 60000;
  const detail = `${(st.clusterOk != null ? st.clusterOk : st.okSoFar || 0).toLocaleString('en-US')} usable, ${failed.toLocaleString('en-US')} failed and left out. Jobs: ${jobs || 'none'}. ` + (st.final ? 'The timelines below are slices of these runs; choose how they are cut under "Split by". This page does not refresh itself.' : 'The timelines below are slices of the runs so far, and the page reloads itself every minute.');
  return H('div', { class: 'scn-live' + (st.final ? ' final' : ''), role: 'status' }, H('b', { text: head }), H('div', { class: 'muted', text: detail }),
    stale ? H('div', { class: 'warnx', text: 'This build is more than 20 minutes old: the rebuild loop may have stopped.' }) : null);
}

// ---- "Split by" switch and the separation readout
const SPLIT_HELP = {
  ac: 'The runs are ranked by the date AI first codes better than any human (AC). Fast = the 20th to 30th percentile, central = 45th to 55th, slow = 70th to 80th.',
  sar: 'The runs are ranked by the date AI first does AI research better than any human (SAR). Fast = the 20th to 30th percentile, central = 45th to 55th, slow = 70th to 80th. A run that never reaches SAR counts as later than all the others.',
  matrix: 'All usable runs are sorted into thirds by AC date (early, middle, late coder). Inside each third they are sorted into thirds again by takeoff speed: the years from AC to ASI (a run that never reaches ASI counts as slowest). Every cell holds about a ninth of the runs.',
};
/** For one split: per milestone lane, how the p25-p75 boxes of neighbouring groups sit. a = earlier group, b = later group. */
function separation(layerId) {
  const L = LAYERS[layerId], tls = pickTimelines(L.timelines);
  const find = (t, k) => L.cps.find((c) => c.timeline === t.id && (k === 'TED-AI' ? isTed(c) : c.quantity === 'milestone' && c.milestone === k) && c.value != null);
  return LANES.map(([k]) => {
    const pair = (ta, tb) => {
      const a = find(ta, k), b = find(tb, k);
      if (!a || !b) return { none: true };
      const aHi = a.hi == null ? Infinity : a.hi, bHi = b.hi == null ? Infinity : b.hi, bLo = b.lo ?? b.value;
      const gap = bLo - aHi;
      if (gap > 0) return { sep: true, years: gap };
      const ov = Math.min(aHi, bHi) - bLo;
      return { sep: false, years: isFinite(ov) ? ov : null };
    };
    return { k, fc: pair(tls[0], tls[1]), cs: pair(tls[1], tls[2]) };
  });
}
const sepText = (p) => (p.none ? 'not reached' : p.sep ? `separate (${p.years.toFixed(1)} yr apart)` : `overlap (${p.years == null ? 'open-ended' : p.years.toFixed(1) + ' yr'})`);
function splitCard() {
  const seg = H('div', { class: 'seg-ctl', style: { marginLeft: '0' }, role: 'group', 'aria-label': 'Split by' },
    SPLITS.map((k) => H('button', { text: SPLIT_NAME[k], 'aria-pressed': String(SPLIT === k), onclick: () => setSplit(k) })));
  const chosen = LAYERS.sar ? H('span', { class: 'muted', style: { marginLeft: '10px' }, text: 'SAR date is the chosen split' + (SPLIT === 'sar' ? ' (shown)' : '') + '.' }) : null;
  const card = H('div', { class: 'card scn-splitcard' },
    H('div', { class: 'scn-h' }, H('h2', { text: 'Split by' }), seg, chosen),
    H('div', { class: 'sub', text: SPLIT_HELP[SPLIT] }));
  const ids = ['ac', ...(LAYERS.sar ? ['sar'] : [])];
  if (ids.length > 1 || SPLIT !== 'matrix') {
    const res = Object.fromEntries(ids.map((id) => [id, separation(id)]));
    const total = (id) => { let n = 0, sepN = 0; for (const r of res[id]) for (const p of [r.fc, r.cs]) if (!p.none) { n++; if (p.sep) sepN++; } return `${sepN} of ${n}`; };
    const rows = LANES.map(([k], i) => H('tr', {}, H('td', {}, H('b', { text: k }), k === 'SC' ? H('span', { class: 'muted', text: ' (the model’s AC)' }) : null),
      ids.flatMap((id) => [res[id][i].fc, res[id][i].cs].map((p) => H('td', { class: p.none ? 'muted' : p.sep ? 'scn-sep' : 'scn-ovl', text: sepText(p) })))));
    const head1 = H('tr', {}, H('th', { rowSpan: 2, text: 'Milestone', style: { cursor: 'default' } }), ids.map((id) => H('th', { colSpan: 2, class: id === SPLIT ? 'scn-cur' : '', style: { cursor: 'default' }, text: SPLIT_NAME[id] + (id === SPLIT ? ' (shown)' : '') })));
    const head2 = H('tr', {}, ids.flatMap(() => ['Fast and central', 'Central and slow'].map((t) => H('th', { style: { cursor: 'default' }, text: t }))));
    card.append(H('h3', { class: 'scn-sub-h', text: 'How much do the groups overlap?' }),
      H('div', { class: 'sub' }, 'For each milestone: do the middle-half boxes (p25 to p75 of each group’s own runs) of neighbouring groups overlap or stand apart? The good split is the one whose boxes stand apart for the most milestones. ',
        ids.map((id) => `${SPLIT_NAME[id]}: ${total(id)} neighbouring pairs separate. `).join('')),
      H('div', { class: 'tablewrap' }, H('table', { class: 'dt scn-seg' }, H('thead', {}, head1, head2), H('tbody', {}, rows))));
  }
  return card;
}

// ---- Inputs chart: the authors' fixed projection, shared by every scenario
const INPUT_LINES = [
  ['world_H100e', 'World AI compute', 'var(--s7)', 'All AI chips in the world.'],
  ['total_ai_company_H100e', 'All AI companies', 'var(--s8)', 'The chips owned by AI companies.'],
  ['experiment_H100e', 'Research experiments', 'var(--s4)', 'Compute the AI companies spend on research experiments.'],
  ['training_H100e', 'Frontier training', 'var(--s6)', 'Compute used to train the frontier model.'],
  ['inference_H100e', 'Inference', 'var(--s5)', 'Compute used to run AI models for users and for AI research labour.'],
];
const FIXED_NOTE = 'authors’ fixed projection (same in all scenarios)';
function inputsCard(inHost, lhHost) {
  const card = H('div', { class: 'card' }, H('h2', { text: 'What the model is given: computing power and human researchers' }),
    H('div', { class: 'sub' }, 'Inputs, not results: the AI Futures Model authors’ fixed projection, identical in every run and every split. Computing power is in ',
      infoTip('H100e: H100 equivalents, the standard unit of AI computing power.', 'H100 equivalents'), ' on a scale where each step up is ten times more. Dots are measured world computing power from the shared history.'));
  card.append(H('div', { class: 'legend scn-key' }, INPUT_LINES.map(([, name, color, tip]) => { const it = H('span', { class: 'it', tabindex: '0' }, H('span', { class: 'sw', style: { background: color } }), name); bindTip(it, () => ({ lines: [tip] })); return it; }),
    H('span', { class: 'it', tabindex: '0' }, H('span', { class: 'mk mk-hist' }), 'Measured world computing power')));
  card.append(H('div', { class: 'scn-inputs' },
    H('div', {}, H('div', { class: 'scn-ch' }, H('b', { text: 'Computing power (H100e)' }), H('span', { class: 'muted', text: ' ' + FIXED_NOTE })), inHost),
    H('div', {}, H('div', { class: 'scn-ch' }, H('b', { text: 'Human researchers' }), H('span', { class: 'muted', text: ' ' + FIXED_NOTE })), lhHost)));
  return card;
}
function inputsCharts(host, host2) {
  const IN = LIVE.inputs, T = IN.time, x0 = 2017, x1 = TIME_CAP;
  const idx = T.map((t, i) => i).filter((i) => T[i] >= x0 && T[i] <= x1 + 1e-9);
  const hist = BASE_CPS.filter((c) => c.layer === 'history' && c.quantity === 'worldCompute' && c.value != null && c.date != null);
  const decades = (lo, hi) => decadeTicks(lo, hi, (v) => fmtCompact(v));
  // --- chart 1: five compute lines on a log scale, plus the measured world points
  const vals = INPUT_LINES.flatMap(([k]) => idx.map((i) => IN.series[k][i])).concat(hist.flatMap((c) => [c.value, c.lo, c.hi].filter((v) => v != null && v > 0)));
  const ymin = Math.min(...vals) / 1.6, ymax = Math.max(...vals) * 1.6;
  const f = timeFrame(host, { ph: 300, aria: 'Computing power inputs over time, log scale', range: [x0, x1], R: 150, L: 64 });
  const ys = logAxis(f, decades(ymin, ymax), ymin, ymax);
  const xOf = (t) => f.xs(t);
  const ends = [];
  for (const [k, name, color] of INPUT_LINES) {
    const pts = idx.map((i) => `${xOf(T[i])},${ys(IN.series[k][i])}`).join(' ');
    f.svg.append(S('polyline', { points: pts, fill: 'none', style: `stroke:${color};stroke-width:2`, 'stroke-linejoin': 'round' }));
    ends.push({ name, color, y: ys(IN.series[k][idx[idx.length - 1]]) });
  }
  // direct labels at the right end, pushed apart so none touch
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].ly = Math.max(ends[i].y, (ends[i - 1].ly ?? ends[i - 1].y) + 14);
  ends[0].ly = ends[0].y;
  for (const e of ends) f.svg.append(S('text', { x: f.W - f.R + 8, y: (e.ly ?? e.y) + 4, style: `fill:${e.color};font-weight:600;font-size:12px` }, e.name));
  const hits = [];
  for (const c of hist) {
    const x = xOf(c.date), y = ys(Math.max(c.value, ymin));
    if (c.lo != null && c.hi != null && c.lo > 0) f.svg.append(S('line', { x1: x, x2: x, y1: ys(c.lo), y2: ys(c.hi), style: 'stroke:var(--ink);stroke-width:1.5;opacity:0.7' }));
    const m = S('circle', Object.assign({ cx: x, cy: y, r: 5 }, markerAttrs('var(--ink)', hollowOf(c))));
    f.svg.append(m);
    const hit = S('circle', { cx: x, cy: y, r: 10, class: 'hit', tabindex: '0' });
    const get = () => cpTip(c, 'var(--ink)', 'Measured');
    hit.setAttribute('aria-label', tipText(get()));
    bindTip(hit, get, { on: () => m.setAttribute('r', 6.5), off: () => m.setAttribute('r', 5) });
    hits.push(hit);
  }
  // hover columns: one per year, listing every line at that year
  const colW = (f.W - f.L - f.R) / (x1 - x0);
  for (const i of idx) {
    const t = T[i], r = S('rect', { x: xOf(t) - colW / 2, y: f.top, width: colW, height: f.ph, class: 'hit', fill: 'transparent', tabindex: '0' });
    const get = () => ({ title: `${Math.round(t)}: ${FIXED_NOTE}`, rows: INPUT_LINES.map(([k, name, color]) => ({ c: color, v: fmtCompact(IN.series[k][i]), n: name, raw: IN.series[k][i] })).sort((a, b) => b.raw - a.raw), lines: ['H100e: H100 equivalents.'] });
    r.setAttribute('aria-label', tipText(get()));
    bindTip(r, get);
    f.svg.append(r);
  }
  f.finish();
  f.svg.append(...hits);
  // --- chart 2: human researchers, its own unit and its own axis (never a second axis on chart 1)
  const lv = idx.map((i) => IN.series.L_HUMAN[i]);
  const lmin = Math.min(...lv) / 1.6, lmax = Math.max(...lv) * 1.6;
  const g = timeFrame(host2, { ph: 300, aria: 'Human researchers over time, log scale', range: [x0, x1], L: 56, R: 12, minW: 300 });
  const lys = logAxis(g, decades(lmin, lmax), lmin, lmax);
  g.svg.append(S('polyline', { points: idx.map((i) => `${g.xs(T[i])},${lys(IN.series.L_HUMAN[i])}`).join(' '), fill: 'none', style: 'stroke:var(--ink);stroke-width:2', 'stroke-linejoin': 'round' }));
  const lh = [];
  for (const i of idx) {
    const t = T[i], r = S('rect', { x: g.xs(t) - (g.W - g.L - g.R) / (x1 - x0) / 2, y: g.top, width: (g.W - g.L - g.R) / (x1 - x0), height: g.ph, class: 'hit', fill: 'transparent', tabindex: '0' });
    const get = () => ({ title: `${Math.round(t)}: ${FIXED_NOTE}`, rows: [{ c: 'var(--ink)', v: fmtCompact(IN.series.L_HUMAN[i]), n: 'Human researchers (the model’s L_HUMAN)' }] });
    r.setAttribute('aria-label', tipText(get()));
    bindTip(r, get);
    lh.push(r);
  }
  g.finish();
  g.svg.append(...lh);
}

// ---- Matrix view: coder date x takeoff speed
const COL_COLOR = { fast: 'var(--s2)', middle: 'var(--s1)', slow: 'var(--s3)' };
const COL_LABEL = { fast: 'Fast takeoff', middle: 'Middle takeoff', slow: 'Slow takeoff' };
const ROW_LABEL = { early: 'Early coder', middle: 'Middle coder', late: 'Late coder' };
const yrTxt = (v) => (v == null ? 'never' : v.toFixed(1));
const boxTxt = (q) => (q.p50 == null ? 'over half never' : `${yrTxt(q.p50)}`);
const rangeTxt = (q) => (q.p25 == null && q.p75 == null ? '' : `${q.p25 == null ? 'never' : yrTxt(q.p25)} to ${yrTxt(q.p75)}`);
const cellOf = (r, c) => MATRIX.cells.find((x) => x.row === r && x.col === c);
const gapKey = () => (MATRIX.definition && MATRIX.definition.gap_field) || 'gap_AC_ASI';
const gapTxt = (g) => (g.min == null ? 'never reaches ASI' : g.n_reached < 1 ? '' : `${g.min.toFixed(1)} to ${g.max.toFixed(1)} yr${g.p90 == null ? ' (some never)' : ''}`);
function matrixCards(chartHost) {
  const M = MATRIX, nPool = M.pool.n_ok_pooled;
  const card = H('div', { class: 'card' }, H('h2', { text: 'Coder date × takeoff speed' }),
    H('div', { class: 'sub' }, `${nPool.toLocaleString('en-US')} usable runs. Rows: when AI first codes better than any human (AC), in thirds. Columns: takeoff speed, the years from AC to ASI, in thirds within each row. Each cell shows the share of all runs, the median date with the middle half of its own runs (p25 to p75) in brackets, and how many runs never reach ASI by 2100.`));
  const grid = H('div', { class: 'scn-mx' });
  grid.append(H('div'));
  for (let j = 0; j < 3; j++) {
    const name = ['fast', 'middle', 'slow'][j], cells = [0, 1, 2].map((i) => cellOf(i, j)), gs = cells.map((c) => c[gapKey()]);
    const lo = Math.min(...gs.map((g) => g.min ?? Infinity)), hi = Math.max(...gs.map((g) => g.max ?? -Infinity));
    const someNever = cells.some((c) => c.milestones.ASI.n_reached < c.n);
    grid.append(H('div', { class: 'scn-mxh' }, H('span', { class: 'sw', style: { background: COL_COLOR[name] } }), H('b', { text: COL_LABEL[name] }),
      H('div', { class: 'muted', text: isFinite(lo) ? `AC to ASI: ${lo.toFixed(1)} to ${isFinite(hi) ? hi.toFixed(1) : '?'} yr${someNever ? ', or never' : ''}` : '' })));
  }
  for (let i = 0; i < 3; i++) {
    const r = M.rows[i];
    grid.append(H('div', { class: 'scn-mxr' }, H('b', { text: ROW_LABEL[r.name] }), H('div', { class: 'muted', text: r.date_min != null ? `AC ${r.date_min.toFixed(1)} to ${r.date_max.toFixed(1)}` : '' }), H('div', { class: 'muted', text: `${r.n} runs` })));
    for (let j = 0; j < 3; j++) {
      const c = cellOf(i, j), name = c.col_name;
      const never = c.frac_not_reached_by_2100;
      const line = (lab, q) => H('div', { class: 'scn-mxl' }, H('span', { class: 'k', text: lab }), H('b', { text: boxTxt(q) }), H('span', { class: 'muted', text: q.p50 == null ? '' : ` (${rangeTxt(q)})` }));
      const el = H('div', { class: 'scn-mxc', tabindex: '0', style: { borderTopColor: COL_COLOR[name] } },
        H('div', {}, H('span', { class: 'scn-mxn', text: fmtShare(c.share_of_pool) }), H('span', { class: 'muted', text: ` of all runs (${c.n})` })),
        line('SAR', c.milestones.SAR), line('ASI', c.milestones.ASI),
        H('div', { class: never > 0.005 ? 'scn-mxw' : 'muted', text: never > 0.005 ? `${fmtShare(never)} never reach ASI by 2100` : 'all reach ASI by 2100' }));
      bindTip(el, () => ({ title: `${ROW_LABEL[c.row_name]}, ${COL_LABEL[name].toLowerCase()}`, lines: [
        ['Runs', `${c.n}, ${fmtShare(c.share_of_pool)} of all`],
        ['AC', `${yrTxt(c.milestones.AC.p50)} (middle half ${rangeTxt(c.milestones.AC)}); all runs ${yrTxt(c.milestones.AC.min)} to ${yrTxt(c.milestones.AC.max)}`],
        ['SAR', `${yrTxt(c.milestones.SAR.p50)} (middle half ${rangeTxt(c.milestones.SAR)}); p10 to p90 ${yrTxt(c.milestones.SAR.p10)} to ${yrTxt(c.milestones.SAR.p90)}`],
        ['ASI', `${yrTxt(c.milestones.ASI.p50)} (middle half ${rangeTxt(c.milestones.ASI)}); p10 to p90 ${yrTxt(c.milestones.ASI.p10)} to ${yrTxt(c.milestones.ASI.p90)}`],
        ['AC to ASI', `median ${c[gapKey()].p50 == null ? 'never' : c[gapKey()].p50.toFixed(1) + ' yr'}; ${gapTxt(c[gapKey()])}`],
        ['Not reaching ASI by 2100', `${fmtShare(never)} (${fmtShare(c.frac_never_reached_asi)} never, even by 2200)`]] }));
      grid.append(el);
    }
  }
  card.append(grid);
  const chart = H('div', { class: 'card' }, H('h2', { text: 'When does each cell reach SAR and ASI?' }),
    H('div', { class: 'sub' }, 'Each cell has two lanes: SAR (AI that does AI research better than any human; hollow dot) and ASI (superintelligence; filled dot). The dot is the median date, the box holds the middle half of this cell’s runs (p25 to p75), the whiskers reach p10 and p90. The axis stops at ' + TIME_CAP + ': an arrow means the range goes further. Colour is takeoff speed, as in the grid.'),
    chartHost);
  return [card, chart];
}
function matrixChart(host) {
  const M = MATRIX, LH = 17, PAD = 14, GH = 38, rowH = 2 * LH + PAD;
  const f = timeFrame(host, { ph: 3 * (GH + 3 * rowH), aria: 'SAR and ASI dates of the nine coder-date and takeoff-speed cells', L: 150, R: 150 });
  const { xs, x1 } = f, xEnd = xs(x1), X = (v) => xs(Math.min(v, x1)), hits = [];
  for (let i = 0; i < 3; i++) {
    const g0 = f.top + i * (GH + 3 * rowH), r = M.rows[i];
    if (i) f.svg.append(S('line', { x1: 0, x2: f.W, y1: g0, y2: g0, stroke: 'var(--grid)', 'stroke-width': 1 }));
    f.svg.append(S('text', { x: 8, y: g0 + 16, class: 't-ink', style: 'font-weight:650' }, ROW_LABEL[r.name]), S('text', { x: 8, y: g0 + 31, class: 't-muted', style: 'font-size:11px' }, r.date_min != null ? `AC ${r.date_min.toFixed(1)} to ${r.date_max.toFixed(1)}` : ''));
    for (let j = 0; j < 3; j++) {
      const c = cellOf(i, j), color = COL_COLOR[c.col_name], y0 = g0 + GH + j * rowH;
      f.svg.append(S('text', { x: 20, y: y0 + LH + 3, class: 't-ink', style: 'font-size:12px' }, COL_LABEL[c.col_name].replace(' takeoff', '')));
      [['SAR', c.milestones.SAR], ['ASI', c.milestones.ASI]].forEach(([lab, q], k) => {
        const cy = y0 + k * LH + LH / 2 + 1;
        f.svg.append(S('text', { x: f.L - 8, y: cy + 4, 'text-anchor': 'end', class: 't-muted', style: 'font-size:11px' }, lab));
        if (q.p50 == null) { f.svg.append(S('text', { x: Math.max(f.L + 8, xs(NOW) + 8), y: cy + 4, class: 't-muted', style: 'font-size:11px' }, 'median: over half never reach it')); return; }
        const hi = q.p75 == null ? Infinity : q.p75, far = q.p90 == null ? Infinity : q.p90, solid = lab === 'ASI';
        const gEl = S('g', {});
        gEl.append(S('line', { x1: X(q.p10), x2: X(far), y1: cy, y2: cy, style: `stroke:${color};stroke-width:1.5;opacity:0.55` }));
        gEl.append(S('line', { x1: X(q.p10), x2: X(q.p10), y1: cy - 4, y2: cy + 4, style: `stroke:${color};stroke-width:1.5;opacity:0.75` }));
        if (far <= x1) gEl.append(S('line', { x1: X(far), x2: X(far), y1: cy - 4, y2: cy + 4, style: `stroke:${color};stroke-width:1.5;opacity:0.75` }));
        const bx = X(q.p25), bw = Math.max(3, X(hi) - bx);
        gEl.append(S('rect', { x: bx, y: cy - 6, width: bw, height: 12, rx: 2, style: `fill:${color};fill-opacity:${solid ? 0.45 : 0.2};stroke:${color};stroke-width:1` }));
        const m = S('circle', { cx: X(q.p50), cy, r: 4.5, fill: solid ? color : 'var(--surface)', stroke: solid ? 'var(--surface)' : color, 'stroke-width': 2 });
        gEl.append(m);
        const beyond = far > x1 || hi > x1 || q.p50 > x1;
        if (beyond) gEl.append(arrowMark('right', xEnd, cy, color));
        f.svg.append(gEl);
        f.svg.append(S('text', { x: xEnd + 14, y: cy + 4, class: 't-ink', style: 'font-size:11px' }, `${q.p50.toFixed(1)}`));
        if (lab === 'ASI') f.svg.append(S('text', { x: xEnd + 52, y: cy + 4, class: c.frac_not_reached_by_2100 > 0.005 ? 't-ink' : 't-muted', style: 'font-size:11px' }, c.frac_not_reached_by_2100 > 0.005 ? `${fmtShare(c.frac_not_reached_by_2100)} not by 2100` : ''));
        const a = Math.min(X(q.p10), bx) - 4, b = Math.max(X(far), bx + bw) + 4;
        const hit = S('rect', { x: a, y: cy - 8, width: Math.max(12, b - a), height: 16, class: 'hit', tabindex: '0' });
        const get = () => ({ title: `${lab}: ${ROW_LABEL[c.row_name].toLowerCase()}, ${COL_LABEL[c.col_name].toLowerCase()}`,
          rows: [{ c: color, v: yrTxt(q.p50), n: 'median', hl: true }],
          lines: [['Middle half of this cell’s runs (p25 to p75)', `${yrTxt(q.p25)} to ${yrTxt(q.p75)}`], ['Wider range (p10 to p90)', `${yrTxt(q.p10)} to ${yrTxt(q.p90)}`], ['Runs', `${c.n}, ${fmtShare(c.share_of_pool)} of all`]] });
        hit.setAttribute('aria-label', tipText(get()));
        bindTip(hit, get, { on: () => m.setAttribute('r', 6), off: () => m.setAttribute('r', 4.5) });
        hits.push(hit);
      });
    }
  }
  f.svg.append(S('text', { x: xEnd + 14, y: f.top - 4, class: 't-muted', style: 'font-size:11px' }, 'median'));
  f.finish();
  f.svg.append(...hits);
}

let scnDraw = null; // the current redraw; the one resize listener below calls it
window.addEventListener('resize', () => { if (scnDraw && !document.getElementById('p-scn').hidden) { clearTimeout(scnDraw.t); scnDraw.t = setTimeout(scnDraw, 120); } });
function setSplit(k) {
  SPLIT = k;
  if (k !== 'matrix') { LAST_1D = k; useLayer(k); }
  const y = window.scrollY;
  renderScenarios();
  window.scrollTo(0, y);
}

function renderScenarios() {
  const host = document.getElementById('p-scn');
  clear(host);
  if (LIVE) host.append(liveBanner());
  if (SPLITS.length > 1) host.append(splitCard());
  const nBy = (s) => CPS.filter((c) => c.status === s).length;
  const nTgt = CPS.filter((c) => c.targetId).length;
  // ---- 1. intro, legend of the three timelines
  const intro = H('div', { class: 'card' }, H('h2', { text: 'Three possible futures, one shared past' }),
    H('div', { class: 'sub', text: CPS.length ? `${CPS.length} benchmarks: ${nBy('sourced')} sourced, ${nBy('unsure')} unsure, ${nBy('proposed')} proposed, ${nBy('blank')} still to be filled. ${nTgt} already have a target in the targets list.` : 'No benchmarks have been entered yet, so the charts below are empty frames. The levels and the grid still show their structure.' }));
  intro.append(H('div', { class: 'scn-tls' }, TIMELINES.map((t) => H('div', { class: 'scn-tl', tabindex: '0' },
    H('div', { class: 'scn-tl-h' }, H('span', { class: 'sw', style: { background: TL_COLOR[t.id] } }), H('b', { text: t.name })),
    H('div', { class: 'muted', text: t.sourceModel || 'source model not named yet' }), H('div', { text: t.summary || '' })))));
  intro.append(keyRow());
  if (SPLIT !== 'matrix') host.append(intro);

  // ---- 2. the three charts, one time axis
  const h50 = CPS.filter((c) => c.quantity === 'horizon50').length, h80 = CPS.filter((c) => c.quantity === 'horizon80').length;
  const view = { h: h50 >= h80 ? 'horizon50' : 'horizon80' };
  const hHost = H('div', { class: 'chart' }), wHost = H('div', { class: 'chart' }), mHost = H('div', { class: 'chart' });
  const uHost = H('div', { class: 'chart' }), eHost = H('div', { class: 'chart' }), tHost = H('div', { class: 'chart' });
  const hSub = subEl(), seg = H('div', { class: 'seg-ctl', style: { marginLeft: '0' } });
  const hBtns = [['horizon50', 'Half the time'], ['horizon80', 'Four times in five']].map(([k, t]) => H('button', { text: t, 'aria-pressed': String(view.h === k), onclick: () => { view.h = k; draw(); } }));
  seg.append(...hBtns);
  const hCard = scnCard('How long a task can the best AI do on its own?', hSub, seg);
  hCard.append(hHost);
  const wCard = scnCard('How much computing power does the world have?', subEl('Total AI computing in the world, counted in chips equal to one top-end 2023 chip (', infoTip('H100e: H100 equivalents, the standard unit of AI computing power.', 'H100 equivalents'), '). Each step up the axis is ten times more. The AI Futures Model does not model the world total, so the timelines have no line here.'));
  wCard.append(wHost);
  const mCard = scnCard('When does each AI milestone arrive?', subEl('One block per timeline, one lane per milestone, from ' + (LIVE ? 'the runs of the AI Futures Model (each timeline is one slice of them, cut by ' + SPLIT_WHAT[SPLIT] + ')' : '3,000 runs of the AI Futures Model, split by the date AI first does AI research better than any human (SAR)') + '. The dot is the median date; the box holds the middle half of this group’s runs (p25 to p75); the whiskers reach p10 and p90. The axis stops at ' + TIME_CAP + ': an arrow means the range goes further, and the number beside it is the p90 date. The grey text says how many runs have not reached it by 2100. SC is the model’s “AC”. Hover a lane for what the milestone means.'));
  mCard.append(mHost);
  const uCard = scnCard('How much does AI speed up AI research?', subEl('How many times faster AI research runs with AI helping (1 means no help), on a scale where each step up is ten times more. The black marker is the METR estimate for late 2026. The three timelines are nudged sideways so they do not overlap. After takeoff the model’s numbers run off any sensible scale, so the upper part of the range is cut at the top of the chart.'));
  uCard.append(uHost);
  const eCard = scnCard('How much effective compute does the best AI have?', subEl('Training computing power with the gains from better algorithms folded in, as a power of ten: 30 means 10 to the power 30 operations. Each step up is ten times more.'));
  eCard.append(eHost);
  const tCard = scnCard('How much training compute does the model assume? (a model input)', subEl('The frontier lab’s training computing power, in H100 equivalents. The public model fixes it, so all three timelines use this one line and it has no range.'));
  tCard.append(tHost);
  const draw = () => {
    clear(hSub);
    hSub.append(`The length of task, in human working time, that the best AI finishes ${view.h === 'horizon50' ? 'half' : 'four times in five'} of the time. Each step up the axis is ten times longer. `, infoTip(WORK_NOTE, 'What is a work-month?'));
    hBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(['horizon50', 'horizon80'][i] === view.h)));
    timeLogChart(hHost, { key: view.h, conv: toMin, ticks: horizonTicks, dom: [1, 1e5], aria: 'AI task length over time, by timeline' });
    if (!hasInputs) timeLogChart(wHost, { key: 'worldCompute', conv: (c, v) => v, ticks: (lo, hi) => decadeTicks(lo, hi, (v) => fmtCompact(v), hi / lo <= 1e3 ? [1, 3] : [1]), dom: [1e7, 1e9], aria: 'World computing power over time, by timeline' });
    if (SPLIT !== 'matrix') milestoneChart(mHost);
    timeLogChart(uHost, { pick: (c) => c.series === 'speedup', hist: (c) => c.id === 'H26.uplift.metr', conv: (c, v) => v, ticks: (lo, hi) => decadeTicks(lo, hi, (v) => (v >= 1e6 ? fmtCompact(v) : v.toLocaleString('en-US')) + 'x', hi / lo <= 1e3 ? [1, 3] : [1]), dom: [1, 1e3], aria: 'AI research speed-up over time, by timeline' });
    timeLogChart(eHost, { pick: (c) => c.series === 'effCompute', hist: () => false, conv: (c, v) => v, linear: { fmt: (v) => '10^' + v }, dom: [28, 40], aria: 'Effective compute over time, by timeline' });
    if (SPLIT === 'matrix') matrixChart(mxHost);
    if (hasInputs) inputsCharts(inHost, lhHost);
    if (!hasInputs) timeLogChart(tHost, { pick: (c) => c.series === 'trainCompute', hist: () => false, shared: true, conv: (c, v) => v, ticks: (lo, hi) => decadeTicks(lo, hi, (v) => fmtCompact(v), hi / lo <= 1e3 ? [1, 3] : [1]), dom: [1e5, 1e8], aria: 'Frontier training compute assumed by the model' });
  };
  const inHost = H('div', { class: 'chart' }), lhHost = H('div', { class: 'chart' });
  const hasInputs = !!(LIVE && LIVE.inputs && LIVE.inputs.time && LIVE.inputs.time.length);
  const inCard = inputsCard(inHost, lhHost);
  const mxHost = H('div', { class: 'chart' });
  const sw = H('div', { class: 'scn-stack' });
  if (SPLIT === 'matrix') sw.append(...matrixCards(mxHost));
  else sw.append(mCard, hCard, uCard, eCard);
  if (hasInputs) sw.append(inCard); else sw.append(tCard, wCard);
  host.append(sw);
  if (D.tastecurve) sw.append(tasteCurveCard());
  // table twin of the chart data
  const twin = H('details', { class: 'card scn-twin' }, H('summary', { text: 'The chart points as a table' }));
  const plotted = CPS.filter((c) => PLOTTED.has(c.quantity) || c.series || isTed(c));
  const twinBody = H('div', { class: 'tablewrap' });
  twin.append(twinBody);
  dataTable(twinBody, [
    { label: 'Benchmark', get: (c) => c.label, clamp: true },
    { label: 'Belongs to', get: (c) => (c.layer === 'history' ? 'Shared history' : c.layer === 'timeline' ? tlShort(c.timeline) : 'Alignment') },
    { label: 'When', get: (c) => c.date, fmt: (v) => fmtWhen(v), num: true },
    { label: 'Value', get: (c) => c.value, fmt: (v, c) => fmtNum(c, v), num: true },
    { label: 'Range', get: (c) => c.lo, fmt: (v, c) => fmtBand(c) || '—' },
    { label: 'Wider range (p10 to p90)', get: (c) => c.p10, fmt: (v, c) => fmtWide(c, (x) => fmtNum(c, x)) || '—' },
    { label: 'Unit', get: (c) => c.unit },
    { label: 'Status', get: (c) => STATUS_NAME[c.status] },
  ], plotted, { limit: 400 });
  if (!plotted.length) twinBody.append(H('div', { class: 'empty', text: 'No chart points yet.' }));
  host.append(twin);
  draw();
  renderers.scn_re = draw;
  scnDraw = draw;

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
      H('td', { class: 'num' }, b ? b : H('span', { class: 'muted', text: 'no range' }), b ? H('div', { class: 'muted', text: isDist(c) ? 'middle half of this group’s runs (p25 to p75)' : c.bandFrom === 'source' ? 'from the source' : c.bandFrom === 'designer' ? 'designer’s' : '' }) : null, isDist(c) ? H('div', { class: 'muted', text: 'p10 to p90: ' + fmtWide(c, (x) => fmtNum(c, x)) }) : null),
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

// ---- first view (client.js and scenarios.js are one script; this runs after every renderer is defined)
{ // a reload (the live page refreshes itself) comes back to the same tab and scroll position
  const h = (location.hash || '').slice(1), tabs = ['out', 'par', 'tgt', 'scn'];
  showTab(tabs.includes(h) ? h : D.live ? 'scn' : 'out');
  if (D.live) {
    const y = Number(sessionStorage.getItem('baldash-scroll') || 0);
    if (y) window.scrollTo(0, y);
    addEventListener('scroll', () => sessionStorage.setItem('baldash-scroll', String(window.scrollY)), { passive: true });
  }
}
