'use strict';
// Balance dashboard client. Vanilla JS + SVG, no network. Data is inlined by scripts/v2/baldash.ts.
// All text from data goes in through textContent / createTextNode, never innerHTML.
const D = JSON.parse(document.getElementById('data').textContent);
const NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------- DOM helpers
function H(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
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
const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
const trunc = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s);

// ---------------------------------------------------------------- numbers
const sum = (a) => a.reduce((s, v) => s + v, 0);
function pct(a, p) { // linear interpolation between order statistics, a sorted ascending
  if (!a.length) return null;
  const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
}
function wilson(k, n) {
  if (!n) return null;
  const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), a = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { p, lo: Math.max(0, (c - a) / d), hi: Math.min(1, (c + a) / d) };
}
// Game day -> decimal calendar year, same convention as src/engine/v2/core/time.ts decimalYearOf (day 0 = startDate).
const START_MS = Date.parse(D.startDate + 'T00:00:00Z');
function yearOf(day) {
  const d = new Date(START_MS + day * 86400000);
  return d.getUTCFullYear() + d.getUTCMonth() / 12 + (d.getUTCDate() - 1) / 365;
}
const fy = (day) => (day == null ? '—' : yearOf(day).toFixed(1));
const fyr = (y) => (y == null ? '—' : y.toFixed(1)); // already a year
const fp = (x, d = 0) => (x == null ? '—' : (x * 100).toFixed(d) + '%');
const NR = 'not recorded';
function niceTicks(lo, hi, n) {
  const raw = (hi - lo) / n || 1, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, t = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) t.push(+v.toFixed(6));
  return { ticks: t, step };
}
function fmtVal(v) {
  if (v == null) return '—';
  if (typeof v === 'number') return String(+v.toPrecision(6));
  if (Array.isArray(v)) return '[' + v.map((x) => (typeof x === 'number' ? +x.toPrecision(5) : x)).join(', ') + ']';
  return String(v);
}

