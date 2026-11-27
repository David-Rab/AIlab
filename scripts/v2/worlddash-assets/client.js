'use strict';
// World dashboard client (scripts/v2/worlddash.ts). Vanilla JS + SVG, no network. Data prep is in prep.js (WD).
// All text from data goes in through textContent / createTextNode, never innerHTML.
const D = JSON.parse(document.getElementById('data').textContent);
const NS = 'http://www.w3.org/2000/svg';
function H(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}
function S(tag, attrs, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs || {}) { const v = attrs[k]; if (v != null) e.setAttribute(k, v); }
  for (const c of kids.flat()) if (c != null) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}

const TLNAME = { fast: 'Fast', central: 'Central', slow: 'Slow' };
const TLCOL = { fast: 'var(--s2)', central: 'var(--s1)', slow: 'var(--s3)' };
const tlName = (id) => TLNAME[id] || id;
const tlCol = (id) => TLCOL[id] || 'var(--s7)';
const f1 = (v, d = 1) => (v == null ? '—' : (+v).toFixed(d));
const yearLabel = (y) => { // decimal year -> "Mon YYYY"
  const yr = Math.floor(y), mo = Math.min(11, Math.floor((y - yr) * 12));
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mo] + ' ' + yr;
};
function niceTicks(lo, hi, n) {
  const raw = (hi - lo) / n || 1, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, t = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) t.push(+v.toFixed(6));
  return t;
}

// ---------------------------------------------------------------- tooltip
const tip = document.getElementById('tip');
function showTip(ev, rows, head) {
  tip.textContent = '';
  if (head) tip.append(H('div', { class: 'th', text: head }));
  for (const r of rows) tip.append(H('div', { class: 'tr' }, r.color ? H('i', { class: 'kk', style: 'border-color:' + r.color }) : null, H('span', { class: 'nm', text: r.name }), H('b', { text: r.value })));
  tip.style.display = 'block';
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(ev.clientX + 14, innerWidth - w - 8) + 'px';
  tip.style.top = Math.min(ev.clientY + 14, innerHeight - h - 8) + 'px';
}
const hideTip = () => { tip.style.display = 'none'; };

// ---------------------------------------------------------------- cards and legends
function card(title, sub, ...kids) { return H('div', { class: 'card' }, H('h2', { text: title }), H('div', { class: 'sub', text: sub }), ...kids); }
function legend(items) {
  return H('div', { class: 'legend' }, items.map((it) => H('span', { class: 'it' }, it.tick ? H('i', { class: 'tk' }) : H('i', { class: 'sw', style: 'background:' + (it.color || 'var(--ink)') + (it.fade ? ';opacity:.3' : '') }), it.name)));
}
const empty = (t) => H('div', { class: 'empty', text: t });
const statusPill = (s) => H('span', { class: 'pill' + (s === 'pass' || s === 'fail' ? ' on' : ''), text: s === 'pass' ? 'PASS' : s === 'fail' ? 'FAIL' : s === 'na' ? 'n/a' : 'not testable here' });

