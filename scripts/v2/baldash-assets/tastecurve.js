// ================================================================ Scenarios card: research taste, AI Futures Model vs game
// Reads D.tastecurve (balance/mechanics/tastecurve.json, written by scripts/v2/tastecurve.ts). Appended after scenarios.js.
function tasteCurveCard() {
  const T = D.tastecurve;
  const view = { m: 'date' };
  const MODES = [['date', 'AI Futures Model placed by date'], ['ai2027', 'Placed at SC: ai2027'], ['fast', 'Placed at SC: fast']];
  const GAME = { ai2027: { name: 'Game ai2027', color: 'var(--s1)' }, fast: { name: 'Game fast', color: 'var(--s2)' } };
  const host = H('div', { class: 'chart' });
  const seg = H('div', { class: 'seg-ctl', style: { marginLeft: '0' } });
  const btns = MODES.map(([k, t]) => H('button', { text: t, 'aria-pressed': String(view.m === k), onclick: () => { view.m = k; draw(); } }));
  seg.append(...btns);
  const sub = H('div', { class: 'sub' });
  const card = H('div', { class: 'card' }, H('div', { class: 'scn-h' }, H('h2', { text: 'Research taste: AI Futures Model vs game (taste + ideation)' }), seg), sub, host);
  const fmtX = (v) => (v >= 1e6 ? (v / 1e6).toPrecision(2) + 'M' : v >= 1e4 ? (v / 1e3).toPrecision(2) + 'k' : v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(0) : v.toFixed(1)) + 'x';
  const tickX = (v) => v.toLocaleString('en-US') + 'x';
  function draw() {
    clear(host); clear(sub);
    btns.forEach((b, i) => b.setAttribute('aria-pressed', String(MODES[i][0] === view.m)));
    const presets = view.m === 'date' ? ['ai2027', 'fast'] : [view.m];
    const A = view.m === 'date' ? { median: T.aifm.median, p25: T.aifm.p25, p75: T.aifm.p75 } : T.aifm.scAligned[view.m];
    sub.append('How many times faster research runs from taste, against today (1x), as AI gets more capable. The x axis is G, the log of effective compute; each step up the y axis is ten times more. The black line is the AI Futures Model’s aggregate research taste at its median settings; the grey band is the middle half of its taste settings. The solid coloured lines are the game’s taste plus ideation together, as the research input a repeating line receives when ideas are the limit, with labour and compute held at today’s lab. The dashed lines are the game’s taste alone, in the ideation rate. Taste counts a second time in what each result brings, and AI labour adds to the ideas, so the gap between solid and dashed is both. ',
      view.m === 'date' ? 'The AI Futures Model is placed on the game’s axis by date: both start from the same effective compute today.' : `The AI Futures Model is placed so that its AI2027 superhuman coder (SC) sits at the game’s (G ${T.game[view.m].preset.gSC}), which takes out the difference between the two timelines.`);
    const x = T.x, n = x.length;
    const vals = [A.median, A.p25, A.p75];
    for (const p of presets) vals.push(T.game[p].lineInputIdeaLimited, T.game[p].taste);
    const ymax = Math.min(1e7, Math.pow(10, Math.ceil(Math.log10(Math.max(...vals.flat()))))), ymin = 1;
    const W = Math.max(host.clientWidth || 900, 640), Lm = 84, Rm = 150, top = 14, ph = 340, bot = 44;
    const x0 = x[0], x1 = x[n - 1], xs = (g) => Lm + ((g - x0) / (x1 - x0)) * (W - Lm - Rm);
    const svg = S('svg', { width: W, height: top + ph + bot, role: 'group', 'aria-label': 'Research taste multiplier against AI capability, AI Futures Model and game' });
    const cid = 'tc-clip-' + view.m;
    svg.append(S('clipPath', { id: cid }, S('rect', { x: Lm, y: top, width: W - Lm - Rm, height: ph })));
    const ys = logAxis({ svg, L: Lm, W, R: Rm, top, ph }, decadeTicks(ymin, ymax, tickX), ymin, ymax);
    for (let g = Math.ceil(x0 / 2) * 2; g <= x1 + 1e-9; g += 2) {
      svg.append(S('line', { x1: xs(g), x2: xs(g), y1: top, y2: top + ph, stroke: 'var(--grid)', 'stroke-width': 1 }));
      svg.append(S('text', { x: xs(g), y: top + ph + 16, 'text-anchor': 'middle', class: 't-muted' }, String(g)));
    }
    svg.append(S('line', { x1: Lm, x2: W - Rm, y1: top + ph, y2: top + ph, stroke: 'var(--axis)', 'stroke-width': 1 }));
    svg.append(S('text', { x: (Lm + W - Rm) / 2, y: top + ph + 36, 'text-anchor': 'middle', class: 't-muted' }, 'AI capability: G, the log of effective compute (today 27.7)'));
    const up = x.map((g, i) => `${xs(g)},${ys(Math.max(A.p75[i], 1))}`), dn = x.map((g, i) => `${xs(g)},${ys(Math.max(A.p25[i], 1))}`).reverse();
    svg.append(S('polygon', { points: up.concat(dn).join(' '), style: 'fill:var(--ink);opacity:0.13;stroke:none' }));
    const line = (arr, color, dash, w) => S('polyline', { 'clip-path': `url(#${cid})`, points: x.map((g, i) => `${xs(g)},${ys(Math.max(arr[i], 1))}`).join(' '), fill: 'none', style: `stroke:${color};stroke-width:${w};${dash ? 'stroke-dasharray:6 4;' : ''}`, 'stroke-linejoin': 'round' });
    svg.append(line(A.median, 'var(--ink)', false, 2.5));
    const ends = [{ y: ys(Math.max(A.median[n - 1], 1)), name: 'AI Futures Model', color: 'var(--ink)' }];
    for (const p of presets) {
      svg.append(line(T.game[p].taste, GAME[p].color, true, 2));
      svg.append(line(T.game[p].lineInputIdeaLimited, GAME[p].color, false, 2.5));
      ends.push({ y: Math.max(top, ys(Math.max(T.game[p].lineInputIdeaLimited[n - 1], 1))), name: GAME[p].name + (T.game[p].lineInputIdeaLimited[n - 1] > ymax ? ' (off chart)' : ''), color: GAME[p].color });
      ends.push({ y: Math.max(top, ys(Math.max(T.game[p].taste[n - 1], 1))), name: GAME[p].name.replace('Game ', '') + ' taste only', color: GAME[p].color, thin: true });
    }
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i].ly = Math.max(ends[i].y, (ends[i - 1].ly ?? ends[i - 1].y) + 14);
    if (ends.length) ends[0].ly = ends[0].y;
    for (const e of ends) svg.append(S('text', { x: W - Rm + 8, y: (e.ly ?? e.y) + 4, style: `fill:${e.color};font-weight:${e.thin ? 400 : 600};font-size:12px` }, e.name));
    const cw = (W - Lm - Rm) / (n - 1), hits = [];
    x.forEach((g, i) => {
      const r = S('rect', { x: xs(g) - cw / 2, y: top, width: cw, height: ph, class: 'hit', fill: 'transparent', tabindex: '0' });
      const get = () => {
        const rows = [{ c: 'var(--ink)', v: fmtX(A.median[i]), n: `AI Futures Model (middle half ${fmtX(A.p25[i])} to ${fmtX(A.p75[i])})`, raw: A.median[i] }];
        for (const p of presets) {
          const t = T.game[p];
          rows.push({ c: GAME[p].color, v: fmtX(t.lineInputIdeaLimited[i]), n: `${GAME[p].name}, taste plus ideation (line research input)`, raw: t.lineInputIdeaLimited[i] });
          rows.push({ c: GAME[p].color, v: fmtX(t.lineInputExpLimited[i]), n: `${GAME[p].name}, same when experiments are the limit`, raw: t.lineInputExpLimited[i] });
          rows.push({ c: GAME[p].color, v: fmtX(t.taste[i]), n: `${GAME[p].name}, taste alone (in the ideation rate)`, raw: t.taste[i] });
          rows.push({ c: GAME[p].color, v: fmtX(t.perIdeaLineRateAged[i]), n: `${GAME[p].name}, taste in each result`, raw: t.perIdeaLineRateAged[i] });
          rows.push({ c: GAME[p].color, v: fmtX(t.ideation[i]), n: `${GAME[p].name}, AI labour in ideas`, raw: t.ideation[i] });
        }
        return { title: `G ${g.toFixed(2)}`, rows, lines: [`By date, the AI Futures Model’s AI research taste here is ${T.aifm.sd[i]} standard deviations above the median researcher.`, ...presets.map((p) => `${GAME[p].name}: AI research taste ${T.game[p].sdAI[i]} standard deviations; AI does ${Math.round(T.game[p].aiIdeasShare[i] * 100)}% of the ideas.`)] };
      };
      r.setAttribute('aria-label', tipText(get()));
      bindTip(r, get);
      hits.push(r);
    });
    svg.append(...hits);
    host.append(svg);
  }
  setTimeout(draw, 0);
  return card;
}