// ---------------------------------------------------------------- plain-language names
const MS_ORDER = ['SC', 'SAR', 'SIAR', 'ASI'];
const MS_NAME = { SC: 'Superhuman coder', SAR: 'Superhuman AI researcher', SIAR: 'Superintelligent AI researcher', ASI: 'Artificial superintelligence' };
const MS_DEF = {
  SC: 'SC: an AI that can do the job of the best human coder, much faster and cheaper.',
  SAR: 'SAR: an AI that can do the job of the best human AI researcher.',
  SIAR: 'SIAR: an AI far better than the best human AI researcher.',
  ASI: 'ASI: an AI far better than humans at nearly every cognitive task.',
};
const AREA_NAME = { capability: 'Capability', research: 'Research', safety: 'Safety', security: 'Security', market: 'Market', finance: 'Finance', worldfx: 'World effects', actors: 'Actors', bots: 'Bots', core: 'Core' };
const AREA_ORDER = Object.keys(AREA_NAME);
const ACTOR_NAME = { player: 'Player', rivals: 'Rivals', leader: 'Leader lab', china: 'China', gov: 'Government', public: 'Public', model: 'AI model', all: 'All actors' };
const LAYER_NAME = { world: 'How the world works', policy: 'How an actor chooses' };
const KIND_ORDER = ['sourced', 'derived', 'fitted', 'designer', 'stand-in', 'untagged', 'unclear'];
const KIND_NAME = { sourced: 'Sourced', derived: 'Derived', fitted: 'Fitted', designer: 'Designer', 'stand-in': 'Stand-in', untagged: 'Untagged', unclear: 'Unclear' };
const KIND_DEF = {
  sourced: 'A cited paper, data set or research note states this number. It may move only within its source’s range.',
  derived: 'Computed from other numbers; it follows them.',
  fitted: 'Tuned against targets. The tooling may refit it.',
  designer: 'A design choice. Only the designer moves it.',
  'stand-in': 'A placeholder guess until a real source or fit exists. Only the designer moves it.',
  untagged: 'No tag in the code says where this number comes from yet.',
  unclear: 'The tags conflict or the constant can’t be told; a question is open.',
};
const TYPE_ORDER = ['point', 'interval', 'rate', 'trajectory', 'response', 'ordering', 'invariant', 'distribution'];
const TYPE_NAME = { point: 'Point', interval: 'Interval', rate: 'Rate', trajectory: 'Trajectory', response: 'Response', ordering: 'Ordering', invariant: 'Invariant', distribution: 'Distribution' };
const TYPE_DEF = {
  point: 'One number at one moment, within a tolerance.', interval: 'A value that must fall in a range.', rate: 'A rate of change.',
  trajectory: 'A shape over time.', response: 'How an outcome moves when an input moves.', ordering: 'A must-come-before relation between two things.',
  invariant: 'Something that must always hold.', distribution: 'A spread across seeds.',
};
const ROLE_ORDER = ['fit', 'holdout', 'invariant', 'info', 'unassigned'];
const ROLE_NAME = { fit: 'Used to fit', holdout: 'Held out', invariant: 'Invariant', info: 'Information only', unassigned: 'Not assigned' };
const ROLE_DEF = {
  fit: 'A parameter is tuned to hit this target.', holdout: 'Not used for fitting; checked afterwards.', invariant: 'Must always hold.',
  info: 'Reported for information; failing it is not a gate.', unassigned: 'The code does not say what this target is for yet.',
};
const VERDICTS = ['win', 'mixed', 'loss'];
const VERDICT_NAME = { win: 'Win', mixed: 'Mixed', loss: 'Loss' };
const NAMES = D.names || {};
const dispName = (kind, id) => (NAMES[kind] && NAMES[kind][id]) || String(id);
const endTitle = (id) => (NAMES.ending && NAMES.ending[id]) || prettify(id);
const endFull = (id) => (NAMES.ending && NAMES.ending[id] ? `${NAMES.ending[id]} (${id})` : String(id));
const prettify = (s) => { const t = String(s).replace(/[_-]+/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };

// ---------------------------------------------------------------- tooltip (one shared element)
const tipEl = document.getElementById('tip');
function tipFill(c) {
  clear(tipEl);
  if (c.title) tipEl.append(H('div', { class: 'th', text: c.title }));
  for (const r of c.rows || []) {
    const row = H('div', { class: 'tr' + (r.hl ? ' hl' : '') });
    row.append(H('i', { class: 'kk', style: { borderTopColor: r.c || 'transparent' } }));
    row.append(H('b', { text: r.v }), H('span', { class: 'nm', text: r.n }));
    tipEl.append(row);
  }
  for (const l of c.lines || []) {
    const d = H('div', { class: 'tx' });
    if (Array.isArray(l)) d.append(H('b', { text: l[0] + ': ' }), document.createTextNode(l[1]));
    else d.append(document.createTextNode(l));
    tipEl.append(d);
  }
}
function tipShow(c, x, y) {
  tipFill(c);
  tipEl.style.display = 'block';
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let left = x + 14, top = y + 14;
  if (left + w > innerWidth - 8) left = Math.max(8, x - w - 14);
  if (top + h > innerHeight - 8) top = Math.max(8, y - h - 14);
  tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
}
const tipHide = () => { tipEl.style.display = 'none'; };
const tipText = (c) => [c.title, ...(c.rows || []).map((r) => `${r.n} ${r.v}`), ...(c.lines || []).map((l) => (Array.isArray(l) ? l.join(': ') : l))].filter(Boolean).join('. ');
/** Hover and keyboard-focus tooltip on any element. get() builds the content lazily. */
function bindTip(el, get, extra) {
  el.addEventListener('pointerenter', (e) => { extra && extra.on && extra.on(); tipShow(get(), e.clientX, e.clientY); });
  el.addEventListener('pointermove', (e) => tipShow(get(), e.clientX, e.clientY));
  el.addEventListener('pointerleave', () => { extra && extra.off && extra.off(); tipHide(); });
  el.addEventListener('focus', () => { extra && extra.on && extra.on(); const r = el.getBoundingClientRect(); tipShow(get(), r.left + r.width / 2, r.top + r.height / 2); });
  el.addEventListener('blur', () => { extra && extra.off && extra.off(); tipHide(); });
}
const infoTip = (text, label) => { const e = H('span', { class: 'tips', tabindex: '0', text: label }); bindTip(e, () => ({ lines: [text] })); return e; };

// ---------------------------------------------------------------- theme, patterns, tabs
const root = document.documentElement;
const dark = matchMedia('(prefers-color-scheme: dark)').matches;
root.dataset.theme = dark ? 'dark' : 'light';
const themeBtn = document.getElementById('theme');
const syncTheme = () => { themeBtn.textContent = root.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode'; };
themeBtn.onclick = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; syncTheme(); };
syncTheme();
const texBtn = document.getElementById('tex');
texBtn.onclick = () => { const on = !document.body.classList.contains('tex'); document.body.classList.toggle('tex', on); texBtn.setAttribute('aria-pressed', String(on)); };
const renderers = { out: null, par: null, tgt: null, scn: null };
const rendered = {};
function showTab(t) {
  for (const b of document.querySelectorAll('nav.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === t));
  for (const k of ['out', 'par', 'tgt', 'scn']) document.getElementById('p-' + k).hidden = k !== t;
  if (!rendered[t]) { rendered[t] = true; renderers[t](); } else if (renderers[t + '_re']) renderers[t + '_re']();
}
for (const b of document.querySelectorAll('nav.tabs button')) b.onclick = () => showTab(b.dataset.tab);

// ---------------------------------------------------------------- shared chart pieces
const slotColor = (i) => (i < 8 ? `var(--s${i + 1})` : 'var(--other)');
const slotOn = (i) => (i < 8 ? `var(--on-s${i + 1})` : 'var(--on-other)');
const TEX = ['tex45a', 'tex135a', 'tex45b', 'tex135b'];
function legend(items) {
  return H('div', { class: 'legend' }, items.map((it) => {
    const sw = it.tick ? H('span', { class: 'tk' }) : H('span', { class: 'sw', style: { background: it.color } });
    const el = H('span', { class: 'it', tabindex: it.tip ? '0' : null }, sw, it.name);
    if (it.tip) bindTip(el, () => ({ lines: [it.tip] }));
    return el;
  }));
}

/**
 * Horizontal stacked bars, one row per entry. rows: [{label, dot, segs:[{key,name,color,on,count,tex}], tipTitle, whisker:{p,lo,hi}, right}]
 * o: {mode:'pct'|'count', labelW, rightW, onSeg(row,seg), rowTipExtra(row)}
 */
function stackedRows(host, rows, o) {
  clear(host);
  const W = Math.max(host.clientWidth || 800, 620), labelW = o.labelW || 230, rightW = o.rightW || 0, padR = 14;
  const barX = labelW, barW = W - labelW - rightW - padR, barH = 14, top = 6, axisH = 24;
  const rowH = rows.some((r) => r.whisker) ? 38 : 30, H_ = top + rows.length * rowH + axisH;
  const xmax = o.mode === 'count' ? Math.max(1, ...rows.map((r) => sum(r.segs.map((s) => s.count)))) : 1;
  const xt = o.mode === 'count' ? niceTicks(0, xmax, 5).ticks : [0, 0.25, 0.5, 0.75, 1];
  const xtop = o.mode === 'count' ? Math.max(xmax, xt[xt.length - 1]) : 1;
  const xs = (v) => barX + (v / xtop) * barW;
  const svg = S('svg', { width: W, height: H_, role: 'group', 'aria-label': o.aria || 'Stacked bars' });
  for (const t of xt) {
    svg.append(S('line', { x1: xs(t), x2: xs(t), y1: top, y2: top + rows.length * rowH, stroke: 'var(--grid)', 'stroke-width': 1 }));
    svg.append(S('text', { x: xs(t), y: top + rows.length * rowH + 16, 'text-anchor': 'middle', class: 't-muted' }, o.mode === 'count' ? String(t) : Math.round(t * 100) + '%'));
  }
  svg.append(S('line', { x1: barX, x2: barX, y1: top, y2: top + rows.length * rowH, stroke: 'var(--axis)', 'stroke-width': 1 }));
  rows.forEach((row, i) => {
    const total = sum(row.segs.map((s) => s.count));
    const cy = top + i * rowH + (row.whisker ? 14 : rowH / 2), by = cy - barH / 2;
    const g = S('g');
    if (row.dot) g.append(S('circle', { cx: 8, cy, r: 4.5, style: `fill:${row.dot}` }));
    g.append(S('text', { x: row.dot ? 20 : 4, y: cy + 4, class: 't-ink' }, trunc(row.label, Math.floor((labelW - 30) / 6.2))));
    let cur = barX;
    const segRects = [];
    row.segs.forEach((seg, si) => {
      if (!seg.count) return;
      const frac = o.mode === 'count' ? seg.count / xtop : seg.count / (total || 1);
      const w = frac * barW, vw = Math.max(w - 2, 0.8);
      const rect = S('rect', { x: cur, y: by, width: vw, height: barH, rx: 3, style: `fill:${seg.color}` });
      const tex = S('rect', { x: cur, y: by, width: vw, height: barH, rx: 3, class: 'texo', fill: `url(#${TEX[(seg.tex ?? si) % 4]})` });
      g.append(rect, tex);
      const label = o.mode === 'count' ? String(seg.count) : Math.round((seg.count / total) * 100) + '%';
      if (vw >= label.length * 6.8 + 12) g.append(S('text', { x: cur + 6, y: cy + 4, style: `fill:${seg.on}; font-weight:600`, 'pointer-events': 'none' }, label));
      const hit = S('rect', { x: cur - 1, y: top + i * rowH, width: w + 1, height: rowH - 2, class: 'hit', tabindex: '0' });
      const get = () => ({
        title: row.tipTitle || row.label,
        rows: row.segs.filter((s) => s.count).map((s) => ({ c: s.color, v: o.mode === 'count' ? String(s.count) : `${s.count} (${((s.count / total) * 100).toFixed(0)}%)`, n: s.name, hl: s === seg })),
        lines: [...(row.whisker ? [`Win rate ${fp(row.whisker.p)}, 95% interval ${fp(row.whisker.lo)} to ${fp(row.whisker.hi)}`] : []), ...(o.rowTipExtra ? o.rowTipExtra(row, seg) : []), `${total} in total`],
      });
      hit.setAttribute('aria-label', tipText(get()));
      bindTip(hit, get, { on: () => rect.classList.add('lift'), off: () => rect.classList.remove('lift') });
      if (o.onSeg) { hit.style.cursor = 'pointer'; hit.addEventListener('click', () => o.onSeg(row, seg)); hit.addEventListener('keydown', (e) => { if (e.key === 'Enter') o.onSeg(row, seg); }); }
      segRects.push(hit);
      cur += w;
    });
    if (row.whisker) {
      const w = row.whisker, y = by + barH + 8, nx = (v) => barX + v * barW;
      g.append(S('line', { x1: nx(w.lo), x2: nx(w.hi), y1: y, y2: y, stroke: 'var(--ink2)', 'stroke-width': 1.5 }));
      g.append(S('line', { x1: nx(w.lo), x2: nx(w.lo), y1: y - 3, y2: y + 3, stroke: 'var(--ink2)', 'stroke-width': 1.5 }));
      g.append(S('line', { x1: nx(w.hi), x2: nx(w.hi), y1: y - 3, y2: y + 3, stroke: 'var(--ink2)', 'stroke-width': 1.5 }));
      g.append(S('circle', { cx: nx(w.p), cy: y, r: 3.5, style: 'fill:var(--ink);stroke:var(--surface);stroke-width:2' }));
    }
    if (row.right) g.append(S('text', { x: barX + barW + 10, y: cy + 4, class: 't-muted' }, row.right));
    svg.append(g, ...segRects);
  });
  host.append(svg);
}

// ================================================================ TAB 1: OUTCOMES
const RUNS = D.runs;
const ALL = RUNS.flatMap((r) => r.games.map((g) => Object.assign({}, g, { run: r.name })));
const DIMS = [['run', 'Run'], ['world', 'World'], ['alignment', 'Alignment'], ['start', 'Start'], ['policy', 'Policy']];
const DIMVALS = {};
for (const [d] of DIMS) DIMVALS[d] = [...new Set(ALL.map((g) => g[d]))].sort((a, b) => (d === 'run' ? RUNS.findIndex((r) => r.name === a) - RUNS.findIndex((r) => r.name === b) : String(a).localeCompare(String(b))));
const sel = {};
for (const [d] of DIMS) sel[d] = new Set(DIMVALS[d]);
// Fixed colours: policy by its place in the sorted list of all policies, ending by overall frequency, so filters never repaint.
const POLICY_SLOT = new Map(DIMVALS.policy.map((p, i) => [p, i]));
const ENDING_COUNT = new Map();
for (const g of ALL) if (g.ending) ENDING_COUNT.set(g.ending, (ENDING_COUNT.get(g.ending) || 0) + 1);
const ENDING_ORDER = [...ENDING_COUNT.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map((e) => e[0]);
const ovKey = (g) => (g.overrides ? Object.keys(g.overrides).sort().map((k) => `${k}=${g.overrides[k]}`).join(', ') : '');
const targetById = new Map(D.targets.map((t) => [t.id, t]));
function targetFor(world, ms, policy) {
  const pref = /leader/i.test(policy) ? ['T1L', 'T1'] : ['T1', 'T1L'];
  for (const p of pref) { const t = targetById.get(`${p}.${world}.${ms}`); if (t && t.value && t.value.p50 != null && t.value.unit === 'year') return t; }
  return null;
}
function buildCells(games) {
  const map = new Map();
  for (const g of games) {
    const key = [g.run, g.world, g.alignment, g.start, g.policy, ovKey(g)].join('\u0001');
    let c = map.get(key);
    if (!c) { c = { run: g.run, world: g.world, alignment: g.alignment, start: g.start, policy: g.policy, ov: ovKey(g), games: [] }; map.set(key, c); }
    c.games.push(g);
  }
  const cells = [...map.values()];
  for (const c of cells) {
    c.n = c.games.length;
    c.v = { win: 0, mixed: 0, loss: 0, other: 0 };
    c.endings = new Map();
    for (const g of c.games) {
      if (g.verdict in c.v) c.v[g.verdict]++; else c.v.other++;
      if (g.ending) c.endings.set(g.ending, (c.endings.get(g.ending) || 0) + 1);
    }
    c.ci = { win: wilson(c.v.win, c.n), mixed: wilson(c.v.mixed, c.n), loss: wilson(c.v.loss, c.n) };
    c.ms = {};
    for (const m of MS_ORDER) {
      const vals = c.games.map((g) => g.milestones && g.milestones[m]).filter((v) => typeof v === 'number').sort((a, b) => a - b);
      c.ms[m] = { reached: vals.length, p10: pct(vals, 0.1), p50: pct(vals, 0.5), p90: pct(vals, 0.9) };
    }
    const ins = c.games.filter((g) => typeof g.insolvent === 'boolean');
    c.ins = { known: ins.length, yes: ins.filter((g) => g.insolvent).length };
    const pm = c.games.map((g) => g.pMisAtASI).filter((v) => typeof v === 'number').sort((a, b) => a - b);
    c.pmis = { known: pm.length, p50: pct(pm, 0.5) };
  }
  const idx = (d, v) => DIMVALS[d].indexOf(v);
  cells.sort((a, b) => idx('world', a.world) - idx('world', b.world) || idx('alignment', a.alignment) - idx('alignment', b.alignment) || idx('start', a.start) - idx('start', b.start) || idx('policy', a.policy) - idx('policy', b.policy) || idx('run', a.run) - idx('run', b.run) || a.ov.localeCompare(b.ov));
  const varies = (d) => new Set(cells.map((c) => c[d])).size > 1;
  const showDims = DIMS.map((x) => x[0]).filter((d) => d === 'world' || d === 'policy' || varies(d));
  for (const c of cells) c.label = [...showDims.map((d) => dispName(d, c[d])), ...(c.ov ? ['+overrides'] : [])].join(' · ');
  return cells;
}
const cellFull = (c) => `${c.run} · ${dispName('world', c.world)} · ${c.alignment} · ${dispName('start', c.start)} · ${c.policy}` + (c.ov ? ` · ${c.ov}` : '');

function filteredGames() { return ALL.filter((g) => DIMS.every(([d]) => sel[d].has(g[d]))); }

function tileEl(label, value, sub, hero, tip) {
  const t = H('div', { class: 'tile' + (hero ? ' hero' : '') }, H('div', { class: 'k', text: label }), H('div', { class: 'v', text: value }), H('div', { class: 's', text: sub }));
  if (tip) { t.tabIndex = 0; bindTip(t, () => ({ lines: [tip] })); }
  return t;
}
function medianTile(label, games, getVal, fmt, what, tip) {
  const vals = games.map(getVal).filter((v) => typeof v === 'number').sort((a, b) => a - b);
  if (!vals.length) return tileEl(label, '—', `${NR} / not reached in any of ${games.length} games`, false, tip);
  return tileEl(label, fmt(pct(vals, 0.5)), `${what} ${vals.length} of ${games.length} games`, false, tip);
}

function renderOutcomes() {
  const host = document.getElementById('p-out');
  clear(host);
  const nTotal = ALL.length;
  if (!nTotal) { host.append(H('div', { class: 'empty', text: 'The selected runs have no finished games yet.' })); return; }
  // filter row
  const flt = H('div', { class: 'filters' }, H('span', { class: 'lbl', text: 'Show' }));
  const body = H('div');
  const view = { mode: 'charts' };
  const upd = [];
  for (const [d, name] of DIMS) {
    const det = H('details', { class: 'flt' });
    const sumB = H('b');
    const pop = H('div', { class: 'pop' });
    const boxes = [];
    const all = H('input', { type: 'checkbox' });
    const allL = H('label', {}, all, H('b', { text: 'All' }));
    pop.append(allL);
    for (const v of DIMVALS[d]) {
      const cb = H('input', { type: 'checkbox' });
      cb.checked = true;
      cb.onchange = () => { cb.checked ? sel[d].add(v) : sel[d].delete(v); refresh(); renderBody(); };
      boxes.push([v, cb]);
      pop.append(H('label', {}, cb, dispName(d, v) || '(none)'));
    }
    all.onchange = () => { for (const v of DIMVALS[d]) all.checked ? sel[d].add(v) : sel[d].delete(v); refresh(); renderBody(); };
    const refresh = () => {
      for (const [v, cb] of boxes) cb.checked = sel[d].has(v);
      all.checked = sel[d].size === DIMVALS[d].length;
      sumB.textContent = sel[d].size === DIMVALS[d].length ? 'all' : sel[d].size === 1 ? dispName(d, [...sel[d]][0]) : `${sel[d].size} of ${DIMVALS[d].length}`;
    };
    upd.push(refresh); refresh();
    det.append(H('summary', {}, name, sumB), pop);
    det.addEventListener('toggle', () => { if (det.open) for (const o of flt.querySelectorAll('details.flt')) if (o !== det) o.open = false; });
    flt.append(det);
  }
  document.addEventListener('click', (e) => { if (!flt.contains(e.target)) for (const o of flt.querySelectorAll('details.flt')) o.open = false; });
  const ctl = H('div', { class: 'seg-ctl' });
  const bC = H('button', { 'aria-pressed': 'true', text: 'Charts' }), bT = H('button', { 'aria-pressed': 'false', text: 'Table' });
  const setMode = (m) => { view.mode = m; bC.setAttribute('aria-pressed', String(m === 'charts')); bT.setAttribute('aria-pressed', String(m === 'table')); renderBody(); };
  bC.onclick = () => setMode('charts'); bT.onclick = () => setMode('table');
  ctl.append(bC, bT);
  flt.append(ctl);
  host.append(flt, body);

  function renderBody() {
    clear(body);
    const games = filteredGames();
    if (!games.length) { body.append(H('div', { class: 'empty', text: 'No games match these filters.' })); return; }
    const cells = buildCells(games);
    body.append(tilesFor(games, cells));
    if (view.mode === 'table') { body.append(outcomeTable(cells)); return; }
    const cards = [cardMilestones(cells), cardVerdicts(cells), cardEndings(cells)];
    body.append(...cards);
    for (const c of cards) c.draw(); // drawn after attaching, so the chart can measure its width
  }
  renderers.out_re = () => renderBody();
  window.addEventListener('resize', () => { if (!document.getElementById('p-out').hidden && view.mode === 'charts') { clearTimeout(renderBody.t); renderBody.t = setTimeout(renderBody, 120); } });
  renderBody();
}
renderers.out = renderOutcomes;

function tilesFor(games, cells) {
  const n = games.length;
  const win = games.filter((g) => g.verdict === 'win').length, w = wilson(win, n);
  const ins = games.filter((g) => typeof g.insolvent === 'boolean');
  const insY = ins.filter((g) => g.insolvent).length, wi = wilson(insY, ins.length);
  const row = H('div', { class: 'tiles' });
  row.append(
    tileEl('Win rate', fp(w.p), `95% interval ${fp(w.lo)} to ${fp(w.hi)} · ${win} of ${n} games · ${cells.length} cell${cells.length === 1 ? '' : 's'} pooled`, true, 'Share of games the end screen calls a win. The interval is a Wilson 95% interval over the selected games, pooled across cells.'),
    medianTile('Superhuman coder (median year)', games, (g) => g.milestones && g.milestones.SC != null ? yearOf(g.milestones.SC) : null, fyr, 'reached in', MS_DEF.SC),
    medianTile('Artificial superintelligence (median year)', games, (g) => g.milestones && g.milestones.ASI != null ? yearOf(g.milestones.ASI) : null, fyr, 'reached in', MS_DEF.ASI),
    ins.length ? tileEl('Ran out of money', fp(wi.p), `95% interval ${fp(wi.lo)} to ${fp(wi.hi)} · ${insY} of ${ins.length} games`, false, 'Share of games in which the player went insolvent.')
      : tileEl('Ran out of money', '—', `insolvency ${NR}`, false),
    medianTile('Misalignment chance at ASI (median)', games, (g) => g.pMisAtASI, (v) => fp(v), 'recorded in', 'P_mis: the model’s probability of being misaligned when artificial superintelligence arrives.'),
  );
  return row;
}

function cardWrap(title, sub) { return H('div', { class: 'card' }, H('h2', { text: title }), H('div', { class: 'sub', text: sub })); }

// ---- (a) milestone years
function cardMilestones(cells) {
  const card = cardWrap('When each milestone arrives', 'Median year (dot) with the 10th to 90th percentile range across seeds, one row per cell, each world on its own axis. Black tick = the target year, where the registry has one.');
  const pols = [...new Set(cells.map((c) => c.policy))];
  card.append(legend([...pols.map((p) => ({ name: p, color: slotColor(POLICY_SLOT.get(p)) })), { name: 'Target year', tick: true, tip: 'The year the registered target (balance/targets.ts, e.g. T1.ai2027.SC) expects for this world and milestone.' }]));
  const chart = H('div', { class: 'chart' });
  card.append(chart);
  card.draw = () => {
  const W = Math.max(chart.clientWidth || 1100, 980), labelW = 250, gap = 26, padR = 8, rowH = 26, top = 30, axisH = 24, groupGap = 10;
  const pw = (W - labelW - padR - gap * 3) / 4;
  // One block per world: the years differ by several years between worlds, so each block has its own axis per milestone.
  const groups = [];
  for (const c of cells) {
    let g = groups[groups.length - 1];
    if (!g || g.world !== c.world) { g = { world: c.world, cells: [], y0: 0 }; groups.push(g); }
    g.cells.push(c);
  }
  let yy = top;
  for (const g of groups) { g.y0 = yy; yy += g.cells.length * rowH + axisH + groupGap; }
  const svg = S('svg', { width: W, height: yy, role: 'group', 'aria-label': 'Milestone years per cell' });
  MS_ORDER.forEach((m, i) => {
    const x0 = labelW + i * (pw + gap);
    svg.append(S('text', { x: x0, y: 14, class: 't-head' }, MS_NAME[m]));
    const headHit = S('rect', { x: x0, y: 0, width: pw, height: 20, class: 'hit', tabindex: '0' });
    bindTip(headHit, () => ({ title: MS_NAME[m], lines: [MS_DEF[m]] }));
    svg.append(headHit);
  });
  for (const grp of groups) {
    const gc = grp.cells, y0 = grp.y0;
    gc.forEach((c, j) => {
      const cy = y0 + j * rowH + rowH / 2;
      svg.append(S('circle', { cx: 8, cy, r: 4.5, style: `fill:${slotColor(POLICY_SLOT.get(c.policy))}` }));
      svg.append(S('text', { x: 20, y: cy + 4, class: 't-ink' }, trunc(c.label, Math.floor((labelW - 28) / 6.2))));
    });
    MS_ORDER.forEach((m, i) => {
      const x0 = labelW + i * (pw + gap);
      const lo0 = [], hi0 = [];
      for (const c of gc) {
        const s = c.ms[m]; if (s.p10 != null) { lo0.push(yearOf(s.p10)); hi0.push(yearOf(s.p90)); }
        const t = targetFor(c.world, m, c.policy); if (t) { lo0.push(t.value.p50); hi0.push(t.value.p50); }
      }
      if (!lo0.length) { svg.append(S('text', { x: x0, y: y0 + 16, class: 't-muted' }, 'not reached in any selected game')); return; }
      let lo = Math.min(...lo0), hi = Math.max(...hi0);
      const pad = Math.max((hi - lo) * 0.12, 0.25); lo -= pad; hi += pad;
      const xs = (y) => x0 + ((y - lo) / (hi - lo)) * pw;
      const { ticks, step } = niceTicks(lo, hi, 3);
      const yb = y0 + gc.length * rowH;
      for (const t of ticks) {
        svg.append(S('line', { x1: xs(t), x2: xs(t), y1: y0, y2: yb, stroke: 'var(--grid)', 'stroke-width': 1 }));
        svg.append(S('text', { x: xs(t), y: yb + 16, 'text-anchor': 'middle', class: 't-muted' }, step < 1 ? t.toFixed(1) : String(Math.round(t))));
      }
      svg.append(S('line', { x1: x0, x2: x0 + pw, y1: yb, y2: yb, stroke: 'var(--axis)', 'stroke-width': 1 }));
      gc.forEach((c, j) => {
        const s = c.ms[m], cy = y0 + j * rowH + rowH / 2, col = slotColor(POLICY_SLOT.get(c.policy));
        const t = targetFor(c.world, m, c.policy);
        if (s.reached) {
          const a = xs(yearOf(s.p10)), b = xs(yearOf(s.p90));
          svg.append(S('rect', { x: a, y: cy - 3, width: Math.max(b - a, 2), height: 6, rx: 3, style: `fill:${col}` }));
          svg.append(S('rect', { x: a, y: cy - 3, width: Math.max(b - a, 2), height: 6, rx: 3, class: 'texo', fill: `url(#${TEX[POLICY_SLOT.get(c.policy) % 4]})` }));
        } else svg.append(S('text', { x: x0 + 4, y: cy + 4, class: 't-muted' }, 'not reached'));
        if (t) svg.append(S('rect', { x: xs(t.value.p50) - 1, y: cy - 9, width: 2, height: 18, style: 'fill:var(--ink)' }));
        if (s.reached) svg.append(S('circle', { cx: xs(yearOf(s.p50)), cy, r: 5, style: `fill:${col};stroke:var(--surface);stroke-width:2` }));
        const hit = S('rect', { x: x0, y: y0 + j * rowH, width: pw, height: rowH, class: 'hit', tabindex: '0' });
        const get = () => {
          const rows = s.reached ? [
            { c: col, v: `${fy(s.p50)}`, n: `Median (day ${Math.round(s.p50)})`, hl: true },
            { v: fy(s.p10), n: '10th percentile' }, { v: fy(s.p90), n: '90th percentile' },
          ] : [];
          const lines = [`Reached in ${s.reached} of ${c.n} games` + (s.reached ? '' : ' (not reached)')];
          if (t) lines.push(['Target', `${fyr(t.value.p50)} (${t.id})` + (typeof t.tolerance === 'string' && /±[\d.]+ y/.test(t.tolerance) ? `, tolerance ${t.tolerance.match(/±[\d.]+ y/)[0]}` : '')]);
          else lines.push('No registered target for this world and milestone');
          return { title: `${MS_NAME[m]} · ${cellFull(c)}`, rows, lines };
        };
        hit.setAttribute('aria-label', tipText(get()));
        bindTip(hit, get);
        svg.append(hit);
      });
    });
  }
  chart.append(svg);
  };
  return card;
}

// ---- (b) verdict mix
function cardVerdicts(cells) {
  const card = cardWrap('How the games ended: win, mixed or loss', 'Share of games per cell. The black dot and line under each bar are the win rate with its 95% interval (Wilson).');
  card.append(legend(VERDICTS.map((v) => ({ name: VERDICT_NAME[v], color: `var(--${v})` })).concat([{ name: 'Win rate with 95% interval', color: 'var(--ink2)', tip: 'Wilson 95% interval for the win share of this cell.' }])));
  const chart = H('div', { class: 'chart' });
  card.append(chart);
  const rows = cells.map((c) => ({
    label: c.label, tipTitle: cellFull(c),
    segs: VERDICTS.map((v, i) => ({ key: v, name: VERDICT_NAME[v], color: `var(--${v})`, on: `var(--on-${v})`, count: c.v[v], tex: i })),
    whisker: c.ci.win, right: `${fp(c.ci.win.p)} win · n=${c.n}`,
  }));
  card.draw = () => stackedRows(chart, rows, { mode: 'pct', labelW: 250, rightW: 110, aria: 'Verdict mix per cell', rowTipExtra: (row) => { const c = cells[rows.indexOf(row)]; return VERDICTS.map((v) => `${VERDICT_NAME[v]} ${fp(c.ci[v].p)} (95% interval ${fp(c.ci[v].lo)} to ${fp(c.ci[v].hi)})`); } });
  return card;
}

// ---- (c) ending mix
function cardEndings(cells) {
  const card = cardWrap('Which ending the games reached', 'Share of games per cell. The six most common endings overall have their own colour; the rest are folded into Other.');
  const present = ENDING_ORDER.filter((e) => cells.some((c) => c.endings.has(e)));
  const shown = present.filter((e) => ENDING_ORDER.indexOf(e) < 6), hasOther = present.some((e) => ENDING_ORDER.indexOf(e) >= 6) || cells.some((c) => c.games.some((g) => !g.ending));
  const items = shown.map((e) => ({ name: endTitle(e), color: slotColor(ENDING_ORDER.indexOf(e)) }));
  if (hasOther) items.push({ name: 'Other or not recorded', color: 'var(--other)' });
  card.append(legend(items));
  const chart = H('div', { class: 'chart' });
  card.append(chart);
  const rows = cells.map((c) => {
    const segs = shown.map((e) => ({ key: e, name: endFull(e), color: slotColor(ENDING_ORDER.indexOf(e)), on: slotOn(ENDING_ORDER.indexOf(e)), count: c.endings.get(e) || 0, tex: ENDING_ORDER.indexOf(e) }));
    const rest = c.n - sum(segs.map((s) => s.count));
    segs.push({ key: '_other', name: 'Other or not recorded', color: 'var(--other)', on: 'var(--on-other)', count: rest, tex: 7 });
    return { label: c.label, tipTitle: cellFull(c), segs, right: `n=${c.n}`, otherNames: [...c.endings.keys()].filter((e) => !shown.includes(e)) };
  });
  card.draw = () => stackedRows(chart, rows, { mode: 'pct', labelW: 250, rightW: 110, aria: 'Ending mix per cell', rowTipExtra: (row) => (row.otherNames.length ? ['Other includes: ' + row.otherNames.map((e) => `${endFull(e)} ${cells[rows.indexOf(row)].endings.get(e)}`).join(', ')] : []) });
  return card;
}

// ---- table twin of every outcome chart
function outcomeTable(cells) {
  const card = cardWrap('Summary cells', 'One row per cell: every value the charts show. Years are calendar years; the percentile columns are 10th, 50th, 90th.');
  const topEnd = ENDING_ORDER.slice(0, 6);
  const cols = [
    { label: 'Cell', get: (c) => c.label, tip: cellFull },
    { label: 'Games', get: (c) => c.n, num: true },
    { label: 'Win', get: (c) => c.ci.win.p, fmt: (v) => fp(v, 1), num: true },
    { label: 'Win 95% interval', get: (c) => c.ci.win.lo, fmt: (v, c) => `${fp(c.ci.win.lo, 1)} to ${fp(c.ci.win.hi, 1)}`, num: true },
    { label: 'Mixed', get: (c) => c.ci.mixed.p, fmt: (v) => fp(v, 1), num: true },
    { label: 'Mixed 95% interval', get: (c) => c.ci.mixed.lo, fmt: (v, c) => `${fp(c.ci.mixed.lo, 1)} to ${fp(c.ci.mixed.hi, 1)}`, num: true },
    { label: 'Loss', get: (c) => c.ci.loss.p, fmt: (v) => fp(v, 1), num: true },
    { label: 'Loss 95% interval', get: (c) => c.ci.loss.lo, fmt: (v, c) => `${fp(c.ci.loss.lo, 1)} to ${fp(c.ci.loss.hi, 1)}`, num: true },
  ];
  for (const m of MS_ORDER) {
    cols.push({ label: `${MS_NAME[m]} (${m}) p10 / p50 / p90`, get: (c) => c.ms[m].p50 ?? 1e9, fmt: (v, c) => (c.ms[m].reached ? `${fy(c.ms[m].p10)} / ${fy(c.ms[m].p50)} / ${fy(c.ms[m].p90)}` : 'not reached'), num: true });
    cols.push({ label: `${m} reached`, get: (c) => c.ms[m].reached, fmt: (v, c) => `${v} of ${c.n}`, num: true });
    cols.push({ label: `${m} target`, get: (c) => { const t = targetFor(c.world, m, c.policy); return t ? t.value.p50 : 1e9; }, fmt: (v, c) => { const t = targetFor(c.world, m, c.policy); return t ? fyr(t.value.p50) : 'none'; }, num: true });
  }
  cols.push({ label: 'Ran out of money', get: (c) => (c.ins.known ? c.ins.yes / c.ins.known : -1), fmt: (v, c) => (c.ins.known ? `${fp(v, 1)} (${c.ins.yes} of ${c.ins.known})` : NR), num: true });
  cols.push({ label: 'Misalignment chance at ASI (median)', get: (c) => c.pmis.p50 ?? -1, fmt: (v, c) => (c.pmis.known ? fp(c.pmis.p50, 1) : NR), num: true });
  for (const e of topEnd) cols.push({ label: endTitle(e), get: (c) => c.endings.get(e) || 0, fmt: (v, c) => `${v} (${fp(v / c.n)})`, num: true });
  cols.push({ label: 'Other endings', get: (c) => c.n - sum(topEnd.map((e) => c.endings.get(e) || 0)), num: true });
  const wrap = H('div', { class: 'tablewrap' });
  card.append(wrap);
  dataTable(wrap, cols, cells, { sort: { col: 0, dir: 1 }, limit: 5000 });
  return card;
}

// ---------------------------------------------------------------- generic sortable table
function dataTable(host, cols, rows, o) {
  const st = o.sort || { col: 0, dir: 1 };
  let limit = o.limit || 300;
  function draw() {
    clear(host);
    const sorted = rows.slice().sort((a, b) => {
      const c = cols[st.col], x = c.get(a), y = c.get(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''));
      return r * st.dir;
    });
    const thead = H('tr', {}, cols.map((c, i) => H('th', { class: c.num ? 'num' : '', onclick: () => { st.dir = st.col === i ? -st.dir : 1; st.col = i; draw(); } }, c.label, H('span', { class: 'ar', text: st.col === i ? (st.dir > 0 ? ' ▲' : ' ▼') : '' }))));
    const tb = H('tbody');
    for (const r of sorted.slice(0, limit)) {
      const tr = H('tr', {}, cols.map((c) => {
        const v = c.get(r);
        const txt = c.fmt ? c.fmt(v, r) : v == null || v === '' ? '—' : String(v);
        const td = H('td', { class: [c.num ? 'num' : '', c.mono ? 'mono' : '', c.clamp ? 'clamp' : '', c.nowrap ? 'nowrap' : ''].join(' ') });
        if (c.clamp) td.append(H('div', { text: txt })); else td.textContent = txt;
        return td;
      }));
      if (o.rowTip) bindTip(tr, () => o.rowTip(r));
      tb.append(tr);
    }
    host.append(H('table', { class: 'dt' }, H('thead', {}, thead), tb));
    if (sorted.length > limit) host.append(H('div', { style: { padding: '8px' } }, H('button', { class: 'btn', text: `Show all ${sorted.length} rows`, onclick: () => { limit = Infinity; draw(); } })));
    if (!sorted.length) host.append(H('div', { class: 'empty', text: 'Nothing matches.' }));
  }
  draw();
  return { redraw: (newRows) => { rows = newRows; limit = o.limit || 300; draw(); } };
}

// ================================================================ TAB 2: PARAMETERS
const kindColor = (k) => slotColor(KIND_ORDER.indexOf(k));
const kindOn = (k) => slotOn(KIND_ORDER.indexOf(k));
const P = D.params;
const pf = { q: '', area: '', layer: '', actor: '', kind: '', special: '' };
const actorName = (a) => (a ? ACTOR_NAME[a] || a : '(world-wide)');
function kindSegs(list) {
  return KIND_ORDER.map((k, i) => ({ key: k, name: KIND_NAME[k], color: kindColor(k), on: kindOn(k), count: list.filter((p) => p.kind === k).length, tex: i }));
}
function renderParams() {
  const host = document.getElementById('p-par');
  clear(host);
  const mkLegend = () => legend(KIND_ORDER.map((k) => ({ name: KIND_NAME[k], color: kindColor(k), tip: KIND_DEF[k] })));
  const c1 = cardWrap('Entries by area and kind', `${P.length} registry entries. Click a segment to filter the table below.`);
  c1.append(mkLegend());
  const ch1 = H('div', { class: 'chart' }); c1.append(ch1);
  const c2 = cardWrap('Policy entries by actor', 'Numbers that describe how an actor chooses (bots, rivals, China, government, public, player defaults). Click a segment to filter the table.');
  c2.append(mkLegend());
  const ch2 = H('div', { class: 'chart' }); c2.append(ch2);
  host.append(H('div', { class: 'cols2' }, c1, c2));
  const areas = AREA_ORDER.filter((a) => P.some((p) => p.area === a)).concat([...new Set(P.map((p) => p.area))].filter((a) => !AREA_ORDER.includes(a)));
  const drawCharts = () => {
    stackedRows(ch1, areas.map((a) => ({ label: AREA_NAME[a] || a, key: a, segs: kindSegs(P.filter((p) => p.area === a)), tipTitle: `${AREA_NAME[a] || a} area` })), {
      mode: 'count', labelW: 135, aria: 'Entries by area and kind', onSeg: (row, seg) => setPF({ area: row.key, kind: seg.key, layer: '', actor: '', special: '', q: '' }),
    });
    const pol = P.filter((p) => p.layer === 'policy');
    const actors = [...new Set(pol.map((p) => p.actor || ''))].sort((a, b) => pol.filter((p) => (p.actor || '') === b).length - pol.filter((p) => (p.actor || '') === a).length);
    stackedRows(ch2, actors.map((a) => ({ label: actorName(a || null), key: a, segs: kindSegs(pol.filter((p) => (p.actor || '') === a)), tipTitle: `${actorName(a || null)} (policy entries)` })), {
      mode: 'count', labelW: 135, aria: 'Policy entries by actor', onSeg: (row, seg) => setPF({ layer: 'policy', actor: row.key || '_none', kind: seg.key, area: '', special: '', q: '' }),
    });
  };
  drawCharts();
  renderers.par_re = drawCharts;
  window.addEventListener('resize', () => { if (!document.getElementById('p-par').hidden) { clearTimeout(drawCharts.t); drawCharts.t = setTimeout(drawCharts, 120); } });

  // to-do panel
  const hasFitTargets = (p) => p.fit && p.fit.targets && p.fit.targets.length;
  const groups = [
    { title: 'Untagged or unclear', why: 'No source, fit or design tag yet, or the tags conflict. Nobody knows who may move these.', test: (p) => p.kind === 'untagged' || p.kind === 'unclear', set: { special: 'todo-tag' } },
    { title: 'Fitted without a target', why: 'Marked as tuned, but no target says what it is tuned to.', test: (p) => p.kind === 'fitted' && !hasFitTargets(p), set: { special: 'todo-fit' } },
    { title: 'Stand-ins', why: 'Placeholder guesses waiting for a source or a fit.', test: (p) => p.kind === 'stand-in', set: { kind: 'stand-in' } },
  ];
  const todo = H('div', { class: 'card' }, H('h2', { text: 'To do' }), H('div', { class: 'sub', text: 'Registry entries that need a decision before balancing can trust them.' }));
  const tg = H('div', { class: 'todo', style: { gridTemplateColumns: 'repeat(3, 1fr)' } });
  for (const g of groups) {
    const list = P.filter(g.test);
    const it = H('div', { class: 'it' }, H('div', { class: 'n', text: String(list.length) }), H('div', {}, H('b', { text: g.title })), H('div', { class: 'd', text: g.why }));
    const chips = H('div', { class: 'chips' });
    for (const p of list.slice(0, 6)) chips.append(H('span', { class: 'chip', title: p.id, text: p.id, style: { cursor: 'pointer' }, onclick: () => setPF({ q: p.id, area: '', layer: '', actor: '', kind: '', special: '' }) }));
    if (list.length > 6) chips.append(H('span', { class: 'muted', text: `+${list.length - 6} more` }));
    it.append(chips, H('button', { class: 'btn', text: 'Show in table', onclick: () => setPF(Object.assign({ q: '', area: '', layer: '', actor: '', kind: '', special: '' }, g.set)) }));
    tg.append(it);
  }
  todo.append(tg);
  host.append(todo);

  // table
  const card = cardWrap('All parameters', 'Hover a row for its evidence, where it lives in the code, and any fit targets.');
  const tb = H('div', { class: 'toolbar' });
  const q = H('input', { type: 'search', placeholder: 'Search id, source, evidence, notes' });
  const mkSel = (key, label, opts) => { const s = H('select', { 'aria-label': label }, H('option', { value: '', text: `${label}: all` }), opts.map(([v, n]) => H('option', { value: v, text: n }))); s.onchange = () => setPF({ [key]: s.value, special: '' }); return s; };
  const sArea = mkSel('area', 'Area', areas.map((a) => [a, AREA_NAME[a] || a]));
  const sLayer = mkSel('layer', 'Layer', Object.entries(LAYER_NAME));
  const sActor = mkSel('actor', 'Actor', [...new Set(P.map((p) => p.actor || ''))].map((a) => [a || '_none', actorName(a || null)]));
  const sKind = mkSel('kind', 'Kind', KIND_ORDER.map((k) => [k, KIND_NAME[k]]));
  const count = H('span', { class: 'hint' });
  const clr = H('button', { class: 'btn', text: 'Clear filters', onclick: () => setPF({ q: '', area: '', layer: '', actor: '', kind: '', special: '' }) });
  tb.append(q, sArea, sLayer, sActor, sKind, clr, count);
  const wrap = H('div', { class: 'tablewrap' });
  card.append(tb, wrap);
  host.append(card);
  const cols = [
    { label: 'Id', get: (p) => p.id, mono: true, nowrap: true },
    { label: 'Area', get: (p) => AREA_NAME[p.area] || p.area },
    { label: 'Layer', get: (p) => (p.layer === 'policy' ? 'Actor choice' : 'World') },
    { label: 'Actor', get: (p) => actorName(p.actor), nowrap: true },
    { label: 'Kind', get: (p) => KIND_NAME[p.kind] || p.kind },
    { label: 'Value', get: (p) => (p.value == null ? '' : fmtVal(p.value)), fmt: (v, p) => (p.value == null ? 'field family' : v.length > 40 ? v.slice(0, 39) + '…' : v), mono: true },
    { label: 'Unit', get: (p) => p.unit || '' },
    { label: 'Source', get: (p) => p.source || '', clamp: true },
  ];
  const tipOf = (p) => ({
    title: p.id,
    rows: [{ c: kindColor(p.kind), v: KIND_NAME[p.kind], n: KIND_DEF[p.kind] }],
    lines: [['Evidence', p.evidence], ['Where', p.where], ...(p.value != null ? [['Value', fmtVal(p.value)]] : []), ...(p.source ? [['Source', p.source]] : []), ...(p.notes ? [['Notes', p.notes]] : []),
      ...(p.fit ? [['Fitted by', `${p.fit.script}${p.fit.targets && p.fit.targets.length ? ' against ' + p.fit.targets.join(', ') : ' (no targets listed)'}`]] : []),
      ...(p.range ? [['Range', `${p.range.lo} to ${p.range.hi} (${p.range.from})`]] : []), ...(p.grade ? [['Grade', p.grade]] : [])],
  });
  const test = (p) => {
    if (pf.area && p.area !== pf.area) return false;
    if (pf.layer && p.layer !== pf.layer) return false;
    if (pf.actor && (p.actor || '_none') !== pf.actor) return false;
    if (pf.kind && p.kind !== pf.kind) return false;
    if (pf.special === 'todo-tag' && !(p.kind === 'untagged' || p.kind === 'unclear')) return false;
    if (pf.special === 'todo-fit' && !(p.kind === 'fitted' && !hasFitTargets(p))) return false;
    if (pf.q) { const h = [p.id, p.source, p.evidence, p.notes, p.where].join(' ').toLowerCase(); if (!pf.q.toLowerCase().split(/\s+/).every((w) => h.includes(w))) return false; }
    return true;
  };
  const table = dataTable(wrap, cols, P.filter(test), { sort: { col: 0, dir: 1 }, rowTip: tipOf, limit: 250 });
  function sync() {
    q.value = pf.q; sArea.value = pf.area; sLayer.value = pf.layer; sKind.value = pf.kind;
    sActor.value = pf.actor;
    const rows = P.filter(test);
    table.redraw(rows);
    count.textContent = `${rows.length} of ${P.length} entries` + (pf.special ? ' (to-do filter)' : '');
  }
  q.oninput = () => { pf.q = q.value; pf.special = ''; sync(); };
  window.setPF = (patch) => {
    Object.assign(pf, patch);
    sync();
    if (patch.area !== undefined || patch.kind !== undefined || patch.special !== undefined || patch.q) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  sync();
}
function setPF(p) { window.setPF(p); }
renderers.par = renderParams;

// ================================================================ TAB 3: TARGETS
const T = D.targets;
const roleColor = (r) => (r === 'unassigned' ? 'var(--other)' : slotColor(ROLE_ORDER.indexOf(r)));
const roleOn = (r) => (r === 'unassigned' ? 'var(--on-other)' : slotOn(ROLE_ORDER.indexOf(r)));
const tf = { q: '', type: '', role: '', policy: '' };
function fmtTargetValue(t) {
  const v = t.value || {};
  const u = v.unit ? ' ' + v.unit : '';
  if (v.p50 != null && v.lo == null) return `${v.p50}${u}`;
  if (v.lo != null || v.hi != null) return `${v.lo ?? '…'} to ${v.hi ?? '…'}${v.p50 != null ? ` (middle ${v.p50})` : ''}${u}`;
  return '—';
}
function renderTargets() {
  const host = document.getElementById('p-tgt');
  clear(host);
  const types = TYPE_ORDER.filter((t) => T.some((x) => x.type === t));
  const c1 = cardWrap('Targets by type and role', `${T.length} targets. Each bar is one type of target; the colours say what the target is for. Click a segment to filter the table.`);
  c1.append(legend(ROLE_ORDER.map((r) => ({ name: ROLE_NAME[r], color: roleColor(r), tip: ROLE_DEF[r] }))));
  const ch = H('div', { class: 'chart' });
  c1.append(ch);
  host.append(c1);
  const draw = () => stackedRows(ch, types.map((t) => ({ label: TYPE_NAME[t], key: t, tipTitle: `${TYPE_NAME[t]} targets: ${TYPE_DEF[t]}`, segs: ROLE_ORDER.map((r, i) => ({ key: r, name: ROLE_NAME[r], color: roleColor(r), on: roleOn(r), count: T.filter((x) => x.type === t && x.role === r).length, tex: i })) })), {
    mode: 'count', labelW: 135, aria: 'Targets by type and role', onSeg: (row, seg) => setTF({ type: row.key, role: seg.key, q: '', policy: '' }),
  });
  draw();
  renderers.tgt_re = draw;
  window.addEventListener('resize', () => { if (!document.getElementById('p-tgt').hidden) { clearTimeout(draw.t); draw.t = setTimeout(draw, 120); } });

  const card = cardWrap('All targets', 'Hover a row for the full statement, how it is measured, and any known deviation.');
  const tb = H('div', { class: 'toolbar' });
  const q = H('input', { type: 'search', placeholder: 'Search id, statement, source, check labels' });
  const mkSel = (key, label, opts) => { const s = H('select', { 'aria-label': label }, H('option', { value: '', text: `${label}: all` }), opts.map(([v, n]) => H('option', { value: v, text: n }))); s.onchange = () => setTF({ [key]: s.value }); return s; };
  const sType = mkSel('type', 'Type', types.map((t) => [t, TYPE_NAME[t]]));
  const sRole = mkSel('role', 'Role', ROLE_ORDER.map((r) => [r, ROLE_NAME[r]]));
  const sPol = mkSel('policy', 'Whose play', [...new Set(T.map((x) => x.policy || '_none'))].map((p) => [p, p === '_none' ? '(not stated)' : p]));
  const count = H('span', { class: 'hint' });
  tb.append(q, sType, sRole, sPol, H('button', { class: 'btn', text: 'Clear filters', onclick: () => setTF({ q: '', type: '', role: '', policy: '' }) }), count);
  const wrap = H('div', { class: 'tablewrap' });
  card.append(tb, wrap);
  host.append(card);
  const cols = [
    { label: 'Id', get: (t) => t.id, mono: true, nowrap: true },
    { label: 'Statement', get: (t) => t.statement, clamp: true },
    { label: 'Type', get: (t) => TYPE_NAME[t.type] || t.type },
    { label: 'Value', get: (t) => fmtTargetValue(t), clamp: true },
    { label: 'Tolerance', get: (t) => t.tolerance || '', clamp: true, fmt: (v) => (v ? v : 'not stated') },
    { label: 'Source', get: (t) => t.source || '', clamp: true },
    { label: 'Role', get: (t) => ROLE_NAME[t.role] || t.role },
    { label: 'Check labels', get: (t) => (t.checkLabels || []).join('; '), clamp: true, fmt: (v) => v || 'none' },
  ];
  const tipOf = (t) => ({
    title: t.id,
    rows: [{ c: roleColor(t.role), v: ROLE_NAME[t.role], n: ROLE_DEF[t.role] }],
    lines: [['Statement', t.statement], ['Measured by', t.metric], ['Value', fmtTargetValue(t)], ...(t.tolerance ? [['Tolerance', t.tolerance]] : []), ['Source', t.source],
      ...(t.policy ? [['Whose play', t.policy]] : []), ...(t.presets ? [['Worlds', t.presets.join(', ')]] : []), ...(t.fits && t.fits.length ? [['Fits', t.fits.join(', ')]] : []),
      ...(t.known ? [['Known deviation', t.known]] : []), ...(t.grade ? [['Grade', t.grade]] : [])],
  });
  const test = (t) => {
    if (tf.type && t.type !== tf.type) return false;
    if (tf.role && t.role !== tf.role) return false;
    if (tf.policy && (t.policy || '_none') !== tf.policy) return false;
    if (tf.q) { const h = [t.id, t.statement, t.source, (t.checkLabels || []).join(' ')].join(' ').toLowerCase(); if (!tf.q.toLowerCase().split(/\s+/).every((w) => h.includes(w))) return false; }
    return true;
  };
  const table = dataTable(wrap, cols, T.filter(test), { sort: { col: 0, dir: 1 }, rowTip: tipOf, limit: 250 });
  function sync() {
    q.value = tf.q; sType.value = tf.type; sRole.value = tf.role; sPol.value = tf.policy;
    const rows = T.filter(test);
    table.redraw(rows);
    count.textContent = `${rows.length} of ${T.length} targets`;
  }
  q.oninput = () => { tf.q = q.value; sync(); };
  window.setTF = (patch) => { Object.assign(tf, patch); sync(); if (patch.type || patch.role) card.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  sync();
}
function setTF(p) { window.setTF(p); }
renderers.tgt = renderTargets;

// ---------------------------------------------------------------- header + start
(function meta() {
  const el = document.getElementById('meta');
  const parts = RUNS.map((r) => {
    const cfg = r.config || {};
    const commit = ['commit', 'gitCommit', 'git'].map((k) => cfg[k]).find((v) => typeof v === 'string');
    const pr = r.progress && typeof r.progress.done === 'number' && typeof r.progress.total === 'number' ? r.progress : null;
    const state = pr ? (pr.done < pr.total ? `in progress ${pr.done} of ${pr.total}` : 'finished') : 'progress not recorded';
    return `${r.name}: ${r.games.length} games, ${state}${commit ? ', commit ' + String(commit).slice(0, 8) : ''}`;
  });
  el.textContent = parts.join('  |  ') + `  |  built ${D.generated.slice(0, 16).replace('T', ' ')}`;
})();
showTab('out');