// ---------------------------------------------------------------- line chart
// o: { w, h, x:[x0,x1], y:[y0,y1]?, xlabel, ylabel, series:[{name,color,pts:[{x,y,lo?,hi?}],dots?,dash?,fmt?}], marks:[{x,label}], yfmt, unit }
function lineChart(o) {
  const w = o.w, h = o.h, m = { l: 48, r: 12, t: 16, b: 38 };
  const [x0, x1] = o.x;
  let y0, y1;
  if (o.y) [y0, y1] = o.y;
  else {
    const vs = [];
    for (const s of o.series) for (const p of s.pts) if (p.x >= x0 && p.x <= x1) { vs.push(p.y); if (p.lo != null) vs.push(p.lo, p.hi); }
    if (!vs.length) return empty('No data in this window.');
    y0 = Math.min(...vs); y1 = Math.max(...vs);
    if (y0 === y1) { y0 -= 1; y1 += 1; }
    const pad = (y1 - y0) * 0.08; y0 = o.floor0 ? Math.min(0, y0) : y0 - pad; y1 += pad;
  }
  const X = (x) => m.l + (x - x0) / (x1 - x0) * (w - m.l - m.r), Y = (y) => h - m.b - (y - y0) / (y1 - y0) * (h - m.t - m.b);
  const svg = S('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', role: 'img', 'aria-label': o.ylabel + ' over time' });
  const yts = o.yticks || niceTicks(y0, y1, 5).map((t) => ({ v: t, label: +t.toFixed(3) }));
  for (const t of yts) svg.append(S('line', { x1: m.l, x2: w - m.r, y1: Y(t.v), y2: Y(t.v), stroke: 'var(--grid)' }), S('text', { x: m.l - 6, y: Y(t.v) + 4, 'text-anchor': 'end', class: 't-muted' }, t.label));
  for (const hl of o.hlines || []) svg.append(S('line', { x1: m.l, x2: w - m.r, y1: Y(hl.y), y2: Y(hl.y), stroke: 'var(--ink2)', 'stroke-dasharray': '6 3', 'stroke-width': 1 }), S('text', { x: w - m.r - 3, y: Y(hl.y) - 3, 'text-anchor': 'end', class: 't-ink' }, hl.label));
  const short = x1 - x0 <= 3.2, xt = short ? niceTicks(x0, x1, 1).length ? Array.from({ length: Math.floor((x1 - x0) * 4) + 1 }, (_, i) => Math.ceil(x0 * 4) / 4 + i / 4).filter((t) => t <= x1) : [] : niceTicks(x0, x1, w > 700 ? 12 : 5);
  for (const t of xt) svg.append(S('line', { x1: X(t), x2: X(t), y1: m.t, y2: h - m.b, stroke: 'var(--grid)' }), S('text', { x: X(t), y: h - m.b + 14, 'text-anchor': 'middle', class: 't-muted' }, short ? (w > 700 || Math.round(t * 4) % 2 === 0 ? yearLabel(t + 0.01) : '') : +t.toFixed(2)));
  svg.append(S('line', { x1: m.l, x2: w - m.r, y1: h - m.b, y2: h - m.b, stroke: 'var(--axis)' }));
  svg.append(S('text', { x: (m.l + w - m.r) / 2, y: h - 4, 'text-anchor': 'middle' }, o.xlabel || 'Calendar year'));
  svg.append(S('text', { transform: `translate(11 ${(m.t + h - m.b) / 2}) rotate(-90)`, 'text-anchor': 'middle' }, o.ylabel));
  (o.marks || []).forEach((mk, i) => {
    if (mk.x < x0 || mk.x > x1) return;
    svg.append(S('line', { x1: X(mk.x), x2: X(mk.x), y1: m.t, y2: h - m.b, stroke: 'var(--ink2)', 'stroke-dasharray': '3 3', 'stroke-width': 1 }),
      S('text', { x: X(mk.x) + 3, y: m.t + 9 + (i % 2) * 10, class: 't-ink' }, mk.label));
  });
  for (const s of o.series) {
    const pts = s.pts.filter((p) => p.x >= x0 - 1e-9 && p.x <= x1 + 1e-9 && p.y != null);
    if (!pts.length) continue;
    // A step series holds each value until the next sample (stages, rungs): the path is horizontal, then vertical.
    const stepPts = (f) => pts.flatMap((p, i) => (i && s.step ? [`${X(p.x)},${Y(f(pts[i - 1]))}`] : []).concat(`${X(p.x)},${Y(f(p))}`));
    if (pts[0].lo != null && pts.length > 1) svg.append(S('path', { d: 'M' + stepPts((p) => p.hi).concat(stepPts((p) => p.lo).reverse()).join('L') + 'Z', fill: s.color, opacity: 0.2 }));
    if (!s.dots || pts.length > 1) svg.append(S('path', { d: 'M' + stepPts((p) => p.y).join('L'), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-dasharray': s.dash || null, 'stroke-linejoin': 'round' }));
    if (s.dots || pts.length === 1) for (const p of pts) svg.append(S('circle', { cx: X(p.x), cy: Y(p.y), r: 3.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }));
  }
  const cross = S('line', { y1: m.t, y2: h - m.b, stroke: 'var(--ink2)', 'stroke-width': 1, display: 'none' });
  svg.append(cross);
  const hit = S('rect', { x: m.l, y: m.t, width: w - m.l - m.r, height: h - m.t - m.b, fill: 'transparent' });
  hit.addEventListener('mousemove', (ev) => {
    const r = svg.getBoundingClientRect(), x = x0 + ((ev.clientX - r.left) / r.width * w - m.l) / (w - m.l - m.r) * (x1 - x0);
    const rows = [];
    let near = null;
    for (const s of o.series) {
      let b = null;
      for (const p of s.pts) if (p.y != null && (b === null || Math.abs(p.x - x) < Math.abs(b.x - x))) b = p;
      if (!b || Math.abs(b.x - x) > (x1 - x0) * (s.dots ? 0.5 : 0.08)) continue;
      if (near === null || Math.abs(b.x - x) < Math.abs(near - x)) near = b.x;
      rows.push({ name: s.name + (s.dots ? ' (' + (b.label || yearLabel(b.x)) + ')' : ''), color: s.color, value: o.vname ? o.vname(b.y) + (b.lo != null && (b.lo !== b.y || b.hi !== b.y) ? ` (${o.vname(b.lo)} to ${o.vname(b.hi)})` : '') : f1(b.y, o.dec == null ? 2 : o.dec) + (b.lo != null ? ` (${f1(b.lo, o.dec == null ? 2 : o.dec)} to ${f1(b.hi, o.dec == null ? 2 : o.dec)})` : '') + (o.unit ? ' ' + o.unit : '') });
    }
    if (!rows.length) return hideTip();
    cross.setAttribute('x1', X(near)); cross.setAttribute('x2', X(near)); cross.setAttribute('display', null);
    showTip(ev, rows, yearLabel(near));
  });
  hit.addEventListener('mouseleave', () => { cross.setAttribute('display', 'none'); hideTip(); });
  svg.append(hit);
  return H('div', { class: 'chart' }, svg);
}

// ---------------------------------------------------------------- data
const RECS = D.records;
const GROUPS = WD.groupByTimeline(RECS);
const REAL = Object.fromEntries(D.real.series.map((s) => [s.id, s]));
const realPts = (s) => s.points.filter((p) => p.value != null).map((p) => ({ x: p.date, y: p.value, label: p.label }));
const TL_LEG = () => GROUPS.map((g) => ({ name: tlName(g.id) + ' (' + g.recs.length + ' run' + (g.recs.length > 1 ? 's' : '') + ')', color: tlCol(g.id) }));
const bandNote = 'Line = median across the runs of a timeline; band = 10th to 90th percentile (one run: no band).';
const HIST = [2025.5, 2026.95];

// ---------------------------------------------------------------- tab: History
function tabHistory() {
  const root = H('div');
  const defs = [
    { id: 'unemployment', title: 'US unemployment: game against BLS', get: (s) => s.economy.unemploymentUS, unit: '%', ylabel: 'Unemployment rate (%)', look: 'The game should start where BLS is (about 4.3%) and stay near it to Nov 2026 (4.1%); a fast climb here with no AI cause is drift.' },
    { id: 'youth', title: 'US youth (16-24) unemployment: game against BLS', get: (s) => s.economy.youthUnemployment, unit: '%', ylabel: 'Youth unemployment rate (%)', look: 'Real youth unemployment is 9-10%, about 5 points above the headline; the game should keep that gap.' },
    { id: 'gdp', title: 'US real GDP growth: game against BEA', get: (s) => s.economy.gdpGrowthUS * 100, unit: '% / yr', ylabel: 'Real GDP growth (% per year)', look: 'Real quarters swing between 0 and 4.5; the game is smooth, so look for its level (2-3%), not its wiggles.' },
  ];
  for (const d of defs) {
    const real = REAL[d.id];
    const series = GROUPS.map((g) => ({ name: tlName(g.id) + ' (game)', color: tlCol(g.id), pts: WD.seriesStat(g.recs, d.get) }));
    series.push({ name: 'Real (' + real.source.split(',')[0] + ')', color: 'var(--ink)', pts: realPts(real), dots: d.id !== 'unemployment' && d.id !== 'gdp' ? true : false, dash: null });
    root.append(card(d.title, d.look, legend(TL_LEG().concat([{ name: 'Real data', color: 'var(--ink)' }])), lineChart({ w: 1240, h: 280, x: HIST, series, ylabel: d.ylabel, unit: d.unit }), H('div', { class: 'hint' }, bandNote + ' Source: ', H('a', { href: real.url, text: real.name }), real.note ? ' ' + real.note : '')));
  }
  // concern: game against Pew, with the live check
  const pew = REAL.concern, pewLast = pew.points.filter((p) => p.value != null).slice(-1)[0];
  const concernCheck = WD.checkNear(GROUPS, (s) => s.public.concern, 50, 4, 2026.85, '');
  root.append(card('Public concern about AI: game against Pew', 'Pew: share "more concerned than excited" (about 50%, flat since 2023). The game starts there and should stay within 50 +/- 4 to Nov 2026; after that it moves with the milestones (see Reactions).',
    legend(TL_LEG().concat([{ name: 'Real (Pew)', color: 'var(--ink)' }])),
    lineChart({ w: 1240, h: 260, x: [2021.5, 2026.95], y: [30, 70], series: GROUPS.map((g) => ({ name: tlName(g.id) + ' (game)', color: tlCol(g.id), pts: WD.seriesStat(g.recs, (s) => s.public.concern) })).concat([{ name: 'Pew', color: 'var(--ink)', pts: realPts(pew), dots: true }]), ylabel: '% more concerned than excited', unit: '%', dec: 0, hlines: [{ y: 50, label: '50' }] }),
    H('div', { class: 'chart' }, H('table', { class: 'dt' }, H('thead', null, H('tr', null, ['Timeline', 'Check: concern at Nov 2026 within 50 +/- 4', 'Numbers'].map((t) => H('th', { text: t })))), H('tbody', null, concernCheck.map((r) => H('tr', null, H('td', { text: tlName(r.tl) }), H('td', null, statusPill(r.status)), H('td', { text: r.text })))))),
    H('div', { class: 'hint' }, bandNote + ' Last real wave: ' + pewLast.label + '. Source: ', H('a', { href: pew.url, text: pew.name }), ' ' + pew.note)));
  // laws and export policy strip
  root.append(card('Laws and export policy: when in the game, when in reality', 'Real events are black marks; game marks are the first sample in which the law is in force (quarterly), one row per timeline.', lawStrip(), eventTable()));
  return root;
}
function lawStrip() {
  const x0 = HIST[0], x1 = 2027.1, w = 1240, m = { l: 190, r: 14, t: 8, b: 30 };
  const rows = [{ name: 'Real: laws', kind: 'law' }, { name: 'Real: export steps', kind: 'export' }];
  for (const g of GROUPS) rows.push({ name: tlName(g.id) + ': laws in game', g, kind: 'law' }, { name: tlName(g.id) + ': export policy in game', g, kind: 'export' });
  const rh = 26, h = m.t + rows.length * rh + m.b;
  const X = (x) => m.l + (x - x0) / (x1 - x0) * (w - m.l - m.r);
  const svg = S('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', role: 'img', 'aria-label': 'Laws and export policy dates' });
  for (const t of niceTicks(x0, x1, 8)) svg.append(S('line', { x1: X(t), x2: X(t), y1: m.t, y2: h - m.b, stroke: 'var(--grid)' }), S('text', { x: X(t), y: h - m.b + 14, 'text-anchor': 'middle', class: 't-muted' }, +t.toFixed(2)));
  svg.append(S('text', { x: (m.l + w) / 2, y: h - 2, 'text-anchor': 'middle' }, 'Calendar year'));
  rows.forEach((r, i) => {
    const cy = m.t + i * rh + rh / 2;
    svg.append(S('text', { x: m.l - 8, y: cy + 4, 'text-anchor': 'end', class: r.g ? null : 't-ink' }, r.name));
    const add = (x, label, color, shape, extra) => {
      if (x < x0 || x > x1) return;
      const mark = shape === 'tri' ? S('path', { d: `M${X(x)},${cy - 7}l6,12h-12z`, fill: color }) : S('circle', { cx: X(x), cy, r: 5, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 });
      mark.addEventListener('mousemove', (ev) => showTip(ev, [{ name: label, value: yearLabel(x) + (extra || '') }]));
      mark.addEventListener('mouseleave', hideTip);
      svg.append(mark);
    };
    if (!r.g) for (const e of D.real[r.kind === 'law' ? 'laws' : 'exports']) add(e.date, e.label, 'var(--ink)', e.unverified ? 'tri' : 'dot', e.unverified ? ' [unverified]' : '');
    else if (r.kind === 'law') for (const k of ['euGpai', 'sb53', 'raise']) for (const rec of r.g.recs) { const y = WD.lawFirstYear(rec, k); if (y != null) add(y, LAWNAME[k] + ' in force (seed ' + rec.seed + ')', tlCol(r.g.id), 'dot'); }
    else for (const rec of r.g.recs) for (const c of WD.exportPolicyChanges(rec)) add(c.year, 'Export policy becomes "' + c.policy + '" (seed ' + rec.seed + ')', tlCol(r.g.id), 'dot');
  });
  return H('div', { class: 'chart' }, legend([{ name: 'Real event', color: 'var(--ink)' }, { name: 'Real, unverified (triangle)', color: 'var(--ink)', fade: true }].concat(TL_LEG())), svg);
}
const LAWNAME = { sb53: 'California SB 53', raise: 'NY RAISE Act', euGpai: 'EU GPAI rules' };
function eventTable() {
  const rows = [];
  for (const e of D.real.laws.concat(D.real.exports)) {
    const game = e.gameKey ? GROUPS.map((g) => tlName(g.id) + ' ' + fmtYears(g.recs.map((r) => WD.lawFirstYear(r, e.gameKey)))).join('; ') : '';
    rows.push(H('tr', null, H('td', { text: yearLabel(e.date) }), H('td', { text: e.kind === 'law' ? 'law' : 'export control' }), H('td', { text: e.label + (e.unverified ? ' [unverified]' : '') }), H('td', { text: game }), H('td', { class: 'mono', text: e.source })));
  }
  return H('div', { class: 'chart' }, H('table', { class: 'dt' }, H('thead', null, H('tr', null, ['Real date', 'Kind', 'Event', 'Game: first in force (year)', 'Source'].map((t) => H('th', { text: t })))), H('tbody', null, rows)));
}
function fmtYears(a) { const v = a.filter((x) => x != null); return v.length ? WD.median(v).toFixed(2) : 'never'; }

// ---------------------------------------------------------------- tab: Rivals
function tabRivals() {
  const root = H('div');
  // milestone dates vs AIFM
  const rows = [];
  for (const g of GROUPS) for (const m of WD.MS) rows.push({ g, m, band: WD.aifmBand(D.scenarios.checkpoints, g.id, m.k), ys: g.recs.map((r) => (WD.frontierMilestones(r)[m.k] || {}).year).filter((v) => v != null) });
  const all = rows.flatMap((r) => r.ys.concat(r.band ? [r.band.p10, r.band.p90].filter((v) => v != null) : []));
  const x0 = Math.floor(Math.min(2025, ...all) / 2) * 2, x1 = Math.ceil(Math.min(2062, Math.max(2035, ...all)));
  const w = 1240, m = { l: 150, r: 14, t: 8, b: 32 }, rh = 22, h = m.t + rows.length * rh + GROUPS.length * 10 + m.b;
  const X = (x) => m.l + (Math.min(x, x1) - x0) / (x1 - x0) * (w - m.l - m.r);
  const svg = S('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', role: 'img', 'aria-label': 'Leading lab milestone dates against AIFM bands' });
  for (const t of niceTicks(x0, x1, 10)) svg.append(S('line', { x1: X(t), x2: X(t), y1: m.t, y2: h - m.b, stroke: 'var(--grid)' }), S('text', { x: X(t), y: h - m.b + 14, 'text-anchor': 'middle', class: 't-muted' }, t));
  svg.append(S('text', { x: (m.l + w) / 2, y: h - 2, 'text-anchor': 'middle' }, 'Calendar year the milestone was reached'));
  let y = m.t, last = null;
  for (const r of rows) {
    if (last && last !== r.g.id) y += 10;
    last = r.g.id;
    const cy = y + rh / 2;
    svg.append(S('text', { x: m.l - 8, y: cy + 4, 'text-anchor': 'end' }, tlName(r.g.id) + ' ' + r.m.k));
    const b = r.band, col = tlCol(r.g.id);
    if (b && b.p25 != null && b.p75 != null) {
      if (b.p10 != null) svg.append(S('line', { x1: X(b.p10), x2: X(b.p90 != null ? b.p90 : x1), y1: cy, y2: cy, stroke: 'var(--ink2)', 'stroke-width': 1 }));
      const box = S('rect', { x: X(b.p25), y: cy - 6, width: Math.max(2, X(b.p75) - X(b.p25)), height: 12, rx: 3, fill: col, opacity: 0.25, stroke: col });
      box.addEventListener('mousemove', (ev) => showTip(ev, [{ name: 'p10 / p25', value: f1(b.p10, 2) + ' / ' + f1(b.p25, 2) }, { name: 'median', value: f1(b.p50, 2) }, { name: 'p75 / p90', value: f1(b.p75, 2) + ' / ' + (b.p90 != null ? f1(b.p90, 2) : 'not reached') }], 'AIFM ' + tlName(r.g.id) + ' ' + r.m.k + (r.m.k === 'SC' ? ' (AIFM "AC")' : '')));
      box.addEventListener('mouseleave', hideTip);
      svg.append(box, S('line', { x1: X(b.p50), x2: X(b.p50), y1: cy - 8, y2: cy + 8, stroke: 'var(--ink)', 'stroke-width': 2 }));
    }
    r.ys.forEach((yy, i) => {
      const dot = S('circle', { cx: X(yy), cy, r: 5, fill: col, stroke: 'var(--surface)', 'stroke-width': 2 });
      dot.addEventListener('mousemove', (ev) => showTip(ev, [{ name: 'Leading lab reached it', value: yearLabel(yy) }, { name: 'Lab', value: (WD.frontierMilestones(r.g.recs[i]) [r.m.k] || {}).lab || '' }], tlName(r.g.id) + ' ' + r.m.k));
      dot.addEventListener('mouseleave', hideTip);
      svg.append(dot);
    });
    if (!r.ys.length) svg.append(S('text', { x: m.l + 6, y: cy + 4, class: 't-muted' }, 'not reached before the run ended'));
    y += rh;
  }
  root.append(card('When the leading lab reached each milestone, against the AI Futures Model', 'SC is the model\'s "AC". Dots are the game (one per run: the first NPC lab to reach it); boxes are the model\'s 25th-75th percentile, whisker 10th-90th, tick the median. Dots inside the box are on target.',
    legend([{ name: 'Game, one dot per run', color: 'var(--ink2)' }, { name: 'AIFM p25-p75 (box), p10-p90 (line)', color: 'var(--ink2)', fade: true }, { name: 'AIFM median', tick: true }]), H('div', { class: 'chart' }, svg)));
  // lag of the other labs
  const LABCOL = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s7)'];
  const labIds = [];
  for (const g of GROUPS) for (const l of WD.lagSeries(g.recs)) if (!labIds.includes(l.id)) labIds.push(l.id);
  const lagGrid = H('div', { class: 'grid3' });
  for (const g of GROUPS) {
    const ser = WD.lagSeries(g.recs).map((l) => ({ name: l.id, color: LABCOL[labIds.indexOf(l.id) % LABCOL.length], pts: l.pts.map((p) => ({ x: p.x, y: p.med })) }));
    lagGrid.append(H('div', null, H('div', { class: 'gt', text: tlName(g.id) }), lineChart({ w: 410, h: 240, x: [2025.5, runEnd(g.recs)], series: ser, ylabel: 'Months behind the frontier', unit: 'months', dec: 1, floor0: true })));
  }
  root.append(card('How far behind the other labs are', 'Median over runs of each NPC lab\'s distance to the frontier lab, in months of progress. The frontier lab sits at 0.', legend(labIds.map((id, i) => ({ name: id, color: LABCOL[i % LABCOL.length] }))), lagGrid));
  const cser = GROUPS.map((g) => ({ name: tlName(g.id), color: tlCol(g.id), pts: WD.seriesStat(g.recs, (s) => s.geopolitics.chinaGapMonths) }));
  const cx1 = Math.max(...GROUPS.map((g) => runEnd(g.recs)));
  root.append(card('China\'s lab: gap to the best US lab', 'Months China\'s best model trails the best US model. Real-world anchors for this gap are in the AIFM timelines (balance/scenarios.ts, quantity chinaGap).', legend(TL_LEG()), lineChart({ w: 1240, h: 260, x: [2025.5, cx1], series: cser, ylabel: 'Months behind the best US lab', unit: 'months', dec: 1 }), H('div', { class: 'hint', text: bandNote })));
  return root;
}
const runEnd = (recs) => Math.max(...recs.map((r) => r.series[r.series.length - 1].year));

// ---------------------------------------------------------------- tab: Reactions
const REACT = [
  { title: 'US unemployment', get: (s) => s.economy.unemploymentUS, unit: '%', ylabel: 'Unemployment (%)', look: 'Should stay near 4% until AI automation bites, then rise after the AI milestones, not before.' },
  { title: 'Youth unemployment (16-24)', get: (s) => s.economy.youthUnemployment, unit: '%', ylabel: 'Youth unemployment (%)', look: 'Rises first and faster than the headline rate.' },
  { title: 'US real GDP growth', get: (s) => s.economy.gdpGrowthUS * 100, unit: '% / yr', ylabel: 'GDP growth (% per year)', look: 'Near 2-3% now; takeoff should lift it after SAR or later.' },
  { title: 'AI share of income', get: (s) => s.economy.aiIncomeShare * 100, unit: '%', ylabel: 'AI share of US income (%)', look: 'Near zero today; it should climb with the milestones.' },
  { title: 'Automation share of US work', get: (s) => s.economy.automationUS * 100, unit: '%', ylabel: 'Work automated (%)', look: 'Slow rise now, steeper after SC; flat while capability is flat.' },
  { title: 'Robots built per month', get: (s) => s.robotsPerMonth, unit: 'robots', ylabel: 'Robots per month', look: 'Should grow smoothly; a jump with no milestone behind it is suspect.', dec: 0 },
  { title: 'Technologies discovered', get: (s) => s.techsDiscovered, unit: 'techs', ylabel: 'Discovered technologies', look: 'Accumulates with research capability; steps up after SAR.', dec: 0 },
  { title: 'Laws in force', get: (s) => s.laws.inForce.length, unit: 'laws', ylabel: 'Laws in force (dated and conditional)', look: 'The dated laws arrive on their real dates; the conditional laws (see the lanes below) only after their triggers.', dec: 0 },
  { title: 'Taiwan disrupted', get: (s) => (s.geopolitics.taiwanDisrupted ? 100 : 0), mean: true, unit: '% of runs', ylabel: 'Share of runs with Taiwan disrupted (%)', look: 'Near zero while tension is low; the hazard rises with China\'s tension.', dec: 0 },
];
function tabReactions() {
  const root = H('div');
  const ends = Object.fromEntries(GROUPS.map((g) => [g.id, runEnd(g.recs)]));
  const marks = Object.fromEntries(GROUPS.map((g) => [g.id, WD.milestoneMarks(g.recs).map((mk) => ({ x: mk.year, label: mk.k }))]));
  root.append(H('div', { class: 'hint', text: 'Per timeline: ' + bandNote + ' Dashed lines mark the date the leading lab reached SC, SAR, SIAR and ASI (median over runs). The three columns share one vertical scale.' }));
  for (const d of ACTOR_REACT.concat(REACT)) {
    const grid = H('div', { class: 'grid3' });
    const allv = [];
    const sers = GROUPS.map((g) => ({ g, pts: WD.seriesStat(g.recs, d.get, d.mean ? 'mean' : null) }));
    for (const s of sers) for (const p of s.pts) allv.push(p.lo, p.hi, p.med);
    const lo = d.y ? d.y[0] : Math.min(...allv), hi = d.y ? d.y[1] : Math.max(...allv), pad = d.y ? 0 : (hi - lo || 1) * 0.06;
    for (const s of sers) grid.append(H('div', null, H('div', { class: 'gt', text: tlName(s.g.id) }), lineChart({ w: 410, h: 220, x: [2025.5, ends[s.g.id]], y: [lo - pad, hi + pad], series: [{ name: tlName(s.g.id), color: tlCol(s.g.id), step: d.step, pts: s.pts.map((p) => ({ x: p.x, y: p.med, lo: p.lo, hi: p.hi })) }].concat(d.extra ? d.extra(s.g) : []), marks: marks[s.g.id], ylabel: d.ylabel, unit: d.unit, dec: d.dec, vname: d.vname, yticks: d.yticks, hlines: d.hlines })));
    root.append(card(d.title, d.look, grid));
  }
  root.append(...actorCards(ends));
  return root;
}

// The outside actors' rows (public W4, US government W5, China W6). Same chart as above: median and band per timeline, milestone marks.
const nameOf = (list) => (v) => (Number.isFinite(v) ? Math.round(v) + ': ' + list[Math.min(list.length - 1, Math.max(0, Math.round(v)))] : '—');
const stepTicks = (n) => Array.from({ length: n + 1 }, (_, i) => ({ v: i, label: String(i) }));
const ACTOR_REACT = [
  { title: 'Public: concern about AI', get: (s) => s.public.concern, unit: '%', ylabel: 'Concern (0-100)', look: 'Starts near Pew\'s 50%; steps up after public-frontier milestones and with unemployment, falls back slowly (half-life about 3 months).', dec: 1, hlines: [{ y: 50, label: 'Pew 50' }] },
  { title: 'Public: approval of the player', get: (s) => s.public.approval, unit: '', ylabel: 'Approval (-100..100)', look: 'The observer player does nothing, so this should sit near its drift baseline, with no swings.', dec: 1 },
  { title: 'US government: security stage', get: (s) => s.usgov.stage, step: true, y: [-0.3, 4.3], yticks: stepTicks(4), vname: nameOf(D.names.stages), ylabel: 'Stage (0-4)', look: 'Stays 0 until the government sees the research-agent milestone, then climbs one stage at a time, each at least about 90 days after its trigger. Hover for the stage name.' },
  { title: 'US government: trust in the player', get: (s) => s.usgov.trust, unit: '', ylabel: 'Trust (0-100)', look: 'Starts at 55 and moves only with the player\'s attention; an observer player should stay at 55.', dec: 1 },
  { title: 'China: tension', get: (s) => s.chinagov.tension, step: true, y: [-0.3, 4.3], yticks: stepTicks(4), vname: nameOf(D.names.tension), ylabel: 'Tension rung (0-4)', look: 'Rises with the US lead and strict export controls; rungs 3 and 4 are sticky. Hover for the rung name.' },
  { title: 'China: talks', get: (s) => s.chinagov.talks, step: true, y: [-0.3, 3.3], yticks: stepTicks(3), vname: nameOf(D.names.talks), ylabel: 'Talks step (0-3)', look: 'Opens after a scare or when the US lead is small, advances while quiet. Step 3 is the verified treaty. Hover for the step name.' },
];

const LANE_COLS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s7)'];
/** One timeline's lanes: a lane per law id (filled while in force; shade = share of runs in force), the export policy, treaty and collective. */
function lanesChart(g, x1) {
  const x0 = 2025.5, w = 1240, m = { l: 210, r: 14, t: 8, b: 30 }, rh = 20;
  const lawIds = D.names.lawTable.map((l) => l.id).concat(Object.keys(D.names.laws).filter((id) => id !== 'exportStrict' && !D.names.lawTable.some((l) => l.id === id)));
  const policies = [];
  for (const r of g.recs) for (const s of r.series) if (!policies.includes(s.laws.exportPolicy)) policies.push(s.laws.exportPolicy);
  const lanes = lawIds.map((id) => ({ name: D.names.laws[id] || id, col: tlCol(g.id), sh: WD.laneShares(g.recs, (s) => s.laws.inForce.includes(id)) }));
  lanes.push({ name: 'Export policy', policy: true }, { name: 'US-China treaty (verified)', col: tlCol(g.id), sh: WD.laneShares(g.recs, (s) => s.chinagov.treaty !== 'none') }, { name: 'China national collective', col: tlCol(g.id), sh: WD.laneShares(g.recs, (s) => s.chinagov.centralised) });
  const h = m.t + lanes.length * rh + m.b, X = (x) => m.l + (Math.min(x, x1) - x0) / (x1 - x0) * (w - m.l - m.r);
  const svg = S('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', role: 'img', 'aria-label': 'Laws in force, export policy and China lanes for ' + tlName(g.id) });
  for (const t of niceTicks(x0, x1, 10)) svg.append(S('line', { x1: X(t), x2: X(t), y1: m.t, y2: h - m.b, stroke: 'var(--grid)' }), S('text', { x: X(t), y: h - m.b + 14, 'text-anchor': 'middle', class: 't-muted' }, +t.toFixed(2)));
  svg.append(S('text', { x: (m.l + w) / 2, y: h - 2, 'text-anchor': 'middle' }, 'Calendar year'));
  const nruns = g.recs.length;
  lanes.forEach((ln, i) => {
    const y = m.t + i * rh;
    svg.append(S('text', { x: m.l - 8, y: y + rh / 2 + 4, 'text-anchor': 'end' }, ln.name), S('line', { x1: m.l, x2: w - m.r, y1: y + rh - 1, y2: y + rh - 1, stroke: 'var(--grid)' }));
    if (ln.policy) {
      const sh = WD.laneShares(g.recs, () => true);
      sh.forEach((p, k) => {
        const counts = {};
        for (const r of g.recs) { const s = r.series[k]; if (s) counts[s.laws.exportPolicy] = (counts[s.laws.exportPolicy] || 0) + 1; }
        const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0], xe = k + 1 < sh.length ? sh[k + 1].x : x1;
        const r = S('rect', { x: X(p.x), y: y + 3, width: Math.max(1, X(xe) - X(p.x)), height: rh - 6, fill: LANE_COLS[policies.indexOf(top) % LANE_COLS.length] });
        r.addEventListener('mousemove', (ev) => showTip(ev, Object.keys(counts).map((k2) => ({ name: k2, value: counts[k2] + ' of ' + nruns + ' runs' })), 'Export policy, ' + yearLabel(p.x)));
        r.addEventListener('mouseleave', hideTip);
        svg.append(r);
      });
      return;
    }
    ln.sh.forEach((p, k) => {
      if (!p.share) return;
      const xe = k + 1 < ln.sh.length ? ln.sh[k + 1].x : x1;
      const r = S('rect', { x: X(p.x), y: y + 3, width: Math.max(1, X(xe) - X(p.x)), height: rh - 6, fill: ln.col, opacity: 0.25 + 0.75 * p.share });
      r.addEventListener('mousemove', (ev) => showTip(ev, [{ name: 'In force', value: Math.round(p.share * p.n) + ' of ' + p.n + ' runs' }], ln.name + ', ' + yearLabel(p.x)));
      r.addEventListener('mouseleave', hideTip);
      svg.append(r);
    });
  });
  return { svg, policies };
}

function actorCards(ends) {
  const out = [];
  for (const g of GROUPS) {
    const { svg, policies } = lanesChart(g, ends[g.id]);
    out.push(card('Laws, export policy and China state: ' + tlName(g.id), 'One lane per law, filled while it is in force (darker = more runs when there are several). The export lane is coloured by policy. Dated laws should switch on at their real dates; conditional laws only after their triggers.',
      legend(policies.map((p, i) => ({ name: 'export: ' + p, color: LANE_COLS[i % LANE_COLS.length] }))), H('div', { class: 'chart' }, svg)));
  }
  // attention of the leading NPC lab and of China's lab
  const leadAtt = (s) => { const ls = s.labs.filter((l) => l.kind === 'lab' && l.monthsBehind != null).sort((a, b) => a.monthsBehind - b.monthsBehind); return ls.length ? ls[0].attention : null; };
  const chinaAtt = (s) => { const l = s.labs.find((x) => x.kind === 'china'); return l ? l.attention : null; };
  const grid = H('div', { class: 'grid3' });
  for (const g of GROUPS) {
    const mk = (get) => WD.seriesStat(g.recs, get).map((p) => ({ x: p.x, y: p.med, lo: p.lo, hi: p.hi }));
    grid.append(H('div', null, H('div', { class: 'gt', text: tlName(g.id) }), lineChart({ w: 410, h: 220, x: [2025.5, ends[g.id]], y: [0, 1.05], series: [{ name: 'Leading NPC lab', color: 'var(--s1)', pts: mk(leadAtt) }, { name: 'China\'s lab', color: 'var(--s3)', pts: mk(chinaAtt) }], ylabel: 'Attention (0-1)', dec: 2, hlines: [{ y: D.names.attentionMin, label: 'requirements land above ' + D.names.attentionMin }] })));
  }
  out.push(card('Attention on the leading NPC lab and on China\'s lab', 'How much the government and public watch each lab (0-1). Stage requirements land only on a lab above the threshold; the leading lab should climb as it reaches the frontier. China\'s lab keeps its own level.', legend([{ name: 'Leading NPC lab', color: 'var(--s1)' }, { name: 'China\'s lab', color: 'var(--s3)' }]), grid));
  // timeline of beats
  const det = [];
  GROUPS.forEach((g, gi) => g.recs.forEach((r, ri) => {
    const bs = WD.beats(r, D.names);
    const tbl = H('table', { class: 'dt' }, H('thead', null, H('tr', null, ['Date', 'Kind', 'Beat'].map((t) => H('th', { text: t })))), H('tbody', null, bs.map((b) => H('tr', null, H('td', { text: (b.approx ? 'by ' : '') + yearLabel(b.year) }), H('td', { text: b.kind }), H('td', { text: b.text })))));
    det.push(H('details', gi === 0 && ri === 0 ? { open: true } : null, H('summary', { text: tlName(g.id) + ', seed ' + r.seed + ' (' + bs.length + ' beats; ends ' + yearLabel(r.series[r.series.length - 1].year) + ', ' + (r.endReason || '?') + ')' }), H('div', { class: 'chart' }, tbl)));
  }));
  out.push(card('Timeline of beats', 'One game\'s story in date order: milestones shown publicly, stage steps, laws on and off, China rungs, talks, Taiwan, the ending. "by" marks a beat known only to the quarterly sample (the quarter it was first seen); the rest are exact days.', ...det));
  return out;
}

// ---------------------------------------------------------------- tab: Endings
function tabEndings() {
  const root = H('div');
  const name = (id) => (D.names.ending[id] ? D.names.ending[id] + ' (' + id + ')' : id === 'asi+3y' ? 'Reached ASI + 3 years' : id === '2060' ? 'Reached 2060' : id);
  const reasons = [];
  for (const g of GROUPS) for (const k of Object.keys(WD.endingMix(g.recs).counts)) if (!reasons.includes(k)) reasons.push(k);
  const cols = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s7)', 'var(--s8)', 'var(--s6)'];
  const w = 1240, m = { l: 90, r: 14, t: 8, b: 30 }, rh = 34, h = m.t + GROUPS.length * rh + m.b;
  const svg = S('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', role: 'img', 'aria-label': 'Ending mix per timeline' });
  GROUPS.forEach((g, i) => {
    const mix = WD.endingMix(g.recs), cy = m.t + i * rh;
    svg.append(S('text', { x: m.l - 8, y: cy + rh / 2 + 3, 'text-anchor': 'end' }, tlName(g.id) + ' (' + mix.n + ')'));
    let x = m.l;
    for (const k of reasons) {
      const c = mix.counts[k] || 0;
      if (!c) continue;
      const ww = c / mix.n * (w - m.l - m.r) - 2, r = S('rect', { x, y: cy + 4, width: Math.max(2, ww), height: rh - 10, rx: 4, fill: cols[reasons.indexOf(k) % cols.length] });
      r.addEventListener('mousemove', (ev) => showTip(ev, [{ name: name(k), value: c + ' of ' + mix.n + ' runs' }], tlName(g.id)));
      r.addEventListener('mouseleave', hideTip);
      svg.append(r, S('text', { x: x + 6, y: cy + rh / 2 + 3, style: 'fill:#fff;font-weight:600' }, c > 0 && ww > 24 ? String(c) : ''));
      x += ww + 2;
    }
  });
  svg.append(S('text', { x: (m.l + w) / 2, y: h - 4, 'text-anchor': 'middle' }, 'Share of runs (each bar = all runs of that timeline)'));
  root.append(card('How the runs ended', 'An observer run stops at the first world ending, at first ASI + 3 years, or in 2060. Worlds that end early with no player involvement point at a drifting outside world.', legend(reasons.map((k, i) => ({ name: name(k), color: cols[i % cols.length] }))), H('div', { class: 'chart' }, svg)));
  const rows = GROUPS.map((g) => { const mix = WD.endingMix(g.recs); return H('tr', null, H('td', { text: tlName(g.id) }), H('td', { class: 'num', text: mix.n }), H('td', { text: Object.entries(mix.counts).map(([k, c]) => name(k) + ' x' + c).join('; ') }), H('td', { class: 'num', text: f1(mix.yearMed, 2) }), H('td', { class: 'num', text: f1(mix.yearLo, 2) + ' to ' + f1(mix.yearHi, 2) })); });
  root.append(card('End dates', 'The calendar year each run stopped (last quarterly sample).', H('div', { class: 'chart' }, H('table', { class: 'dt' }, H('thead', null, H('tr', null, ['Timeline', 'Runs', 'Endings', 'Median end year', 'Range'].map((t) => H('th', { text: t })))), H('tbody', null, rows)))));
  return root;
}

// ---------------------------------------------------------------- tab: Checks
function tabChecks() {
  const root = H('div');
  const pill = (s) => H('span', { class: 'pill' + (s === 'pass' || s === 'fail' ? ' on' : ''), text: s === 'pass' ? 'PASS' : s === 'fail' ? 'FAIL' : s === 'na' ? 'n/a' : 'not testable yet' });
  const spec = [
    ['S1', 'Weak player: stage and concern rise from the rivals; nothing lands on the player', 'part', 'History part is live (check C). The constructed weak-player case, and "no requirement, theft or approval swing lands on the player", are not testable here: observer records carry no events or per-player effects.'],
    ['S2', 'Leading player: the stage follows the player\'s shown milestones', 'todo', 'Not testable here: needs a player who leads and briefs the government (a constructed case, not an observer run).'],
    ['S3', 'Frozen frontier: no AI progress, no drift into worry', 'part', 'History part is live (check C: stage 0 and no conditional law to Nov 2026, with concern in check B). The frozen-frontier case itself is not testable here.'],
    ['S4', 'Job losses: unemployment, then concern, then the relief law, then UBI', 'todo', 'Not testable here: needs a constructed unemployment rise; observer runs only show the order if one happens (see the Reactions laws lanes).'],
    ['S5', 'Lead over China: tension steps up with the lead; strict controls raise tension', 'todo', 'Not testable here: needs constructed leads and export policies; the tension step chart (Reactions) shows what the observer runs did.'],
    ['S6', 'Taiwan: hazard scales with tension; the shock uses the compute market', 'todo', 'Not testable here: the hazard is not in the record, only whether Taiwan was disrupted.'],
    ['S7', 'Eras: a 2023 start shows no laws before their dates and no stage before the milestones', 'part', 'Dated laws and stage order are live (checks D and F). A 2023 start and the post-ASI meaning of stage, laws, UBI and treaty are not testable here: these records start in 2025.'],
  ];
  const specPill = (s) => (s === 'part' ? H('span', { class: 'pill on', text: 'history part live' }) : statusPill('todo'));
  root.append(card('Shape checks S1-S7 (spec section 11)', 'The constructed cases are run by W10; observer records can test only the history parts below. The table says which part is live and why the rest is not testable here.',
    H('div', { class: 'chart' }, H('table', { class: 'dt' }, H('thead', null, H('tr', null, ['Check', 'What it asks', 'Status', 'Live here / not testable here, and why'].map((t) => H('th', { text: t })))), H('tbody', null, spec.map((s) => H('tr', null, H('td', { text: s[0] }), H('td', { text: s[1] }), H('td', null, specPill(s[2])), H('td', { text: s[3] }))))))));
  const scRows = WD.checkSC(GROUPS, D.scenarios.checkpoints);
  const bls = REAL.unemployment.points.filter((p) => p.value != null).slice(-1)[0];
  const unRows = WD.checkUnemployment(GROUPS, bls.value, 2026.85, 0.5);
  const live = (r) => H('tr', null, H('td', { text: tlName(r.tl) }), H('td', null, pill(r.status)), H('td', { text: r.text }));
  const th = H('thead', null, H('tr', null, ['Timeline', 'Status', 'Numbers'].map((t) => H('th', { text: t }))));
  root.append(card('Live check A: the leading NPC lab reaches SC inside the AIFM band', 'Pass when the median (over runs) date the first NPC lab reached SC is inside the timeline\'s 25th-75th percentile. SC = AIFM "AC".', H('div', { class: 'chart' }, H('table', { class: 'dt' }, th.cloneNode(true), H('tbody', null, scRows.map(live))))));
  root.append(card('Live check B: unemployment in Nov 2026 is within 0.5 points of BLS', 'Last real value is ' + bls.label + ' (' + bls.value + '%); the game sample nearest Nov 2026 is compared (median over runs).', H('div', { class: 'chart' }, H('table', { class: 'dt' }, th, H('tbody', null, unRows.map(live))))));
  const cut = WD.dayOfIso(D.names.startDate, '2026-11-01');
  const live3 = (r) => H('tr', null, H('td', { text: tlName(r.tl) }), H('td', null, statusPill(r.status)), H('td', { text: r.text }));
  const tbl = (rows) => H('div', { class: 'chart' }, H('table', { class: 'dt' }, th.cloneNode(true), H('tbody', null, rows.map(live3))));
  const concern = WD.checkNear(GROUPS, (x) => x.public.concern, 50, 4, 2026.85, '');
  root.append(card('Live check B2: concern in Nov 2026 is within 50 +/- 4 (Pew)', 'The game sample nearest Nov 2026 against Pew\'s "more concerned than excited" (about 50%, flat since 2023); median over runs.', tbl(concern)));
  root.append(card('Live check C: S1/S3 history part. US stage 0 and no conditional law through Nov 2026', 'Every record: no stage reached and no conditional law (export controls, licensing, relief, UBI, human-in-the-loop, special zones, FDA fast track) on or before day ' + cut + ' (1 Nov 2026). Real history has none of these before then. Law days are exact; a law that came and went between two quarterly samples is not seen.', tbl(WD.checkQuietUS(GROUPS, cut, D.names))));
  root.append(card('Live check D: S7 dated laws switch on at their real dates', 'The game\'s first day in force (data/v2/laws.ts) against the real date (balance/world-history.ts), within 1 day; and every sample in every record agrees with that day (law in force exactly from it on). Laws with no real date in the table are not compared.', tbl(WD.checkDatedLaws(GROUPS, D.names))));
  root.append(card('Live check E: China\'s national collective does not form before 2027', 'Real history has none. Read from the quarterly samples: the first sample in which China is centralised must be in 2027 or later.', tbl(WD.checkCollective(GROUPS))));
  root.append(card('Live check F: stage order and lag', 'Each record\'s stage days increase, and each stage comes at least 60 days after the milestone that enables it (stage 1: research agent; 2: superhuman coder; 3: superhuman AI researcher; 4: superintelligent AI researcher), as the government saw it (observe.govMilestones, the same as publicMilestones when the player does not brief). A stage that came before its milestone came by another trigger (a theft or high concern): noted here, judged by check C.', tbl(WD.checkStageOrder(GROUPS, 60, D.names))));
  root.append(card('Not testable here: no stage-2+ event for the observer player', 'Needs the record\'s events, which observer records do not carry. The observer player\'s attention (series, per quarter) is in the Reactions tab for the leading and China labs; the player\'s own highest attention is ' + f1(Math.max(...RECS.flatMap((r) => r.series.map((x) => (x.labs.find((l) => l.kind === 'observer') || { attention: 0 }).attention)))) + ' against the threshold ' + D.names.attentionMin + '.', H('div', { class: 'empty', text: 'Not testable here: no events in the record.' })));
  return root;
}

// ---------------------------------------------------------------- tab: Parameters
function tabParams() {
  const root = H('div');
  const q = H('input', { type: 'search', placeholder: 'Filter by id, source or area', style: 'padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);width:320px' });
  const body = H('tbody');
  const draw = () => {
    const t = q.value.toLowerCase();
    body.textContent = '';
    for (const p of D.params.rows) {
      if (t && !(p.id + ' ' + p.area + ' ' + (p.actor || '') + ' ' + (p.source || '')).toLowerCase().includes(t)) continue;
      const v = p.value == null ? '—' : typeof p.value === 'object' ? JSON.stringify(p.value) : String(p.value);
      body.append(H('tr', null, H('td', { class: 'mono', text: p.id }), H('td', { text: p.area + (p.actor ? ' / ' + p.actor : '') }), H('td', { class: 'mono', text: v.length > 60 ? v.slice(0, 59) + '…' : v }), H('td', { text: p.unit || '' }), H('td', { text: p.kind }), H('td', { text: p.source || '' })));
    }
  };
  q.addEventListener('input', draw); draw();
  root.append(card('Outside-world parameters (' + D.params.rows.length + ')', 'Registry params (balance/params) in areas ' + D.params.areas.join(', ') + ', plus any param whose actor is ' + D.params.actors.join(', ') + '. Kind: sourced = from a source; derived; fitted = fit to targets; designer = a designer choice; stand-in; untagged.', H('div', { class: 'filters' }, q),
    H('div', { class: 'chart' }, H('table', { class: 'dt' }, H('thead', null, H('tr', null, ['Id', 'Area / actor', 'Value', 'Unit', 'Kind', 'Source'].map((t) => H('th', { text: t })))), body))));
  return root;
}

// ---------------------------------------------------------------- shell
const TABS = [['hist', 'History', tabHistory], ['riv', 'Rivals', tabRivals], ['rea', 'Reactions', tabReactions], ['end', 'Endings', tabEndings], ['chk', 'Checks', tabChecks], ['par', 'Parameters', tabParams]];
document.getElementById('meta').textContent = `${RECS.length} observer run${RECS.length === 1 ? '' : 's'} from ${D.runNames.join(', ')} · timelines: ${GROUPS.map((g) => tlName(g.id) + ' ' + g.recs.length).join(', ')} · generated ${D.generated.slice(0, 16).replace('T', ' ')}`;
const tabsEl = document.getElementById('tabs'), panelsEl = document.getElementById('panels');
function show(id) {
  for (const b of tabsEl.children) b.setAttribute('aria-selected', String(b.dataset.tab === id));
  for (const p of panelsEl.children) p.hidden = p.dataset.tab !== id;
  try { location.hash = id; } catch (e) { /* ignore */ }
}
for (const [id, label, build] of TABS) {
  tabsEl.append(H('button', { role: 'tab', 'data-tab': id, 'aria-selected': 'false', text: label, onclick: () => show(id) }));
  const p = H('section', { class: 'panel', 'data-tab': id, hidden: true });
  try { p.append(build()); } catch (e) { p.append(H('div', { class: 'empty', text: 'This tab failed to build: ' + e.message })); console.error(e); }
  panelsEl.append(p);
}
show(TABS.some((t) => t[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'hist');
const root = document.documentElement, themeBtn = document.getElementById('theme');
root.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const syncTheme = () => { themeBtn.textContent = root.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode'; };
themeBtn.onclick = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; syncTheme(); };
syncTheme();
